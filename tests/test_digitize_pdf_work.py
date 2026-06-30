import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
SPEC = importlib.util.spec_from_file_location("digitize_pdf_work", SCRIPTS / "digitize_pdf_work.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class DigitizePdfWorkTests(unittest.TestCase):
    def fixture(self, root: Path) -> tuple[Path, Path, Path]:
        (root / "metadata").mkdir()
        scan = root / "test_markdown/source_scans/book.pdf"
        scan.parent.mkdir(parents=True)
        scan.write_bytes(b"pdf bytes")
        source_manifest = root / "test_markdown/metadata/source_scans_manifest.json"
        source_manifest.parent.mkdir(parents=True)
        source_manifest.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "items": [
                        {
                            "title": "Test Article",
                            "author": "Test Author",
                            "source_url": "https://example.test/book",
                            "local_path": "source_scans/book.pdf",
                            "sha256": MODULE.sha256(scan),
                            "source_license": "not_stated",
                            "redistribution_approved": "false",
                            "rights_review_status": "unreviewed",
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        (root / "test_corpus/test_md").mkdir(parents=True)
        (root / "metadata/collections.json").write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "generated_at": "2026-07-01",
                    "project": {"gbrain_extra_roots": [], "excluded_directory_names": []},
                    "people": [
                        {
                            "id": "test",
                            "name_zh": "测试",
                            "name_original": "Test",
                            "name_latin": "Test",
                            "relation": "test",
                        }
                    ],
                    "collections": [
                        {
                            "id": "test-source",
                            "person_id": "test",
                            "root": "test_markdown",
                            "layout": "legacy",
                            "stage": "source_scans",
                            "corpus_paths": [],
                            "scan_paths": ["test_markdown/source_scans/"],
                            "scan_manifest": "test_markdown/metadata/source_scans_manifest.json",
                            "bibliography_paths": [],
                            "gbrain_tracked": True,
                        },
                        {
                            "id": "test-research",
                            "person_id": "test",
                            "root": "test_corpus",
                            "layout": "legacy",
                            "stage": "markdown_corpus",
                            "corpus_paths": ["test_corpus/test_md/"],
                            "scan_paths": [],
                            "bibliography_paths": [],
                            "gbrain_tracked": True,
                            "default_text_role": "research",
                            "collection_name": "test-research",
                        },
                    ],
                }
            ),
            encoding="utf-8",
        )
        first = root / "draft-one.md"
        second = root / "draft-two.txt"
        first.write_text("---\ntitle: Old\n---\n# Test Article\n\nBody text.\n", encoding="utf-8")
        second.write_text("# Test Article\n\nBody text alternate.\n", encoding="utf-8")
        return scan, first, second

    def prepare_args(self, first: Path, second: Path) -> SimpleNamespace:
        return SimpleNamespace(
            author_id="test",
            work_id="book",
            source_scan="test_markdown/source_scans/book.pdf",
            ai_draft=[f"first={first}", f"second={second}"],
            title=None,
            author=None,
            language="en",
            source_version=None,
            date="2026-07-01",
            render_pages=False,
        )

    def promote_args(self, *, human_verified: bool = True) -> SimpleNamespace:
        return SimpleNamespace(
            author_id="test",
            work_id="book",
            source_scan="test_markdown/source_scans/book.pdf",
            target_corpus_path="test_corpus/test_md/book.md",
            verified_pages="1-2",
            reviewer="project owner",
            date="2026-07-01",
            human_verified=human_verified,
            title=None,
            author=None,
            language=None,
            published_in=None,
            source_version=None,
            page_basis=None,
            tags=None,
            topics=None,
            places=None,
        )

    def test_prepare_review_from_registered_pdf_and_two_ai_drafts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _scan, first, second = self.fixture(root)
            draft = MODULE.prepare_review(root, self.prepare_args(first, second))

            self.assertTrue(draft.is_file())
            text = draft.read_text(encoding="utf-8")
            self.assertIn('text_status: "human_review_draft"', text)
            self.assertIn('ai_conversion_sources: ["first", "second"]', text)
            self.assertIn(MODULE.sha256(first), text)
            self.assertTrue((root / "test_markdown/digitization/book/raw_ai_conversions/first.md").is_file())
            self.assertTrue((root / "test_markdown/digitization/book/raw_ai_conversions/second.txt").is_file())

    def test_prepare_review_refuses_unregistered_scan(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _scan, first, second = self.fixture(root)
            unregistered = root / "test_markdown/source_scans/unregistered.pdf"
            unregistered.write_bytes(b"unregistered")
            args = self.prepare_args(first, second)
            args.source_scan = "test_markdown/source_scans/unregistered.pdf"

            with self.assertRaises(MODULE.DigitizationError):
                MODULE.prepare_review(root, args)

    def test_promote_verified_refuses_without_human_verified_flag(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _scan, first, second = self.fixture(root)
            MODULE.prepare_review(root, self.prepare_args(first, second))

            with self.assertRaises(MODULE.DigitizationError):
                MODULE.promote_verified(root, self.promote_args(human_verified=False))

    def test_promote_verified_refuses_local_path_leak(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _scan, first, second = self.fixture(root)
            draft = MODULE.prepare_review(root, self.prepare_args(first, second))
            draft.write_text(draft.read_text(encoding="utf-8") + "\n/Users/example/local.md\n", encoding="utf-8")

            with self.assertRaises(MODULE.DigitizationError):
                MODULE.promote_verified(root, self.promote_args())

    def test_promote_verified_creates_research_text_and_matching_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _scan, first, second = self.fixture(root)
            MODULE.prepare_review(root, self.prepare_args(first, second))
            final = MODULE.promote_verified(root, self.promote_args())

            text = final.read_text(encoding="utf-8")
            self.assertIn('text_status: "ocr_human_verified"', text)
            self.assertIn('text_role: "research"', text)
            self.assertIn('core_corpus_eligible: "false"', text)
            self.assertNotIn('core_corpus_eligible: "true"', text)
            manifest_path = root / "test_markdown/digitization/book/human_verification_manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["final_markdown"], "test_corpus/test_md/book.md")
            self.assertEqual(manifest["final_markdown_sha256"], MODULE.sha256(final))
            self.assertEqual(manifest["verified_scan_pages"], ["pdf-page-001", "pdf-page-002"])

            project = json.loads((root / "test_markdown/digitization/book/project.json").read_text())
            self.assertEqual(project["status"], "human_verified")
            self.assertIs(project["ocr_activated"], True)


if __name__ == "__main__":
    unittest.main()
