#!/usr/bin/env python3
"""一条命令跑完全部检查，或一条命令答「项目现在到哪一步」。

**为什么需要它**：全套检查跑完只要两秒、输出六百来字符，但它是**九条命令**——
HANDOFF 第八节列了七条、AGENTS.md 第四节列了十一条，那两份清单本身就是证据：
够痛才要写进文档让人照抄。对 agent 而言每条命令是一次往返，而每次往返都要重发整段
上下文，代价远超那点输出。故合成一条。

每项检查在**子进程**里跑，一项崩溃不影响其余——与 verify_corpus_manifests 同一个道理：
先失败即中断会让一处故障掩盖全局，split_longform_markdown 曾因此让九部长篇漏检。

**收哪些**：凡是仓库级、便宜、有成败判定的 `--check` 都收。`check_article_review.py`
不收——它要传具体路径，是按任务跑的，不是仓库级。`export_public.py --check` 收，
它是只读的干跑（`write=not args.check`），一秒出结果，能验出权利关卡是否还解得开。

**造好却没接线的关卡等于没有**：`build_merged_translation.py --check` 早就存在，却从不在
任何清单里，于是合并本是否与 final.md 同步长期无人验——`.fulltext` 阅读副本就是这样旧掉的。

`check_book.py` 例外：它**给人看线索**，即便查出东西也返回 0（术语是否全书统一之类，
须人逐条读）。故只报线索数，不计入成败。

用法：
    python3 scripts/check_all.py            # 跑全套，一行一项
    python3 scripts/check_all.py --status   # 只报状态，不跑检查
    python3 scripts/check_all.py --verbose  # 连通过项的原始输出一并打印
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


class Check:
    """一项检查：怎么跑、成败怎么判、怎么压成一行。"""

    def __init__(self, name: str, argv: list[str], summary: str | None = None,
                 advisory: bool = False):
        self.name = name
        self.argv = argv
        self.summary = summary      # 从输出里抽摘要的正则，各分组拼成一行
        self.advisory = advisory    # True 表示只报情况、不判成败

    def run(self) -> tuple[bool, str, str]:
        result = subprocess.run(self.argv, cwd=ROOT, capture_output=True, text=True)
        output = (result.stdout + result.stderr).strip()
        ok = self.advisory or result.returncode == 0
        note = ""
        if self.summary:
            match = re.search(self.summary, output)
            if match:
                note = " ".join(g for g in match.groups() if g)
        return ok, note, output


CHECKS = [
    Check("译文项目", [sys.executable, "scripts/check_translations.py", "--check"],
          r"(translation_projects=\d+ errors=\d+)"),
    Check("术语表", [sys.executable, "scripts/check_glossaries.py", "--check"],
          r"(glossaries=\d+ errors=\d+)"),
    Check("术语视图", [sys.executable, "scripts/render_glossaries.py", "--check"]),
    Check("起草模板", [sys.executable, "scripts/render_prompt_template.py", "--check"],
          r"prompt template: ([A-Za-z]+)"),
    Check("项目文档", [sys.executable, "scripts/check_project_docs.py", "--check"],
          r"documentation: ([A-Za-z]+)"),
    Check("语料 front matter", [sys.executable, "scripts/prepare_gbrain_markdown.py", "--check"],
          r"(markdown_total=\d+ errors=\d+)"),
    Check("长篇切分", [sys.executable, "scripts/split_longform_markdown.py", "--check"],
          r"longform_verified=(\d+) .*(failed=\d+)"),
    Check("语料清单", [sys.executable, "scripts/verify_corpus_manifests.py"],
          r"(human_verified_ocr=\d+ .*errors=\d+)"),
    Check("术语批次", [sys.executable, "scripts/check_terminology_reviews.py", "--check"],
          r"(terminology_review_batches=\d+ errors=\d+)"),
    Check("术语变更日志", [sys.executable, "scripts/render_terminology_reviews.py", "--check"]),
    Check("合并本", [sys.executable, "scripts/build_merged_translation.py", "--check"],
          r"merged translation: ([A-Za-z]+)"),
    Check("AGENTS 机器块", [sys.executable, "scripts/update_agents_guide.py", "--check"],
          r"AGENTS\.md size block is (up to date)"),
    Check("公开导出（只读）", [sys.executable, "scripts/export_public.py", "--check"],
          r"(included=\d+ excluded=\d+)"),
    Check("单元测试", [sys.executable, "-m", "unittest", "discover", "-s", "tests"],
          r"Ran (\d+ tests)"),
    Check("全书通查（线索）", [sys.executable, "scripts/check_book.py"], advisory=True),
]


def pad(text: str, width: int) -> str:
    """按**显示宽度**补齐：中文是双宽字符，按字符数补齐会让列错位。"""
    shown = sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in text)
    return text + " " * max(0, width - shown)


def book_state() -> str:
    """成书产物的状态。只读 book/build/，不重新编译——编译要几分钟。"""
    log = ROOT / "book" / "build" / "main.log"
    pdf = ROOT / "book" / "build" / "main.pdf"
    if not pdf.is_file():
        return "未构建"
    pages = "?"
    if log.is_file():
        text = log.read_text(encoding="utf-8", errors="ignore")
        match = re.search(r"Output written on main\.pdf \((\d+) pages", text)
        if match:
            pages = match.group(1)
        missing = len(set(re.findall(r"Missing character: There is no (.)", text)))
    else:
        missing = "?"
    version = ROOT / "book" / "build" / "version.tex"
    stamp = ""
    if version.is_file():
        match = re.search(r"bookcommit\}\{([^}]*)\}", version.read_text(encoding="utf-8"))
        if match:
            stamp = match.group(1)
    return f"{pages} 页・缺字形 {missing}・刻 {stamp}"


def book_is_stale() -> str | None:
    """成书产物是否落后于它的输入。

    只看版本页刻的 commit 与「此后是否又有输入被提交」——刻记是全书唯一的追溯依据。
    没有这一项，--status 只报「439 页・刻 30011e6」，读的人无从知道译文已经改过而书未重编：
    本书就曾积着两处译文修正与一处版式修正而 PDF 未动（那是所有者定的「攒一批再编译」，
    不是疏漏，但状态必须说出来）。
    """
    version = ROOT / "book" / "build" / "version.tex"
    if not version.is_file():
        return None
    match = re.search(r"bookcommit\}\{([0-9a-f]+)", version.read_text(encoding="utf-8"))
    if not match:
        return None
    stamp = match.group(1)
    # **只列真正进书的输入。** 起初写作整个 translation_workspace，于是一次只改
    # issues.md 的提交（单元自己的记录，不进书）也被算作「书已落后」——报了不存在的
    # 问题，与漏报一样有害，人会学着无视它。进书的只有各单元的 final.md、前置材料与模板。
    inputs = ["book/template", "book/front", "scripts/build_book.py", "scripts/md_to_latex.py",
              "scripts/build_front_matter.py", "translation_workspace/**/final.md"]
    result = subprocess.run(["git", "-C", str(ROOT), "log", "--oneline",
                             f"{stamp}..HEAD", "--"] + inputs,
                            capture_output=True, text=True)
    commits = [l for l in result.stdout.splitlines() if l.strip()]
    if not commits:
        return None
    return (f"落后 {len(commits)} 个提交（刻 {stamp}）——译文或模板已改而未重编。\n"
            f"     攒够一批修正后跑 `python3 scripts/build_book.py`；"
            f"**须在提交之后构建**，否则版本页会刻上上一个 commit")


def translation_state() -> list[str]:
    lines: list[str] = []
    for path in sorted(ROOT.glob("translation_workspace/*/*/*/translation.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        units = data.get("source_units", [])
        states: dict[str, int] = {}
        blocks = 0
        for unit in units:
            states[unit.get("status", "?")] = states.get(unit.get("status", "?"), 0) + 1
            blocks += int(unit.get("paragraph_count") or 0)
        stage = path.parents[2].name
        done = "完成" if data.get("work_complete") else "未声明完成"
        breakdown = " ".join(f"{k}={v}" for k, v in sorted(states.items()))
        lines.append(f"  {stage}/{path.parent.name[:44]}")
        lines.append(f"    {len(units)} 单元 {blocks} 块・{breakdown}・{done}")
    return lines or ["  （无翻译项目）"]


def pending_state() -> list[str]:
    lines: list[str] = []
    cruxes = ROOT / "translation_workspace" / "SOURCE_CRUXES.md"
    if cruxes.is_file():
        # 只数待核的那几节。第〇节记的是已解决的转换丢失，算进来会虚报——
        # 手写的数字正因此漂过：HANDOFF 曾写「12 处」而实为 13。
        pending = {}
        section = ""
        for line in cruxes.read_text(encoding="utf-8").splitlines():
            if line.startswith("## "):
                section = line[3:].split("、", 1)[-1].split("（")[0].strip()
                resolved = line.startswith("## 〇") or line.startswith("## 四") or line.startswith("## 五")
            elif line.startswith("| ch") and not resolved:
                pending[section] = pending.get(section, 0) + 1
        total = sum(pending.values())
        detail = "・".join(f"{k} {v}" for k, v in pending.items())
        lines.append(f"  底本疑点待核纸本: {total} 处（{detail}）")
    log = ROOT / "book" / "REVIEW_LOG.md"
    if log.is_file():
        # 只数「待改」一节的条目。「已改」「不改」是账，不是待办——把它们算进来
        # 会让待办数只增不减，正是 SOURCE_CRUXES 那次虚报 23 的同一个错。
        pending_rows = 0
        section = ""
        for line in log.read_text(encoding="utf-8").splitlines():
            if line.startswith("## "):
                section = line[3:].strip()
            elif line.startswith("| ch") and section == "待改":
                pending_rows += 1
        lines.append(f"  校阅待改: {pending_rows} 条")
    front = sorted((ROOT / "book" / "front").glob("*.md")) if (ROOT / "book" / "front").is_dir() else []
    empty = [f.name for f in front if "内容待所有者撰写" in f.read_text(encoding="utf-8")]
    if front:
        # 「待撰写」不是缺陷：前置材料只有译者引言一篇，由所有者撰写并自行取舍
        # （STYLE_GUIDE 第六节，2026-07-30 裁定）。agent 不得代写。
        note = "（由所有者撰写，agent 不代写）" if empty else ""
        lines.append(f"  前置材料: 译者引言 {len(front)} 份，其中待撰写 {len(empty)}{note}")
    return lines


def print_status() -> None:
    print("翻译")
    for line in translation_state():
        print(line)
    stale = book_is_stale()
    print(f"成书\n  {book_state()}" + (f"\n  ★ {stale}" if stale else ""))
    pending = pending_state()
    if pending:
        print("待办")
        for line in pending:
            print(line)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--status", action="store_true", help="只报项目状态，不跑检查")
    parser.add_argument("--verbose", action="store_true", help="连通过项的原始输出一并打印")
    args = parser.parse_args(argv)

    if args.status:
        print_status()
        return 0

    failures: list[tuple[str, str]] = []
    for check in CHECKS:
        ok, note, output = check.run()
        mark = "ok  " if ok else "FAIL"
        if check.advisory:
            leads = len(re.findall(r"^■", output, re.M))
            mark, note = "——  ", f"{leads} 条线索待人读" if leads else "无线索"
        print(f"  {mark} {pad(check.name, 22)}{note}")
        if not ok:
            failures.append((check.name, output))
        elif args.verbose and output:
            for line in output.splitlines():
                print(f"        {line}")

    for name, output in failures:
        print(f"\n──── {name} ────")
        print(output)
    print(f"\nfailed={len(failures)}/{len([c for c in CHECKS if not c.advisory])}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
