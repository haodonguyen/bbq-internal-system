#!/usr/bin/env python3
"""
post-review.py

Checks a findings document against the annotated diff chunks written by
git-diff.py, then (with --post or --draft) submits it to GitHub as a single
pull request review, as the user `gh` is logged in as.

Usage:
  python post-review.py <findings.json> --diff <chunk dir> [--post | --draft]

Without a flag nothing is sent. The dry run prints the summary, every inline
comment with its anchor, and anything that failed to anchor.

  --post   Submit the review with the findings' `event` (COMMENT by default).
           Visible to everyone on the pull request.
  --draft  Create it as a PENDING review instead. Only its author can see it;
           finish it from the pull request's "Files changed" tab ("Finish your
           review"), where each comment can still be edited or dropped.

A comment whose anchor is not a line in the chunks is not dropped: it is
folded into the summary under "Not anchored to a line", so nothing is lost.
GitHub rejects the whole review if any single anchor fails to resolve, which
is why anchors are checked here first.

Before sending, the script also checks that:
  - the chunks were diffed from the commit the pull request's head points at
    (a local commit that was not pushed would shift the line numbers), and
  - the chunks were diffed against the pull request's own base. For a stacked
    pull request that base is the branch below it, not main. Chunks from a
    commit inside the PR (a re-review diff) are recognised and reported;
    anchors must be checked against the whole PR's chunks.
  - you do not already have a pending review on the PR. GitHub allows one per
    person, and would reject a second only once it was sent.

findings.json:
  {
    "repo": "owner/name",          optional, defaults to the current repo
    "pr": 42,                      optional, defaults to the current branch's PR
    "event": "COMMENT",            COMMENT | REQUEST_CHANGES | APPROVE
    "summary": "markdown",
    "comments": [
      {"path": "src/a.ts", "line": 88, "start_line": 85,
       "severity": "blocking", "body": "markdown"}
    ]
  }
"""

import argparse
import json
import os
import re
import subprocess
import sys

SEVERITIES = ("blocking", "important", "nit", "question", "praise")
EVENTS = ("COMMENT", "REQUEST_CHANGES", "APPROVE")
SEVERITY_LABEL = {
    "blocking": "**Blocking**",
    "important": "**Important**",
    "nit": "**Nit**",
    "question": "**Question**",
    "praise": "**Praise**",
}
MAX_BODY = 65536  # GitHub's limit on a review or comment body

ANNOTATED_RE = re.compile(r"^\s*(\d+) \| [+ ]")
HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@")
BASE_RE = re.compile(r"^# base: (\S+)")


# --------------------------------------------------------------------------
# chunks -> the set of lines a comment can anchor to
# --------------------------------------------------------------------------

def unquote_git_path(raw):
    """git quotes paths with unusual characters: "b/caf\\303\\251.txt"."""
    if not raw.startswith('"'):
        return raw
    body = raw[1:-1]
    return body.encode("latin-1").decode("unicode_escape").encode("latin-1").decode("utf-8")


def load_anchors(diff_dir):
    """Return ({path: {line: hunk_id}}, {bases})."""
    if not os.path.isdir(diff_dir):
        sys.exit("error: diff directory not found: %s (run git-diff.py first)" % diff_dir)
    chunks = sorted(f for f in os.listdir(diff_dir) if re.match(r"^chunk-\d+\.diff$", f))
    if not chunks:
        sys.exit("error: no chunk-*.diff files in %s" % diff_dir)

    anchors, bases = {}, set()
    hunk_id = 0
    for name in chunks:
        path = None
        in_hunk = False
        with open(os.path.join(diff_dir, name), encoding="utf-8") as fh:
            for line in fh.read().split("\n"):
                m = BASE_RE.match(line)
                if m:
                    bases.add(m.group(1))
                    continue
                if line.startswith("diff --git"):
                    path, in_hunk = None, False
                    # Fallback for diffs with no "+++" line (binary files).
                    parts = line.split(" b/", 1)
                    if len(parts) == 2:
                        path = unquote_git_path(parts[1])
                    continue
                if not in_hunk and line.startswith("+++ "):
                    target = line[4:]
                    path = None if target == "/dev/null" else unquote_git_path(target)
                    if path and path.startswith("b/"):  # quoted paths are unquoted above
                        path = path[2:]
                    continue
                if HUNK_RE.match(line):
                    in_hunk = True
                    hunk_id += 1
                    continue
                m = ANNOTATED_RE.match(line)
                if m and in_hunk and path:
                    anchors.setdefault(path, {})[int(m.group(1))] = hunk_id
    return anchors, bases


# --------------------------------------------------------------------------
# findings
# --------------------------------------------------------------------------

def check_comment(c, anchors):
    """Return an error string, or None if the comment can be anchored."""
    for key in ("path", "line", "body"):
        if key not in c:
            return "missing `%s`" % key
    if c.get("severity") not in SEVERITIES:
        return "severity must be one of %s" % ", ".join(SEVERITIES)
    if not isinstance(c["line"], int):
        return "`line` must be an integer"
    lines = anchors.get(c["path"])
    if lines is None:
        return "path is not in the diff"
    if c["line"] not in lines:
        return "line %d is not a line in the diff" % c["line"]
    if "start_line" in c:
        start = c["start_line"]
        if not isinstance(start, int) or start >= c["line"]:
            return "`start_line` must be an integer below `line`"
        if start not in lines:
            return "start_line %d is not a line in the diff" % start
        if lines[start] != lines[c["line"]]:
            return "start_line and line are in different hunks"
    return None


def render_body(c):
    return "%s · %s" % (SEVERITY_LABEL[c["severity"]], c["body"].strip())


def build_review(findings, anchors):
    event = findings.get("event", "COMMENT")
    if event not in EVENTS:
        sys.exit("error: event must be one of %s" % ", ".join(EVENTS))

    anchored, unanchored = [], []
    for c in findings.get("comments", []):
        err = check_comment(c, anchors)
        (unanchored if err else anchored).append((c, err))

    summary = (findings.get("summary") or "").strip()
    if unanchored:
        folded = ["", "### Not anchored to a line", ""]
        for c, err in unanchored:
            where = "`%s`" % c.get("path", "?")
            if isinstance(c.get("line"), int):
                where += " line %d" % c["line"]
            label = SEVERITY_LABEL.get(c.get("severity"), "**Note**")
            folded.append("- %s %s — %s" % (label, where, (c.get("body") or "").strip()))
        summary = (summary + "\n" + "\n".join(folded)).strip()

    comments = []
    for c, _ in anchored:
        item = {"path": c["path"], "line": c["line"], "side": "RIGHT", "body": render_body(c)}
        if "start_line" in c:
            item["start_line"] = c["start_line"]
            item["start_side"] = "RIGHT"
        comments.append(item)

    return event, summary, comments, anchored, unanchored


# --------------------------------------------------------------------------
# GitHub
# --------------------------------------------------------------------------

def run(*args, input_text=None):
    proc = subprocess.run(list(args), capture_output=True, text=True, input=input_text)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def gh_json(*args):
    code, out, err = run("gh", *args)
    if code != 0:
        raise RuntimeError(err or out)
    return json.loads(out)


def pr_context(findings):
    """Resolve repo, PR number, head/base and author. Raises on failure."""
    repo = findings.get("repo")
    if not repo:
        repo = gh_json("repo", "view", "--json", "nameWithOwner")["nameWithOwner"]
    pr_args = ["pr", "view"]
    if findings.get("pr"):
        pr_args.append(str(findings["pr"]))
    pr_args += ["--repo", repo, "--json",
                "number,state,headRefOid,baseRefName,baseRefOid,author,url"]
    pr = gh_json(*pr_args)
    viewer = gh_json("api", "user")["login"]
    return repo, pr, viewer


def is_ancestor(older, newer):
    code, _, _ = run("git", "merge-base", "--is-ancestor", older, newer)
    return code == 0


def local_merge_base(base_oid):
    code, out, _ = run("git", "merge-base", base_oid, "HEAD")
    return out if code == 0 else None


def preflight(findings, bases, event, sending):
    """Print checks against the live pull request. Returns (repo, pr) or None."""
    problems, warnings = [], []
    try:
        repo, pr, viewer = pr_context(findings)
    except Exception as exc:  # gh missing, not logged in, no PR for the branch
        msg = "could not read the pull request from GitHub: %s" % exc
        (problems if sending else warnings).append(msg)
        return None, problems, warnings

    if pr["state"] != "OPEN":
        problems.append("PR #%d is %s, not open" % (pr["number"], pr["state"]))

    _, head, _ = run("git", "rev-parse", "HEAD")
    if head != pr["headRefOid"]:
        problems.append(
            "local HEAD %s is not the PR head %s, so the line numbers may not match what "
            "GitHub shows. Push, or `gh pr checkout %d`, then re-run git-diff.py."
            % (head[:8], pr["headRefOid"][:8], pr["number"]))

    expected = local_merge_base(pr["baseRefOid"])
    if expected is None:
        warnings.append("base commit %s is not available locally (git fetch), so the chunks' "
                        "base could not be checked" % pr["baseRefOid"][:8])
    elif bases and expected not in bases:
        inside_pr = all(is_ancestor(expected, b) for b in bases)
        if inside_pr:
            # Chunks from a commit partway through the PR: a re-review diff.
            # Fine to read from, but GitHub resolves anchors against the
            # whole PR, so they must be checked against the whole PR too.
            problems.append(
                "these chunks start at %s, a commit inside PR #%d, so they look like a "
                "re-review diff. Read from them, but check anchors against the whole PR: "
                "run git-diff.py origin/%s and pass that directory as --diff."
                % (", ".join(b[:8] for b in bases), pr["number"], pr["baseRefName"]))
        else:
            problems.append(
                "the chunks were diffed against %s, but PR #%d's diff starts at %s. Its "
                "base branch is `%s`; re-run: git-diff.py origin/%s"
                % (", ".join(b[:8] for b in bases), pr["number"], expected[:8],
                   pr["baseRefName"], pr["baseRefName"]))

    # GitHub allows one pending review per person per pull request, and
    # rejects a second one only when it is sent. Catch it in the dry run.
    try:
        # One page of 100; --paginate would print one JSON array per page.
        reviews = gh_json("api", "repos/%s/pulls/%d/reviews?per_page=100"
                          % (repo, pr["number"]))
        pending = [r for r in reviews
                   if r.get("state") == "PENDING" and r["user"]["login"] == viewer]
    except Exception:
        pending = []
    if pending:
        problems.append(
            "you already have a pending review on PR #%d (%s). GitHub allows one at a "
            "time, so this would be rejected. Submit or delete that one first."
            % (pr["number"], pending[0].get("html_url") or pending[0]["id"]))

    if pr["author"]["login"] == viewer and event != "COMMENT":
        problems.append("you are the author of PR #%d, and GitHub does not allow %s on "
                        "your own pull request. Use COMMENT." % (pr["number"], event))

    print("PR:      %s  (#%d, base %s)" % (pr["url"], pr["number"], pr["baseRefName"]))
    print("Posting as: %s" % viewer)
    return (repo, pr), problems, warnings


def submit(repo, pr, event, summary, comments, draft):
    payload = {"commit_id": pr["headRefOid"], "body": summary, "comments": comments}
    if not draft:
        payload["event"] = event  # omitting it leaves the review PENDING
    code, out, err = run("gh", "api", "--method", "POST",
                         "repos/%s/pulls/%d/reviews" % (repo, pr["number"]),
                         "--input", "-", input_text=json.dumps(payload))
    if code != 0:
        sys.exit("error: GitHub rejected the review. Nothing was posted; do not retry "
                 "blindly.\n%s" % (err or out))
    data = json.loads(out)
    return data.get("html_url") or pr["url"], data.get("state")


# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("findings", nargs="?")
    parser.add_argument("--diff")
    parser.add_argument("--post", action="store_true")
    parser.add_argument("--draft", action="store_true")
    parser.add_argument("-h", "--help", action="store_true")
    args = parser.parse_args()

    if args.help or not args.findings or not args.diff:
        print(__doc__)
        return 0 if args.help else 1
    if args.post and args.draft:
        sys.exit("error: choose one of --post or --draft")

    with open(args.findings, encoding="utf-8") as fh:
        findings = json.load(fh)
    anchors, bases = load_anchors(args.diff)
    event, summary, comments, anchored, unanchored = build_review(findings, anchors)
    sending = args.post or args.draft

    ctx, problems, warnings = preflight(findings, bases, event, sending)

    counts = {s: 0 for s in SEVERITIES}
    for c, _ in anchored + unanchored:
        if c.get("severity") in counts:
            counts[c["severity"]] += 1
    print("Event:   %s%s" % (event, "  (as a PENDING draft)" if args.draft else ""))
    print("Counts:  " + "  ".join("%s %d" % (s, n) for s, n in counts.items() if n))
    print("Inline:  %d comment(s)" % len(comments))
    for c, _ in anchored:
        rng = ("%d-%d" % (c["start_line"], c["line"])) if "start_line" in c else str(c["line"])
        print("  [%-9s] %s:%s" % (c["severity"], c["path"], rng))
    if unanchored:
        print("Folded into the summary (could not anchor): %d" % len(unanchored))
        for c, err in unanchored:
            print("  %s:%s  — %s" % (c.get("path"), c.get("line"), err))
    print("\n--- summary ---\n%s\n---------------" % (summary or "(empty)"))

    if not summary and not comments:
        problems.append("the review is empty; say so and approve instead of posting nothing")
    if len(summary) > MAX_BODY or any(len(c["body"]) > MAX_BODY for c in comments):
        problems.append("a body is over GitHub's %d-character limit" % MAX_BODY)

    for w in warnings:
        print("warning: %s" % w)
    for p in problems:
        print("problem: %s" % p)

    if not sending:
        print("\nDry run: nothing was sent.")
        return 1 if problems else 0
    if problems:
        sys.exit("\nNot sent: fix the problems above first.")

    repo, pr = ctx
    url, state = submit(repo, pr, event, summary, comments, args.draft)
    print("\n%s: %s" % ("Draft created (only you can see it)" if state == "PENDING"
                        else "Review posted", url))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
