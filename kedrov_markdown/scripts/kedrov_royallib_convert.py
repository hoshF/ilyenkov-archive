#!/usr/bin/env python3
"""Fetch RoyalLib HTML editions of Kedrov and convert them to Markdown.

This converter intentionally accepts HTML only. It does not consume OCR,
DjVuTXT, ABBYY, hOCR, PDF text layers, or image recognition output.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import io
import json
import os
import re
import sys
import urllib.request
import zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath


ARCHIVE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ARCHIVE_ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
import split_longform_markdown as longform  # noqa: E402

OUTPUT_ROOT = ARCHIVE_ROOT / "kedrov_md" / "russian_web" / "royallib"
ASSET_ROOT = OUTPUT_ROOT / "assets"
METADATA_ROOT = ARCHIVE_ROOT / "metadata"
MANIFEST_PATH = METADATA_ROOT / "royallib_manifest.json"
USER_AGENT = "Ilyenkov research archive HTML converter"

WORKS = (
    {
        "id": "kedrov-besedy-o-dialektike",
        "slug": "besedi_o_dialektike",
        "filename": "besedy-o-dialektike.md",
        "title": "Беседы о диалектике",
        "work_year": "1983",
        "source_page": "https://royallib.com/book/kedrov_bonifatiy/besedi_o_dialektike.html",
    },
    {
        "id": "kedrov-o-dialektike-prirody-engelsa",
        "slug": "o_dialektike_prirodi_engelsa",
        "filename": "o-dialektike-prirody-engelsa.md",
        "title": "О «Диалектике природы» Энгельса",
        "work_year": "1973",
        "source_page": "https://royallib.com/book/kedrov_bonifatiy/o_dialektike_prirodi_engelsa.html",
    },
    {
        "id": "kedrov-o-tvorchestve-v-nauke-i-tekhnike",
        "slug": "o_tvorchestve_v_nauke_i_tehnike",
        "filename": "o-tvorchestve-v-nauke-i-tekhnike.md",
        "title": "О творчестве в науке и технике",
        "work_year": "1987",
        "source_page": "https://royallib.com/book/kedrov_bonifatiy/o_tvorchestve_v_nauke_i_tehnike.html",
    },
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write(path: Path, data: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    if isinstance(data, str):
        temporary.write_text(data, encoding="utf-8")
    else:
        temporary.write_bytes(data)
    os.replace(temporary, path)


def yaml_quote(value: str | list[str]) -> str:
    if isinstance(value, list):
        return "[" + ", ".join(yaml_quote(item) for item in value) + "]"
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def render_front_matter(fields: dict[str, str | list[str]]) -> str:
    lines = ["---"]
    lines.extend(f"{key}: {yaml_quote(value)}" for key, value in fields.items())
    lines.append("---")
    return "\n".join(lines)


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def source_url(slug: str) -> str:
    return f"https://royallib.com/get/html/kedrov_bonifatiy/{slug}.zip"


def clean_heading(value: str) -> str:
    value = html.unescape(value).replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"(?:\s*—\s*)+$", "", value).strip()
    return value


def normalize_markdown(value: str) -> str:
    value = html.unescape(value).replace("\xa0", " ").replace("\u00ad", "")
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t\f\v]+", " ", value)
    value = re.sub(r" *\n *", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"\*\*[ \t]+", "**", value)
    value = re.sub(r"[ \t]+\*\*", "**", value)
    value = re.sub(r"\*{4}([^*\n]+?)\*{4}", r"**\1**", value)
    value = re.sub(r"(\*\*[^*\n]{1,80}\*\*)(?=[A-Za-zА-Яа-яЁё])", r"\1 ", value)
    value = re.sub(r"(?m)^>\n\n(?=> )", "", value)
    value = re.sub(r"(?m)^-\s*$", "", value)
    return value.strip() + "\n"


class RoyalLibHTMLToMarkdown(HTMLParser):
    """Convert the book body after RoyalLib's generated table of contents."""

    SKIP_TAGS = {"script", "style", "noscript"}

    def __init__(self, asset_prefix: str) -> None:
        super().__init__(convert_charrefs=True)
        self.asset_prefix = asset_prefix
        self.parts: list[str] = []
        self.skip_depth = 0
        self.heading_tag: str | None = None
        self.heading_parts: list[str] = []
        self.headings: list[tuple[int, str]] = []
        self.bold_depth = 0
        self.italic_depth = 0
        self.blockquote_depth = 0
        self.list_depth = 0
        self.link_stack: list[str | None] = []
        self.seen_level_one = False

    def append(self, value: str) -> None:
        if not self.skip_depth:
            self.parts.append(value)

    def paragraph_break(self) -> None:
        if self.skip_depth or self.heading_tag:
            return
        current = "".join(self.parts)
        trailing = len(current) - len(current.rstrip("\n"))
        if current and trailing < 2:
            self.parts.append("\n" * (2 - trailing))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs_dict = {key.lower(): value or "" for key, value in attrs}
        if self.skip_depth or tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.heading_tag = tag
            self.heading_parts = []
        elif tag == "br":
            if self.heading_tag:
                self.heading_parts.append(" — ")
            elif self.blockquote_depth:
                self.append("\n> ")
            else:
                self.append("\n\n")
        elif tag in {"p", "div", "section", "article"}:
            self.paragraph_break()
        elif tag in {"b", "strong"}:
            if not self.heading_tag:
                self.append("**")
                self.bold_depth += 1
        elif tag in {"i", "em"}:
            if not self.heading_tag:
                self.append("*")
                self.italic_depth += 1
        elif tag == "blockquote":
            self.paragraph_break()
            self.blockquote_depth += 1
            self.append("> ")
        elif tag in {"ul", "ol"}:
            self.list_depth += 1
            self.paragraph_break()
        elif tag == "li":
            self.paragraph_break()
            self.append("  " * max(0, self.list_depth - 1) + "- ")
        elif tag == "hr":
            self.paragraph_break()
            self.append("---")
            self.paragraph_break()
        elif tag == "a":
            href = attrs_dict.get("href", "")
            if href.startswith(("http://", "https://")):
                self.append("[")
                self.link_stack.append(href)
            else:
                self.link_stack.append(None)
        elif tag == "img":
            src = PurePosixPath(attrs_dict.get("src", "")).name
            if src and src.lower() != "cover.jpg":
                self.paragraph_break()
                self.append(f"![Иллюстрация]({self.asset_prefix}/{src})")
                self.paragraph_break()
        elif tag in {"sup", "sub"}:
            self.append(f"<{tag}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if self.heading_tag == tag:
            source_level = int(tag[1])
            heading = clean_heading("".join(self.heading_parts))
            if heading:
                if re.fullmatch(r"(?:\*\s*){3,}", heading):
                    self.paragraph_break()
                    self.append("---")
                    self.paragraph_break()
                else:
                    effective_level = source_level
                    if source_level == 2 and not self.seen_level_one:
                        effective_level = 1
                    markdown_level = min(6, effective_level + 1)
                    self.paragraph_break()
                    self.append("#" * markdown_level + " " + heading)
                    self.paragraph_break()
                    if source_level <= 2:
                        self.headings.append((effective_level, heading))
                    if source_level == 1:
                        self.seen_level_one = True
            self.heading_tag = None
            self.heading_parts = []
        elif tag in {"p", "div", "section", "article", "li"}:
            self.paragraph_break()
        elif tag in {"b", "strong"} and self.bold_depth:
            self.append("**")
            self.bold_depth -= 1
        elif tag in {"i", "em"} and self.italic_depth:
            self.append("*")
            self.italic_depth -= 1
        elif tag == "blockquote" and self.blockquote_depth:
            self.blockquote_depth -= 1
            self.paragraph_break()
        elif tag in {"ul", "ol"}:
            self.list_depth = max(0, self.list_depth - 1)
            self.paragraph_break()
        elif tag == "a" and self.link_stack:
            href = self.link_stack.pop()
            if href:
                self.append(f"]({href})")
        elif tag in {"sup", "sub"}:
            self.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self.skip_depth:
            return
        if self.heading_tag:
            self.heading_parts.append(data)
        else:
            self.append(data)

    def markdown(self) -> str:
        return normalize_markdown("".join(self.parts))


def book_body(html_text: str) -> str:
    match = re.search(
        r"<h[1-6][^>]*>\s*<a\s+name=[\"']TOC_[^\"']+[\"'][^>]*>",
        html_text,
        flags=re.IGNORECASE,
    )
    if not match:
        raise ValueError("RoyalLib chapter anchor not found")
    body = html_text[match.start() :]
    footer_text = body.find("Спасибо, что скачали книгу")
    if footer_text >= 0:
        footer_start = body.rfind("<p", 0, footer_text)
        if footer_start >= 0:
            body = body[:footer_start]
    return body


def table_of_contents(headings: list[tuple[int, str]]) -> str:
    lines = ["## Содержание", ""]
    seen_level_one = False
    for level, heading in headings:
        if level == 1:
            seen_level_one = True
        indent = "  " if level == 2 and seen_level_one else ""
        lines.append(f"{indent}- {heading}")
    return "\n".join(lines)


def convert_work(work: dict[str, str], check: bool) -> dict[str, object]:
    url = source_url(work["slug"])
    zip_bytes = fetch(url)
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        html_names = [name for name in archive.namelist() if name.lower().endswith(".html")]
        if len(html_names) != 1:
            raise ValueError(f"Expected one HTML file in {url}, found {len(html_names)}")
        html_bytes = archive.read(html_names[0])
        html_text = html_bytes.decode("windows-1251")
        body_html = book_body(html_text)
        referenced_assets = {
            PurePosixPath(name).name
            for name in re.findall(r"<img[^>]+src=[\"']([^\"']+)[\"']", body_html, flags=re.IGNORECASE)
            if PurePosixPath(name).name.lower() != "cover.jpg"
        }

        asset_names = [
            name
            for name in archive.namelist()
            if PurePosixPath(name).suffix.lower() in {".png", ".jpg", ".jpeg", ".gif"}
            and PurePosixPath(name).name in referenced_assets
        ]
        asset_hashes: dict[str, str] = {}
        asset_directory = ASSET_ROOT / work["slug"]
        for name in asset_names:
            filename = PurePosixPath(name).name
            data = archive.read(name)
            asset_hashes[filename] = sha256(data)
            target = asset_directory / filename
            if check:
                if not target.exists() or sha256(target.read_bytes()) != asset_hashes[filename]:
                    raise RuntimeError(f"Missing or changed generated asset: {target}")
            else:
                atomic_write(target, data)
        if asset_directory.exists():
            extra_assets = {
                path.name for path in asset_directory.iterdir() if path.is_file()
            } - set(asset_hashes)
            if check and extra_assets:
                raise RuntimeError(f"Unexpected generated assets in {asset_directory}: {sorted(extra_assets)}")
            if not check:
                for filename in extra_assets:
                    (asset_directory / filename).unlink()

    parser = RoyalLibHTMLToMarkdown(f"assets/{work['slug']}")
    parser.feed(body_html)
    body = parser.markdown()
    fetched_date = dt.date.today().isoformat()
    metadata: dict[str, str | list[str]] = {
        "id": work["id"],
        "created": fetched_date,
        "author": "Бонифатий Михайлович Кедров",
        "title": work["title"],
        "type": "source",
        "tags": ["kedrov", "russian", "philosophy", "source-text"],
        "language": "ru",
        "collection": "kedrov-russian",
        "work_year": work["work_year"],
        "source_url": work["source_page"],
        "source_download_url": url,
        "source_site": "RoyalLib",
        "source_format": "html",
        "transcription_mode": "agent_canonical_markdown",
        "source_encoding": "windows-1251",
        "source_license": "not_stated",
        "conversion_date": fetched_date,
        "text_status": "html_conversion_unverified",
        "text_role": "author_original",
        "core_corpus_eligible": "true",
        "llm_wiki_eligible": "true",
        "redistribution_approved": "false",
        "rights_review_status": "unreviewed",
        "gbrain_source": "project-markdown",
    }
    markdown = (
        render_front_matter(metadata)
        + f"\n\n# {work['title']}\n\n"
        + f"Автор: Бонифатий Михайлович Кедров\n\n"
        + f"Источник HTML: <{work['source_page']}>\n\n"
        + "> Статус: автоматическое преобразование структурированного HTML; текст не сверен с печатным изданием. OCR не использовался.\n\n"
        + table_of_contents(parser.headings)
        + "\n\n---\n\n"
        + body
    )
    output_path = OUTPUT_ROOT / work["filename"]
    if check:
        longform.check_generated_text(output_path, markdown, root=PROJECT_ROOT)
    else:
        longform.write_or_split(output_path, markdown, root=PROJECT_ROOT)

    work_manifest = longform.manifest_path_for(output_path)
    split_metadata = json.loads(work_manifest.read_text(encoding="utf-8"))

    return {
        "id": work["id"],
        "title": work["title"],
        "source_url": work["source_page"],
        "source_download_url": url,
        "source_zip_sha256": sha256(zip_bytes),
        "source_html_sha256": sha256(html_bytes),
        "source_html_bytes": len(html_bytes),
        "output_file": str(output_path.relative_to(ARCHIVE_ROOT)),
        "work_manifest": str(work_manifest.relative_to(ARCHIVE_ROOT)),
        "chapter_count": len(split_metadata["chapters"]),
        "output_sha256": hashlib.sha256(markdown.encode("utf-8")).hexdigest(),
        "output_characters": len(markdown),
        "heading_count": len(parser.headings),
        "assets": asset_hashes,
        "text_status": "html_conversion_unverified",
        "ocr_used": False,
    }


def main() -> int:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument(
        "--check",
        action="store_true",
        help="Regenerate in memory and fail if tracked Markdown differs.",
    )
    args = argument_parser.parse_args()

    records = []
    for work in WORKS:
        print(f"{'checking' if args.check else 'converting'} {work['title']}", file=sys.stderr)
        records.append(convert_work(work, args.check))

    manifest = {
        "generated_at": dt.date.today().isoformat(),
        "source_site": "RoyalLib",
        "source_policy": "HTML conversion; source scans are stored separately and no new OCR is authorized.",
        "works": records,
    }
    rendered_manifest = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.check:
        if not MANIFEST_PATH.exists() or MANIFEST_PATH.read_text(encoding="utf-8") != rendered_manifest:
            raise RuntimeError(f"Generated manifest differs: {MANIFEST_PATH}")
    else:
        atomic_write(MANIFEST_PATH, rendered_manifest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
