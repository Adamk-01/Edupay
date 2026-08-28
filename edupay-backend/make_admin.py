import sys
import os
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import user, wallet, exam_order
from app.routers.forms import Institution, SchoolForm, FormOrder
from app.routers.bills import BillOrder
from app.routers.news import NewsPost
from app.routers.consultation import Consultant, ConsultantStatus, ConsultationSession
from app.models.user import User, UserRole

def make_admin(email: str = None):
    db: Session = SessionLocal()
    if email:
        user = db.query(User).filter(User.email == email).first()
    else:
        user = db.query(User).first()
        
    if not user:
        print("No user found in database. Please register first on the main site.")
        return
    
    user.role = UserRole.admin
    db.commit()
    print(f"User {user.email} is now an ADMIN!")
    db.close()

if __name__ == "__main__":
    # If you want to specify an email, pass it as a command line argument
    mail = sys.argv[1] if len(sys.argv) > 1 else None
    make_admin(mail)
