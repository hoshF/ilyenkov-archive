import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "export_public.py"
SPEC = importlib.util.spec_from_file_location("export_public", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


def write_rights_files(root: Path, items: list[dict] | None = None) -> None:
    metadata = root / "metadata"
    metadata.mkdir(parents=True, exist_ok=True)
    (metadata / "licensing_policy.json").write_text(json.dumps({
        "schema_version": 1,
        "controlled_categories": [
            "source_text",
            "translation",
            "scan",
            "media",
            "content_bearing_metadata",
        ],
        "content_bearing_metadata_paths": [],
    }), encoding="utf-8")
    (metadata / "rights_registry.json").write_text(json.dumps({
        "schema_version": 1,
        "generated_at": "2026-06-22",
        "items": items or [],
    }), encoding="utf-8")


def rights_item(path: Path, root: Path, review_id: str, category: str = "media") -> dict:
    return {
        "id": review_id,
        "path": path.relative_to(root).as_posix(),
        "sha256": MODULE.sha256(path),
        "content_category": category,
        "rights_basis": "open_license",
        "license_expression": "CC-BY-SA-4.0",
        "source_rights_statement": "Test approval",
        "evidence_urls": ["https://example.test/license"],
        "attribution": "Test source",
        "reviewed_by": "tester",
        "reviewed_date": "2026-06-22",
        "redistribution_approved": True,
    }


class ExportPublicTests(unittest.TestCase):
    def test_unapproved_corpus_markdown_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "kedrov_markdown/kedrov_md/work.md"
            path.parent.mkdir(parents=True)
            path.write_text(
                '---\ncreated: "2026-06-11"\ntext_role: "author_original"\n'
                'redistribution_approved: "false"\n---\n# Work\n',
                encoding="utf-8",
            )
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, set()),
                (False, "rights_review_not_approved"),
            )

    def test_approved_corpus_markdown_is_included(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "kedrov_markdown/kedrov_md/work.md"
            path.parent.mkdir(parents=True)
            path.write_text(
                '---\ncreated: "2026-06-11"\ntext_role: "author_original"\n'
                'redistribution_approved: "true"\nrights_review_status: "reviewed"\n'
                'rights_review_id: "work-review"\n---\n# Work\n',
                encoding="utf-8",
            )
            rights = {
                path.relative_to(root).as_posix(): {
                    "id": "work-review",
                    "content_category": "source_text",
                }
            }
            self.assertEqual(
                MODULE.export_decision(path, root, {}, rights, set()),
                (True, "rights_registry_approved"),
            )

    def test_unlisted_pdf_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "existing_translations/book.pdf"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"%PDF-test")
            self.assertFalse(MODULE.export_decision(path, root, {}, {}, set())[0])

    def test_project_document_is_included(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "README.md"
            path.write_text("---\ncreated: 2026-06-11\n---\n# Readme\n", encoding="utf-8")
            self.assertEqual(MODULE.export_decision(path, root, {}, {}, set()), (True, "project_file"))

    def test_unapproved_image_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "assets/images/portrait.jpg"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"image")
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, set()),
                (False, "asset_without_rights_review"),
            )

    def test_source_scan_requires_manifest_and_rights_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "oizerman_markdown/source_scans/klex/scan.djvu"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"x")
            rel = path.relative_to(root).as_posix()
            self.assertEqual(
                MODULE.export_decision(path, root, {rel: True}, {}, set()),
                (False, "source_scan_not_approved"),
            )
            self.assertEqual(
                MODULE.export_decision(
                    path,
                    root,
                    {rel: True},
                    {rel: {"id": "scan", "content_category": "scan"}},
                    set(),
                ),
                (True, "scan_rights_approved"),
            )

    def test_large_scan_requires_explicit_storage_review(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            author = root / "author_markdown"
            scan = author / "source_scans/book.pdf"
            scan.parent.mkdir(parents=True)
            scan.write_bytes(b"x" * 101)
            metadata = author / "metadata"
            metadata.mkdir()
            registry = root / "metadata"
            registry.mkdir()
            (registry / "collections.json").write_text(json.dumps({
                "schema_version": 1,
                "project": {"large_binary_threshold_bytes": 100},
                "people": [{"id": "author"}],
                "collections": [{
                    "id": "author-texts",
                    "person_id": "author",
                    "root": "author_markdown",
                    "layout": "legacy",
                    "scan_manifest": "author_markdown/metadata/source_scans_manifest.json",
                    "corpus_paths": [],
                    "scan_paths": ["author_markdown/source_scans/"],
                    "bibliography_paths": [],
                }],
            }), encoding="utf-8")
            item = {
                "title": "Book",
                "author": "Author",
                "publication_year": "2000",
                "source_url": "https://example.test",
                "download_date": "2026-06-21",
                "pages": 1,
                "bytes": 101,
                "sha256": MODULE.sha256(scan),
                "source_format": "pdf",
                "source_license": "not_stated",
                "redistribution_approved": "false",
                "rights_review_status": "unreviewed",
                "text_status": "source_scan_unprocessed",
                "local_path": "source_scans/book.pdf",
            }
            manifest = metadata / "source_scans_manifest.json"
            manifest.write_text(json.dumps({"items": [item]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "large file requires explicit review"):
                MODULE.source_scan_approvals(root)
            item["large_file_review"] = {
                "reviewed": True,
                "reason": "重要版本",
                "storage_decision": "git",
            }
            manifest.write_text(json.dumps({"items": [item]}), encoding="utf-8")
            self.assertEqual(MODULE.source_scan_approvals(root), {
                "author_markdown/source_scans/book.pdf": False
            })

    def test_unapproved_tex_body_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "translation/book.tex"
            path.parent.mkdir(parents=True)
            path.write_text("\\chapter{Text}\n", encoding="utf-8")
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, set()),
                (False, "text_without_rights_review"),
            )

    def test_repository_metadata_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / ".DS_Store"
            path.write_bytes(b"metadata")
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, set()),
                (False, "repository_metadata"),
            )

    def test_claude_settings_are_excluded_as_local_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / ".claude/settings.local.json"
            path.parent.mkdir(parents=True)
            path.write_text('{"permissions": {}}\n', encoding="utf-8")
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, set()),
                (False, "local_configuration"),
            )

    def test_nested_local_configuration_markdown_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "notes/.claude/commands/translate.md"
            path.parent.mkdir(parents=True)
            path.write_text("# command\n", encoding="utf-8")
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, set()),
                (False, "local_configuration"),
            )

    def test_corpus_readme_does_not_bypass_rights_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "kedrov_markdown/kedrov_md/work/README.md"
            path.parent.mkdir(parents=True)
            path.write_text("---\ncreated: 2026-06-11\n---\n# Work\n", encoding="utf-8")
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, set()),
                (False, "corpus_markdown_without_redistribution_approval"),
            )

    def test_rights_approved_asset_is_included(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "assets/images/portrait.jpg"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"image")
            self.assertEqual(
                MODULE.export_decision(
                    path,
                    root,
                    {},
                    {
                        "assets/images/portrait.jpg": {
                            "id": "portrait",
                            "content_category": "media",
                        }
                    },
                    set(),
                ),
                (True, "rights_registry_approved"),
            )

    def test_rights_registry_sha256_mismatch_raises(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "assets/images/portrait.jpg"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"image")
            item = rights_item(path, root, "portrait")
            item["sha256"] = "0" * 64
            write_rights_files(root, [item])
            with self.assertRaises(ValueError):
                MODULE.approved_rights_entries(root)

    def test_corpus_asset_requires_rights_registry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "caute_ru_markdown/ilyenkov_md/newspaper/images/scan.jpg"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"image")
            rel = path.relative_to(root).as_posix()
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, set()),
                (False, "corpus_asset_without_rights_review"),
            )
            self.assertEqual(
                MODULE.export_decision(
                    path,
                    root,
                    {},
                    {rel: {"id": "scan", "content_category": "scan"}},
                    set(),
                ),
                (True, "rights_registry_approved"),
            )

    def test_content_bearing_metadata_requires_explicit_review(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "metadata/content.json"
            path.parent.mkdir()
            path.write_text('{"text": "third-party passage"}\n', encoding="utf-8")
            rel = path.relative_to(root).as_posix()
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {}, {rel}),
                (False, "content_metadata_not_approved"),
            )
            rights = {
                rel: {
                    "id": "content-review",
                    "content_category": "content_bearing_metadata",
                }
            }
            self.assertEqual(
                MODULE.export_decision(path, root, {}, rights, {rel}),
                (True, "rights_registry_approved"),
            )

    def test_fulltext_dir_is_never_in_export_universe(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "README.md").write_text("---\ncreated: 2026-06-11\n---\n# Readme\n", encoding="utf-8")
            full = root / ".fulltext/caute_ru_markdown/ilyenkov_md/work.md"
            full.parent.mkdir(parents=True)
            full.write_text(
                '---\ntext_role: "author_original"\nredistribution_approved: "false"\n---\n# Full corpus text\n',
                encoding="utf-8",
            )
            listed = {path.relative_to(root).as_posix() for path in MODULE.source_files(root)}
            self.assertNotIn(".fulltext/caute_ru_markdown/ilyenkov_md/work.md", listed)
            self.assertNotIn(".fulltext", {Path(p).parts[0] for p in listed})

    def test_build_exports_manifest_approved_asset(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            approved = root / "assets/images/portrait.jpg"
            approved.parent.mkdir(parents=True)
            approved.write_bytes(b"approved-image")
            unlisted = root / "assets/images/other.jpg"
            unlisted.write_bytes(b"unlisted-image")
            item = rights_item(approved, root, "portrait")
            write_rights_files(root, [item])
            output = root / "dist/public"
            output.mkdir(parents=True)

            audit = MODULE.build_export(root, output)

            self.assertTrue((output / "assets/images/portrait.jpg").is_file())
            self.assertFalse((output / "assets/images/other.jpg").exists())
            reasons = {item["path"]: item["reason"] for item in audit["files"]}
            self.assertEqual(reasons["assets/images/portrait.jpg"], "rights_registry_approved")
            self.assertEqual(reasons["assets/images/other.jpg"], "asset_without_rights_review")
            MODULE.verify_export_tree(audit, root, output)

    def test_build_preserves_git_pointer_and_exports_all_approved_markdown(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            approved = root / "kedrov_markdown/kedrov_md/work.md"
            approved.parent.mkdir(parents=True)
            approved.write_text(
                '---\ncreated: "2026-06-11"\ntext_role: "author_original"\n'
                'core_corpus_eligible: "false"\nredistribution_approved: "true"\n'
                'rights_review_status: "reviewed"\nrights_review_id: "work-review"\n'
                '---\n# Work\n',
                encoding="utf-8",
            )
            rejected = root / "kedrov_markdown/kedrov_md/rejected.md"
            rejected.write_text(
                '---\ncreated: "2026-06-11"\ntext_role: "author_original"\n'
                'core_corpus_eligible: "true"\nredistribution_approved: "false"\n---\n# Rejected\n',
                encoding="utf-8",
            )
            output = root / "dist/public"
            output.mkdir(parents=True)
            (output / ".git").write_text("gitdir: ../.public.git\n", encoding="utf-8")
            (output / "stale.txt").write_text("stale", encoding="utf-8")
            write_rights_files(root, [
                rights_item(approved, root, "work-review", "source_text")
            ])

            audit = MODULE.build_export(root, output)

            self.assertEqual((output / ".git").read_text(), "gitdir: ../.public.git\n")
            self.assertTrue((output / approved.relative_to(root)).is_file())
            self.assertFalse((output / rejected.relative_to(root)).exists())
            self.assertFalse((output / "stale.txt").exists())
            MODULE.verify_export_tree(audit, root, output)

    def test_build_never_exports_claude_paths_and_audit_matches_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            settings = root / ".claude/settings.local.json"
            settings.parent.mkdir(parents=True)
            settings.write_text('{"permissions": {}}\n', encoding="utf-8")
            nested = root / "notes/.claude/commands/translate.md"
            nested.parent.mkdir(parents=True)
            nested.write_text("# command\n", encoding="utf-8")
            (root / "README.md").write_text("---\ncreated: 2026-06-11\n---\n# Readme\n", encoding="utf-8")
            write_rights_files(root)
            output = root / "dist/public"
            output.mkdir(parents=True)

            audit = MODULE.build_export(root, output)

            included = {item["path"] for item in audit["files"] if item["included"]}
            for path in included:
                self.assertNotIn(".claude", Path(path).parts)
            claude_records = [
                item for item in audit["files"] if ".claude" in Path(item["path"]).parts
            ]
            self.assertEqual(len(claude_records), 2)
            for item in claude_records:
                self.assertFalse(item["included"])
                self.assertEqual(item["reason"], "local_configuration")

            actual = {
                path.relative_to(output).as_posix()
                for path in output.rglob("*")
                if path.is_file() and path.name != ".git"
            }
            for path in actual:
                self.assertNotIn(".claude", Path(path).parts)
            self.assertIn("PUBLIC_EXPORT_AUDIT.json", actual)
            actual.remove("PUBLIC_EXPORT_AUDIT.json")
            self.assertEqual(actual, included)


if __name__ == "__main__":
    unittest.main()
