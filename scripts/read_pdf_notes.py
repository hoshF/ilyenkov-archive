#!/usr/bin/env python3
"""把 PDF 上的批注读成文本，并尽量定位到译文锚点。

用途：所有者在 macOS 预览里给成书划线、加注之后，用本脚本把批注取出来，
不必把整页当图片读——**代价差两个数量级**：一条划线取出来是一行文字（几十 token），
整页渲染成图片是一两千 token。

映射到锚点是关键一步：划线的中文若能在某个单元的 `final.md` 里找到，
就直接报出 `chNNN-pNNNN`，批注于是可以进入既有的审计流程
（改哪一块、重取哪个哈希、重签哪一单元），而不是停留在「第 137 页那句」。

用法：
    python3 scripts/read_pdf_notes.py 批注版.pdf
    python3 scripts/read_pdf_notes.py 批注版.pdf --context 40
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    sys.exit("需要 PyMuPDF：python3 -m pip install --user pymupdf")

from audit_unit import PROJECT  # noqa: E402
from audit_unit import anchors as read_anchors  # noqa: E402

TYPE_ZH = {
    "Highlight": "划线", "Underline": "下划线", "StrikeOut": "删除线",
    "Squiggly": "波浪线", "Text": "便笺", "FreeText": "文字框",
    "Ink": "手绘", "Square": "方框", "Circle": "圆圈",
}


def load_index() -> list[tuple[str, str, str]]:
    """(锚点, 归一化后的中文, 原文) —— 用于把划线的字反查回块。"""
    index: list[tuple[str, str, str]] = []
    for unit_dir in sorted((PROJECT / "units").iterdir()):
        final = unit_dir / "final.md"
        if not final.is_file():
            continue
        for key, text in read_anchors(final, unit_dir.name).items():
            index.append((key, norm(text), text))
    return index


def norm(text: str) -> str:
    """只留汉字、拉丁与西里尔字母：PDF 取字会带进换行、空格与断词，
    正文里的着重号（U+2022）也会混进来。"""
    return re.sub(r"[^一-鿿A-Za-zЀ-ӿ0-9]", "", text)


def locate(fragment: str, index: list[tuple[str, str, str]]) -> str | None:
    """反查锚点。**命中多块时全部报出**——短片段（如一个俄文词）在全书里
    往往不止一处，只报第一个会给出看似确定实则错误的位置。"""
    key = norm(fragment)
    if len(key) < 6:
        return None
    hits = [a for a, body, _ in index if key in body]
    if not hits:
        # 划线常跨块：退一步用前 12 个字找起点
        head = key[:12]
        hits = [f"{a}（起点；划线跨块）" for a, body, _ in index if head in body]
    if not hits:
        return None
    if len(hits) == 1:
        return hits[0]
    shown = "、".join(hits[:4]) + ("…" if len(hits) > 4 else "")
    return f"{len(hits)} 处候选：{shown}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--context", type=int, default=60, help="每条最多显示多少字")
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    index = load_index()
    total = 0
    for page in doc:
        for annot in page.annots() or []:
            total += 1
            kind = TYPE_ZH.get(annot.type[1], annot.type[1])
            info = annot.info or {}
            note = (info.get("content") or "").strip()

            # 划线一类不存被划的字，须按标注区域回取
            covered = ""
            if annot.type[1] in ("Highlight", "Underline", "StrikeOut", "Squiggly"):
                quads = annot.vertices or []
                rects = [fitz.Quad(quads[i:i + 4]).rect for i in range(0, len(quads), 4)]
                covered = " ".join(page.get_textbox(r).strip() for r in rects)
                covered = " ".join(covered.split())
                covered = covered.replace("\u2022", "")  # 去掉着重号，它是排版加的
                covered = re.sub(r"\s+", "", covered) if re.search(r"[一-鿿]", covered) else covered

            where = locate(covered, index) if covered else None
            print(f"── 第 {page.number + 1} 页｜{kind}"
                  + (f"｜{where}" if where else "｜（未能定位到锚点）"))
            if covered:
                shown = covered[:args.context]
                print(f"   划到：{shown}{'…' if len(covered) > args.context else ''}")
            if note:
                print(f"   批注：{note}")
    print(f"\n共 {total} 条批注。" if total else "\n未发现批注。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
