import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

REGISTRY_SPEC = importlib.util.spec_from_file_location(
    "collection_registry", SCRIPTS / "collection_registry.py"
)
REGISTRY = importlib.util.module_from_spec(REGISTRY_SPEC)
assert REGISTRY_SPEC.loader
REGISTRY_SPEC.loader.exec_module(REGISTRY)

MANAGER_SPEC = importlib.util.spec_from_file_location(
    "manage_collections", SCRIPTS / "manage_collections.py"
)
MANAGER = importlib.util.module_from_spec(MANAGER_SPEC)
assert MANAGER_SPEC.loader
MANAGER_SPEC.loader.exec_module(MANAGER)


class ManageCollectionsTests(unittest.TestCase):
    def registry(self):
        return {
            "schema_version": 1,
            "generated_at": "2026-06-21",
            "project": {
                "large_binary_threshold_bytes": 100,
                "gbrain_extra_roots": ["notes/"],
                "excluded_directory_names": ["cache", "digitization", "source_scans"],
            },
            "people": [{
                "id": "test",
                "name_zh": "测试",
                "name_original": "Test",
                "name_latin": "Test",
                "relation": "测试",
            }],
            "collections": [],
        }

    def fixture(self, root: Path):
        (root / "metadata").mkdir()
        (root / "notes").mkdir()
        (root / "gbrain.yml").write_text(
            "storage:\n  db_tracked:\n    # COLLECTIONS-AUTO:BEGIN\n"
            "    - notes/\n    # COLLECTIONS-AUTO:END\n  db_only: []\n",
            encoding="utf-8",
        )
        (root / "metadata/collections.json").write_text(
            json.dumps(self.registry(), ensure_ascii=False), encoding="utf-8"
        )

    def test_duplicate_and_unsafe_paths_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            data = self.registry()
            data["people"].append(dict(data["people"][0]))
            data["collections"].append({
                "id": "bad",
                "person_id": "test",
                "root": "../outside",
                "layout": "legacy",
                "corpus_paths": [],
                "scan_paths": [],
                "bibliography_paths": [],
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            errors = REGISTRY.validate_registry(root, require_paths=False)
            self.assertTrue(any("人物 ID 重复" in error for error in errors))
            self.assertTrue(any("不是仓库内相对路径" in error for error in errors))

    def test_unregistered_scan_manifest_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            manifest = root / "orphan_markdown/metadata/source_scans_manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text('{"schema_version": 1, "items": []}', encoding="utf-8")
            errors = REGISTRY.validate_registry(root)
            self.assertTrue(any("未登记到中央注册表" in error for error in errors))

    def test_add_person_creates_standard_layout_and_syncs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            args = SimpleNamespace(
                id="new-person",
                name_zh="新人",
                name_original="Новый философ",
                name_latin="New Philosopher",
                relation="后续研究对象",
                language="ru",
                date="2026-06-21",
            )
            MANAGER.scaffold_person(root, args)
            author_root = root / "new-person_markdown"
            self.assertTrue((author_root / "new-person_md/.gitkeep").is_file())
            self.assertTrue((author_root / "metadata/works_master.json").is_file())
            data = REGISTRY.load_registry(root)
            collection = next(item for item in data["collections"] if item["person_id"] == "new-person")
            self.assertEqual(collection["layout"], "standard")
            self.assertIn("new-person_markdown/", (root / "gbrain.yml").read_text())
            self.assertIn("新人", (root / "COLLECTION_STATUS.md").read_text())
            self.assertEqual(REGISTRY.validate_registry(root), [])

    def test_status_generation_is_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            first = MANAGER.status_markdown(root)
            second = MANAGER.status_markdown(root)
            self.assertEqual(first, second)

    def test_digitization_planned_requires_only_project_record(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            data = self.registry()
            data["collections"].append({
                "id": "test-texts",
                "person_id": "test",
                "kind": "author_texts",
                "root": "test_markdown",
                "layout": "legacy",
                "stage": "source_scans",
                "readme": None,
                "corpus_paths": [],
                "scan_paths": [],
                "scan_manifest": "test_markdown/metadata/source_scans_manifest.json",
                "works_manifest": None,
                "bibliography_paths": [],
                "source_survey": None,
                "gbrain_tracked": True,
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            scan = root / "test_markdown/source_scans/book.pdf"
            scan.parent.mkdir(parents=True)
            scan.write_bytes(b"scan")
            metadata = root / "test_markdown/metadata"
            metadata.mkdir()
            (metadata / "source_scans_manifest.json").write_text(json.dumps({"items": [{
                "local_path": "source_scans/book.pdf"
            }]}), encoding="utf-8")
            project = root / "test_markdown/digitization/book"
            project.mkdir(parents=True)
            (project / "project.json").write_text(json.dumps({
                "schema_version": 1,
                "author_id": "test",
                "work_id": "book",
                "source_scan": "test_markdown/source_scans/book.pdf",
                "source_sha256": MANAGER.sha256(scan),
                "source_version": "first",
                "status": "planned",
                "created": "2026-06-21",
                "ocr_activated": False,
            }), encoding="utf-8")
            self.assertEqual(MANAGER.validate_digitization(root), [])

    def test_human_verified_digitization_requires_final_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            data = self.registry()
            data["collections"].append({
                "id": "test-texts",
                "person_id": "test",
                "kind": "author_texts",
                "root": "test_markdown",
                "layout": "legacy",
                "stage": "source_scans",
                "readme": None,
                "corpus_paths": [],
                "scan_paths": [],
                "scan_manifest": "test_markdown/metadata/source_scans_manifest.json",
                "works_manifest": None,
                "bibliography_paths": [],
                "source_survey": None,
                "gbrain_tracked": True,
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            scan = root / "test_markdown/source_scans/book.pdf"
            scan.parent.mkdir(parents=True)
            scan.write_bytes(b"scan")
            metadata = root / "test_markdown/metadata"
            metadata.mkdir()
            (metadata / "source_scans_manifest.json").write_text(json.dumps({"items": [{
                "local_path": "source_scans/book.pdf"
            }]}), encoding="utf-8")
            project = root / "test_markdown/digitization/book"
            project.mkdir(parents=True)
            (project / "project.json").write_text(json.dumps({
                "schema_version": 1,
                "author_id": "test",
                "work_id": "book",
                "source_scan": "test_markdown/source_scans/book.pdf",
                "source_sha256": MANAGER.sha256(scan),
                "source_version": "first",
                "status": "human_verified",
                "created": "2026-06-21",
                "ocr_activated": True,
            }), encoding="utf-8")
            errors = MANAGER.validate_digitization(root)
            self.assertTrue(any("缺少 page_map.json" in error for error in errors))

    def test_translation_project_requires_matching_source_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "author/work.md"
            source.parent.mkdir()
            source.write_text("# Work\n", encoding="utf-8")
            project = root / "translation_workspace/planned/author/work"
            project.mkdir(parents=True)
            (project / "translation.json").write_text(json.dumps({
                "schema_version": 1,
                "author_id": "author",
                "work_id": "work",
                "source_path": "author/work.md",
                "source_url": "https://example.test",
                "source_version": "first",
                "source_sha256": "0" * 64,
                "target_language": "zh",
                "status": "planned",
            }), encoding="utf-8")
            errors = MANAGER.validate_translation_projects(root)
            self.assertTrue(any("source_sha256 不匹配" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
