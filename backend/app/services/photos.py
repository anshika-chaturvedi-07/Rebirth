"""Safe image handling for uploads.

Every upload is decoded with Pillow and re-encoded as a fresh JPEG. This:
  * rejects anything that isn't really an image (whatever its file name or content type claims),
  * applies the camera's rotation, then drops ALL metadata — phone photos often carry GPS coordinates,
  * caps the size so pages stay fast.
"""

import io
import uuid
from pathlib import Path

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


def save(jpeg: bytes) -> str:
    filename = f"{uuid.uuid4().hex}.jpg"
    (media_root() / filename).write_bytes(jpeg)
    return filename


def open_image(filename: str) -> Image.Image:
    path = media_root() / Path(filename).name  # never follow a path out of the media folder
    return Image.open(path).convert("RGB")


def delete(filename: str) -> None:
    (media_root() / Path(filename).name).unlink(missing_ok=True)
