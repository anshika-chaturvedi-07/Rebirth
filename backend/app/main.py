import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analytics, auth, community, deliveries, listings, matches, meta, needs, payments, photos, trust
from app.services.photos import media_root
from app.vision.analyzer import warm_up
from app.vision.engine import get_engine
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.vision_preload and (engine := get_engine()):
        # Load the model and cache all label embeddings in the background so startup isn't blocked.
        threading.Thread(target=warm_up, args=(engine,), name="vision-warmup", daemon=True).start()
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    version="0.7.0",
    description="REBIRTH — a world where everything gets a second chance.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router)
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(needs.router)
app.include_router(photos.router)
app.include_router(matches.router)
app.include_router(deliveries.router)
app.include_router(analytics.router)
app.include_router(payments.router)
app.include_router(trust.router)
app.include_router(community.router)

# Uploaded photos (already re-encoded and stripped of metadata). Use a CDN/object storage in production.
app.mount("/media", StaticFiles(directory=media_root()), name="media")
