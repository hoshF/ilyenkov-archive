#!/usr/bin/env python3
"""把 42 个单元的 `final.md` 合成一份完整的中文长文。

翻译工作按“单元”切分（对应底本的 42 个 HTML 文件），每个单元的 `final.md` 里
每一块都挂在 `## chNNN-pNNNN` 锚点下。锚点是**工作脚手架**——它让机器能逐块比对
译文与原文，是全部结构检查的基础，但它不是书的一部分。

本脚本产出的是“读者看到的样子”：去掉锚点，合并被底本拆开的标题，剔除数字化
附加的来源注记，得到一份与底本同形的中文 Markdown 长文。

**这是派生文件，不是正本。** 正本永远是各单元的 `final.md`；改译文要回到那里
并重走审校（STYLE_GUIDE 第十节）。本文件随时可以重新生成。

用法：
    python3 scripts/build_merged_translation.py            # 写到默认位置
    python3 scripts/build_merged_translation.py --stdout   # 只打印，不写文件
    python3 scripts/build_merged_translation.py --check    # 校验现有文件是否最新
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audit_unit import PROJECT, anchors, source_blocks  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = PROJECT / "科学理论思维中抽象与具体的辩证法.md"

# 一个标题被底本的换行拆成两块的位置（STYLE_GUIDE 第十节，2026-07-24 逐块核实）。
# 键是单元号，值是「起始块号」——该块与紧接的下一块本是一句，合回一个标题。
#
# **ch037、ch038、ch041 不在此列**：它们块 2 的内容（括号副标题、日期）在底本里
# 是**另一个独立元素**，不是被拆开的标题后半截（见 STYLE_GUIDE 第二节附录布局表）。
# 合并它们会得到「为在经济学家会上的发言而作24.II.65」这样把日期粘进标题的结果。
SPLIT_TITLES: dict[str, tuple[int, ...]] = {
    "ch004": (3,),
    "ch019": (1,),
    "ch020": (3,),
    "ch021": (3,),
    "ch022": (3,),
    "ch026": (3,),
    "ch027": (3,),
    "ch030": (3,),
    "ch032": (1, 4),
    "ch034": (3,),
    "ch036": (1,),
}

# 两处直接拼接读不通，须给定合并后的成品。键是 (单元, 起始块号)。
#
# * ch036 是语序问题：俄语把介词短语放在中心词之后、汉语放在之前，直接连起来成了
#   “……的理解在辩证法和形式逻辑之中”。合并后须用自然语序，且必须与 ch000 目录条目
#   一致（见 ch036 与 ch000 的 issues.md）。
# * ch021 是断句问题：两半直接相连成了“性质在现实中”，会被读成“性质处在现实里”。
#   该单元块 1 的章标题译文本来就带破折号，合并稿用同一形式，二者随即一致、可去重。
REORDERED: dict[tuple[str, int], str] = {
    ("ch036", 1): "### 辩证法和形式逻辑中对抽象的东西与具体的东西的理解",
    ("ch021", 3): "### 3. 具体性的螺旋形性质——在现实中，也在对它的理论反映中",
}

FRONT_MATTER = """---
title: "科学理论思维中抽象与具体的辩证法"
created: "2026-07-25"
type: "writing"
tags: ["translation", "ilyenkov", "chinese-final", "merged"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
text_role: "modern_translation"
core_corpus_eligible: "false"
source_format: "markdown"
source_license: "not_stated"
redistribution_approved: "false"
rights_review_status: "unreviewed"
text_status: "translation_reviewed"
source_url: "http://filorus.ru/ilyenkov/texts/daik/index.html"
---
"""

PREAMBLE = """<!--
本文件由 scripts/build_merged_translation.py 从 42 个单元的 final.md 生成，**请勿手改**。
正本是 translation_workspace/reviewed/ilyenkov/<work>/units/chNNN/final.md；
修订译文须回到那里并重走审校，然后重新生成本文件。

底本：安德烈·迈丹斯基网站（filorus.ru）的 1997 年完整版 HTML 转换本。
各单元的底本出处行已按体例剔除（它们是数字化附加的，不属于原书内容）。
-->
"""


def unit_ids() -> list[str]:
    return sorted(p.name for p in (PROJECT / "units").iterdir() if p.is_dir())


def build() -> str:
    parts: list[str] = [FRONT_MATTER, PREAMBLE]
    for unit in unit_ids():
        blocks = anchors(PROJECT / "units" / unit / "final.md", unit)
        if not blocks:
            raise SystemExit(f"{unit}: 缺少 final.md")
        source = source_blocks(unit)
        splits = SPLIT_TITLES.get(unit, ())
        skip: set[int] = set()
        rendered: list[str] = []
        for index in range(1, len(blocks) + 1):
            if index in skip:
                continue
            text = blocks[f"{unit}-p{index:04d}"]

            # 数字化附加的出处行不属于原书内容。
            if text.startswith("〔底本来源："):
                continue

            # 被底本拆成两块的标题在这里合回一个。
            if index in splits:
                nxt = blocks[f"{unit}-p{index + 1:04d}"]
                skip.add(index + 1)
                override = REORDERED.get((unit, index))
                if override:
                    text = override
                else:
                    text = text.rstrip() + re.sub(r"^#+\s*", "", nxt).lstrip()

            # 标题层级照底本还原。译稿里章题只能写 `###`——因为 `##` 被锚点占着；
            # 锚点去掉后二级标题空了出来，于是照源文该块的实际层级还原
            # （ch000 块 1 是全书唯一的 `#`，各章块 1 与 ch000 块 4 是 `##`，
            # 「注释」小标题是 `###`）。源文不是标题的块（节题在底本里是普通段落，
            # 是译稿把它们标成了 `###`）保持 `###` 不变。
            source_head = re.match(r"^(#+)\s", source[index - 1])
            if source_head and text.startswith("#"):
                text = f"{source_head.group(1)} " + re.sub(r"^#+\s*", "", text)

            rendered.append(text)
        parts.append("\n\n".join(drop_duplicate_chapter_title(rendered)))
    return "\n\n".join(parts).rstrip() + "\n"


def drop_duplicate_chapter_title(rendered: list[str]) -> list[str]:
    """去掉与紧随其后的节标题重复的章标题。

    底本每个 HTML 页都带一个页标题，页内又把同一句重复一次作节标题——分成 42 个
    文件时这很自然，合成一本书就成了**重复 26 次**。目录也证明二者是同一个条目：
    ch004 在目录里只占一行，不是两行。

    保留带编号的那个（“2. 术语「具体」及其历史命运……”），因为编号是全书结构的一
    部分；章级的裸标题丢掉。`第一部分`／`第二章` 一类真正的章级标题与其后的节标题
    并不同文，不受影响。

    **保留下来的节标题仍是 `###`，不提升到 `##`。** 全书层级是 部分／章 用 `##`、
    节用 `###`：第一部分下有第二章、第三章，第二部分下有第五章、第六章（第一章与
    第四章在底本里没有独立标题块，由部标题兼任）。把节提到 `##` 会让“2. 马克思对
    科学发展过程的看法”同“第五章”并列，层级就塌了。
    """

    if len(rendered) < 2 or not rendered[0].startswith("## "):
        return rendered
    title = rendered[0][3:].strip()
    for index in range(1, min(4, len(rendered))):
        candidate = rendered[index]
        if not candidate.startswith("###"):
            continue
        section = re.sub(r"^#+\s*\d*\.?\s*", "", candidate).strip()
        if section and (section == title or title.startswith(section) or section.startswith(title)):
            return rendered[1:]
        break
    return rendered


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--stdout", action="store_true", help="只打印，不写文件")
    group.add_argument("--check", action="store_true", help="校验现有文件是否最新")
    args = parser.parse_args()

    text = build()
    if args.stdout:
        sys.stdout.write(text)
        return 0
    if args.check:
        if not OUTPUT.is_file():
            print(f"error: 缺少 {OUTPUT.relative_to(ROOT)}，请跑一次本脚本")
            return 1
        if OUTPUT.read_text(encoding="utf-8") != text:
            print(f"error: {OUTPUT.relative_to(ROOT)} 已过期，请重新生成")
            return 1
        print(f"merged translation: OK（{len(text)} 字符）")
        return 0

    OUTPUT.write_text(text, encoding="utf-8")
    chars = len(re.sub(r"\s", "", text))
    print(f"已写入 {OUTPUT.relative_to(ROOT)}")
    print(f"  {len(text.splitlines())} 行｜约 {chars} 个非空白字符")
    return 0


if __name__ == "__main__":
    sys.exit(main())
