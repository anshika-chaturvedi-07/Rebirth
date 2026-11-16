from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.models import Photo
from app.services import photos as photo_service
from app.vision.analyzer import VisionResult, analyze
from app.vision.engine import get_engine, ml_installed

router = APIRouter(prefix="/api", tags=["photos & vision"])


class PhotoOut(BaseModel):
    id: int
    url: str
    width: int
    height: int


class AnalyzeIn(BaseModel):
    photo_id: int


@router.post("/photos", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(db: DB, user: CurrentUser, file: UploadFile = File(...)) -> PhotoOut:
    limit = get_settings().max_upload_mb * 1024 * 1024
    raw = await file.read(limit + 1)
    try:
        jpeg, width, height = await run_in_threadpool(photo_service.process_upload, raw)
    except photo_service.PhotoError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    filename = await run_in_threadpool(photo_service.save, jpeg)
    photo = Photo(owner_id=user.id, filename=filename, width=width, height=height)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return PhotoOut(id=photo.id, url=photo.url, width=width, height=height)


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(photo_id: int, db: DB, user: CurrentUser) -> None:
    photo = db.get(Photo, photo_id)
    if photo is None or photo.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found.")
    photo_service.delete(photo.filename)
    db.delete(photo)
    db.commit()


@router.get("/vision/status")
def vision_status() -> dict:
    engine = get_engine()
    return {
        "available": engine is not None,
        "installed": ml_installed(),
        "model": engine.name if engine else None,
        "loaded": bool(engine and engine.loaded),
        "ready": bool(engine and getattr(engine, "ready", False)),  # warmed up: answers in about a second
    }


@router.post("/vision/analyze", response_model=VisionResult)
def analyze_photo(body: AnalyzeIn, db: DB, user: CurrentUser) -> VisionResult:
    """Zero-shot recognition of an uploaded photo. The first call loads the model (a few seconds)."""
    engine = get_engine()
    if engine is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Photo recognition isn't switched on for this server. You can still fill in the details yourself.")
    photo = db.get(Photo, body.photo_id)
    if photo is None or photo.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found.")
    return analyze(photo_service.open_image(photo.filename), engine)
