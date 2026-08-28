# EduPay.ng Backend

FastAPI backend for EduPay.ng

## Setup

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment
cp .env.example .env
# Edit .env with your real values

# 4. Run migrations
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head

# 5. Start server
uvicorn main:app --reload
```

API docs available at: http://localhost:8000/docs

## Folder Structure

```
edupay-backend/
├── main.py                  ← App entry point
├── requirements.txt
├── .env.example
├── alembic/                 ← DB migrations
├── app/
│   ├── core/
│   │   ├── config.py        ← Settings from .env
│   │   ├── database.py      ← SQLAlchemy engine
│   │   └── security.py      ← JWT + bcrypt
│   ├── models/
│   │   ├── user.py
│   │   ├── wallet.py
│   │   └── exam_order.py
│   ├── schemas/
│   │   ├── auth.py
│   │   └── wallet.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── wallet.py
│   │   ├── exams.py
│   │   ├── forms.py
│   │   ├── bills.py
│   │   ├── news.py
│   │   ├── consultation.py
│   │   ├── payments.py
│   │   ├── admin.py
│   │   └── uploads.py
│   ├── services/
│   │   ├── paystack_service.py
│   │   ├── vtu_service.py
│   │   └── email_service.py
│   └── dependencies.py
```
