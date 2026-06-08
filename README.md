# Room & Equipment Reservation System (RamReserve)

A web app for reserving technical equipment (ITRO) and rooms/facilities (BMO) for
events. It pairs a **React** frontend with a **Python (Flask)** API and a
**MongoDB** database.

## Features

- **Two departments**, each owning a distinct catalog of **rooms** and **equipment**:
  - **BMO** (Building Management Office): rooms across 9 floors (classrooms, labs, Gym,
    Kitchen, Basketball Court, Multipurpose Hall, …) plus equipment — Amplifiers, Cables,
    Microphones, Mixers, Speakers, Projectors.
  - **ITRO** (Information Technology Resource Office): studio & laboratory rooms (Video,
    Animation, Foley/Music Recording, Game, Physics, Chemistry, …) plus equipment —
    Cameras, Cables, Lights, Monitors.
- **Reservation tickets** — pick a department → room, optionally check equipment with a
  quantity per item, set a date/time window and a reason. A time-overlap **conflict check**
  stops a room from being double-booked.
- **User dashboard** — log in, see the steps, create a ticket, view **My Reservations**, and
  **cancel/delete** your own reservations (which frees the time slot immediately).
- **Availability calendar** — a live 4-week grid of reserved vs. available rooms
  (auto-refreshes every 30s). Days with many bookings show an expandable **"+N more"**
  control. Admins can click a day to open/close a room for bookings.
- **Admin dashboard** — review tickets and approve/reject with remarks. Tickets are
  **grouped by department** (collapsible, sticky headers), **filterable by department,
  floor, and room**, and each shows its **submission date/time**.
- **JWT auth** with `user` and `admin` roles; passwords hashed with **bcrypt**.

## Stack

| Layer    | Tech                                          |
|----------|-----------------------------------------------|
| Frontend | React 18 + Vite 5, React Router 6, Axios      |
| Backend  | Python 3 + Flask (Flask-CORS)                 |
| Database | MongoDB 7 (accessed with PyMongo)             |
| Auth     | PyJWT + bcrypt                                |

## Requirements (tools)

| Tool | Version | Notes |
|------|---------|-------|
| **Python** | 3.10+ | runs the Flask API and the seed script |
| **pip** + **venv** | bundled with Python | install backend dependencies into a virtual env |
| **Node.js** | 18+ (18.20 or 20 LTS) | builds & serves the React client (Vite 5 needs Node 18+) |
| **npm** | 9–10 (ships with Node) | installs client dependencies |
| **MongoDB** | 7 | via the included Docker setup, a local install, or MongoDB Atlas |
| **Docker + Compose** | recent | only if you run MongoDB through `docker-compose.yml` |
| A modern web browser | — | to view the app at `localhost:5173` |

**Ports used (must be free):** `27017` (MongoDB), `5000` (Flask API), `5173` (client dev server).

### Python dependencies (`server-python/requirements.txt`)

`Flask`, `flask-cors`, `pymongo`, `PyJWT`, `bcrypt`, `python-dotenv` — all installed by
`pip install -r requirements.txt`.

### Node dependencies (`client/package.json`)

`react`, `react-dom`, `react-router-dom`, `axios` (+ `vite`, `@vitejs/plugin-react`) — all
installed by `npm install`.

## Quick start

### 1. Start MongoDB

```bash
docker compose up -d
```

(Or use a local MongoDB / Atlas cluster and point `MONGODB_URI` at it — see below.)

### 2. Backend (Python / Flask)

```bash
cd server-python

python3 -m venv .venv               # create a virtual environment
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt     # install dependencies

cp .env.example .env                # then set MONGODB_URI / JWT_SECRET as needed

python seed.py                      # populate catalog + demo accounts
python app.py                       # http://localhost:5000
```

### 3. Frontend (React)

```bash
cd client
npm install
npm run dev                         # http://localhost:5173
```

The client's Vite dev server proxies `/api` to `http://localhost:5000`, so no client
configuration is needed.

## Configuration (`server-python/.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | port the Flask API listens on |
| `MONGODB_URI` | `mongodb://localhost:27017/reservations` | MongoDB connection string |
| `JWT_SECRET` | `change-me-to-a-long-random-string` | secret used to sign JWTs |
| `JWT_EXPIRES_IN_DAYS` | `7` | how long a login stays valid |
| `CLIENT_ORIGIN` | `http://localhost:5173` | allowed CORS origin |

## Demo accounts (after seeding)

| Role  | Email               | Password   |
|-------|---------------------|------------|
| Admin | admin@reserve.test  | admin123   |
| User  | user@reserve.test   | user123    |

## API overview

| Method | Route                              | Auth   | Description                       |
|--------|------------------------------------|--------|-----------------------------------|
| POST   | `/api/auth/register`               | -      | Register a user                   |
| POST   | `/api/auth/login`                  | -      | Login, returns JWT                |
| GET    | `/api/auth/me`                     | user   | Current user                      |
| GET    | `/api/resources`                   | user   | List resources (filter by `department`, `kind`) |
| GET    | `/api/resources/catalog`           | user   | Per department: rooms by floor + equipment list |
| POST   | `/api/reservations`                | user   | Create a ticket (room + optional equipment) |
| GET    | `/api/reservations/mine`           | user   | Current user's reservations       |
| DELETE | `/api/reservations/<id>`           | user   | Cancel/delete own reservation     |
| GET    | `/api/reservations/calendar`       | user   | Rooms + room bookings for the next N weeks (calendar) |
| GET    | `/api/reservations`                | admin  | All reservations (filter status / department) |
| PATCH  | `/api/reservations/<id>/decision`  | admin  | Approve/reject + remarks          |
| PATCH  | `/api/availability`                | admin  | Open/close a room for a given day |

## Project layout

```
reservation-system/
├── docker-compose.yml        # MongoDB 7
├── client/                   # React 18 + Vite frontend (port 5173)
│   └── src/
│       ├── pages/            # Login, Register, Home, Reserve, Calendar,
│       │                     #   MyReservations, AdminDashboard
│       ├── components/       # Navbar, Footer, ProtectedRoute, Spinner
│       └── context/          # AuthContext
└── server-python/            # Python / Flask API (port 5000)
    ├── app.py                # routes, auth (JWT/bcrypt), MongoDB access
    ├── seed.py               # populate catalog + demo accounts
    ├── catalog.py            # room/equipment catalog data
    ├── requirements.txt      # Python dependencies
    └── .env                  # configuration
```

> A legacy Node/Express version of the same API lives in `server/` (run with
> `npm install && npm run dev`). The Python backend in `server-python/` is the current one;
> both speak the identical API, so the React client works with either.
