import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import check_glossaries as CHECK
import render_glossaries as RENDER


class GlossaryTests(unittest.TestCase):
    def setUp(self):
        self.original_check_root = CHECK.ROOT
        self.original_render_root = RENDER.ROOT
        self.original_render_paths = RENDER.GLOSSARY_PATHS

    def tearDown(self):
        CHECK.ROOT = self.original_check_root
        RENDER.ROOT = self.original_render_root
        RENDER.GLOSSARY_PATHS = self.original_render_paths

    def fixture(self, root: Path, glossary: dict) -> Path:
        metadata = root / "metadata"
        metadata.mkdir()
        (metadata / "collections.json").write_text(json.dumps({
            "schema_version": 1,
            "people": [{
                "id": "test",
                "name_zh": "测试哲学家",
                "name_original": "Test Philosopher",
                "name_latin": "Test Philosopher",
            }],
            "collections": [],
        }), encoding="utf-8")
        schema = metadata / "schemas"
        schema.mkdir()
        (schema / "glossary.schema.json").write_text("{}", encoding="utf-8")
        (root / "test_markdown/test_md").mkdir(parents=True)
        path = root / "test_markdown/metadata/glossary.json"
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(glossary, ensure_ascii=False), encoding="utf-8")
        CHECK.ROOT = root
        RENDER.ROOT = root
        RENDER.GLOSSARY_PATHS = (path.relative_to(root).as_posix(),)
        return path

    def base_glossary(self) -> dict:
        return {
            "schema_version": 1,
            "author_id": "test",
            "updated_at": "2026-07-01",
            "source_corpus_paths": ["test_markdown/test_md/"],
            "required_entry_ids": ["alpha"],
            "entries": [{
                "id": "alpha",
                "category": "concept",
                "canonical": "alpha",
                "forms": ["Alpha"],
                "zh_preferred": "阿尔法",
                "zh_alternatives": [],
                "status": "provisional",
                "notes": "Test entry.",
                "evidence": [{"corpus_path": "test_markdown/test_md/", "note": "Fixture corpus."}],
            }],
        }

    def test_repository_glossaries_validate(self):
        known_people = CHECK.registered_people()
        errors = []
        for relative in CHECK.GLOSSARY_PATHS:
            errors.extend(CHECK.validate_glossary(CHECK.ROOT / relative, known_people))
        errors.extend(CHECK.generated_view_errors())
        self.assertEqual(errors, [])

    def test_duplicate_form_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            glossary = self.base_glossary()
            duplicate = copy.deepcopy(glossary["entries"][0])
            duplicate["id"] = "beta"
            duplicate["canonical"] = "beta"
            duplicate["forms"] = ["Alpha"]
            glossary["entries"].append(duplicate)
            path = self.fixture(root, glossary)

            errors = CHECK.validate_glossary(path, {"test"})

            self.assertTrue(any("duplicate form" in error for error in errors))

    def test_missing_required_entry_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            glossary = self.base_glossary()
            glossary["required_entry_ids"] = ["alpha", "missing"]
            path = self.fixture(root, glossary)

            errors = CHECK.validate_glossary(path, {"test"})

            self.assertTrue(any("missing required entry missing" in error for error in errors))

    def test_invalid_status_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            glossary = self.base_glossary()
            glossary["entries"][0]["status"] = "final"
            path = self.fixture(root, glossary)

            errors = CHECK.validate_glossary(path, {"test"})

            self.assertTrue(any("invalid status" in error for error in errors))

    def test_stale_generated_view_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            glossary = self.base_glossary()
            self.fixture(root, glossary)
            view = root / "notes/terminology/README.md"
            view.parent.mkdir(parents=True)
            view.write_text("# stale\n", encoding="utf-8")

            errors = CHECK.generated_view_errors()

            self.assertTrue(any("generated glossary view is stale" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
