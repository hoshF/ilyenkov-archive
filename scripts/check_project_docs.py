#!/usr/bin/env python3
"""检查当前项目、AI 入口和社区文档的一致性。"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from manage_collections import sync_status
from prepare_gbrain_markdown import parse_front_matter


ROOT = Path(__file__).resolve().parents[1]
OLD_PROJECT_NAME = "伊里因科夫中文学习与翻译资料库"
CURRENT_DOCS = (
    "README.md",
    "RIGHTS.md",
    "AGENTS.md",
    "CLAUDE.md",
    "COLLECTION_STATUS.md",
    "CONTRIBUTING.md",
    "GOVERNANCE.md",
    "LLM_WIKI.md",
    "RESOLVER.md",
    "TRANSLATION_PLAN.md",
    "caute_ru_markdown/README.md",
    "maidansky_markdown/README.md",
    "spinoza_markdown/README.md",
    "kedrov_markdown/README.md",
    "oizerman_markdown/README.md",
    "kopnin_markdown/README.md",
    "notes/COLLECTION_ARCHITECTURE.md",
    "notes/REPOSITORY_STATUS_FOR_CLAUDE.md",
    "notes/KEDROV_COLLECTION_STATUS_FOR_CLAUDE.md",
    "notes/KEDROV_SOURCE_SURVEY.md",
    "notes/KOPNIN_SOURCE_SURVEY.md",
    "notes/OIZERMAN_SOURCE_SURVEY.md",
    "notes/MAIDANSKY_SOURCE_ATTRIBUTION.md",
    "notes/ORIGINAL_LANGUAGE_AI_READING.md",
    "notes/SCAN_DIGITIZATION_WORKFLOW.md",
    "spinoza_markdown/metadata/source_audit.md",
    "notes/community/DISCUSSIONS.md",
    "notes/community/RECRUITMENT_PLATFORMS.md",
    "notes/community/RECRUITMENT_POST.md",
    "translation_workspace/README.md",
)
MISSION_REQUIREMENTS = {
    "README.md": (
        "# Ilyenkov Philosophy Text Archive",
        "## Collections",
        "## Chinese Translation And Close Reading",
        "## 中文摘要",
    ),
    "GOVERNANCE.md": (
        "# Project Governance",
        "## Mission",
        "Chinese translation",
        "## 中文摘要",
    ),
    "CONTRIBUTING.md": (
        "# Contributing",
        "## Useful Contributions",
        "Chinese translation",
        "## 中文摘要",
    ),
    "LLM_WIKI.md": ("# LLM Wiki", "## Operating Principles", "## 中文摘要"),
    "RESOLVER.md": ("# Corpus Resolver", "## Routing", "## 中文摘要"),
    "COLLECTION_STATUS.md": (
        "# Philosopher Text Collection Status",
        "## Stage Notes",
        "## 中文说明",
    ),
    "caute_ru_markdown/README.md": (
        "# Ilyenkov / Maidansky Markdown Archive",
        "## 中文摘要",
    ),
    "maidansky_markdown/README.md": (
        "# Andrey Maidansky Academia.edu Source Archive",
        "## 中文摘要",
    ),
    "spinoza_markdown/README.md": (
        "# Spinoza Original-Language Markdown Archive",
        "## 中文摘要",
    ),
    "kedrov_markdown/README.md": (
        "# Bonifaty Kedrov Philosophy Text Archive",
        "## 中文摘要",
    ),
    "oizerman_markdown/README.md": (
        "# Teodor Oizerman Philosophy Text Archive",
        "## 中文摘要",
    ),
    "kopnin_markdown/README.md": (
        "# Pavel Kopnin Philosophy Text Archive",
        "## 中文摘要",
    ),
    "notes/COLLECTION_ARCHITECTURE.md": (
        "# Collection Architecture And Extension Guide",
        "## Standard Person Layout",
        "## 中文摘要",
    ),
    "notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md": (
        "# Philosophical Text Source, OCR Admission, And Publication Policy",
        "## OCR Admission Gate",
        "## 中文摘要",
    ),
    "notes/SCAN_DIGITIZATION_WORKFLOW.md": (
        "# Scan Digitization Workflow",
        "## 3. Standard Workflow",
        "## 中文摘要",
    ),
    "notes/ORIGINAL_LANGUAGE_AI_READING.md": (
        "# Original-Language Priority And AI-Assisted Reading",
        "## Limits Of AI",
        "## 中文摘要",
    ),
    "notes/MAIDANSKY_SOURCE_ATTRIBUTION.md": (
        "# Maidansky Website Source Attribution",
        "## 中文摘要",
    ),
    "notes/KEDROV_SOURCE_SURVEY.md": (
        "# B. M. Kedrov Text Source Survey",
        "## Current Processing Order",
        "## 中文摘要",
    ),
    "notes/KOPNIN_SOURCE_SURVEY.md": (
        "# P. V. Kopnin Text Source Survey",
        "## Unresolved Gaps",
        "## 中文摘要",
    ),
    "notes/OIZERMAN_SOURCE_SURVEY.md": (
        "# T. I. Oizerman Text Source Survey",
        "## Four-Volume `Теория познания`",
        "## 中文摘要",
    ),
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
LICENSE_FILES = (
    "LICENSE",
    "RIGHTS.md",
    "LICENSES/MIT",
    "LICENSES/CC-BY-SA-4.0",
    "LICENSES/CC0-1.0",
    "metadata/licensing_policy.json",
    "metadata/rights_registry.json",
    "metadata/schemas/rights_review.schema.json",
)
COLLABORATION_FILES = (
    ".github/ISSUE_TEMPLATE/config.yml",
    ".github/ISSUE_TEMPLATE/source-and-edition.yml",
    ".github/ISSUE_TEMPLATE/text-or-digitization.yml",
    ".github/ISSUE_TEMPLATE/rights-review.yml",
    ".github/ISSUE_TEMPLATE/tooling.yml",
    ".github/PULL_REQUEST_TEMPLATE.md",
    "CITATION.cff",
)
METADATA_REQUIREMENTS = {
    "AGENTS.md": {
        "type": "agent-guide",
        "language": "zh",
        "collection": "project-documentation",
        "tags": ("agents", "navigation"),
        "updated": True,
    },
    "CONTRIBUTING.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("project", "documentation", "contributing"),
        "updated": True,
    },
    "GOVERNANCE.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("project", "documentation", "governance"),
        "updated": True,
    },
    "LLM_WIKI.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("llm-wiki", "gbrain"),
        "updated": True,
    },
    "RESOLVER.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("corpus", "resolver"),
        "updated": True,
    },
    "COLLECTION_STATUS.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("collections", "status", "corpus"),
    },
    "caute_ru_markdown/README.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("project", "documentation"),
        "updated": True,
    },
    "maidansky_markdown/README.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("maidansky", "source-archive"),
        "updated": True,
    },
    "spinoza_markdown/README.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("project", "documentation"),
        "updated": True,
    },
    "kedrov_markdown/README.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("kedrov", "source-archive"),
        "updated": True,
    },
    "oizerman_markdown/README.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("oizerman", "source-archive"),
        "updated": True,
    },
    "kopnin_markdown/README.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("kopnin", "source-archive"),
        "updated": True,
    },
    "RIGHTS.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("rights", "licensing"),
    },
    "TRANSLATION_PLAN.md": {
        "type": "project",
        "language": "zh",
        "collection": "project-documentation",
        "tags": ("project", "documentation"),
        "updated": True,
    },
    "notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("source-policy", "copyright"),
        "updated": True,
    },
    "notes/COLLECTION_ARCHITECTURE.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("collections", "architecture"),
        "updated": True,
    },
    "notes/SCAN_DIGITIZATION_WORKFLOW.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "project-documentation",
        "tags": ("source-scan", "ocr", "workflow"),
        "updated": True,
    },
    "notes/ORIGINAL_LANGUAGE_AI_READING.md": {
        "type": "note",
        "language": "en-zh",
        "collection": "research-notes",
        "tags": ("research-note",),
        "updated": True,
    },
    "notes/MAIDANSKY_SOURCE_ATTRIBUTION.md": {
        "type": "project",
        "language": "en-zh",
        "collection": "corpus-metadata",
        "tags": ("source-attribution", "maidansky", "filorus"),
        "updated": True,
    },
    "notes/KEDROV_SOURCE_SURVEY.md": {
        "type": "analysis",
        "language": "en-zh",
        "collection": "corpus-metadata",
        "tags": ("kedrov", "source-metadata"),
        "updated": True,
    },
    "notes/KOPNIN_SOURCE_SURVEY.md": {
        "type": "analysis",
        "language": "en-zh",
        "collection": "corpus-metadata",
        "tags": ("kopnin", "source-metadata"),
        "updated": True,
    },
    "notes/OIZERMAN_SOURCE_SURVEY.md": {
        "type": "analysis",
        "language": "en-zh",
        "collection": "corpus-metadata",
        "tags": ("oizerman", "source-metadata"),
        "updated": True,
    },
    "notes/community/DISCUSSIONS.md": {
        "type": "note",
        "language": "en-zh",
        "collection": "research-notes",
        "tags": ("community", "discussions", "recruitment"),
        "updated": True,
    },
    "notes/community/RECRUITMENT_POST.md": {
        "type": "note",
        "language": "zh",
        "collection": "research-notes",
        "tags": ("community", "recruitment", "digitization"),
        "updated": True,
    },
    "notes/community/RECRUITMENT_PLATFORMS.md": {
        "type": "note",
        "language": "en-zh",
        "collection": "research-notes",
        "tags": ("community", "recruitment", "outreach"),
        "updated": True,
    },
    "spinoza_markdown/metadata/source_audit.md": {
        "type": "analysis",
        "language": "en",
        "collection": "corpus-metadata",
        "tags": ("spinoza", "source-metadata", "audit"),
        "updated": True,
    },
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


def public_entry_errors(root: Path) -> list[str]:
    errors: list[str] = []
    readme = root / "README.md"
    if not readme.is_file():
        return ["缺少 README.md"]
    text = readme.read_text(encoding="utf-8")
    if text.startswith("---\n"):
        errors.append("README.md 不应包含 front matter")
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


def licensing_errors(root: Path) -> list[str]:
    errors: list[str] = []
    for relative in LICENSE_FILES:
        if not (root / relative).is_file():
            errors.append(f"缺少许可或权利文件: {relative}")
    if errors:
        return errors
    root_license = (root / "LICENSE").read_text(encoding="utf-8")
    required_scope = (
        "No single license applies to the entire repository",
        "LICENSES/MIT",
        "LICENSES/CC-BY-SA-4.0",
        "LICENSES/CC0-1.0",
        "Third-party and controlled content",
    )
    for value in required_scope:
        if value not in root_license:
            errors.append(f"LICENSE 缺少分层许可边界: {value}")
    rights = (root / "RIGHTS.md").read_text(encoding="utf-8")
    for value in ("## English", "## 中文", "SHA-256", "model training", "模型训练"):
        if value not in rights:
            errors.append(f"RIGHTS.md 缺少权利说明: {value}")
    policy = json.loads((root / "metadata/licensing_policy.json").read_text(encoding="utf-8"))
    expected = {
        "software": "MIT",
        "project_documentation": "CC-BY-SA-4.0",
        "factual_metadata": "CC0-1.0",
    }
    if policy.get("licenses") != expected:
        errors.append("metadata/licensing_policy.json 的分层许可证不正确")
    if (root / "metadata/public_assets_manifest.json").exists():
        errors.append("旧 public_assets_manifest.json 尚未迁移到中央权利注册表")
    return errors


def collaboration_errors(root: Path) -> list[str]:
    errors: list[str] = []
    for relative in COLLABORATION_FILES:
        if not (root / relative).is_file():
            errors.append(f"缺少公共协作接口: {relative}")
    if errors:
        return errors

    forms = {
        ".github/ISSUE_TEMPLATE/source-and-edition.yml": (
            "name: Source or edition report",
            "id: edition",
            "id: source",
            "Rights and access",
        ),
        ".github/ISSUE_TEMPLATE/text-or-digitization.yml": (
            "name: Text or digitization problem",
            "id: path",
            "id: evidence",
            "unapproved OCR run",
        ),
        ".github/ISSUE_TEMPLATE/rights-review.yml": (
            "name: Rights review or removal request",
            "id: basis",
            "id: action",
            "confidential",
        ),
        ".github/ISSUE_TEMPLATE/tooling.yml": (
            "name: Tooling or validation problem",
            "id: reproduce",
            "id: output",
            "removed secrets",
        ),
    }
    for relative, required in forms.items():
        text = (root / relative).read_text(encoding="utf-8")
        for value in required:
            if value not in text:
                errors.append(f"{relative}: 缺少 Issue 表单字段: {value}")

    config = (root / ".github/ISSUE_TEMPLATE/config.yml").read_text(encoding="utf-8")
    for value in ("blank_issues_enabled: false", "https://github.com/hoshF/Ilyenkov-cn/discussions"):
        if value not in config:
            errors.append(f"Issue 配置缺少: {value}")

    pull_request = (root / ".github/PULL_REQUEST_TEMPLATE.md").read_text(encoding="utf-8")
    for value in ("## Evidence", "## Rights And Provenance", "## Validation", "AGENTS.md"):
        if value not in pull_request:
            errors.append(f"PR 模板缺少: {value}")
    return errors


def citation_errors(root: Path) -> list[str]:
    path = root / "CITATION.cff"
    if not path.is_file():
        return ["缺少 CITATION.cff"]
    text = path.read_text(encoding="utf-8")
    required = (
        "cff-version: 1.2.0",
        "type: dataset",
        "title: Ilyenkov Philosophy Text Archive",
        "name: Ilyenkov Philosophy Text Archive contributors",
        "repository-code: https://github.com/hoshF/Ilyenkov-cn",
        "preferred-citation:",
        "original source, edition, provenance metadata",
    )
    errors = [f"CITATION.cff 缺少引用字段: {value}" for value in required if value not in text]
    if re.search(r"(?m)^license\s*:", text):
        errors.append("CITATION.cff 不得用单一 license 字段覆盖分层许可")
    if text.count("type: dataset") < 2:
        errors.append("CITATION.cff 的项目和 preferred-citation 都应为 dataset")
    return errors


def metadata_errors(root: Path) -> list[str]:
    errors: list[str] = []
    for relative, expected in METADATA_REQUIREMENTS.items():
        path = root / relative
        if not path.is_file():
            errors.append(f"缺少元数据受控文档: {relative}")
            continue
        metadata = parse_front_matter(path.read_text(encoding="utf-8"))
        for field in ("created", "type", "tags", "language", "collection", "llm_wiki_eligible", "gbrain_source"):
            if not metadata.get(field):
                errors.append(f"{relative}: 缺少 front matter 字段: {field}")
        for field in ("type", "language", "collection"):
            value = expected.get(field)
            if value and metadata.get(field) != value:
                errors.append(f"{relative}: {field} 应为 {value}")
        tags = metadata.get("tags", "")
        for tag in expected.get("tags", ()):
            if f'"{tag}"' not in tags:
                errors.append(f"{relative}: 缺少用途标签: {tag}")
        if expected.get("updated") and not metadata.get("updated"):
            errors.append(f"{relative}: 可变文档缺少 updated")
        if metadata.get("updated") and metadata.get("updated", "") < metadata.get("created", ""):
            errors.append(f"{relative}: updated 早于 created")
        if metadata.get("llm_wiki_eligible") != "true":
            errors.append(f"{relative}: llm_wiki_eligible 应为 true")
        if metadata.get("gbrain_source") != "project-markdown":
            errors.append(f"{relative}: gbrain_source 应为 project-markdown")
    return errors


def check(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    errors.extend(local_link_errors(root))
    errors.extend(claude_errors(root))
    errors.extend(agents_errors(root))
    errors.extend(terminology_errors(root))
    errors.extend(status_snapshot_errors(root))
    errors.extend(mission_errors(root))
    errors.extend(public_entry_errors(root))
    errors.extend(deprecated_text_errors(root))
    errors.extend(licensing_errors(root))
    errors.extend(collaboration_errors(root))
    errors.extend(citation_errors(root))
    errors.extend(metadata_errors(root))
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
