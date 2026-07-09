#!/usr/bin/env python3
"""Convert A.D. Maidansky PsyJournals HTML article pages to corpus Markdown."""

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
OUTPUT_ROOT = ROOT / "maidansky_md"
MANIFEST_PATH = ROOT / "metadata" / "psyjournals_manifest.json"
USER_AGENT = "Codex local markdown converter (+https://openai.com/)"

ARTICLES = [
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2026_n1/review",
        "authors": "А.Д. Майданский",
        "topics": ["Psychology", "Vygotsky Studies"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "review"],
        "subdir": "retsenzii",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2026_n1/Maidansky",
        "authors": "А.Д. Майданский",
        "topics": ["Psychology", "Vygotsky Studies"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "cultural-historical-psychology"],
        "subdir": "kulturno-istoricheskaya-psihologiya",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2025_n3/Maidansky_Rubtsov",
        "authors": "А.Д. Майданский, В.В. Рубцов",
        "topics": ["Psychology", "Cultural-Historical Psychology"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "cultural-historical-psychology"],
        "subdir": "kulturno-istoricheskaya-psihologiya",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2024_n3/Maidansky",
        "authors": "А.Д. Майданский",
        "topics": ["Psychology", "Cultural-Historical Psychology"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "cultural-historical-psychology"],
        "subdir": "kulturno-istoricheskaya-psihologiya",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2024_n3/Rubtsov_et_al",
        "authors": "В.В. Рубцов, В.К. Зарецкий, А.Д. Майданский",
        "topics": ["Psychology", "Cultural-Historical Psychology"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "cultural-historical-psychology"],
        "subdir": "kulturno-istoricheskaya-psihologiya",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2024_n1/Maidansky",
        "authors": "А.Д. Майданский",
        "topics": ["Philosophy", "Psychology", "Marxism"],
        "tags": ["maidansky", "research", "secondary-source", "ilyenkov", "freedom", "will", "cultural-historical-psychology"],
        "subdir": "istoriya-filosofii",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2023_n3/Maidansky",
        "authors": "А.Д. Майданский",
        "topics": ["Psychology", "Vygotsky Studies", "Marxism"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "labor", "cultural-historical-psychology"],
        "subdir": "kulturno-istoricheskaya-psihologiya",
    },
    {
        "url": "https://psyjournals.ru/journals/cpp/archive/2021_n4/Ilyenkov_Maydansky",
        "authors": "Э.В. Ильенков, А.Д. Майданский",
        "topics": ["Psychology", "Ilyenkov Studies"],
        "tags": ["maidansky", "research", "secondary-source", "ilyenkov", "meshcheryakov"],
        "subdir": "istoriya-filosofii",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2021_n3/foreword_publication",
        "authors": "В.Т. Кудрявцев, А.Д. Майданский",
        "topics": ["Psychology", "Vygotsky Studies"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "foreword"],
        "subdir": "kulturno-istoricheskaya-psihologiya",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2021_n2/Maidansky",
        "authors": "А.Д. Майданский",
        "topics": ["Psychology", "Vygotsky Studies"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "cultural-historical-psychology"],
        "subdir": "kulturno-istoricheskaya-psihologiya",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2021_n1/Maidansky",
        "authors": "А.Д. Майданский",
        "topics": ["Philosophy", "Psychology", "Marxism"],
        "tags": ["maidansky", "research", "secondary-source", "ilyenkov", "mikhailov", "materialism"],
        "subdir": "istoriya-filosofii",
    },
    {
        "url": "https://psyjournals.ru/journals/cpse/archive/2020_n4/Maydanskiy",
        "authors": "А.Д. Майданский",
        "topics": ["Psychology", "Defectology", "Cultural-Historical Psychology"],
        "tags": ["maidansky", "research", "secondary-source", "meshcheryakov", "deafblind", "cultural-historical-psychology"],
        "subdir": "kulturno-istoricheskaya-psihologiya",
    },
    {
        "url": "https://psyjournals.ru/journals/chp/archive/2018_n1/Maidansky",
        "authors": "А.Д. Майданский",
        "topics": ["Psychology", "Spinoza Studies", "Marxism"],
        "tags": ["maidansky", "research", "secondary-source", "vygotsky", "spinoza", "marx"],
        "subdir": "istoriya-filosofii",
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
    source = re.sub(r"<i\b[^>]*class=[\"'][^\"']*fa-[^\"']*[\"'][^>]*></i>", "", source, flags=re.I | re.S)
    return source


def compact(text: str) -> str:
    text = html.unescape(text).replace("\xa0", " ")
    text = text.replace("\u200b", "")
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


def absolute_url(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return "https://psyjournals.ru" + url
    return url


def inline_markdown(fragment: str) -> str:
    fragment = strip_noise(fragment)
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(
        r"<a\b([^>]*)href=[\"']#_ftn(\d+)[\"']([^>]*)>(.*?)</a>",
        lambda m: f"{inline_markdown(m.group(4))}[^{m.group(2)}]",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(r"</?em\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?i\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?strong\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"</?b\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"<sup\b[^>]*>(.*?)</sup>", lambda m: "^" + inline_markdown(m.group(1)), fragment, flags=re.I | re.S)
    fragment = re.sub(r"<sub\b[^>]*>(.*?)</sub>", lambda m: "_" + inline_markdown(m.group(1)), fragment, flags=re.I | re.S)

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
    text = re.sub(r"\s*\n\s*", " ", text)
    return text.strip()


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
            level = min(int(tag[1]) + 1, 6)
            lines.append(f"{'#' * level} {text}")
        elif tag == "li":
            lines.append(f"- {text}")
        elif re.fullmatch(r"[IVXLCDM]+", text):
            lines.append(f"## {text}")
        else:
            lines.append(text)
    return lines, notes


def render_list(fragment: str) -> list[str]:
    items = []
    for index, item in enumerate(re.findall(r"<li\b[^>]*>(.*?)</li>", fragment, flags=re.I | re.S), start=1):
        text = inline_markdown(item)
        if text:
            items.append(f"{index}. {text}")
    return items


def yaml_value(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def yaml_list(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def article_metadata(source: str, config: dict) -> dict[str, str]:
    clean = strip_noise(source)
    title = first_text(clean, r"<h1\b[^>]*>(.*?)</h1>")
    doi = first_text(clean, r"<strong>\s*DOI:\s*</strong>\s*<a\b[^>]*>(.*?)</a>")
    if not doi:
        doi = first_text(clean, r"doi:([0-9.]+/[A-Za-z0-9._-]+)")
        doi = f"https://doi.org/{doi}" if doi else ""
    journal = first_text(clean, r"<article\b[^>]*>\s*<div\b[^>]*>\s*([^<]+)\s*<br>\s*([^<]+)")
    if not journal:
        journal_name = first_text(clean, r"<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']")
        journal = journal_name.split("//")[-1].strip() if journal_name else ""
    citation = first_text(clean, r"<b>\s*Для цитаты:\s*</b>\s*<span>(.*?)</span>")
    published = first_text(clean, r"<strong>\s*Опубликована\s*</strong>\s*(?:<time\b[^>]*>)?([^<]+)")
    language = "en" if "/en/" in config["url"] else "ru"
    return {
        "title": title,
        "author": config["authors"],
        "doi": doi,
        "published_in": citation or journal,
        "published_date": published,
        "language": language,
    }


def output_path(config: dict, title: str) -> Path:
    slug = common.slugify(title)
    return OUTPUT_ROOT / config["subdir"] / f"{config['subdir']}-{slug}.md"


def front_matter(text: str) -> str:
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n", text, flags=re.S)
    return match.group(1) if match else ""


def existing_path_for_doi(doi: str) -> Path | None:
    if not doi:
        return None
    for path in OUTPUT_ROOT.rglob("*.md"):
        if path.name.lower() == "readme.md":
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if re.search(rf"(?m)^doi:\s*[\"']?{re.escape(doi)}[\"']?\s*$", front_matter(text)):
            return path
    return None


def markdown_for(source: str, config: dict) -> tuple[str, dict[str, str], str]:
    meta = article_metadata(source, config)
    title = meta["title"]
    abstract = section(source, "abstract")
    fulltext = section(source, "fulltext")
    textpart = section(source, "textpart")
    references = section(source, "references")

    text_status = "html_conversion_unverified"
    text_source = fulltext
    full_lines, notes = render_body(first_text(text_source, r"<div\b[^>]*itemprop=[\"']articleBody[\"'][^>]*>(.*?)</div>") or text_source)
    reference_lines = render_list(references)

    lines = [
        "---",
        f"title: {yaml_value(title)}",
        f"author: {yaml_value(meta['author'])}",
        f"created: {yaml_value(now_date())}",
        'type: "analysis"',
        f"tags: {yaml_list(config['tags'])}",
        f"language: {yaml_value(meta['language'])}",
        f"topics: {yaml_list(config['topics'])}",
        'places: ["Russia"]',
        'collection: "maidansky-research"',
        f"llm_wiki_eligible: {yaml_value('true' if text_status == 'html_conversion_unverified' else 'false')}",
        'gbrain_source: "project-markdown"',
        'text_role: "research"',
        'core_corpus_eligible: "false"',
        'source_format: "html"',
        'source_license: "CC-BY-NC-4.0"',
        'redistribution_approved: "false"',
        'rights_review_status: "unreviewed"',
        f"text_status: {yaml_value(text_status)}",
        f"source_url: {yaml_value(config['url'])}",
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
    lines.extend(["", f"Источник: <{config['url']}>", "", "Лицензия источника: CC BY-NC 4.0."])

    abstract_text = first_text(abstract, r"<div\b[^>]*itemprop=[\"']abstract[\"'][^>]*>(.*?)</div>") or plain(abstract)
    if abstract_text:
        lines.extend(["", "## Резюме" if meta["language"] == "ru" else "## Abstract", "", abstract_text])
    if full_lines:
        lines.extend(["", *full_lines])
    if notes:
        lines.extend(["", "## Примечания", "", *notes])
    if reference_lines:
        lines.extend(["", "## Литература" if meta["language"] == "ru" else "## References", "", *reference_lines])
    return "\n".join(lines).strip() + "\n", meta, text_status


def convert(force: bool = False, only: str | None = None) -> int:
    manifest = {
        "source": "https://psyjournals.ru/authors/8305",
        "generated_at": now_iso(),
        "policy": "Converted from genuine PsyJournals HTML article pages; no PDF text layer or OCR was used.",
        "items": [],
    }
    failures = 0
    for config in ARTICLES:
        if only and only not in config["url"]:
            continue
        try:
            source = fetch_text(config["url"])
            if not section(source, "fulltext"):
                meta = article_metadata(source, config)
                manifest["items"].append({
                    "title": meta["title"],
                    "authors": meta["author"],
                    "url": config["url"],
                    "doi": meta["doi"],
                    "published_in": meta["published_in"],
                    "markdown_path": "",
                    "status": "skipped_no_fulltext",
                    "text_status": "pdf_source_preferred",
                    "source_license": "CC-BY-NC-4.0",
                    "core_corpus_eligible": "false",
                    "llm_wiki_eligible": "false",
                })
                print(f"skipped_no_fulltext: {config['url']}")
                continue
            markdown, meta, text_status = markdown_for(source, config)
            path = output_path(config, meta["title"])
            existing = existing_path_for_doi(meta["doi"])
            status = "converted"
            if existing and existing != path and not force:
                path = existing
                status = "existing"
            elif path.exists() and not force:
                status = "existing"
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                tmp = path.with_suffix(path.suffix + ".tmp")
                tmp.write_text(markdown, encoding="utf-8")
                os.replace(tmp, path)
            manifest["items"].append({
                "title": meta["title"],
                "authors": meta["author"],
                "url": config["url"],
                "doi": meta["doi"],
                "published_in": meta["published_in"],
                "markdown_path": path.relative_to(ROOT).as_posix(),
                "status": status,
                "text_status": text_status,
                "source_license": "CC-BY-NC-4.0",
                "core_corpus_eligible": "false",
                "llm_wiki_eligible": "true" if text_status == "html_conversion_unverified" else "false",
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
    tmp = MANIFEST_PATH.with_suffix(MANIFEST_PATH.suffix + ".tmp")
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, MANIFEST_PATH)
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert PsyJournals Maidansky HTML articles to Markdown.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing generated files")
    parser.add_argument("--only", help="Convert only URLs containing this substring")
    args = parser.parse_args()
    return convert(force=args.force, only=args.only)


if __name__ == "__main__":
    raise SystemExit(main())
