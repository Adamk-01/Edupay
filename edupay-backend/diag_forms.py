import json
import sys
import os
sys.path.append(os.getcwd())

from app.core.database import SessionLocal
# Import all models to ensure they are registered
from app.models import user, wallet, exam_order
from app.routers.forms import Institution, SchoolForm, FormOrder, FormStatus
from app.routers.bills import BillOrder
from app.routers.news import NewsPost
from app.routers.consultation import Consultant, ConsultantStatus, ConsultationSession

def debug():
    db = SessionLocal()
    try:
        f_count = db.query(SchoolForm).count()
        i_count = db.query(Institution).count()
        forms = db.query(SchoolForm).all()
        
        res = {
            "forms_count": f_count,
            "institutions_count": i_count,
            "forms": [
                {
                    "type": f.form_type,
                    "institution_id": str(f.institution_id),
                    "price": float(f.price),
                    "status": f.status
                } for f in forms
            ]
        }
        print(json.dumps(res, indent=2))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug()
