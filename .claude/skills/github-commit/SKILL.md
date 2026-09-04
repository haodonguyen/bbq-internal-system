---
name: github-commit
description: Ship a bug fix or a new feature as a branch, commits and a pull request. Use whenever a change to this repo is finished and needs to land — fixing a bug, adding a feature, or any edit that would otherwise be committed to main. Covers branch naming, commit messages, the PR description, and the venue-isolation checks this repo requires before review.
---

# Shipping a change

Every bug fix and every feature lands through a pull request. Nothing is committed
straight to `main`.

## 1. Check what you are working with

```bash
git status
git branch --show-current
```

If you are on `main` with uncommitted work, branch first — the changes come with
you:

```bash
git checkout -b <branch>
```

If you are already on a feature branch for this same piece of work, stay on it.

## 2. Name the branch

`<type>/<short-kebab-summary>` — under about 50 characters.

| Type | For |
|---|---|
| `fix/` | a bug |
| `feat/` | new behaviour |
| `refactor/` | restructuring with no behaviour change |
| `chore/` | dependencies, config, tooling |
| `docs/` | documentation only |

Say what changed, not where: `fix/photo-visible-across-venues`, not `fix/bug`.

## 3. Verify before committing

Both packages must typecheck and the web build must pass:

```bash
cd api && npx tsc --noEmit
cd ../web && npx tsc --noEmit && npm run build
```

**If the change touches issue reads, scoping, assignment or attachments, re-run the
venue-isolation checks in `README.md` and paste the output into the PR.** This
repo's whole reason to exist is that one venue cannot see another's issues, there
is no automated suite guarding it, and a regression is silent. A change here is not
finished until that has been demonstrated, not asserted.

Never commit `.env`, `node_modules/`, `dist/`, `.next/`, or anything under an
uploads directory.

## 4. Commit

Small, coherent commits. Each one should leave the stack running.

Subject line: imperative mood, no trailing full stop, under 72 characters.

```
Reject cross-venue assignees on issue update
```

Add a body when the reason is not obvious from the diff — what was wrong, and why
this fix rather than another. Wrap at 72 columns.

End every commit message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

```bash
git add <specific paths>
git commit -m "$(cat <<'EOF'
Reject cross-venue assignees on issue update

PATCH /issues/:id validated the assignee only on create, so an issue
could be reassigned to another venue's staff after the fact. Moved the
check into a shared assertAssignable() used by both paths.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

Prefer `git add` with explicit paths over `git add -A`, so nothing unrelated is
swept in.

## 5. Push and open the PR

```bash
git push -u origin <branch>

gh pr create --title "<same style as the commit subject>" --body "$(cat <<'EOF'
## What

One or two sentences on the change.

## Why

The bug's symptom, or the need the feature meets. Link the issue if there is one.

## How

Anything a reviewer would not infer from the diff — a trade-off taken, an approach
rejected, a constraint that forced the shape.

## Verification

What you actually ran, with output. Include the venue-isolation checks when the
change touches issue reads, scoping, assignment or attachments.

## Notes

Follow-ups, known gaps, anything deliberately left out.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then give the user the PR URL.

## Rules

- **Ask before pushing** unless the user has already said to ship it. Pushing is
  outward-facing and hard to walk back.
- **Never force-push a shared branch**, and never `git push --force` to `main`.
- **Never commit or push directly to `main`.**
- **Do not commit secrets.** If one has already been committed, say so plainly —
  rotating the credential matters more than rewriting the history.
- **Report honestly.** If a check failed or you skipped one, the PR says so. A
  green-looking PR over a failing build costs a reviewer more than an honest one.
