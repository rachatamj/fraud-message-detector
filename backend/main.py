from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
import auth
from config import MODEL_PATH, LABELS, MAX_TOKEN_LENGTH, CORS_ORIGINS
from model_utils import load_model, predict, get_spam_probability, get_risk_assessment, generate_signals, generate_signal_details, get_recommended_actions, IMPORT_ERROR
model_state = {'model': None, 'tokenizer': None, 'device': None, 'error': None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    auth.init_db()
    if IMPORT_ERROR is not None:
        model_state['error'] = f'ไม่สามารถโหลดไลบรารีที่จำเป็นได้ (torch / transformers): {IMPORT_ERROR}'
    else:
        model, tokenizer, device, error = load_model(MODEL_PATH)
        model_state['model'] = model
        model_state['tokenizer'] = tokenizer
        model_state['device'] = device
        model_state['error'] = error
    yield
app = FastAPI(title='Thai Spam Detector API', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=['*'], allow_headers=['*'])


def get_current_username(request: Request) -> str:
    token = request.cookies.get(auth.SESSION_COOKIE_NAME)
    username = auth.get_session_user(token)
    if username is None:
        raise HTTPException(status_code=401, detail='กรุณาเข้าสู่ระบบก่อนใช้งาน')
    return username


def require_admin(username: str=Depends(get_current_username)) -> str:
    if not auth.is_admin(username):
        raise HTTPException(status_code=403, detail='ต้องเป็นผู้ดูแลระบบเท่านั้น')
    return username



class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1, description='ข้อความภาษาไทยที่ต้องการตรวจสอบ')


class ProbabilityItem(BaseModel):
    label: str
    percentage: float


class SignalDetail(BaseModel):
    text: str
    matched: list[str] = []
    source_name: str | None = None
    source_url: str | None = None


class PredictResponse(BaseModel):
    label: str
    confidence: float
    probabilities: list[ProbabilityItem]
    spam_probability: float
    risk_key: str
    risk_level: str
    risk_advice: str
    signals: list[str]
    recommended_actions: list[str]
    signal_details: list[SignalDetail] = []


class AdminDaily(BaseModel):
    date: str
    total: int
    risky: int
    low: int = 0
    caution: int = 0
    high: int = 0


class AdminRiskCount(BaseModel):
    low: int
    caution: int
    high: int


class AdminStatsResponse(BaseModel):
    users_total: int
    checks_total: int
    checks_today: int
    by_risk: AdminRiskCount
    daily: list[AdminDaily]
    model_loaded: bool
    device: str | None = None


class AdminUserItem(BaseModel):
    username: str
    created_at: str | None = None
    checks: int
    last_check: str | None = None
    is_admin: bool


class AdminUsersResponse(BaseModel):
    items: list[AdminUserItem]


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=1, max_length=128)   # เงื่อนไขจริงตรวจใน auth.password_problem


class HealthResponse(BaseModel):
    model_loaded: bool
    device: str | None = None
    error: str | None = None


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=1, max_length=128)   # เงื่อนไขจริงตรวจใน auth.password_problem (ตอบ 400 เป็นภาษาไทย)


class LoginRequest(BaseModel):
    username: str
    password: str


class MeResponse(BaseModel):
    username: str
    is_admin: bool = False


class HistoryItem(BaseModel):
    id: int
    text: str
    risk_key: str
    risk_level: str
    spam_probability: float
    created_at: str


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
    limit: int


class RiskPeriod(BaseModel):
    total: int
    risky: int
    normal: int
    caution: int
    high: int
    rate: float | None


class RiskTrendPoint(BaseModel):
    start: str
    end: str
    total: int
    risky: int
    rate: float | None


class RiskTrendStatus(BaseModel):
    status: str
    delta_pp: float | None
    reason: str | None


class RiskTrendResponse(BaseModel):
    days: int
    period_start: str
    period_end: str
    previous_start: str
    previous_end: str
    all_time_total: int
    oldest_date: str | None
    history_limit: int
    data_incomplete: bool
    current: RiskPeriod
    previous: RiskPeriod
    points: list[RiskTrendPoint]
    trend: RiskTrendStatus
    min_checks: int
    steady_pp: float


@app.get('/api/health', response_model=HealthResponse)
def health():
    return HealthResponse(model_loaded=model_state['model'] is not None, device=str(model_state['device']) if model_state['device'] else None, error=model_state['error'])


@app.post('/api/register')
def register(payload: RegisterRequest):
    username = payload.username.strip()
    problem = auth.password_problem(username, payload.password)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    ok = auth.create_user(username, payload.password)
    if not ok:
        raise HTTPException(status_code=400, detail='ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว กรุณาเลือกชื่ออื่น')
    return {'message': 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ'}


@app.post('/api/login')
def login(payload: LoginRequest, response: Response):
    username = payload.username.strip()
    if not auth.verify_user(username, payload.password):
        raise HTTPException(status_code=401, detail='ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    token = auth.create_session(username)
    response.set_cookie(key=auth.SESSION_COOKIE_NAME, value=token, 
                        httponly=True, samesite='lax', secure=False, max_age=60 * 60 * 8, path='/')
    return {'username': username}


@app.post('/api/logout')
def logout(request: Request, response: Response):
    token = request.cookies.get(auth.SESSION_COOKIE_NAME)
    auth.destroy_session(token)
    response.delete_cookie(auth.SESSION_COOKIE_NAME, path='/')
    return {'message': 'ออกจากระบบแล้ว'}


@app.get('/api/me', response_model=MeResponse)
def me(username: str=Depends(get_current_username)):
    return MeResponse(username=username, is_admin=auth.is_admin(username))


@app.post('/api/predict', response_model=PredictResponse)
def predict_endpoint(payload: PredictRequest, username: str=Depends(get_current_username)):
    if model_state['error'] is not None or model_state['model'] is None:
        raise HTTPException(status_code=503, detail=model_state['error'] or 'โมเดลยังไม่พร้อมใช้งาน')
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail='กรุณาระบุข้อความที่ต้องการตรวจสอบ')
    try:
        pred_label, confidence, detail = predict(text, model_state['model'], model_state['tokenizer'], model_state['device'], 
                                                 LABELS, max_length=MAX_TOKEN_LENGTH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'เกิดข้อผิดพลาดระหว่างการทำนายผล: {e}')
    spam_probability = get_spam_probability(detail, LABELS)
    risk_key, risk_level, risk_advice = get_risk_assessment(spam_probability)
    signal_details = generate_signal_details(text)
    signals = [d['text'] for d in signal_details]
    recommended_actions = get_recommended_actions(risk_key, text)
    try:
        auth.add_history(username, text, risk_key, risk_level, spam_probability)
    except Exception as e:
        print(f'[history] บันทึกประวัติไม่สำเร็จ: {e}')
    return PredictResponse(label=pred_label, confidence=confidence, probabilities=detail, spam_probability=spam_probability, 
                           risk_key=risk_key, risk_level=risk_level, risk_advice=risk_advice, signals=signals, 
                           recommended_actions=recommended_actions, signal_details=signal_details)


@app.get('/api/history', response_model=HistoryResponse)
def history_list(username: str=Depends(get_current_username)):
    return HistoryResponse(items=auth.get_history(username), limit=auth.HISTORY_LIMIT)


@app.delete('/api/history/{item_id}')
def history_delete_one(item_id: int, username: str=Depends(get_current_username)):
    if not auth.delete_history_item(username, item_id):
        raise HTTPException(status_code=404, detail='ไม่พบรายการประวัตินี้')
    return {'message': 'ลบรายการแล้ว'}


@app.delete('/api/history')
def history_clear(username: str=Depends(get_current_username)):
    count = auth.clear_history(username)
    return {'message': 'ล้างประวัติแล้ว', 'deleted': count}


@app.get('/api/trend', response_model=RiskTrendResponse)
def risk_trend(days: int=Query(30), username: str=Depends(get_current_username)):
    if days not in auth.TREND_ALLOWED_DAYS:
        raise HTTPException(status_code=400, detail='ช่วงเวลาไม่ถูกต้อง เลือกได้เฉพาะ ' + ', '.join((str(d) for d in auth.TREND_ALLOWED_DAYS)) + ' วัน')
    return RiskTrendResponse(**auth.get_risk_trend(username, days))


@app.get('/api/admin/stats', response_model=AdminStatsResponse)
def admin_stats(admin: str=Depends(require_admin)):
    data = auth.admin_stats(days=30)
    return AdminStatsResponse(**data, model_loaded=model_state['model'] is not None, device=str(model_state['device']) if model_state['device'] else None)


@app.get('/api/admin/users', response_model=AdminUsersResponse)
def admin_users(admin: str=Depends(require_admin)):
    return AdminUsersResponse(items=auth.list_users_admin())


@app.post('/api/admin/users/{target}/reset-password')
def admin_reset_password(target: str, payload: ResetPasswordRequest, admin: str=Depends(require_admin)):
    problem = auth.password_problem(target, payload.new_password)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    if not auth.reset_password(target, payload.new_password):
        raise HTTPException(status_code=404, detail='ไม่พบผู้ใช้นี้')
    auth.log_admin_action(admin, 'reset_password', target)
    return {'message': f'ตั้งรหัสผ่านใหม่ให้ {target} แล้ว และออกจากระบบทุกอุปกรณ์ของผู้ใช้นี้'}


@app.delete('/api/admin/users/{target}')
def admin_delete_user(target: str, admin: str=Depends(require_admin)):
    if auth.is_admin(target):
        raise HTTPException(status_code=400, detail='ไม่สามารถลบบัญชีผู้ดูแลระบบได้')
    if not auth.delete_user(target):
        raise HTTPException(status_code=404, detail='ไม่พบผู้ใช้นี้')
    auth.log_admin_action(admin, 'delete_user', target)
    return {'message': f'ลบบัญชี {target} พร้อมประวัติและสถิติทั้งหมดแล้ว'}


FRONTEND_DIR = Path(__file__).resolve().parent.parent / 'frontend'


@app.get('/')
def serve_index():
    index_path = FRONTEND_DIR / 'index.html'
    if not index_path.exists():
        raise HTTPException(status_code=404, detail='ไม่พบไฟล์ frontend/index.html')
    return FileResponse(index_path)


@app.get('/login')
def serve_login():
    login_path = FRONTEND_DIR / 'login.html'
    if not login_path.exists():
        raise HTTPException(status_code=404, detail='ไม่พบไฟล์ frontend/login.html')
    return FileResponse(login_path)


@app.get('/history')
def serve_history():
    history_path = FRONTEND_DIR / 'history.html'
    if not history_path.exists():
        raise HTTPException(status_code=404, detail='ไม่พบไฟล์ frontend/history.html')
    return FileResponse(history_path)


@app.get('/trend')
def serve_trend():
    trend_path = FRONTEND_DIR / 'trend.html'
    if not trend_path.exists():
        raise HTTPException(status_code=404, detail='ไม่พบไฟล์ frontend/trend.html')
    return FileResponse(trend_path)


@app.get('/recovery')
def serve_recovery():
    recovery_path = FRONTEND_DIR / 'recovery.html'
    if not recovery_path.exists():
        raise HTTPException(status_code=404, detail='ไม่พบไฟล์ frontend/recovery.html')
    return FileResponse(recovery_path)


@app.get('/admin')
def serve_admin(request: Request):
    username = auth.get_session_user(request.cookies.get(auth.SESSION_COOKIE_NAME))
    if username is None:
        return RedirectResponse('/login')
    if not auth.is_admin(username):
        return RedirectResponse('/')
    admin_path = FRONTEND_DIR / 'admin.html'
    if not admin_path.exists():
        raise HTTPException(status_code=404, detail='ไม่พบไฟล์ frontend/admin.html')
    return FileResponse(admin_path)


@app.get('/terms')
def serve_terms():
    terms_path = FRONTEND_DIR / 'terms.html'
    if not terms_path.exists():
        raise HTTPException(status_code=404, detail='ไม่พบไฟล์ frontend/terms.html')
    return FileResponse(terms_path)


@app.get('/contact')
def serve_contact():
    contact_path = FRONTEND_DIR / 'contact.html'
    if not contact_path.exists():
        raise HTTPException(status_code=404, detail='ไม่พบไฟล์ frontend/contact.html')
    return FileResponse(contact_path)
if FRONTEND_DIR.exists():
    app.mount('/static', StaticFiles(directory=str(FRONTEND_DIR)), name='static')
