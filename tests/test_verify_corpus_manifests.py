"""Tests that the corpus survey reports every problem instead of stopping at the first.

The point is not that the survey passes today — it does. The point is what happens when it
fails. Raising on the first bad item makes the output read as "one failure" while everything
after it goes unchecked; split_longform_markdown.py had that shape, and after one work was
deliberately corrected its check aborted at work 6 of 15 and left nine works unverified.

The two gate functions the survey borrows (source_scan_approvals, rights_entries) keep their
fail-fast behaviour on purpose: export_public.py decides what may be published from them, so
there the first problem must stop everything. Only the survey aggregates — and it must not
swallow a raising gate either, which test_all_areas_are_reported_even_when_several_fail pins.
That the gates themselves still raise is covered by tests/test_rights_registry.py
(test_approved_entry_requires_matching_sha256) and tests/test_export_public.py
(test_rights_registry_sha256_mismatch_raises); it is not re-tested here.
"""

import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def load(name: str):
    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


MODULE = load("verify_corpus_manifests")


class HistoricalOcrSurveyTests(unittest.TestCase):
    def item(self, ident: str) -> dict:
        return {
            "id": ident,
            "markdown_path": f"missing/{ident}.md",
            "image_path": f"missing/{ident}.jpg",
            "markdown_sha256": "0" * 64,
            "image_sha256": "0" * 64,
            "verification_status": "human_verified",
            "provenance": "ocr_initial_then_manual_collation_against_source_images",
        }

    def test_every_bad_item_is_reported_not_just_the_first(self):
        errors: list[str] = []
        for ident in ("first", "second", "third"):
            MODULE.check_historical_ocr_item(self.item(ident), errors)
        self.assertEqual(len(errors), 3)
        for ident in ("first", "second", "third"):
            self.assertTrue(any(ident in message for message in errors), ident)

    def test_an_existing_file_with_wrong_hashes_still_reports(self):
        """Not crashing is not passing: a readable file with wrong hashes must be reported."""
        errors: list[str] = []
        MODULE.check_historical_ocr_item(
            {"id": "x", "markdown_path": "AGENTS.md", "image_path": "AGENTS.md",
             "markdown_sha256": "0" * 64, "image_sha256": "0" * 64,
             "verification_status": "human_verified",
             "provenance": "ocr_initial_then_manual_collation_against_source_images"},
            errors,
        )
        self.assertTrue((SCRIPTS.parent / "AGENTS.md").is_file())
        self.assertTrue(any("SHA-256 mismatch" in message for message in errors))


class DigitizationSurveyTests(unittest.TestCase):
    def test_a_broken_project_is_recorded_and_the_survey_continues(self):
        errors: list[str] = []
        count_before = len(errors)
        # A manifest pointing at nothing: the check must record it, not raise.
        manifest = SCRIPTS.parent / "metadata" / "licensing_policy.json"
        MODULE.check_digitization_project(manifest, errors)
        self.assertGreater(len(errors), count_before)


class SurveyAggregationTests(unittest.TestCase):
    """main() must survey every area and report all of them, then fail."""

    def test_all_areas_are_reported_even_when_several_fail(self):
        original = (MODULE.verify_historical_ocr_batch, MODULE.verify_digitization_ocr,
                    MODULE.source_scan_approvals, MODULE.rights_entries)
        printed: list[str] = []
        try:
            MODULE.verify_historical_ocr_batch = lambda errors: (errors.append("ocr broke"), 0)[1]
            MODULE.verify_digitization_ocr = lambda errors: (errors.append("digitization broke"), 0)[1]

            def bad_scans(_root):
                raise ValueError("scan hash mismatch")

            def bad_rights(_root):
                raise ValueError("rights entry missing")

            MODULE.source_scan_approvals = bad_scans
            MODULE.rights_entries = bad_rights
            code = MODULE.main(printer=printed.append)
        finally:
            (MODULE.verify_historical_ocr_batch, MODULE.verify_digitization_ocr,
             MODULE.source_scan_approvals, MODULE.rights_entries) = original

        self.assertEqual(code, 1)
        joined = "\n".join(printed)
        # The first failure must not hide the other three.
        for expected in ("ocr broke", "digitization broke",
                         "scan hash mismatch", "rights entry missing"):
            self.assertIn(expected, joined, expected)
        self.assertIn("errors=4", joined)

    def test_a_clean_survey_returns_zero(self):
        original = (MODULE.verify_historical_ocr_batch, MODULE.verify_digitization_ocr,
                    MODULE.source_scan_approvals, MODULE.rights_entries)
        printed: list[str] = []
        try:
            MODULE.verify_historical_ocr_batch = lambda errors: 13
            MODULE.verify_digitization_ocr = lambda errors: 4
            MODULE.source_scan_approvals = lambda _root: {"a": True}
            MODULE.rights_entries = lambda _root: {"b": {}}
            code = MODULE.main(printer=printed.append)
        finally:
            (MODULE.verify_historical_ocr_batch, MODULE.verify_digitization_ocr,
             MODULE.source_scan_approvals, MODULE.rights_entries) = original
        self.assertEqual(code, 0)
        self.assertIn("human_verified_ocr=17", "\n".join(printed))
        self.assertIn("errors=0", "\n".join(printed))


if __name__ == "__main__":
    unittest.main()
