# REBIRTH 🌍

**A world where everything gets a second chance.**

REBIRTH connects unused resources (surplus food, leftover building materials, old electronics, furniture, clothes and more) with the schools, NGOs, shelters and people who can use them. AI identifies items from photos, recommends matches, plans volunteer routes, forecasts supply and demand, and measures the environmental impact of every handover.

> Personal project · designed for India (₹, English + Hindi), with region settings kept in configuration.

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
| AI / data science | PyTorch + CLIP (vision), LightGBM (matching), Prophet (forecasting), OR-Tools (routing) |
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

**Frontend** (http://localhost:3000, or another port with `npm run dev -- -p 3001`)

```bash
cd frontend
npm install
npm run dev
```

**Backend** (http://localhost:8000/docs)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # create the database (SQLite by default, Postgres via DATABASE_URL)
python -m app.seed            # demo data for Bengaluru (add --reset to start over)
uvicorn app.main:app --reload
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
- [ ] **Phase 4:** AI photo identification and condition assessment
- [ ] **Phase 5:** matching engine and volunteer route optimisation
- [ ] **Phase 6:** forecasting and circular-economy analytics
- [ ] **Phase 7:** marketplace and payments, impact reports, gamification, trust and safety
- [ ] **Phase 8:** deployment and CI

## Note on data

All figures, listings and people shown in the prototype are sample data. Impact factors are indicative averages and will be replaced with sourced lifecycle data.
