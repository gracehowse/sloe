# Git hooks — install + maintenance

**Owner:** Grace
**Status:** required per clone
**Last updated:** 2026-05-14 (Soft spot 7 of the 2026-05-14 production-readiness audit)

Suppr's git hooks live under `scripts/git-hooks/` rather than `.git/hooks/` so they can be committed to the repo. Every new clone (any machine, any contributor) must point git at this directory once:

```sh
git config core.hooksPath scripts/git-hooks
```

That single command activates every hook in the directory. There is no per-hook setup.

---

## Installed hooks

| Hook | Purpose | Time budget |
|---|---|---|
| [`prepare-commit-msg`](../../scripts/git-hooks/prepare-commit-msg) | Strips tool-injected footers (e.g. `Made-with: Cursor`) before the message is finalised. | <50ms |
| [`pre-commit`](../../scripts/git-hooks/pre-commit) | Runs `gitleaks protect --staged` to block secrets from being committed locally (matches the CI `secret-scan` job). | ~1–3s |
| [`pre-push`](../../scripts/git-hooks/pre-push) | Fast gate: migration filename check + typecheck + lint. Catches the most common foot-guns before CI. | ~10–20s on warm cache |

---

## `pre-commit` — gitleaks scan

The `pre-commit` hook runs:

```sh
gitleaks protect --staged --no-banner
```

**Behaviour:**
- Scans only **staged** changes (not the full repo), so it's fast.
- Uses gitleaks' default rules (AWS keys, GitHub tokens, Stripe keys, generic high-entropy strings, etc.). No custom rules — defaults are the first-pass guard.
- Exits non-zero on any finding, blocking the commit.

**Installing gitleaks:**

```sh
brew install gitleaks
# or via npm:
npm install --global gitleaks
```

If `gitleaks` is not on PATH, the hook **warns and continues** (it does not block the commit). Rationale: a stale machine without the tool shouldn't be locked out of committing, especially on hotfix days. CI's `secret-scan` job (`.github/workflows/ci.yml`) catches anything the local hook misses — the hook is the fast-fail, CI is the floor.

**If the hook blocks a commit:**

1. Read the finding. Confirm it's a real secret (not a config example, not a test fixture).
2. **If real:** remove the secret from the file, rotate the secret with the vendor (Supabase, Stripe, RevenueCat, etc.), and commit again. Never commit "I'll rotate later."
3. **If false positive:** add the file/path to `.gitleaksignore` at the repo root with a comment explaining why. **Do not edit `gitleaks` rules** — defaults are the contract.
4. To bypass once (emergency): `git commit --no-verify`. Document the bypass in the commit message.

---

## `pre-push` — typecheck + lint + migration check

Documented in the hook file itself ([`scripts/git-hooks/pre-push`](../../scripts/git-hooks/pre-push)). Bypass: `git push --no-verify`.

---

## CI mirror

Every hook above has a CI mirror, so contributors who skip the hook setup still hit the gate before merge:

| Local hook | CI mirror | Job in `.github/workflows/ci.yml` |
|---|---|---|
| `pre-commit` gitleaks | gitleaks on the diff | `secret-scan` |
| `pre-push` typecheck | full `npm run typecheck` | `test` |
| `pre-push` lint | full `npm run lint` | `test` |
| `pre-push` migration check | static migration check | `test` |

CI does not replace the local hook — it is slower (90+ seconds vs <20s) and burns Actions minutes. Local hooks are the cheap-fast layer.

---

## Adding a new hook

1. Add the hook file under `scripts/git-hooks/<hook-name>`.
2. `chmod +x scripts/git-hooks/<hook-name>`.
3. Append a row to the table at the top of this file.
4. If the hook should have a CI mirror, add the matching job to `.github/workflows/ci.yml` and update the CI-mirror table.

## Related

- [`scripts/git-hooks/`](../../scripts/git-hooks/) — hook source
- CI workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- Auto-push safety net: [`scripts/auto-push-on-stop.sh`](../../scripts/auto-push-on-stop.sh) — runs at end of Claude turn; not a git hook, lives outside this set
