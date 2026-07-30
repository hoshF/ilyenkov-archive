"""Tests for the unified check runner.

Same principle as tests/test_verify_corpus_manifests.py: what matters is not that the suite
passes today but what it does when parts of it fail. A runner that stops at the first failure
would report "one problem" while leaving the rest unknown — the shape that once let nine
longform works go unverified.

The advisory check (check_book.py, which reports leads for a human and exits 0 even when it
finds things) must never be counted as a pass or a failure; a test pins that too, because
treating it as pass/fail would either hide real leads or fail the suite forever.
"""

import contextlib
import importlib.util
import io
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


def load(name: str):
    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


MODULE = load("check_all")


def fake(returncode: int, output: str):
    """A Check whose subprocess is replaced by a fixed result."""

    class FakeCompleted:
        def __init__(self):
            self.returncode = returncode
            self.stdout = output
            self.stderr = ""

    return FakeCompleted()


class CheckTests(unittest.TestCase):
    def run_with(self, results: dict[str, tuple[int, str]], checks=None):
        """Run main() with every subprocess call answered from `results`."""
        original_run = MODULE.subprocess.run
        original_checks = MODULE.CHECKS
        printed: list[str] = []

        def stub(argv, **_kwargs):
            script = next((part for part in argv if part.endswith((".py", "unittest"))), "")
            for key, value in results.items():
                if key in script or key in " ".join(argv):
                    return fake(*value)
            return fake(0, "")

        try:
            MODULE.subprocess.run = stub
            if checks is not None:
                MODULE.CHECKS = checks
            code = self.call_main(printed)
        finally:
            MODULE.subprocess.run = original_run
            MODULE.CHECKS = original_checks
        return code, "\n".join(printed)

    def call_main(self, printed):
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            code = MODULE.main([])          # 显式空 argv：否则会解析到测试运行器的参数
        printed.extend(buffer.getvalue().splitlines())
        return code

    def test_a_clean_run_reports_every_check_and_returns_zero(self):
        code, output = self.run_with({})
        self.assertEqual(code, 0)
        self.assertIn("failed=0/", output)
        for check in MODULE.CHECKS:
            if not check.advisory:
                self.assertIn(check.name, output, check.name)

    def test_several_failures_are_all_reported(self):
        code, output = self.run_with({
            "check_translations.py": (1, "translation_projects=1 errors=3"),
            "check_project_docs.py": (1, "documentation: FAILED"),
            "unittest": (1, "FAILED (failures=2)"),
        })
        self.assertEqual(code, 1)
        self.assertIn("failed=3/", output)
        # Each failing area must appear with its own detail block, not just a count.
        for expected in ("errors=3", "documentation: FAILED", "FAILED (failures=2)"):
            self.assertIn(expected, output, expected)

    def test_one_failure_does_not_hide_the_checks_after_it(self):
        # The first check fails; the last must still be reported.
        code, output = self.run_with({"check_translations.py": (1, "boom")})
        self.assertEqual(code, 1)
        last = [c for c in MODULE.CHECKS if not c.advisory][-1]
        self.assertIn(last.name, output)

    def test_advisory_check_is_neither_pass_nor_fail(self):
        code, output = self.run_with({"check_book.py": (0, "■ 甲（1 处）\n■ 乙（2 处）")})
        self.assertEqual(code, 0)
        self.assertIn("2 条线索待人读", output)
        # The advisory check must stay out of the failed=N/M denominator.
        denominator = len([c for c in MODULE.CHECKS if not c.advisory])
        self.assertIn(f"failed=0/{denominator}", output)

    def test_advisory_failure_does_not_fail_the_suite(self):
        code, _ = self.run_with({"check_book.py": (1, "crashed")})
        self.assertEqual(code, 0)


class PadTests(unittest.TestCase):
    def test_cjk_counts_as_two_columns(self):
        # Padding by character count misaligns every row that contains Chinese.
        self.assertEqual(MODULE.pad("译文", 6), "译文  ")
        self.assertEqual(MODULE.pad("ab", 6), "ab    ")


class StatusTests(unittest.TestCase):
    def test_status_runs_and_names_each_area(self):
        result = subprocess.run([sys.executable, "scripts/check_all.py", "--status"],
                                cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        for expected in ("翻译", "成书", "待办"):
            self.assertIn(expected, result.stdout)

    def test_resolved_cruxes_are_not_counted_as_pending(self):
        # Section 〇 records losses already restored; counting them overstates the backlog,
        # which is how the hand-written "12 处" in HANDOFF drifted from the real 13.
        lines = MODULE.pending_state()
        crux_line = next(l for l in lines if "底本疑点" in l)
        total = int(crux_line.split(":")[1].split("处")[0].strip())
        source = (ROOT / "translation_workspace" / "SOURCE_CRUXES.md").read_text(encoding="utf-8")
        all_rows = len([l for l in source.splitlines() if l.startswith("| ch")])
        self.assertLess(total, all_rows)
        self.assertGreater(total, 0)


class StalenessInputsTests(unittest.TestCase):
    """「书是否落后」只该看真正进书的输入。"""

    def test_only_book_feeding_paths_count(self):
        source = (SCRIPTS / "check_all.py").read_text(encoding="utf-8")
        start = source.index("inputs = [")
        inputs = source[start : source.index("]", start)]
        # 整个 translation_workspace 会把只改 issues.md 的提交也算成「书已落后」——
        # 报不存在的问题，人就会学着无视这一行。
        self.assertNotIn('"translation_workspace"', inputs)
        self.assertIn("final.md", inputs)
        for needed in ("book/template", "book/front", "build_book.py", "md_to_latex.py"):
            self.assertIn(needed, inputs, needed)


if __name__ == "__main__":
    unittest.main()
