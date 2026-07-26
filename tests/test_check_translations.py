import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_translations.py"
SPEC = importlib.util.spec_from_file_location("check_translations", SCRIPT)
CHECK = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(CHECK)

PREPARE_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "prepare_gbrain_markdown.py"
PREPARE_SPEC = importlib.util.spec_from_file_location("prepare_gbrain_markdown_for_translations", PREPARE_SCRIPT)
PREPARE = importlib.util.module_from_spec(PREPARE_SPEC)
assert PREPARE_SPEC.loader
PREPARE_SPEC.loader.exec_module(PREPARE)


class TranslationChecksTests(unittest.TestCase):
    def make_root(self, directory: str) -> tuple[Path, Path, str]:
        root = Path(directory)
        (root / "metadata/schemas").mkdir(parents=True)
        (root / "metadata/schemas/translation_project.schema.json").write_text(
            "{}\n", encoding="utf-8"
        )
        registry = {
            "people": [{"id": "test"}],
            "collections": [{
                "id": "test-texts",
                "person_id": "test",
                "corpus_paths": ["test_markdown/test_md/"],
            }],
        }
        (root / "metadata/collections.json").write_text(
            json.dumps(registry), encoding="utf-8"
        )
        source = root / "test_markdown/test_md/work.md"
        source.parent.mkdir(parents=True)
        source.write_text(
            "---\n"
            "text_role: \"author_original\"\n"
            "core_corpus_eligible: \"true\"\n"
            "llm_wiki_eligible: \"true\"\n"
            "gbrain_source: \"project-markdown\"\n"
            "source_url: \"https://example.test/work\"\n"
            "---\n"
            "# Source\n\nAlpha.\n\nBeta.\n",
            encoding="utf-8",
        )
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        return root, source, digest

    def metadata(self, digest: str, status: str = "planned") -> dict:
        return {
            "schema_version": 3,
            "author_id": "test",
            "work_id": "work",
            "created_at": "2026-07-18",
            "updated_at": "2026-07-18",
            "target_language": "zh",
            "source_units": [{
                "id": "full",
                "status": status,
                "source_segments": [{
                    "source_path": "test_markdown/test_md/work.md",
                    "source_url": "https://example.test/work",
                    "source_version": "1974 edition",
                    "source_sha256": digest,
                    "source_block_start": 2,
                    "source_block_end": 3,
                }],
                "paragraph_count": 2,
                "accuracy_review": {
                    "reviewer": None,
                    "reviewed_at": None,
                    "result": "pending",
                    "scope_sha256": None,
                },
                "language_review": {
                    "reviewer": None,
                    "reviewed_at": None,
                    "result": "pending",
                    "scope_sha256": None,
                },
            }],
        }

    def write_project(self, root: Path, stage: str, data: dict) -> Path:
        project = root / f"translation_workspace/{stage}/test/work"
        project.mkdir(parents=True)
        (project / "translation.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return project

    def rewrite_project(self, project: Path, data: dict) -> None:
        (project / "translation.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    def pass_reviews(self, project: Path, data: dict) -> None:
        passed = {
            "reviewer": "Human Reviewer",
            "reviewed_at": "2026-07-18",
            "result": "passed",
            "scope_sha256": None,
        }
        for unit in data["source_units"]:
            unit["accuracy_review"] = copy.deepcopy(passed)
            unit["language_review"] = copy.deepcopy(passed)
            unit["accuracy_review"]["scope_sha256"] = CHECK.review_scope_sha256(
                project, unit, "accuracy"
            )
            unit["language_review"]["scope_sha256"] = CHECK.review_scope_sha256(
                project, unit, "language"
            )
        self.rewrite_project(project, data)

    def write_unit(
        self,
        project: Path,
        literal_ids: list[str],
        final_ids: list[str] | None = None,
        issues: str = "# 翻译疑难问题\n\n当前没有已登记的问题。\n",
    ) -> None:
        unit = project / "units/full"
        unit.mkdir(parents=True)
        literal = "# 结构忠实初译\n\n" + "\n\n".join(
            f"## {paragraph_id}\n\n初译。" for paragraph_id in literal_ids
        ) + "\n"
        (unit / "literal.md").write_text(literal, encoding="utf-8")
        (unit / "issues.md").write_text(issues, encoding="utf-8")
        if final_ids is not None:
            final = "# 中文学术定稿\n\n" + "\n\n".join(
                f"## {paragraph_id}\n\n定稿。" for paragraph_id in final_ids
            ) + "\n"
            (unit / "final.md").write_text(final, encoding="utf-8")

    def test_repository_state_validates(self):
        project_count, errors = CHECK.validate_repository(CHECK.ROOT)
        self.assertGreaterEqual(project_count, 0)
        self.assertEqual(errors, [])

    def test_markdown_templates_include_translation_layer_metadata(self):
        templates = CHECK.ROOT / "translation_workspace/templates"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for filename in ("literal.md", "final.md", "issues.md"):
                path = root / f"translation_workspace/drafts/test/work/units/full/{filename}"
                path.parent.mkdir(parents=True, exist_ok=True)
                text = (templates / filename).read_text(encoding="utf-8")
                path.write_text(text, encoding="utf-8")
                self.assertEqual(PREPARE.validate_file(path, text, root), [])

    def test_valid_planned_project_needs_no_draft_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            self.write_project(root, "planned", self.metadata(digest))

            project_count, errors = CHECK.validate_repository(root)

            self.assertEqual(project_count, 1)
            self.assertEqual(errors, [])

    def test_drafting_allows_partial_literal_without_final(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "drafting")
            project = self.write_project(root, "drafts", data)
            self.write_unit(project, ["full-p0001"])

            _, errors = CHECK.validate_repository(root)

            self.assertEqual(errors, [])

    def test_source_hash_change_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, source, digest = self.make_root(directory)
            self.write_project(root, "planned", self.metadata(digest))
            source.write_text(source.read_text(encoding="utf-8") + "Changed.\n", encoding="utf-8")

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("source SHA-256 mismatch" in error for error in errors))

    def test_project_directory_requires_translation_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, _ = self.make_root(directory)
            (root / "translation_workspace/planned/test/work").mkdir(parents=True)

            project_count, errors = CHECK.validate_repository(root)

            self.assertEqual(project_count, 0)
            self.assertTrue(any("missing project metadata" in error for error in errors))

    def test_accuracy_review_requires_complete_matching_drafts(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "accuracy_review")
            project = self.write_project(root, "drafts", data)
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001"],
            )

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("must contain all 2 registered paragraphs" in error for error in errors))
            self.assertTrue(any("literal and final paragraph ids differ" in error for error in errors))

    def test_reviewed_project_requires_both_human_reviews(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "reviewed")
            project = self.write_project(root, "reviewed", data)
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001", "full-p0002"],
            )

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("accuracy review must pass" in error for error in errors))
            self.assertTrue(any("language review must pass" in error for error in errors))

    def test_reviewed_project_rejects_open_blocking_issue(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "reviewed")
            project = self.write_project(root, "reviewed", data)
            issues = (
                "# 翻译疑难问题\n\n"
                "## ISSUE-0001\n\n"
                "- 段落：`full-p0001`\n"
                "- 类型：句法\n"
                "- 术语条目：\n"
                "- 阻断：是\n"
                "- 状态：open\n"
                "- 问题：从句归属待确认\n"
                "- 候选：两种分析\n"
                "- 同作者语料证据：尚未找到\n"
                "- 最终决定：\n"
                "- 理由：\n"
            )
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001", "full-p0002"],
                issues,
            )
            self.pass_reviews(project, data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("open blocking issue" in error for error in errors))

    def test_valid_reviewed_project_passes(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "reviewed")
            data["work_complete"] = True
            project = self.write_project(root, "reviewed", data)
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001", "full-p0002"],
            )
            self.pass_reviews(project, data)

            _, errors = CHECK.validate_repository(root)

            self.assertEqual(errors, [])

    def test_source_block_parser_ignores_front_matter_and_thematic_breaks(self):
        text = (
            "---\ntitle: \"Test\"\n---\n"
            "# Heading\n\nParagraph.\n\n---\n\n"
            "```text\nfirst\n\nsecond\n```\n"
        )

        blocks = CHECK.markdown_source_blocks(text)

        self.assertEqual(blocks, ["# Heading", "Paragraph.", "```text\nfirst\n\nsecond\n```"])

    def test_selected_source_range_controls_paragraph_count(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest)
            data["source_units"][0]["paragraph_count"] = 1
            project = self.write_project(root, "planned", data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("paragraph_count must equal selected source blocks=2" in error for error in errors))

    def test_hidden_fulltext_source_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, source, digest = self.make_root(directory)
            hidden = root / "test_markdown/test_md/.fulltext/work.md"
            hidden.parent.mkdir(parents=True)
            hidden.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
            data = self.metadata(digest)
            segment = data["source_units"][0]["source_segments"][0]
            segment["source_path"] = "test_markdown/test_md/.fulltext/work.md"
            segment["source_sha256"] = hashlib.sha256(hidden.read_bytes()).hexdigest()
            self.write_project(root, "planned", data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("visible corpus Markdown" in error for error in errors))

    def test_hidden_dotfile_source_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, source, digest = self.make_root(directory)
            hidden = root / "test_markdown/test_md/.work.md"
            hidden.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
            data = self.metadata(digest)
            segment = data["source_units"][0]["source_segments"][0]
            segment["source_path"] = "test_markdown/test_md/.work.md"
            segment["source_sha256"] = hashlib.sha256(hidden.read_bytes()).hexdigest()
            self.write_project(root, "planned", data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("visible corpus Markdown" in error for error in errors))

    def test_source_excluded_from_gbrain_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, source, _ = self.make_root(directory)
            source.write_text(
                source.read_text(encoding="utf-8").replace(
                    'llm_wiki_eligible: "true"',
                    'llm_wiki_eligible: "false"',
                ),
                encoding="utf-8",
            )
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            self.write_project(root, "planned", self.metadata(digest))

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("GBrain-visible project Markdown" in error for error in errors))

    def test_split_source_requires_work_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, _ = self.make_root(directory)
            source = root / "test_markdown/test_md/work/work-ch001.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                "---\n"
                "id: \"work-ch001\"\n"
                "work_id: \"work\"\n"
                "chapter_index: \"001\"\n"
                "chapter_title: \"Chapter\"\n"
                "text_role: \"author_original\"\n"
                "core_corpus_eligible: \"true\"\n"
                "llm_wiki_eligible: \"true\"\n"
                "gbrain_source: \"project-markdown\"\n"
                "source_url: \"https://example.test/work\"\n"
                "---\n"
                "## Chapter\n\nAlpha.\n",
                encoding="utf-8",
            )
            data = self.metadata(hashlib.sha256(source.read_bytes()).hexdigest())
            unit = data["source_units"][0]
            segment = unit["source_segments"][0]
            segment["source_path"] = "test_markdown/test_md/work/work-ch001.md"
            segment["source_sha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
            segment["source_block_start"] = 2
            segment["source_block_end"] = 2
            unit["paragraph_count"] = 1
            project = self.write_project(root, "planned", data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("missing work_manifest.json" in error for error in errors))

            (source.parent / "work_manifest.json").write_text(json.dumps({
                "schema_version": 1,
                "work_id": "work",
                "chapters": [{
                    "chapter_index": "001",
                    "file": source.name,
                    "file_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                }],
            }), encoding="utf-8")
            _, errors = CHECK.validate_repository(root)
            self.assertEqual(errors, [])

            second = source.parent / "work-ch002.md"
            second.write_text(
                "---\n"
                "id: \"work-ch002\"\n"
                "work_id: \"work\"\n"
                "chapter_index: \"002\"\n"
                "chapter_title: \"Chapter Two\"\n"
                "text_role: \"author_original\"\n"
                "core_corpus_eligible: \"true\"\n"
                "llm_wiki_eligible: \"true\"\n"
                "gbrain_source: \"project-markdown\"\n"
                "source_url: \"https://example.test/work\"\n"
                "---\n"
                "## Chapter Two\n\nBeta.\n",
                encoding="utf-8",
            )
            manifest = json.loads((source.parent / "work_manifest.json").read_text(encoding="utf-8"))
            manifest["chapters"].append({
                "chapter_index": "002",
                "file": second.name,
                "file_sha256": hashlib.sha256(second.read_bytes()).hexdigest(),
            })
            (source.parent / "work_manifest.json").write_text(
                json.dumps(manifest), encoding="utf-8"
            )
            data["source_units"][0]["source_segments"].append({
                "source_path": "test_markdown/test_md/work/work-ch002.md",
                "source_url": "https://example.test/work",
                "source_version": "1974 edition",
                "source_sha256": hashlib.sha256(second.read_bytes()).hexdigest(),
                "source_block_start": 2,
                "source_block_end": 2,
            })
            data["source_units"][0]["paragraph_count"] = 2
            self.rewrite_project(project, data)

            _, errors = CHECK.validate_repository(root)

            self.assertEqual(errors, [])

            data["source_units"][0]["source_segments"].reverse()
            self.rewrite_project(project, data)
            _, errors = CHECK.validate_repository(root)
            self.assertTrue(any("must follow source order" in error for error in errors))

    def test_translation_paragraph_must_have_content(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "drafting")
            project = self.write_project(root, "drafts", data)
            self.write_unit(project, ["full-p0001"])
            (project / "units/full/literal.md").write_text(
                "# 结构忠实初译\n\n## full-p0001\n", encoding="utf-8"
            )

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("paragraph has no translation content" in error for error in errors))

    def test_translation_content_before_first_anchor_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "drafting")
            project = self.write_project(root, "drafts", data)
            self.write_unit(project, ["full-p0001"])
            (project / "units/full/literal.md").write_text(
                "# 结构忠实初译\n\n未编号的译文。\n\n## full-p0001\n\n初译。\n",
                encoding="utf-8",
            )

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("before the first paragraph anchor" in error for error in errors))

    def test_passed_accuracy_review_rejects_open_blocking_issue(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "accuracy_review")
            project = self.write_project(root, "drafts", data)
            issues = (
                "# 翻译疑难问题\n\n"
                "## ISSUE-0001\n\n"
                "- 段落：`full-p0001`\n"
                "- 类型：句法\n"
                "- 术语条目：\n"
                "- 阻断：是\n"
                "- 状态：open\n"
                "- 问题：从句归属待确认\n"
                "- 候选：两种分析\n"
                "- 同作者语料证据：尚未找到\n"
                "- 最终决定：\n"
                "- 理由：\n"
            )
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001", "full-p0002"],
                issues,
            )
            data["source_units"][0]["accuracy_review"] = {
                "reviewer": "Human Reviewer",
                "reviewed_at": "2026-07-18",
                "result": "passed",
                "scope_sha256": CHECK.review_scope_sha256(
                    project, data["source_units"][0], "accuracy"
                ),
            }
            self.rewrite_project(project, data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("open blocking issue" in error for error in errors))

    def test_passed_accuracy_review_cannot_stay_in_accuracy_review(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "accuracy_review")
            project = self.write_project(root, "drafts", data)
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001", "full-p0002"],
            )
            data["source_units"][0]["accuracy_review"] = {
                "reviewer": "Human Reviewer",
                "reviewed_at": "2026-07-18",
                "result": "passed",
                "scope_sha256": CHECK.review_scope_sha256(
                    project, data["source_units"][0], "accuracy"
                ),
            }
            self.rewrite_project(project, data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any(
                "passed accuracy review requires unit status=language_review or reviewed" in error
                for error in errors
            ))

    def test_passed_language_review_cannot_stay_in_language_review(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "language_review")
            project = self.write_project(root, "drafts", data)
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001", "full-p0002"],
            )
            self.pass_reviews(project, data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any(
                "passed language review requires unit status=reviewed" in error
                for error in errors
            ))

    def test_markdown_source_blocks_is_a_stable_contract(self):
        text = (
            "---\n"
            "title: \"Test\"\n"
            "---\n"
            "## Заголовок\n"
            "\n"
            "Первый абзац\n"
            "продолжение строки.\n"
            "\n"
            "---\n"
            "\n"
            "- пункт один\n"
            "- пункт два\n"
            "\n"
            "```text\n"
            "код\n"
            "\n"
            "внутри блока\n"
            "```\n"
            "\n"
            "Последний абзац. [^1]\n"
            "\n"
            "[^1]: Сноска.\n"
        )

        blocks = CHECK.markdown_source_blocks(text)

        self.assertEqual(blocks, [
            "## Заголовок",
            "Первый абзац\nпродолжение строки.",
            "- пункт один\n- пункт два",
            "```text\nкод\n\nвнутри блока\n```",
            "Последний абзац. [^1]",
            "[^1]: Сноска.",
        ])

    def test_review_hash_detects_post_review_edit(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "reviewed")
            project = self.write_project(root, "reviewed", data)
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001", "full-p0002"],
            )
            self.pass_reviews(project, data)
            final = project / "units/full/final.md"
            final.write_text(final.read_text(encoding="utf-8") + "\n修改。\n", encoding="utf-8")

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("scope_sha256 does not match current artifacts" in error for error in errors))

    def test_accuracy_hash_detects_source_mapping_change(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "reviewed")
            project = self.write_project(root, "reviewed", data)
            self.write_unit(
                project,
                ["full-p0001", "full-p0002"],
                ["full-p0001", "full-p0002"],
            )
            self.pass_reviews(project, data)
            segment = data["source_units"][0]["source_segments"][0]
            segment["source_block_start"] = 1
            segment["source_block_end"] = 2
            self.rewrite_project(project, data)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("accuracy_review: scope_sha256" in error for error in errors))

    def test_terminology_issue_must_reference_author_glossary(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            glossary = root / "test_markdown/metadata/glossary.json"
            glossary.parent.mkdir(parents=True, exist_ok=True)
            glossary.write_text(json.dumps({
                "entries": [{"id": "known-term"}],
            }), encoding="utf-8")
            data = self.metadata(digest, "drafting")
            project = self.write_project(root, "drafts", data)
            issues = (
                "# 翻译疑难问题\n\n"
                "## ISSUE-0001\n\n"
                "- 段落：`full-p0001`\n"
                "- 类型：术语\n"
                "- 术语条目：`missing-term`\n"
                "- 阻断：是\n"
                "- 状态：open\n"
                "- 问题：译名待确认\n"
                "- 候选：两个译名\n"
                "- 同作者语料证据：尚未找到\n"
                "- 最终决定：\n"
                "- 理由：\n"
            )
            self.write_unit(project, ["full-p0001"], issues=issues)

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("unknown glossary entry=missing-term" in error for error in errors))

    def test_forbidden_punctuation_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "drafting")
            project = self.write_project(root, "drafts", data)
            self.write_unit(project, ["full-p0001"])
            literal = project / "units/full/literal.md"
            literal.write_text(
                '# 结构忠实初译\n\n## full-p0001\n\n他说“对”，又说 "wrong"，还有 «guillemets»……\n',
                encoding="utf-8",
            )

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("ASCII double quote" in error for error in errors))
            self.assertTrue(any("guillemet" in error for error in errors))

    def test_ascii_ellipsis_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "drafting")
            project = self.write_project(root, "drafts", data)
            self.write_unit(project, ["full-p0001"])
            literal = project / "units/full/literal.md"
            literal.write_text(
                "# 结构忠实初译\n\n## full-p0001\n\n话没有说完...\n", encoding="utf-8"
            )

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("Chinese ellipsis" in error for error in errors))

    def test_emphasis_and_footnotes_must_match_the_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "accuracy_review")
            project = self.write_project(root, "drafts", data)
            self.write_unit(
                project, ["full-p0001", "full-p0002"], ["full-p0001", "full-p0002"]
            )
            # The fixture source has neither emphasis nor footnotes.
            final = project / "units/full/final.md"
            final.write_text(
                "# 中文学术定稿\n\n## full-p0001\n\n定稿*强调*。[^extra]\n\n"
                "## full-p0002\n\n定稿。\n",
                encoding="utf-8",
            )

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("emphasis spans=1" in error for error in errors))
            self.assertTrue(any("footnote markers not in the source" in error for error in errors))

    def test_final_draft_copied_from_literal_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, source, _ = self.make_root(directory)
            # Six prose paragraphs, long enough to count as prose.
            body = "\n\n".join(f"段落{n}。" + "内容" * 30 for n in range(1, 7))
            source.write_text(
                source.read_text(encoding="utf-8").split("---\n")[0] + "---\n"
                + "\n".join(source.read_text(encoding="utf-8").split("---\n")[1].splitlines())
                + "\n---\n" + body + "\n",
                encoding="utf-8",
            )
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            data = self.metadata(digest, "accuracy_review")
            unit = data["source_units"][0]
            unit["source_segments"][0]["source_sha256"] = digest
            unit["source_segments"][0]["source_block_start"] = 1
            unit["source_segments"][0]["source_block_end"] = 6
            unit["paragraph_count"] = 6
            project = self.write_project(root, "drafts", data)
            ids = [f"full-p{n:04d}" for n in range(1, 7)]
            unit_dir = project / "units/full"
            unit_dir.mkdir(parents=True)
            paragraphs = "\n\n".join(f"## {i}\n\n定稿段落。" + "文字" * 30 for i in ids)
            (unit_dir / "literal.md").write_text(f"# 结构忠实初译\n\n{paragraphs}\n", encoding="utf-8")
            (unit_dir / "final.md").write_text(f"# 中文学术定稿\n\n{paragraphs}\n", encoding="utf-8")
            (unit_dir / "issues.md").write_text("# 翻译疑难问题\n\n无。\n", encoding="utf-8")

            _, errors = CHECK.validate_repository(root)

            self.assertTrue(any("identical to literal.md" in error for error in errors))

    def test_translator_footnotes_are_allowed_with_the_zh_prefix(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "accuracy_review")
            project = self.write_project(root, "drafts", data)
            self.write_unit(
                project, ["full-p0001", "full-p0002"], ["full-p0001", "full-p0002"]
            )
            # A translator note adds a footnote the source does not have, which
            # notes/STYLE_GUIDE.md explicitly permits when zh-prefixed.
            final = project / "units/full/final.md"
            final.write_text(
                "# 中文学术定稿\n\n## full-p0001\n\n定稿。[^zh-1]\n\n"
                "## full-p0002\n\n定稿。\n\n[^zh-1]: 谚语直译无法达意——译注\n",
                encoding="utf-8",
            )

            _, errors = CHECK.validate_repository(root)

            self.assertEqual(errors, [])

    def test_all_units_reviewed_stays_in_drafts_until_work_complete(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "reviewed")
            project = self.write_project(root, "drafts", data)
            self.write_unit(project, ["full-p0001", "full-p0002"], ["full-p0001", "full-p0002"])
            self.pass_reviews(project, data)

            # A long work registered unit by unit is not finished just because
            # every registered unit is reviewed.
            _, errors = CHECK.validate_repository(root)
            self.assertEqual(errors, [])

            data["work_complete"] = True
            self.rewrite_project(project, data)
            _, errors = CHECK.validate_repository(root)
            self.assertTrue(any("belongs under reviewed/" in error for error in errors))

    def test_reviewed_stage_requires_work_complete(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "reviewed")
            project = self.write_project(root, "reviewed", data)
            self.write_unit(project, ["full-p0001", "full-p0002"], ["full-p0001", "full-p0002"])
            self.pass_reviews(project, data)

            _, errors = CHECK.validate_repository(root)
            self.assertTrue(any("requires work_complete=true" in error for error in errors))

            data["work_complete"] = True
            self.rewrite_project(project, data)
            _, errors = CHECK.validate_repository(root)
            self.assertEqual(errors, [])

    def test_status_lists_units_and_stages(self):
        import contextlib
        import io

        with tempfile.TemporaryDirectory() as directory:
            root, _, digest = self.make_root(directory)
            data = self.metadata(digest, "drafting")
            project = self.write_project(root, "drafts", data)
            self.write_unit(project, ["full-p0001"])

            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                CHECK.print_status(root)
            output = buffer.getvalue()

            self.assertIn("full", output)
            self.assertIn("drafting", output)
            self.assertIn("total:", output)


if __name__ == "__main__":
    unittest.main()
