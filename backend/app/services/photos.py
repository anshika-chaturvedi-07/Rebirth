"""Safe image handling for uploads.

Every upload is decoded with Pillow and re-encoded as a fresh JPEG. This:
  * rejects anything that isn't really an image (whatever its file name or content type claims),
  * applies the camera's rotation, then drops ALL metadata — phone photos often carry GPS coordinates,
  * caps the size so pages stay fast.
"""

import hashlib
import io
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs


class PhotoError(ValueError):
    pass


def media_root() -> Path:
    root = Path(get_settings().media_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def process_upload(raw: bytes) -> tuple[bytes, int, int]:
    """Validate and re-encode an uploaded image. Returns (jpeg_bytes, width, height)."""
    s = get_settings()
    if len(raw) > s.max_upload_mb * 1024 * 1024:
        raise PhotoError(f"Photos can be up to {s.max_upload_mb} MB.")
    try:
        img = Image.open(io.BytesIO(raw))
        fmt = img.format
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise PhotoError("That file isn't a photo we can read. Use a JPEG, PNG or WebP image.") from e
    if fmt not in ALLOWED_FORMATS:
        raise PhotoError("Use a JPEG, PNG or WebP image.")

    img = ImageOps.exif_transpose(img)  # keep the photo upright before metadata is dropped
    if img.mode not in ("RGB", "L"):
        background = Image.new("RGB", img.size, (255, 247, 236))  # cream behind transparency
        background.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[-1])
        img = background
    img = img.convert("RGB")
    img.thumbnail((s.photo_max_px, s.photo_max_px), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85, optimize=True)  # no exif= argument: metadata is not copied
    return out.getvalue(), img.width, img.height


def _cloudinary() -> tuple[str, str, str] | None:
    """(cloud_name, api_key, api_secret) from CLOUDINARY_URL=cloudinary://key:secret@cloud, or None."""
    url = get_settings().cloudinary_url
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme != "cloudinary" or not (parsed.username and parsed.password and parsed.hostname):
        raise PhotoError("CLOUDINARY_URL should look like cloudinary://API_KEY:API_SECRET@CLOUD_NAME")
    return parsed.hostname, parsed.username, parsed.password


def _signature(params: dict[str, str], secret: str) -> str:
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1((to_sign + secret).encode()).hexdigest()


def save(jpeg: bytes) -> tuple[str, str | None]:
    """Store the re-encoded photo. Returns (filename or public id, external URL or None)."""
    name = uuid.uuid4().hex
    creds = _cloudinary()
    if creds is None:
        filename = f"{name}.jpg"
        (media_root() / filename).write_bytes(jpeg)
        return filename, None
    cloud, key, secret = creds
    params = {"public_id": f"rebirth/{name}", "timestamp": str(int(time.time()))}
    res = httpx.post(f"https://api.cloudinary.com/v1_1/{cloud}/image/upload", timeout=30,
                     data={**params, "api_key": key, "signature": _signature(params, secret)},
                     files={"file": (f"{name}.jpg", jpeg, "image/jpeg")})
    if res.status_code >= 400:
        raise PhotoError("We couldn't store the photo right now. Please try again.")
    return params["public_id"], res.json()["secure_url"]


def open_image(filename: str, external_url: str | None = None) -> Image.Image:
    if external_url:
        return Image.open(io.BytesIO(httpx.get(external_url, timeout=20).content)).convert("RGB")
    path = media_root() / Path(filename).name  # never follow a path out of the media folder
    return Image.open(path).convert("RGB")


def delete(filename: str, external_url: str | None = None) -> None:
    if external_url and (creds := _cloudinary()):
        cloud, key, secret = creds
        params = {"public_id": filename, "timestamp": str(int(time.time()))}
        httpx.post(f"https://api.cloudinary.com/v1_1/{cloud}/image/destroy", timeout=20,
                   data={**params, "api_key": key, "signature": _signature(params, secret)})
        return
    (media_root() / Path(filename).name).unlink(missing_ok=True)
