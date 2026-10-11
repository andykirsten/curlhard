"""Schreibt das OpenAPI-Schema: python -m app.export_openapi [ZIELDATEI]"""

import json
import sys
from pathlib import Path

from app.config import Settings
from app.main import create_app

DEFAULT_TARGET = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def main() -> None:
    app = create_app(Settings(database_url="sqlite://"))
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TARGET
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"OpenAPI geschrieben: {target}")


if __name__ == "__main__":
    main()
