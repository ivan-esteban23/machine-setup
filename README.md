# machine-setup

Recovery kit for this Omarchy machine: agent rules, Instagram download timers, system update checks, and the Codex sandbox/GitHub fixes that let `git push` and `gh pr create` complete.

Everything is in **`agent-rules-setup`** — one idempotent, self-contained bash script. `snapshot/` holds machine-specific extras (tool configs, package lists, git identity).

## What `--bootstrap` restores

- Rule files: `~/AGENTS.md`, `~/.qoder/AGENTS.md`, `~/.codex/AGENTS.md`
- Tools: `ig-download`, `download-monitor`, `pdm-clara-autodl`, `system-update-check`, `codex-git`, and a `gh` wrapper that survives the read-only Codex sandbox
- systemd user timers (enabled + linger):
  - `pdm-clara-autodl.timer` — hourly, images only
  - `julie-autodl.timer` — hourly, images only
  - `system-update-check.timer` — every 3 hours, calendar-based
- Codex: default sandbox stays `read-only`; `[sandbox_workspace_write] network_access = true`
- mise global tool set from `snapshot/mise-config.toml`
- git identity / signing settings and `allowed_signers` from the snapshot
- `~/.local/bin` on `PATH` in `.bash_profile` and `.bashrc`
- optional: the snapshotted pacman + AUR package lists (`--with-packages`)

Omarchy already provides **mise**, git, yay, and systemd, so they are not reinstalled. `gh` and `codex` are mise tools.

## After a fresh Omarchy install

This repo is **private**, so authenticate before cloning:

```bash
mise use -g gh
gh auth login
mkdir -p ~/Work
gh repo clone ivan-esteban23/machine-setup ~/Work/machine-setup
cd ~/Work/machine-setup
./agent-rules-setup --bootstrap
```

Optional variants:

```bash
./agent-rules-setup --bootstrap --minimal        # only gh + codex (skip the full mise set)
./agent-rules-setup --bootstrap --with-packages  # also reinstall pacman + AUR snapshots
```

Then finish the interactive logins:

```bash
gh auth setup-git
codex login
```

For Instagram, log into instagram.com in Firefox and prime the saved session once:

```bash
ig-download pdm.clara --new-only --cookies firefox
```

The hourly timers reuse that saved session afterwards. (Both Instagram timers share session `ivan_esteban23`, so their hits add up against the same rate limit.)

Verify:

```bash
agent-rules-setup --check
agent-rules-setup --smoke
```

`--smoke` starts a real Codex sandbox and checks DNS, `gh` API access, `git ls-remote`, and SSH commit signing.

## NOT in this repo

Never commit these; restore them from your secure backup:

| Path | Why |
|---|---|
| `~/.ssh/id_ed25519_signing` | private commit-signing key |
| `~/.codex/auth.json` | Codex login |
| `~/.config/instaloader/session-*` | Instagram session |
| `~/Downloads` | Instagram archives |
| `~/Work`, `~/Documents/Obsidian Vault` | personal data |

If the signing key is missing, bootstrap leaves `commit.gpgsign` off and prints instructions. Do not regenerate it unless you register the new public key as a GitHub signing key.

## Before wiping the disk

```bash
cd ~/Work/machine-setup
./agent-rules-setup --snapshot --push
```

Then back up separately:

- `~/Downloads` (Instagram archives), `~/Work`, `~/Documents/Obsidian Vault`
- `~/.ssh` (including the private signing key)
- `~/.codex/auth.json`
- `~/.config/instaloader/session-*`
- anything else in `$HOME` not covered by the snapshot

## Day-to-day

```bash
agent-rules-setup            # apply / repair everything (safe to re-run)
agent-rules-setup --check    # report drift only, exit 1 if anything is off
agent-rules-setup --smoke    # real Codex sandbox git/gh/signing test
```

## Why Codex PRs used to fail

1. The default sandbox is `read-only` with no network → no DNS, so `gh` and `git push` could not reach GitHub.
2. No `GH_TOKEN` inside the sandbox → `gh` treated the keyring token as invalid.
3. Login shells re-prepend `~/.local/bin`, so `gh` hit the auto-update wrapper, which runs `mise use -g` and exits on the read-only filesystem.

Fixes: `codex-git` runs `workspace-write` + network + `GH_TOKEN` + mise shims, and the `gh` wrapper falls back to the installed shim when `mise use` cannot write. The Codex config enables network for workspace-write while keeping read-only as the default.

## Visibility

The repo is private because it describes this machine. To restore without GitHub auth, either copy this directory to a USB stick or make the repo public:

```bash
gh repo edit ivan-esteban23/machine-setup --visibility public
```
