import sys
import os
from datetime import datetime, timedelta
from decimal import Decimal

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base

# Import all models to ensure they are registered
from app.models import user, wallet, exam_order
from app.routers.forms import Institution, SchoolForm, FormOrder, FormStatus
from app.routers.bills import BillOrder
from app.routers.news import NewsPost
from app.routers.consultation import Consultant, ConsultantStatus, ConsultationSession

def seed():
    db: Session = SessionLocal()
    
    # 1. Seed News Posts
    if db.query(NewsPost).count() == 0:
        print("Seeding News...")
        posts = [
            NewsPost(
                title="2026 UTME: JAMB Begins Registration",
                slug="2026-utme-jamb-begins-registration",
                excerpt="The Joint Admissions and Matriculation Board (JAMB) has officially opened the portal for 2026 UTME registrations.",
                body="<p>Potential candidates can now purchase their ePINs on EduPay.ng and proceed to accredited CBT centers for registration. Ensure your NIN is ready before purchasing the PIN.</p>",
                category="JAMB",
                is_published=True,
                is_featured=True,
                read_time="2 min read"
            ),
            NewsPost(
                title="Top 10 Scholarships for Nigerian Students",
                slug="top-10-scholarships-nigerian-students",
                excerpt="Discover the best local and international scholarships available for Nigerian undergraduates in 2026.",
                body="<p>From PTDF to NNPC/Chevron scholarships, there are numerous opportunities to fund your education. Check the eligibility criteria for each below...</p>",
                category="Scholarship",
                is_published=True,
                tag_color="#D1FAE5",
                tag_text_color="#065F46"
            ),
            NewsPost(
                title="UNILAG Post-UTME Form Out",
                slug="unilag-post-utme-form-out",
                excerpt="The University of Lagos has released the application forms for the 2026/2027 academic session.",
                body="<p>Candidates who scored 200 and above in the UTME are eligible to apply. The portal will remain open for three weeks.</p>",
                category="Admission",
                is_published=True
            )
        ]
        db.add_all(posts)
        db.commit()

    # 2. Seed Consultants
    if db.query(Consultant).count() == 0:
        print("Seeding Consultants...")
        consultants = [
            Consultant(
                full_name="Dr. Sarah Adekunle",
                initials="SA",
                role="Admissions Expert & Career Coach",
                specialties="International Admissions, Essay Review",
                price_per_session=Decimal("5000"),
                avatar_color="#1A56DB",
                rating="4.9"
            ),
            Consultant(
                full_name="Prof. Ibrahim Musa",
                initials="IM",
                role="Senior Academic Advisor",
                specialties="Scholarships, Research Proposals",
                price_per_session=Decimal("7500"),
                avatar_color="#10B981",
                rating="5.0"
            )
        ]
        db.add_all(consultants)
        db.commit()

    # 3. Seed Institutions & Forms
    if db.query(Institution).count() == 0:
        print("Seeding Institutions and Forms...")
        unilag = Institution(name="University of Lagos", short_name="UNILAG", type="University", state="Lagos", is_featured=True)
        oau = Institution(name="Obafemi Awolowo University", short_name="OAU", type="University", state="Osun")
        db.add_all([unilag, oau])
        db.commit()
        
        forms = [
            SchoolForm(
                institution_id=unilag.id,
                form_type="Post-UTME",
                price=Decimal("2000"),
                deadline=datetime.utcnow() + timedelta(days=20),
                session="2026/2027",
                status=FormStatus.open
            ),
            SchoolForm(
                institution_id=unilag.id,
                form_type="Direct Entry",
                price=Decimal("5000"),
                deadline=datetime.utcnow() + timedelta(days=15),
                session="2026/2027",
                status=FormStatus.open
            ),
            SchoolForm(
                institution_id=oau.id,
                form_type="Post-UTME",
                price=Decimal("2000"),
                deadline=datetime.utcnow() + timedelta(days=10),
                session="2026/2027",
                status=FormStatus.open
            )
        ]
        db.add_all(forms)
        db.commit()

    print("Success: Database seeded!")
    db.close()

if __name__ == "__main__":
    seed()
