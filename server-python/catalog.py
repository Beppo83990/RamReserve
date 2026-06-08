"""
Single source of truth for the reservable catalog (ported from catalog.js).

Each department (BMO, ITRO) owns a DIFFERENT set of resources. Within a
department there are two kinds of reservable resource:
  - room      : a physical room, organized by floor, booked one at a time.
  - equipment : a piece of gear, requested by quantity (no fixed floor).

Every entry becomes one document in the `resources` collection. Rooms have
quantity 1 and a floor; equipment carries no floor and its quantity is decided
per-request by the borrower, so the stored quantity is left at 1.
"""

DEPARTMENTS = ["BMO", "ITRO"]

ROOMS_BY_FLOOR = {
    "BMO": {
        "1st Floor": ["Multipurpose Hall A"],
        "2nd Floor": ["201", "203", "204", "205", "206", "207", "208", "209", "213", "214", "215", "216"],
        "3rd Floor": ["302", "304", "305", "306", "307", "308", "309", "313", "314", "315", "316", "317", "318"],
        "4th Floor": ["416", "418"],
        "5th Floor": ["508 A", "508 B", "513", "514 A", "514 B", "517", "518"],
        "6th Floor": ["601", "603", "605", "607", "609 A", "609 B", "609 C", "614", "615", "616", "617", "618"],
        "8th Floor": ["809", "811", "813", "815", "817"],
        "10th Floor": [
            "Gym", "1011 Kitchen", "1013 PWERSA", "1014 A", "1014 B", "1015 A", "1015 B",
            "1016 A", "1016 B", "1017 A", "1017 B", "1018 A", "1018 B",
        ],
        "11th Floor": ["1110 Basketball Court", "1115", "1117", "1118"],
    },
    "ITRO": {
        "5th Floor": [
            "509 Video and Photography Studio",
            "515 2D Animation Studio",
            "516 A Foley Recording Studio",
            "516 B Music Recording Studio",
        ],
        "6th Floor": [
            "602 Graphic Design and Sound Laboratory",
            "604 Animation Laboratory",
            "606 Game Laboratory",
            "608 Video Editing Laboratory",
        ],
        "8th Floor": [
            "801 Digital Electronics Laboratory",
            "802 National Instrument Laboratory",
            "803/805 Engineering and Sciences Laboratory Office",
            "806 Physics Laboratory",
            "807 Networking and Communications Laboratory",
            "816 Hydraulic Laboratory",
            "818 Soil Test Laboratory",
        ],
        "11th Floor": ["1113 Chemistry Laboratory", "1114/1116 Art Studio/Project Laboratory"],
    },
}

EQUIPMENT = {
    "BMO": ["Amplifiers", "Cables", "Microphones", "Mixers", "Speakers", "Projectors"],
    "ITRO": ["Cameras", "Cables", "Lights", "Microphones", "Monitors", "Speakers"],
}


def build_resources():
    """Flatten the catalog into a list of resource documents."""
    docs = []
    for department in DEPARTMENTS:
        for floor, names in ROOMS_BY_FLOOR.get(department, {}).items():
            for name in names:
                docs.append({
                    "department": department, "kind": "room",
                    "floor": floor, "name": name, "description": "",
                    "quantity": 1, "active": True,
                })
        for name in EQUIPMENT.get(department, []):
            docs.append({
                "department": department, "kind": "equipment",
                "floor": "", "name": name, "description": "",
                "quantity": 1, "active": True,
            })
    return docs
