import importlib.util
import hashlib
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "prepare_gbrain_markdown.py"
SPEC = importlib.util.spec_from_file_location("prepare_gbrain_markdown", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class PrepareGbrainMarkdownTests(unittest.TestCase):
    def write_corpus(self, root: Path, front_matter: str) -> Path:
        path = root / "kedrov_markdown" / "kedrov_md" / "work.md"
        path.parent.mkdir(parents=True)
        path.write_text(f"---\n{front_matter}\n---\n# Work\n", encoding="utf-8")
        return path

    def test_missing_required_field_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = self.write_corpus(root, 'created: "2026-06-11"')
            errors = MODULE.validate_file(path, path.read_text(), root)
            self.assertTrue(any("missing text_role" in error for error in errors))

    def test_root_readme_does_not_require_front_matter(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "README.md"
            text = "# Project\n"
            path.write_text(text, encoding="utf-8")

            self.assertEqual(MODULE.validate_file(path, text, root), [])
            self.assertEqual(MODULE.prepare_file(path, text, root), text)

    def test_invalid_role_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fields = "\n".join(
                [
                    'created: "2026-06-11"',
                    'text_role: "source"',
                    'core_corpus_eligible: "false"',
                    'llm_wiki_eligible: "true"',
                    'source_format: "html"',
                    'source_license: "not_stated"',
                    'redistribution_approved: "false"',
                    'rights_review_status: "unreviewed"',
                    'text_status: "html_conversion_unverified"',
                    'source_url: "not_stated"',
                ]
            )
            path = self.write_corpus(root, fields)
            errors = MODULE.validate_file(path, path.read_text(), root)
            self.assertTrue(any("invalid text_role" in error for error in errors))

    def test_non_author_text_cannot_enter_core(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fields = "\n".join(
                [
                    'created: "2026-06-11"',
                    'text_role: "research"',
                    'core_corpus_eligible: "true"',
                    'llm_wiki_eligible: "true"',
                    'source_format: "html"',
                    'source_license: "not_stated"',
                    'redistribution_approved: "false"',
                    'rights_review_status: "unreviewed"',
                    'text_status: "html_conversion_unverified"',
                    'source_url: "not_stated"',
                ]
            )
            path = self.write_corpus(root, fields)
            errors = MODULE.validate_file(path, path.read_text(), root)
            self.assertTrue(any("core corpus requires" in error for error in errors))

    def test_human_collated_ocr_can_enter_core_with_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "caute_ru_markdown/ilyenkov_md/newspaper/article.md"
            path.parent.mkdir(parents=True)
            path.write_text(
                '---\ncreated: "2026-06-11"\ntext_role: "author_original"\n'
                'core_corpus_eligible: "true"\nllm_wiki_eligible: "true"\n'
                'source_format: "image_scan"\nsource_license: "not_stated"\n'
                'redistribution_approved: "false"\nrights_review_status: "unreviewed"\n'
                'text_status: "ocr_draft_human_collated"\nsource_url: "not_stated"\n'
                'provenance: "ocr_initial_then_manual_collation_against_source_images"\n'
                '---\n# Article\n',
                encoding="utf-8",
            )
            manifest = root / "caute_ru_markdown/metadata/ilyenkov_newspaper_human_verification_manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({"items": [{
                "markdown_path": path.relative_to(root).as_posix(),
                "markdown_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }]}), encoding="utf-8")
            self.assertEqual(MODULE.validate_file(path, path.read_text(), root), [])

    def test_core_image_scan_without_manifest_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "caute_ru_markdown/ilyenkov_md/newspaper/article.md"
            path.parent.mkdir(parents=True)
            path.write_text(
                '---\ncreated: "2026-06-11"\ntext_role: "author_original"\n'
                'core_corpus_eligible: "true"\nllm_wiki_eligible: "true"\n'
                'source_format: "image_scan"\nsource_license: "not_stated"\n'
                'redistribution_approved: "false"\nrights_review_status: "unreviewed"\n'
                'text_status: "ocr_draft_human_collated"\nsource_url: "not_stated"\n'
                'provenance: "ocr_initial_then_manual_collation_against_source_images"\n'
                '---\n# Article\n',
                encoding="utf-8",
            )
            errors = MODULE.validate_file(path, path.read_text(), root)
            self.assertTrue(any("missing from the human verification manifest" in error for error in errors))

    def test_partial_chapter_metadata_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fields = "\n".join(
                [
                    'created: "2026-06-11"',
                    'text_role: "author_original"',
                    'core_corpus_eligible: "true"',
                    'llm_wiki_eligible: "true"',
                    'source_format: "html"',
                    'source_license: "not_stated"',
                    'redistribution_approved: "false"',
                    'rights_review_status: "unreviewed"',
                    'text_status: "html_conversion_unverified"',
                    'source_url: "not_stated"',
                    'work_id: "work"',
                    'chapter_index: "1"',
                ]
            )
            path = self.write_corpus(root, fields)
            errors = MODULE.validate_file(path, path.read_text(), root)
            self.assertTrue(any("chapter file missing chapter_title" in error for error in errors))
            self.assertTrue(any("chapter_index must be three digits" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
