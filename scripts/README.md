# Script Recipes

This directory keeps daily automation small, explicit, and easy to copy into each game project.

## Mental Model

Scripts are layered by audience:

```text
npm scripts            stable commands people remember
scripts/run.sh         recipe router for daily workflows
focused leaf scripts   one script owns one service or job
scripts/lib/common.sh  shared output, help, and failure helpers
```

Keep `package.json` readable. If a command grows beyond a one-line alias, move the logic into a leaf script and expose it through `scripts/run.sh`.

## Current Recipes

| npm command | Recipe | Leaf script | Purpose |
| --- | --- | --- | --- |
| `npm run dev` | `up dev` | `scripts/dev.sh start dev` | Start the managed Vite dev server. |
| `npm run dev:status` | `status dev` | `scripts/dev.sh status dev` | Inspect pid, port, and current server state. |
| `npm run dev:stop` | `down dev` | `scripts/dev.sh stop dev` | Stop only this project's managed Vite process. |
| `npm run dev:restart` | `restart dev` | `scripts/dev.sh restart dev` | Stop then start the managed Vite process. |
| `npm run dev:logs` | `logs dev` | `scripts/dev.sh logs dev` | Follow `.run/dev.log`. |
| `npm run dev:raw` | none | Vite directly | Foreground fallback for debugging the scripts themselves. |

`dev` is intentionally fixed to `127.0.0.1:8080` with `--strictPort`. Port conflicts fail instead of silently changing URLs.

## Runtime Files

Managed runtime state belongs in `.run/`:

```text
.run/dev.pid
.run/dev.log
.run/dev.port
```

These files are ignored by git. A script may clean stale files only when it can prove they refer to this project or to a dead pid. If the owning command cannot be inspected, the script must not stop or clean anything.

## Adding A Recipe

Use this order:

1. Create a focused leaf script, for example `scripts/assets.sh`.
2. Source `scripts/lib/common.sh`.
3. Define a narrow command contract, for example `build assets`, `check assets`, `clean assets`.
4. Add a recipe branch to `scripts/run.sh`.
5. Add a short npm alias only if people should remember it.
6. Add a smoke test for `--help` and invalid arguments.

Example shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/assets.sh check assets
EOF
}
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `2` | Invalid arguments, unknown recipe, or runtime contract error. |
| other non-zero | Passed through from a leaf command or tool failure. |

Do not add silent fallback behavior. If a precondition is wrong, print the exact condition and fail.

## Boundaries

Keep these out of the default template unless a real game needs them:

- automatic port fallback
- multi-service orchestration
- Docker or remote deployment
- dependency installation inside scripts
- browser auto-open behavior
- release or portal upload logic rewritten in shell

The existing Node `.mjs` scripts already own build, bundle checks, archive creation, and Portal upload folder generation.
