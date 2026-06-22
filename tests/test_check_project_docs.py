import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_project_docs.py"
SPEC = importlib.util.spec_from_file_location("check_project_docs", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class ProjectDocsTests(unittest.TestCase):
    def test_claude_must_be_short_stateless_pointer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "CLAUDE.md").write_text(
                "# Claude\n\n请读 [AGENTS.md](AGENTS.md)。仓库有 1000 个文件。\n",
                encoding="utf-8",
            )
            errors = MODULE.claude_errors(root)
            self.assertTrue(any("状态数字" in error for error in errors))

    def test_agents_requires_generated_markers_and_navigation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "AGENTS.md").write_text("# Agent\n", encoding="utf-8")
            errors = MODULE.agents_errors(root)
            self.assertTrue(any("AGENTS-AUTO:BEGIN" in error for error in errors))
            self.assertTrue(any("metadata/collections.json" in error for error in errors))

    def test_old_project_name_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "README.md"
            path.write_text(MODULE.OLD_PROJECT_NAME, encoding="utf-8")
            errors = MODULE.terminology_errors(root, ("README.md",))
            self.assertEqual(len(errors), 1)

    def test_missing_local_link_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "README.md"
            path.write_text("[missing](notes/missing.md)\n", encoding="utf-8")
            errors = MODULE.local_link_errors(root, ("README.md",))
            self.assertEqual(len(errors), 1)

    def test_status_document_rejects_live_gbrain_metrics(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "notes/REPOSITORY_STATUS_FOR_CLAUDE.md"
            target.parent.mkdir()
            target.write_text("embedding coverage 100%\n", encoding="utf-8")
            other = root / "notes/KEDROV_COLLECTION_STATUS_FOR_CLAUDE.md"
            other.write_text("现场查询。\n", encoding="utf-8")
            errors = MODULE.status_snapshot_errors(root)
            self.assertTrue(any("GBrain 实时指标" in error for error in errors))

    def test_mission_requires_digitization_platform_and_translation_program(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "README.md"
            path.write_text("# Project\n", encoding="utf-8")
            requirements = MODULE.MISSION_REQUIREMENTS
            MODULE.MISSION_REQUIREMENTS = {
                "README.md": (
                    "## English Summary",
                    "原典数字化与研究平台",
                    "中文翻译与精读计划",
                )
            }
            try:
                errors = MODULE.mission_errors(root)
            finally:
                MODULE.MISSION_REQUIREMENTS = requirements
            self.assertEqual(len(errors), 3)

    def test_deprecated_source_role_and_collection_status_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "survey.md"
            path.write_text(
                'text_role: "source"\n尚未把本组文件存入仓库\n',
                encoding="utf-8",
            )
            errors = MODULE.deprecated_text_errors(root, ("survey.md",))
            self.assertEqual(len(errors), 2)


if __name__ == "__main__":
    unittest.main()
