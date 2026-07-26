#!/usr/bin/env python3
"""审计某个单元前先跑这个：把该章的结构事实一次算齐，并列出审计方专属的检查条目。

**为什么要有它。** 审计一章时，审计方每次都要算同一批数字：锚点数、逐块斜体是否与源文件
相符、脚注标记与定义、作者括号、两稿逐字相同的块、定稿相对初译的缩水率。ch020—ch025
这六章，这段代码被临时手写了六遍——既是每个新会话都要重付的推导成本，也意味着
**哪一项被漏算，取决于当次会话想没想起来**。

ch025 就是例子：它的形式项全绿、起草方自查称无删词，唯一的异常是定稿比初译短 15.8%。
那个数字之所以被注意到，是因为当时临时把 25 章的缩水率排了一遍，发现它是历史最差值的
1.9 倍。**这种"对比全书分布"的排查不该依赖临场灵感**，所以并进本脚本：
每次审计自动把该章的缩水率放回全书分布里看。

它**不替代逐块通读**，只保证通读之前该算的都算过了，且算法每次一样。

用法：
    python3 scripts/audit_unit.py ch026
    python3 scripts/audit_unit.py ch026 --quiet   # 只报异常，不打印清单
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from render_prompt_template import AUDITOR_ONLY

ROOT = Path(__file__).resolve().parent.parent
WORK = "knigi-dialektika-abstraktnogo-i-konkretnogo-v-nauchno-teoreticheskom-myshlenii"


def _project() -> Path:
    """项目按进度在 planned/ → drafts/ → reviewed/ 之间移动，路径不能写死。

    全书 42 单元完成后项目移入 `reviewed/`，此前写死 `drafts/` 的两个脚本
    （本文件与 new_prompt.py）当场失效——审计脚本报“缺少 literal.md 或 final.md”，
    而文件其实好端端在 reviewed/ 下。按三个阶段依次查找即可。
    """

    base = ROOT / "translation_workspace"
    for stage in ("reviewed", "drafts", "planned"):
        candidate = base / stage / "ilyenkov" / WORK
        if candidate.is_dir():
            return candidate
    return base / "drafts" / "ilyenkov" / WORK


PROJECT = _project()
SOURCE_DIR = (
    ROOT
    / "ilyenkov_markdown"
    / "ilyenkov_md"
    / "knigi"
    / "knigi-dialektika-abstraktnogo-i-konkretnogo-v-nauchno-teoreticheskom-myshlenii"
)
STYLE_GUIDE = ROOT / "notes" / "STYLE_GUIDE.md"

ITALIC = re.compile(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", re.DOTALL)
FOOTNOTE_MARK = re.compile(r"\[\^([A-Za-z0-9._-]+)\](?!:)")
FOOTNOTE_DEF = re.compile(r"(?m)^\[\^([A-Za-z0-9._-]+)\]:")
PROSE_MIN = 40

# 引文保真度：源文每个 «…» 的起首，在译文里都应有一个对应的开引号。
# 俄文的 «…» 套 «…» 在中文降级成 “…‘…’…”，所以单引号必须一起数——只数 “ 的话，
# ch002/ch013/ch021 这类嵌套引文会全部误报。
OPEN_QUOTE = ("“", "‘", "《", "〈", "『", "「")

# 阈值取“逐块比源文少 ≥2 个”，是拿全书 36 个已审单元校准出来的：
#   * 总数几乎总是译文 ≥ 源文（嵌套引号、书名号），**总数看不出问题**；
#   * 逐块缺 ≥2 在 36 个已审单元里只命中 1 块（ch035 块 217，引号省略，已核为无害）；
#   * 回放到 ch036 被退回的初稿上命中 5 块，**含自造内容所在的块 8**；重做稿 0 块。
# 初稿的总数是 +15、看着很正常——**这项检查的价值全在逐块，不在总数**。
QUOTE_SHORTFALL = 2

# 错误清单里**只写给审计方**的条目。起草 prompt 不带这些，所以只有在这里提醒，
# 它们才到得了审计方手里。
#
# 这里**引用** render_prompt_template.py 的分类，不再手抄一份：原先手抄的副本停在
# 第 33 条，新增的第 35 条（自查项被填了表却没被当作判据）从此再没到过审计方手里——
# 而第 35 条本身讲的就是“写下来的检查项不等于生效的检查项”。副本没有分类关卡，
# 注释里写着“与 render_prompt_template.py 一致”也拦不住漂移，只有引用能。
AUDITOR_ROWS = tuple(sorted(AUDITOR_ONLY))


def source_blocks(unit: str) -> list[str]:
    path = SOURCE_DIR / f"{SOURCE_DIR.name}-{unit}.md"
    if not path.is_file():
        raise SystemExit(f"源文件不存在：{path}")
    body = path.read_text(encoding="utf-8").split("---", 2)[2]
    return [
        block.strip()
        for block in body.split("\n\n")
        if block.strip() and block.strip() not in ("---", "* * *")
    ]


def anchors(path: Path, unit: str) -> dict[str, str]:
    if not path.is_file():
        return {}
    body = path.read_text(encoding="utf-8").split("---", 2)[2]
    return {
        m.group(1): m.group(2).strip()
        for m in re.finditer(rf"^## ({unit}-p\d+)\n\n(.*?)(?=\n## |\Z)", body, re.S | re.M)
    }


def shrink_rate(literal: dict[str, str], final: dict[str, str]) -> float | None:
    keys = [k for k in literal if k in final and len(literal[k]) >= PROSE_MIN]
    if not keys:
        return None
    before = sum(len(literal[k]) for k in keys)
    after = sum(len(final[k]) for k in keys)
    return (after - before) / before * 100


def all_shrink_rates(exclude: str) -> list[tuple[float, str]]:
    rates: list[tuple[float, str]] = []
    for unit_dir in sorted((PROJECT / "units").iterdir()):
        if not unit_dir.is_dir() or unit_dir.name == exclude:
            continue
        unit = unit_dir.name
        rate = shrink_rate(anchors(unit_dir / "literal.md", unit), anchors(unit_dir / "final.md", unit))
        if rate is not None:
            rates.append((rate, unit))
    return sorted(rates)


def auditor_checklist() -> list[str]:
    text = STYLE_GUIDE.read_text(encoding="utf-8")
    section = text.split("## 七、常见错误与防范")[1].split("\n## ")[0]
    rows = {}
    for line in section.splitlines():
        m = re.match(r"^\| (\d+) \| (.+?) \| (.+?) \| (.+?) \|\s*$", line)
        if m:
            rows[int(m.group(1))] = m.group(2).strip()
    return [f"第 {n} 条：{rows[n]}" for n in AUDITOR_ROWS if n in rows]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("unit", help="单元号，如 ch026")
    parser.add_argument("--quiet", action="store_true", help="只报异常，不打印审计方清单")
    args = parser.parse_args()

    unit = args.unit
    if not re.fullmatch(r"ch\d{3}", unit):
        raise SystemExit("单元号格式应为 chNNN")
    unit_dir = PROJECT / "units" / unit
    src = source_blocks(unit)
    literal = anchors(unit_dir / "literal.md", unit)
    final = anchors(unit_dir / "final.md", unit)
    if not literal or not final:
        raise SystemExit(f"{unit_dir} 下缺少 literal.md 或 final.md")

    problems: list[str] = []
    print(f"── {unit}：结构事实 ──")
    print(f"源文件块数 {len(src)}｜literal 锚点 {len(literal)}｜final 锚点 {len(final)}")
    if not (len(src) == len(literal) == len(final)):
        problems.append("锚点数与源文件块数不一致")

    mismatched = [
        i
        for i in range(1, len(src) + 1)
        if f"{unit}-p{i:04d}" in final
        and len(ITALIC.findall(src[i - 1])) != len(ITALIC.findall(final[f"{unit}-p{i:04d}"]))
    ]
    total_src_italic = sum(len(ITALIC.findall(b)) for b in src)
    print(f"斜体 源 {total_src_italic} 处｜逐块不符：{mismatched or '无'}")
    if mismatched:
        problems.append(f"逐块斜体数与源文件不符：块 {mismatched}")

    joined_src = "\n\n".join(src)
    marks = (len(FOOTNOTE_MARK.findall(joined_src)), sum(len(FOOTNOTE_MARK.findall(v)) for v in final.values()))
    defs = (len(FOOTNOTE_DEF.findall(joined_src)), sum(len(FOOTNOTE_DEF.findall(v)) for v in final.values()))
    print(f"脚注标记 源/定稿 {marks[0]}/{marks[1]}｜定义 {defs[0]}/{defs[1]}")
    if marks[0] != marks[1] or defs[0] != defs[1]:
        problems.append("脚注标记或定义数与源文件不符")

    src_paren = sum(b.count("(") for b in src)
    fin_paren = sum(v.count("（") + v.count("(") for v in final.values())
    print(f"左括号 源/定稿 {src_paren}/{fin_paren}")
    if fin_paren < src_paren:
        problems.append("定稿括号少于源文件")

    src_quote = sum(b.count("«") for b in src)
    fin_quote = sum(sum(v.count(c) for c in OPEN_QUOTE) for v in final.values())
    dropped = [
        i
        for i in range(1, len(src) + 1)
        if f"{unit}-p{i:04d}" in final
        and src[i - 1].count("«")
        - sum(final[f"{unit}-p{i:04d}"].count(c) for c in OPEN_QUOTE)
        >= QUOTE_SHORTFALL
    ]
    print(f"引文起首 源«/定稿 {src_quote}/{fin_quote}｜逐块缺≥{QUOTE_SHORTFALL}：{dropped or '无'}")
    if dropped:
        problems.append(f"整段引文疑似丢失：块 {dropped}（逐块核对源文的 «…»）")

    prose = [k for k in literal if len(literal[k]) > PROSE_MIN and not literal[k].startswith("[^")]
    identical = [k for k in prose if literal[k] == final.get(k)]
    ratio = len(identical) / len(prose) * 100 if prose else 0.0
    print(f"两稿逐字相同 {len(identical)}/{len(prose)} = {ratio:.0f}%（机器上限 33%）")
    if prose and len(identical) > 3 and ratio > 100 / 3:
        problems.append(f"定稿照抄初译：{len(identical)}/{len(prose)}")
    elif ratio > 15:
        problems.append(f"逐字相同占比 {ratio:.0f}%，虽未触发机器检查，仍偏高，值得看一眼")

    rate = shrink_rate(literal, final)
    others = all_shrink_rates(exclude=unit)
    print(f"定稿相对初译 {rate:+.1f}%", end="")
    if others:
        lo, hi = others[0][0], others[-1][0]
        median = others[len(others) // 2][0]
        print(f"｜其余 {len(others)} 章区间 {lo:+.1f}%…{hi:+.1f}%，中位 {median:+.1f}%")
        # ch025 的教训：形式项全绿时，缩水率的离群值可能是唯一的信号。
        # 阈值按那个真实案例标定——不能用"低于历史最小值"，那对最小的那一章必然误报
        # （ch024 的 −8.1% 本身就是最小值，用最小值作判据会把它也报出来）。
        # ch025 是 −15.8%，当时的历史最小值是 −8.1%，约 1.9 倍；取 1.5 倍作触发线：
        # ch025 会报（−15.8 < −12.2），ch024 不会（−8.1 > −11.1）。
        if lo < 0 and rate < lo * 1.5:
            problems.append(
                f"缩水率 {rate:+.1f}% 是历史最大缩水（{lo:+.1f}%，{others[0][1]}）的 "
                f"{rate / lo:.1f} 倍，已属离群——ch025 正是这样被发现整章漏词的，务必逐块复核"
            )
        elif rate < lo:
            print(f"  （注：这是迄今最大缩水，此前最大为 {lo:+.1f}%（{others[0][1]}），尚未到离群程度）")
    else:
        print()

    if problems:
        print("\n── 需要处理 ──")
        for item in problems:
            print(f"  ✗ {item}")
    else:
        print("\n结构事实无异常。**这不等于译文没问题**——ch025 的形式项也全绿。")

    if not args.quiet:
        print("\n── 审计方专属的错误清单条目（起草 prompt 不带这些）──")
        for line in auditor_checklist():
            print(f"  {line}")
        print(
            "\n下一步：逐块对照俄文源文件通读定稿；"
            "读起草方报告时，注意它的自查项只覆盖上一次那种错法"
            "（ch020 的删词自查漏掉成对形容词与框架词，ch025 的字数表列了一整列 +0.0% 却没读出照抄）。"
        )
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
