import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import psycopg

from config import DATABASE_URL
try:
    from config import ADMIN_USERNAMES   
except ImportError:
    ADMIN_USERNAMES = []                 
PBKDF2_ITERATIONS = 600000
SESSION_COOKIE_NAME = 'session_token'
HISTORY_LIMIT = 20
HISTORY_MAX_TEXT_LENGTH = 2000


def _connect() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL)


def init_db() -> None:
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                salt TEXT NOT NULL,
                password_hash TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                username TEXT NOT NULL,
                text TEXT NOT NULL,
                risk_key TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                spam_probability DOUBLE PRECISION NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_history_user "
                     "ON history (username, id)")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TEXT")
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS risk_log (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                username TEXT NOT NULL,
                history_id BIGINT,
                risk_key TEXT NOT NULL,
                spam_probability DOUBLE PRECISION NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_risk_log_user "
                     "ON risk_log (username, id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_risk_log_history "
                     "ON risk_log (history_id)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS admin_log (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                admin TEXT NOT NULL,
                action TEXT NOT NULL,
                target TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            INSERT INTO risk_log (username, history_id, risk_key, spam_probability, created_at)
            SELECT username, id, risk_key, spam_probability, created_at FROM history
            WHERE NOT EXISTS (SELECT 1 FROM risk_log)
            ORDER BY id
        """)


def _hash_password(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERATIONS).hex()


PASSWORD_MIN_LENGTH = 8


def password_problem(username: str, password: str) -> str | None:
    if len(password) < PASSWORD_MIN_LENGTH:
        return f'รหัสผ่านต้องยาวอย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร'
    if not any(ch.isalpha() for ch in password):
        return 'รหัสผ่านต้องมีตัวอักษรอย่างน้อย 1 ตัว'
    if not any(ch.isdigit() for ch in password):
        return 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว'
    if username and username.strip().lower() in password.lower():
        return 'รหัสผ่านต้องไม่มีชื่อผู้ใช้อยู่ในนั้น'
    return None


def create_user(username: str, password: str) -> bool:
    salt = secrets.token_bytes(16)
    password_hash = _hash_password(password, salt)
    try:
        with _connect() as conn:
            conn.execute('INSERT INTO users (username, salt, password_hash, created_at) VALUES (%s, %s, %s, %s)',
                         (username, salt.hex(), password_hash, datetime.now(timezone.utc).isoformat()))
        return True
    except psycopg.errors.UniqueViolation:
        return False


def verify_user(username: str, password: str) -> bool:
    with _connect() as conn:
        row = conn.execute('SELECT salt, password_hash FROM users WHERE username = %s', (username,)).fetchone()
    if row is None:
        return False
    salt_hex, stored_hash = row
    computed_hash = _hash_password(password, bytes.fromhex(salt_hex))
    return hmac.compare_digest(computed_hash, stored_hash)


_sessions: dict[str, str] = {}


def create_session(username: str) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = username
    return token


def get_session_user(token: str | None) -> str | None:
    if not token:
        return None
    return _sessions.get(token)


def destroy_session(token: str | None) -> None:
    if token:
        _sessions.pop(token, None)


def add_history(username: str, text: str, risk_key: str,
                risk_level: str, spam_probability: float) -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    text = text.replace('\x00', '')[:HISTORY_MAX_TEXT_LENGTH]   
    with _connect() as conn:
        row = conn.execute(
            "INSERT INTO history (username, text, risk_key, risk_level, "
            "spam_probability, created_at) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (username, text, risk_key, risk_level, spam_probability, created_at)).fetchone()
        conn.execute(
            "INSERT INTO risk_log (username, history_id, risk_key, spam_probability, created_at) "
            "VALUES (%s, %s, %s, %s, %s)",
            (username, row[0], risk_key, spam_probability, created_at))
        conn.execute(
            "DELETE FROM history WHERE username = %s AND id NOT IN "
            "(SELECT id FROM history WHERE username = %s "
            "ORDER BY id DESC LIMIT %s)",
            (username, username, HISTORY_LIMIT))


def get_history(username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute('SELECT id, text, risk_key, risk_level, spam_probability, created_at FROM history WHERE username = %s ORDER BY id DESC LIMIT %s', (username, HISTORY_LIMIT)).fetchall()
    return [{'id': r[0], 'text': r[1], 'risk_key': r[2], 'risk_level': r[3], 'spam_probability': r[4], 'created_at': r[5]} for r in rows]


def delete_history_item(username: str, item_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute('DELETE FROM history WHERE id = %s AND username = %s', (item_id, username))
        if cur.rowcount > 0:
            conn.execute('DELETE FROM risk_log WHERE history_id = %s AND username = %s', (item_id, username))
            return True
        return False


def clear_history(username: str) -> int:
    with _connect() as conn:
        cur = conn.execute('DELETE FROM history WHERE username = %s', (username,))
        conn.execute('DELETE FROM risk_log WHERE username = %s', (username,))   # ล้างแนวโน้มทั้งหมดด้วย
        return cur.rowcount


TREND_ALLOWED_DAYS = (7, 30, 90, 180, 365)  
TREND_BUCKETS = {7: 7, 30: 4, 90: 6, 180: 6, 365: 12}
TREND_TZ = timezone(timedelta(hours=7))
TREND_MIN_CHECKS_PER_PERIOD = 3   
TREND_STEADY_PP = 5.0             


def _parse_log_time(created_at):
    try:
        dt = datetime.fromisoformat(created_at)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _period_stats(counts: dict) -> dict:
    total = counts['low'] + counts['caution'] + counts['high']
    risky = counts['caution'] + counts['high']
    return {'total': total, 'risky': risky, 'normal': counts['low'], 'caution': counts['caution'], 'high': counts['high'], 'rate': round(risky / total * 100, 1) if total > 0 else None}


def classify_trend(current: dict, previous: dict) -> dict:
    if previous['total'] == 0:
        return {'status': 'insufficient', 'delta_pp': None, 'reason': 'no_previous'}
    if current['total'] == 0:
        return {'status': 'insufficient', 'delta_pp': None, 'reason': 'no_current'}
    if current['total'] < TREND_MIN_CHECKS_PER_PERIOD or previous['total'] < TREND_MIN_CHECKS_PER_PERIOD:
        return {'status': 'insufficient', 'delta_pp': None, 'reason': 'too_few'}
    delta = round(current['rate'] - previous['rate'], 1)
    if abs(delta) < TREND_STEADY_PP:
        status = 'steady'
    else:
        status = 'up' if delta > 0 else 'down'
    return {'status': status, 'delta_pp': delta, 'reason': None}


def get_risk_trend(username: str, days: int, now: datetime | None = None) -> dict:
    if days not in TREND_ALLOWED_DAYS:
        raise ValueError(f'days must be one of {TREND_ALLOWED_DAYS}')
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(TREND_TZ).date()
    cur_start = today - timedelta(days=days - 1)
    prev_start = cur_start - timedelta(days=days)
    n = TREND_BUCKETS[days]
    edges = [days * i // n for i in range(n + 1)]
    bucket_of = [0] * days
    for bi in range(n):
        for off in range(edges[bi], edges[bi + 1]):
            bucket_of[off] = bi

    with _connect() as conn:
        rows = conn.execute('SELECT risk_key, created_at FROM risk_log WHERE username = %s ORDER BY id ASC', (username,)).fetchall()

    zero = lambda: {'low': 0, 'caution': 0, 'high': 0}
    cur_counts, prev_counts = zero(), zero()
    buckets = [zero() for _ in range(n)]
    all_total = 0
    oldest = None
    for risk_key, created_at in rows:
        if risk_key not in ('low', 'caution', 'high'):
            continue
        dt = _parse_log_time(created_at)
        if dt is None:
            continue
        all_total += 1
        d = dt.astimezone(TREND_TZ).date()
        if oldest is None or d < oldest:
            oldest = d
        if cur_start <= d <= today:
            cur_counts[risk_key] += 1
            buckets[bucket_of[(d - cur_start).days]][risk_key] += 1
        elif prev_start <= d < cur_start:
            prev_counts[risk_key] += 1

    points = []
    for i, c in enumerate(buckets):
        start = cur_start + timedelta(days=edges[i])
        end = cur_start + timedelta(days=edges[i + 1] - 1)
        st = _period_stats(c)
        points.append({'start': start.isoformat(), 'end': end.isoformat(), 'total': st['total'], 'risky': st['risky'], 'rate': st['rate']})

    current = _period_stats(cur_counts)
    previous = _period_stats(prev_counts)
    incomplete = False   # risk_log ไม่ถูกตัดที่ HISTORY_LIMIT จึงไม่มีกรณีข้อมูลย้อนหลังขาด
    return {
        'days': days,
        'period_start': cur_start.isoformat(),
        'period_end': today.isoformat(),
        'previous_start': prev_start.isoformat(),
        'previous_end': (cur_start - timedelta(days=1)).isoformat(),
        'all_time_total': all_total,
        'oldest_date': oldest.isoformat() if oldest else None,
        'history_limit': HISTORY_LIMIT,
        'data_incomplete': incomplete,
        'current': current,
        'previous': previous,
        'points': points,
        'trend': classify_trend(current, previous),
        'min_checks': TREND_MIN_CHECKS_PER_PERIOD,
        'steady_pp': TREND_STEADY_PP,
    }


# ============================================================
# ส่วนผู้ดูแลระบบ (แอดมิน)
# ============================================================
def is_admin(username: str | None) -> bool:
    return bool(username) and username in ADMIN_USERNAMES


def destroy_user_sessions(username: str) -> int:
    tokens = [t for t, u in _sessions.items() if u == username]
    for t in tokens:
        _sessions.pop(t, None)
    return len(tokens)


def log_admin_action(admin: str, action: str, target: str) -> None:
    with _connect() as conn:
        conn.execute('INSERT INTO admin_log (admin, action, target, created_at) VALUES (%s, %s, %s, %s)',
                     (admin, action, target, datetime.now(timezone.utc).isoformat()))


def list_users_admin() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            'SELECT u.username, u.created_at, COALESCE(r.cnt, 0), r.last_at '
            'FROM users u LEFT JOIN ('
            '  SELECT username, COUNT(*) AS cnt, MAX(created_at) AS last_at FROM risk_log GROUP BY username'
            ') r ON r.username = u.username ORDER BY u.username').fetchall()
    return [{'username': r[0], 'created_at': r[1], 'checks': int(r[2]), 'last_check': r[3],
             'is_admin': is_admin(r[0])} for r in rows]


def admin_stats(days: int = 30, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(TREND_TZ).date()
    start = today - timedelta(days=days - 1)
    cutoff = (now - timedelta(days=days + 2)).isoformat()
    with _connect() as conn:
        users_total = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        by_risk_rows = conn.execute('SELECT risk_key, COUNT(*) FROM risk_log GROUP BY risk_key').fetchall()
        recent = conn.execute('SELECT risk_key, created_at FROM risk_log WHERE created_at >= %s', (cutoff,)).fetchall()
    by_risk = {'low': 0, 'caution': 0, 'high': 0}
    for k, c in by_risk_rows:
        if k in by_risk:
            by_risk[k] = int(c)
    daily = {(start + timedelta(days=i)).isoformat(): {'date': (start + timedelta(days=i)).isoformat(),
                                                       'total': 0, 'risky': 0, 'low': 0, 'caution': 0, 'high': 0}
             for i in range(days)}
    for risk_key, created_at in recent:
        dt = _parse_log_time(created_at)
        if dt is None:
            continue
        d = dt.astimezone(TREND_TZ).date().isoformat()
        if d in daily:
            daily[d]['total'] += 1
            if risk_key in ('low', 'caution', 'high'):
                daily[d][risk_key] += 1
            if risk_key in ('caution', 'high'):
                daily[d]['risky'] += 1
    daily_list = list(daily.values())
    return {
        'users_total': int(users_total),
        'checks_total': sum(by_risk.values()),
        'checks_today': daily_list[-1]['total'],
        'by_risk': by_risk,
        'daily': daily_list,
    }


def delete_user(username: str) -> bool:
    """ลบบัญชีผู้ใช้พร้อมประวัติและสถิติทั้งหมดของบัญชีนั้น"""
    with _connect() as conn:
        conn.execute('DELETE FROM history WHERE username = %s', (username,))
        conn.execute('DELETE FROM risk_log WHERE username = %s', (username,))
        cur = conn.execute('DELETE FROM users WHERE username = %s', (username,))
        ok = cur.rowcount > 0
    if ok:
        destroy_user_sessions(username)
    return ok


def reset_password(username: str, new_password: str) -> bool:
    """ตั้งรหัสผ่านใหม่ให้ผู้ใช้ (สุ่ม salt ใหม่) และให้ออกจากระบบทุกอุปกรณ์"""
    salt = secrets.token_bytes(16)
    password_hash = _hash_password(new_password, salt)
    with _connect() as conn:
        cur = conn.execute('UPDATE users SET salt = %s, password_hash = %s WHERE username = %s',
                           (salt.hex(), password_hash, username))
        ok = cur.rowcount > 0
    if ok:
        destroy_user_sessions(username)
    return ok

