#!/usr/bin/env python3
"""为某一章生成起草 prompt 的骨架，把一切数字和路径填好。

错误清单 32 条里有 4 条（第 14、26、28、31）**全部是“审计方写 prompt 时出错”**：
正则漏俄语变格、凭印象引用源文里不存在的句子、按行计数把块数报多一块、
交叉引用把先例的位置记错。共同的根因是 prompt 里的数字、路径和引文靠手抄。

本脚本把这一层机械劳动去掉：块数、SHA-256、来源 URL、上一单元、日期、锚点范围
一律从源文件与 `translation.json` 读出；`--inspect-source` 的 features 摘要与
逐块 feature 明细原样嵌入；【本单元要点】留成待填的骨架，只写该章特有的难点。

**脚本不替你判断该章的难点**——它只保证不该由人抄的东西不由人抄。

用法：
    python3 scripts/new_prompt.py ch022            # 写到 tmp/codex/ch022.prompt.md
    python3 scripts/new_prompt.py ch022 --stdout   # 只打印，不落盘
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "translation_workspace" / "templates" / "codex_prompt.md"
WORK = "knigi-dialektika-abstraktnogo-i-konkretnogo-v-nauchno-teoreticheskom-myshlenii"


def _project() -> Path:
    """项目按进度在 planned/ → drafts/ → reviewed/ 之间移动，路径不能写死。

    见 `audit_unit.py` 同名函数的说明：全书完成移入 `reviewed/` 后，
    写死 `drafts/` 会让脚本找不到译稿。
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
OUT_DIR = ROOT / "tmp" / "codex"


def source_path(unit: str) -> Path:
    return SOURCE_DIR / f"{SOURCE_DIR.name}-{unit}.md"


def inspect_source(path: Path) -> dict[str, str]:
    """跑 --inspect-source 并解析它的输出。数字**只能**来自这里（DECISIONS 第 31 行）。"""
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check_translations.py"), "--inspect-source", str(path)],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    if result.returncode != 0:
        raise SystemExit(f"--inspect-source 失败：\n{result.stderr or result.stdout}")
    out = result.stdout
    fields = dict(re.findall(r"^(source_sha256|source_blocks)=(\S+)$", out, re.M))
    features = "\n".join(
        line for line in out.splitlines() if line.startswith(("features\t", "feature\t"))
    )
    blocks = [
        line.split("\t", 1)[1]
        for line in out.splitlines()
        if re.match(r"^\d{4}\t", line)
    ]
    return {**fields, "features": features, "blocks": blocks, "raw": out}


def previous_unit(unit: str) -> str:
    data = json.loads((PROJECT / "translation.json").read_text(encoding="utf-8"))
    ids = [u.get("id", "") for u in data.get("source_units", []) if isinstance(u, dict)]
    earlier = [i for i in ids if i < unit]
    return earlier[-1] if earlier else ""


def source_url(path: Path) -> str:
    """底本来源行里的 URL——从块 2 读出，不要手写。"""
    match = re.search(r"Источник:\s*<([^>]+)>", path.read_text(encoding="utf-8"))
    return match.group(1) if match else "（未在源文件中找到来源行，请手工确认）"


def build(unit: str) -> str:
    path = source_path(unit)
    if not path.is_file():
        raise SystemExit(f"源文件不存在：{path}")
    info = inspect_source(path)
    blocks = int(info["source_blocks"])
    last = f"{blocks:04d}"
    prev = previous_unit(unit)
    text = TEMPLATE.read_text(encoding="utf-8")

    # 先去掉 front matter，再切掉给审计方看的使用说明（它与正文之间隔着一条 --- 分隔线）。
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.DOTALL)
    body = text.split("\n---\n", 1)[1].lstrip("\n")

    replacements = {
        "{{UNIT_ID}}": unit,
        "{{SOURCE_PATH}}": str(path),
        "{{BLOCK_COUNT}}": str(blocks),
        "{{LAST}}": last,
        "{{PREV_UNIT}}": prev or "（无：这是首个单元）",
        "{{SOURCE_URL}}": source_url(path),
        "{{DATE}}": dt.date.today().isoformat(),
    }
    for key, value in replacements.items():
        body = body.replace(key, value)

    scaffold = f"""**以下是脚本抽取的原始结果，尚未整理成要点——写 prompt 的人必须逐条读过、
把该章真正的难点写在下面，并删掉这段原始输出。**

```
source_sha256={info['source_sha256']}
source_blocks={blocks}
{info['features']}
```

待填（写 prompt 的人负责）：
1. 标题布局：块 1／2／3（／4）分别是什么？是否属于“标题占两个块”？拼合后是否一致？
2. 脚注编号体系与每条的“标记所在块／定义所在块”对应表。
3. 斜体逐处的起止依据；正文若无斜体，写明“不得自造着重号”。
4. 大写／小写 `Логика` 各在哪些块，句中还是句首。
5. 作者括号在哪些块，有无同位释义。
6. 本章特有的难点：典故、成组易混词、底本讹误、与前几章呼应之处。
7. **凡写“某章某块是先例”，现场 `grep` 确认文件与锚点号**（错误清单第 31 条）。
"""
    body = body.replace("{{CHAPTER_SPECIFIC_NOTES}}", scaffold)
    body = body.replace(
        "{{CHAPTER_TITLE_ZH}}", "（待填：块 1 的中文章标题）"
    )
    body = body.replace("- {{EXTRA_TERMS}}\n", "")

    preview = "\n".join(f"{i:04d}\t{b}" for i, b in enumerate(info["blocks"], 1))
    body += (
        "\n\n<!-- ── 以下为审计方参考，交给 Codex 前请删除 ──\n"
        f"逐块预览（来自 --inspect-source）：\n{preview}\n-->\n"
    )
    return body


def verify(unit: str) -> int:
    """把 prompt 里引用的每一个块号，连同源文件对应块的开头一起打印，供逐条核对。

    ch023 暴露出：脚手架接管了全局数字（块数、SHA-256、路径、锚点范围）之后，
    审计方的错误全部集中到了仍由手写的那一部分——【本单元要点】里逐条引用的块号。
    那一章有两个块号是错的（连字符形式在块 37 而非 35、马克思那句在块 74 而非 73），
    一个是误读了自己抽取脚本的输出，一个是凭估计填的。写完要点必须跑一次本模式。
    """

    prompt = OUT_DIR / f"{unit}.prompt.md"
    if not prompt.is_file():
        raise SystemExit(f"找不到 {prompt}")
    path = source_path(unit)
    blocks = inspect_source(path)["blocks"]
    text = prompt.read_text(encoding="utf-8")
    # 只扫【本单元要点】：那是手写的部分，也是块号唯一可能出错的地方。
    # 生成的【术语约定】里会引用**别的章**的块号（如 particular 条目提到 ch016 块 156），
    # 全文扫描会把那些当成本章块号而误报——ch024 第一次跑就撞上了。
    start = text.find("【本单元要点】")
    stop = text.find("【术语约定", start) if start >= 0 else -1
    section = text[start : stop if stop > 0 else len(text)] if start >= 0 else text
    cited = sorted(
        {int(n) for n in re.findall(r"块\s*(\d{1,3})", section)}
        | {int(n) for n in re.findall(rf"{unit}-p0*(\d{{1,3}})", section)}
    )
    if not cited:
        print("prompt 里没有引用任何块号")
        return 0
    print(f"{prompt.name} 引用了 {len(cited)} 个块号，逐条核对：\n")
    bad = 0
    for number in cited:
        if 1 <= number <= len(blocks):
            print(f"  块 {number:>3}｜{blocks[number - 1][:78]}")
        else:
            bad += 1
            print(f"  块 {number:>3}｜**超出范围**（本章共 {len(blocks)} 块）")
    print(
        "\n逐条对照要点里的说法：引文、术语、括号是否真的在该块。"
        "\n脚本只能证明块号存在，**不能证明你引的东西在那一块**——那一步仍须人看。"
    )
    return 1 if bad else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("unit", help="单元号，如 ch022")
    parser.add_argument("--stdout", action="store_true", help="只打印，不写文件")
    parser.add_argument(
        "--verify",
        action="store_true",
        help="核对已写好的 prompt 里引用的块号（写完【本单元要点】后必跑）",
    )
    args = parser.parse_args()

    if not re.fullmatch(r"ch\d{3}", args.unit):
        raise SystemExit("单元号格式应为 chNNN，如 ch022")

    if args.verify:
        return verify(args.unit)

    body = build(args.unit)
    if args.stdout:
        print(body)
        return 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{args.unit}.prompt.md"
    if out.exists():
        raise SystemExit(f"{out} 已存在，先移开或改名，以免覆盖已写好的 prompt")
    out.write_text(body, encoding="utf-8")
    print(f"已生成骨架：{out}")
    print("下一步：逐行扫 DECISIONS.md，把【本单元要点】的待填项写实，并删掉原始输出与末尾的预览注释。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
