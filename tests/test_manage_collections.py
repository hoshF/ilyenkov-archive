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

    def v2_digitization_fixture(self, root: Path) -> tuple[Path, Path, Path]:
        self.fixture(root)
        data = self.registry()
        data["collections"].append({
            "id": "test-texts",
            "person_id": "test",
            "kind": "author_texts",
            "root": "test_markdown",
            "layout": "legacy",
            "stage": "markdown_and_scans",
            "readme": None,
            "corpus_paths": ["test_markdown/test_md/"],
            "scan_paths": ["test_markdown/source_scans/"],
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
        final = root / "test_markdown/test_md/book.md"
        final.parent.mkdir()
        final.write_text(
            "---\n"
            'transcription_mode: "agent_canonical_markdown"\n'
            "---\n\n"
            "<!-- block-id: b0001 -->\n"
            "# Heading\n\n"
            "<!-- block-id: b0002 -->\n"
            "A paragraph crossing pages without layout markers.\n",
            encoding="utf-8",
        )
        project = root / "test_markdown/digitization/book"
        project.mkdir(parents=True)
        (project / "project.json").write_text(json.dumps({
            "schema_version": 2,
            "author_id": "test",
            "work_id": "book",
            "source_scan": "test_markdown/source_scans/book.pdf",
            "source_sha256": MANAGER.sha256(scan),
            "source_version": "first",
            "status": "human_verified",
            "created": "2026-07-27",
            "ocr_activated": True,
            "output_profile": "agent_canonical_markdown",
        }), encoding="utf-8")
        pages = [
            {"file_page_index": 0, "scan_page_id": "pdf-page-001", "printed_page": "1"},
            {"file_page_index": 1, "scan_page_id": "pdf-page-002", "printed_page": "2"},
        ]
        (project / "page_map.json").write_text(json.dumps({
            "schema_version": 1,
            "pages": pages,
        }), encoding="utf-8")
        (project / "ocr_runs.json").write_text(json.dumps({
            "schema_version": 1,
            "runs": [
                {"engine": "one", "version": "1"},
                {"engine": "two", "version": "1"},
            ],
        }), encoding="utf-8")
        (project / "ocr_review_log.json").write_text(json.dumps({
            "schema_version": 1,
            "reviews": [],
        }), encoding="utf-8")
        (project / "quality_report.json").write_text(json.dumps({
            "schema_version": 1,
            "status": "passed",
            "checks": {"canonical_text_map_valid": True},
            "unresolved_issues": [],
        }), encoding="utf-8")
        final_hash = MANAGER.sha256(final)
        (project / "human_verification_manifest.json").write_text(json.dumps({
            "schema_version": 1,
            "verification_status": "human_verified",
            "reviewer": "owner",
            "verification_date": "2026-07-27",
            "verified_scan_pages": ["pdf-page-001", "pdf-page-002"],
            "source_scan_sha256": MANAGER.sha256(scan),
            "final_markdown": "test_markdown/test_md/book.md",
            "final_markdown_sha256": final_hash,
        }), encoding="utf-8")
        canonical_map = project / "canonical_text_map.json"
        canonical_map.write_text(json.dumps({
            "schema_version": 1,
            "work_id": "book",
            "final_markdown": "test_markdown/test_md/book.md",
            "final_markdown_sha256": final_hash,
            "blocks": [
                {
                    "block_id": "b0001",
                    "kind": "heading",
                    "source_locators": [{"scan_page_id": "pdf-page-001"}],
                },
                {
                    "block_id": "b0002",
                    "kind": "paragraph",
                    "source_locators": [
                        {"scan_page_id": "pdf-page-001"},
                        {"scan_page_id": "pdf-page-002"},
                    ],
                },
            ],
            "textual_notes": [{
                "block_id": "b0002",
                "category": "source_typo",
                "source_reading": "teh",
                "canonical_reading": "the",
                "source_locators": [{"scan_page_id": "pdf-page-002"}],
                "rationale": "Unambiguous typographical error.",
            }],
        }), encoding="utf-8")
        return project, final, canonical_map

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
                relation="later research context",
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
            readme = (author_root / "README.md").read_text(encoding="utf-8")
            self.assertIn("# New Philosopher Philosophy Text Archive", readme)
            self.assertIn('language: "en"', readme)
            self.assertNotIn("## 中文摘要", readme)
            status = (root / "COLLECTION_STATUS.md").read_text(encoding="utf-8")
            self.assertIn("New Philosopher", status)
            self.assertNotIn("New Philosopher / 新人", status)
            self.assertEqual(REGISTRY.validate_registry(root), [])

    def test_status_generation_is_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            first = MANAGER.status_markdown(root)
            second = MANAGER.status_markdown(root)
            self.assertEqual(first, second)
            self.assertIn("# Philosopher Text Collection Status", first)
            self.assertIn('language: "en"', first)
            self.assertNotIn("中文说明", first)
            self.assertIn("| Person | Collection | Stage |", first)

    def test_work_status_prefers_existing_html_markdown_over_registered_scan(self):
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
                "stage": "markdown_and_scans",
                "corpus_paths": ["test_markdown/test_md/"],
                "scan_paths": ["test_markdown/source_scans/"],
                "scan_manifest": "test_markdown/metadata/source_scans_manifest.json",
                "works_manifest": None,
                "bibliography_paths": [],
                "gbrain_tracked": True,
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            scan = root / "test_markdown/source_scans/work.pdf"
            scan.parent.mkdir(parents=True)
            scan.write_bytes(b"scan")
            metadata = root / "test_markdown/metadata"
            metadata.mkdir()
            (metadata / "source_scans_manifest.json").write_text(json.dumps({"items": [{
                "title": "Same Work",
                "source_url": "https://example.test/work",
                "local_path": "source_scans/work.pdf",
                "sha256": MANAGER.sha256(scan),
                "source_format": "pdf",
                "text_status": "source_scan_unprocessed",
            }]}), encoding="utf-8")
            markdown = root / "test_markdown/test_md/work.md"
            markdown.parent.mkdir()
            markdown.write_text(
                "---\n"
                'title: "Same Work"\n'
                'source_format: "html"\n'
                'text_status: "html_conversion_unverified"\n'
                'source_url: "https://example.test/work"\n'
                'source_scan: "test_markdown/source_scans/work.pdf"\n'
                f'source_scan_sha256: "{MANAGER.sha256(scan)}"\n'
                "---\n\n# Same Work\n",
                encoding="utf-8",
            )

            status, errors = MANAGER.build_work_status(root)

            self.assertEqual(errors, [])
            work = MANAGER.query_work_status(
                status, path="test_markdown/test_md/work.md"
            )[0]
            self.assertEqual(work["digital_text"], "present")
            self.assertEqual(work["source_evidence"], "registered")
            self.assertEqual(work["verification"], "unverified")
            self.assertEqual(work["digitization_project"], "not_started")
            self.assertEqual(work["progress"], "digital_text_unverified")

    def test_work_status_rejects_invalid_verification_promotion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _project, final, _canonical_map = self.v2_digitization_fixture(root)
            status, errors = MANAGER.build_work_status(root)
            verified = MANAGER.query_work_status(status, work_id="book")[0]
            self.assertEqual(errors, [])
            self.assertEqual(verified["progress"], "human_verified")

            final.write_text(final.read_text() + "\nChanged.\n", encoding="utf-8")
            status, errors = MANAGER.build_work_status(root)
            invalid = MANAGER.query_work_status(status, work_id="book")[0]
            self.assertTrue(any("SHA-256 mismatch" in error for error in errors), errors)
            self.assertEqual(invalid["verification"], "unverified")
            self.assertEqual(invalid["progress"], "digital_text_unverified")

    def test_work_status_does_not_merge_duplicate_titles_without_an_anchor(self):
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
                "stage": "markdown_corpus",
                "corpus_paths": ["test_markdown/test_md/"],
                "scan_paths": [],
                "scan_manifest": None,
                "works_manifest": None,
                "bibliography_paths": [],
                "gbrain_tracked": True,
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            corpus = root / "test_markdown/test_md"
            corpus.mkdir(parents=True)
            for name in ("one", "two"):
                (corpus / f"{name}.md").write_text(
                    '---\ntitle: "Duplicate Title"\n'
                    f'source_url: "https://example.test/{name}"\n'
                    'text_status: "html_conversion_unverified"\n---\n',
                    encoding="utf-8",
                )

            status, errors = MANAGER.build_work_status(root)

            self.assertEqual(errors, [])
            works = [work for work in status["works"] if work["title"] == "Duplicate Title"]
            self.assertEqual(len(works), 2)
            self.assertTrue(all(
                any(issue.startswith("ambiguous_title_match:") for issue in work["issues"])
                for work in works
            ))

    def test_work_status_groups_longform_chapters_by_work_manifest(self):
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
                "stage": "markdown_corpus",
                "corpus_paths": ["test_markdown/test_md/"],
                "scan_paths": [],
                "scan_manifest": None,
                "works_manifest": None,
                "bibliography_paths": [],
                "gbrain_tracked": True,
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            work_dir = root / "test_markdown/test_md/book"
            work_dir.mkdir(parents=True)
            chapters = []
            for index in range(2):
                name = f"book-ch{index:03}.md"
                (work_dir / name).write_text(
                    f'---\ntitle: "Book Chapter {index}"\n'
                    'text_status: "html_conversion_unverified"\n---\n',
                    encoding="utf-8",
                )
                chapters.append({"file": name})
            (work_dir / "work_manifest.json").write_text(json.dumps({
                "schema_version": 1,
                "work_id": "book",
                "chapters": chapters,
            }), encoding="utf-8")

            status, errors = MANAGER.build_work_status(root)

            self.assertEqual(errors, [])
            work = MANAGER.query_work_status(status, work_id="book")[0]
            self.assertEqual(len(work["markdown_paths"]), 2)
            self.assertEqual(work["progress"], "digital_text_unverified")

    def test_freedom_of_will_work_status_regression(self):
        repository_root = Path(__file__).resolve().parents[1]
        status, errors = MANAGER.build_work_status(repository_root)
        path = (
            "maidansky_markdown/maidansky_md/istoriya-filosofii/"
            "istoriya-filosofii-e-v-ilyenkov-o-svobode-voli.md"
        )

        self.assertEqual(errors, [])
        work = MANAGER.query_work_status(status, path=path)[0]
        self.assertEqual(work["progress"], "digital_text_unverified")
        self.assertEqual(work["verification"], "unverified")
        self.assertEqual(work["source_evidence"], "registered")
        self.assertEqual(work["digitization_project"], "not_started")
        self.assertEqual(
            work["source_scan_paths"],
            ["maidansky_markdown/source_scans/psyjournals/e-v-ilyenkov-o-svobode-voli.pdf"],
        )

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

    def test_init_digitization_defaults_to_v2_agent_canonical_profile(self):
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
                "corpus_paths": [],
                "scan_paths": ["test_markdown/source_scans/"],
                "scan_manifest": "test_markdown/metadata/source_scans_manifest.json",
                "bibliography_paths": [],
                "gbrain_tracked": True,
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            scan = root / "test_markdown/source_scans/book.pdf"
            scan.parent.mkdir(parents=True)
            scan.write_bytes(b"scan")
            metadata = root / "test_markdown/metadata"
            metadata.mkdir()
            (metadata / "source_scans_manifest.json").write_text(json.dumps({"items": [{
                "local_path": "source_scans/book.pdf",
                "sha256": MANAGER.sha256(scan),
            }]}), encoding="utf-8")
            MANAGER.init_digitization(root, SimpleNamespace(
                author_id="test",
                work_id="book",
                source_scan="test_markdown/source_scans/book.pdf",
                source_version="first edition",
                date="2026-07-27",
            ))
            project = json.loads((
                root / "test_markdown/digitization/book/project.json"
            ).read_text())
            self.assertEqual(project["schema_version"], 2)
            self.assertEqual(project["output_profile"], "agent_canonical_markdown")
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

    def test_v2_human_verified_digitization_accepts_complete_canonical_map(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.v2_digitization_fixture(root)
            self.assertEqual(MANAGER.validate_digitization(root), [])

    def test_v2_digitization_rejects_missing_output_profile_and_map(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            project, _final, canonical_map = self.v2_digitization_fixture(root)
            project_data = json.loads((project / "project.json").read_text())
            project_data.pop("output_profile")
            (project / "project.json").write_text(json.dumps(project_data), encoding="utf-8")
            canonical_map.unlink()
            errors = MANAGER.validate_digitization(root)
            self.assertTrue(any("output_profile" in error for error in errors))
            self.assertTrue(any("canonical_text_map.json" in error for error in errors))

    def test_v2_digitization_rejects_duplicate_unmapped_invalid_page_and_hash(self):
        mutations = {
            "duplicate": "重复 block ID",
            "unmapped": "映射不完整",
            "invalid_page": "无效 scan_page_id",
            "hash": "SHA-256 不匹配",
            "inline_page": "页界注释",
            "missing_id": "未分配 block ID",
            "duplicate_footnote": "重复脚注 ID",
        }
        for mutation, expected in mutations.items():
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                project, final, canonical_map_path = self.v2_digitization_fixture(root)
                canonical_map = json.loads(canonical_map_path.read_text())
                verification_path = project / "human_verification_manifest.json"
                verification = json.loads(verification_path.read_text())
                if mutation == "duplicate":
                    final.write_text(final.read_text().replace("b0002", "b0001"), encoding="utf-8")
                elif mutation == "unmapped":
                    canonical_map["blocks"].pop()
                elif mutation == "invalid_page":
                    canonical_map["blocks"][1]["source_locators"] = [
                        {"scan_page_id": "pdf-page-999"}
                    ]
                elif mutation == "hash":
                    canonical_map["final_markdown_sha256"] = "0" * 64
                elif mutation == "inline_page":
                    final.write_text(
                        final.read_text().replace(
                            "crossing pages",
                            "cross<!-- source-page: pdf-page-002 -->ing pages",
                        ),
                        encoding="utf-8",
                    )
                elif mutation == "missing_id":
                    final.write_text(
                        final.read_text().replace("<!-- block-id: b0002 -->\n", ""),
                        encoding="utf-8",
                    )
                elif mutation == "duplicate_footnote":
                    final.write_text(
                        final.read_text()
                        + "\n<!-- block-id: b0003 -->\n[^note]: First.\n"
                        + "\n<!-- block-id: b0004 -->\n[^note]: Second.\n",
                        encoding="utf-8",
                    )
                    canonical_map["blocks"].extend([
                        {
                            "block_id": "b0003",
                            "kind": "footnote",
                            "source_locators": [{"scan_page_id": "pdf-page-001"}],
                        },
                        {
                            "block_id": "b0004",
                            "kind": "footnote",
                            "source_locators": [{"scan_page_id": "pdf-page-002"}],
                        },
                    ])
                if mutation in {
                    "duplicate", "inline_page", "missing_id", "duplicate_footnote"
                }:
                    final_hash = MANAGER.sha256(final)
                    canonical_map["final_markdown_sha256"] = final_hash
                    verification["final_markdown_sha256"] = final_hash
                    verification_path.write_text(json.dumps(verification), encoding="utf-8")
                canonical_map_path.write_text(json.dumps(canonical_map), encoding="utf-8")
                errors = MANAGER.validate_digitization(root)
                self.assertTrue(any(expected in error for error in errors), errors)

    def test_translation_project_requires_matching_source_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            data = self.registry()
            data["collections"].append({
                "id": "test-texts",
                "person_id": "test",
                "corpus_paths": ["test_markdown/test_md/"],
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            schema = root / "metadata/schemas/translation_project.schema.json"
            schema.parent.mkdir()
            schema.write_text("{}\n", encoding="utf-8")
            source = root / "test_markdown/test_md/work.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                "---\ntext_role: \"author_original\"\n"
                "core_corpus_eligible: \"true\"\n"
                "llm_wiki_eligible: \"true\"\n"
                "gbrain_source: \"project-markdown\"\n"
                "source_url: \"https://example.test\"\n---\n# Work\n",
                encoding="utf-8",
            )
            project = root / "translation_workspace/planned/test/work"
            project.mkdir(parents=True)
            (project / "translation.json").write_text(json.dumps({
                "schema_version": 3,
                "author_id": "test",
                "work_id": "work",
                "created_at": "2026-07-18",
                "updated_at": "2026-07-18",
                "target_language": "zh",
                "source_units": [{
                    "id": "full",
                    "status": "planned",
                    "source_segments": [{
                        "source_path": "test_markdown/test_md/work.md",
                        "source_url": "https://example.test",
                        "source_version": "first",
                        "source_sha256": "0" * 64,
                        "source_block_start": 1,
                        "source_block_end": 1,
                    }],
                    "paragraph_count": 1,
                    "accuracy_review": {
                        "reviewer": None,
                        "reviewed_at": None,
                        "result": "pending",
                        "scope_sha256": None,
                    },
                    "language_review": {
                        "reviewer": None,
                        "reviewed_at": None,
                        "result": "pending",
                        "scope_sha256": None,
                    },
                }],
            }), encoding="utf-8")
            errors = MANAGER.validate_translation_projects(root)
            self.assertTrue(any("source SHA-256 mismatch" in error for error in errors))

    def test_init_translation_derives_source_hash_and_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            data = self.registry()
            data["collections"].append({
                "id": "test-texts",
                "person_id": "test",
                "corpus_paths": ["test_markdown/test_md/"],
            })
            (root / "metadata/collections.json").write_text(json.dumps(data), encoding="utf-8")
            schema = root / "metadata/schemas/translation_project.schema.json"
            schema.parent.mkdir()
            schema.write_text("{}\n", encoding="utf-8")
            source = root / "test_markdown/test_md/work.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                "---\ntext_role: \"author_original\"\n"
                "core_corpus_eligible: \"true\"\n"
                "llm_wiki_eligible: \"true\"\n"
                "gbrain_source: \"project-markdown\"\n"
                "source_url: \"https://example.test\"\n---\n"
                "# Work\n\nParagraph.\n",
                encoding="utf-8",
            )
            args = SimpleNamespace(
                author_id="test",
                work_id="work",
                source_version="first edition",
                source_unit=[
                    ["full", "test_markdown/test_md/work.md", "1-1"],
                    ["full", "test_markdown/test_md/work.md", "2-2"],
                ],
                date="2026-07-18",
            )

            MANAGER.init_translation(root, args)

            metadata = json.loads((
                root / "translation_workspace/planned/test/work/translation.json"
            ).read_text(encoding="utf-8"))
            self.assertEqual(metadata["source_units"][0]["paragraph_count"], 2)
            self.assertEqual(len(metadata["source_units"][0]["source_segments"]), 2)
            self.assertEqual(
                metadata["source_units"][0]["source_segments"][0]["source_sha256"],
                MANAGER.sha256(source),
            )
            self.assertEqual(MANAGER.validate_translation_projects(root), [])


if __name__ == "__main__":
    unittest.main()
