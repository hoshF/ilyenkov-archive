#!/usr/bin/env python3
"""OCR newspaper photocopy images from the historical caute/filorus archive into Markdown."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageFilter, ImageOps

import ilyenkov_common as common


ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "ilyenkov_catalog_manifest.json"
STATE_PATH = ROOT / "ilyenkov_newspaper_ocr_state.json"
OUTPUT_DIR = ROOT / "ilyenkov_md" / "newspaper"
IMAGE_DIR = OUTPUT_DIR / "images"
WORK_DIR = ROOT.parent / "work" / "newspaper_ocr"
TESSDATA_DIR = ROOT.parent / "work" / "tessdata"
RUS_TESSDATA_URL = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/rus.traineddata"
SKIP_AS_CLEAN_MD_EXISTS = {
    "http://filorus.ru/ilyenkov/gra/kp081267.jpg": "outputs/ilyenkov_md/dialogi-i-intervyu/dialogi-i-intervyu-muzhestvo-mysli.md",
    "http://filorus.ru/ilyenkov/gra/kp161276.jpg": "outputs/ilyenkov_md/dialogi-i-intervyu/dialogi-i-intervyu-solo-dlya-aleshi.md",
    "http://filorus.ru/ilyenkov/gra/oa151177.jpg": "outputs/ilyenkov_md/dialogi-i-intervyu/dialogi-i-intervyu-pravo-na-tvorchestvo.md",
}


def newspaper_items(manifest: dict) -> list[dict]:
    items = []
    for item in manifest["items"]:
        if item.get("section") != "Фотокопии газетных статей":
            continue
        path = urlparse(item["url"]).path.lower()
        if not path.endswith((".jpg", ".jpeg")):
            continue
        if item["url"] in SKIP_AS_CLEAN_MD_EXISTS:
            continue
        item_id = "newspaper-" + common.slugify(item["title"])
        items.append({**item, "id": item_id})
    return items


def ensure_rus_tessdata() -> None:
    TESSDATA_DIR.mkdir(parents=True, exist_ok=True)
    target = TESSDATA_DIR / "rus.traineddata"
    if target.exists() and target.stat().st_size > 1_000_000:
        return
    with urlopen(Request(RUS_TESSDATA_URL, headers={"User-Agent": common.USER_AGENT}), timeout=120) as response:
        target.write_bytes(response.read())


def download_image(url: str, target: Path, force: bool = False) -> None:
    if target.exists() and target.stat().st_size > 0 and not force:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".tmp")
    with urlopen(Request(url, headers={"User-Agent": common.USER_AGENT}), timeout=60) as response:
        tmp.write_bytes(response.read())
    tmp.replace(target)


def preprocess_image(source: Path, target: Path) -> None:
    image = Image.open(source).convert("L")
    image = ImageOps.autocontrast(image)
    if max(image.size) < 4500:
        image = image.resize((image.width * 2, image.height * 2))
    image = image.filter(ImageFilter.SHARPEN)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target)


def run_tesseract(image: Path) -> str:
    if not shutil.which("tesseract"):
        raise RuntimeError("tesseract is not installed or not on PATH")
    ensure_rus_tessdata()
    command = [
        "tesseract",
        str(image),
        "stdout",
        "--tessdata-dir",
        str(TESSDATA_DIR),
        "-l",
        "rus",
        "--psm",
        "3",
    ]
    result = subprocess.run(command, check=False, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"tesseract exited with {result.returncode}")
    return clean_ocr_text(result.stdout)


def clean_ocr_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def markdown_for(item: dict, image_path: Path, text: str) -> str:
    rel_image = image_path.relative_to(OUTPUT_DIR)
    lines = [
        f"# {item['title']}",
        "",
        f"Источник: <{item['url']}>",
        "",
        f"Локальная копия изображения: `{rel_image}`",
        "",
        "Примечание: текст ниже получен OCR по газетной фотокопии и требует ручной сверки.",
        "",
        f"![{item['title']}]({rel_image.as_posix()})",
        "",
        "## OCR",
        "",
        text or "[OCR text not detected]",
        "",
    ]
    return "\n".join(lines)


def output_path(item: dict) -> Path:
    return OUTPUT_DIR / f"{item['id']}.md"


def image_path_for(item: dict) -> Path:
    suffix = Path(urlparse(item["url"]).path).suffix.lower() or ".jpg"
    return IMAGE_DIR / f"{item['id']}{suffix}"


def state_item_complete(state_item: dict, item: dict) -> bool:
    path = output_path(item)
    return state_item.get("status") == "done" and path.exists() and state_item.get("hash") == common.markdown_hash(path.read_text(encoding="utf-8"))


def convert_item(item: dict, force: bool) -> dict:
    image_path = image_path_for(item)
    work_image = WORK_DIR / image_path.name
    preprocessed = WORK_DIR / f"{image_path.stem}.pre.png"
    download_image(item["url"], image_path, force=force)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(image_path, work_image)
    preprocess_image(work_image, preprocessed)
    text = run_tesseract(preprocessed)
    markdown = markdown_for(item, image_path, text)
    out = output_path(item)
    common.atomic_write(out, markdown)
    return {
        "status": "done",
        "output_path": str(out.relative_to(ROOT)),
        "image_path": str(image_path.relative_to(ROOT)),
        "hash": common.markdown_hash(markdown),
        "ocr_chars": len(text),
    }


def print_summary(items: list[dict]) -> None:
    print(f"Newspaper image OCR candidates: {len(items)}")
    for item in items:
        print(f"- {item['id']}: {item['title']} {item['url']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="OCR historical caute/filorus newspaper photocopy images into Markdown.")
    parser.add_argument("--resume", action="store_true", help="Skip completed OCR outputs whose hash still matches state")
    parser.add_argument("--force", action="store_true", help="Re-download and re-OCR items")
    parser.add_argument("--limit", type=int, help="Process only first N items")
    parser.add_argument("--only", help="Process only one newspaper item id")
    parser.add_argument("--dry-run", action="store_true", help="List OCR candidates without processing")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress messages")
    args = parser.parse_args()

    manifest = common.read_json(MANIFEST_PATH, {})
    if not manifest:
        raise SystemExit("Manifest not found. Run ilyenkov_bulk_convert.py --dry-run --rebuild-manifest first.")
    items = newspaper_items(manifest)
    if args.only:
        items = [item for item in items if item["id"] == args.only]
        if not items:
            raise SystemExit(f"No newspaper OCR item with id {args.only}")
    if args.limit is not None:
        items = items[: args.limit]
    if args.dry_run:
        print_summary(items)
        return 0

    state = common.read_json(STATE_PATH, {"items": {}})
    state.setdefault("items", {})
    done = skipped = failed = 0
    for item in items:
        state_item = state["items"].get(item["id"], {})
        if args.resume and not args.force and state_item_complete(state_item, item):
            skipped += 1
            common.status(f"skip done {item['id']}", args.quiet)
            continue
        common.status(f"ocr {item['id']}", args.quiet)
        try:
            result = convert_item(item, force=args.force)
            state["items"][item["id"]] = result
            done += 1
        except Exception as exc:  # noqa: BLE001 - record failure and continue
            state["items"][item["id"]] = {"status": "failed", "error": str(exc)}
            failed += 1
        common.write_json(STATE_PATH, state)
    common.status(f"ocr_done={done} skipped={skipped} failed={failed}", args.quiet)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
