"""
Telaga Putat Hatchery (TPH) — Ingestion Pipeline Configuration & Normalization Dictionaries
"""

import os

# Supabase Credentials (Read from Environment with fallback to project settings)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://keappoukeagyzpoxkrru.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s")
EDITOR_PASSCODE = os.environ.get("ISHARP_EDITOR_PASSCODE", "mantaray")

# Master Source Definitions
SOURCES = [
    {
        "source_code": "SYAQUA 1/2024",
        "display_name": "SyAqua S1/2024",
        "supplier": "SyAqua, Thailand",
        "origin": "INTERNAL",
        "species": "VAN",
        "country": "Thailand"
    },
    {
        "source_code": "AP 1/2024",
        "display_name": "American Penaeid AP1/2024",
        "supplier": "American Penaeid Inc, Florida",
        "origin": "INTERNAL",
        "species": "VAN",
        "country": "USA"
    },
    {
        "source_code": "AP 1/2025",
        "display_name": "American Penaeid AP1/2025",
        "supplier": "American Penaeid Inc, Florida",
        "origin": "INTERNAL",
        "species": "VAN",
        "country": "USA"
    },
    {
        "source_code": "SK 1/2025",
        "display_name": "Syaqua-Kerpan SK1/2025",
        "supplier": "Syaqua-Kerpan (SPT)",
        "origin": "INTERNAL",
        "species": "VAN",
        "country": "Malaysia"
    },
    {
        "source_code": "AP2/2025",
        "display_name": "American Penaeid AP2/2025",
        "supplier": "American Penaeid Inc, Florida",
        "origin": "INTERNAL",
        "species": "VAN",
        "country": "USA"
    },
    {
        "source_code": "AP3/2025",
        "display_name": "American Penaeid AP3/2025",
        "supplier": "American Penaeid Inc, Florida",
        "origin": "INTERNAL",
        "species": "VAN",
        "country": "USA"
    },
    {
        "source_code": "S1/2026",
        "display_name": "SyAqua S1/2026",
        "supplier": "SyAqua, Thailand",
        "origin": "INTERNAL",
        "species": "VAN",
        "country": "Thailand"
    },
    {
        "source_code": "STL 1/2026",
        "display_name": "SyAqua STL1/2026",
        "supplier": "SyAqua, Thailand",
        "origin": "INTERNAL",
        "species": "VAN",
        "country": "Thailand"
    },
    {
        "source_code": "EXT-KSSB",
        "display_name": "KSSB Hatchery",
        "supplier": "KSSB",
        "origin": "EXTERNAL",
        "species": "VAN",
        "country": "Malaysia"
    },
    {
        "source_code": "EXT-KS",
        "display_name": "KS Hatchery",
        "supplier": "KS",
        "origin": "EXTERNAL",
        "species": "VAN",
        "country": "Malaysia"
    },
    {
        "source_code": "EXT-SPT-KS",
        "display_name": "SPT-KS Hatchery",
        "supplier": "SPT-KS",
        "origin": "EXTERNAL",
        "species": "VAN",
        "country": "Malaysia"
    },
    {
        "source_code": "EXT-CP",
        "display_name": "CP Hatchery",
        "supplier": "CP",
        "origin": "EXTERNAL",
        "species": "MON",
        "country": "Malaysia"
    },
    {
        "source_code": "EXT-SPF-CP",
        "display_name": "SPF-CP Hatchery",
        "supplier": "SPF-CP",
        "origin": "EXTERNAL",
        "species": "MON",
        "country": "Malaysia"
    },
    {
        "source_code": "EXT-GS",
        "display_name": "Gertak Sanggul Hatchery",
        "supplier": "Gertak Sanggul Hatchery",
        "origin": "EXTERNAL",
        "species": "VAN",
        "country": "Malaysia"
    }
]

# Source Spelling Map (Raw text -> Canonical source_code)
SOURCE_MAP = {
    # Internal Batches
    "S1/2024": "SYAQUA 1/2024",
    "A1/2024": "AP 1/2024",
    "AP/2024": "AP 1/2024",
    "API/2024": "AP 1/2024",
    "A1/2025": "AP 1/2025",
    "API/2025": "AP 1/2025",
    "SYA/2025": "SK 1/2025",
    "AP2/25": "AP2/2025",
    "AP2/2025": "AP2/2025",
    "AP3/2025": "AP3/2025",
    "SY/2026": "S1/2026",
    "STL/2026": "STL 1/2026",

    # External Nauplii-Only Suppliers
    "KSSB": "EXT-KSSB",
    "KS/2025": "EXT-KS",
    "KS/2026": "EXT-KS",
    "SPT-KS/25": "EXT-SPT-KS",
    "SPT - KS": "EXT-SPT-KS",
    "CP/2025": "EXT-CP",
    "SPF-CP": "EXT-SPF-CP",
    "GS/2025": "EXT-GS",
    "GS/2026": "EXT-GS",
    "SY/GS": "EXT-GS",
    "Sy/GS": "EXT-GS",
    "SY/GS2026": "EXT-GS",
    "Sy/GS2026": "EXT-GS"
}

# Explicit Batch Sheet Mapping (Sheet Title -> Canonical Batch Code)
MAT_SHEET_MAP = {
    "S1 (2024)": "SYAQUA 1/2024",
    "AP1 (2024)": "AP 1/2024",
    "AP1 (2025)": "AP 1/2025",
    "SK1 (2025)": "SK 1/2025",
    "AP2 (2025)": "AP2/2025",
    "AP3 (2025)": "AP3/2025",
    "S1 (2026)": "S1/2026",
    "STL1 (26)": "STL 1/2026"
}
