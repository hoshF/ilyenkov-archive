import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import check_terminology_reviews as CHECK
import render_terminology_reviews as RENDER
import terminology_review_lib as LIB


class TerminologyReviewTests(unittest.TestCase):
    def setUp(self):
        self.original_root = LIB.ROOT
        self.original_cache = LIB.CACHE_DIR
        self.original_corpus_paths = LIB.corpus_paths_for_author
        self.original_fingerprint = LIB.git_corpus_fingerprint
        self.original_check_root = CHECK.ROOT

    def tearDown(self):
        LIB.ROOT = self.original_root
        LIB.CACHE_DIR = self.original_cache
        LIB.corpus_paths_for_author = self.original_corpus_paths
        LIB.git_corpus_fingerprint = self.original_fingerprint
        CHECK.ROOT = self.original_check_root

    def test_parse_suggestion_table(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "suggestions.md"
            path.write_text(
                "| 原文术语 | 建议统一译法 | 出现次数 |\n"
                "|---|---|---:|\n"
                "| `психика` | 心理 | 3 |\n",
                encoding="utf-8",
            )
            rows = LIB.parse_suggestions(path)
            self.assertEqual(rows[0]["canonical"], "психика")
            self.assertEqual(rows[0]["reported_count"], 3)

    def test_missing_suggestion_columns_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "suggestions.md"
            path.write_text("| 名称 | 次数 |\n|---|---:|\n| x | 1 |\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "no suggestion table"):
                LIB.parse_suggestions(path)

    def test_structural_alignment_warns_without_claiming_semantic_match(self):
        source = [
            {"id": "b0001", "kind": "heading", "section": "A"},
            {"id": "b0002", "kind": "content", "section": "A"},
        ]
        translation = [{"id": "b0001", "kind": "heading", "section": "甲"}]
        alignment, warnings = LIB.structural_alignment(source, translation)
        self.assertEqual(alignment[0]["pairs"][1]["translation_block"], None)
        self.assertTrue(any("block count differs" in warning for warning in warnings))

    def test_corpus_cache_hits_and_invalidates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            corpus = root / "test_markdown/test_md"
            corpus.mkdir(parents=True)
            (corpus / "one.md").write_text("психика психики\n", encoding="utf-8")
            LIB.ROOT = root
            LIB.CACHE_DIR = root / "tmp/cache"
            LIB.corpus_paths_for_author = lambda author_id: [corpus]
            state = {"value": "state-1"}
            LIB.git_corpus_fingerprint = lambda paths: state["value"]

            first, first_hit = LIB.corpus_evidence("test", ["психика"])
            second, second_hit = LIB.corpus_evidence("test", ["психика"])
            state["value"] = "state-2"
            third, third_hit = LIB.corpus_evidence("test", ["психика"])

            self.assertFalse(first_hit)
            self.assertTrue(second_hit)
            self.assertFalse(third_hit)
            self.assertEqual(first["total"], second["total"])

    def native_batch(self) -> dict:
        operations = ["add", "modify", "delete", "status", "reject", "no_formal_glossary"]
        decisions = []
        for index, operation in enumerate(operations, start=1):
            decisions.append(
                {
                    "proposal_id": f"p{index:03d}",
                    "term_ids": [f"term-{index}"],
                    "target_author_ids": ["test"],
                    "canonical": f"term {index}",
                    "forms": [],
                    "suggested_zh": f"术语{index}",
                    "operations": [operation],
                    "before": "",
                    "after": "",
                    "article_evidence": {"summary": "1；b0001"},
                    "corpus_evidence": {"summary": "2 / 1 篇"},
                    "rationale": "测试决定",
                    "final_status_by_author": (
                        {"test": "approved"} if operation not in {"reject", "delete", "no_formal_glossary"} else {}
                    ),
                    "affected_translation_locations": [],
                    "affected_translation_summary": "无",
                    "heuristic_forms_pending": [],
                }
            )
        return {
            "schema_version": 1,
            "audit_only": True,
            "record_format": "native",
            "batch_id": "2026-07-27-test-batch",
            "batch_kind": "article_review",
            "date": "2026-07-27",
            "primary_author_id": "test",
            "related_author_ids": [],
            "work_id": "test-work",
            "article_slug": "test-batch",
            "inputs": [
                {"role": "source", "path": "test/source.md", "sha256": "a" * 64},
                {"role": "translation", "path": "blog:test.md", "sha256": "b" * 64},
                {"role": "suggestions", "path": "upload:test.md", "sha256": "c" * 64},
            ],
            "source_candidate_count": len(decisions),
            "review": {
                "accuracy": {"full_pass": True},
                "language": {"full_pass": True},
                "final_translation_sha256": "b" * 64,
                "blockers": [],
            },
            "operation_counts": {operation: 1 for operation in operations},
            "decisions": decisions,
            "owner_review": {"status": "pending"},
        }

    def test_native_batch_supports_every_operation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            CHECK.ROOT = root
            path = root / "2026-07-27-test-batch.json"
            errors = CHECK.validate_batch(path, self.native_batch())
            self.assertEqual(errors, [])

    def test_pending_heuristic_forms_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            CHECK.ROOT = root
            path = root / "2026-07-27-test-batch.json"
            batch = self.native_batch()
            batch["decisions"][0]["heuristic_forms_pending"] = ["психики"]
            errors = CHECK.validate_batch(path, batch)
            self.assertTrue(any("unconfirmed heuristic forms" in error for error in errors))

    def test_incomplete_review_and_candidate_coverage_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            CHECK.ROOT = root
            path = root / "2026-07-27-test-batch.json"
            batch = self.native_batch()
            batch["review"]["accuracy"]["full_pass"] = False
            batch["source_candidate_count"] -= 1
            errors = CHECK.validate_batch(path, batch)
            self.assertTrue(any("full accuracy pass" in error for error in errors))
            self.assertTrue(any("source_candidate_count" in error for error in errors))

    def test_work_package_hash_change_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            work_dir = Path(directory)
            batch = self.native_batch()
            (work_dir / "manifest.json").write_text(
                json.dumps(
                    {
                        "inputs": [
                            {"role": "source", "sha256": "d" * 64},
                            {"role": "translation", "sha256": "b" * 64},
                            {"role": "suggestions", "sha256": "c" * 64},
                        ],
                        "suggestion_count": len(batch["decisions"]),
                    }
                ),
                encoding="utf-8",
            )
            errors = CHECK.work_package_errors(batch, work_dir)
            self.assertTrue(any("input hashes" in error for error in errors))

    def test_compact_index_contains_all_operation_counts(self):
        batch = self.native_batch()
        rendered = RENDER.render_index([(Path("batch.json"), batch)])
        self.assertIn("| 1 | 1 | 1 | 1 | 1 | 1 |", rendered)
        self.assertIn("不是第二份术语表", rendered)

    def test_four_legacy_batches_keep_claimed_counts(self):
        review_dir = Path(__file__).resolve().parents[1] / "translation_workspace/terminology_reviews"
        batches = [json.loads(path.read_text(encoding="utf-8")) for path in review_dir.glob("*.json")]
        self.assertEqual(len(batches), 4)
        by_slug = {batch["article_slug"]: batch for batch in batches}
        self.assertEqual(by_slug["vygotsky-glossary"]["operation_counts"]["add"], 34)
        self.assertEqual(
            by_slug["ontogenesis-human-psyche-language-in-ilyenkov"]["legacy_migration"]["decision_rows"],
            49,
        )
        self.assertEqual(
            by_slug["thought-and-language-in-ilyenkov-logic"]["operation_counts"]["reject"],
            47,
        )


if __name__ == "__main__":
    unittest.main()
