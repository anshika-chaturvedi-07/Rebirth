# REBIRTH 🌍

**A world where everything gets a second chance.**

A restaurant has surplus food. A builder has leftover bricks. A family has an old laptop. A school needs chairs. REBIRTH connects things people no longer need with the schools, NGOs, shelters and neighbours who can use them, so that useful things don't end up in a landfill.

Every item gets three chances: **free** for people in need first, then a **low-price marketplace**, then **repair or recycling**.

**Working today**

- 📸 **Snap a photo and AI fills in the listing.** A CLIP model recognises the item, suggests category, title and condition, and blocks restricted items. It runs on REBIRTH's own server.
- 🗺️ **Map and near-me search.** Pins for items and needs within 2 to 25 km. Donors' locations are rounded to about 100 m until a request is accepted.
- 🔄 **The three-chance lifecycle.** Time-based stages by category (food 2 hours, furniture 5 days, electronics 7 days); requests, accept, and handover confirmation.
- 👥 **Six roles.** Donors, NGOs and schools, individuals, volunteers, businesses and recyclers, each with its own permissions.
- 🙋 **Needs board.** Organisations post what they're missing; urgent needs are shown first.
- ✨ **Smart matching.** Every item–need pair is scored on distance, fit, urgency, quantity, cost, time pressure and trust, with plain-language reasons ("1.2 km apart · Urgent need · Covers the whole need").
- 🚚 **Volunteer route planning.** Google OR-Tools plans one route over several pickups and drop-offs, and food always goes straight to its drop-off.
- 🌱 **Impact dashboard.** CO₂e avoided, kilograms reused, meals, water, where items found a home, and neighbourhood circularity scores.
- 🔮 **Supply and demand forecasts.** Weekly forecasts per category with shortage/surplus alerts and an honest, out-of-sample accuracy check.
- 💳 **Marketplace payments.** UPI checkout with server-side signature verification, a 5% platform fee and automatic refunds (simulated by default; Razorpay test mode with your own keys).
- 🛡️ **Trust and safety.** NGO Darpan / UDISE verification reviewed by admins, user reports, explainable risk signals, ratings and reviews.
- 🏆 **Community.** Badges with progress, a privacy-aware leaderboard, public profiles and downloadable PDF impact reports for CSR teams.
- 🎨 **A colourful "clay world" design** with an original cast of animated cartoon characters drawn in code.

**Coming next:** a live deployment with automated tests on every push (see the [roadmap](#roadmap)).

> Personal project · built for India (₹, English + Hindi). Region settings are configuration, not code.

## How an item moves

1. **Free for those in need.** Verified NGOs, schools and individuals get a priority window (food: 2 hours, furniture: 5 days, electronics: 7 days).
2. **Low-price marketplace.** Unclaimed items are sold cheaply at an AI-suggested price (Razorpay / UPI).
3. **Repair or recycle.** Repair cafés, artisans and authorised recyclers take the rest.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Framer Motion |
| Auth | FastAPI-issued JWT in an httpOnly cookie, bcrypt password hashing, role-based permissions |
| Backend | FastAPI (Python), Pydantic, SQLAlchemy 2.0, Alembic |
| Data | PostgreSQL (SQLite for local dev), Redis |
| Maps | MapLibre GL with free OpenFreeMap vector tiles, repainted in the REBIRTH palette |
| AI / data science | PyTorch + OpenCLIP zero-shot vision, explainable matching, Google OR-Tools routing, Holt-Winters / seasonal forecasting with backtests |
| Charts | Recharts, palettes checked with a colour-blindness / contrast validator |
| Infra | Docker, GitHub Actions, Vercel + Render + Supabase |

## Project structure

```
rebirth/
├── frontend/              Next.js app
│   └── src/
│       ├── app/           pages: / (landing), /login, /signup
│       ├── components/
│       │   ├── characters/  clay-style SVG cast (Aarav, Meera, Kabir, Dadi, Ravi, Ms. Fatima, Chhotu)
│       │   ├── landing/     landing page sections
│       │   ├── auth/        sign-in / sign-up building blocks
│       │   ├── layout/      navbar, footer
│       │   └── ui/          buttons, logo, clouds
│       └── lib/           categories, confetti
├── backend/               FastAPI service
│   ├── app/
│   │   ├── core/config.py   region & app settings (env-driven)
│   │   ├── data/categories.py  resource taxonomy + lifecycle rules
│   │   └── main.py          API routes
│   └── tests/
├── design/                original design preview
└── docker-compose.yml     Postgres/PostGIS, Redis, API
```

## Run it locally

REBIRTH uses its own fixed ports so it can run next to other local projects:

| Service | URL / port |
|---|---|
| Website | http://localhost:3300 |
| API + docs | http://localhost:8300/docs |
| Postgres (docker compose) | localhost:5442 |
| Redis (docker compose) | localhost:6390 |

**Frontend** → http://localhost:3300

```bash
cd frontend
npm install
npm run dev
```

**Backend** → http://localhost:8300/docs

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-ml.txt --extra-index-url https://download.pytorch.org/whl/cpu   # optional: AI photo recognition
alembic upgrade head          # create the database (SQLite by default, Postgres via DATABASE_URL)
python -m app.seed            # demo data for Bengaluru (add --reset to start over)
uvicorn app.main:app --reload --port 8300
```

The frontend forwards `/api/*` to the backend (see `frontend/next.config.ts`), so sessions use a same-origin, httpOnly cookie.

**Demo accounts** (local seed data only, password `rebirth-demo` for all):

| Email | Role |
|---|---|
| `meera@rebirth.test` | Donor (restaurant) |
| `csr@brightlabs.rebirth.test` | Business (CSR donor) |
| `fatima@rebirth.test` | Verified school |
| `hope@rebirth.test` | Verified shelter |
| `aarav@rebirth.test` | Individual (student) |
| `ravi@rebirth.test` | Volunteer |
| `kabir@rebirth.test` | Repairer / recycler |
| `asha@rebirth.test` | NGO waiting for verification |
| `admin@rebirth.test` | Admin: trust & safety console at `/admin` |

**Tests**

```bash
cd backend && pytest
```

## Accounts, roles and the item lifecycle

| Role | Can list items | Claims in **free** stage | Claims in **marketplace** | Claims in **recycle** | Posts needs |
|---|---|---|---|---|---|
| Donor / business | ✓ | | ✓ | | |
| NGO / school | ✓ | ✓ | ✓ | | ✓ |
| Individual | ✓ | ✓ (max 3 open) | ✓ | | ✓ |
| Repairer / recycler | ✓ | | ✓ | ✓ | |
| Volunteer | | | ✓ | | |

A listing's stage comes from two timestamps set when it is created (`priority_until`, `marketplace_until`), using each category's rules. That means stages change on time without a background job and can be filtered in SQL. Food needs a best-before time and is marked expired after it. Donors accept one request, which reserves the item, then confirm the handover.

## Maps and location

- **`/map`**: items (round pins, coloured by stage) and needs (square pins, coloured by urgency) inside a 2 / 5 / 10 / 25 km circle, with a nearest-first list. You can also move the map and search that area.
- **Near-me browsing** on `/listings`, with distances on every card.
- **Location picker** on the listing and need forms: locality autocomplete, "use my location", and a draggable pin.
- **Search on any database:** a bounding-box filter runs in SQL on indexed `lat`/`lng` columns, then exact great-circle (haversine) distances are computed in Python. It can be swapped for PostGIS `ST_DWithin` without changing the API.
- **Built-in places list** of Indian cities and Bengaluru localities, with aliases such as "Bangalore". No addresses are sent to a third-party geocoder.
- **Privacy:** other users see a donor's location rounded to about 100 m. Only the donor and a requester whose request was accepted see the exact spot. Organisations' needs are shown exactly; individuals' needs are rounded.

## Payments, trust and community

**Payments** (`backend/app/services/payments.py`). Once a donor accepts a marketplace request, the buyer pays before the handover (and before a volunteer may collect it). REBIRTH keeps 5% and the rest goes to the donor; cancelling after paying refunds automatically. Two providers:
- **Simulated UPI checkout** (default, no keys needed), clearly labelled as a test.
- **Razorpay test mode**: put *your own* `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (`rzp_test_…`; live keys are refused) in `backend/.env`. Orders go through Razorpay's Orders API and the browser opens Razorpay Checkout.

Either way the server only marks a payment paid after verifying an HMAC-SHA256 signature over `order_id|payment_id`, and no card, UPI or bank details touch REBIRTH's servers.

**Verification.** Organisations submit an NGO Darpan ID (`KA/2017/0123456`) or school UDISE+ code (11 digits). The format is validated, duplicates of an already-verified ID are refused, and an admin approves or rejects with a note in `/admin`.

**Reports and risk signals** (`backend/app/services/trust.py`). Anyone can report a listing, need or member. The admin console also lists explainable patterns from the last 30 days: possible resale of free items, many free requests by one individual, frequent cancellations, new accounts making large requests, repeated reports. Signals never block anyone automatically.

**Reviews, badges and leaderboard.** After a completed handover each side can rate the other once. Badges (first gift, food hero, climate champion, steady giver, road warrior, trusted, verified) show progress. The leaderboard ranks givers, volunteers and neighbourhoods. People appear as first name + initial, and people who *receive* help are never ranked. Public profiles show no email or phone.

**Impact reports.** `/api/impact/me/report.pdf` builds a PDF (ReportLab) with totals, category and monthly tables, and the full method and factors, including a clear note that the factors are indicative and not an audited LCA.

## Impact, forecasts and hotspots

**Impact** (`backend/app/services/impact.py`, page `/impact`). Counted per completed handover:

| Metric | How |
|---|---|
| Kilograms reused | quantity × the category's kg per unit |
| CO₂e avoided | kg × an indicative per-category factor (e.g. clothing 15, electronics 40, food 2.5 kg CO₂e/kg) |
| Water saved | kg × an indicative embodied-water factor |
| Meals | food kg ÷ 0.42 kg per meal |
| Equivalents | CO₂e ÷ 0.17 kg per car-km; ÷ 21 kg per tree-year |
| Rehome rate | handed over ÷ (handed over + withdrawn) |
| Circularity (0–100) | 70% rehome rate + 30% share that went free to people in need, per neighbourhood |

**Forecasts** (`backend/app/services/forecasting.py`, page `/insights`). Weekly kilograms given (supply) and requested (demand) per category. Three candidate models, chosen per series by error on held-out weeks:
- a linear trend plus a 52-week seasonal profile smoothed over neighbouring weeks (robust for sparse counts; trend and season are estimated alternately so neither biases the other);
- additive Holt-Winters with grid-searched smoothing;
- a damped trend (used when there's less than two years of history).

**Accuracy is reported honestly.** The last 8 weeks are hidden, a model is chosen using only earlier weeks, and its error (WAPE) is compared with "same week last year". On the demo data the model wins in 10 of 12 series; the page shows where it loses. Alerts fire when forecast demand exceeds supply by 20% (shortage) or supply exceeds demand by 60% (surplus) over the next 8 weeks.

**Hotspots** (map layer). Listings or needs from the last 6 months are grouped into ~1 km squares. Squares with fewer than 3 records are hidden so no single household can be picked out.

**Demo data.** `python -m app.seed` adds three years of **simulated** Bengaluru activity with plausible seasons: winter clothing demand Nov–Jan, textbook supply after exams (Mar–Apr) and demand when schools reopen (May–Jun), food surplus around Diwali, and construction slowing in the monsoon. Use `--no-history` to skip it. The UI labels these figures as demo data.

**Charts** follow a data-viz checklist: one axis per chart, thin marks, a legend for two or more series, a chart/table switch on every chart, and colours run through a palette validator (colour-blind separation and contrast). The app's pastel tints failed as data colours, so the charts use deeper steps of the same hues.

## Matching and volunteer routes

**Matching** (`backend/app/services/matching.py`). Hard rules come first: same category, item still free or in the marketplace, need still open, and nobody is matched with themselves. Then a weighted score:

| Factor | Weight | Signal |
|---|---|---|
| Distance | 0.25 | `exp(−km / 5)` between item and need |
| Relevance | 0.20 | Shared words in titles (with light stemming); upgraded with CLIP text-embedding similarity when the AI model is warm |
| Urgency | 0.15 | The need's urgency (1–3) |
| Coverage | 0.15 | Share of the requested quantity this item covers |
| Cost | 0.10 | Free items beat marketplace items for people in need |
| Time pressure | 0.10 | Items leaving the free window or expiring soon go first |
| Trust | 0.05 | Verified organisation |

Every factor also produces a reason that's shown to users, and hovering a score shows the breakdown. The weights are hand-set; the factors are logged features, so a learned ranker can replace them once there's real accept/decline data.

**Deliveries.** An NGO can link a request to one of its needs and ask for a volunteer. When the donor accepts, a delivery task is created: pickup at the donor's exact spot, drop-off at the need's location. Volunteers see open tasks with rounded locations and get exact addresses only after taking them.

**Route optimisation** (`backend/app/services/routing.py`). This is a pickup-and-delivery problem: an open route from the volunteer's position, every pickup before its drop-off, and **perishable food dropped off right after it's picked up**. Three solvers:
- **Exact search** for up to 4 deliveries (the true optimum).
- **Google OR-Tools** with pickup–delivery constraints and guided local search.
- A **cheapest-insertion + local-search heuristic** as a fallback.

The API returns the shortest valid result. Tests compare the solvers with brute-force optimal routes. Distances are straight-line × 1.35 for city roads at about 18 km/h; a road-routing engine (OSRM) can replace this later.

## AI photo recognition

Snap a photo when listing an item and REBIRTH suggests the **category, type, title and condition**.

- **Model:** OpenCLIP ViT-B/32, used *zero-shot*. The photo is compared with about 70 written descriptions ("a photo of a laptop computer", "a stack of red bricks", …) mapped to REBIRTH's 14 categories. No custom training data is needed, and new item types are one line in `backend/app/vision/labels.py`.
- **Condition:** a second pass compares the photo with "brand new", "well-kept", "worn" and "broken" descriptions of the recognised item. The donor can always change it.
- **Safety checks:** photos that aren't an item (selfies, screenshots, landscapes) are flagged; restricted items (medicines, alcohol, weapons, tobacco) block the listing; food that looks spoiled shows a warning.
- **Privacy:** every upload is re-encoded, so EXIF metadata, including the **GPS location phones embed**, is removed. The model runs on REBIRTH's own server, so photos aren't sent to third-party AI services.
- **Speed (laptop CPU):** the model and all label embeddings are warmed up in a background thread at startup. After that, an analysis takes about 0.5 to 1 s.
- **Optional dependency:** without `requirements-ml.txt` the API still runs. `/api/vision/status` reports AI as unavailable and donors fill in the form themselves.
- **Tests:** a keyword-based fake engine tests the mapping and safety logic in milliseconds; one optional test runs the real model.

## Design system: "clay world"

Pastel-bright palette on warm cream (no dark backgrounds), puffy clay cards, Baloo 2 + Nunito type (Baloo 2 also covers Hindi), and an original cast of cartoon characters drawn in SVG that blink, wave and peek over the UI.

| Token | Hex | Used for |
|---|---|---|
| Lime | `#C2EF6B` | Free stage, success, eco |
| Coral | `#FF8C73` | Primary actions, food |
| Sky | `#74CCEC` | Marketplace, electronics |
| Lavender | `#B39DF5` | Navigation, dashboards |
| Butter | `#FFD66B` | Highlights, rewards |
| Blush | `#FFB8CB` | Community |
| Plum | `#3D2C5A` | Text |

## Roadmap

- [x] **Phase 1:** design system, character cast, landing page, sign-in / sign-up UI, API skeleton
- [x] **Phase 2:** accounts and roles (JWT cookie sessions), listings, requests and needs, database + migrations
- [x] **Phase 3:** interactive map, near-me search, locality autocomplete, location privacy
- [x] **Phase 4:** photo uploads and AI photo identification (category, title, condition, safety checks)
- [x] **Phase 5:** explainable matching, need-linked requests, volunteer deliveries and route optimisation
- [x] **Phase 6:** impact and circularity analytics, supply and demand forecasting with backtests, hotspot heatmaps
- [x] **Phase 7:** UPI payments (simulated / Razorpay test mode), verification and admin console, reports and risk signals, reviews, badges, leaderboard, PDF impact reports
- [ ] **Phase 8:** deployment and CI

## Note on data

All figures, listings and people shown in the prototype are sample data. Impact factors are indicative averages and will be replaced with sourced lifecycle data.
