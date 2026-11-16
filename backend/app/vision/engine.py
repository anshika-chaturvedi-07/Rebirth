"""CLIP zero-shot engine (OpenCLIP, CPU).

The heavy imports live inside this module so the API runs without the ML stack installed;
`get_engine()` returns None in that case and the endpoint reports vision as unavailable.
"""

import logging
import threading
import time
from typing import Protocol

from PIL import Image

from app.core.config import get_settings

log = logging.getLogger("rebirth.vision")


class Engine(Protocol):
    name: str

    def zero_shot(self, image: Image.Image, prompts: list[str]) -> list[float]:
        """Probability for each prompt (softmax over the given list)."""
        ...


class ClipEngine:
    def __init__(self, model: str, pretrained: str):
        self.name = f"OpenCLIP {model} ({pretrained})"
        self._model_name, self._pretrained = model, pretrained
        self._lock = threading.Lock()
        self._loaded = False
        self.ready = False  # model loaded AND label embeddings cached (set by warm_up)
        self._text_cache: dict[str, "object"] = {}

    @property
    def loaded(self) -> bool:
        return self._loaded

    def load(self) -> None:
        with self._lock:
            if self._loaded:
                return
            import open_clip  # noqa: PLC0415  (optional dependency)
            import torch  # noqa: PLC0415

            started = time.perf_counter()
            torch.set_grad_enabled(False)
            self._torch = torch
            self._model, _, self._preprocess = open_clip.create_model_and_transforms(
                self._model_name, pretrained=self._pretrained
            )
            self._model.eval()
            self._tokenizer = open_clip.get_tokenizer(self._model_name)
            self._loaded = True
            log.info("Loaded %s in %.1fs", self.name, time.perf_counter() - started)

    def _text_features(self, prompts: list[str]):
        torch = self._torch
        missing = [p for p in prompts if p not in self._text_cache]
        if missing:
            tokens = self._tokenizer(missing)
            feats = self._model.encode_text(tokens)
            feats = feats / feats.norm(dim=-1, keepdim=True)
            for p, f in zip(missing, feats):
                self._text_cache[p] = f
        return torch.stack([self._text_cache[p] for p in prompts])

    def zero_shot(self, image: Image.Image, prompts: list[str]) -> list[float]:
        self.load()
        torch = self._torch
        with self._lock:  # the model isn't re-entrant; requests are short
            img = self._preprocess(image).unsqueeze(0)
            img_feat = self._model.encode_image(img)
            img_feat = img_feat / img_feat.norm(dim=-1, keepdim=True)
            text_feat = self._text_features(prompts)
            logits = self._model.logit_scale.exp() * img_feat @ text_feat.T
            return torch.softmax(logits, dim=-1)[0].tolist()


_engine: ClipEngine | None = None
_engine_checked = False


def ml_installed() -> bool:
    try:
        import open_clip  # noqa: F401, PLC0415
        import torch  # noqa: F401, PLC0415
    except ImportError:
        return False
    return True


def get_engine() -> ClipEngine | None:
    global _engine, _engine_checked
    if not _engine_checked:
        _engine_checked = True
        s = get_settings()
        if s.vision_enabled and ml_installed():
            _engine = ClipEngine(s.vision_model, s.vision_pretrained)
    return _engine
