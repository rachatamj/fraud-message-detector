import os

MODEL_PATH = "P1g/fraud-message-detector-model"
LABELS = ['ข้อความทั่วไป', 'ข้อความหลอกลวง']
MAX_TOKEN_LENGTH = 512
CORS_ORIGINS = ['http://127.0.0.1:8000', 'http://localhost:8000']

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres@localhost:5432/fraudmsg')

ADMIN_USERNAMES = ["admin"]