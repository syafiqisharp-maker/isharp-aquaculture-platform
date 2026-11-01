"""
iSHARP Centralized Credential & Environment Loader for Python Sync/Compliance Scripts.
Reads .env.sync from the workspace root and exposes SUPABASE_URL, SUPABASE_KEY,
EDITOR_PASSCODE, MANAGER_PASSCODE, and VIEWER_PASSCODE with safe fallbacks.
"""

import os
from pathlib import Path


def load_isharp_env() -> dict:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / ".env.sync",
        here.parents[1] / ".env.sync",
        Path.cwd() / ".env.sync",
    ]
    for env_path in candidates:
        if env_path.is_file():
            try:
                for raw_line in env_path.read_text(encoding="utf-8").splitlines():
                    line = raw_line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and val and key not in os.environ:
                        os.environ[key] = val
            except Exception:
                pass
            break

    return {
        "SUPABASE_URL": os.environ.get("SUPABASE_URL", "https://keappoukeagyzpoxkrru.supabase.co"),
        "SUPABASE_KEY": os.environ.get("SUPABASE_KEY", "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s"),
        "EDITOR_PASSCODE": os.environ.get("ISHARP_EDITOR_PASSCODE", "mantaray"),
        "MANAGER_PASSCODE": os.environ.get("ISHARP_MANAGER_PASSCODE", "todak"),
        "VIEWER_PASSCODE": os.environ.get("ISHARP_VIEWER_PASSCODE", "monodon"),
    }


_CFG = load_isharp_env()
SUPABASE_URL = _CFG["SUPABASE_URL"]
SUPABASE_KEY = _CFG["SUPABASE_KEY"]
EDITOR_PASSCODE = _CFG["EDITOR_PASSCODE"]
MANAGER_PASSCODE = _CFG["MANAGER_PASSCODE"]
VIEWER_PASSCODE = _CFG["VIEWER_PASSCODE"]
