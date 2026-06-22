#!/usr/bin/env python3
"""Resolve Klex book pages to their phantastike download links, fetch the scan,
and register it in oizerman_markdown/metadata/source_scans_manifest.json.

Private-archive tooling: downloads are stored UNPROCESSED. No OCR, no text-layer
extraction, never published (redistribution_approved stays false). See
notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md and notes/OIZERMAN_SOURCE_SURVEY.md.
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

ROOT = Path(__file__).resolve().parents[1]                      # oizerman_markdown/
MANIFEST = ROOT / "metadata/source_scans_manifest.json"
SCAN_DIR = ROOT / "source_scans/klex"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# Curated targets. Each: klex page id, local filename stem, metadata. Order = priority.
TARGETS = [
    {"klex": "ts6", "stem": "izbrannye-trudy-tom-01-vozniknovenie-marksizma-2014",
     "title": "Избранные труды. В пяти томах. Том 1. Возникновение марксизма",
     "year": "2014", "edition": "Москва: Наука; Избранные труды, Том 1"},
    {"klex": "ts7", "stem": "izbrannye-trudy-tom-02-marksizm-i-utopizm-2014",
     "title": "Избранные труды. В пяти томах. Том 2. Марксизм и утопизм",
     "year": "2014", "edition": "Москва: Наука; Избранные труды, Том 2"},
    {"klex": "ts8", "stem": "izbrannye-trudy-tom-03-opravdanie-revizionizma-2014",
     "title": "Избранные труды. В пяти томах. Том 3. Оправдание ревизионизма",
     "year": "2014", "edition": "Москва: Наука; Избранные труды, Том 3"},
    {"klex": "ts9", "stem": "izbrannye-trudy-tom-04-kant-i-gegel-2014",
     "title": "Избранные труды. В пяти томах. Том 4. Кант и Гегель: Опыт сравнительного исследования",
     "year": "2014", "edition": "Москва: Наука; Избранные труды, Том 4"},
    {"klex": "tsa", "stem": "izbrannye-trudy-tom-05-metafilosofiya-ambivalentnost-filosofii-2014",
     "title": "Избранные труды. В пяти томах. Том 5. Метафилософия. Амбивалентность философии",
     "year": "2014", "edition": "Москва: Наука; Избранные труды, Том 5"},
    # Batch 2: core individual works not contained in the 5-volume set.
    {"klex": "tsf", "stem": "problemy-istoriko-filosofskoy-nauki",
     "title": "Проблемы историко-философской науки", "year": "not_stated",
     "edition": "1969 (1-е изд.) / 1982 (2-е изд.); издание скана не верифицировано"},
    {"klex": "hat", "stem": "glavnye-filosofskie-napravleniya",
     "title": "Главные философские направления", "year": "not_stated",
     "edition": "1971 (1-е изд.) / 1984 (2-е изд.); издание скана не верифицировано"},
    {"klex": "7gp", "stem": "filosofiya-kak-istoriya-filosofii-1999",
     "title": "Философия как история философии", "year": "1999", "edition": "1999"},
    {"klex": "tsc", "stem": "dialekticheskiy-materializm-i-istoriya-filosofii",
     "title": "Диалектический материализм и история философии", "year": "not_stated",
     "edition": "издание скана не верифицировано"},
    {"klex": "tsg", "stem": "razvitie-marksistskoy-teorii-na-opyte-revolyutsii-1848",
     "title": "Развитие марксистской теории на опыте революции 1848 года", "year": "not_stated",
     "edition": "издание скана не верифицировано"},
    {"klex": "llm", "stem": "teoriya-poznaniya-kanta-narsky-oizerman",
     "title": "Теория познания Канта", "year": "not_stated",
     "edition": "соавт. И. С. Нарский; издание скана не верифицировано"},
    {"klex": "hb0", "stem": "istoriya-dialektiki-nemetskaya-klassicheskaya-filosofiya",
     "title": "История диалектики. Немецкая классическая философия", "year": "not_stated",
     "edition": "коллективный труд, отв. ред./editor; издание скана не верифицировано"},
    {"klex": "1bjn", "stem": "istoriko-filosofskoe-uchenie-gegelya",
     "title": "Историко-философское учение Гегеля", "year": "not_stated",
     "edition": "издание скана не верифицировано"},
    {"klex": "haw", "stem": "filosofiya-kanta-i-sovremennost",
     "title": "Философия Канта и современность", "year": "not_stated",
     "edition": "под ред. Т. И. Ойзермана (сборник); издание скана не верифицировано"},
    # Batch 3: remaining priority list + author-page works (excludes standalone
    # duplicates of the 5-volume set). Many are Soviet-era; responsibility (author
    # vs editor) for collective volumes carried in works_master.json, not asserted here.
    {"klex": "tsi", "stem": "kratkiy-ocherk-istorii-filosofii",
     "title": "Краткий очерк истории философии", "year": "not_stated",
     "edition": "коллективный труд; ответственность и издание скана требуют проверки"},
    {"klex": "tsh", "stem": "filosofiya-epokhi-rannikh-burzhuaznykh-revolyutsiy",
     "title": "Философия эпохи ранних буржуазных революций", "year": "not_stated",
     "edition": "издание скана не верифицировано"},
    {"klex": "2mmt", "stem": "filosofiya-i-kanta",
     "title": "Философия И. Канта", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "26xv", "stem": "osnovnye-stupeni-protsessa-poznaniya",
     "title": "Основные ступени процесса познания", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "26xu", "stem": "filosofiya-gegelya",
     "title": "Философия Гегеля", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "1bjo", "stem": "krizis-sovremennogo-idealizma",
     "title": "Кризис современного идеализма", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "1bjl", "stem": "protiv-filosofstvuyushchikh-oruzhenostsev",
     "title": "Против философствующих оруженосцев американо-английского империализма", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "1big", "stem": "marks-i-sovremennaya-filosofiya",
     "title": "Маркс и современная философия", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "17v9", "stem": "sovremennyy-ekzistentsializm",
     "title": "Современный экзистенциализм. Критические очерки", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "tsj", "stem": "dialekticheskiy-materializm-i-sovremennyy-pozitivizm",
     "title": "Диалектический материализм и современный позитивизм", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "tse", "stem": "problemy-marksistsko-leninskoy-metodologii-istorii-filosofii",
     "title": "Проблемы марксистско-ленинской методологии истории философии", "year": "not_stated",
     "edition": "коллективный труд; ответственность требует проверки"},
    {"klex": "tsd", "stem": "istoriya-dialektiki-14-18-vv",
     "title": "История диалектики XIV-XVIII вв.", "year": "not_stated",
     "edition": "коллективный труд; ответственность требует проверки"},
    {"klex": "tsb", "stem": "nemetskaya-filosofiya-posle-1945",
     "title": "Немецкая философия после 1945 года", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "haz", "stem": "frantsuzskoe-prosveshchenie-i-revolyutsiya",
     "title": "Французское Просвещение и революция", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "hau", "stem": "filosofiya-marksizma-i-neopozitivizm",
     "title": "Философия марксизма и неопозитивизм", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "har", "stem": "karl-marks-osnovopolozhnik-dialekticheskogo-i-istoricheskogo-materializma",
     "title": "Карл Маркс - основоположник диалектического и исторического материализма", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "haq", "stem": "problema-otchuzhdeniya-i-burzhuaznaya-legenda-o-marksizme",
     "title": "Проблема отчуждения и буржуазная легенда о марксизме", "year": "not_stated", "edition": "издание скана не верифицировано"},
    {"klex": "han", "stem": "nemetskaya-klassicheskaya-filosofiya-odin-iz-istochnikov-marksizma",
     "title": "Немецкая классическая философия - один из теоретических источников марксизма", "year": "not_stated", "edition": "издание скана не верифицировано"},
]

AUTHOR = "Ойзерман Теодор Ильич"


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
    """Return (download_url, fmt) for a Klex book id, preferring djvu then pdf then zip."""
    page_url = f"https://www.klex.ru/{klex_id}"
    op.addheaders = [("User-Agent", UA), ("Accept-Language", "ru,en;q=0.9"),
                     ("Referer", "https://www.klex.ru/author/ojzerman/")]
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
    pos, pages = 4, 0
    # top-level FORM
    if data[pos:pos + 4] != b"FORM":
        return 0
    size = int.from_bytes(data[pos + 4:pos + 8], "big")
    sec = data[pos + 8:pos + 8 + size]
    if sec[:4] != b"DJVM":   # single-page DJVU
        return 1 if sec[:4] == b"DJVU" else 0
    p = 4
    while p + 8 <= len(sec):
        cid = sec[p:p + 4]
        clen = int.from_bytes(sec[p + 4:p + 8], "big")
        body = sec[p + 8:p + 8 + clen]
        if cid == b"FORM" and body[:4] == b"DJVU":
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


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def save_manifest(data: dict) -> None:
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="restrict to these klex ids")
    ap.add_argument("--delay", type=float, default=4.0, help="seconds between downloads")
    args = ap.parse_args()
    op = opener()
    data = load_manifest()
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
        entry = {
            "title": t["title"], "author": AUTHOR, "publication_year": t["year"],
            "edition": t["edition"], "source_url": f"https://www.klex.ru/{t['klex']}",
            "download_url": url, "download_date": time.strftime("%Y-%m-%d"),
            "local_path": local_rel, "pages": pages, "bytes": size, "sha256": digest,
            "source_format": fmt, "source_license": "not_stated",
            "redistribution_approved": "false", "rights_review_status": "unreviewed",
            "text_role": "source_scan_unprocessed", "text_status": "source_scan_unprocessed",
            "core_corpus_eligible": "false", "llm_wiki_eligible": "false",
        }
        by_path[local_rel] = entry
        # Incremental save so a later transient crash never loses registered downloads.
        data["items"] = [by_path[k] for k in sorted(by_path)]
        data["generated_at"] = time.strftime("%Y-%m-%d")
        save_manifest(data)
        print(f"   saved {size} bytes, {pages} pages, sha256 {digest[:16]}…")
    print(f"manifest items: {len(data['items'])}")
    if skipped:
        print(f"skipped (no scan available): {len(skipped)}")
        for s in skipped:
            print("  -", s)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
