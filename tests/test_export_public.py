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
            self.assertEqual(MODULE.export_decision(path, root, {}), (False, "redistribution_not_approved"))

    def test_approved_corpus_markdown_is_included(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "kedrov_markdown/kedrov_md/work.md"
            path.parent.mkdir(parents=True)
            path.write_text(
                '---\ncreated: "2026-06-11"\ntext_role: "author_original"\n'
                'redistribution_approved: "true"\n---\n# Work\n',
                encoding="utf-8",
            )
            self.assertEqual(MODULE.export_decision(path, root, {}), (True, "redistribution_approved=true"))

    def test_unlisted_pdf_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "existing_translations/book.pdf"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"%PDF-test")
            self.assertFalse(MODULE.export_decision(path, root, {})[0])

    def test_project_document_is_included(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "README.md"
            path.write_text("---\ncreated: 2026-06-11\n---\n# Readme\n", encoding="utf-8")
            self.assertEqual(MODULE.export_decision(path, root, {}), (True, "project_file"))

    def test_unapproved_image_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "assets/images/portrait.jpg"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"image")
            self.assertEqual(
                MODULE.export_decision(path, root, {}),
                (False, "asset_without_redistribution_approval"),
            )

    def test_unapproved_tex_body_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "translation/book.tex"
            path.parent.mkdir(parents=True)
            path.write_text("\\chapter{Text}\n", encoding="utf-8")
            self.assertEqual(
                MODULE.export_decision(path, root, {}),
                (False, "text_without_redistribution_approval"),
            )

    def test_repository_metadata_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / ".DS_Store"
            path.write_bytes(b"metadata")
            self.assertEqual(
                MODULE.export_decision(path, root, {}),
                (False, "repository_metadata"),
            )

    def test_claude_settings_are_excluded_as_local_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / ".claude/settings.local.json"
            path.parent.mkdir(parents=True)
            path.write_text('{"permissions": {}}\n', encoding="utf-8")
            self.assertEqual(
                MODULE.export_decision(path, root, {}),
                (False, "local_configuration"),
            )

    def test_nested_local_configuration_markdown_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "notes/.claude/commands/translate.md"
            path.parent.mkdir(parents=True)
            path.write_text("# command\n", encoding="utf-8")
            self.assertEqual(
                MODULE.export_decision(path, root, {}),
                (False, "local_configuration"),
            )

    def test_corpus_readme_does_not_bypass_rights_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "kedrov_markdown/kedrov_md/work/README.md"
            path.parent.mkdir(parents=True)
            path.write_text("---\ncreated: 2026-06-11\n---\n# Work\n", encoding="utf-8")
            self.assertEqual(
                MODULE.export_decision(path, root, {}),
                (False, "corpus_markdown_without_redistribution_approval"),
            )

    def test_manifest_approved_asset_is_included(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "assets/images/portrait.jpg"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"image")
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {"assets/images/portrait.jpg": True}),
                (True, "asset_manifest_approved"),
            )

    def test_asset_manifest_sha256_mismatch_raises(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "assets/images/portrait.jpg"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"image")
            manifest = root / "metadata/public_assets_manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({"items": [{
                "local_path": "assets/images/portrait.jpg",
                "bytes": 5,
                "sha256": "0" * 64,
                "source_license": "not_stated",
                "redistribution_approved": "true",
                "rights_review_status": "owner_reviewed",
                "approved_by": "owner",
                "approved_date": "2026-06-12",
            }]}), encoding="utf-8")
            with self.assertRaises(ValueError):
                MODULE.project_asset_approvals(root)

    def test_corpus_asset_cannot_be_approved_via_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "caute_ru_markdown/ilyenkov_md/newspaper/images/scan.jpg"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"image")
            manifest = root / "metadata/public_assets_manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({"items": [{
                "local_path": "caute_ru_markdown/ilyenkov_md/newspaper/images/scan.jpg",
                "bytes": 5,
                "sha256": MODULE.sha256(path),
                "source_license": "not_stated",
                "redistribution_approved": "true",
                "rights_review_status": "owner_reviewed",
                "approved_by": "owner",
                "approved_date": "2026-06-12",
            }]}), encoding="utf-8")
            with self.assertRaises(ValueError):
                MODULE.project_asset_approvals(root)
            self.assertEqual(
                MODULE.export_decision(path, root, {}, {path.relative_to(root).as_posix(): True}),
                (False, "corpus_asset_without_redistribution_approval"),
            )

    def test_build_exports_manifest_approved_asset(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            approved = root / "assets/images/portrait.jpg"
            approved.parent.mkdir(parents=True)
            approved.write_bytes(b"approved-image")
            unlisted = root / "assets/images/other.jpg"
            unlisted.write_bytes(b"unlisted-image")
            manifest = root / "metadata/public_assets_manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({"items": [{
                "local_path": "assets/images/portrait.jpg",
                "bytes": approved.stat().st_size,
                "sha256": MODULE.sha256(approved),
                "source_license": "not_stated",
                "redistribution_approved": "true",
                "rights_review_status": "owner_reviewed",
                "approved_by": "owner",
                "approved_date": "2026-06-12",
            }]}), encoding="utf-8")
            output = root / "dist/public"
            output.mkdir(parents=True)

            audit = MODULE.build_export(root, output)

            self.assertTrue((output / "assets/images/portrait.jpg").is_file())
            self.assertFalse((output / "assets/images/other.jpg").exists())
            reasons = {item["path"]: item["reason"] for item in audit["files"]}
            self.assertEqual(reasons["assets/images/portrait.jpg"], "asset_manifest_approved")
            self.assertEqual(reasons["assets/images/other.jpg"], "asset_without_redistribution_approval")
            MODULE.verify_export_tree(audit, root, output)

    def test_build_preserves_git_pointer_and_exports_all_approved_markdown(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            approved = root / "kedrov_markdown/kedrov_md/work.md"
            approved.parent.mkdir(parents=True)
            approved.write_text(
                '---\ncreated: "2026-06-11"\ntext_role: "author_original"\n'
                'core_corpus_eligible: "false"\nredistribution_approved: "true"\n---\n# Work\n',
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
