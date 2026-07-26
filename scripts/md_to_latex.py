#!/usr/bin/env python3
r"""把一个单元的 `final.md` 转成 LaTeX 章节文件（样章阶段）。

只处理本项目 `final.md` 实际用到的这几种标记，不追求通用 Markdown：

* `## chNNN-pNNNN` 锚点行 —— 丢弃（是脚手架，不是内容）
* ``### 标题``             —— section*（保留原文标题，不进目录编号）
* `*强调*`                 —— \emph{}（导言里已重定义为着重号）
* `[^id]` 与 `[^id]:`      —— 脚注：把定义就地嵌进第一次引用处
* `〔底本来源：…〕`         —— 丢弃（数字化附加，不属原书；合并本也剔除）
* `＊　＊　＊`               —— \asterism 分隔
* 段落                     —— 空行分隔，逐段输出

**为什么不用 pandoc**：pandoc 会重排中文标点、可能吃掉六角括号与全角空格，
而本书的〔〕、着重号、`＊　＊　＊` 都是体例的一部分，错一个就破坏可分辨性。
这个转换器只做已知的几件事，出了范围就原样输出并在末尾报告，便于人工核。

用法：
    python3 scripts/md_to_latex.py ch012 > book/sample/ch012.tex
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_unit import PROJECT, anchors  # noqa: E402

# LaTeX 特殊字符转义（中文正文里主要是这几个会出问题）。
# 注意：反斜杠先转，否则会把后续转义的反斜杠再转一遍。
SPECIALS = [
    ("\\", r"\textbackslash{}"),
    ("&", r"\&"), ("%", r"\%"), ("$", r"\$"), ("#", r"\#"),
    ("_", r"\_"), ("{", r"\{"), ("}", r"\}"),
    ("~", r"\textasciitilde{}"), ("^", r"\textasciicircum{}"),
]


def escape(text: str) -> str:
    for raw, rep in SPECIALS:
        text = text.replace(raw, rep)
    return text


def convert_inline(text: str, footnotes: dict[str, str], report: list[str]) -> str:
    # 先抽出脚注标记，占位，避免正文转义碰到 [^…]
    marks: list[str] = []

    def stash_mark(match: re.Match) -> str:
        marks.append(match.group(1))
        return f"\0MARK{len(marks) - 1}\0"

    text = re.sub(r"\[\^([A-Za-z0-9._-]+)\](?!:)", stash_mark, text)

    # 强调 *…*（非 **），占位
    emphs: list[str] = []

    def stash_emph(match: re.Match) -> str:
        emphs.append(match.group(1))
        return f"\0EMPH{len(emphs) - 1}\0"

    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", stash_emph, text)

    text = escape(text)

    # 还原强调
    for i, inner in enumerate(emphs):
        text = text.replace(f"\0EMPH{i}\0", r"\emph{" + escape(inner) + "}")

    # 还原脚注：把定义就地嵌入
    for i, fid in enumerate(marks):
        body = footnotes.get(fid)
        if body is None:
            report.append(f"脚注 [^{fid}] 无定义")
            replacement = ""
        else:
            replacement = r"\footnote{" + convert_footnote(body, footnotes, report) + "}"
        text = text.replace(f"\0MARK{i}\0", replacement)
    return text


def convert_footnote(body: str, footnotes: dict[str, str], report: list[str]) -> str:
    # 脚注正文自身可能含强调；不递归脚注（本书无脚注套脚注）。
    body = body.strip()
    emphs: list[str] = []
    body = re.sub(
        r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)",
        lambda m: emphs.append(m.group(1)) or f"\0E{len(emphs) - 1}\0",
        body,
    )
    body = escape(body)
    for i, inner in enumerate(emphs):
        body = body.replace(f"\0E{i}\0", r"\emph{" + escape(inner) + "}")
    return body


def convert(unit: str) -> tuple[str, list[str]]:
    report: list[str] = []
    blocks = anchors(PROJECT / "units" / unit / "final.md", unit)
    if not blocks:
        raise SystemExit(f"{unit}: 缺少 final.md")

    # 先收集脚注定义，从正文块里摘出
    footnotes: dict[str, str] = {}
    body_blocks: list[str] = []
    for key in sorted(blocks):
        text = blocks[key]
        m = re.match(r"^\[\^([A-Za-z0-9._-]+)\]:\s*(.*)$", text, re.S)
        if m:
            footnotes[m.group(1)] = m.group(2)
            continue
        body_blocks.append(text)

    # 去掉与紧随其后的节标题重复的章标题（底本页标题＋页内节标题，见
    # build_merged_translation.py 的同名处理）。样章只排一章，简化为：
    # 若前两个非来源块都是 ### 标题且内容相同，丢掉第一个。
    heads = [b for b in body_blocks if b.startswith("###")]
    drop: set[int] = set()
    if len(heads) >= 2:
        a = re.sub(r"^#+\s*\d*\.?\s*", "", heads[0]).strip()
        b = re.sub(r"^#+\s*\d*\.?\s*", "", heads[1]).strip()
        if a == b or b.startswith(a) or a.startswith(b):
            drop.add(id(heads[0]))

    out: list[str] = []
    for text in body_blocks:
        if text.startswith("〔底本来源："):
            continue
        stripped = text.strip()
        if stripped.startswith("###") and re.sub(r"^#+\s*", "", stripped) == "注释":
            continue  # 脚注已就地嵌入，不需要单独的「注释」小节
        if text.startswith("###"):
            if id(text) in drop:
                continue
            title = re.sub(r"^#+\s*", "", text).strip()
            out.append(r"\section*{" + escape(title) + "}")
            continue
        # `＊　＊　＊` 分隔行可能单独成段，或在段首
        if text.startswith("＊　＊　＊"):
            rest = text[len("＊　＊　＊"):].lstrip("\n")
            out.append(r"\begin{center}＊\quad＊\quad＊\end{center}")
            if rest.strip():
                out.append(convert_inline(rest, footnotes, report))
            continue
        out.append(convert_inline(text, footnotes, report))
    return "\n\n".join(out) + "\n", report


def main() -> int:
    if len(sys.argv) != 2 or not re.fullmatch(r"ch\d{3}", sys.argv[1]):
        print("用法: md_to_latex.py chNNN", file=sys.stderr)
        return 2
    latex, report = convert(sys.argv[1])
    sys.stdout.write(latex)
    if report:
        sys.stderr.write("\n转换报告（须人核）：\n" + "\n".join("  " + r for r in report) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
