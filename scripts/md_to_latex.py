#!/usr/bin/env python3
r"""把一个单元的 `final.md` 转成 LaTeX 章节文件（样章阶段）。

只处理本项目 `final.md` 实际用到的这几种标记，不追求通用 Markdown：

* `## chNNN-pNNNN` 锚点行 —— 丢弃（是脚手架，不是内容）
* ``### 标题``             —— section*（保留原文标题，不进目录编号）
* `*强调*`                 —— \emph{}（导言里已重定义为黑体强调）
* `[^id]` 与 `[^id]:`      —— 脚注：把定义就地嵌进第一次引用处
* `〔底本来源：…〕`         —— 丢弃（数字化附加，不属原书；合并本也剔除）
* `＊　＊　＊`               —— \asterism 分隔
* 段落                     —— 空行分隔，逐段输出

**为什么不用 pandoc**：pandoc 会重排中文标点、可能吃掉六角括号与全角空格，
而本书的〔〕、强调、`＊　＊　＊` 都是体例的一部分，错一个就破坏可分辨性。
这个转换器只做已知的几件事，出了范围就原样输出并在末尾报告，便于人工核。

用法：
    python3 scripts/md_to_latex.py ch012 > /tmp/ch012.tex
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_unit import PROJECT, anchors  # noqa: E402

# LaTeX 特殊字符转义（中文正文里主要是这几个会出问题）。
SPECIALS = [
    ("&", r"\&"), ("%", r"\%"), ("$", r"\$"), ("#", r"\#"),
    ("_", r"\_"), ("{", r"\{"), ("}", r"\}"),
    ("~", r"\textasciitilde{}"), ("^", r"\textasciicircum{}"),
]
# 反斜杠不能与上面这些同批处理，两种次序都错：先转它，它换出的
# `\textbackslash{}` 里那对花括号会被后面的 { } 规则再转义一遍，排成可见的
# 「\{}」；后转它，又会把 \& \% 一类刚加上的反斜杠再转一遍。故先换成哨符
# （NUL 包夹，正文不可能出现），全部转完再还原。
BACKSLASH_SENTINEL = "\0BS\0"


# 西里尔字母不需要在此特殊处理：正文字体已由 scripts/merge_cyrillic_font.py
# 并入比例宽度的西里尔字形。若换回未合并的混合字体，俄文会退回全角
# 「ц е н н о с т ь」——那是字体问题，不该在转换器里绕。


def escape(text: str) -> str:
    text = text.replace("\\", BACKSLASH_SENTINEL)
    for raw, rep in SPECIALS:
        text = text.replace(raw, rep)
    return text.replace(BACKSLASH_SENTINEL, r"\textbackslash{}")


# 正文里**不是强调**的两种斜体。底本的斜体在这两处是体例，不是强调：
#   署名   `(курсив мой — *Э.И.*)` 伊里因科夫给自己的签名加斜体，那是签名的写法
#   著录   `(*Маркс К.* Grundrisse)` 俄文文献著录格式，与脚注里那 70 处同型，
#          只是落在正文括号里而非脚注里
# 照正文的 \emph 排黑体会变成「强调署名」「强调人名」。脚注那侧靠位置就能区分
# （在脚注里即走 \footnoteemph）；正文里没有位置可依，只能靠形态，故此二式必须窄：
# 署名只有这两种写法，著录要求「姓氏＋空格＋西里尔或拉丁缩写」。
# 判不准的一律留给 \emph——当成强调而其实不是，只是显得重一点；反过来会抹掉原文的信息。
BYLINE = re.compile(r"^(?:Э\.\s*И\.|埃·伊)$")
CITATION = re.compile(r"^[\u4e00-\u9fff]{2,6}\s+(?:[А-ЯЁA-Z]\.){1,3}$")


def is_apparatus(inner: str) -> bool:
    """True 表示这段斜体是署名或行内著录，不是强调。"""
    stripped = inner.strip()
    return bool(BYLINE.match(stripped) or CITATION.match(stripped))


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
        command = r"\bookapparatus{" if is_apparatus(inner) else r"\emph{"
        text = text.replace(f"\0EMPH{i}\0", command + escape(inner) + "}")

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
    """脚注里的强调另走 \footnoteemph。

    底本在脚注里用斜体做两件事：**标著录的作者名**（俄文文献体例）与
    **引文内的真强调**。全书 71 处里 70 处是前者，只有 ch025 块 90
    「*仅仅一种科学叙述方式*」是后者（希法亭引文内）。正文的强调已排加粗，
    照搬到脚注会把每条文献的作者名都加粗，看着像在强调人名。
    故脚注另设一个命令，由导言决定怎么排——目前排楷体：不加粗，
    又保住了底本「此处有别于常体」的形态，那一处真强调也不至于丢失。
    """
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
        body = body.replace(f"\0E{i}\0", r"\footnoteemph{" + escape(inner) + "}")
    return body


def parse_footnote_block(text: str) -> dict[str, str]:
    """一个块里的全部脚注定义。

    一个块可以放**多条**：底本的脚注与译者补的 `[^zh-N]` 常并在同一块，因为译注没有
    自己的源块、不能另起锚点。原先用 re.S 一次匹配整块，`.*` 会把后一条定义吃进前一条的
    注文里，后一条于是「无定义」——转换器会报出来（不是静默丢弃），但书里那条译注就没了。
    """
    found: dict[str, str] = {}
    for part in re.split(r"\n(?=\[\^[A-Za-z0-9._-]+\]:)", text):
        match = re.match(r"^\[\^([A-Za-z0-9._-]+)\]:\s*(.*)$", part.strip(), re.S)
        if match:
            found[match.group(1)] = match.group(2).strip()
    return found


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
        # 一个块可以放**多条**脚注定义：底本的脚注与译者补的 `[^zh-N]` 常并在同一块，
        # 因为译注没有自己的源块、不能另起锚点。原先用 re.S 一次匹配整块，
        # `.*` 会把后一条定义吃进前一条的注文里，后一条于是「无定义」——
        # 转换器会报出来（不是静默丢弃），但书里那条译注就没了。
        if text.startswith("[^"):
            footnotes.update(parse_footnote_block(text))
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
