# Room & Equipment Reservation System

A MERN (MongoDB, Express, React, Node) application for reserving technical equipment
(ITRO) and rooms/facilities (BMO) for events.

## Features

- **Two departments**, each owning a distinct catalog of **rooms** and **equipment**:
  - **BMO** (Building Management Office): rooms across 9 floors (classrooms, labs, Gym,
    Kitchen, Basketball Court, Multipurpose Hall, …) plus equipment — Amplifiers, Cables,
    Microphones, Mixers, Speakers, Projectors.
  - **ITRO** (Information Technology Resource Office): studio & laboratory rooms (Video,
    Animation, Foley/Music Recording, Game, Physics, Chemistry, …) plus equipment —
    Cameras, Cables, Lights, Monitors.
- **Two kinds of ticket** (a ticket is one or the other):
  - **Room** — pick a department → floor → room. Single-select, with a time-overlap
    conflict check so a room can't be double-booked.
  - **Equipment** — check the items you need and enter a quantity per item. Quantities are
    requested amounts (no stock cap); the admin approves or rejects.
- **User dashboard**: login, a homepage explaining the reservation steps, and a form to
  create a reservation ticket (borrower, room or equipment, date/time, reason).
- **Availability calendar**: a live 4-week grid, visible to both users and admins, showing
  reserved vs. available **rooms** (auto-refreshes every 30s).
- **Admin dashboard**: view all pending tickets, approve/reject them, and add remarks.
- **JWT auth** with `user` and `admin` roles, bcrypt-hashed passwords.

## Stack

| Layer    | Tech                                  |
|----------|---------------------------------------|
| Frontend | React 18 + Vite, React Router, Axios  |
| Backend  | Node + Express, Mongoose              |
| Database | MongoDB (via Docker)                  |
| Auth     | JWT + bcryptjs                        |

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 18+ (18.20 or 20 LTS) | runs the API and builds the client; Vite 5 & Mongoose 8 need Node 18+ |
| **npm** | 9–10 (ships with Node) | installs dependencies |
| **MongoDB** | 7 | via the included Docker setup, a local install, or a MongoDB Atlas cluster |
| **Docker + Compose** | recent | only needed if you run MongoDB through `docker-compose.yml` |
| A modern web browser | — | to view the app at `localhost:5173` |

**Ports used (must be free):** `27017` (MongoDB), `5000` (API), `5173` (client dev server).

All Node dependencies are installed automatically by `npm install` (see Quick start). Before
running, configure `server/.env` from `server/.env.example` — set at least `MONGODB_URI` and a
strong `JWT_SECRET`. If you use a non-Docker database (local or Atlas), just point `MONGODB_URI`
at it and skip the Docker step.

## Quick start

### 1. Start MongoDB

```bash
docker compose up -d
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env      # adjust if needed
npm run seed              # populates catalog + demo accounts
npm run dev               # http://localhost:5000
```

### 3. Frontend

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

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
| POST   | `/api/reservations`                | user   | Create a ticket (`kind: 'room' \| 'equipment'`) |
| GET    | `/api/reservations/mine`           | user   | Current user's reservations       |
| GET    | `/api/reservations/calendar`       | user   | Rooms + room bookings for the next N weeks (calendar) |
| GET    | `/api/reservations`                | admin  | All reservations (filter status)  |
| PATCH  | `/api/reservations/:id/decision`   | admin  | Approve/reject + remarks          |
