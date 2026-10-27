"""Unit tests for the pure parts of scripts/: frontmatter parsing, the
skill-count rewrite, the changelog grouping and the regen_all list.

The --check jobs in CI only prove the committed output matches today's
input; these pin the behaviour that produces it.
Run: python -m unittest discover -s tests -p "test_*.py"
"""
import datetime
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

import generate_changelog  # noqa: E402
import lib_skills  # noqa: E402
import regen_all  # noqa: E402
import sync_metadata  # noqa: E402
import validate_skills  # noqa: E402


class ParseSkillMd(unittest.TestCase):
    def parse(self, text: str) -> lib_skills.Skill:
        with tempfile.TemporaryDirectory() as d:
            md = Path(d) / "demo" / "SKILL.md"
            md.parent.mkdir()
            md.write_bytes(text.encode("utf-8"))
            return lib_skills._parse_skill_md(md)

    def test_folded_block_description_is_joined(self):
        s = self.parse("---\nname: demo\ndescription: >-\n  first line\n  second line\n---\nbody\n")
        self.assertEqual((s.name, s.description), ("demo", "first line second line"))

    def test_inline_description(self):
        self.assertEqual(self.parse("---\nname: demo\ndescription: one line\n---\n").description, "one line")

    def test_crlf_frontmatter_parses_like_lf(self):
        s = self.parse("---\r\nname: demo\r\ndescription: one line\r\n---\r\n")
        self.assertEqual((s.name, s.description), ("demo", "one line"))

    def test_missing_name_falls_back_to_folder(self):
        self.assertEqual(self.parse("---\ndescription: x\n---\n").name, "demo")

    def test_no_frontmatter_raises(self):
        with self.assertRaises(ValueError):
            self.parse("# just a heading\n")

    def test_every_real_skill_parses_with_a_description(self):
        skills = lib_skills.load_skills()
        self.assertTrue(skills)
        for s in skills:
            self.assertEqual(s.name, s.dir.name)
            self.assertTrue(s.description, s.name)


class SyncMetadataRewrite(unittest.TestCase):
    PATTERN = re.compile(r"all (\d+) skills")

    def rewrite(self, text):
        return sync_metadata.rewrite(Path("README.md"), text, self.PATTERN,
                                     lambda skills, agents: f"all {skills} skills", 40, 7)

    def test_rewrites_every_match(self):
        self.assertEqual(self.rewrite("all 3 skills; again all 33 skills"), "all 40 skills; again all 40 skills")

    def test_missing_phrase_raises_instead_of_silently_passing(self):
        with mock.patch.object(sync_metadata, "REPO_ROOT", Path(".").resolve()):
            with self.assertRaises(ValueError):
                self.rewrite("no count here")

    def test_every_target_phrase_exists_today(self):
        for path, pattern, _ in sync_metadata.TARGETS:
            self.assertRegex(path.read_text(encoding="utf-8"), pattern, path.name)


class ChangelogSections(unittest.TestCase):
    def body(self, commits):
        with mock.patch.object(generate_changelog, "commits", return_value=commits):
            return generate_changelog.section_body("a..b")

    def test_groups_by_type_in_section_order_and_skips_non_conventional(self):
        out = self.body([("aaa", "fix(x): later"), ("bbb", "feat: first"), ("ccc", "Merge branch y")])
        self.assertLess(out.index("### Features"), out.index("### Fixes"))
        self.assertIn("**x:** later", out)
        self.assertNotIn("Merge branch", out)

    def test_breaking_change_is_listed_first(self):
        out = self.body([("aaa", "feat(api)!: drop v1")])
        self.assertTrue(out.startswith("### Breaking changes"))

    def test_non_ascii_subject_survives(self):
        self.assertIn("run 7 — fires", self.body([("aaa", "test: run 7 — fires")]))

    def test_empty_range(self):
        self.assertEqual(self.body([]), "_No conventional commits in this range._")


class ReviewDates(unittest.TestCase):
    def check(self, metadata_lines, today=datetime.date(2026, 10, 27)):
        with tempfile.TemporaryDirectory() as d:
            md = Path(d) / "demo" / "SKILL.md"
            md.parent.mkdir()
            lines = ["---", "name: demo", "description: x", *metadata_lines, "---", "body", ""]
            md.write_text("\n".join(lines), encoding="utf-8")
            errors, warnings = [], []
            with mock.patch.object(validate_skills, "SKILLS_DIR", Path(d)):
                validate_skills.check_review_dates(errors, warnings, today)
            return errors, warnings

    @staticmethod
    def reviewed(date):
        return ["metadata:", f'  last_reviewed: "{date}"']

    def test_recent_date_passes(self):
        self.assertEqual(self.check(self.reviewed("2026-10-01")), ([], []))

    def test_old_date_warns_but_does_not_fail(self):
        errors, warnings = self.check(self.reviewed("2026-06-01"))
        self.assertEqual((len(errors), len(warnings)), (0, 1))

    def test_missing_invalid_and_future_dates_fail(self):
        for lines in ([], self.reviewed("2026-02-30"), self.reviewed("2027-01-01")):
            self.assertEqual(len(self.check(lines)[0]), 1, lines)

    def test_other_metadata_keys_before_it_are_fine(self):
        lines = ["metadata:", "  author: x", '  last_reviewed: "2026-10-01"']
        self.assertEqual(self.check(lines), ([], []))


class RegenAllList(unittest.TestCase):
    def test_every_listed_generator_exists_and_has_check(self):
        for name in regen_all.GENERATORS:
            src = (SCRIPTS / f"{name}.py").read_text(encoding="utf-8")
            self.assertIn("--check", src, name)

    def test_every_script_with_check_is_listed(self):
        # A new export_*.py with --check that is not in GENERATORS would
        # silently drop out of CI and the pre-commit hook.
        with_check = {p.stem for p in SCRIPTS.glob("*.py")
                      if '"--check"' in p.read_text(encoding="utf-8") and p.stem != "regen_all"}
        not_generators = {"validate_skills", "release", "measure_context"}
        self.assertEqual(with_check - not_generators, set(regen_all.GENERATORS))


if __name__ == "__main__":
    unittest.main()
