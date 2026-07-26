#!/usr/bin/env python3
"""把起草 prompt 模板里的两个「清单」小节从各自的正本生成出来。

生成两块：

* 【常见错误】 ← `notes/STYLE_GUIDE.md` 第七节的错误清单
* 【术语约定】 ← `ilyenkov_markdown/metadata/glossary.json` 的 concept 条目

为什么要生成而不是手抄——两次都已经吃过亏：

* 错误清单长到 31 条时，模板只带着 17 条，第 11、22、24、25 条（引号层级、引语状语被挪出
  引号、修饰语挂错分句、逻辑关系换成时间关系）学到了、写进了规范，却从没到过起草方手里。
* 术语约定同样漂移：术语表 33 个 concept 条目里有 16 条不在模板中，其中
  `coincidence`（совпадение→重合）是刚因 ch020 的阻断错误登记的 approved 条目。

两块都设**分类关卡**：新增一条错误、或新增一个 concept 条目而未分类时，本脚本报错。
这是强制分类的关卡，不是可选的提醒——漏项正是靠“下次记得同步”才发生的。

用法：
    python3 scripts/render_prompt_template.py --write   # 写回模板
    python3 scripts/render_prompt_template.py --check   # 校验模板是否最新
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLE_GUIDE = ROOT / "notes" / "STYLE_GUIDE.md"
GLOSSARY = ROOT / "ilyenkov_markdown" / "metadata" / "glossary.json"
TEMPLATE = ROOT / "translation_workspace" / "templates" / "codex_prompt.md"

MISTAKES_BEGIN = "<!-- BEGIN 常见错误（由 scripts/render_prompt_template.py 生成，勿手改） -->"
MISTAKES_END = "<!-- END 常见错误 -->"
TERMS_BEGIN = "<!-- BEGIN 术语约定（由 scripts/render_prompt_template.py 生成，勿手改） -->"
TERMS_END = "<!-- END 术语约定 -->"

# ── 错误清单的分类 ───────────────────────────────────────────────────────────
# 起草方必须看到的条目：凡是译文本身可能犯的错。
DRAFTER = {1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 18, 19, 20, 22, 23, 24, 25, 27, 29, 30, 32, 34, 36}

# 只写给审计方的条目：讲的是 prompt 怎么写、提交怎么做、术语表怎么改。
AUDITOR_ONLY = {10, 14, 16, 26, 28, 31, 33, 35, 37}

# 由模板的其他小节承担，不必在【常见错误】里重复一遍。
COVERED_ELSEWHERE = {
    15: "【两稿分工】的“定稿不得是初译的副本”与机器检查",
    17: "【两稿分工】的“重写不等于必须改动”",
    21: "【术语约定】的 логика 三分与“句首大写不构成判据”",
}

# ── 术语表的分类 ─────────────────────────────────────────────────────────────
# 要写进 prompt 的条目，**按此顺序渲染**：先成对、成组的易混词，再单条规则。
# 顺序是人定的（相邻条目应当互相参照），内容一律取自 glossary.json，不在此处复写。
PROMPT_TERMS: tuple[str, ...] = (
    "concrete",
    "abstract",
    "concrete-universal",
    "abstract-universal",
    "concrete-historical",
    "universal",
    "general",
    "individual",
    "separate",
    "particular",
    "particular-case",
    "specific",
    "essence",
    "nature",
    "presupposition",
    "substance",
    "coincidence",
    "sublation",
    "modus",
    "modification",
    "right-law",
    "relative-independence",
    "technology",
    "logic",
    "reason",
    "understanding",
    "sozertsanie",
    "representation",
    "reflection",
    "reflection-nachdenken",
    "reflexion-mirror",
    "sense-certainty",
    "sensuousness",
    "ideal",
    "objectification",
    "alienation",
    "antinomy",
    "apriori",
    "genus",
    "thought",
    "comprehension",
    "rational-kernel",
    "protein-body",
)

# 标准固定译名，起草方不需要额外指令；列在这里是为了证明“看过并决定不写”，
# 而不是漏掉。新增 concept 条目时必须在这里或 PROMPT_TERMS 里出现。
SKIP_TERMS: dict[str, str] = {
    "dialectics": "辩证法，标准固定译名",
    "labor": "劳动，标准固定译名",
    "consciousness": "意识，标准固定译名",
    "practice": "实践，标准固定译名",
    "being": "存在，标准固定译名",
    "truth": "真理，标准固定译名",
    "contradiction": "矛盾，标准固定译名",
    "activity": "活动，标准固定译名",
    "objective-activity": "对象性活动；与 objectification 重叠，后者已进 prompt",
    "identity-thinking-being": "思维与存在的同一性，整词固定，无选择余地",
}


def parse_mistakes(text: str) -> dict[int, tuple[str, str, str]]:
    """取第七节表格的 (编号, 错误, 首次发现, 防范)。"""
    section = text.split("## 七、常见错误与防范")[1].split("\n## ")[0]
    rows: dict[int, tuple[str, str, str]] = {}
    for line in section.splitlines():
        match = re.match(r"^\| (\d+) \| (.+?) \| (.+?) \| (.+?) \|\s*$", line)
        if match:
            rows[int(match.group(1))] = (
                match.group(2).strip(),
                match.group(3).strip(),
                match.group(4).strip(),
            )
    return rows


def parse_terms(data: dict) -> dict[str, dict]:
    return {
        entry["id"]: entry
        for entry in data.get("entries", [])
        if entry.get("category") == "concept"
    }


def classification_errors(
    mistakes: dict[int, tuple[str, str, str]], terms: dict[str, dict]
) -> list[str]:
    errors: list[str] = []
    known_rows = DRAFTER | AUDITOR_ONLY | set(COVERED_ELSEWHERE)
    for number in sorted(set(mistakes) - known_rows):
        errors.append(
            f"错误清单第 {number} 条尚未分类：请在 render_prompt_template.py 里把它归入 "
            "DRAFTER（起草方要看）、AUDITOR_ONLY（只给审计方）或 COVERED_ELSEWHERE（模板别处已覆盖）"
        )
    for number in sorted(known_rows - set(mistakes)):
        errors.append(f"分类表里的错误清单第 {number} 条已不存在于 STYLE_GUIDE，请删除该分类")

    known_terms = set(PROMPT_TERMS) | set(SKIP_TERMS)
    for term_id in sorted(set(terms) - known_terms):
        entry = terms[term_id]
        errors.append(
            f"术语表条目 {term_id}（{entry.get('canonical')}→{entry.get('zh_preferred')}）尚未分类："
            "请在 render_prompt_template.py 里加进 PROMPT_TERMS（要进起草 prompt）"
            "或 SKIP_TERMS（标准固定译名，附理由）"
        )
    for term_id in sorted(known_terms - set(terms)):
        errors.append(f"分类表里的术语条目 {term_id} 已不存在于 glossary.json，请删除该分类")
    return errors


def render_mistakes(rows: dict[int, tuple[str, str, str]]) -> str:
    lines = [
        MISTAKES_BEGIN,
        "【常见错误（本项目实际发生过，务必逐条避免）】",
        "（**编号与 `notes/STYLE_GUIDE.md` 第七节错误清单一致**，便于对照与回查；",
        "  编号不连续是正常的——缺的那些是写给审计方的条目。）",
        "",
    ]
    for number in sorted(DRAFTER):
        mistake, found, guard = rows[number]
        # “错误”一栏常自带 **…** 强调；再包一层会生成 ****，Markdown 会失效。
        headline = mistake if "**" in mistake else f"**{mistake}**"
        lines.append(f"{number}. {headline}（首次发现：{found}）")
        lines.append(f"   → {guard}")
    lines.append(MISTAKES_END)
    return "\n".join(lines)


def render_terms(terms: dict[str, dict]) -> str:
    lines = [
        TERMS_BEGIN,
        "【术语约定（正本是 glossary.json，本节由它生成）】",
        "（**术语表只能读，绝对不能改**。缺条目或有疑问，只写进报告，由审计方裁定。）",
        "",
    ]
    for term_id in PROMPT_TERMS:
        entry = terms[term_id]
        lines.append(f"- `{entry.get('canonical', '')}`→**{entry.get('zh_preferred', '')}**")
        notes = (entry.get("notes") or "").strip()
        if notes:
            lines.append(f"  {notes}")
    lines.append(TERMS_END)
    return "\n".join(lines)


def replace_block(text: str, begin: str, end: str, wanted: str) -> tuple[str, str | None]:
    if begin not in text or end not in text:
        return text, None
    start = text.index(begin)
    stop = text.index(end) + len(end)
    return text[:start] + wanted + text[stop:], text[start:stop]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true", help="把两块清单写回模板")
    group.add_argument("--check", action="store_true", help="校验模板中的两块清单是否最新")
    args = parser.parse_args()

    mistakes = parse_mistakes(STYLE_GUIDE.read_text(encoding="utf-8"))
    terms = parse_terms(json.loads(GLOSSARY.read_text(encoding="utf-8")))
    if not mistakes or not terms:
        print("error: 未能解析出错误清单或术语表条目")
        return 1

    errors = classification_errors(mistakes, terms)
    if errors:
        for error in errors:
            print(f"error: {error}")
        return 1

    text = TEMPLATE.read_text(encoding="utf-8")
    updated = text
    for begin, end, wanted, name in (
        (MISTAKES_BEGIN, MISTAKES_END, render_mistakes(mistakes), "常见错误"),
        (TERMS_BEGIN, TERMS_END, render_terms(terms), "术语约定"),
    ):
        updated, existing = replace_block(updated, begin, end, wanted)
        if existing is None:
            print(f"error: 模板缺少【{name}】的生成标记（{begin} … {end}）")
            return 1
        if args.check and existing != wanted:
            print(f"error: codex_prompt.md 的【{name}】已过期，请跑 --write")
            return 1

    if args.check:
        print(
            f"prompt template: OK（起草方错误 {len(DRAFTER)}／{len(mistakes)} 条，"
            f"术语 {len(PROMPT_TERMS)}／{len(terms)} 条）"
        )
        return 0

    TEMPLATE.write_text(updated, encoding="utf-8")
    print(
        f"prompt template: 已写入错误 {len(DRAFTER)} 条、术语 {len(PROMPT_TERMS)} 条"
        f"（清单共 {len(mistakes)} 条，术语表 concept 共 {len(terms)} 条）"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
