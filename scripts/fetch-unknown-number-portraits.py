#!/usr/bin/env python3
"""Download freely licensed Wikimedia portraits for Unknown Number."""

from __future__ import annotations

import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "components/games/unknown-number/data"
OUT_DIR = ROOT / "public/games/unknown-number/portraits"
META = ROOT / "components/games/unknown-number/portraits.ts"
UA = "UnknownNumber/1.0 (https://saidyaka.com; educational daily puzzle)"
API = "https://en.wikipedia.org/w/api.php"
ALLOWED = (
    "public domain",
    "pd",
    "cc0",
    "cc by",
    "cc-by",
    "cc by-sa",
    "cc-by-sa",
    "creative commons attribution",
)

def wiki_slug(url: str) -> str:
    return urllib.parse.unquote(url.rstrip("/").split("/wiki/")[-1])


def figures() -> list[dict[str, str]]:
    rows = []
    for path in sorted(DATA.glob("*.ts")):
        text = path.read_text()
        for match in re.finditer(
            r"id:\s*'([^']+)'.*?name:\s*'((?:\\'|[^'])+)'.*?source:\s*wiki\('([^']+)'\)",
            text,
            re.S,
        ):
            rows.append({"id": match.group(1), "name": match.group(2).replace("\\'", "'"), "slug": match.group(3)})
    return rows


def api(params: dict) -> dict:
    query = urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def license_ok(short: str, name: str) -> str | None:
    blob = f"{short} {name}".lower()
    if "fair use" in blob or "non-free" in blob or "copyrighted" in blob:
        return None
    if "gfdl" in blob and "cc" not in blob:
        return None
    if "cc0" in blob or "creative commons cc0" in blob:
        return "CC0"
    if "by-sa" in blob or "attribution-share" in blob:
        return "CC BY-SA"
    if re.search(r"\bcc[- ]by\b", blob) or "creative commons attribution" in blob:
        return "CC BY"
    if "public domain" in blob or blob.strip() in {"pd", "pd-old", "pd-us"}:
        return "Public Domain"
    return None


def page_image(slug: str) -> dict | None:
    data = api(
        {
            "action": "query",
            "titles": slug.replace("_", " "),
            "prop": "pageimages",
            "pithumbsize": 800,
            "pilicense": "any",
        }
    )
    pages = data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    title = page.get("pageimage")
    if not title:
        return None
    return file_info(f"File:{title}")


def file_info(title: str) -> dict | None:
    data = api(
        {
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size|mime",
            "iiurlwidth": 800,
        }
    )
    pages = data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    info = (page.get("imageinfo") or [None])[0]
    if not info:
        return None
    meta = info.get("extmetadata") or {}
    short = (meta.get("LicenseShortName") or {}).get("value") or ""
    license_name = (meta.get("License") or {}).get("value") or ""
    mapped = license_ok(short, license_name)
    if not mapped:
        return None
    artist = re.sub("<[^>]+>", "", (meta.get("Artist") or {}).get("value") or "Unknown").strip() or "Unknown"
    artist = re.sub(r"\s+", " ", artist)[:160]
    url = info.get("thumburl") or info.get("url")
    commons = (meta.get("CommonsFilePage") or {}).get("value") or info.get("descriptionshorturl") or info.get("descriptionurl")
    if not url:
        return None
    return {
        "author": artist,
        "license": mapped,
        "url": url,
        "commonsUrl": commons or f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
        "title": title,
    }


def download(url: str, dest: Path) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    raw = dest.with_suffix(".src")
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw.write_bytes(response.read())
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(raw), "-vf", "scale=480:-1", "-c:v", "libwebp", "-quality", "78", str(dest)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        raw.unlink(missing_ok=True)
        return dest.exists() and dest.stat().st_size > 1000
    except (urllib.error.URLError, subprocess.CalledProcessError, TimeoutError):
        raw.unlink(missing_ok=True)
        dest.unlink(missing_ok=True)
        return False


def ts_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    portraits: dict[str, dict] = {}
    for row in figures():
        print(f"fetch {row['id']} ({row['slug']})", flush=True)
        info = None
        try:
            info = page_image(row["slug"])
        except Exception as exc:  # noqa: BLE001
            print(f"  skip query: {exc}")
        time.sleep(0.35)
        if not info:
            continue
        dest = OUT_DIR / f"{row['id']}.webp"
        if dest.exists() or download(info["url"], dest):
            portraits[row["id"]] = {
                "path": f"/games/unknown-number/portraits/{row['id']}.webp",
                "commonsUrl": info["commonsUrl"],
                "author": info["author"],
                "license": info["license"],
            }
            print(f"  saved {info['license']}")
        else:
            print("  download failed")
        time.sleep(0.2)

    lines = [
        "import type { Portrait } from './types';",
        "",
        "/** Generated by scripts/fetch-unknown-number-portraits.py from Wikimedia Commons. */",
        "export const PORTRAITS: Record<string, Portrait> = {",
    ]
    for key, item in sorted(portraits.items()):
        lines.append(
            "  '{id}': {{ path: '{path}', commonsUrl: '{commons}', author: '{author}', license: '{license}' }},".format(
                id=key,
                path=ts_escape(item["path"]),
                commons=ts_escape(item["commonsUrl"]),
                author=ts_escape(item["author"]),
                license=item["license"],
            )
        )
    lines.append("};")
    lines.append("")
    META.write_text("\n".join(lines))
    print(f"wrote {len(portraits)} portraits")


if __name__ == "__main__":
    main()
