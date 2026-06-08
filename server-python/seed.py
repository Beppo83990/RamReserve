"""
Seed script (ported from seed.js).

Clears users / resources / reservations, inserts the catalog, and creates the
two demo accounts. Run with:  python seed.py
"""
import os
from datetime import datetime

import bcrypt
from dotenv import load_dotenv
from pymongo import MongoClient

from catalog import build_resources

load_dotenv()


def hash_password(plain):
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def seed():
    client = MongoClient(os.environ.get("MONGODB_URI", "mongodb://localhost:27017/reservations"))
    db = client.get_default_database()

    print("Clearing existing data...")
    db.users.delete_many({})
    db.resources.delete_many({})
    db.reservations.delete_many({})

    print("Seeding resources...")
    resources = build_resources()
    db.resources.insert_many(resources)

    print("Seeding accounts...")
    now = datetime.utcnow()
    db.users.insert_one({
        "name": "System Admin", "email": "admin@reserve.test",
        "passwordHash": hash_password("admin123"), "role": "admin",
        "createdAt": now, "updatedAt": now,
    })
    db.users.insert_one({
        "name": "Demo User", "email": "user@reserve.test",
        "passwordHash": hash_password("user123"), "role": "user",
        "createdAt": now, "updatedAt": now,
    })

    print("\nSeed complete!")
    print("  Admin -> admin@reserve.test / admin123")
    print("  User  -> user@reserve.test / user123")
    print(f"  Resources seeded: {len(resources)}")
    client.close()


if __name__ == "__main__":
    seed()
