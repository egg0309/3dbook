import json
from pathlib import Path

_SCRIPT_PATH = Path(__file__).resolve().parent.parent / "data" / "script.json"

with open(_SCRIPT_PATH, "r", encoding="utf-8") as f:
    SCRIPT = json.load(f)
