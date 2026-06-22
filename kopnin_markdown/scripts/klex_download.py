#!/usr/bin/env python3
"""Resolve Klex book pages to their phantastike download links, fetch the scan,
and register it in kopnin_markdown/metadata/source_scans_manifest.json.

Private-archive tooling: downloads are stored UNPROCESSED. No OCR, no text-layer
extraction, never published (redistribution_approved stays false). See
notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md and notes/KOPNIN_SOURCE_SURVEY.md.

Klex covers the core Russian Kopnin works that platona.net (Cloudflare-blocked),
twirpx (gated) and koob (gated) gate or hide.
"""

from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import re
import subprocess
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]                      # kopnin_markdown/
MANIFEST = ROOT / "metadata/source_scans_manifest.json"
SCAN_DIR = ROOT / "source_scans/klex"
AUTHOR_PAGE = "https://www.klex.ru/author/kopnin_p_v/"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# Curated targets. Each: klex page id, local filename stem, metadata. Order = priority.
TARGETS = [
    {"klex": "26xy", "stem": "dialektika-logika-nauka-izbrannye-trudy-tom-2-1973",
     "title": "Диалектика, логика, наука", "year": "1973",
     "edition": "Москва: Наука, 1973, 463 с.; Избранные труды, том 2 (29 статей)"},
    {"klex": "26xx", "stem": "dialektika-kak-logika-i-teoriya-poznaniya-1973",
     "title": "Диалектика как логика и теория познания. Опыт логико-гносеологического исследования",
     "year": "1973", "edition": "Москва: Наука, 1973 (монография)"},
    {"klex": "26y1", "stem": "filosofskie-idei-lenina-i-logika-1969",
     "title": "Философские идеи В.И. Ленина и логика", "year": "1969",
     "edition": "Москва: Наука, 1969, 484 с."},
    {"klex": "26xz", "stem": "gnoseologicheskie-i-logicheskie-osnovy-nauki-1974",
     "title": "Гносеологические и логические основы науки", "year": "1974",
     "edition": "Москва: Мысль, 1974, 568 с. (вкл. «Введение в марксистскую гносеологию» и «Логические основы науки»)"},
    {"klex": "26xw", "stem": "gipoteza-i-ee-rol-v-poznanii-1958",
     "title": "Гипотеза и ее роль в познании", "year": "1958",
     "edition": "Москва, 1958 (брошюра); издание скана не верифицировано"},
]

AUTHOR = "Копнин Павел Васильевич"


class NoScan(Exception):
    """Raised when a Klex page offers only a text bundle (zip/doc), not a scan."""


def opener() -> urllib.request.OpenerDirector:
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    op.addheaders = [("User-Agent", UA), ("Accept-Language", "ru,en;q=0.9")]
    return op


def retry(fn, attempts: int = 4, backoff: float = 3.0):
    """Retry transient network failures (Klex/phantastike occasionally drop the connection)."""
    for attempt in range(attempts):
        try:
            return fn()
        except (urllib.error.URLError, http.client.HTTPException, ConnectionError, OSError) as exc:
            if attempt == attempts - 1:
                raise
            print(f"   transient error ({exc.__class__.__name__}: {exc}); retry {attempt + 1}/{attempts - 1}")
            time.sleep(backoff * (attempt + 1))


def resolve_download(op, klex_id: str) -> tuple[str, str]:
    """Return (download_url, fmt) for a Klex book id, preferring djvu then pdf."""
    page_url = f"https://www.klex.ru/{klex_id}"
    op.addheaders = [("User-Agent", UA), ("Accept-Language", "ru,en;q=0.9"), ("Referer", AUTHOR_PAGE)]
    html = retry(lambda: op.open(page_url, timeout=60).read()).decode("cp1251", "replace")
    links = re.findall(r"href='([^']+)'", html) + re.findall(r'href="([^"]+)"', html)
    cands = [h for h in dict.fromkeys(links) if "phantastike.com" in h and "/view/" not in h]
    for fmt in ("djvu", "djv", "pdf"):
        for h in cands:
            if f"/{fmt}/" in h or h.rstrip("/").endswith(fmt):
                return h, fmt
    raise NoScan(f"only non-scan formats on {page_url} (candidates={cands})")


def download(op, url: str, dest: Path, referer: str) -> None:
    op.addheaders = [("User-Agent", UA), ("Accept-Language", "ru,en;q=0.9"), ("Referer", referer)]
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")

    def _stream():
        with op.open(url, timeout=180) as resp, tmp.open("wb") as fh:
            while chunk := resp.read(1 << 20):
                fh.write(chunk)

    retry(_stream)
    tmp.replace(dest)


def sha256(path: Path) -> str:
    d = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            d.update(chunk)
    return d.hexdigest()


def djvu_pages(path: Path) -> int:
    """Count FORM:DJVU components by walking the IFF chunk tree (no external tools)."""
    data = path.read_bytes()
    if data[:4] != b"AT&T":
        return 0
    if data[4:8] != b"FORM":
        return 0
    size = int.from_bytes(data[8:12], "big")
    sec = data[12:12 + size]
    if sec[:4] != b"DJVM":
        return 1 if sec[:4] == b"DJVU" else 0
    p, pages = 4, 0
    while p + 8 <= len(sec):
        cid = sec[p:p + 4]
        clen = int.from_bytes(sec[p + 4:p + 8], "big")
        if cid == b"FORM" and sec[p + 8:p + 12] == b"DJVU":
            pages += 1
        p += 8 + clen + (clen & 1)
    return pages


def pdf_pages(path: Path) -> int:
    out = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True)
    m = re.search(r"^Pages:\s+(\d+)", out.stdout, re.M)
    return int(m.group(1)) if m else 0


def page_count(path: Path, fmt: str) -> int:
    if fmt in ("djvu", "djv"):
        return djvu_pages(path)
    if fmt == "pdf":
        return pdf_pages(path)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="restrict to these klex ids")
    ap.add_argument("--delay", type=float, default=4.0, help="seconds between downloads")
    args = ap.parse_args()
    op = opener()
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_path = {item["local_path"]: item for item in data["items"]}
    targets = [t for t in TARGETS if not args.only or t["klex"] in args.only]
    skipped: list[str] = []
    for i, t in enumerate(targets):
        if i:
            time.sleep(args.delay)
        try:
            url, fmt = resolve_download(op, t["klex"])
        except NoScan as exc:
            skipped.append(f"{t['klex']} {t['title']}: {exc}")
            print(f"[{t['klex']}] SKIP (no scan): {t['title']}")
            continue
        local_rel = f"source_scans/klex/{t['stem']}.{fmt}"
        dest = ROOT / local_rel
        if dest.exists() and dest.stat().st_size > 0:
            print(f"[{t['klex']}] {fmt} already on disk, registering")
        else:
            print(f"[{t['klex']}] {fmt} <- {url}")
            download(op, url, dest, f"https://www.klex.ru/{t['klex']}")
        size, digest, pages = dest.stat().st_size, sha256(dest), page_count(dest, fmt)
        by_path[local_rel] = {
            "title": t["title"], "author": AUTHOR, "publication_year": t["year"],
            "edition": t["edition"], "source_url": f"https://www.klex.ru/{t['klex']}",
            "download_url": url, "download_date": time.strftime("%Y-%m-%d"),
            "local_path": local_rel, "pages": pages, "bytes": size, "sha256": digest,
            "source_format": fmt, "source_license": "not_stated",
            "redistribution_approved": "false", "rights_review_status": "unreviewed",
            "text_role": "source_scan_unprocessed", "text_status": "source_scan_unprocessed",
            "core_corpus_eligible": "false", "llm_wiki_eligible": "false",
        }
        data["items"] = [by_path[k] for k in sorted(by_path)]
        data["generated_at"] = time.strftime("%Y-%m-%d")
        MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"   saved {size} bytes, {pages} pages, sha256 {digest[:16]}…")
    print(f"manifest items: {len(data['items'])}")
    if skipped:
        print(f"skipped (no scan): {len(skipped)}")
        for s in skipped:
            print("  -", s)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
