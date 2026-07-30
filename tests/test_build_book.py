"""Tests for the translation-to-book chain.

These cover the pure functions that decide how a translated unit becomes typeset pages.
They exist because the failures they catch are silent: an over-long running head does not
raise, it overflows onto the body text of one page in a 439-page PDF; a mis-rendered
section label does not raise, it just reads `第4节` somewhere in the table of contents.
Until these tests, the only thing standing between such a change and the printed book was
a human paging through the proof.
"""

import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def load(name: str):
    """Load a script as a module, mirroring tests/test_split_longform_markdown.py.

    The module must be registered in sys.modules *before* exec_module: dataclass
    definitions look their own module up by name while the class body executes.
    """
    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BUILD_BOOK = load("build_book")
MD_TO_LATEX = load("md_to_latex")


class SectionLabelTests(unittest.TestCase):
    """`4. …` becomes `第四节　…` at bookmaking time; the translation source is untouched."""

    def test_numbers_one_to_ten_use_chinese_numerals(self):
        expected = "一二三四五六七八九十"
        for value, numeral in enumerate(expected, start=1):
            with self.subTest(value=value):
                self.assertEqual(
                    BUILD_BOOK.section_label(f"{value}. 标题"),
                    f"第{numeral}节　标题",
                )

    def test_ten_is_not_rendered_as_digits(self):
        # 「第10节」 would be the natural bug: guard the boundary explicitly.
        self.assertEqual(BUILD_BOOK.section_label("10. “知性”与“理性”"), "第十节　“知性”与“理性”")

    def test_separator_is_one_ideographic_space(self):
        # The reference edition puts exactly 1.00 character width after 「节」.
        label = BUILD_BOOK.section_label("1. 标题")
        self.assertEqual(label[3], "　")
        self.assertNotIn("  ", label)

    def test_titles_without_a_number_are_untouched(self):
        for title in ("作者序", "序言", "第一部分", "注释"):
            with self.subTest(title=title):
                self.assertEqual(BUILD_BOOK.section_label(title), title)

    def test_roman_and_letter_prefixes_are_not_treated_as_section_numbers(self):
        # An appendix numbered `I.` must not become 「第I节」 or lose its prefix.
        self.assertEqual(
            BUILD_BOOK.section_label("I. 辩证法和形式逻辑中对抽象的东西的理解"),
            "I. 辩证法和形式逻辑中对抽象的东西的理解",
        )

    def test_a_number_inside_the_title_is_not_relabelled(self):
        self.assertEqual(BUILD_BOOK.section_label("论 1844 年手稿"), "论 1844 年手稿")


class RunningHeadTests(unittest.TestCase):
    """The running head is a single-line box: an over-long title overflows onto the body."""

    LONG = (
        "第四节　亚当·斯密的“归纳”和大卫·李嘉图的“演绎”。"
        "政治经济学中的洛克观点和斯宾诺莎观点"
    )

    def test_short_titles_pass_through_unchanged(self):
        title = "第一节　马克思对“具体”的规定及其特点"
        self.assertEqual(BUILD_BOOK.running_head(title), title)

    def test_over_long_titles_are_cut_at_the_sentence_boundary(self):
        # Cutting at 「。」 keeps the head a complete sentence rather than a fragment.
        head = BUILD_BOOK.running_head(self.LONG)
        self.assertEqual(head, "第四节　亚当·斯密的“归纳”和大卫·李嘉图的“演绎”")
        self.assertNotIn("。", head)
        self.assertTrue(self.LONG.startswith(head))

    def test_result_fits_the_limit(self):
        for title in (self.LONG, "第二节　" + "长" * 60):
            with self.subTest(title=title[:12]):
                self.assertLessEqual(len(BUILD_BOOK.running_head(title)), 30)

    def test_titles_without_a_period_are_hard_cut_with_an_ellipsis(self):
        head = BUILD_BOOK.running_head("第二节　" + "长" * 60)
        self.assertTrue(head.endswith("…"))
        self.assertEqual(len(head), 30)

    def test_a_late_period_does_not_produce_a_stub(self):
        # A 「。」 in the first few characters must not cut the head down to nothing.
        head = BUILD_BOOK.running_head("第一节　甲。" + "乙" * 40)
        self.assertGreaterEqual(len(head), 8)

    def test_limit_is_honoured_when_passed_explicitly(self):
        self.assertEqual(BUILD_BOOK.running_head("abcdefghij", limit=100), "abcdefghij")


class MarkdownToLatexTests(unittest.TestCase):
    """The converter only handles what final.md actually uses; each case is load-bearing."""

    def convert(self, text, footnotes=None):
        report = []
        out = MD_TO_LATEX.convert_inline(text, footnotes or {}, report)
        return out, report

    def test_emphasis_becomes_emph(self):
        out, _ = self.convert("这是*强调*的话")
        self.assertEqual(out, r"这是\emph{强调}的话")

    def test_double_asterisks_are_not_emphasis(self):
        out, _ = self.convert("**粗**不是强调")
        self.assertNotIn(r"\emph", out)

    def test_footnote_definition_is_inlined_at_the_reference(self):
        out, report = self.convert("正文[^a]。", {"a": "注文"})
        self.assertIn(r"\footnote{注文}", out)
        self.assertEqual(report, [])

    def test_missing_footnote_definition_is_reported_not_silently_dropped(self):
        out, report = self.convert("正文[^missing]。")
        self.assertNotIn("[^missing]", out)
        self.assertEqual(len(report), 1)
        self.assertIn("missing", report[0])

    def test_italics_inside_a_footnote_use_the_footnote_command(self):
        # Russian bibliography italicises the author's name; that is a citation
        # convention, not emphasis, so it must not render like body emphasis.
        out, _ = self.convert("正文[^a]。", {"a": "*莱布尼茨 Г.В.* 《人类理智新论》。"})
        self.assertIn(r"\footnoteemph{莱布尼茨 Г.В.}", out)
        self.assertNotIn(r"\emph{莱布尼茨", out)

    def test_a_block_may_hold_several_footnote_definitions(self):
        """译注 `[^zh-N]` 没有自己的源块，只能与底本脚注并在同一块。

        原先用 re.S 一次匹配整块，`.*` 会把后一条定义吃进前一条的注文，后一条于是
        「无定义」——转换器会报出来，但书里那条译注就没了。
        """
        block = "[^a]: 底本的注。\n\n[^zh-1]: 译者的注。——译注"
        footnotes = MD_TO_LATEX.parse_footnote_block(block)
        self.assertEqual(set(footnotes), {"a", "zh-1"})
        self.assertEqual(footnotes["a"], "底本的注。")
        self.assertNotIn("译者的注", footnotes["a"])
        self.assertTrue(footnotes["zh-1"].endswith("——译注"))

    def test_latex_specials_are_escaped(self):
        out, _ = self.convert("100% 与 a&b 及 x_y")
        self.assertIn(r"\%", out)
        self.assertIn(r"\&", out)
        self.assertIn(r"\_", out)

    def test_backslash_is_escaped_before_the_escapes_it_introduces(self):
        # Escaping "\" last would re-escape the backslashes of \%, \& and friends.
        self.assertEqual(MD_TO_LATEX.escape("a\\b"), r"a\textbackslash{}b")
        self.assertEqual(MD_TO_LATEX.escape("50%"), r"50\%")

    def test_bylines_and_inline_citations_are_not_emphasis(self):
        """底本给署名与行内著录加斜体是体例，不是强调；排黑体会成为「强调人名」。"""
        for apparatus in ("Э.И.", "Э. И.", "埃·伊", "马克思 K.", "列宁 В.И.", "恩格斯 Ф."):
            with self.subTest(apparatus=apparatus):
                self.assertTrue(MD_TO_LATEX.is_apparatus(apparatus), apparatus)
                out, _ = self.convert(f"（着重号为引者所加——*{apparatus}*）")
                self.assertIn(r"\bookapparatus{", out)
                self.assertNotIn(r"\emph{", out)

    def test_ordinary_emphasis_is_untouched_by_the_apparatus_rule(self):
        # 判不准的一律留给 \emph：当成强调而其实不是，只是显得重一点；
        # 反过来会抹掉原文的信息。所以规则必须窄。
        for emphasis in ("概念", "具体的", "价值本身", "黑格尔式的", "马克思",
                         "Das", "唯物主义", "一般"):
            with self.subTest(emphasis=emphasis):
                self.assertFalse(MD_TO_LATEX.is_apparatus(emphasis), emphasis)
                out, _ = self.convert(f"*{emphasis}*")
                self.assertEqual(out, r"\emph{" + emphasis + "}")

    def test_apparatus_rule_does_not_fire_on_a_bare_surname(self):
        # 「马克思」单独出现是强调，「马克思 K.」才是著录——缩写是判据。
        self.assertFalse(MD_TO_LATEX.is_apparatus("列宁"))
        self.assertTrue(MD_TO_LATEX.is_apparatus("列宁 В.И."))

    def test_emphasised_text_is_escaped_too(self):
        out, _ = self.convert("*100%*")
        self.assertEqual(out, r"\emph{100\%}")


if __name__ == "__main__":
    unittest.main()
