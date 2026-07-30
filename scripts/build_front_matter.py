#!/usr/bin/env python3
"""把前置材料的 Markdown 转成 LaTeX。

  book/front/01-译者引言.md   待所有者撰写（**前置材料只有这一篇**，见 STYLE_GUIDE
                              第六节；agent 不得代写，「缺某一节」不是缺陷）

**前置材料只此一篇。** 起初还写过凡例、底本说明、仓库索引、权利说明四篇并附
书末术语表，所有者逐次判定过重：面向传播的书，读者要知道的是书的来历、
作者的出版经历与译者的话，其余——注记体例、审校流程、锚点体例、仓库与权利条款——
都是项目内部的事，留在版本库即可（体例见 notes/STYLE_GUIDE.md，术语见
ilyenkov_markdown/metadata/glossary.json）。本脚本因此只剩转换职能。

转换器只处理前置材料实际用到的 Markdown：标题、段落、`**粗**`、`*着重*`、
管道表格、无序列表、引用块、行内代码。**超出范围的一律原样输出并在末尾报告**，
理由同 md_to_latex.py：宁可报出来让人看，不猜。

用法：
    python3 scripts/build_front_matter.py     # 把 book/front/*.md 写成同名 .tex
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONT = ROOT / "book" / "front"








# ── Markdown → LaTeX（前置材料用到的子集）────────────────────────────

SPECIALS = [("\\", r"\textbackslash{}"), ("&", r"\&"), ("%", r"\%"),
            ("$", r"\$"), ("#", r"\#"), ("_", r"\_"),
            ("~", r"\textasciitilde{}"), ("^", r"\textasciicircum{}")]


def esc(text: str) -> str:
    for raw, rep in SPECIALS:
        text = text.replace(raw, rep)
    return text


def inline(text: str, report: list[str] | None = None, label: str = "") -> str:
    text = esc(text)

    def code(m: re.Match) -> str:
        # 等宽字体（lmmono）没有西里尔字形。反引号是给代码与文件名用的，
        # 俄文词不是代码：撞上就报出来，不静悄悄排成缺字形。
        if re.search(r"[Ѐ-ӿ]", m.group(1)) and report is not None:
            report.append(f"{label}: 反引号里有西里尔字母 {m.group(1)!r}，"
                          f"等宽字体无此字形——应改用正文体")
        return r"\texttt{" + m.group(1) + "}"

    text = re.sub(r"`([^`]+)`", code, text)
    text = re.sub(r"\*\*(.+?)\*\*", lambda m: r"\textbf{" + m.group(1) + "}", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)",
                  lambda m: r"\emph{" + m.group(1) + "}", text)
    text = re.sub(r"<(https?://[^>]+)>", lambda m: r"\url{" + m.group(1) + "}", text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)",
                  lambda m: r"\href{" + m.group(2) + "}{" + m.group(1) + "}", text)
    return text


def table_tex(rows: list[list[str]], inl) -> str:
    cols = len(rows[0])
    widths = {2: "0.30\\linewidth 0.60\\linewidth",
              4: "0.24\\linewidth 0.26\\linewidth 0.26\\linewidth 0.10\\linewidth"}
    spec = widths.get(cols)
    # 窄列两端对齐会把词拉出大空隙（мышления␣␣␣␣и），一律左对齐
    cell = r">{\raggedright\arraybackslash}p{%s}"
    colspec = ("".join(cell % w for w in spec.split()) if spec
               else "l" * cols)
    out = [r"\begin{center}\zihao{-5}",
           r"\begin{longtable}{" + colspec + "}",
           r"\hline"]
    out.append(" & ".join(r"\textbf{" + inl(c) + "}" for c in rows[0]) + r" \\")
    out.append(r"\hline\endhead")
    for row in rows[1:]:
        out.append(" & ".join(inl(c) for c in row) + r" \\")
    out += [r"\hline", r"\end{longtable}", r"\end{center}"]
    return "\n".join(out)


def md_to_tex(text: str, report: list[str], label: str) -> str:
    body = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)

    def inl(s: str) -> str:
        return inline(s, report, label)

    out: list[str] = []
    buf: list[str] = []
    table: list[list[str]] = []
    bullets: list[str] = []

    def flush() -> None:
        if buf:
            out.append(inl(" ".join(buf).strip()))
            buf.clear()
        if bullets:
            out.append(r"\begin{itemize}\zihao{-5}")
            # 用 extend 而非 out += …：后者会让 Python 把 out 当作本函数的局部变量
            out.extend(r"\item " + inl(b) for b in bullets)
            out.append(r"\end{itemize}")
            bullets.clear()
        if table:
            out.append(table_tex(table, inl))
            table.clear()

    for raw in body.split("\n"):
        line = raw.rstrip()
        if not line.strip():
            flush()
            continue
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                continue
            if buf:
                out.append(inl(" ".join(buf).strip()))
                buf.clear()
            table.append(cells)
            continue
        if table:
            flush()
        if line.startswith("# "):
            title = inl(line[2:].strip())
            out.append(r"\bookchapteropen{}{" + title + "}")
            out.append(r"\phantomsection\addcontentsline{toc}{chapter}{" + title + "}")
            out.append(r"\markboth{" + title + "}{" + title + "}")
            continue
        if line.startswith("## "):
            out.append(r"\booksection{" + inl(line[3:].strip()) + "}")
            continue
        if line.startswith("### "):
            out.append(r"\booksubsection{" + inl(line[4:].strip()) + "}")
            continue
        if line.startswith("> "):
            out.append(r"\begin{quote}" + inl(line[2:].strip()) + r"\end{quote}")
            continue
        if line.startswith("- "):
            if buf:
                out.append(inl(" ".join(buf).strip()))
                buf.clear()
            bullets.append(line[2:].strip())
            continue
        if bullets:
            bullets[-1] += " " + line.strip()
            continue
        if line.startswith(("=", "*", "+")) and len(set(line.strip())) == 1:
            report.append(f"{label}: 未处理的分隔行 {line!r}")
            continue
        buf.append(line.strip())
    flush()
    return "\n\n".join(x for x in out if x.strip()) + "\n"


# ── 主流程 ─────────────────────────────────────────────────────────






def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.parse_args()

    report: list[str] = []
    n = 0
    for md in sorted(FRONT.glob("*.md")):
        tex = md_to_tex(md.read_text(encoding="utf-8"), report, md.name)
        md.with_suffix(".tex").write_text(tex, encoding="utf-8")
        n += 1
    print(f"前置材料 {n} 篇已生成 .tex")
    if report:
        print("转换报告（须人核）：")
        for r in report:
            print("  " + r)
    return 0


if __name__ == "__main__":
    sys.exit(main())
