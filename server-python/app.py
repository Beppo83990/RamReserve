"""
RamReserve API — Python / Flask backend.

A drop-in replacement for the original Express server. It speaks the exact same
JSON REST API on the same routes, backed by the same MongoDB database, so the
React client runs against it unchanged.

Run with:  python app.py   (serves on http://localhost:5000)

Routes (all under /api):
  POST   /auth/register              Register a user -> { token, user }
  POST   /auth/login                 Login -> { token, user }
  GET    /auth/me                    Current user (auth)
  GET    /resources                  List resources (auth; ?department=&kind=)
  GET    /resources/catalog          Rooms-by-floor + equipment per department (auth)
  POST   /reservations               Create a ticket (auth)
  GET    /reservations/mine          Current user's reservations (auth)
  DELETE /reservations/<id>          Cancel/delete own reservation (auth)
  GET    /reservations/calendar      Rooms + bookings for the calendar (auth)
  GET    /reservations               All reservations (admin; ?status=&department=)
  PATCH  /reservations/<id>/decision Approve/reject + remarks (admin)
  PATCH  /availability               Open/close a room for a day (admin)
"""
import os
import re
from datetime import datetime, timedelta, date, timezone
from functools import wraps

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING
from werkzeug.exceptions import HTTPException

load_dotenv()

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/reservations")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_EXPIRES_DAYS = int(os.environ.get("JWT_EXPIRES_IN_DAYS", "7"))
PORT = int(os.environ.get("PORT", "5000"))
CLIENT_ORIGIN = os.environ.get("CLIENT_ORIGIN", "*")

# --- Database -------------------------------------------------------------
# Same collection names Mongoose used (lowercased + pluralized model names),
# so this backend reads/writes the very same data the JS version did.
client = MongoClient(MONGODB_URI)
db = client.get_default_database()
users = db["users"]
resources = db["resources"]
reservations = db["reservations"]
closures = db["roomclosures"]

# One closure per room per day (mirrors the unique index in RoomClosure.js).
closures.create_index([("resource", ASCENDING), ("day", ASCENDING)], unique=True)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": CLIENT_ORIGIN}})

DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# --- Helpers --------------------------------------------------------------
def serialize(value):
    """Recursively convert Mongo types to JSON-friendly ones: ObjectId -> str,
    datetime -> ISO string. Mirrors how Mongoose serializes documents."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize(v) for v in value]
    if isinstance(value, dict):
        return {k: serialize(v) for k, v in value.items()}
    return value


def object_id(value):
    """Parse a 24-hex string into an ObjectId, or None if it isn't valid."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def parse_datetime(value):
    """Parse a 'YYYY-MM-DDTHH:MM[:SS]' (datetime-local) string into a datetime,
    or None if it can't be parsed."""
    s = str(value or "").strip()
    if s.endswith("Z"):
        s = s[:-1]
    s = s[:19]  # drop any milliseconds
    if len(s) == 16:  # no seconds component
        s += ":00"
    try:
        return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S")
    except ValueError:
        return None


def covered_days(start_str, end_str):
    """The 'YYYY-MM-DD' day labels a reservation covers, derived from the date
    portion of its datetime strings (matches the calendar grid + closures)."""
    s, e = str(start_str)[:10], str(end_str)[:10]
    try:
        d, last = date.fromisoformat(s), date.fromisoformat(e)
    except ValueError:
        return [s]
    days = []
    while d <= last:
        days.append(d.isoformat())
        d += timedelta(days=1)
    return days


def sign_token(user):
    payload = {
        "sub": str(user["_id"]),
        "role": user.get("role", "user"),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def safe_user(user):
    """The public view of a user (never exposes passwordHash)."""
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role", "user"),
    }


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else None
        if not token:
            return jsonify(error="Authentication required"), 401
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.PyJWTError:
            return jsonify(error="Invalid or expired token"), 401
        request.user_id = payload.get("sub")
        request.user_role = payload.get("role")
        return fn(*args, **kwargs)
    return wrapper


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if getattr(request, "user_role", None) != "admin":
            return jsonify(error="Admin access required"), 403
        return fn(*args, **kwargs)
    return wrapper


# --- Health ---------------------------------------------------------------
@app.get("/api/health")
def health():
    return jsonify(status="ok")


# --- Auth -----------------------------------------------------------------
@app.post("/api/auth/register")
def register():
    body = request.get_json(silent=True) or {}
    name, email, password = body.get("name"), body.get("email"), body.get("password")
    if not name or not email or not password:
        return jsonify(error="name, email and password are required"), 400
    email = email.lower().strip()
    if users.find_one({"email": email}):
        return jsonify(error="Email already registered"), 409
    now = datetime.utcnow()
    doc = {
        "name": name.strip(), "email": email,
        "passwordHash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        "role": "user", "createdAt": now, "updatedAt": now,
    }
    doc["_id"] = users.insert_one(doc).inserted_id
    return jsonify(token=sign_token(doc), user=safe_user(doc)), 201


@app.post("/api/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").lower().strip()
    password = body.get("password") or ""
    if not email or not password:
        return jsonify(error="email and password are required"), 400
    user = users.find_one({"email": email})
    if not user or not bcrypt.checkpw(password.encode(), user["passwordHash"].encode()):
        return jsonify(error="Invalid credentials"), 401
    return jsonify(token=sign_token(user), user=safe_user(user))


@app.get("/api/auth/me")
@require_auth
def me():
    uid = object_id(request.user_id)
    user = users.find_one({"_id": uid}) if uid else None
    if not user:
        return jsonify(error="User no longer exists"), 401
    return jsonify(user=safe_user(user))


# --- Resources ------------------------------------------------------------
@app.get("/api/resources")
@require_auth
def list_resources():
    flt = {"active": True}
    if request.args.get("department"):
        flt["department"] = request.args["department"]
    if request.args.get("kind"):
        flt["kind"] = request.args["kind"]
    docs = resources.find(flt).sort([("kind", 1), ("floor", 1), ("name", 1)])
    return jsonify([serialize(d) for d in docs])


@app.get("/api/resources/catalog")
@require_auth
def get_catalog():
    tree = {}
    for r in resources.find({"active": True}):
        dept = tree.setdefault(r["department"], {"floors": {}, "equipment": []})
        if r["kind"] == "room":
            dept["floors"].setdefault(r.get("floor", ""), []).append(r["name"])
        else:
            dept["equipment"].append(r["name"])
    return jsonify(tree)


# --- Reservations ---------------------------------------------------------
@app.post("/api/reservations")
@require_auth
def create_reservation():
    body = request.get_json(silent=True) or {}
    borrower = body.get("borrowerName")
    resource_id = body.get("resourceId")
    start_raw = body.get("startDateTime")
    end_raw = body.get("endDateTime")
    reason = body.get("reason")

    if not all([borrower, resource_id, start_raw, end_raw, reason]):
        return jsonify(error="borrowerName, resourceId, startDateTime, endDateTime and reason are required"), 400

    rid = object_id(resource_id)
    room = resources.find_one({"_id": rid}) if rid else None
    if not room or not room.get("active") or room.get("kind") != "room":
        return jsonify(error="Room not found"), 404

    start = parse_datetime(start_raw)
    end = parse_datetime(end_raw)
    if start is None or end is None:
        return jsonify(error="Invalid date/time"), 400
    if end <= start:
        return jsonify(error="End time must be after start time"), 400

    # Reject if an admin closed the room on any day this reservation covers.
    days = covered_days(start_raw, end_raw)
    closed = closures.find_one({"resource": room["_id"], "day": {"$in": days}})
    if closed:
        return jsonify(error=f"\"{room['name']}\" is closed on {closed['day']} and can't be reserved that day."), 409

    # Optional equipment used within the room. Each must be active equipment in
    # the room's department; quantity is a request, not an inventory hold.
    items = None
    equipment = body.get("equipment")
    if equipment is not None:
        if not isinstance(equipment, list):
            return jsonify(error="equipment must be a list"), 400
        parsed = []
        for item in equipment:
            name = (item.get("name") or "").strip() if isinstance(item, dict) else ""
            try:
                quantity = int(item.get("quantity")) if isinstance(item, dict) else 0
            except (TypeError, ValueError):
                quantity = 0
            if not name or quantity < 1:
                return jsonify(error="Each equipment item needs a name and quantity ≥ 1"), 400
            parsed.append({"name": name, "quantity": quantity})
        if parsed:
            valid_names = {
                r["name"] for r in resources.find({
                    "department": room["department"], "kind": "equipment", "active": True,
                    "name": {"$in": [i["name"] for i in parsed]},
                })
            }
            unknown = [i["name"] for i in parsed if i["name"] not in valid_names]
            if unknown:
                return jsonify(error=f"Unknown equipment for {room['department']}: {', '.join(unknown)}"), 404
            items = parsed

    # Conflict check: count overlapping pending/approved holds. A room with
    # quantity N can be booked by up to N overlapping reservations.
    overlapping = reservations.count_documents({
        "resource": room["_id"],
        "status": {"$in": ["pending", "approved"]},
        "startDateTime": {"$lt": end},
        "endDateTime": {"$gt": start},
    })
    if overlapping >= room.get("quantity", 1):
        return jsonify(error=(
            f"\"{room['name']}\" is fully booked for the selected time. "
            f"All {room.get('quantity', 1)} unit(s) are already reserved during that window — "
            f"please pick a different time or room."
        )), 409

    now = datetime.utcnow()
    doc = {
        "user": object_id(request.user_id),
        "borrowerName": borrower,
        "department": room["department"],
        "resource": room["_id"],
        "resourceName": room["name"],
        "startDateTime": start,
        "endDateTime": end,
        "reason": reason,
        "status": "pending",
        "remarks": "",
        "createdAt": now,
        "updatedAt": now,
    }
    if items:
        doc["equipment"] = items
    doc["_id"] = reservations.insert_one(doc).inserted_id
    return jsonify(serialize(doc)), 201


@app.get("/api/reservations/mine")
@require_auth
def my_reservations():
    uid = object_id(request.user_id)
    docs = reservations.find({"user": uid}).sort("createdAt", -1)
    return jsonify([serialize(d) for d in docs])


@app.delete("/api/reservations/<rid>")
@require_auth
def cancel_reservation(rid):
    """A user cancels (deletes) their own reservation. Deleting frees the slot
    immediately, since the conflict check only counts tickets that still exist."""
    oid = object_id(rid)
    doc = reservations.find_one({"_id": oid}) if oid else None
    if not doc:
        return jsonify(error="Reservation not found"), 404
    if str(doc.get("user")) != str(request.user_id):
        return jsonify(error="You can only cancel your own reservations"), 403
    reservations.delete_one({"_id": oid})
    return jsonify(ok=True)


@app.get("/api/reservations/calendar")
@require_auth
def calendar_reservations():
    try:
        weeks = int(request.args.get("weeks", 4))
    except (TypeError, ValueError):
        weeks = 4
    weeks = min(max(weeks, 1), 12)

    range_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    range_end = range_start + timedelta(days=weeks * 7)

    department = request.args.get("department")
    resource_id = request.args.get("resourceId")
    rid = object_id(resource_id) if resource_id else None

    # The calendar is rooms-only — equipment has no time-slot availability.
    res_filter = {"active": True, "kind": "room"}
    if department:
        res_filter["department"] = department
    if rid:
        res_filter["_id"] = rid

    rsv_filter = {
        "status": {"$in": ["pending", "approved"]},
        "startDateTime": {"$lt": range_end},
        "endDateTime": {"$gt": range_start},
    }
    if department:
        rsv_filter["department"] = department
    if rid:
        rsv_filter["resource"] = rid

    res_docs = list(resources.find(res_filter).sort([("department", 1), ("floor", 1), ("name", 1)]))
    rsv_docs = list(reservations.find(rsv_filter).sort("startDateTime", 1))
    closure_docs = closures.find({"resource": {"$in": [r["_id"] for r in res_docs]}})

    return jsonify({
        "rangeStart": range_start.isoformat(),
        "rangeEnd": range_end.isoformat(),
        "weeks": weeks,
        "resources": [serialize(r) for r in res_docs],
        "reservations": [serialize(r) for r in rsv_docs],
        "closures": [{"resource": str(c["resource"]), "day": c["day"]} for c in closure_docs],
    })


@app.get("/api/reservations")
@require_auth
@require_admin
def list_reservations():
    flt = {}
    if request.args.get("status"):
        flt["status"] = request.args["status"]
    if request.args.get("department"):
        flt["department"] = request.args["department"]
    docs = list(reservations.find(flt).sort("createdAt", -1))

    # Populate user (name, email) and resource (name, floor, kind), the way the
    # Mongoose .populate() calls did, so the admin UI can show them.
    user_ids = [d["user"] for d in docs if d.get("user")]
    res_ids = [d["resource"] for d in docs if d.get("resource")]
    user_map = {u["_id"]: u for u in users.find({"_id": {"$in": user_ids}})}
    res_map = {r["_id"]: r for r in resources.find({"_id": {"$in": res_ids}})}

    out = []
    for d in docs:
        s = serialize(d)
        u = user_map.get(d.get("user"))
        if u:
            s["user"] = {"_id": str(u["_id"]), "name": u["name"], "email": u["email"]}
        r = res_map.get(d.get("resource"))
        if r:
            s["resource"] = {"_id": str(r["_id"]), "name": r["name"], "floor": r.get("floor", ""), "kind": r["kind"]}
        out.append(s)
    return jsonify(out)


@app.patch("/api/reservations/<rid>/decision")
@require_auth
@require_admin
def decide_reservation(rid):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in ("approved", "rejected"):
        return jsonify(error='status must be "approved" or "rejected"'), 400
    oid = object_id(rid)
    doc = reservations.find_one({"_id": oid}) if oid else None
    if not doc:
        return jsonify(error="Reservation not found"), 404
    update = {
        "status": status,
        "remarks": body.get("remarks") or "",
        "decidedBy": object_id(request.user_id),
        "decidedAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    reservations.update_one({"_id": oid}, {"$set": update})
    doc.update(update)
    return jsonify(serialize(doc))


# --- Availability ---------------------------------------------------------
@app.patch("/api/availability")
@require_auth
@require_admin
def set_availability():
    body = request.get_json(silent=True) or {}
    resource_id = body.get("resourceId")
    day = body.get("day")
    available = body.get("available")
    if not resource_id or not isinstance(day, str) or not DAY_RE.match(day) or not isinstance(available, bool):
        return jsonify(error="resourceId, day (YYYY-MM-DD) and available (boolean) are required"), 400

    rid = object_id(resource_id)
    room = resources.find_one({"_id": rid}) if rid else None
    if not room or not room.get("active") or room.get("kind") != "room":
        return jsonify(error="Room not found"), 404

    if available:
        closures.delete_one({"resource": room["_id"], "day": day})
    else:
        # Idempotent close: create the closure if it isn't already there.
        closures.update_one(
            {"resource": room["_id"], "day": day},
            {"$setOnInsert": {"resource": room["_id"], "day": day, "createdBy": object_id(request.user_id)}},
            upsert=True,
        )
    return jsonify(resourceId=str(room["_id"]), day=day, available=available)


# --- Error handling -------------------------------------------------------
@app.errorhandler(Exception)
def handle_exception(err):
    # Let normal HTTP errors (404 route, 405, etc.) through unchanged.
    if isinstance(err, HTTPException):
        return err
    app.logger.exception(err)
    return jsonify(error="Internal server error"), 500


if __name__ == "__main__":
    print(f"API running on http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=True)
