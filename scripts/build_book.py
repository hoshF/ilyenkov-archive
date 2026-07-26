#!/usr/bin/env python3
r"""把全书 42 个单元拼装成一个 LaTeX 工程并（可选）编译。

结构映射（部/章/节/附录）写死在本文件的 STRUCTURE 表里——它是从底本逐块核出的
（部与第一、四章共用标题块；第二、三、五、六章各有标题块；附录五篇各自成章）。
ch000 整个跳过：它的扉页由我们的版本页承担，目录由 LaTeX 生成（点线引导＋真实
页码，徐禾式）——目录条目取自各章实际标题，与 ch000 的手抄清单逐字同源。

样式单一来源是 book/sample/preamble.tex（样章调定的那份），构建时复制进 build/。
版本号、commit、日期在构建时从 git 刻入 version.tex，覆盖导言里的占位宏。

前置材料（译者引言、凡例、底本说明、仓库索引、权利说明，STYLE_GUIDE 第六节）
**尚未撰写**，本构建不虚构它们；版本页上注明草稿状态。

用法：
    python3 scripts/build_book.py            # 生成 book/build/ 并编译两遍
    python3 scripts/build_book.py --no-pdf   # 只生成 .tex，不编译
    python3 scripts/build_book.py --font-file /path/to/font.ttf
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_unit import PROJECT, ROOT, anchors  # noqa: E402
from md_to_latex import convert_footnote, convert_inline, escape  # noqa: E402

BUILD = ROOT / "book" / "build"
SAMPLE_PREAMBLE = ROOT / "book" / "sample" / "preamble.tex"

# ── 结构表 ────────────────────────────────────────────────────────────────────
# 每个单元一条：
#   kind  : front | part | chapter | appendix | section
#   open  : (拉开字距的编号行, 标题行)——章级开头页两行；None 表示无编号行
#   toc   : 目录条目（None＝沿用节标题；章级必填）
#   mark  : 偶数页书眉（章级设定后延续到下一章级）；节的奇数页眉自动取节标题
#   skip  : 结构已承担、正文里要跳过的块号
#   split : 节标题被底本拆开处 (起始块号,)；override 给定合并成品
STRUCTURE: dict[str, dict] = {
    "ch001": dict(kind="front", open=(None, "作　者　序"), toc="作者序",
                  mark="作者序", skip=(1,)),
    "ch002": dict(kind="front", open=(None, "序　言"), toc="序言",
                  mark="序言", skip=(1,)),
    "ch003": dict(kind="part",
                  open=("第　一　部　分", r"抽象与具体的范畴\\[0.4ex]作为辩证逻辑学的范畴"),
                  toc="第一部分　抽象与具体的范畴作为辩证逻辑学的范畴",
                  mark="第一部分　抽象与具体的范畴作为辩证逻辑学的范畴", skip=(1,)),
    "ch004": dict(kind="section", split=(3,)),
    "ch005": dict(kind="section"),
    "ch006": dict(kind="section"),
    "ch007": dict(kind="section"),
    "ch008": dict(kind="section"),
    "ch009": dict(kind="section"),
    "ch010": dict(kind="section"),
    "ch011": dict(kind="section"),
    "ch012": dict(kind="section"),
    "ch013": dict(kind="chapter", open=("第　二　章", "思维的抽象——概念"),
                  toc="第二章　思维的抽象——概念",
                  mark="第二章　思维的抽象——概念", skip=(1,)),
    "ch014": dict(kind="section"),
    "ch015": dict(kind="section"),
    "ch016": dict(kind="section"),
    "ch017": dict(kind="section"),
    "ch018": dict(kind="section"),
    "ch019": dict(kind="chapter", open=("第　三　章", "抽象与具体的重合——思维的规律"),
                  toc="第三章　抽象与具体的重合——思维的规律",
                  mark="第三章　抽象与具体的重合——思维的规律", skip=(1, 2)),
    "ch020": dict(kind="section", split=(3,)),
    "ch021": dict(kind="section", split=(3,),
                  override="3. 具体性的螺旋形性质——在现实中，也在对它的理论反映中"),
    "ch022": dict(kind="section", split=(3,)),
    "ch023": dict(kind="section"),
    "ch024": dict(kind="part",
                  open=("第　二　部　分", r"从抽象上升到具体\\[0.4ex]作为与辩证法相适应的逻辑形式"),
                  toc="第二部分　从抽象上升到具体作为与辩证法相适应的逻辑形式",
                  mark="第二部分　从抽象上升到具体作为与辩证法相适应的逻辑形式", skip=(1,)),
    "ch025": dict(kind="section"),
    "ch026": dict(kind="section", split=(3,)),
    "ch027": dict(kind="section", split=(3,)),
    "ch028": dict(kind="section"),
    "ch029": dict(kind="chapter", open=("第　五　章", "逻辑发展与具体历史主义"),
                  toc="第五章　逻辑发展与具体历史主义",
                  mark="第五章　逻辑发展与具体历史主义", skip=(1,)),
    "ch030": dict(kind="section", split=(3,)),
    "ch031": dict(kind="section"),
    "ch032": dict(kind="chapter",
                  open=("第　六　章", "马克思《资本论》中从抽象上升到具体的方法"),
                  toc="第六章　马克思《资本论》中从抽象上升到具体的方法",
                  mark="第六章　马克思《资本论》中从抽象上升到具体的方法",
                  skip=(1, 2), split=(4,)),
    "ch033": dict(kind="section"),
    "ch034": dict(kind="section", split=(3,)),
    "ch035": dict(kind="section"),
    "ch036": dict(kind="appendix",
                  open=(None, r"辩证法和形式逻辑中\\[0.4ex]对抽象的东西与具体的东西的理解"),
                  toc="I. 辩证法和形式逻辑中对抽象的东西与具体的东西的理解",
                  mark="辩证法和形式逻辑中对抽象的东西与具体的东西的理解", skip=(1, 2)),
    "ch037": dict(kind="appendix", open=(None, "答　雅·阿·克龙罗德"),
                  toc="II.1. 答 雅·阿·克龙罗德（卡·马克思《资本论》与价值问题）",
                  mark="答 雅·阿·克龙罗德", skip=(1,)),
    "ch038": dict(kind="appendix", open=(None, "为在经济学家会上的发言而作"),
                  toc="II.2. 为在经济学家会上的发言而作",
                  mark="为在经济学家会上的发言而作", skip=(1,)),
    "ch039": dict(kind="appendix", open=(None, "关于商品生产问题"),
                  toc="II.3. 关于商品生产问题",
                  mark="关于商品生产问题", skip=(1,)),
    "ch040": dict(kind="appendix", open=(None, "为谈论马克思而作"),
                  toc="II.4. 为谈论马克思而作",
                  mark="为谈论马克思而作", skip=(1,)),
    "ch041": dict(kind="appendix", open=(None, "论 Wert 一词的翻译"),
                  toc="II.5. 论 Wert 一词的翻译",
                  mark="论 Wert 一词的翻译", skip=(1,)),
}

# 附录文章头的特殊块：署名右对齐、日期右对齐、括号副标题居中
SIGNATURE = "埃·瓦·伊里因科夫"
DATE_RE = re.compile(r"^(\d{4} 年 \d{1,2} 月 \d{1,2} 日|24\.II\.65)$")


def unit_body(unit: str) -> tuple[str, list[str]]:
    """把一个单元转成 LaTeX 正文（结构块按 STRUCTURE 处理）。"""
    meta = STRUCTURE[unit]
    report: list[str] = []
    blocks = anchors(PROJECT / "units" / unit / "final.md", unit)
    if not blocks:
        raise SystemExit(f"{unit}: 缺少 final.md")

    footnotes: dict[str, str] = {}
    body: list[tuple[int, str]] = []
    for key in sorted(blocks):
        index = int(key[-4:])
        text = blocks[key]
        m = re.match(r"^\[\^([A-Za-z0-9._-]+)\]:\s*(.*)$", text, re.S)
        if m:
            footnotes[m.group(1)] = m.group(2)
            continue
        body.append((index, text))

    skip = set(meta.get("skip", ()))
    splits = set(meta.get("split", ()))
    out: list[str] = []
    # 去重：块 1 章题若与随后的编号节题同文（ch004 型），丢块 1
    texts = {i: t for i, t in body}
    for start in splits:
        if start in texts and start + 1 in texts:
            merged = meta.get("override") or (
                re.sub(r"^#+\s*", "", texts[start]).rstrip()
                + re.sub(r"^#+\s*", "", texts[start + 1]).lstrip())
            texts[start] = "### " + re.sub(r"^#+\s*", "", merged)
            skip.add(start + 1)
    # ch004 型页题去重
    head_idx = [i for i, t in sorted(texts.items()) if t.startswith("###") and i not in skip]
    if len(head_idx) >= 2 and 1 not in skip:
        a = re.sub(r"^#+\s*\d*\.?\s*", "", texts[head_idx[0]]).strip()
        b = re.sub(r"^#+\s*\d*\.?\s*", "", texts[head_idx[1]]).strip()
        if head_idx[0] == 1 and (a == b or b.startswith(a) or a.startswith(b)):
            skip.add(1)

    for index, text in sorted(texts.items()):
        if index in skip:
            continue
        if text.startswith("〔底本来源："):
            continue
        stripped = text.strip()
        if stripped.startswith("###") and re.sub(r"^#+\s*", "", stripped) == "注释":
            continue
        if text.startswith("###"):
            title = re.sub(r"^#+\s*", "", text).strip()
            out.append(r"\booksection{" + escape(title) + "}")
            continue
        if stripped == SIGNATURE:
            out.append(r"\begin{flushright}" + escape(stripped) + r"\end{flushright}")
            continue
        if DATE_RE.match(stripped):
            out.append(r"\begin{flushright}" + escape(stripped) + r"\end{flushright}")
            continue
        if meta["kind"] == "appendix" and stripped.startswith("（") and stripped.endswith("）") and index <= 3:
            out.append(r"\begin{center}" + escape(stripped) + r"\end{center}")
            continue
        if text.startswith("＊　＊　＊"):
            rest = text[len("＊　＊　＊"):].lstrip("\n")
            out.append(r"\begin{center}＊\quad＊\quad＊\end{center}")
            if rest.strip():
                out.append(convert_inline(rest, footnotes, report))
            continue
        out.append(convert_inline(text, footnotes, report))
    tex = "\n\n".join(out).replace("\u2011", "\u2013") + "\n"
    return tex, [f"{unit}: {r}" for r in report]


def unit_tex(unit: str) -> tuple[str, list[str]]:
    meta = STRUCTURE[unit]
    body, report = unit_body(unit)
    head: list[str] = []
    kind = meta["kind"]
    if kind in ("front", "part", "chapter", "appendix"):
        num, title = meta["open"]
        head.append(r"\bookchapteropen{%s}{%s}" % (num or "", title))
        head.append(r"\phantomsection\addcontentsline{toc}{chapter}{%s}"
                    % escape(meta["toc"]))
        head.append(r"\markboth{%s}{%s}" % (escape(meta["mark"]), escape(meta["mark"])))
    return "\n".join(head) + "\n\n" + body, report


MAIN_TEMPLATE = r"""% ── 全书构建产物：勿手改，由 scripts/build_book.py 生成 ──
\documentclass[zihao=5,twoside,fontset=macnew,UTF8]{ctexbook}

\usepackage{geometry}
\geometry{papersize={140mm,203mm},inner=17mm,outer=15mm,top=24.5mm,
  headsep=0.5mm,textheight=160.5mm,footskip=9mm}

\input{preamble}
\input{version}

\ctexset{
  section/format     = \centering\heiti\zihao{4},
  section/numbering  = false,
  section/beforeskip = 3.2ex plus .5ex,
  section/afterskip  = 2.6ex plus .3ex,
}
\linespread{1.26}

% 节：标题＋奇数页书眉＋目录条目
\newcommand{\booksection}[1]{%
  \section*{#1}\markright{#1}\phantomsection
  \addcontentsline{toc}{section}{#1}}

% 目录：铅字宋体风格、小五号，章、节都用密点线引导（徐禾式）
\newCJKfontfamily\booktocfont{Songti SC}
\newfontfamily\booktoclatinfont{Songti SC}
\makeatletter
\renewcommand{\@dotsep}{1.5}
\renewcommand*\l@chapter[2]{\@dottedtocline{0}{0em}{1.2em}{#1}{#2}}
\renewcommand*\l@section[2]{\@dottedtocline{1}{1.6em}{2.4em}{#1}{#2}}
\makeatother
\renewcommand{\contentsname}{目\quad 录}
\setcounter{tocdepth}{1}

\newcommand{\booktableofcontents}{%
  \clearpage
  \pdfbookmark[0]{目录}{book-toc}%
  \begingroup
    \ctexset{
      chapter/format     = \centering\booktocfont\bfseries\zihao{3},
      chapter/beforeskip = 5.65em,
      chapter/afterskip  = 1em,
    }%
    \booktocfont\booktoclatinfont\zihao{-5}\linespread{1.38}\selectfont
    \tableofcontents
  \endgroup
  \clearpage}

\begin{document}

% ── 版本页 ──
\pdfbookmark[0]{版本页}{version-page}
\thispagestyle{empty}
\vspace*{\fill}
\begin{center}
  {\songti\zihao{2} 科学理论思维中\\[0.5ex]抽象与具体的辩证法}\\[3ex]
  {\zihao{4} 〔苏〕埃·瓦·伊里因科夫\quad 著}\\[2.5ex]
  {\zihao{-4} 据 1997 年俄文完整版译出}\\[8ex]
  \rule{0.55\linewidth}{0.4pt}\\[2.2ex]
  {\zihao{-5}
  \bookversion\quad·\quad\bookcommit\quad·\quad\bookdate\\[1.2ex]
  \href{\latesturl}{获取最新版}\\[1.8ex]
  （草稿本：前置材料尚待补充）\par}
\end{center}
\vspace*{\fill}
\clearpage

\frontmatter
\booktableofcontents
%%FRONT%%
\mainmatter
%%BODY%%
\end{document}
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-pdf", action="store_true", help="只生成 .tex 不编译")
    parser.add_argument(
        "--font-file",
        type=Path,
        help="方正新书宋 + Lusitana 混合字体；也可设置 ILYENKOV_BOOK_FONT",
    )
    args = parser.parse_args()

    BUILD.mkdir(parents=True, exist_ok=True)
    shutil.copy(SAMPLE_PREAMBLE, BUILD / "preamble.tex")
    font_file = args.font_file
    if font_file is None:
        configured = os.environ.get("ILYENKOV_BOOK_FONT")
        font_file = (
            Path(configured).expanduser()
            if configured
            else Path.home() / "Downloads" / "FZXSS-Lusitana-Hybrid.ttf"
        )
    if not font_file.is_file():
        parser.error(f"找不到构建字体：{font_file}")
    shutil.copyfile(font_file, BUILD / "book-font.ttf")

    commit = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"],
                            capture_output=True, text=True).stdout.strip()
    (BUILD / "version.tex").write_text(
        "\\renewcommand{\\bookversion}{v0.1-draft}\n"
        f"\\renewcommand{{\\bookcommit}}{{{commit}}}\n"
        f"\\renewcommand{{\\bookdate}}{{{date.today().isoformat()}}}\n",
        encoding="utf-8")

    reports: list[str] = []
    front_inputs: list[str] = []
    body_inputs: list[str] = []
    for unit in sorted(STRUCTURE):
        tex, rep = unit_tex(unit)
        (BUILD / f"{unit}.tex").write_text(tex, encoding="utf-8")
        reports += rep
        target = front_inputs if STRUCTURE[unit]["kind"] == "front" else body_inputs
        target.append(f"\\input{{{unit}}}")

    main_tex = MAIN_TEMPLATE.replace("%%FRONT%%", "\n".join(front_inputs))
    main_tex = main_tex.replace("%%BODY%%", "\n".join(body_inputs))
    (BUILD / "main.tex").write_text(main_tex, encoding="utf-8")
    print(f"已生成 {BUILD.relative_to(ROOT)}/：{len(STRUCTURE)} 个单元")
    if reports:
        print("转换报告（须人核）：")
        for r in reports:
            print("  " + r)

    if args.no_pdf:
        return 0
    for i in (1, 2):
        run = subprocess.run(
            ["xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"],
            cwd=BUILD, capture_output=True, text=True)
        if run.returncode != 0:
            tail = "\n".join(run.stdout.splitlines()[-25:])
            print(f"第 {i} 遍编译失败：\n{tail}")
            return 1
    log = (BUILD / "main.log").read_text(encoding="utf-8", errors="replace")
    missing = log.count("Missing character")
    pages = re.search(r"\((\d+) pages", log)
    print(f"编译完成：{pages.group(1) if pages else '?'} 页，缺字形 {missing} 处")
    return 0


if __name__ == "__main__":
    sys.exit(main())
