#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"}
ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
MANIFEST_PATH = IMAGES_DIR / "images.json"


def git_last_modified_iso(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", rel],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def is_image(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTS


def main() -> None:
    if not IMAGES_DIR.exists():
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    entries = []
    for path in IMAGES_DIR.iterdir():
        if not is_image(path):
            continue
        rel = path.relative_to(ROOT).as_posix()
        entries.append(
            {
                "name": path.name,
                "path": rel,
                "lastModified": git_last_modified_iso(path),
            }
        )

    entries.sort(key=lambda item: (item["lastModified"] or "9999-12-31T23:59:59Z", item["name"]))
    MANIFEST_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {MANIFEST_PATH} with {len(entries)} items.")


if __name__ == "__main__":
    main()
