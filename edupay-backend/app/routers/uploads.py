import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config   import settings
from app.core.database import get_db
from app.routers.consultation import Consultant
from app.dependencies         import get_current_admin

router = APIRouter(prefix="/uploads", tags=["File Uploads"])

UPLOAD_DIR     = Path("uploads/consultant_pdfs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_TYPES  = {"application/pdf"}
MAX_SIZE_BYTES = 10 * 1024 * 1024   # 10 MB


def _validate_pdf(file: UploadFile):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Only PDF files are accepted")


async def _save_locally(file: UploadFile, filename: str) -> str:
    dest = UPLOAD_DIR / filename
    with dest.open("wb") as buf:
        shutil.copyfileobj(file.file, buf)
    if dest.stat().st_size > MAX_SIZE_BYTES:
        dest.unlink()
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    return f"/api/v1/uploads/serve/{filename}"


async def _save_to_r2(file: UploadFile, filename: str) -> str:
    import boto3
    from botocore.client import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY,
        aws_secret_access_key=settings.R2_SECRET_KEY,
        config=Config(signature_version="s3v4"),
    )
    bucket  = settings.R2_BUCKET
    key     = f"consultant_pdfs/{filename}"
    content = await file.read()

    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=content,
        ContentType="application/pdf",
        ContentDisposition="inline",
    )
    return f"https://pub-{settings.R2_ACCOUNT_ID}.r2.dev/{key}"


@router.post("/consultant-pdf/{consultant_id}")
async def upload_consultant_pdf(
    consultant_id: str,
    file: UploadFile = File(...),
    db:   Session    = Depends(get_db),
    _=Depends(get_current_admin),
):
    _validate_pdf(file)

    consultant = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not consultant:
        raise HTTPException(status_code=404, detail="Consultant not found")

    ext      = Path(file.filename).suffix.lower()
    filename = f"{consultant_id}_{uuid.uuid4().hex[:8]}{ext}"

    if settings.is_production:
        pdf_url = await _save_to_r2(file, filename)
    else:
        # Remove old file if exists
        if consultant.pdf_url:
            old_file = UPLOAD_DIR / consultant.pdf_url.split("/")[-1]
            if old_file.exists():
                old_file.unlink()
        pdf_url = await _save_locally(file, filename)

    consultant.pdf_url      = pdf_url
    consultant.pdf_filename = file.filename
    db.commit()

    return {
        "message":  f"PDF uploaded for {consultant.full_name}",
        "pdf_url":  pdf_url,
        "filename": file.filename,
    }


@router.delete("/consultant-pdf/{consultant_id}")
async def delete_consultant_pdf(
    consultant_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    consultant = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not consultant:
        raise HTTPException(status_code=404, detail="Consultant not found")
    if not consultant.pdf_url:
        raise HTTPException(status_code=404, detail="No PDF uploaded for this consultant")

    if not settings.is_production:
        filename = consultant.pdf_url.split("/")[-1]
        path     = UPLOAD_DIR / filename
        if path.exists():
            path.unlink()

    consultant.pdf_url      = None
    consultant.pdf_filename = None
    db.commit()
    return {"message": "PDF removed"}


@router.get("/serve/{filename}")
async def serve_local_file(filename: str):
    """Serve uploaded files locally — development only."""
    if settings.is_production:
        raise HTTPException(status_code=404, detail="Not available in production")
    path = UPLOAD_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="application/pdf")
