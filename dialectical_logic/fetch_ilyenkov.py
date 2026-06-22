#!/usr/bin/env python3
"""
抓取 http://filorus.ru/ilyenkov/texts/dla/ 所有章节，保存为本地文本文件。
运行环境：Python 3.6+，无需第三方库。
"""

import urllib.request
import re
import os
import time

BASE_URL = "http://filorus.ru/ilyenkov/texts/dla/"
OUTPUT_DIR = "ilyenkov_chapters"

CHAPTERS = [
    ("intro", "引言_Введение"),
    ("01", "第01章_Очерк_первый"),
    ("02", "第02章_Очерк_второй"),
    ("03", "第03章_Очерк_третий"),
    ("04", "第04章_Очерк_четвертый"),
    ("05", "第05章_Очерк_пятый"),
    ("06", "第06章_Очерк_шестой"),
    ("07", "第07章_Очерк_седьмой"),
    ("08", "第08章_Очерк_восьмой"),
    ("09", "第09章_Очерк_девятый"),
    ("10", "第10章_Очерк_десятый"),
    ("11", "第11章_Очерк_одиннадцатый"),
    ("final", "结语_Заключение"),
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "ru,en;q=0.9",
    "Referer": "http://filorus.ru/ilyenkov/texts/dla/index.html",
}


def fetch_url(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    # Try UTF-8 first, fallback to cp1251 (common for Russian sites)
    for enc in ("utf-8", "cp1251", "iso-8859-5"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def strip_html(html: str) -> str:
    """Remove HTML tags and clean up whitespace."""
    # Remove <script> and <style> blocks
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.I)
    # Remove HTML tags
    html = re.sub(r"<[^>]+>", " ", html)
    # Decode common HTML entities
    entities = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&nbsp;": " ",
        "&mdash;": "—",
        "&ndash;": "–",
        "&laquo;": "«",
        "&raquo;": "»",
        "&#160;": " ",
    }
    for ent, char in entities.items():
        html = html.replace(ent, char)
    # Also handle numeric entities
    html = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), html)
    # Collapse whitespace
    html = re.sub(r"[ \t]+", " ", html)
    html = re.sub(r"\n{3,}", "\n\n", html)
    return html.strip()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"输出目录：{os.path.abspath(OUTPUT_DIR)}\n")

    success = 0
    failed = []

    for slug, filename in CHAPTERS:
        url = BASE_URL + slug + ".html"
        out_path = os.path.join(OUTPUT_DIR, f"{filename}.txt")

        if os.path.exists(out_path):
            print(f"[已存在，跳过] {filename}")
            success += 1
            continue

        print(f"[抓取] {url} ...")
        try:
            html = fetch_url(url)
            text = strip_html(html)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(f"来源：{url}\n")
                f.write("=" * 60 + "\n\n")
                f.write(text)
            size = os.path.getsize(out_path)
            print(f"  ✓ 保存至 {out_path}  ({size // 1024} KB)")
            success += 1
        except Exception as e:
            print(f"  ✗ 失败：{e}")
            failed.append((slug, str(e)))

        time.sleep(1.5)  # 礼貌性延迟，避免对服务器造成压力

    print(f"\n完成：{success}/{len(CHAPTERS)} 章节成功")
    if failed:
        print("失败章节：")
        for slug, err in failed:
            print(f"  {slug}: {err}")
    else:
        print(f"所有文件保存在 ./{OUTPUT_DIR}/ 目录下，可直接上传。")


if __name__ == "__main__":
    main()
