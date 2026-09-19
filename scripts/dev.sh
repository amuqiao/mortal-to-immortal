#!/usr/bin/env bash
# Manage this project's single Vite development server.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/dev.pid"
LOG_FILE="$RUN_DIR/dev.log"
PORT_FILE="$RUN_DIR/dev.port"
VITE_BIN="$ROOT_DIR/node_modules/vite/bin/vite.js"
VITE_CONFIG="$ROOT_DIR/vite/config.dev.mjs"
HOST="127.0.0.1"
PORT="8080"
URL="http://$HOST:$PORT/"
PORT_PID_RESULT=""

usage() {
  cat <<'EOF'
Usage:
  ./scripts/dev.sh start dev
  ./scripts/dev.sh status dev
  ./scripts/dev.sh stop dev
  ./scripts/dev.sh restart dev
  ./scripts/dev.sh logs dev
  ./scripts/dev.sh -h|--help

Scope:
  Manages only this project's Vite dev server.

Runtime files:
  .run/dev.pid
  .run/dev.log
  .run/dev.port

Rules:
  Fixed host/port: 127.0.0.1:8080 with --strictPort.
  If 8080 is occupied, startup fails instead of drifting to another port.
  stop kills only a process that can be proven to be this project's Vite command.
  If the pid file is missing, stop may clean up an orphan that matches this project.

Exit codes:
  0  success
  2  invalid arguments or runtime state
  other non-zero codes are passed through from underlying commands
EOF
}

ensure_run_dir() {
  mkdir -p "$RUN_DIR"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1" 2
}

write_port_file() {
  printf '%s\n' "$PORT" > "$PORT_FILE"
}

read_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(<"$PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ ]] || die "invalid pid file: $PID_FILE" 2
  printf '%s' "$pid"
}

is_running() {
  kill -0 "$1" 2>/dev/null
}

command_for_pid() {
  local pid="$1"
  local command=""
  command="$(ps -p "$pid" -o command= 2>/dev/null)" || return 1
  [[ -n "$command" ]] || return 1
  printf '%s' "$command"
}

is_managed_command() {
  local command="$1"
  [[ "$command" == *"$VITE_BIN"* && "$command" == *"$VITE_CONFIG"* ]]
}

load_port_pid() {
  require_command lsof

  local output=""
  local status=0
  set +e
  output="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    PORT_PID_RESULT="${output%%$'\n'*}"
    return 0
  fi

  if [[ "$status" -eq 1 && -z "$output" ]]; then
    PORT_PID_RESULT=""
    return 0
  fi

  die "lsof failed for port $PORT: $output" 2
}

assert_managed_pid() {
  local pid="$1"
  local command
  command="$(command_for_pid "$pid")" || die "cannot inspect command for pid $pid" 2
  is_managed_command "$command" || die "pid $pid is not this project's Vite dev server: $command" 2
}

wait_for_stop() {
  local pid="$1"
  for _ in {1..50}; do
    if ! is_running "$pid"; then
      return 0
    fi
    sleep 0.1
  done

  die "pid $pid did not stop in time; inspect $LOG_FILE" 1
}

start_dev() {
  section "Dev Server"
  ensure_run_dir
  write_port_file

  local existing_pid=""
  if existing_pid="$(read_pid)"; then
    if is_running "$existing_pid"; then
      local command
      command="$(command_for_pid "$existing_pid")" || die "cannot inspect command for pid $existing_pid; not starting over it" 2
      if is_managed_command "$command"; then
        event "OK" "dev" "already running: $URL (pid $existing_pid)"
        event "LOG" "dev" "$LOG_FILE"
        return 0
      fi
      event "CLEAN" "dev" "removing stale pid file for external pid $existing_pid"
      rm -f "$PID_FILE"
    else
      event "CLEAN" "dev" "removing stale pid file: $PID_FILE"
      rm -f "$PID_FILE"
    fi
  fi

  load_port_pid
  [[ -z "$PORT_PID_RESULT" ]] || die "port $PORT is already used by pid $PORT_PID_RESULT" 2

  : > "$LOG_FILE"
  nohup bash -c 'cd "$1" && exec node "$2" --config "$3" --host "$4" --port "$5" --strictPort' \
    bash "$ROOT_DIR" "$VITE_BIN" "$VITE_CONFIG" "$HOST" "$PORT" > "$LOG_FILE" 2>&1 < /dev/null &
  printf '%s' "$!" > "$PID_FILE"

  local pid
  local stable_checks=0
  pid="$(read_pid)"
  for _ in {1..30}; do
    load_port_pid
    if [[ "$PORT_PID_RESULT" == "$pid" ]]; then
      stable_checks=$((stable_checks + 1))
      if [[ "$stable_checks" -ge 3 ]]; then
        event "OK" "dev" "running: $URL (pid $pid)"
        event "LOG" "dev" "$LOG_FILE"
        return 0
      fi
    else
      stable_checks=0
    fi
    if ! is_running "$pid"; then
      event "FAIL" "dev" "process exited during startup"
      rm -f "$PID_FILE"
      tail -n 40 "$LOG_FILE" >&2
      exit 1
    fi
    sleep 0.2
  done

  event "FAIL" "dev" "startup timed out"
  if is_running "$pid"; then
    assert_managed_pid "$pid"
    kill "$pid"
  fi
  rm -f "$PID_FILE"
  tail -n 40 "$LOG_FILE" >&2
  exit 1
}

status_dev() {
  section "Dev Server"
  event "RUN" "dir" "$RUN_DIR"
  event "PORT" "dev" "$PORT"
  event "LOG" "dev" "$LOG_FILE"

  local pid=""
  if ! pid="$(read_pid)"; then
    load_port_pid
    if [[ -n "$PORT_PID_RESULT" ]]; then
      local command
      if command="$(command_for_pid "$PORT_PID_RESULT")" && is_managed_command "$command"; then
        event "ORPHAN" "dev" "running without pid file: $URL (pid $PORT_PID_RESULT)"
      elif [[ -n "${command:-}" ]]; then
        event "FOREIGN" "dev" "port $PORT is used by pid $PORT_PID_RESULT: $command"
      else
        event "UNKNOWN" "dev" "port $PORT is used by pid $PORT_PID_RESULT, but its command cannot be inspected"
      fi
      return 0
    fi
    event "STOPPED" "dev" "no pid file"
    return 0
  fi

  load_port_pid
  if [[ "$PORT_PID_RESULT" == "$pid" ]]; then
    assert_managed_pid "$pid"
    event "OK" "dev" "running: $URL (pid $pid)"
    return 0
  fi

  if ! is_running "$pid"; then
    event "STALE" "dev" "pid file exists but process is not running: $pid"
    return 0
  fi

  local command
  if command="$(command_for_pid "$pid")" && is_managed_command "$command"; then
    event "DEGRADED" "dev" "managed pid $pid is running, but port $PORT listener is ${PORT_PID_RESULT:-none}"
  elif [[ -n "${command:-}" ]]; then
    event "STALE" "dev" "pid file points to external pid $pid: $command"
  else
    event "UNKNOWN" "dev" "pid file points to running pid $pid, but its command cannot be inspected"
  fi
}

stop_dev() {
  section "Dev Server"

  local pid=""
  if ! pid="$(read_pid)"; then
    load_port_pid
    if [[ -n "$PORT_PID_RESULT" ]]; then
      local command
      if command="$(command_for_pid "$PORT_PID_RESULT")" && is_managed_command "$command"; then
        event "RUN" "dev" "stopping orphan pid $PORT_PID_RESULT"
        kill "$PORT_PID_RESULT"
        wait_for_stop "$PORT_PID_RESULT"
        event "OK" "dev" "stopped"
      elif [[ -n "${command:-}" ]]; then
        event "FOREIGN" "dev" "port $PORT is used by pid $PORT_PID_RESULT; not stopping external process"
      else
        event "UNKNOWN" "dev" "port $PORT is used by pid $PORT_PID_RESULT, but its command cannot be inspected; not stopping"
      fi
      return 0
    fi
    event "STOPPED" "dev" "already stopped"
    return 0
  fi

  if ! is_running "$pid"; then
    event "CLEAN" "dev" "removing stale pid file: $PID_FILE"
    rm -f "$PID_FILE"
    return 0
  fi

  local command
  command="$(command_for_pid "$pid")" || die "cannot inspect command for pid $pid; not stopping or cleaning pid file" 2
  if ! is_managed_command "$command"; then
    event "CLEAN" "dev" "removing stale pid file for external pid $pid"
    rm -f "$PID_FILE"
    return 0
  fi

  event "RUN" "dev" "stopping pid $pid"
  kill "$pid"
  wait_for_stop "$pid"
  rm -f "$PID_FILE"
  event "OK" "dev" "stopped"
}

logs_dev() {
  section "Dev Server"
  [[ -f "$LOG_FILE" ]] || die "log file does not exist: $LOG_FILE" 2
  tail -f "$LOG_FILE"
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
  start|status|stop|restart|logs)
    action="$command"
    shift
    if args_include_help "$@"; then usage; exit 0; fi
    service="${1:-}"
    [[ "$service" == "dev" ]] || die "usage: ./scripts/dev.sh $action dev" 2
    shift
    [[ "$#" -eq 0 ]] || die "usage: ./scripts/dev.sh $action dev" 2
    case "$action" in
      start) start_dev ;;
      status) status_dev ;;
      stop) stop_dev ;;
      restart) stop_dev; start_dev ;;
      logs) logs_dev ;;
    esac
    ;;
  *)
    usage >&2
    die "unknown command: $command" 2
    ;;
esac
