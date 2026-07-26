#!/usr/bin/env python3
"""把全书当作一个文本来查：术语是否全书统一、格式是否一致。

**这不是 `audit_unit.py` 的替代。** 那个查单个单元的结构事实（锚点、斜体、括号、
两稿雷同度），是翻译过程中每章都要跑的；本脚本查的是**只有把 42 个单元并排放在一起
才看得见的东西**，跑在全书译完之后，或每次新立术语裁定之后。

为什么需要它（错误清单第 37 条、DECISIONS 第 57 行）：术语裁定是边译边立的，
**写在第 N 章的裁定，实际含义是“从第 N 章起”**——立规之前译的章从没人回头改。
全书译竣后逐词复查才发现 `специфический` 有 30 块仍作“特殊”（其中 26 块在立规之前）、
`совпадать` 有 24 块避开了“重合”。逐章审计一次也没报过，因为每一章内部都是自洽的。

三类检查：

* **术语全书扫**：源文出现某俄文词干、而译文未用约定译名的块。
  设**分类关卡**：术语表新增 concept 条目而未在此登记检查或说明跳过，本脚本报错。
  这一条是刻意的——第 37 条的防范就是“立裁定时同时跑回查”，没有关卡就会重演。
* **锚点内分段**：一个源文块被译成两段以上。锚点数不变，`audit_unit.py` 查不出来，
  但它破坏“一块对一段”的对应（DECISIONS 第 14 行），合并本会出现底本没有的分段。
* **成对符号**：中文引号、括号、书名号逐块配平；**与源文比对**，源文本就未闭合的
  （跨块引文、ch038 手稿中断处）不报。

**输出是线索，不是判决。** 术语命中须人逐条看：同一块里两个近义俄文词都在时，
机器分不出哪个中文对应哪个（`специфи` 与 `особ` 就是这样，见 ch027 p0110）。

用法：
    python3 scripts/check_book.py              # 全查
    python3 scripts/check_book.py --terms      # 只查术语
    python3 scripts/check_book.py --format     # 只查格式
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audit_unit import PROJECT, ROOT, anchors, source_blocks  # noqa: E402

GLOSSARY = ROOT / "ilyenkov_markdown" / "metadata" / "glossary.json"

# ── 术语检查表 ────────────────────────────────────────────────────────────────
# term_id: (俄文词干正则, 约定中文正则, 同块出现即跳过的俄文正则或 None)
#
# 第三项是给“近义词同块”准备的：两个俄文词都在同一块时，机器无法判定哪个中文对应
# 哪个，报出来只会是噪音。跳过的块须人另行判读——ch027 p0110 的“特殊”正确对应
# `особого`、ch036 p0113 对应 `особые`，都是这样查出来的。
OSOBOE = r"особенн\w*|особ(?:ый|ая|ое|ые|ого|ой|ому|ым|ых|ыми|ую)\b"

TERM_CHECKS: dict[str, tuple[str, str, str | None]] = {
    "specific": (r"специфи", r"特有|特性|独特|专属", OSOBOE),  # 专属于人的＝специфически человеческий
    "coincidence": (r"совпад", r"重合", None),
    "apriori": (r"априорн|априори\b", r"先天", r"трансцендентальн"),
    "concrete-historical": (r"конкретно-историческ", r"具体历史|历史地具体", None),
    "sublation": (r"\bснят(?:ие|ия|ию|ием)\b", r"扬弃", None),
    "substance": (r"субстанц", r"实体", None),
    "antinomy": (r"антиноми", r"二律背反", None),
    "sozertsanie": (r"созерцан", r"直观", None),
    "objectification": (r"опредмечиван", r"对象化", None),
    "sense-certainty": (r"чувственн\w+ достоверност", r"感性确定性", None),
    "rational-kernel": (r"рациональн\w+ зерн", r"合理内核", None),
    "protein-body": (r"белков\w+ тел", r"蛋白体", None),
    "particular-case": (r"частн\w+ случа", r"个案", None),
    "relative-independence": (r"относительн\w+ самостоятельн", r"相对独立", None),
    "technology": (r"технолог", r"工艺学|技术", None),  # 作定语时按语境作技术，见 glossary
    "understanding": (r"\bрассуд(?:ок|ка|ку|ком)\b", r"知性", None),
    "reflection-nachdenken": (r"размышлен", r"反思|思考", None),  # 非术语义的「思考」
    "reflexion-mirror": (r"рефлектир", r"反射|反思", None),
    "presupposition": (r"предпосыл", r"前提", None),
    "modification": (r"модификац", r"变化形式|改变|变态", None),
    "concrete-universal": (r"конкретно-всеобщ", r"具体的普遍物|具体普遍", None),
    "abstract-universal": (r"абстрактно-всеобщ", r"抽象的普遍物|抽象普遍", None),
    "comprehension": (r"понимани", r"理解|观(?![点察])", None),  # 「传统推演观」式的紧缩译法
    "nature": (r"природ", r"本性|自然|天然", None),
}

# 不做全书扫的条目，附理由。新增 concept 条目时必须在这里或 TERM_CHECKS 里出现。
SKIP_CHECKS: dict[str, str] = {
    "ideal": "两义须逐处判（观念的／理想化），机器扫只会全是噪音；判据在 glossary notes",
    "logic": "三分且大小写不构成判据，无法机器判定",
    "abstract": "四分用法（范畴／提及／形容词／-ность），命中率过低",
    "concrete": "同 abstract",
    "universal": "与 общее 的分工靠语境，二者常同块",
    "general": "同 universal",
    "individual": "六词家族靠语境区分，同块并现是常态",
    "separate": "同 individual；且 отдельн* 有大量非范畴用法（各个／单独）",
    "particular": "同 individual",
    "essence": "与 природа 的分工已由 nature 一条覆盖",
    "representation": "日常义不译“表象”是明写的例外，机器分不出",
    "reflection": "отраж* 有大量非术语用法",
    "alienation": "哲学义／经济义两分，全书仅 6 次，逐处已判",
    "modus": "斯宾诺莎义／三段论义两分，全书 10 次，逐处已判",
    "right-law": "法／法律两分靠语境",
    "genus": "类／属概念两分靠语境",
    "sensuousness": "与 ощущение／чувственное восприятие 的分层靠语境",
    "contradiction": "标准固定译名，无选择余地",
    "dialectics": "标准固定译名",
    "labor": "标准固定译名",
    "consciousness": "标准固定译名",
    "practice": "标准固定译名",
    "being": "标准固定译名",
    "truth": "标准固定译名",
    "activity": "标准固定译名",
    "thought": "标准固定译名",
    "reason": "标准固定译名",
    "objective-activity": "整词固定",
    "identity-thinking-being": "整词固定",
}

PAIRS = [("“", "”"), ("‘", "’"), ("《", "》"), ("〔", "〕"), ("（", "）"), ("〈", "〉"), ("「", "」")]


def units() -> list[str]:
    return sorted(p.name for p in (PROJECT / "units").iterdir() if p.is_dir())


def classification_errors() -> list[str]:
    data = json.loads(GLOSSARY.read_text(encoding="utf-8"))
    concepts = {e["id"] for e in data["entries"] if e.get("category") == "concept"}
    known = set(TERM_CHECKS) | set(SKIP_CHECKS)
    errors = [
        f"术语表条目 {tid} 尚未登记全书检查：请在 check_book.py 里加进 TERM_CHECKS"
        "（给出俄文词干与约定中文）或 SKIP_CHECKS（附不查的理由）"
        for tid in sorted(concepts - known)
    ]
    errors += [
        f"检查表里的术语条目 {tid} 已不存在于 glossary.json，请删除"
        for tid in sorted(known - concepts)
    ]
    return errors


def check_terms() -> list[str]:
    findings: list[str] = []
    for tid, (ru, zh, skip) in sorted(TERM_CHECKS.items()):
        hits: list[str] = []
        for unit in units():
            src = source_blocks(unit)
            for name in ("literal.md", "final.md"):
                blocks = anchors(PROJECT / "units" / unit / name, unit)
                if not blocks:
                    continue
                for index, text in enumerate(src, 1):
                    key = f"{unit}-p{index:04d}"
                    zh_text = blocks.get(key, "")
                    if not re.search(ru, text, re.I):
                        continue
                    if skip and re.search(skip, text, re.I):
                        continue
                    if not re.search(zh, zh_text):
                        hits.append(f"{key}[{name[0]}]")
        if hits:
            findings.append(f"■ {tid}（{len(hits)} 处）: " + " ".join(hits[:20]) + (" …" if len(hits) > 20 else ""))
    return findings


def check_format() -> list[str]:
    findings: list[str] = []
    split_blocks: list[str] = []
    ascii_hits: list[str] = []
    unbalanced: list[str] = []
    for unit in units():
        src = source_blocks(unit)
        for name in ("literal.md", "final.md"):
            blocks = anchors(PROJECT / "units" / unit / name, unit)
            if not blocks:
                continue
            for index, text in enumerate(src, 1):
                key = f"{unit}-p{index:04d}"
                zh = blocks.get(key)
                if zh is None:
                    continue
                # 锚点内分段：`＊　＊　＊` 分隔行是体例要求，不算
                body = re.sub(r"^＊　＊　＊\n+", "", zh)
                if "\n\n" in body:
                    split_blocks.append(f"{key}[{name[0]}]")
                if "..." in zh or re.search(r'["\']', zh):
                    ascii_hits.append(f"{key}[{name[0]}]")
                # 成对符号：与源文的不平衡量比对，源文本就不闭合的不报
                for open_ch, close_ch in PAIRS:
                    delta = zh.count(open_ch) - zh.count(close_ch)
                    if delta == 0:
                        continue
                    src_delta = text.count("«") - text.count("»")
                    src_delta += text.count("(") - text.count(")")
                    src_delta += text.count("[") - text.count("]")
                    if delta != src_delta:
                        unbalanced.append(f"{key}[{name[0]}] {open_ch}{close_ch} 差{delta:+d}（源文差{src_delta:+d}）")
    if split_blocks:
        findings.append(f"■ 锚点内分段（一个源块被译成多段，DECISIONS 第 14 行）：{len(split_blocks)} 处\n    " + " ".join(split_blocks))
    if ascii_hits:
        findings.append(f"■ ASCII 直引号或三点省略号：{len(ascii_hits)} 处\n    " + " ".join(ascii_hits))
    if unbalanced:
        findings.append(f"■ 成对符号与源文不符：{len(unbalanced)} 处\n    " + "\n    ".join(unbalanced[:20]))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--terms", action="store_true", help="只查术语")
    parser.add_argument("--format", dest="fmt", action="store_true", help="只查格式")
    args = parser.parse_args()
    run_all = not (args.terms or args.fmt)

    errors = classification_errors()
    if errors:
        for error in errors:
            print(f"error: {error}")
        return 1

    findings: list[str] = []
    if run_all or args.terms:
        findings += check_terms()
    if run_all or args.fmt:
        findings += check_format()

    if not findings:
        print(f"book-wide check: OK（术语 {len(TERM_CHECKS)} 项、格式 3 项，全书 {len(units())} 单元）")
        return 0

    print(f"book-wide check: {len(findings)} 类线索——**须人逐条判读，命中不等于错**\n")
    for finding in findings:
        print(finding)
    print("\n（同块含近义俄文词时机器分不出对应关系，已按 TERM_CHECKS 第三项跳过；那些块须另行人工核。）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
