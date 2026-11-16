"""Weekly supply and demand forecasting per category.

Series: kg listed per week (supply) and kg requested per week (demand), from the database.
Models (chosen per series by error on held-out weeks):
  * smoothed seasonal + trend: linear trend plus a 52-week profile averaged across years and smoothed over
    neighbouring weeks (robust for sparse, noisy weekly counts);
  * additive Holt-Winters (level + trend + 52-week seasonality), smoothing parameters by grid search;
  * damped trend without seasonality (the only option with less than two years of history).

Every forecast is backtested: hold out the last 8 weeks, refit, forecast, and compare the error (WAPE)
with a seasonal-naive baseline ("same week last year"). The UI shows both, so the model has to earn trust.
"""

import math
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from itertools import product

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.data.categories import CATEGORY_BY_SLUG
from app.models import Listing, Need

SEASON = 52
HISTORY_WEEKS = 156
HOLDOUT = 8
GRID = {"alpha": (0.1, 0.2, 0.35, 0.5), "beta": (0.0, 0.02, 0.05), "gamma": (0.05, 0.15, 0.3)}
SHORTAGE_RATIO = 1.2  # demand above supply by this much over the horizon -> shortage alert
SURPLUS_RATIO = 1.6


# ---------------------------------------------------------------- data
def week_start(d: datetime) -> datetime:
    d = d - timedelta(days=d.weekday())
    return datetime(d.year, d.month, d.day)


def weekly_series(db: Session, model, category: str, city: str, end: datetime, weeks: int = HISTORY_WEEKS) -> list[float]:
    """kg per week for the `weeks` complete weeks before the week containing `end`."""
    last = week_start(end)
    first = last - timedelta(weeks=weeks)
    kg_per_unit = CATEGORY_BY_SLUG[category].kg_per_unit
    rows = db.execute(
        select(model.created_at, model.quantity)
        .where(model.category == category, func.lower(model.city) == city.lower(),
               model.created_at >= first, model.created_at < last)
    ).all()
    series = [0.0] * weeks
    for created, qty in rows:
        idx = (week_start(created) - first).days // 7
        if 0 <= idx < weeks:
            series[idx] += qty * kg_per_unit
    return series


# ---------------------------------------------------------------- models
@dataclass
class Fit:
    params: dict[str, float]
    level: float
    trend: float
    seasonal: list[float]  # length SEASON, aligned so seasonal[(n + h - 1) % SEASON] is the season of step h
    resid_sd: float
    n: int
    seasonal_model: bool


def _holt_winters(y: list[float], alpha: float, beta: float, gamma: float) -> tuple[float, Fit | None]:
    if len(y) < 2 * SEASON:
        return math.inf, None
    level = sum(y[:SEASON]) / SEASON
    trend = (sum(y[SEASON : 2 * SEASON]) - sum(y[:SEASON])) / SEASON**2
    seasonal = [y[i] - level for i in range(SEASON)]
    sse, resid = 0.0, []
    for t in range(SEASON, len(y)):
        s = seasonal[t % SEASON]
        pred = level + trend + s
        err = y[t] - pred
        resid.append(err)
        sse += err * err
        new_level = alpha * (y[t] - s) + (1 - alpha) * (level + trend)
        trend = beta * (new_level - level) + (1 - beta) * trend
        seasonal[t % SEASON] = gamma * (y[t] - new_level) + (1 - gamma) * s
        level = new_level
    sd = math.sqrt(sum(e * e for e in resid) / max(1, len(resid) - 1))
    return sse, Fit({"alpha": alpha, "beta": beta, "gamma": gamma}, level, trend, seasonal, sd, len(y), True)


def _damped_trend(y: list[float], alpha: float, beta: float, phi: float = 0.9) -> tuple[float, Fit]:
    level, trend = y[0], (y[min(4, len(y) - 1)] - y[0]) / max(1, min(4, len(y) - 1))
    sse, resid = 0.0, []
    for t in range(1, len(y)):
        pred = level + phi * trend
        err = y[t] - pred
        resid.append(err)
        sse += err * err
        new_level = alpha * y[t] + (1 - alpha) * (level + phi * trend)
        trend = beta * (new_level - level) + (1 - beta) * phi * trend
        level = new_level
    sd = math.sqrt(sum(e * e for e in resid) / max(1, len(resid) - 1))
    return sse, Fit({"alpha": alpha, "beta": beta, "phi": phi}, level, trend, [0.0] * SEASON, sd, len(y), False)


def _smoothed_seasonal(y: list[float], window: int = 3) -> Fit:
    """Linear trend + a seasonal profile averaged across years and smoothed over ±`window` weeks.
    Sparse weekly counts are noisy; borrowing strength from neighbouring weeks gives a steadier seasonal shape."""
    n = len(y)
    t_mean = (n - 1) / 2
    sxx = max(1e-9, sum((t - t_mean) ** 2 for t in range(n)))
    smooth = [0.0] * SEASON
    # Alternate: fit the trend on the de-seasonalised series, then the season on the de-trended series.
    # (Fitting the trend on raw data first lets the seasonal wave tilt the slope.)
    for _ in range(4):
        adj = [v - smooth[t % SEASON] for t, v in enumerate(y)]
        a_mean = sum(adj) / n
        slope = sum((t - t_mean) * (v - a_mean) for t, v in enumerate(adj)) / sxx
        intercept = a_mean - slope * t_mean
        resid = [v - (intercept + slope * t) for t, v in enumerate(y)]
        raw = [0.0] * SEASON
        for w in range(SEASON):
            vals = resid[w::SEASON]
            raw[w] = sum(vals) / len(vals) if vals else 0.0
        smooth = [sum(raw[(w + k) % SEASON] for k in range(-window, window + 1)) / (2 * window + 1) for w in range(SEASON)]
        centre = sum(smooth) / SEASON  # the season averages to zero; the trend carries the level
        smooth = [v - centre for v in smooth]
    fitted_err = [v - (intercept + slope * t + smooth[t % SEASON]) for t, v in enumerate(y)]
    sd = math.sqrt(sum(e * e for e in fitted_err) / max(1, n - 1))
    # store as level/trend at the end of the series so forecast() works unchanged
    return Fit({"window": window}, intercept + slope * (n - 1), slope,
               [smooth[(i) % SEASON] for i in range(SEASON)], sd, n, True)


def _holt_winters_best(y: list[float]) -> Fit:
    return min((_holt_winters(y, a, b, g) for a, b, g in product(GRID["alpha"], GRID["beta"], GRID["gamma"])),
               key=lambda r: r[0])[1]  # type: ignore[return-value]


def _damped_best(y: list[float]) -> Fit:
    return min((_damped_trend(y, a, b) for a, b in product(GRID["alpha"], GRID["beta"])), key=lambda r: r[0])[1]


CANDIDATES = {
    "Smoothed seasonal + trend": _smoothed_seasonal,
    "Holt-Winters (52-week season)": _holt_winters_best,
    "Damped trend": _damped_best,
}


def select_model(y: list[float], holdout: int = HOLDOUT) -> str:
    """Pick the candidate with the lowest error on the held-out last weeks (needs two years for seasonal models)."""
    if len(y) < 2 * SEASON + holdout:
        return "Damped trend"
    train, test = y[:-holdout], y[-holdout:]
    scores = {}
    for name, build in CANDIDATES.items():
        if name != "Damped trend" and len(train) < 2 * SEASON:
            continue
        pred = [m for m, _, _ in forecast(build(train), holdout)]
        score = wape(test, pred)
        scores[name] = math.inf if score is None else score
    return min(scores, key=scores.get)


def fit(y: list[float], model: str | None = None) -> Fit:
    if model is None:
        model = "Smoothed seasonal + trend" if len(y) >= 2 * SEASON else "Damped trend"
    if model != "Damped trend" and len(y) < 2 * SEASON:
        model = "Damped trend"
    return CANDIDATES[model](y)


def forecast(f: Fit, horizon: int) -> list[tuple[float, float, float]]:
    """(mean, low, high) per step; 80% interval widening with the horizon. Never below zero."""
    out = []
    for h in range(1, horizon + 1):
        s = f.seasonal[(f.n + h - 1) % SEASON] if f.seasonal_model else 0.0
        trend = f.trend * h if f.seasonal_model else f.trend * sum(f.params.get("phi", 1) ** i for i in range(1, h + 1))
        mean = max(0.0, f.level + trend + s)
        half = 1.2816 * f.resid_sd * math.sqrt(1 + 0.15 * (h - 1))
        out.append((mean, max(0.0, mean - half), mean + half))
    return out


def seasonal_naive(y: list[float], horizon: int) -> list[float]:
    if len(y) >= SEASON:
        return [y[len(y) - SEASON + (h % SEASON)] for h in range(horizon)]
    return [y[-1]] * horizon


def wape(actual: list[float], predicted: list[float]) -> float | None:
    """Weighted absolute percentage error: sum|error| / sum(actual). Robust to weeks with zero."""
    total = sum(actual)
    if total <= 0:
        return None
    return sum(abs(a - p) for a, p in zip(actual, predicted)) / total


def backtest(y: list[float], holdout: int = HOLDOUT) -> dict:
    """Honest out-of-sample check: choose the model using only data before the last `holdout` weeks,
    forecast those weeks, and compare the error with the seasonal-naive baseline ("same week last year")."""
    train, test = y[:-holdout], y[-holdout:]
    chosen = select_model(train)
    model_pred = [m for m, _, _ in forecast(fit(train, chosen), holdout)]
    naive_pred = seasonal_naive(train, holdout)
    m, n = wape(test, model_pred), wape(test, naive_pred)
    return {"weeks": holdout, "model": chosen, "model_wape": None if m is None else round(m, 3),
            "naive_wape": None if n is None else round(n, 3)}


# ---------------------------------------------------------------- report
_cache: dict[tuple, tuple[float, dict]] = {}
CACHE_SECONDS = 600


def category_forecast(db: Session, category: str, city: str, now: datetime, horizon: int = 8, show_weeks: int = 26) -> dict:
    supply = weekly_series(db, Listing, category, city, now)
    demand = weekly_series(db, Need, category, city, now)
    first_future = week_start(now)
    hist_weeks = [first_future - timedelta(weeks=HISTORY_WEEKS - i) for i in range(HISTORY_WEEKS)]

    result: dict = {"category": category, "name": CATEGORY_BY_SLUG[category].name, "icon": CATEGORY_BY_SLUG[category].icon,
                    "unit": "kg", "history": [], "forecast": []}
    fits, models = {}, {}
    for key, series in (("supply", supply), ("demand", demand)):
        models[key] = select_model(series)
        fits[key] = (fit(series, models[key]), backtest(series))
    for i in range(HISTORY_WEEKS - show_weeks, HISTORY_WEEKS):
        result["history"].append({"week": hist_weeks[i].date().isoformat(), "supply": round(supply[i], 1), "demand": round(demand[i], 1)})
    fs, fd = forecast(fits["supply"][0], horizon), forecast(fits["demand"][0], horizon)
    for h in range(horizon):
        result["forecast"].append({
            "week": (first_future + timedelta(weeks=h)).date().isoformat(),
            "supply": round(fs[h][0], 1), "supply_low": round(fs[h][1], 1), "supply_high": round(fs[h][2], 1),
            "demand": round(fd[h][0], 1), "demand_low": round(fd[h][1], 1), "demand_high": round(fd[h][2], 1),
        })
    result["backtest"] = {"supply": fits["supply"][1], "demand": fits["demand"][1]}
    result["model"] = models

    tot_s = sum(p["supply"] for p in result["forecast"])
    tot_d = sum(p["demand"] for p in result["forecast"])
    gap_week = max(result["forecast"], key=lambda p: p["demand"] - p["supply"])
    alert = None
    if tot_d > tot_s * SHORTAGE_RATIO and tot_d - tot_s > 5:
        alert = {
            "kind": "shortage",
            "message": f"{CATEGORY_BY_SLUG[category].name}: demand is expected to outrun supply by about "
                       f"{round(tot_d - tot_s):,} kg over the next {horizon} weeks, peaking around the week of "
                       f"{datetime.fromisoformat(gap_week['week']).strftime('%d %b')}.",
            "gap_kg": round(tot_d - tot_s),
        }
    elif tot_s > tot_d * SURPLUS_RATIO and tot_s - tot_d > 5:
        alert = {
            "kind": "surplus",
            "message": f"{CATEGORY_BY_SLUG[category].name}: more is likely to be given than requested "
                       f"(about {round(tot_s - tot_d):,} kg extra over {horizon} weeks). Repairers and recyclers should expect more.",
            "gap_kg": round(tot_s - tot_d),
        }
    result["totals"] = {"supply": round(tot_s), "demand": round(tot_d)}
    result["alert"] = alert
    return result


def city_forecast(db: Session, city: str, now: datetime, categories: list[str], horizon: int = 8) -> dict:
    key = (city.lower(), week_start(now), tuple(categories), horizon)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    report = {"city": city, "horizon_weeks": horizon, "generated_at": now.isoformat() + "Z",
              "categories": [category_forecast(db, c, city, now, horizon) for c in categories]}
    report["alerts"] = [c["alert"] | {"category": c["category"], "icon": c["icon"]} for c in report["categories"] if c["alert"]]
    _cache[key] = (time.monotonic(), report)
    return report


def clear_cache() -> None:
    _cache.clear()
