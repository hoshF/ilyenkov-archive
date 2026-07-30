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
            "review_mode": "initial",
            "work_identity": {
                "primary_author_id": "test",
                "work_id": "test-work",
                "article_slug": "test-batch",
                "source_path": "test/source.md",
                "source_sha256": "a" * 64,
                "doi": "10.1000/test",
                "source_url": "https://example.com/test",
                "source_title": "Test",
            },
            "supersedes_batch_id": None,
            "supersedes_blog_slug": None,
            "previous_translation_sha256": None,
            "changed_input_roles": [],
            "unknown_previous_input_roles": [],
            "identity_match_reasons": [],
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

    def test_duplicate_preflight_reuses_exact_batch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            review_dir = root / "reviews"
            review_dir.mkdir()
            batch = self.native_batch()
            (review_dir / f"{batch['batch_id']}.json").write_text(
                json.dumps(batch),
                encoding="utf-8",
            )
            result = LIB.duplicate_preflight(
                identity=batch["work_identity"],
                inputs=batch["inputs"],
                revision_of=None,
                review_dir=review_dir,
                blog_root=root / "missing-blog",
            )
            self.assertEqual(result["status"], "already_reviewed")
            self.assertEqual(result["reuse_target"], batch["batch_id"])

    def test_changed_translation_requires_explicit_matching_revision_target(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            review_dir = root / "reviews"
            review_dir.mkdir()
            batch = self.native_batch()
            (review_dir / f"{batch['batch_id']}.json").write_text(
                json.dumps(batch),
                encoding="utf-8",
            )
            inputs = [dict(item) for item in batch["inputs"]]
            inputs[1]["sha256"] = "d" * 64
            blocked = LIB.duplicate_preflight(
                identity=batch["work_identity"],
                inputs=inputs,
                revision_of=None,
                review_dir=review_dir,
                blog_root=root / "missing-blog",
            )
            self.assertEqual(blocked["status"], "revision_required")
            wrong = LIB.duplicate_preflight(
                identity=batch["work_identity"],
                inputs=inputs,
                revision_of="unrelated-batch",
                review_dir=review_dir,
                blog_root=root / "missing-blog",
            )
            self.assertEqual(wrong["status"], "identity_conflict")
            allowed = LIB.duplicate_preflight(
                identity=batch["work_identity"],
                inputs=inputs,
                revision_of=batch["batch_id"],
                review_dir=review_dir,
                blog_root=root / "missing-blog",
            )
            self.assertEqual(allowed["status"], "revision_confirmed")
            self.assertEqual(allowed["selected"]["changed_input_roles"], ["translation"])

    def test_doi_finds_moved_source_and_blog_without_batch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            posts = root / "blog/content/posts"
            posts.mkdir(parents=True)
            (posts / "existing-post.md").write_text(
                "---\ntitle: 既有文章\ndate: 2026-07-01\ntype: translation\n---\n\n"
                "DOI：[https://doi.org/10.1000/MOVED](https://doi.org/10.1000/MOVED)\n",
                encoding="utf-8",
            )
            identity = {
                "primary_author_id": "test",
                "work_id": "moved-work",
                "article_slug": "new-slug",
                "source_path": "new/location.md",
                "source_sha256": "a" * 64,
                "doi": "10.1000/moved",
                "source_url": None,
                "source_title": "Moved",
            }
            inputs = [
                {"role": "source", "path": "new/location.md", "sha256": "a" * 64},
                {"role": "translation", "path": "upload:new.md", "sha256": "b" * 64},
                {"role": "suggestions", "path": "upload:terms.md", "sha256": "c" * 64},
            ]
            blocked = LIB.duplicate_preflight(
                identity=identity,
                inputs=inputs,
                revision_of=None,
                review_dir=root / "reviews",
                blog_root=root / "blog",
            )
            self.assertEqual(blocked["status"], "revision_required")
            self.assertEqual(blocked["allowed_revision_targets"], ["blog:existing-post"])

    def test_slug_and_doi_pointing_to_different_posts_is_a_conflict(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            posts = root / "blog/content/posts"
            posts.mkdir(parents=True)
            (posts / "requested.md").write_text(
                "---\ntitle: A\ndate: 2026-07-01\n---\n\n正文。\n",
                encoding="utf-8",
            )
            (posts / "other.md").write_text(
                "---\ntitle: B\ndate: 2026-07-01\n---\n\n"
                "DOI: https://doi.org/10.1000/conflict\n",
                encoding="utf-8",
            )
            identity = {
                "primary_author_id": "test",
                "work_id": "work",
                "article_slug": "requested",
                "source_path": "source.md",
                "source_sha256": "a" * 64,
                "doi": "10.1000/conflict",
                "source_url": None,
                "source_title": "Conflict",
            }
            inputs = [
                {"role": "source", "path": "source.md", "sha256": "a" * 64},
                {"role": "translation", "path": "upload:t.md", "sha256": "b" * 64},
                {"role": "suggestions", "path": "upload:s.md", "sha256": "c" * 64},
            ]
            result = LIB.duplicate_preflight(
                identity=identity,
                inputs=inputs,
                revision_of=None,
                review_dir=root / "reviews",
                blog_root=root / "blog",
            )
            self.assertEqual(result["status"], "identity_conflict")

    def test_title_match_is_only_a_nonblocking_hint(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            review_dir = root / "reviews"
            review_dir.mkdir()
            batch = self.native_batch()
            batch["primary_author_id"] = "other-author"
            batch["work_id"] = "other-work"
            batch["article_slug"] = "other-slug"
            batch["work_identity"].update(
                {
                    "primary_author_id": "other-author",
                    "work_id": "other-work",
                    "article_slug": "other-slug",
                    "source_path": "other/source.md",
                    "source_sha256": "e" * 64,
                    "doi": None,
                    "source_url": None,
                    "source_title": "Same Title",
                }
            )
            batch["inputs"][0].update(
                {"path": "other/source.md", "sha256": "e" * 64}
            )
            (review_dir / f"{batch['batch_id']}.json").write_text(
                json.dumps(batch),
                encoding="utf-8",
            )
            identity = {
                "primary_author_id": "test",
                "work_id": "new-work",
                "article_slug": "new-slug",
                "source_path": "new/source.md",
                "source_sha256": "a" * 64,
                "doi": None,
                "source_url": None,
                "source_title": "Same Title",
            }
            result = LIB.duplicate_preflight(
                identity=identity,
                inputs=[
                    {"role": "source", "path": "new/source.md", "sha256": "a" * 64},
                    {"role": "translation", "path": "upload:t.md", "sha256": "b" * 64},
                    {"role": "suggestions", "path": "upload:s.md", "sha256": "c" * 64},
                ],
                revision_of=None,
                review_dir=review_dir,
                blog_root=root / "missing-blog",
            )
            self.assertEqual(result["status"], "new")
            self.assertEqual(result["title_hints"][0]["target"], batch["batch_id"])

    def test_revision_batch_ids_are_unique_and_lineage_is_validated(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            review_dir = root / "reviews"
            review_dir.mkdir()
            initial = self.native_batch()
            initial_path = review_dir / f"{initial['batch_id']}.json"
            initial_path.write_text(json.dumps(initial), encoding="utf-8")
            self.assertEqual(
                LIB.next_batch_id(
                    date_value="2026-07-28",
                    slug="test-batch",
                    review_mode="revision",
                    review_dir=review_dir,
                ),
                "2026-07-28-test-batch-r01",
            )
            revision = json.loads(json.dumps(initial))
            revision["batch_id"] = "2026-07-28-test-batch-r01"
            revision["date"] = "2026-07-28"
            revision["review_mode"] = "revision"
            revision["supersedes_batch_id"] = initial["batch_id"]
            revision["previous_translation_sha256"] = "b" * 64
            revision["changed_input_roles"] = ["translation"]
            revision["identity_match_reasons"] = ["author_work"]
            revision_path = review_dir / f"{revision['batch_id']}.json"
            revision_path.write_text(json.dumps(revision), encoding="utf-8")
            batches = [(initial_path, initial), (revision_path, revision)]
            self.assertEqual(CHECK.validate_batch(revision_path, revision), [])
            self.assertEqual(CHECK.validate_batch_set(batches), [])

    def test_multiple_native_initial_batches_for_one_work_fail(self):
        first = self.native_batch()
        second = json.loads(json.dumps(first))
        second["batch_id"] = "2026-07-28-test-batch"
        second["date"] = "2026-07-28"
        errors = CHECK.validate_batch_set(
            [(Path("first.json"), first), (Path("second.json"), second)]
        )
        self.assertTrue(any("multiple native initial batches" in error for error in errors))

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
