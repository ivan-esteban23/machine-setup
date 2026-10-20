# machine-setup

Recovery kit for this Omarchy machine: agent rules, Instagram download timers, system update checks, mobile remote-control units, personal desktop/tool config, the Omarchy Tailscale feature, the full pacman/AUR package set, Obsidian community plugins, and the Codex sandbox/GitHub fixes that let `git push` and `gh pr create` complete.

Everything is in **`agent-rules-setup`** — one idempotent, self-contained bash script. `snapshot/` holds machine-specific extras (tool configs, package lists, Obsidian plugins, git identity).

Print the full reinstall runbook at any time:

```bash
agent-rules-setup --restore-guide
```

## What `--bootstrap` restores

- Rule files: `~/AGENTS.md`, `~/GEMINI.md`, `~/.gemini/config/AGENTS.md`, `~/.qoder/AGENTS.md`, `~/.codex/AGENTS.md`
- Tools: `ig-download`, `download-monitor`, `pdm-clara-autodl`, `system-update-check`, `codex-git`, `obsidian` CLI bridge, `wireguard-jp-toggle`, the `gh` wrapper that survives the read-only Codex sandbox, and mise wrappers (`claude`, `codex`, `gemini`, `grok`, `copilot`, `crush`, `opencode`, `pi`, `muse`, `cursor-agent`, `hunk`, `omp`, `ghui`, `playwright`)
- systemd user timers (enabled + linger):
  - `pdm-clara-autodl.timer` — hourly, images only
  - `julie-autodl.timer` — hourly, images only
  - `system-update-check.timer` — every 3 hours, calendar-based
- systemd user services (enabled):
  - `codex-remote-control.service` — Codex mobile/browser access
  - `qoder-remote-control.service` — Qoder mobile/browser access
  - `gh-wrapper-watch.path` — restores the sandbox-safe `gh` wrapper whenever `omarchy-refresh-applications` rewrites it
  - `gh-wrapper-repair.service` — oneshot worker started by that path
- Codex: default sandbox stays `read-only`; `[sandbox_workspace_write] network_access = true`
- mise global tool set from `snapshot/mise-config.toml`
- `free-claude-code` via `uv tool install` when `uv` is available
- git identity / signing settings and `allowed_signers` from the snapshot
- personal config from `snapshot/config/` (only files that are missing): git aliases/ignore, starship, alacritty, Hypr bindings, Omarchy bar layout, fcitx5 profile + tray drop-in, GTK_IM_MODULE, Obsidian vault registry, VS Code settings, Qoder settings, Claude theme
- mise config, codex config and SSH `allowed_signers` from the snapshot. Plain `agent-rules-setup` (no `--bootstrap`) creates them only when missing and keeps a differing local copy; `--bootstrap` restores the snapshot copy
- Omarchy Tailscale feature: `tailscale` package, `tailscaled`, operator, Taildrop receive service, bar widget (browser login stays manual)
- SSH access: `openssh`, `sshd` enabled, `ufw limit 22/tcp` staged (the firewall itself stays off so LAN services keep working). `.ssh` is kept at 700 and `authorized_keys` at 600 (`sshd` StrictModes otherwise rejects the key). Password auth is turned off only once `authorized_keys` holds a key whose material validates with `ssh-keygen -lf`; pass `--ssh-key=<file.pub>` to add the phone's key in the same run. The hardening reverts if no valid key remains, and after reloading the effective `sshd -T` is re-probed (a drop-in that still enables passwords is reported as drift)
- Qoder CLI (`qodercli`) and Antigravity CLI (`agy`) when missing
- all 30 Obsidian community plugins + their settings from `snapshot/obsidian/` (restored once the vault exists)
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
./agent-rules-setup --ssh-key=~/phone.pub        # authorize a key, then require key-only SSH
```

Reinstall the full package set at any time (repo packages via pacman, AUR via yay; names not in a configured repo are listed and skipped):

```bash
agent-rules-setup --install-packages
agent-rules-setup --check --install-packages     # report only
```

Then finish the interactive logins:

```bash
gh auth setup-git
codex login
sudo tailscale up --accept-routes     # browser auth; daemon + bar widget already set up
```

For Instagram, log into instagram.com in Firefox and prime the saved session once:

```bash
ig-download pdm.clara --new-only --cookies firefox
```

The hourly timers reuse that saved session afterwards. (Both Instagram timers share session `ivan_esteban23`, so their hits add up against the same rate limit.) When Instagram rate-limits the session, `agent-rules-setup --pause-ig` skips the downloads while leaving the timers enabled; `--resume-ig` clears the pause. `--check` reports the pause as a note, not drift.

Verify:

```bash
agent-rules-setup --check
agent-rules-setup --smoke
```

`--smoke` applies everything first, then starts a real Codex sandbox and checks DNS, `gh` API access, `git ls-remote`, and SSH commit signing.

Sidecar tools:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # uv / uvx
uv tool install free-claude-code                  # fcc-*
# qodercli and agy (Antigravity) are installed automatically by agent-rules-setup
# reason: vendor installer only
sudo cp wg-JP-446.conf /etc/wireguard/            # from secure backup
sudo systemctl enable --now wg-quick@wg-JP-446
```

Obsidian plugins (30, with settings) are restored automatically into
`~/Documents/Obsidian Vault/.obsidian/plugins` and merged into
`community-plugins.json`. If the vault is copied after the first bootstrap run,
run `agent-rules-setup` again; plugin `data.json` files containing token-like
values are deliberately not snapshotted.

## NOT in this repo

Never commit these; restore them from your secure backup:

| Path | Why |
|---|---|
| `~/.ssh/` | private commit-signing key + `allowed_signers` |
| `~/.codex/auth.json` | Codex login |
| `~/.config/gh/hosts.yml` | gh token |
| `~/.config/instaloader/session-*` | Instagram session |
| `~/.secrets/github-token` | local token copy |
| `~/.fcc/.env` | free-claude-code credentials |
| `~/.bashrc` | contains `TAVILY_API_KEY` |
| `/etc/wireguard/wg-JP-446.conf` | VPN private key (root-owned) |
| `~/Downloads` | Instagram archives |
| `~/Work`, `~/Documents/Obsidian Vault` | personal data (only the plugin folders are in `snapshot/obsidian/`) |
| `~/Pictures`, `~/Videos` | personal media |

If the signing key is missing, bootstrap turns `commit.gpgsign` off and prints instructions. Do not regenerate it unless you register the new public key as a GitHub signing key.

## Before wiping the disk

```bash
cd ~/Work/machine-setup
./agent-rules-setup --pre-reset     # snapshot + commit + push + full runbook
```

Then back up separately:

- `~/Downloads` (Instagram archives), `~/Work`, `~/Documents/Obsidian Vault`, `~/Pictures`, `~/Videos`
- `~/.ssh` (including the private signing key)
- `~/.codex/auth.json`
- `~/.config/gh/hosts.yml`
- `~/.config/instaloader/session-*`
- `~/.secrets/github-token`, `~/.fcc/.env`, `~/.bashrc` (Tavily key)
- `/etc/wireguard/wg-JP-446.conf`
- anything else in `$HOME` not covered by the snapshot

## Day-to-day

```bash
agent-rules-setup                 # apply / repair everything (safe to re-run)
agent-rules-setup --check         # report drift only; exit 1 if anything is off
agent-rules-setup --lint          # bash -n + shellcheck (warnings) on the script
agent-rules-setup --smoke         # apply, then real Codex sandbox git/gh/signing test
agent-rules-setup --install-packages  # reinstall every snapshotted pacman + AUR package
agent-rules-setup --restore-guide # full reinstall runbook
agent-rules-setup --snapshot --push  # refresh snapshot/ and push it
agent-rules-setup --pause-ig      # skip hourly Instagram downloads (timers stay enabled)
agent-rules-setup --resume-ig     # clear the pause marker
```

Exit codes: `0` everything in place, `1` drift/problems remain, `2` invalid flag combination (for example `--check --snapshot`, `--pause-ig --resume-ig`, or `--push` without `--snapshot`).

`--check` is read-only: it performs no writes, no `mkdir`, no `chmod` and no network calls. It may run non-mutating `sudo` probes (`sshd -T`, `ufw show added`, file tests). A second plain apply reports `apply: 0 change(s)`.

`--no-enable` installs files but leaves every service alone: user units/timers, `sshd`, `tailscaled`, Taildrop, the Tailscale operator and linger.

The Instagram pause is a marker file (`~/.local/state/instagram-paused`) checked by both download services, so the timers keep their schedule and a normal apply cannot silently resume the downloads. Remove the marker with `--resume-ig`.

## Snapshot hygiene

`--snapshot` (often via `--pre-reset`) keeps the repo truthful:

- personal configs under `snapshot/config/` that are no longer in the manifest are deleted, so deleted configs cannot resurrect;
- Obsidian plugin folders that no longer exist in the vault are pruned, but only when the vault is present and readable and at least one plugin was scanned (a detached vault never wipes the snapshot);
- any file matching a token pattern — `ghp_`/`github_pat_`, `sk-…` (`sk-proj-`, `sk-ant-`), `AIza…`, `xox…`, `tvly-…`, AWS `AKIA`/`ASIA`, private keys, or `KEY|TOKEN|SECRET=…` assignments — is skipped, including the mise and codex configs (stored mode 600);
- package lists are written to temp files and moved only on success, so a failed `pacman` query cannot truncate them;
- `--push` stages and commits only `agent-rules-setup`, `snapshot/` and `README.md` (pathspec), so unrelated staged files stay out of the snapshot commit.

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
