---
name: pr-review
description: "Review a diff chunk-by-chunk and post the findings to the pull request as inline comments. Collects the diff with scripts/git-diff.py (annotated `git diff` chunks under tmp/diff-<branch>/), reviews the added lines against the surrounding codebase, and submits one GitHub review via scripts/post-review.py. Use when: reviewing a PR, commenting on a PR, pre-merge review, diff review, checking what a branch adds."
argument-hint: "<target-branch> [--pr <number>]"
allowed-tools: Bash, Read, Grep, Glob
---

# PR Review Skill

Turn a diff into a small number of specific, actionable comments on the pull
request. The unit of work is the **added line** — what it does, and how it
interacts with code it did not change.

## When to Use This Skill

- Reviewing a pull request before merge
- Reviewing what the current branch adds against its base
- Producing inline PR comments rather than a wall of prose
- Re-reviewing after a push, commenting only on what changed since

## Pipeline

```bash
S=.claude/skills/pr-review/scripts

# 0. if reviewing someone else's PR, check it out first
gh pr checkout 42
gh pr view --json number,title,body,baseRefName

# 1. collect against the PR's own base (baseRefName above), not always main
#    writes tmp/diff-<base>/chunk-01.diff, chunk-02.diff, ...
python3 $S/git-diff.py <base>

# 2. read each chunk in order, open the files it touches, write tmp/findings.json

# 3. validate the anchors (dry run — sends nothing)
python3 $S/post-review.py tmp/findings.json --diff tmp/diff-<base>

# 4. only after the user confirms, submit — or --draft for a pending review
python3 $S/post-review.py tmp/findings.json --diff tmp/diff-<base> --post
```

**Stacked pull requests:** when PRs are stacked, a PR's base is the branch
below it, not `main`. Diffing against `main` pulls in every PR beneath it, and
comments on those lines cannot land. `post-review.py` checks the chunks'
base against the PR's and refuses to send if they differ. `tmp/` is
gitignored, so chunks and findings never end up in a commit.

`git-diff.py <target-branch>` diffs `HEAD` against the **merge base** with that
branch, so you see what the branch adds and not what the base moved on to.
Options: `--chunk-size` (files per chunk, default 5), `--context` (default 3),
`--no-merge-base` for a two-dot diff, `--stdout` to skip the chunk files,
`--out` for a different output root, `--ignore-file` for a non-default ignore
file.

## Step 1 — Collect and Orient

Run `git-diff.py`, then read the chunks in order. Each chunk carries a header
naming its base commit and files. Every hunk line is annotated with its line
number **in the new file** — GitHub's RIGHT side:

```
@@ -10,7 +10,9 @@
    10 |   unchanged context line
       | - line present in the old file only (deleted)
    11 | + line present in the new file only (added)
    12 |   unchanged context line
```

**That first column is the number you put in `line` / `start_line`.** Never
count lines yourself; a number the API cannot resolve is a comment that never
lands. Deleted lines have no number — they exist only on the LEFT side and
cannot be commented on with this format. To raise a point about removed code,
anchor it to a nearby added or context line.

Before judging anything:

- Read the PR title and body (`gh pr view`) for the stated intent.
- Note the shape of the change: how many chunks, which layers, one concern or
  several.
- Paths matching `.skill-ignore` at the repo root (gitignore syntax) are already
  excluded — lockfiles, generated bundles, snapshots. Add to that file rather
  than skipping noise by hand.

## Step 2 — Read Each File in Context

A diff hides the half of the story that matters. For each changed file:

1. Open the file itself, not only the hunk. Added code is judged against the
   conventions of the file it lands in.
2. Grep for callers of anything whose signature, return type, or error behavior
   changed.
3. Ask what the added lines assume — about nullability, ordering, concurrency,
   input trust, and how much data arrives.

Anything you cannot verify by reading is a **question**, not a finding.

## Step 3 — Review Dimensions

Pass over every chunk with these five lenses. Order matters: correctness issues
outrank style ones, and a review that leads with naming has buried the point.

### Correctness
- Off-by-one, boundary, and empty-collection handling
- Null/undefined paths the new code introduces
- Error handling: swallowed exceptions, unchecked returns, partial failure
- Concurrency: shared mutable state, races, missing awaits
- Does the change actually do what the PR says it does

### Security
- Untrusted input reaching a query, command, path, template, or deserializer
- AuthN/AuthZ checks on new endpoints and new branches through old ones
- Secrets, tokens, or personal data in code, logs, or error messages
- New dependencies and what they pull in

### Performance
- N+1 queries and per-item network calls in loops
- Work in a hot path that could be hoisted, cached, or batched
- Unbounded growth: reads with no limit, collections that never evict

### Design and Maintainability
- Does this belong here — right layer, right module
- Duplication of something the codebase already provides (grep before claiming it)
- Coupling introduced across boundaries that were previously clean
- Naming that misleads about what the value is or does

### Tests
- Is the new behavior covered, including the failure path
- Do the tests assert behavior rather than restate the implementation
- Would they fail if the change were reverted

## Step 4 — Write the Comments

**Severity** — every finding carries one:

| Severity | Means | Example |
|---|---|---|
| `blocking` | Must change before merge: bug, vulnerability, data loss | unvalidated input reaching a query |
| `important` | Should change; merging as-is takes on real debt | missing error path on a new network call |
| `nit` | Optional polish; author may decline freely | naming, ordering, phrasing |
| `question` | You could not determine intent from the diff | "is this called concurrently?" |
| `praise` | A genuinely good decision worth reinforcing | a sharp edge case handled well |

**Craft rules:**

- Comment on the code, never the author. "This retries forever on 4xx", not
  "you forgot".
- One point per comment, anchored to the line it concerns.
- Say the consequence, not just the rule: name the input or state that breaks it.
- Offer the fix when you know it — a two-line suggestion beats a paragraph.
- Prefer a `question` over an accusation when the diff does not show enough.
- Cap the review at roughly 15 inline comments. Beyond that, fold the repetitive
  ones into a single summary point ("same pattern at L40, L78, L92") — a review
  nobody can act on is a review nobody acts on.
- Never post an empty review. If nothing is wrong, say so and approve.

**Findings document** (`findings.json`):

```json
{
  "repo": "owner/name",
  "pr": 42,
  "event": "COMMENT",
  "summary": "### Review summary\n\nWhat the PR does, then the 2-3 themes that matter.\n\n**Blocking:** 1  ·  **Important:** 2  ·  **Nits:** 3",
  "comments": [
    {
      "path": "src/api/users.py",
      "line": 88,
      "severity": "blocking",
      "body": "`user_id` comes straight from the query string into the SQL string, so `?user_id=1 OR 1=1` returns every row. Use a bound parameter:\n\n```suggestion\n    cursor.execute(\"SELECT * FROM users WHERE id = %s\", (user_id,))\n```"
    }
  ]
}
```

- `line` is the annotated gutter number from the chunk. Add `start_line` for a
  multi-line range; it must also be an annotated line.
- `post-review.py` rejects any anchor that is not in the chunks and folds the
  finding into the summary rather than failing the submit — so nothing is lost,
  but check the dry run and re-anchor what you can.
- ```` ```suggestion ```` blocks give the author a one-click apply — use them for
  any fix short enough to write out. Indent the suggestion exactly as the final
  file should read.

**Choosing `event`:** default to `COMMENT`. Use `REQUEST_CHANGES` only when a
`blocking` finding exists and the user asked for a verdict; use `APPROVE` only on
explicit instruction — never approve on the author's behalf by default.

## Step 5 — Post

Posting is outward-facing and visible to everyone on the PR. The review is
submitted as whichever account `gh` is logged in as — it appears under the
user's name, not the agent's.

**The user's own PR:** GitHub only accepts `COMMENT` from a PR's author;
`APPROVE` and `REQUEST_CHANGES` are rejected, and `post-review.py` refuses
them before sending.

**`--draft` instead of `--post`:** creates the review as PENDING, visible only
to its author. The user reads it in the PR's "Files changed" tab, edits or
deletes individual comments, and submits it themselves. Offer this when they
want to see the comments in place before anything is public.

1. Always run the dry run first and show the user the summary, the comment count,
   and anything that failed to anchor.
2. Ask for explicit confirmation before adding `--post`. Confirmation for one
   review does not carry to the next.
3. `--post` and `--draft` submit exactly once. If it fails, fix the findings file and re-run;
   do not retry blindly, since a partial success would double-post.
4. Report the returned review URL.

## Re-reviewing After a Push

Diff only what is new since your last pass, so you do not repeat yourself:

```bash
python3 $S/git-diff.py <sha-you-last-reviewed> --no-merge-base --out tmp/since
```

Note in the summary which earlier findings the new commits addressed.

## Anti-Patterns

| Do not | Do instead |
|---|---|
| Count diff lines yourself | Use the annotated gutter number |
| Restate the diff back as a comment | Say what breaks and when |
| Post 40 nits | Post the 3 that matter, group the rest |
| Block on style | Style is a `nit`, or belongs in the linter |
| Guess at intent and assert it | Ask a `question` |
| Claim duplication from memory | `grep` for the existing helper first |
| Post without confirmation | Dry run, show, ask, then post |
