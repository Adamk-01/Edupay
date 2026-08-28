import uuid
import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import Base, get_db
from app.dependencies  import get_current_admin

router = APIRouter(prefix="/news", tags=["Edu News"])


# ── Model ─────────────────────────────────────────────────────
class NewsPost(Base):
    __tablename__ = "news_posts"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title          = Column(String,  nullable=False)
    slug           = Column(String,  unique=True, nullable=False)
    excerpt        = Column(Text,    nullable=False)
    body           = Column(Text,    nullable=False)
    category       = Column(String,  nullable=False)
    tag_color      = Column(String,  default="#EBF2FF")
    tag_text_color = Column(String,  default="#1A56DB")
    cover_icon     = Column(String,  default="BookOpen")
    cover_bg       = Column(String,  default="#EBF2FF")
    author         = Column(String,  default="EduPay Editorial")
    read_time      = Column(String,  default="3 min read")
    is_published   = Column(Boolean, default=False)
    is_featured    = Column(Boolean, default=False)
    views          = Column(Integer, default=0)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Schemas ───────────────────────────────────────────────────
class CreatePostRequest(BaseModel):
    title:          str
    excerpt:        str
    body:           str = ""
    category:       str
    tag_color:      str = "#EBF2FF"
    tag_text_color: str = "#1A56DB"
    cover_icon:     str = "BookOpen"
    cover_bg:       str = "#EBF2FF"
    author:         str = "EduPay Editorial"
    read_time:      str = "3 min read"
    is_featured:    bool = False


# ── Helpers ───────────────────────────────────────────────────
def _make_slug(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def _post_to_dict(p: NewsPost, include_body: bool = False) -> dict:
    data = {
        "id":             str(p.id),
        "title":          p.title,
        "slug":           p.slug,
        "excerpt":        p.excerpt,
        "category":       p.category,
        "tag_color":      p.tag_color,
        "tag_text_color": p.tag_text_color,
        "cover_icon":     p.cover_icon,
        "cover_bg":       p.cover_bg,
        "author":         p.author,
        "read_time":      p.read_time,
        "is_published":   p.is_published,
        "is_featured":    p.is_featured,
        "views":          p.views,
        "created_at":     p.created_at.isoformat() if p.created_at else None,
    }
    if include_body:
        data["body"] = p.body
    return data


# ── Public routes ─────────────────────────────────────────────
@router.get("/")
async def list_posts(
    category: Optional[str]  = Query(None),
    featured: Optional[bool] = Query(None),
    search:   Optional[str]  = Query(None),
    page:     int = Query(1, ge=1),
    limit:    int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    query = db.query(NewsPost).filter(NewsPost.is_published == True)
    if category:             query = query.filter(NewsPost.category == category)
    if featured is not None: query = query.filter(NewsPost.is_featured == featured)
    if search:               query = query.filter(NewsPost.title.ilike(f"%{search}%"))

    total = query.count()
    posts = (
        query.order_by(NewsPost.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "posts": [_post_to_dict(p) for p in posts],
        "total": total,
        "page":  page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/categories")
async def get_categories():
    return {
        "categories": ["All","JAMB","WAEC","NECO","Admission","Scholarship","Study Tips","University Life"]
    }


@router.get("/{slug}")
async def get_post(slug: str, db: Session = Depends(get_db)):
    post = db.query(NewsPost).filter(
        NewsPost.slug == slug,
        NewsPost.is_published == True,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Article not found")
    post.views += 1
    db.commit()
    return _post_to_dict(post, include_body=True)


# ── Admin routes ──────────────────────────────────────────────
@router.post("/admin/create", dependencies=[Depends(get_current_admin)])
async def create_post(data: CreatePostRequest, db: Session = Depends(get_db)):
    post = NewsPost(
        **data.model_dump(),
        slug=_make_slug(data.title),
        is_published=False,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"message": "Post created", "id": str(post.id), "slug": post.slug}


@router.patch("/admin/{post_id}/publish", dependencies=[Depends(get_current_admin)])
async def publish_post(post_id: str, db: Session = Depends(get_db)):
    post = db.query(NewsPost).filter(NewsPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_published = True
    post.updated_at   = datetime.utcnow()
    db.commit()
    return {"message": "Published"}


@router.patch("/admin/{post_id}", dependencies=[Depends(get_current_admin)])
async def update_post(post_id: str, payload: dict, db: Session = Depends(get_db)):
    post = db.query(NewsPost).filter(NewsPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    for k, v in payload.items():
        if hasattr(post, k) and k not in ("id", "slug", "views"):
            setattr(post, k, v)
    post.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Updated"}


@router.delete("/admin/{post_id}", dependencies=[Depends(get_current_admin)])
async def delete_post(post_id: str, db: Session = Depends(get_db)):
    post = db.query(NewsPost).filter(NewsPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return {"message": "Deleted"}
