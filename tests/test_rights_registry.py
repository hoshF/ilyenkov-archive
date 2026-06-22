import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "rights_registry.py"
SPEC = importlib.util.spec_from_file_location("rights_registry", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


def write_policy(root: Path, content_paths: list[str] | None = None) -> None:
    metadata = root / "metadata"
    metadata.mkdir(parents=True, exist_ok=True)
    (metadata / "licensing_policy.json").write_text(json.dumps({
        "schema_version": 1,
        "controlled_categories": sorted(MODULE.CONTENT_CATEGORIES),
        "content_bearing_metadata_paths": content_paths or [],
    }), encoding="utf-8")


def entry(path: Path, root: Path, **overrides) -> dict:
    item = {
        "id": "reviewed-file",
        "path": path.relative_to(root).as_posix(),
        "sha256": MODULE.sha256(path),
        "content_category": "source_text",
        "rights_basis": "public_domain",
        "license_expression": "Public-Domain",
        "source_rights_statement": "Public-domain test text",
        "evidence_urls": ["https://example.test/rights"],
        "attribution": "Test source",
        "reviewed_by": "tester",
        "reviewed_date": "2026-06-22",
        "redistribution_approved": True,
    }
    item.update(overrides)
    return item


def write_registry(root: Path, items: list[dict]) -> None:
    metadata = root / "metadata"
    metadata.mkdir(parents=True, exist_ok=True)
    (metadata / "rights_registry.json").write_text(json.dumps({
        "schema_version": 1,
        "generated_at": "2026-06-22",
        "items": items,
    }), encoding="utf-8")


class RightsRegistryTests(unittest.TestCase):
    def test_approved_entry_requires_matching_sha256(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "text.md"
            path.write_text("text\n", encoding="utf-8")
            write_registry(root, [entry(path, root, sha256="0" * 64)])
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                MODULE.approved_rights_entries(root)

    def test_restricted_entry_cannot_be_approved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "text.md"
            path.write_text("text\n", encoding="utf-8")
            write_registry(root, [entry(path, root, rights_basis="restricted")])
            with self.assertRaisesRegex(ValueError, "non-approvable rights basis"):
                MODULE.rights_entries(root)

    def test_duplicate_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "text.md"
            path.write_text("text\n", encoding="utf-8")
            first = entry(path, root)
            second = entry(path, root, id="second-review")
            write_registry(root, [first, second])
            with self.assertRaisesRegex(ValueError, "duplicate path"):
                MODULE.rights_entries(root)

    def test_content_bearing_metadata_comes_from_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_policy(root, ["metadata/content.json"])
            self.assertEqual(
                MODULE.content_bearing_metadata_paths(root),
                {"metadata/content.json"},
            )

    def test_repository_initial_release_has_expected_scope(self):
        root = Path(__file__).resolve().parents[1]
        approved = MODULE.approved_rights_entries(root)
        spinoza = {
            path: item
            for path, item in approved.items()
            if path.startswith("spinoza_markdown/")
        }
        dbnl = [
            path for path in spinoza
            if "/dutch/nagelate-schriften/nagelate-schriften-ch" in path
        ]
        wiksource_markdown = [
            path for path in spinoza
            if path.endswith(".md") and path not in dbnl
        ]
        content_metadata = [
            path for path, item in spinoza.items()
            if item["content_category"] == "content_bearing_metadata"
        ]
        self.assertEqual(len(dbnl), 97)
        self.assertEqual(len(wiksource_markdown), 6)
        self.assertEqual(content_metadata, ["spinoza_markdown/metadata/ethica_elements.json"])
        self.assertFalse(any("/latin_web/spinozaetnous/" in path for path in approved))


if __name__ == "__main__":
    unittest.main()
