#!/usr/bin/env python3
"""检查当前项目、AI 入口和社区文档的一致性。"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from manage_collections import sync_status


ROOT = Path(__file__).resolve().parents[1]
OLD_PROJECT_NAME = "伊里因科夫中文学习与翻译资料库"
CURRENT_DOCS = (
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "COLLECTION_STATUS.md",
    "CONTRIBUTING.md",
    "GOVERNANCE.md",
    "LLM_WIKI.md",
    "RESOLVER.md",
    "TRANSLATION_PLAN.md",
    "notes/COLLECTION_ARCHITECTURE.md",
    "notes/REPOSITORY_STATUS_FOR_CLAUDE.md",
    "notes/KEDROV_COLLECTION_STATUS_FOR_CLAUDE.md",
    "notes/KEDROV_SOURCE_SURVEY.md",
    "notes/OIZERMAN_SOURCE_SURVEY.md",
    "notes/ORIGINAL_LANGUAGE_AI_READING.md",
    "notes/SCAN_DIGITIZATION_WORKFLOW.md",
    "notes/community/DISCUSSIONS.md",
    "notes/community/RECRUITMENT_PLATFORMS.md",
    "notes/community/RECRUITMENT_POST.md",
    "translation_workspace/README.md",
)
MISSION_REQUIREMENTS = {
    "README.md": ("## English Summary", "原典数字化与研究平台", "中文翻译与精读计划"),
    "GOVERNANCE.md": ("面向全球", "原典数字化", "中文翻译"),
    "CONTRIBUTING.md": ("数字化", "中文翻译", "LLM Wiki"),
    "AGENTS.md": ("原典数字化与研究平台面向全球", "中文翻译与精读计划"),
    "notes/REPOSITORY_STATUS_FOR_CLAUDE.md": (
        "原典数字化与研究平台面向全球",
        "中文翻译与精读计划",
    ),
    "TRANSLATION_PLAN.md": ("长期重点", "伊里因科夫", "选择性翻译"),
    "notes/community/DISCUSSIONS.md": (
        "AI-ready source-text digitization and research platform",
        "Chinese translation",
        "close-reading program",
        "原典数字化与研究平台",
    ),
    "notes/community/RECRUITMENT_PLATFORMS.md": (
        "AI-ready source-text digitization and research platform",
        "Chinese translation",
        "close-reading program",
    ),
    "notes/community/RECRUITMENT_POST.md": ("AI-ready", "原典数字化与研究平台"),
}
DEPRECATED_TEXT = {
    'text_role: "source"': "使用已废弃的正文角色 source",
    "主要类型为 `source`": "使用已废弃的正文角色 source",
    "尚未把本组文件存入仓库": "仍称已收录扫描件未入库",
    "即使未来通过，也不得进入核心层": "使用旧 OCR 准入规则",
    "历史 OCR 仅可进入隔离检索层": "使用旧 OCR 准入规则",
    "PDF 保存候选": "仍将已收录扫描件描述为候选",
    "建议新建独立的 `kedrov_markdown/`": "仍保留已完成的目录计划",
}
STATUS_DOCS = (
    "notes/REPOSITORY_STATUS_FOR_CLAUDE.md",
    "notes/KEDROV_COLLECTION_STATUS_FOR_CLAUDE.md",
)
STATUS_METRIC_PATTERNS = (
    r"\b\d+\s+个活动页面",
    r"\b\d+\s+pages scanned",
    r"embedding\s+(?:coverage|100%)",
    r"stale\s*[=:]\s*\d+",
    r"markdown_total\s*=\s*\d+",
    r"\b\d+\s+页数据库",
)


def markdown_body(text: str) -> str:
    if not text.startswith("---\n"):
        return text
    match = re.match(r"\A---\n.*?\n---\n", text, re.DOTALL)
    return text[match.end() :] if match else text


def local_link_errors(root: Path, documents: tuple[str, ...] = CURRENT_DOCS) -> list[str]:
    errors: list[str] = []
    for relative in documents:
        path = root / relative
        if not path.is_file():
            errors.append(f"缺少当前文档: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
            if target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            clean = target.split("#", 1)[0]
            if clean and not (path.parent / clean).resolve().exists():
                errors.append(f"{relative}: 本地链接不存在: {target}")
    return errors


def claude_errors(root: Path) -> list[str]:
    path = root / "CLAUDE.md"
    if not path.is_file():
        return ["缺少 CLAUDE.md"]
    body = markdown_body(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if "[AGENTS.md](AGENTS.md)" not in body:
        errors.append("CLAUDE.md 必须指向 AGENTS.md")
    nonempty = [line for line in body.splitlines() if line.strip()]
    if len(nonempty) > 4:
        errors.append("CLAUDE.md 只能作为简短入口指针")
    if re.search(r"\b\d+(?:\.\d+)?\s*(?:GB|MB|个文件|页|pages)\b", body, re.IGNORECASE):
        errors.append("CLAUDE.md 不得写入易过期状态数字")
    return errors


def agents_errors(root: Path) -> list[str]:
    path = root / "AGENTS.md"
    if not path.is_file():
        return ["缺少 AGENTS.md"]
    text = path.read_text(encoding="utf-8")
    required = (
        "<!-- AGENTS-AUTO:BEGIN -->",
        "<!-- AGENTS-AUTO:END -->",
        "<!-- AGENTS-LIVE:BEGIN -->",
        "<!-- AGENTS-LIVE:END -->",
        "metadata/collections.json",
        "COLLECTION_STATUS.md",
        "notes/COLLECTION_ARCHITECTURE.md",
        "scripts/manage_collections.py",
        "scripts/check_project_docs.py",
    )
    return [f"AGENTS.md 缺少关键入口: {value}" for value in required if value not in text]


def terminology_errors(root: Path, documents: tuple[str, ...] = CURRENT_DOCS) -> list[str]:
    errors: list[str] = []
    for relative in documents:
        path = root / relative
        if path.is_file() and OLD_PROJECT_NAME in path.read_text(encoding="utf-8"):
            errors.append(f"{relative}: 仍使用旧项目名称")
    return errors


def status_snapshot_errors(root: Path) -> list[str]:
    errors: list[str] = []
    for relative in STATUS_DOCS:
        path = root / relative
        if not path.is_file():
            errors.append(f"缺少状态文档: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in STATUS_METRIC_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                errors.append(f"{relative}: 不应写死 GBrain 实时指标: {pattern}")
    return errors


def mission_errors(root: Path) -> list[str]:
    errors: list[str] = []
    for relative, required in MISSION_REQUIREMENTS.items():
        path = root / relative
        if not path.is_file():
            errors.append(f"缺少使命文档: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        for value in required:
            if value not in text:
                errors.append(f"{relative}: 缺少项目定位表述: {value}")
    return errors


def deprecated_text_errors(
    root: Path,
    documents: tuple[str, ...] = CURRENT_DOCS,
) -> list[str]:
    errors: list[str] = []
    for relative in documents:
        path = root / relative
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for value, reason in DEPRECATED_TEXT.items():
            if value in text:
                errors.append(f"{relative}: {reason}: {value}")
    return errors


def check(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    errors.extend(local_link_errors(root))
    errors.extend(claude_errors(root))
    errors.extend(agents_errors(root))
    errors.extend(terminology_errors(root))
    errors.extend(status_snapshot_errors(root))
    errors.extend(mission_errors(root))
    errors.extend(deprecated_text_errors(root))
    try:
        if not sync_status(root, check=True):
            errors.append("COLLECTION_STATUS.md 与中央注册表不同步")
    except (OSError, ValueError) as exc:
        errors.append(f"无法校验 COLLECTION_STATUS.md: {exc}")
    return errors


def main() -> int:
    errors = check()
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    print("project and AI documentation: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
