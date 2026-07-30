#!/usr/bin/env python3
r"""把全书 42 个单元拼装成一个 LaTeX 工程并（可选）编译。

结构映射（部/章/节/附录）写死在本文件的 STRUCTURE 表里——它是从底本逐块核出的
（部与第一、四章共用标题块；第二、三、五、六章各有标题块；附录五篇各自成章）。
ch000 整个跳过：它的扉页由我们的版本页承担，目录由 LaTeX 生成（点线引导＋真实
页码，徐禾式）——目录条目取自各章实际标题，与 ch000 的手抄清单逐字同源。

版式的唯一权威是 book/template/ 里的 main.tex 与 preamble.tex（项目标准出版模板）。
本脚本只读它们、填占位符、复制进 build/——**不要把版式设置搬回本文件**，
那正是先前三份副本互相走样的原因。单本书专属的信息集中在下面的 BOOK 表里。
版本号、commit、日期在构建时从 git 刻入 version.tex，覆盖导言里的兜底宏。

前置材料（book/front/）由 scripts/build_front_matter.py 转成 LaTeX，
本脚本每次构建先跑它，再复制与 \input，免得改了 .md 而书里还是旧的。

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
from md_to_latex import (  # noqa: E402
    convert_footnote, convert_inline, escape, parse_footnote_block,
)

BUILD = ROOT / "book" / "build"
TEMPLATE = ROOT / "book" / "template"
TEMPLATE_MAIN = TEMPLATE / "main.tex"
TEMPLATE_PREAMBLE = TEMPLATE / "preamble.tex"

# 单本书专属的信息。模板是系列共用的，这里是本书的那一份。
BOOK = {
    "PDFTITLE": "科学理论思维中抽象与具体的辩证法",
    "PDFAUTHOR": "埃·瓦·伊里因科夫",
    "BOOKTITLE": r"科学理论思维中\\[0.5ex]抽象与具体的辩证法",
    "BOOKAUTHOR": r"〔苏〕埃·瓦·伊里因科夫\quad 著",
    "BOOKEDITION": "据 1997 年俄文完整版译出",
    "BOOKSTATUS": "（草稿本：底本尚未与纸本核对）",
}

# ── 结构表 ────────────────────────────────────────────────────────────────────
# 每个单元一条：
#   kind  : front | part | chapter | appendix | section
#   open  : (拉开字距的编号行, 标题行)——章级开头页两行；None 表示无编号行
#   toc   : 目录条目（None＝沿用节标题；章级必填）
#   mark  : 偶数页书眉（章级设定后延续到下一章级）；节的奇数页眉自动取节标题
#   skip  : 结构已承担、正文里要跳过的块号
#   split : 节标题被底本拆开处 (起始块号,)；override 给定合并成品
STRUCTURE: dict[str, dict] = {
    # 副标题〔为德文版而作〕是标题的一部分，不是节：并入开篇、小一号
    "ch001": dict(kind="front",
                  open=("作　者　序", r"{\zihao{4}〔为德文版而作〕}"),
                  toc="作者序〔为德文版而作〕",
                  mark="作者序", skip=(1, 2)),
    # 块 3／4 是列宁题词与署名，全书仅此一处
    "ch002": dict(kind="front", open=(None, "序　言"), toc="序言",
                  mark="序言", skip=(1,), epigraph=(3, 4)),
    "ch003": dict(kind="part",
                  open=("第　一　部　分", r"抽象与具体的范畴\\[0.4ex]作为辩证逻辑学的范畴"),
                  toc="第一部分　抽象与具体的范畴作为辩证逻辑学的范畴",
                  mark="第一部分　抽象与具体的范畴作为辩证逻辑学的范畴", skip=(1,),
                  open2=("第　一　章", "对“具体”的形而上学理解与辩证理解"),
                  toc2="第一章　对“具体”的形而上学理解与辩证理解"),
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
                  mark="第二部分　从抽象上升到具体作为与辩证法相适应的逻辑形式", skip=(1,),
                  open2=("第　四　章", "“具体”与辩证发展"),
                  toc2="第四章　“具体”与辩证发展"),
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


def norm_head(text: str) -> str:
    """页标题与节标题的可比形式。

    底本每页顶端重复一次章标题，节标题另起一处；两处的标点未必一致
    （ch005 块 1 有句点、块 3 没有），而译文按块忠实照录。去重比较因此
    必须先抹掉序号与句读，只看正文字面。
    """
    text = re.sub(r"^#+\s*\d*\.?\s*", "", text)
    return re.sub(r"[。．.\s]", "", text)


CN_NUM = "〇一二三四五六七八九"


def section_label(title: str) -> str:
    """把底本的数字编号「4. …」改排成「第四节　…」（所有者定，照参考本）。

    编号在每章之内从 1 重排，全书最大到 10。数字本身来自底本，**不动 final.md**：
    只在成书时换写法，正文、目录、书眉三处一致。「节」后空一个全角空格——
    参考本实测正是 1.00 个字宽（标题与书眉都是）。
    """
    m = re.match(r"^(\d+)\.\s*(.+)$", title)
    if not m:
        return title
    n, rest = int(m.group(1)), m.group(2)
    if n < 10:
        cn = CN_NUM[n]
    elif n < 20:
        cn = "十" + (CN_NUM[n - 10] if n > 10 else "")
    else:
        cn = CN_NUM[n // 10] + "十" + (CN_NUM[n % 10] if n % 10 else "")
    return f"第{cn}节\u3000{rest}"


def running_head(title: str, limit: int = 30) -> str:
    """节标题在书眉里的短形式。

    书眉是一行的盒子，塞不下就折行，第二行会压到书眉线和正文上——全书唯一
    触发的是那条 44 字的「4. 亚当·斯密的……斯宾诺莎观点」，实测压坏了第 223 页。
    六号在 101.9mm 书眉里约容 38 字，但中间那格右侧还有页码，故安全线取 30。

    优先断在句号处：那是文意的断处，截出来仍是完整一句；
    没有句号可断才硬截并加省略号。
    """
    if len(title) <= limit:
        return title
    cut = title.rfind("。", 0, limit + 1)
    if cut >= 8:
        return title[:cut]
    return title[:limit - 1] + "…"


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
        # 用 md_to_latex 的解析，不另抄一份：本文件曾手抄过同一条正则，
        # 于是「一个块可含多条脚注定义」的修正只落在转换器那边，成书这边照旧丢掉
        # 译注 [^zh-1]——转换器报了「无定义」，但报告在终端、书里那条注就没了。
        if text.startswith("[^"):
            footnotes.update(parse_footnote_block(text))
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
        a = norm_head(texts[head_idx[0]])
        b = norm_head(texts[head_idx[1]])
        if head_idx[0] == 1 and (a == b or b.startswith(a) or a.startswith(b)):
            skip.add(1)

    epigraph = set(meta.get("epigraph", ()))
    for index, text in sorted(texts.items()):
        if index in skip:
            continue
        if text.startswith("〔底本来源："):
            continue
        # 题词：底本网页上右对齐、字号小于正文（全书仅 ch002 一处）
        if index in epigraph:
            body = escape(text.strip())
            if index == max(epigraph):
                out.append(r"\bookepigraphby{" + body + "}")
            else:
                out.append(r"\bookepigraph{" + body + "}")
            continue
        stripped = text.strip()
        if stripped.startswith("###") and re.sub(r"^#+\s*", "", stripped) == "注释":
            continue
        if text.startswith("###"):
            title = section_label(re.sub(r"^#+\s*", "", text).strip())
            out.append(r"\booksection{" + escape(title) + "}{"
                       + escape(running_head(title)) + "}")
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
    # 第一章与第四章接在所属部分的标题下方、同页，与底本 1_1／4_1 两页一致。
    # 标题是 2026-07-29 从底本网页取回的——仓库的 markdown 转换在“一页两个标题”
    # 处只留了部分名，把章标题丢了（见 SOURCE_CRUXES 第〇节）。
    # 不改 \markboth：书眉仍用部分名，与本部分其余各节一致。
    if "open2" in meta:
        num, title = meta["open2"]
        head.append(r"\bookchapterinpart{%s}{%s}" % (num, escape(title)))
        head.append(r"\phantomsection\addcontentsline{toc}{chapter}{%s}"
                    % escape(meta["toc2"]))
    return "\n".join(head) + "\n\n" + body, report




def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-pdf", action="store_true", help="只生成 .tex 不编译")
    parser.add_argument(
        "--font-file",
        type=Path,
        help="正文字体；默认用 book/template/book-font.ttf，"
             "也可设置 ILYENKOV_BOOK_FONT 覆盖",
    )
    args = parser.parse_args()

    BUILD.mkdir(parents=True, exist_ok=True)
    shutil.copy(TEMPLATE_PREAMBLE, BUILD / "preamble.tex")
    # 正文字体已并入比例宽度的西里尔字形（scripts/merge_cyrillic_font.py）。
    # 若指向未合并的混合体，俄文会退回全角「ц е н н о с т ь」。
    font_file = args.font_file
    if font_file is None:
        configured = os.environ.get("ILYENKOV_BOOK_FONT")
        font_file = (Path(configured).expanduser() if configured
                     else ROOT / "book" / "template" / "book-font.ttf")
    if not font_file.is_file():
        parser.error(f"找不到构建字体：{font_file}")
    shutil.copyfile(font_file, BUILD / "book-font.ttf")

    # 版本页的用处就是标明「这是哪一版」。在提交前构建会刻上**上一个** commit，
    # 戳记看着确定实则错误（已犯两次）。工作区不干净就明写出来。
    commit = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"],
                            capture_output=True, text=True).stdout.strip()
    # 只看喂给这本书的东西：译文、前置、版式、字体、这几个构建脚本。
    # 仓库里别处的改动（他人在做的其他工作）与本书是哪一版无关。
    inputs = ["book/template", "book/front",
              "scripts/build_book.py", "scripts/md_to_latex.py",
              "scripts/build_front_matter.py",
              str(PROJECT.relative_to(ROOT) / "units")]
    dirty = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain", "--"] + inputs,
                           capture_output=True, text=True).stdout.strip()
    if dirty:
        commit += "+未提交改动"
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

    # 前置材料：**只有译者引言一篇**（STYLE_GUIDE 第六节，2026-07-30 裁定）。
    # 此前还排过凡例、底本说明、仓库索引、权利说明与书末术语表，已随该裁定去掉。
    # 先跑生成器，免得 .md 改过而书里还是旧的（.tex 是派生物，不入版本库）。
    subprocess.run([sys.executable, str(Path(__file__).with_name("build_front_matter.py"))],
                   check=True, capture_output=True)
    apparatus: list[str] = []
    for tex in sorted((ROOT / "book" / "front").glob("*.tex")):
        stem = f"fm-{tex.stem}"
        shutil.copyfile(tex, BUILD / f"{stem}.tex")
        apparatus.append(f"\\input{{{stem}}}")

    main_tex = TEMPLATE_MAIN.read_text(encoding="utf-8")
    for key, value in BOOK.items():
        main_tex = main_tex.replace(f"%%{key}%%", value)
    main_tex = main_tex.replace("%%APPARATUS%%", "\n".join(apparatus))
    main_tex = main_tex.replace("%%FRONT%%", "\n".join(front_inputs))
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
