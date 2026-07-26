#!/usr/bin/env python3
"""Convert selected L.S. Vygotsky PsyJournals HTML witness pages to Markdown."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ilyenkov_markdown" / "scripts"))
import ilyenkov_common as common  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
OUTPUT_ROOT = ROOT / "vygotsky_md"
MANIFEST_PATH = ROOT / "metadata" / "psyjournals_manifest.json"
WORKS_MASTER_PATH = ROOT / "metadata" / "works_master.json"
HTML_REVIEW_PATH = ROOT / "metadata" / "html_candidate_review_manifest.json"
USER_AGENT = "Codex local markdown converter (+https://openai.com/)"

ARTICLES = [
    {
        "work_id": "lektsii-po-psikhologii-razvitiya-1928",
        "url": "https://psyjournals.ru/journals/chp/archive/2021_n2/Vygotsky",
        "authors": "Л.С. Выготский",
        "subdir": "kulturno-istoricheskaya-psikhologiya",
        "topics": ["Psychology", "Cultural-Historical Psychology", "Developmental Psychology"],
        "tags": ["vygotsky", "source-text", "text-witness", "developmental-psychology", "cultural-historical-psychology"],
        "source_relation": "Later PsyJournals 2021 archival publication/text witness of 1928 lectures; not marked author_original.",
    },
    {
        "work_id": "istoriya-razvitiya-vysshikh-psikhicheskikh-funktsii-1931",
        "url": "https://psyjournals.ru/journals/pse/archive/1996_n2/Vygotsky",
        "authors": "Л.С. Выготский",
        "subdir": "psikhologicheskaya-nauka-i-obrazovanie",
        "topics": ["Psychology", "Cultural-Historical Psychology"],
        "tags": ["vygotsky", "source-text", "text-witness", "cultural-historical-psychology"],
        "source_relation": "Later PsyJournals 1996 republication/fragment witness; not marked author_original.",
    },
    {
        "work_id": "razvitie-zhiteiskikh-i-nauchnykh-ponyatii-v-shkolnom-vozraste-1933",
        "url": "https://psyjournals.ru/journals/pse/archive/1996_n1/Vygotsky",
        "authors": "Л.С. Выготский",
        "subdir": "psikhologicheskaya-nauka-i-obrazovanie",
        "topics": ["Psychology", "Cultural-Historical Psychology", "Education"],
        "tags": ["vygotsky", "source-text", "text-witness", "concept-formation", "cultural-historical-psychology"],
        "source_relation": "Later PsyJournals 1996 republication of a 1933 lecture/text witness; not marked author_original.",
    },
    {
        "work_id": "problema-obucheniya-i-umstvennogo-razvitiya-v-shkolnom-vozraste-1934",
        "url": "https://psyjournals.ru/journals/pse/archive/1996_n4/Vygotsky",
        "authors": "Л.С. Выготский",
        "subdir": "psikhologicheskaya-nauka-i-obrazovanie",
        "topics": ["Psychology", "Cultural-Historical Psychology", "Education"],
        "tags": ["vygotsky", "source-text", "text-witness", "learning", "mental-development", "cultural-historical-psychology"],
        "source_relation": "Later PsyJournals 1996 republication/text witness of a 1934 article; not marked author_original.",
    },
]


def now_date() -> str:
    return dt.date.today().isoformat()


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def fetch_text(url: str, *, timeout: int = 30) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        raw = response.read()
    time.sleep(0.2)
    return raw.decode("utf-8")


def strip_noise(source: str) -> str:
    source = re.sub(r"<script\b.*?</script>", "", source, flags=re.I | re.S)
    source = re.sub(r"<style\b.*?</style>", "", source, flags=re.I | re.S)
    source = re.sub(r"<button\b.*?</button>", "", source, flags=re.I | re.S)
    source = re.sub(r"<svg\b.*?</svg>", "", source, flags=re.I | re.S)
    return source


def compact(text: str) -> str:
    text = html.unescape(text).replace("\xa0", " ").replace("\u200b", "")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def plain(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return compact(fragment)


def section(source: str, label: str) -> str:
    match = re.search(rf"<section\b[^>]*aria-labelledby=[\"']{re.escape(label)}[\"'][^>]*>(.*?)</section>", source, flags=re.I | re.S)
    return match.group(1) if match else ""


def first_text(source: str, pattern: str) -> str:
    match = re.search(pattern, source, flags=re.I | re.S)
    return plain(match.group(1)) if match else ""


def meta_content(source: str, name: str) -> str:
    match = re.search(rf"<meta\b[^>]*name=[\"']{re.escape(name)}[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>", source, flags=re.I | re.S)
    return html.unescape(match.group(1)).strip() if match else ""


def absolute_url(url: str) -> str:
    if url.startswith(("http://", "https://")):
        return url
    if url.startswith("/"):
        return "https://psyjournals.ru" + url
    return url


def inline_markdown(fragment: str) -> str:
    fragment = strip_noise(fragment)
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)

    def footnote_ref(match: re.Match[str]) -> str:
        label = inline_markdown(match.group(4))
        number = match.group(2)
        if re.fullmatch(r"\[?\d+\]?", label):
            return f"[^{number}]"
        return f"{label}[^{number}]"

    fragment = re.sub(
        r"<a\b([^>]*)href=[\"']#_ftn(\d+)[\"']([^>]*)>(.*?)</a>",
        footnote_ref,
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(r"</?em\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?i\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?strong\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"</?b\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"<sup\b[^>]*>(.*?)</sup>", lambda m: "^" + inline_markdown(m.group(1)), fragment, flags=re.I | re.S)

    def link(match: re.Match[str]) -> str:
        attrs, body = match.groups()
        text = inline_markdown(body)
        href_match = re.search(r"href=[\"']([^\"']+)[\"']", attrs, flags=re.I)
        if not href_match or not text:
            return text
        href = href_match.group(1)
        if href.startswith("#") or href.startswith("/keywords/") or href.startswith("/authors/") or href.startswith("/journals/"):
            return text
        return f"[{text}]({absolute_url(href)})"

    fragment = re.sub(r"<a\b([^>]*)>(.*?)</a>", link, fragment, flags=re.I | re.S)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    text = compact(fragment)
    return re.sub(r"\s*\n\s*", " ", text).strip()


def iter_elements(fragment: str):
    token = re.compile(r"<(h[1-6]|p|li)\b([^>]*)>", flags=re.I)
    matches = list(token.finditer(fragment))
    for index, match in enumerate(matches):
        tag = match.group(1).lower()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(fragment)
        inner = fragment[start:end]
        close = re.search(rf"</{tag}>", inner, flags=re.I)
        if close:
            inner = inner[: close.start()]
        yield tag, inner


def render_body(fragment: str) -> tuple[list[str], list[str]]:
    lines: list[str] = []
    notes: list[str] = []
    for tag, inner in iter_elements(fragment):
        footnote = re.search(r"<a\b[^>]*name=[\"']_ftn(\d+)[\"'][^>]*>(.*?)</a>(.*)", inner, flags=re.I | re.S)
        if footnote:
            number, marker, tail = footnote.groups()
            body = compact(f"{inline_markdown(marker)} {inline_markdown(tail)}")
            notes.append(f"[^{number}]: {body}")
            continue
        text = inline_markdown(inner)
        if not text:
            continue
        if tag.startswith("h"):
            level = min(int(tag[1]), 6)
            lines.append(f"{'#' * level} {text}")
        elif tag == "li":
            lines.append(f"- {text}")
        else:
            lines.append(text)
    return lines, notes


def yaml_value(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def yaml_list(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def article_metadata(source: str, config: dict) -> dict[str, str]:
    clean = strip_noise(source)
    title = first_text(clean, r"<h1\b[^>]*>(.*?)</h1>")
    doi = first_text(clean, r"<strong>\s*DOI:\s*</strong>\s*<a\b[^>]*>(.*?)</a>")
    year = meta_content(clean, "citation_publication_date")
    journal = meta_content(clean, "citation_journal_title")
    volume = meta_content(clean, "citation_volume")
    issue = meta_content(clean, "citation_issue")
    first_page = meta_content(clean, "citation_firstpage")
    last_page = meta_content(clean, "citation_lastpage")
    pages = f"{first_page}–{last_page}" if first_page and last_page else first_page or last_page
    citation = ""
    if year and journal and volume and issue and pages:
        citation = f"Выготский, Л.С. ({year}). {title}. {journal}, {volume}({issue}), {pages}. URL: {config['url']}"
    published = first_text(clean, r"Опубликована\s*(?:<time\b[^>]*>)?([^<]+)") or year
    return {
        "title": title,
        "author": config["authors"],
        "doi": doi,
        "published_in": citation,
        "published_date": published,
        "language": "ru",
    }


def output_path(config: dict, title: str) -> Path:
    slug = common.slugify(title)
    return OUTPUT_ROOT / config["subdir"] / f"{config['subdir']}-{slug}.md"


def markdown_for(source: str, config: dict) -> tuple[str, dict[str, str]]:
    meta = article_metadata(source, config)
    title = meta["title"]
    abstract = section(source, "abstract")
    fulltext = section(source, "fulltext")
    full_lines, notes = render_body(first_text(fulltext, r"<div\b[^>]*itemprop=[\"']articleBody[\"'][^>]*>(.*?)</div>") or fulltext)
    if not full_lines:
        full_lines, notes = render_body(fulltext)
    abstract_text = first_text(abstract, r"<div\b[^>]*itemprop=[\"']abstract[\"'][^>]*>(.*?)</div>") or plain(abstract)

    lines = [
        "---",
        f"title: {yaml_value(title)}",
        f"author: {yaml_value(meta['author'])}",
        f"created: {yaml_value(now_date())}",
        'type: "source"',
        f"tags: {yaml_list(config['tags'])}",
        f"language: {yaml_value(meta['language'])}",
        f"topics: {yaml_list(config['topics'])}",
        'places: ["Russia"]',
        'collection: "vygotsky-original-language"',
        'llm_wiki_eligible: "true"',
        'gbrain_source: "project-markdown"',
        'text_role: "text_witness"',
        'core_corpus_eligible: "false"',
        'source_format: "html"',
        'transcription_mode: "agent_canonical_markdown"',
        'source_license: "CC-BY-NC-4.0"',
        'redistribution_approved: "false"',
        'rights_review_status: "unreviewed"',
        'text_status: "html_conversion_unverified"',
        f"source_url: {yaml_value(config['url'])}",
        f"source_relation: {yaml_value(config['source_relation'])}",
    ]
    if meta["doi"]:
        lines.append(f"doi: {yaml_value(meta['doi'])}")
    if meta["published_in"]:
        lines.append(f"published_in: {yaml_value(meta['published_in'])}")
    lines.extend(["---", "", f"# {title}", "", f"**{meta['author']}**"])
    if meta["published_in"]:
        lines.extend(["", meta["published_in"]])
    if meta["doi"]:
        lines.extend(["", f"DOI: <{meta['doi']}>"])
    lines.extend([
        "",
        f"Источник: <{config['url']}>",
        "",
        "Лицензия источника: CC BY-NC 4.0.",
        "",
        f"Версионная заметка: {config['source_relation']}",
    ])
    if abstract_text:
        lines.extend(["", "## Резюме", "", abstract_text])
    if full_lines:
        for block in full_lines:
            lines.extend(["", block])
    if notes:
        lines.extend(["", "## Примечания", "", *notes])
    return "\n".join(lines).strip() + "\n", meta


def update_works_master(config: dict, meta: dict[str, str], markdown_path: Path) -> None:
    data = json.loads(WORKS_MASTER_PATH.read_text(encoding="utf-8"))
    rel_path = markdown_path.relative_to(REPO_ROOT).as_posix()
    for work in data["works"]:
        if work.get("id") != config["work_id"]:
            continue
        urls = work.setdefault("source_urls", [])
        if config["url"] not in urls:
            urls.append(config["url"])
        work["collection_status"] = "markdown_text_witness"
        work["markdown_path"] = rel_path
        work["text_role"] = "text_witness"
        work["text_status"] = "html_conversion_unverified"
        work["source_license"] = "CC-BY-NC-4.0"
        work["llm_wiki_eligible"] = "true"
        work["core_corpus_eligible"] = "false"
        work["source_relation"] = config["source_relation"]
        work["published_in"] = meta["published_in"]
        break
    values = data.setdefault("collection_status_values", [])
    if "markdown_text_witness" not in values:
        values.append("markdown_text_witness")
        values.sort()
    WORKS_MASTER_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_html_review(config: dict, markdown_path: Path) -> None:
    if not HTML_REVIEW_PATH.exists():
        return
    data = json.loads(HTML_REVIEW_PATH.read_text(encoding="utf-8"))
    rel_path = markdown_path.relative_to(REPO_ROOT).as_posix()
    for record in data.get("records", []):
        if record.get("work_id") == config["work_id"]:
            record["review_status"] = "converted_to_markdown_text_witness"
            record["markdown_path"] = rel_path
            record["recommended_next_action"] = "post_conversion_review"
            break
    summary = data.setdefault("summary", {})
    summary["markdown_created"] = sum(1 for record in data.get("records", []) if record.get("review_status") == "converted_to_markdown_text_witness")
    HTML_REVIEW_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def convert(force: bool = False, only: str | None = None) -> int:
    manifest = {
        "source": "https://psyjournals.ru/authors/1035",
        "generated_at": now_iso(),
        "policy": "Converted only from genuine PsyJournals HTML full-text sections; no PDF text layer or OCR was used.",
        "items": [],
    }
    failures = 0
    for config in ARTICLES:
        if only and only not in config["url"] and only != config["work_id"]:
            continue
        try:
            source = fetch_text(config["url"])
            if not section(source, "fulltext"):
                raise ValueError("PsyJournals page has no fulltext section")
            markdown, meta = markdown_for(source, config)
            path = output_path(config, meta["title"])
            status = "existing" if path.exists() and not force else "converted"
            if status == "converted":
                path.parent.mkdir(parents=True, exist_ok=True)
                tmp = path.with_suffix(path.suffix + ".tmp")
                tmp.write_text(markdown, encoding="utf-8")
                os.replace(tmp, path)
            update_works_master(config, meta, path)
            update_html_review(config, path)
            manifest["items"].append({
                "work_id": config["work_id"],
                "title": meta["title"],
                "authors": meta["author"],
                "url": config["url"],
                "doi": meta["doi"],
                "published_in": meta["published_in"],
                "markdown_path": path.relative_to(ROOT).as_posix(),
                "status": status,
                "text_role": "text_witness",
                "text_status": "html_conversion_unverified",
                "source_license": "CC-BY-NC-4.0",
                "core_corpus_eligible": "false",
                "llm_wiki_eligible": "true",
            })
            print(f"{status}: {path.relative_to(ROOT)}")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            manifest["items"].append({
                "url": config["url"],
                "status": "failed",
                "error": str(exc),
            })
            print(f"failed: {config['url']}: {exc}", file=sys.stderr)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert selected Vygotsky PsyJournals HTML witnesses to Markdown.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing generated files")
    parser.add_argument("--only", help="Convert only URLs or work ids containing this value")
    args = parser.parse_args()
    return convert(force=args.force, only=args.only)


if __name__ == "__main__":
    raise SystemExit(main())
