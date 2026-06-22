#!/usr/bin/env python3
"""Download A. D. Maidansky Academia.edu attachments as unprocessed source files."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import mimetypes
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import Cookie, CookieJar, MozillaCookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILE_URL = "https://xn--90aefy5b.academia.edu/AndreyMaidansky"
PROFILE_URL_DISPLAY = "https://белгу.academia.edu/AndreyMaidansky"
METADATA_DIR = ROOT / "metadata"
ACADEMIA_MANIFEST = METADATA_DIR / "academia_manifest.json"
SOURCE_MANIFEST = METADATA_DIR / "source_scans_manifest.json"
MANUAL_QUEUE = METADATA_DIR / "academia_manual_queue.json"
SCAN_DIR = ROOT / "source_scans" / "academia"
AUTHOR = "Майданский Андрей Дмитриевич"
EXPECTED_TOTAL = 57
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

RIGHTS_DEFAULTS = {
    "source_license": "not_stated",
    "redistribution_approved": "false",
    "rights_review_status": "unreviewed",
    "text_role": "source_scan_unprocessed",
    "text_status": "source_scan_unprocessed",
    "core_corpus_eligible": "false",
    "llm_wiki_eligible": "false",
}


def today() -> str:
    return dt.date.today().isoformat()


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def read_json(path: Path, default: dict) -> dict:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def compact_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(text).replace("\xa0", " ")).strip()


def strip_tags(text: str) -> str:
    return compact_spaces(re.sub(r"<[^>]+>", " ", text))


def slugify(text: str, fallback: str) -> str:
    text = html.unescape(text)
    text = text.lower().replace("ё", "e")
    table = str.maketrans(
        {
            "а": "a",
            "б": "b",
            "в": "v",
            "г": "g",
            "д": "d",
            "е": "e",
            "ж": "zh",
            "з": "z",
            "и": "i",
            "й": "i",
            "к": "k",
            "л": "l",
            "м": "m",
            "н": "n",
            "о": "o",
            "п": "p",
            "р": "r",
            "с": "s",
            "т": "t",
            "у": "u",
            "ф": "f",
            "х": "h",
            "ц": "ts",
            "ч": "ch",
            "ш": "sh",
            "щ": "sch",
            "ъ": "",
            "ы": "y",
            "ь": "",
            "э": "e",
            "ю": "yu",
            "я": "ya",
        }
    )
    text = text.translate(table)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text[:120] or fallback


def cookie_from_pair(name: str, value: str, domain: str) -> Cookie:
    return Cookie(
        version=0,
        name=name,
        value=value,
        port=None,
        port_specified=False,
        domain=domain,
        domain_specified=True,
        domain_initial_dot=domain.startswith("."),
        path="/",
        path_specified=True,
        secure=True,
        expires=None,
        discard=True,
        comment=None,
        comment_url=None,
        rest={},
        rfc2109=False,
    )


def load_cookiejar(path: Path) -> CookieJar:
    jar = MozillaCookieJar()
    try:
        jar.load(path, ignore_discard=True, ignore_expires=True)
        if len(jar):
            return jar
    except Exception:
        pass

    raw = path.read_text(encoding="utf-8", errors="replace").strip()
    if raw.lower().startswith("cookie:"):
        raw = raw.split(":", 1)[1].strip()
    plain = CookieJar()
    domains = [".academia.edu", ".xn--90aefy5b.academia.edu"]
    for part in raw.split(";"):
        if "=" not in part:
            continue
        name, value = part.strip().split("=", 1)
        if not name:
            continue
        for domain in domains:
            plain.set_cookie(cookie_from_pair(name, value, domain))
    return plain


def opener(cookie_file: Path | None) -> urllib.request.OpenerDirector:
    jar = load_cookiejar(cookie_file) if cookie_file else CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    op.addheaders = [
        ("User-Agent", UA),
        ("Accept-Language", "en-US,en;q=0.9,ru;q=0.8"),
        ("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
    ]
    return op


def fetch_text(
    op: urllib.request.OpenerDirector,
    url: str,
    referer: str | None = None,
    *,
    timeout: int = 60,
    max_bytes: int = 0,
) -> str:
    headers = {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with op.open(req, timeout=timeout) as resp:
        if not max_bytes:
            return resp.read().decode("utf-8", "replace")
        chunks: list[bytes] = []
        remaining = max_bytes
        while remaining > 0:
            chunk = resp.read(min(8192, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks).decode("utf-8", "replace")


def parse_expected_counts(source: str) -> dict:
    counts = {"papers": 51, "book_reviews": 3, "books": 3, "total": EXPECTED_TOTAL}
    patterns = {
        "papers": r"(\d+)\s+Papers",
        "book_reviews": r"(\d+)\s+Book Reviews",
        "books": r"(\d+)\s+Books",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, source, flags=re.I)
        if match:
            counts[key] = int(match.group(1))
    counts["total"] = counts["papers"] + counts["book_reviews"] + counts["books"]
    return counts


def extract_work_urls(source: str) -> dict[str, dict]:
    records: dict[str, dict] = {}
    anchor_pattern = re.compile(
        r'<a\b[^>]*href="(?P<url>https://www\.academia\.edu/(?P<id>\d+)/[^"]+)"[^>]*>'
        r"(?P<label>.*?)</a>",
        flags=re.I | re.S,
    )
    for match in anchor_pattern.finditer(source):
        work_id = match.group("id")
        label = strip_tags(match.group("label"))
        if not label or label.lower() in {"download", "all"}:
            label = urllib.parse.unquote(match.group("url").rsplit("/", 1)[-1]).replace("_", " ")
        records.setdefault(
            work_id,
            {
                "work_id": work_id,
                "title": compact_spaces(label),
                "work_url": match.group("url"),
                "category": "",
                "citation": "",
                "summary": "",
                "download_url": "",
                "attachment_id": "",
                "status": "listed",
                "error": "",
            },
        )

    url_pattern = re.compile(r"https://www\.academia\.edu/(?P<id>\d+)/(?P<slug>[^\"'<>\\\s]+)", flags=re.I)
    for match in url_pattern.finditer(source):
        work_id = match.group("id")
        slug = urllib.parse.unquote(match.group("slug")).replace("_", " ")
        records.setdefault(
            work_id,
            {
                "work_id": work_id,
                "title": compact_spaces(slug),
                "work_url": f"https://www.academia.edu/{work_id}/{match.group('slug')}",
                "category": "",
                "citation": "",
                "summary": "",
                "download_url": "",
                "attachment_id": "",
                "status": "listed",
                "error": "",
            },
        )
    return records


def nearest_work_id(source: str, offset: int) -> str:
    left = source[max(0, offset - 1200) : offset]
    matches = re.findall(r"asset_id:\s*(\d+)|data-work-id=\"(\d+)\"", left)
    for pair in reversed(matches):
        work_id = pair[0] or pair[1]
        if work_id:
            return work_id
    return ""


def add_attachment_urls(source: str, records: dict[str, dict]) -> None:
    pattern = re.compile(r'href="(?P<url>https://www\.academia\.edu/attachments/(?P<aid>\d+)/download_file\?s=profile)"')
    for match in pattern.finditer(source):
        work_id = nearest_work_id(source, match.start())
        if not work_id:
            continue
        records.setdefault(
            work_id,
            {
                "work_id": work_id,
                "title": f"academia-work-{work_id}",
                "work_url": f"https://www.academia.edu/{work_id}",
                "category": "",
                "citation": "",
                "summary": "",
                "download_url": "",
                "attachment_id": "",
                "status": "listed",
                "error": "",
            },
        )
        records[work_id]["download_url"] = match.group("url")
        records[work_id]["attachment_id"] = match.group("aid")


def enrich_from_cards(source: str, records: dict[str, dict]) -> None:
    for work_id, record in records.items():
        idx = source.find(f'data-work-id="{work_id}"')
        if idx == -1:
            idx = source.find(f"asset_id: {work_id}")
        if idx == -1:
            continue
        start = max(0, idx - 3500)
        end = min(len(source), idx + 3500)
        block = source[start:end]
        title_match = re.search(
            r'<a\b[^>]*href="https://www\.academia\.edu/%s/[^"]+"[^>]*>(.*?)</a>' % re.escape(work_id),
            block,
            flags=re.I | re.S,
        )
        if title_match:
            record["title"] = strip_tags(title_match.group(1)) or record["title"]
        lines = [strip_tags(x) for x in re.findall(r"<(?:div|span|p)\b[^>]*>(.*?)</(?:div|span|p)>", block, re.S)]
        lines = [line for line in lines if line and line not in {record["title"], "Download"}]
        for line in lines:
            if re.search(r"\b(19|20)\d{2}\b", line) and len(line) < 180:
                record["citation"] = line
                break
        summary = " ".join(line for line in lines if len(line) >= 80)
        record["summary"] = compact_spaces(summary[:1200])


def parse_profile(source: str) -> tuple[dict, list[dict]]:
    records = extract_work_urls(source)
    add_attachment_urls(source, records)
    enrich_from_cards(source, records)
    counts = parse_expected_counts(source)
    items = sorted(records.values(), key=lambda item: int(item["work_id"]))
    return counts, items


def viewed_user_id(source: str) -> str:
    match = re.search(r"\$viewedUser\s*=\s*Aedu\.User\.set_viewed\(\s*\{\s*\"id\":(\d+)", source)
    return match.group(1) if match else ""


def fetch_api_work_html(op: urllib.request.OpenerDirector, source: str, expected_total: int) -> list[str]:
    user_id = viewed_user_id(source)
    if not user_id:
        return []

    html_blocks: list[str] = []
    offset = 20
    per_page = 20
    while offset < expected_total + per_page:
        params = urllib.parse.urlencode({"user_id": user_id, "per_page": per_page, "offset": offset})
        url = f"https://api.academia.edu/v0/profiles/works?{params}"
        headers = {
            "User-Agent": UA,
            "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": PROFILE_URL,
            "X-Requested-With": "XMLHttpRequest",
        }
        req = urllib.request.Request(url, headers=headers)
        try:
            with op.open(req, timeout=60) as resp:
                payload = json.loads(resp.read().decode("utf-8", "replace"))
        except Exception:
            break
        works = payload.get("works") or []
        if not works:
            break
        for work in works:
            if isinstance(work, dict) and work.get("html"):
                html_blocks.append(work["html"])
        if len(works) < 10:
            break
        offset += per_page
    return html_blocks


def extract_download_url_from_detail(source: str) -> tuple[str, str]:
    match = re.search(r"https://www\.academia\.edu/attachments/(\d+)/download_file(?:\?[^\"']*)?", source)
    if match:
        return match.group(0), match.group(1)
    match = re.search(r'"attachmentId"\s*:\s*"(\d+)"', source)
    if match:
        attachment_id = match.group(1)
        return f"https://www.academia.edu/attachments/{attachment_id}/download_file", attachment_id
    return "", ""


def fetch_detail_text(
    op: urllib.request.OpenerDirector,
    item: dict,
    cookie_file: Path | None,
) -> str:
    if cookie_file:
        result = subprocess.run(
            [
                "curl",
                "-L",
                "--max-time",
                "20",
                "--connect-timeout",
                "5",
                "-A",
                UA,
                "-H",
                f"Referer: {PROFILE_URL}",
                "-b",
                str(cookie_file),
                item["work_url"],
            ],
            capture_output=True,
            check=False,
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout.decode("utf-8", "replace")
    return fetch_text(op, item["work_url"], PROFILE_URL, timeout=20, max_bytes=300_000)


def resolve_detail_download_urls(
    op: urllib.request.OpenerDirector,
    items: list[dict],
    delay: float,
    cookie_file: Path | None,
) -> None:
    for item in items:
        if item.get("download_url"):
            continue
        time.sleep(delay)
        try:
            source = fetch_detail_text(op, item, cookie_file)
        except Exception:
            continue
        download_url, attachment_id = extract_download_url_from_detail(source)
        if download_url:
            item["download_url"] = download_url
            item["attachment_id"] = attachment_id


def infer_extension(url: str, headers: dict, first_bytes: bytes) -> str:
    disposition = headers.get("Content-Disposition", "") or headers.get("content-disposition", "")
    filename_match = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', disposition, flags=re.I)
    if filename_match:
        filename = urllib.parse.unquote(filename_match.group(1).strip('"'))
        suffix = Path(filename).suffix.lower().lstrip(".")
        if suffix:
            return suffix
    content_type = (headers.get("Content-Type") or headers.get("content-type") or "").split(";", 1)[0].strip()
    if first_bytes.startswith(b"%PDF"):
        return "pdf"
    if first_bytes.startswith(b"AT&T"):
        return "djvu"
    guessed = mimetypes.guess_extension(content_type) if content_type else ""
    if guessed:
        return guessed.lstrip(".")
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower().lstrip(".")
    return suffix or "bin"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def pdf_pages(path: Path) -> int:
    try:
        out = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return 0
    match = re.search(r"^Pages:\s+(\d+)", out.stdout, flags=re.M)
    return int(match.group(1)) if match else 0


def djvu_pages(path: Path) -> int:
    data = path.read_bytes()
    if not data.startswith(b"AT&TFORM"):
        return 0
    return data.count(b"FORM") - 1 if b"DJVM" in data[:32] else 1


def page_count(path: Path, ext: str) -> int:
    if ext == "pdf":
        return pdf_pages(path)
    if ext in {"djvu", "djv"}:
        return djvu_pages(path)
    return 0


def existing_candidate(stem: str) -> Path | None:
    pattern = re.compile(rf"^{re.escape(stem)}(?:-\d+)?\.[^.]+$")
    matches = [
        path
        for path in SCAN_DIR.glob(f"{stem}*")
        if path.is_file() and not path.name.endswith(".part") and pattern.match(path.name) and path.stat().st_size > 0
    ]
    if not matches:
        return None
    return sorted(matches, key=lambda path: path.stat().st_mtime)[-1]


def source_record_from_path(item: dict, dest: Path) -> dict:
    digest = sha256(dest)
    ext = dest.suffix.lower().lstrip(".")
    return {
        "title": item.get("title") or f"academia-work-{item['work_id']}",
        "author": AUTHOR,
        "publication_year": extract_year(item.get("citation", "")),
        "citation": item.get("citation", ""),
        "source_url": item["work_url"],
        "work_url": item["work_url"],
        "download_url": item["download_url"],
        "download_date": today(),
        "local_path": str(dest.relative_to(ROOT)),
        "pages": page_count(dest, ext),
        "bytes": dest.stat().st_size,
        "sha256": digest,
        "source_format": ext,
        **RIGHTS_DEFAULTS,
    }


def curl_download(item: dict, stem: str, cookie_file: Path) -> tuple[Path | None, str]:
    SCAN_DIR.mkdir(parents=True, exist_ok=True)
    raw_tmp = SCAN_DIR / f".{stem}.download.part"
    header_tmp = SCAN_DIR / f".{stem}.headers.tmp"
    for path in (raw_tmp, header_tmp):
        if path.exists():
            path.unlink()
    result = subprocess.run(
        [
            "curl",
            "-L",
            "--http1.1",
            "--fail",
            "--max-time",
            "90",
            "--connect-timeout",
            "10",
            "-A",
            UA,
            "-H",
            f"Referer: {item['work_url']}",
            "-b",
            str(cookie_file),
            "-D",
            str(header_tmp),
            "-o",
            str(raw_tmp),
            item["download_url"],
        ],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0 or not raw_tmp.exists() or raw_tmp.stat().st_size == 0:
        status_match = None
        if header_tmp.exists():
            status_match = re.findall(r"^HTTP/[^\s]+\s+(\d+)", header_tmp.read_text(encoding="utf-8", errors="replace"), flags=re.M)
        error = f"HTTP {status_match[-1]}" if status_match else f"curl exit {result.returncode}"
        for path in (raw_tmp, header_tmp):
            if path.exists():
                path.unlink()
        return None, error

    first = raw_tmp.read_bytes()[:8192]
    header_text = header_tmp.read_text(encoding="utf-8", errors="replace") if header_tmp.exists() else ""
    headers: dict[str, str] = {}
    for line in header_text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        headers[key.strip()] = value.strip()
    content_type = headers.get("Content-Type", "")
    if b"<html" in first[:512].lower() or "text/html" in content_type.lower():
        for path in (raw_tmp, header_tmp):
            if path.exists():
                path.unlink()
        return None, f"download returned HTML ({content_type or 'unknown content type'})"

    ext = infer_extension(item["download_url"], headers, first)
    dest = SCAN_DIR / f"{stem}.{ext}"
    counter = 2
    while dest.exists() and item["work_id"] not in dest.name:
        candidate = SCAN_DIR / f"{stem}-{counter}.{ext}"
        if not candidate.exists():
            dest = candidate
            break
        counter += 1
    raw_tmp.replace(dest)
    if header_tmp.exists():
        header_tmp.unlink()
    return dest, ""


def download_file(op: urllib.request.OpenerDirector, item: dict, delay: float, cookie_file: Path | None) -> tuple[dict | None, dict]:
    if not item.get("download_url"):
        failed = {**item, "status": "needs_manual", "error": "no attachment download URL on profile page"}
        return None, failed

    stem = slugify(item.get("title") or item["work_id"], f"academia-work-{item['work_id']}")
    existing = existing_candidate(stem)
    if existing:
        record = source_record_from_path(item, existing)
        item_record = {
            **item,
            "status": "downloaded",
            "local_path": record["local_path"],
            "sha256": record["sha256"],
            "bytes": record["bytes"],
            "error": "",
        }
        return record, item_record

    headers = {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "Accept": "application/pdf,application/octet-stream,*/*",
        "Referer": item["work_url"],
    }
    req = urllib.request.Request(item["download_url"], headers=headers)
    time.sleep(delay)
    if cookie_file:
        dest, error = curl_download(item, stem, cookie_file)
        if not dest:
            failed = {**item, "status": "needs_manual", "error": error}
            return None, failed
        record = source_record_from_path(item, dest)
        item_record = {**item, "status": "downloaded", "local_path": record["local_path"], "sha256": record["sha256"], "bytes": record["bytes"], "error": ""}
        return record, item_record

    try:
        with op.open(req, timeout=45) as resp:
            first = resp.read(8192)
            content_type = resp.headers.get("Content-Type", "")
            if b"<html" in first[:512].lower() or "text/html" in content_type.lower():
                failed = {**item, "status": "needs_manual", "error": f"download returned HTML ({content_type or 'unknown content type'})"}
                return None, failed
            ext = infer_extension(resp.url, dict(resp.headers), first)
            dest = SCAN_DIR / f"{stem}.{ext}"
            counter = 2
            while dest.exists() and item["work_id"] not in dest.name:
                candidate = SCAN_DIR / f"{stem}-{counter}.{ext}"
                if not candidate.exists():
                    dest = candidate
                    break
                counter += 1
            tmp = dest.with_suffix(dest.suffix + ".part")
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tmp.open("wb") as fh:
                fh.write(first)
                while chunk := resp.read(1 << 20):
                    fh.write(chunk)
            tmp.replace(dest)
    except urllib.error.HTTPError as exc:
        failed = {**item, "status": "needs_manual", "error": f"HTTP {exc.code}"}
        return None, failed
    except Exception as exc:  # noqa: BLE001 - record failure and continue
        failed = {**item, "status": "needs_manual", "error": exc.__class__.__name__}
        return None, failed

    record = source_record_from_path(item, dest)
    item_record = {**item, "status": "downloaded", "local_path": record["local_path"], "sha256": record["sha256"], "bytes": record["bytes"], "error": ""}
    return record, item_record


def extract_year(text: str) -> str:
    match = re.search(r"\b(19|20)\d{2}\b", text or "")
    return match.group(0) if match else "not_stated"


def merge_by_source_url(items: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for item in items:
        key = item.get("source_url") or item.get("work_url") or item.get("local_path")
        merged[key] = item
    return [merged[k] for k in sorted(merged)]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="parse profile and update academia_manifest only")
    parser.add_argument("--resolve-details", action="store_true", help="visit individual work pages to find hidden attachment URLs")
    parser.add_argument("--delay", type=float, default=1.5, help="seconds between downloads")
    parser.add_argument("--limit", type=int, default=0, help="download at most N files")
    args = parser.parse_args()

    cookie_env = os.environ.get("ACADEMIA_COOKIE_FILE")
    cookie_file = Path(cookie_env) if cookie_env else None
    if cookie_file and not cookie_file.exists():
        print("ACADEMIA_COOKIE_FILE does not exist", file=sys.stderr)
        return 2

    op = opener(cookie_file)
    source = fetch_text(op, PROFILE_URL)
    initial_counts = parse_expected_counts(source)
    api_html = fetch_api_work_html(op, source, initial_counts.get("total", EXPECTED_TOTAL))
    expected_counts, items = parse_profile(source + "\n".join(api_html))
    if args.resolve_details:
        resolve_detail_download_urls(op, items, min(args.delay, 0.5), cookie_file)

    academia_manifest = read_json(
        ACADEMIA_MANIFEST,
        {"schema_version": 1, "source": PROFILE_URL, "generated_at": today(), "expected_counts": {}, "items": []},
    )
    academia_manifest.update(
        {
            "schema_version": 1,
            "source": PROFILE_URL,
            "source_display": PROFILE_URL_DISPLAY,
            "generated_at": now_iso(),
            "expected_counts": expected_counts,
            "items": items,
        }
    )
    write_json(ACADEMIA_MANIFEST, academia_manifest)

    with_download = sum(1 for item in items if item.get("download_url"))
    print(f"found works: {len(items)}; profile attachment URLs: {with_download}; expected: {expected_counts.get('total', EXPECTED_TOTAL)}")
    if args.dry_run:
        return 0 if len(items) >= expected_counts.get("total", EXPECTED_TOTAL) else 1

    source_manifest = read_json(
        SOURCE_MANIFEST,
        {
            "schema_version": 1,
            "generated_at": today(),
            "policy": "Source files are stored unprocessed. No OCR, PDF text layer, DjVuTXT, hOCR, ABBYY, or derived text is used for corpus generation.",
            "items": [],
        },
    )
    source_items = list(source_manifest.get("items", []))
    existing_urls = {item.get("source_url") for item in source_items}
    failures: list[dict] = []
    downloaded = 0

    for item in items:
        if args.limit and downloaded >= args.limit:
            break
        if item["work_url"] in existing_urls:
            continue
        record, status_item = download_file(op, item, args.delay, cookie_file)
        if record:
            source_items.append(record)
            existing_urls.add(record["source_url"])
            downloaded += 1
            source_manifest["schema_version"] = 1
            source_manifest["generated_at"] = today()
            source_manifest["items"] = merge_by_source_url(source_items)
            write_json(SOURCE_MANIFEST, source_manifest)
            print(f"downloaded {downloaded}: {record['local_path']} ({record['bytes']} bytes)", flush=True)
        else:
            failures.append(status_item)
            write_json(
                MANUAL_QUEUE,
                {"schema_version": 1, "generated_at": now_iso(), "items": failures},
            )

    source_manifest["schema_version"] = 1
    source_manifest["generated_at"] = today()
    source_manifest["items"] = merge_by_source_url(source_items)
    write_json(SOURCE_MANIFEST, source_manifest)

    queue_items = failures + [
        {**item, "status": "needs_manual", "error": "not processed in this limited run"}
        for item in items
        if args.limit and downloaded >= args.limit and item["work_url"] not in existing_urls and item not in failures
    ]
    write_json(
        MANUAL_QUEUE,
        {"schema_version": 1, "generated_at": now_iso(), "items": queue_items},
    )
    print(f"source manifest items: {len(source_manifest['items'])}; manual queue: {len(queue_items)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
