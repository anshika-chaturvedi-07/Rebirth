"""Turn CLIP scores into listing suggestions: category, subcategory, title, condition and safety warnings."""

import time
from collections import defaultdict

from PIL import Image
from pydantic import BaseModel

from app.data.categories import CATEGORY_BY_SLUG
from app.vision.engine import Engine
from app.vision.labels import (
    CONDITION_TEMPLATES,
    FOOD_FRESHNESS,
    ITEM_LABELS,
    NOT_AN_ITEM,
    RESTRICTED,
)

CONFIDENT = 0.45   # top category probability above which we pre-fill the form
NOT_ITEM_MIN = 0.5  # combined "not an item" probability that makes us say so
RESTRICTED_MIN = 0.35


class CategoryGuess(BaseModel):
    category: str
    name: str
    icon: str
    confidence: float


class VisionResult(BaseModel):
    is_item: bool
    confident: bool
    category: str | None
    subcategory: str | None
    title: str | None
    condition: str | None
    condition_confidence: float | None
    alternatives: list[CategoryGuess]
    matched_label: str | None
    warnings: list[str]
    blocked: bool  # a restricted item: the listing form should not proceed
    model: str
    seconds: float


def _guess(slug: str, p: float) -> CategoryGuess:
    c = CATEGORY_BY_SLUG[slug]
    return CategoryGuess(category=slug, name=c.name, icon=c.icon, confidence=round(p, 3))


def warm_up(engine: Engine) -> None:
    """Run one throwaway analysis so model weights and every label's text embedding are cached.
    Without this the first real photo pays for encoding ~80 prompts (tens of seconds on a laptop CPU)."""
    blank = Image.new("RGB", (224, 224), (240, 240, 240))
    analyze(blank, engine)
    for template in CONDITION_TEMPLATES.values():  # condition prompts for every noun
        engine.zero_shot(blank, [template.format(noun=l.noun.lower()) for l in ITEM_LABELS])
    engine.ready = True


def analyze(image: Image.Image, engine: Engine) -> VisionResult:
    started = time.perf_counter()
    item_prompts = [f"a photo of {l.prompt}" for l in ITEM_LABELS]
    other_prompts = [f"a photo of {p}" for p in NOT_AN_ITEM] + [f"a photo of {p}" for p in RESTRICTED]
    probs = engine.zero_shot(image, item_prompts + other_prompts)

    item_probs = probs[: len(ITEM_LABELS)]
    not_item_p = sum(probs[len(ITEM_LABELS) : len(ITEM_LABELS) + len(NOT_AN_ITEM)])
    restricted_probs = dict(zip(RESTRICTED, probs[len(ITEM_LABELS) + len(NOT_AN_ITEM) :]))

    warnings: list[str] = []
    top_restricted, top_restricted_p = max(restricted_probs.items(), key=lambda kv: kv[1])
    if top_restricted_p >= RESTRICTED_MIN:
        warnings.append(RESTRICTED[top_restricted])
        return VisionResult(
            is_item=True, confident=False, category=None, subcategory=None, title=None, condition=None,
            condition_confidence=None, alternatives=[], matched_label=top_restricted, warnings=warnings,
            blocked=True, model=engine.name, seconds=round(time.perf_counter() - started, 2),
        )

    if not_item_p >= NOT_ITEM_MIN:
        warnings.append("We couldn't spot an item in this photo. Try a clear photo of just the thing you're giving.")
        return VisionResult(
            is_item=False, confident=False, category=None, subcategory=None, title=None, condition=None,
            condition_confidence=None, alternatives=[], matched_label=None, warnings=warnings,
            blocked=False, model=engine.name, seconds=round(time.perf_counter() - started, 2),
        )

    # Renormalise over item labels and add up per category.
    total = sum(item_probs) or 1.0
    by_category: dict[str, float] = defaultdict(float)
    for label, p in zip(ITEM_LABELS, item_probs):
        by_category[label.category] += p / total
    ranked = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)
    top_cat, top_p = ranked[0]

    # Best label inside the winning category gives the subcategory and title.
    best_label = max(
        (pair for pair in zip(ITEM_LABELS, item_probs) if pair[0].category == top_cat), key=lambda pair: pair[1]
    )[0]

    condition, condition_p = None, None
    if CATEGORY_BY_SLUG[top_cat].perishable:
        fresh, spoiled = engine.zero_shot(image, list(FOOD_FRESHNESS.values()))
        if spoiled > 0.6:
            warnings.append("This food may not be fresh. Only share food that is safe to eat today.")
        condition, condition_p = "good", round(fresh, 3)
    else:
        noun = best_label.noun.lower()
        cond_probs = engine.zero_shot(image, [t.format(noun=noun) for t in CONDITION_TEMPLATES.values()])
        idx = max(range(len(cond_probs)), key=cond_probs.__getitem__)
        condition, condition_p = list(CONDITION_TEMPLATES)[idx], round(cond_probs[idx], 3)

    return VisionResult(
        is_item=True,
        confident=top_p >= CONFIDENT,
        category=top_cat,
        subcategory=best_label.subcategory,
        title=best_label.noun,
        condition=condition,
        condition_confidence=condition_p,
        alternatives=[_guess(slug, p) for slug, p in ranked[:3]],
        matched_label=best_label.prompt,
        warnings=warnings,
        blocked=False,
        model=engine.name,
        seconds=round(time.perf_counter() - started, 2),
    )
