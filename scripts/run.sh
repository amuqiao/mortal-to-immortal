#!/usr/bin/env bash
# Project recipe entrypoint. Add new recipes here, keep leaf scripts focused.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/run.sh up dev
  ./scripts/run.sh status dev
  ./scripts/run.sh down dev
  ./scripts/run.sh restart dev
  ./scripts/run.sh logs dev
  ./scripts/run.sh -h|--help

Scope:
  Stable daily recipe entrypoint. It delegates to focused scripts such as scripts/dev.sh.

Runtime files:
  .run/dev.pid
  .run/dev.log
  .run/dev.port

Exit codes:
  0  success
  2  invalid command, arguments, or recipe
  other non-zero codes are passed through from leaf scripts
EOF
}

command_usage() {
  local name="$1"
  case "$name" in
    up|status|down|restart|logs)
      cat <<EOF
Usage:
  ./scripts/run.sh ${name} dev
  ./scripts/run.sh ${name} -h|--help

Exit codes:
  0  success
  2  invalid arguments or recipe
  other non-zero codes are passed through from leaf scripts
EOF
      ;;
    *)
      usage >&2
      return 2
      ;;
  esac
}

run_dev_up() {
  event "RUN" "dev" "start"
  "$ROOT_DIR/scripts/dev.sh" start dev
}

run_dev_status() {
  event "CHECK" "dev" "status"
  "$ROOT_DIR/scripts/dev.sh" status dev
}

run_dev_down() {
  event "RUN" "dev" "stop"
  "$ROOT_DIR/scripts/dev.sh" stop dev
}

run_dev_restart() {
  run_dev_down
  run_dev_up
}

run_dev_logs() {
  event "TAIL" "dev" "logs"
  "$ROOT_DIR/scripts/dev.sh" logs dev
}

command="${1:-}"
case "$command" in
  --help|-h|help)
    usage
    ;;
  "")
    usage >&2
    exit 2
    ;;
  up|down|status|restart|logs)
    action="$command"
    shift
    if args_include_help "$@"; then command_usage "$action"; exit $?; fi
    recipe="${1:-}"
    [[ -n "$recipe" ]] || die "usage: ./scripts/run.sh $action dev" 2
    shift
    [[ "$#" -eq 0 ]] || die "usage: ./scripts/run.sh $action $recipe" 2
    case "$action:$recipe" in
      up:dev) run_dev_up ;;
      down:dev) run_dev_down ;;
      status:dev) run_dev_status ;;
      restart:dev) run_dev_restart ;;
      logs:dev) run_dev_logs ;;
      *) die "unknown run recipe for $action: $recipe" 2 ;;
    esac
    ;;
  *)
    usage >&2
    die "unknown command: $command" 2
    ;;
esac
