#!/usr/bin/env python3
"""
git-diff.py

Writes the git diff between the current branch (HEAD) and a target branch
into `tmp/diff-<target-branch>/` as small, reviewable chunks: `chunk-01`,
`chunk-02`, ..., each combining the annotated `git diff` output of up to
`--chunk-size` (default 5) changed files. Every hunk line inside a chunk
is annotated with the line number in the NEW file (the PR head, i.e.
GitHub's RIGHT side):

  @@ -10,7 +10,9 @@
    10 |   unchanged context line
       | - line present in the old file only (deleted)
    11 | + line present in the new file only (added)
    12 |   unchanged context line

A raw unified diff does not say which file line each hunk line maps to,
that must be derived from the @@ headers and tracked across hunks, and
diff readers (LLM reviewers) frequently get it wrong, reporting numbers
the GitHub review API then rejects ("line could not be resolved"). With
the explicit per-line annotation, the first column IS the value to send
as `line`/`start_line` for side=RIGHT review comments.

Renames/copies with content changes are emitted as rename diffs: the
rename headers keep the old path, and the annotated line numbers still
refer to the new file. Files whose only change is a rename (no content
change, R100) are skipped.

Files and folders matching the gitignore-style patterns in `.skill-ignore`
(repo root; override with --ignore-file) are excluded from the diff.

Usage:
  python git-diff.py <target-branch> [options]

Options:
  --out <dir>   Output root directory (default: tmp)
  --chunk-size <n>
                Maximum number of changed files combined into one chunk
                (default: 5)
  --context <n> Lines of context per hunk, passed to git as -U<n>
                (default: 3)
  --ignore-file <path>
                Path to the ignore file (default: <repo root>/.skill-ignore)
  --find-renames <n>
                Rename detection threshold in percent, passed to git as
                -M<n>%% (default: 50, git's own default)
  --no-merge-base
                Diff against the tip of the target branch instead of the
                merge base (i.e. `git diff target HEAD`, two-dot)
  --stdout      Print the annotated diff instead of writing chunk files
"""

import argparse
import os
import re
import subprocess
import sys

HUNK_RE = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")

# Diff header lines. Copied through verbatim, never annotated.
HEADER_PREFIXES = (
    "diff --git",
    "index ",
    "--- ",
    "+++ ",
    "old mode",
    "new mode",
    "new file mode",
    "deleted file mode",
    "similarity index",
    "dissimilarity index",
    "rename from",
    "rename to",
    "copy from",
    "copy to",
    "Binary files",
    "GIT binary patch",
)


# --------------------------------------------------------------------------
# git helpers
# --------------------------------------------------------------------------

def git(*args, check=True):
    proc = subprocess.run(
        ["git", "--no-pager", *args],
        capture_output=True,
        text=True,
    )
    if check and proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        sys.exit(proc.returncode)
    return proc.stdout


def repo_root():
    return git("rev-parse", "--show-toplevel").strip()


def resolve_base(target, use_merge_base):
    """Return the commit HEAD should be compared against."""
    if git("rev-parse", "--verify", "--quiet", target, check=False).strip() == "":
        sys.stderr.write("error: unknown branch or revision: %s\n" % target)
        sys.exit(1)
    if not use_merge_base:
        return target
    base = git("merge-base", target, "HEAD", check=False).strip()
    return base or target


def changed_files(base, ignore, rename_pct):
    """Return [(status, old_path, new_path)] for the files to diff.

    Pure renames (R100, no content change) are dropped, as are paths the
    ignore matcher rejects.
    """
    raw = git("diff", "--name-status", "-M%d%%" % rename_pct, "-z", base, "HEAD")
    fields = raw.split("\0")
    entries = []
    i = 0
    while i < len(fields) and fields[i]:
        status = fields[i]
        if status[0] in ("R", "C"):
            old_path, new_path = fields[i + 1], fields[i + 2]
            i += 3
            # R100 / C100 means similarity 100%, the content is untouched.
            if status[1:] in ("100", "0100"):
                continue
        else:
            old_path = new_path = fields[i + 1]
            i += 2
        if ignore.match(new_path) or ignore.match(old_path):
            continue
        entries.append((status, old_path, new_path))
    return entries


# --------------------------------------------------------------------------
# .skill-ignore matching (gitignore-style)
# --------------------------------------------------------------------------

class IgnoreMatcher:
    """Small gitignore-style matcher: *, ?, **, leading /, trailing /, !negation."""

    def __init__(self, patterns):
        self.rules = []
        for raw in patterns:
            line = raw.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            negate = line.startswith("!")
            if negate:
                line = line[1:]
            dir_only = line.endswith("/")
            anchored = "/" in line.strip("/")
            line = line.strip("/")
            self.rules.append((re.compile(self._to_regex(line, anchored)),
                               negate, dir_only))

    @staticmethod
    def _to_regex(pattern, anchored):
        out = []
        i = 0
        while i < len(pattern):
            c = pattern[i]
            if c == "*":
                if pattern[i:i + 2] == "**":
                    out.append(".*")
                    i += 2
                    if pattern[i:i + 1] == "/":
                        i += 1
                    continue
                out.append("[^/]*")
            elif c == "?":
                out.append("[^/]")
            else:
                out.append(re.escape(c))
            i += 1
        body = "".join(out)
        prefix = "" if anchored else "(?:.*/)?"
        # Match the path itself or anything underneath it.
        return "^%s%s(?:/.*)?$" % (prefix, body)

    def match(self, path):
        if not path:
            return False
        result = False
        for regex, negate, _dir_only in self.rules:
            if regex.match(path):
                result = not negate
        return result


def load_ignore(root, override):
    path = override or os.path.join(root, ".skill-ignore")
    if not os.path.isfile(path):
        return IgnoreMatcher([])
    with open(path, encoding="utf-8") as fh:
        return IgnoreMatcher(fh.readlines())


# --------------------------------------------------------------------------
# annotation
# --------------------------------------------------------------------------

def annotate(diff_text, width=6):
    """Rewrite a unified diff so each hunk line carries its NEW file line number."""
    out = []
    new_no = 0
    blank = " " * width
    # Header lines only occur between "diff --git" and the first @@ of a file.
    # Inside a hunk, "+++ x" is an added line whose content starts with "++ ",
    # and "--- x" a deleted one starting "-- " (a SQL comment, say). Treating
    # those as headers skipped them when counting and shifted every later
    # line number in the file.
    in_hunk = False

    for line in diff_text.split("\n"):
        if line.startswith("diff --git"):
            in_hunk = False
        if not in_hunk and line.startswith(HEADER_PREFIXES):
            out.append(line)
            continue

        m = HUNK_RE.match(line)
        if m:
            in_hunk = True
            new_no = int(m.group(2))
            out.append("")
            out.append(line)
            continue

        if line.startswith("\\"):  # "\ No newline at end of file"
            out.append("%s |   %s" % (blank, line))
            continue

        if line.startswith("+"):
            out.append("%s | + %s" % (str(new_no).rjust(width), line[1:]))
            new_no += 1
        elif line.startswith("-"):
            # Deleted lines exist only on the LEFT, so the column stays empty.
            out.append("%s | - %s" % (blank, line[1:]))
        elif line.startswith(" "):
            out.append("%s |   %s" % (str(new_no).rjust(width), line[1:]))
            new_no += 1
        elif line == "":
            continue
        else:
            out.append(line)

    return "\n".join(out)


def file_diff(base, entry, context, rename_pct=50):
    _status, old_path, new_path = entry
    paths = [old_path] if old_path == new_path else [old_path, new_path]
    raw = git("diff", "-M%d%%" % rename_pct, "--no-color", "-U%d" % context,
              base, "HEAD", "--", *paths)
    return annotate(raw)


# --------------------------------------------------------------------------
# output
# --------------------------------------------------------------------------

def slug(branch):
    return re.sub(r"[^A-Za-z0-9._-]+", "-", branch).strip("-") or "branch"


def write_chunks(entries, base, target, out_root, chunk_size, context, rename_pct):
    out_dir = os.path.join(out_root, "diff-%s" % slug(target))
    os.makedirs(out_dir, exist_ok=True)

    # Clear stale chunks from a previous run.
    for name in os.listdir(out_dir):
        if re.match(r"^chunk-\d+\.diff$", name):
            os.remove(os.path.join(out_dir, name))

    written = []
    groups = [entries[i:i + chunk_size] for i in range(0, len(entries), chunk_size)]
    for index, group in enumerate(groups, start=1):
        body = [file_diff(base, entry, context, rename_pct) for entry in group]
        header = [
            "# chunk %02d of %02d" % (index, len(groups)),
            "# base: %s" % base,
            "# files: %s" % ", ".join(e[2] for e in group),
            "# line numbers are NEW file lines (GitHub RIGHT side)",
            "",
        ]
        path = os.path.join(out_dir, "chunk-%02d.diff" % index)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(header) + "\n".join(body).strip("\n") + "\n")
        written.append(path)
    return out_dir, written


def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("target", nargs="?")
    parser.add_argument("-h", "--help", action="store_true")
    parser.add_argument("--out", default="tmp")
    parser.add_argument("--chunk-size", type=int, default=5)
    parser.add_argument("--context", type=int, default=3)
    parser.add_argument("--ignore-file")
    parser.add_argument("--find-renames", type=int, default=50)
    parser.add_argument("--no-merge-base", action="store_true")
    parser.add_argument("--stdout", action="store_true")
    args = parser.parse_args()

    if args.help or not args.target:
        print(__doc__)
        return 0 if args.help else 1

    root = repo_root()
    os.chdir(root)

    base = resolve_base(args.target, not args.no_merge_base)
    ignore = load_ignore(root, args.ignore_file)
    entries = changed_files(base, ignore, args.find_renames)

    if not entries:
        print("No changed files between %s and HEAD." % args.target)
        return 0

    if args.stdout:
        for entry in entries:
            sys.stdout.write(file_diff(base, entry, args.context, args.find_renames).strip("\n") + "\n")
        return 0

    out_dir, written = write_chunks(
        entries, base, args.target, args.out, args.chunk_size, args.context,
        args.find_renames,
    )
    print("%d changed file(s), %d chunk(s) in %s"
          % (len(entries), len(written), out_dir))
    for path in written:
        print("  %s" % os.path.relpath(path, root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
