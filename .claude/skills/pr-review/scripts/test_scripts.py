#!/usr/bin/env python3
"""
Tests for git-diff.py and post-review.py. Standard library only; nothing is
sent to GitHub.

  python3 -m unittest discover -s .claude/skills/pr-review/scripts -p 'test_*.py'
"""

import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gitdiff = load("git_diff", "git-diff.py")
postreview = load("post_review", "post-review.py")


def write_chunk(directory, name, text):
    with open(os.path.join(directory, name), "w", encoding="utf-8") as fh:
        fh.write(text)


# --------------------------------------------------------------------------
# git-diff.py
# --------------------------------------------------------------------------

class AnnotateTest(unittest.TestCase):

    def lines(self, diff):
        return gitdiff.annotate(diff).split("\n")

    def test_added_line_starting_with_plus_plus_is_numbered(self):
        # "+++ x" inside a hunk is an added line, not a file header.
        out = self.lines(
            "diff --git a/f b/f\n--- a/f\n+++ b/f\n"
            "@@ -1,2 +1,3 @@\n one\n+++ two\n three")
        self.assertIn("     2 | + ++ two", out)
        self.assertIn("     3 |   three", out)

    def test_deleted_line_starting_with_minus_minus_is_a_deletion(self):
        out = self.lines(
            "diff --git a/f.sql b/f.sql\n--- a/f.sql\n+++ b/f.sql\n"
            "@@ -1,2 +1,1 @@\n--- a SQL comment\n keep")
        self.assertIn("       | - -- a SQL comment", out)
        self.assertIn("     1 |   keep", out)

    def test_headers_are_recognised_again_in_the_next_file(self):
        out = self.lines(
            "diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\n+b\n"
            "diff --git a/g b/g\n--- a/g\n+++ b/g\n@@ -1 +1 @@\n-c\n+d")
        self.assertIn("+++ b/g", out)
        self.assertIn("     1 | + d", out)

    def test_no_newline_marker_does_not_advance_the_count(self):
        out = self.lines(
            "diff --git a/f b/f\n--- a/f\n+++ b/f\n"
            "@@ -1 +1,2 @@\n-a\n\\ No newline at end of file\n+a\n+b")
        self.assertIn("     1 | + a", out)
        self.assertIn("     2 | + b", out)

    def test_context_after_deletions_keeps_new_file_numbers(self):
        out = self.lines(
            "diff --git a/f b/f\n--- a/f\n+++ b/f\n"
            "@@ -10,4 +10,2 @@\n ten\n-gone\n-gone too\n eleven")
        self.assertIn("    10 |   ten", out)
        self.assertIn("    11 |   eleven", out)


class IgnoreMatcherTest(unittest.TestCase):

    def test_patterns(self):
        m = gitdiff.IgnoreMatcher([
            "package-lock.json\n", "*.tsbuildinfo\n", "web/next-env.d.ts\n",
            "*.lock\n", "!keep.lock\n", "# a comment\n", "\n",
        ])
        self.assertTrue(m.match("package-lock.json"))
        self.assertTrue(m.match("api/package-lock.json"))
        self.assertTrue(m.match("web/deep/x.tsbuildinfo"))
        self.assertTrue(m.match("web/next-env.d.ts"))
        self.assertFalse(m.match("other/web/next-env.d.ts"))  # anchored
        self.assertTrue(m.match("yarn.lock"))
        self.assertFalse(m.match("keep.lock"))                # negated
        self.assertFalse(m.match("api/src/main.ts"))


class RealRepoTest(unittest.TestCase):
    """Runs git-diff.py against a real repository and checks its one promise:
    every annotated number N is line N of the new file."""

    def git(self, *args):
        subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t",
                        "-c", "init.defaultBranch=main", *args],
                       cwd=self.repo, check=True, capture_output=True)

    def write(self, path, text):
        full = os.path.join(self.repo, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(text)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = self.tmp.name
        self.git("init", "-q")
        self.write("src/a.ts", "".join("line %d\n" % i for i in range(1, 41)))
        self.write("db/m.sql", "-- header\nCREATE TABLE t (id int);\n-- old note\n")
        self.write("package-lock.json", "{}\n")
        self.write(".skill-ignore", "package-lock.json\n")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")
        self.git("checkout", "-q", "-b", "feature")

        a = ["line %d\n" % i for i in range(1, 41)]
        a[2:2] = ["++ looks like a header\n", "plain add\n"]   # near the top
        del a[20]                                             # a deletion mid-file
        a.insert(35, "late add\n")                            # a second hunk
        self.write("src/a.ts", "".join(a))
        self.write("db/m.sql", "-- header\nCREATE TABLE t (id int);\n")
        self.write("src/new.ts", "export const x = 1;\n")
        self.write("package-lock.json", '{"changed": true}\n')
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "change")

        proc = subprocess.run(
            [sys.executable, os.path.join(HERE, "git-diff.py"), "main"],
            cwd=self.repo, capture_output=True, text=True, check=True)
        self.out_dir = os.path.join(self.repo, "tmp", "diff-main")
        self.assertIn("chunk(s) in tmp/diff-main", proc.stdout)

    def tearDown(self):
        self.tmp.cleanup()

    def test_every_annotated_number_is_that_line_of_the_new_file(self):
        checked = 0
        for name in sorted(os.listdir(self.out_dir)):
            path = None
            with open(os.path.join(self.out_dir, name), encoding="utf-8") as fh:
                chunk_lines = fh.read().split("\n")
            for raw in chunk_lines:
                if raw.startswith("+++ b/"):
                    path = raw[6:]
                    with open(os.path.join(self.repo, path), encoding="utf-8") as fh:
                        new_lines = fh.read().split("\n")
                    continue
                head, sep, rest = raw.partition(" | ")
                if sep and head.strip().isdigit() and rest[:1] in ("+", " "):
                    n = int(head)
                    self.assertEqual(rest[2:], new_lines[n - 1],
                                     "%s: label %d does not match the file" % (path, n))
                    checked += 1
        self.assertGreater(checked, 20)

    def test_ignored_and_deleted_content(self):
        text = ""
        for n in os.listdir(self.out_dir):
            with open(os.path.join(self.out_dir, n), encoding="utf-8") as fh:
                text += fh.read()
        self.assertNotIn("package-lock.json", text.split("# files:")[1].split("\n")[0])
        self.assertIn("| - -- old note", text)

    def test_anchors_match_the_chunks(self):
        anchors, bases = postreview.load_anchors(self.out_dir)
        self.assertEqual(len(bases), 1)
        self.assertIn("src/new.ts", anchors)
        self.assertNotIn("package-lock.json", anchors)
        a = anchors["src/a.ts"]
        self.assertIn(3, a)                       # "++ looks like a header"
        self.assertEqual(len(set(a.values())), 3)  # three separate hunks


# --------------------------------------------------------------------------
# post-review.py
# --------------------------------------------------------------------------

CHUNK = """# chunk 01 of 01
# base: abc123
# files: src/a.ts, src/gone.ts, "caf\\303\\251.txt"
diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts

@@ -1,3 +1,4 @@
     1 |   one
     2 | + two
       | - old
     3 |   three
     4 | + four

@@ -20,2 +21,3 @@
    21 |   twenty
    22 | + added
    23 |   end
diff --git a/src/gone.ts b/src/gone.ts
deleted file mode 100644
--- a/src/gone.ts
+++ /dev/null

@@ -1,2 +0,0 @@
       | - x
       | - y
diff --git "a/caf\\303\\251.txt" "b/caf\\303\\251.txt"
--- "a/caf\\303\\251.txt"
+++ "b/caf\\303\\251.txt"

@@ -1 +1 @@
       | - a
     1 | + b
"""


class AnchorsTest(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        write_chunk(self.tmp.name, "chunk-01.diff", CHUNK)
        self.anchors, self.bases = postreview.load_anchors(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_lines_hunks_and_base(self):
        self.assertEqual(self.bases, {"abc123"})
        a = self.anchors["src/a.ts"]
        self.assertEqual(sorted(a), [1, 2, 3, 4, 21, 22, 23])
        self.assertNotEqual(a[4], a[21])  # different hunks

    def test_deleted_file_has_no_anchors(self):
        self.assertNotIn("src/gone.ts", self.anchors)

    def test_quoted_non_ascii_path(self):
        self.assertEqual(self.anchors.get("café.txt"), {1: self.anchors["café.txt"][1]})


class CheckCommentTest(unittest.TestCase):

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        write_chunk(tmp.name, "chunk-01.diff", CHUNK)
        self.anchors, _ = postreview.load_anchors(tmp.name)

    def check(self, **kw):
        c = {"path": "src/a.ts", "line": 2, "severity": "nit", "body": "b"}
        c.update(kw)
        return postreview.check_comment({k: v for k, v in c.items() if v is not None},
                                        self.anchors)

    def test_valid(self):
        self.assertIsNone(self.check())
        self.assertIsNone(self.check(start_line=1, line=4))

    def test_errors(self):
        self.assertIn("missing `body`", self.check(body=None))
        self.assertIn("severity", self.check(severity="minor"))
        self.assertIn("integer", self.check(line="2"))
        self.assertIn("path is not in the diff", self.check(path="src/b.ts"))
        self.assertIn("line 10 is not", self.check(line=10))
        self.assertIn("below `line`", self.check(start_line=4, line=4))
        self.assertIn("start_line 0 is not", self.check(start_line=0, line=4))

    def test_range_across_hunks_is_rejected(self):
        # Both ends are real lines, but GitHub rejects a range spanning hunks.
        self.assertIn("different hunks", self.check(start_line=4, line=21))


class BuildReviewTest(unittest.TestCase):

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        write_chunk(tmp.name, "chunk-01.diff", CHUNK)
        self.anchors, _ = postreview.load_anchors(tmp.name)

    def test_unanchored_is_folded_not_dropped(self):
        findings = {"summary": "Top.", "comments": [
            {"path": "src/a.ts", "start_line": 1, "line": 2, "severity": "blocking",
             "body": "real"},
            {"path": "src/a.ts", "line": 99, "severity": "question", "body": "lost?"},
        ]}
        event, summary, comments, anchored, unanchored = postreview.build_review(
            findings, self.anchors)
        self.assertEqual(event, "COMMENT")
        self.assertEqual(len(comments), 1)
        self.assertEqual(comments[0]["start_side"], "RIGHT")
        self.assertTrue(comments[0]["body"].startswith("**Blocking** · "))
        self.assertIn("### Not anchored to a line", summary)
        self.assertIn("`src/a.ts` line 99", summary)
        self.assertIn("lost?", summary)


if __name__ == "__main__":
    unittest.main()
