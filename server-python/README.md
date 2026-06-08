# RamReserve — Python (Flask) backend

A Python re-implementation of the API. It speaks the **same** JSON REST API as
the original Express server, on the same routes, backed by the same MongoDB —
so the React client runs against it unchanged.

## Stack

| Layer    | Tech                       |
|----------|----------------------------|
| Language | **Python 3.10+**           |
| Web      | **Flask** (+ Flask-CORS)   |
| Database | **MongoDB** (via PyMongo)  |
| Auth     | **PyJWT** + **bcrypt**     |

## Requirements

- Python 3.10+
- MongoDB running on `localhost:27017` (the project's `docker-compose.yml` works)

## Quick start

```bash
cd server-python

python3 -m venv .venv           # one-time: create a virtual environment
source .venv/bin/activate       # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
cp .env.example .env            # adjust MONGODB_URI / JWT_SECRET if needed

python seed.py                  # populate catalog + demo accounts
python app.py                   # http://localhost:5000
```

Then start the client as usual:

```bash
cd ../client
npm install
npm run dev                     # http://localhost:5173
```

> The client's Vite dev server proxies `/api` to `http://localhost:5000`, so no
> client changes are needed — it just talks to Flask instead of Express.

## Demo accounts (after seeding)

| Role  | Email               | Password |
|-------|---------------------|----------|
| Admin | admin@reserve.test  | admin123 |
| User  | user@reserve.test   | user123  |

## Files

| File             | Purpose                                                       |
|------------------|---------------------------------------------------------------|
| `app.py`         | The whole API: routes, auth (JWT/bcrypt), MongoDB access      |
| `seed.py`        | Clears + repopulates the catalog and demo accounts            |
| `catalog.py`     | The room/equipment catalog data (shared by the seed)          |
| `requirements.txt` | Python dependencies                                         |
| `.env`           | `MONGODB_URI`, `JWT_SECRET`, `PORT`, etc.                     |

## API overview

| Method | Route                              | Auth  | Description                         |
|--------|------------------------------------|-------|-------------------------------------|
| POST   | `/api/auth/register`               | -     | Register a user                     |
| POST   | `/api/auth/login`                  | -     | Login, returns JWT                  |
| GET    | `/api/auth/me`                     | user  | Current user                        |
| GET    | `/api/resources`                   | user  | List resources (`department`,`kind`)|
| GET    | `/api/resources/catalog`           | user  | Rooms-by-floor + equipment per dept |
| POST   | `/api/reservations`                | user  | Create a ticket                     |
| GET    | `/api/reservations/mine`           | user  | Current user's reservations         |
| DELETE | `/api/reservations/<id>`           | user  | Cancel/delete own reservation       |
| GET    | `/api/reservations/calendar`       | user  | Rooms + bookings for the calendar   |
| GET    | `/api/reservations`                | admin | All reservations (filter status)    |
| PATCH  | `/api/reservations/<id>/decision`  | admin | Approve/reject + remarks            |
| PATCH  | `/api/availability`                | admin | Open/close a room for a day         |
