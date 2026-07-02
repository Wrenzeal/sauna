#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for env_file in "$ROOT_DIR/.env" "$ROOT_DIR/.env.local"; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
done

STATE_DIR="${SAUNA_DEV_STATE_DIR:-$ROOT_DIR/.runtime/sauna-dev}"
LOG_DIR="$STATE_DIR/logs"
BACKEND_PORT="${SAUNA_BACKEND_PORT:-8080}"
BACKEND_BIND="${SAUNA_BACKEND_BIND:-:$BACKEND_PORT}"
BACKEND_URL="${SAUNA_BACKEND_INTERNAL_URL:-http://127.0.0.1:$BACKEND_PORT}"
BACKEND_PID_FILE="$STATE_DIR/backend.pid"
WEB_PID_FILE="$STATE_DIR/web.pid"
BACKEND_LOG="$LOG_DIR/backend.log"

mkdir -p "$LOG_DIR"

read_pid() {
  local file="$1"
  if [[ -f "$file" ]]; then
    tr -dc '0-9' < "$file"
  fi
}

is_alive() {
  local pid="${1:-}"
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

clear_stale_pid() {
  local file="$1"
  local pid
  pid="$(read_pid "$file")"
  if [[ -n "$pid" ]] && ! is_alive "$pid"; then
    rm -f "$file"
  fi
}

stop_legacy_web() {
  local pid
  pid="$(read_pid "$WEB_PID_FILE")"
  if is_alive "$pid"; then
    echo "stopping legacy web process, pid $pid"
    kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      if ! is_alive "$pid"; then
        break
      fi
      sleep 0.5
    done
    if is_alive "$pid"; then
      kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$WEB_PID_FILE"
}

start_process() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  clear_stale_pid "$pid_file"
  local existing_pid
  existing_pid="$(read_pid "$pid_file")"
  if is_alive "$existing_pid"; then
    echo "$name already running, pid $existing_pid"
    return 0
  fi

  printf '\n[%s] starting %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$name" >> "$log_file"
  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" >> "$log_file" 2>&1 &
  else
    "$@" >> "$log_file" 2>&1 &
  fi
  local pid=$!
  echo "$pid" > "$pid_file"
  echo "$name started, pid $pid, log $log_file"
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local pid_file="$3"
  local log_file="$4"
  local timeout_seconds="${5:-60}"

  for _ in $(seq 1 "$timeout_seconds"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$name ready at $url"
      return 0
    fi

    local pid
    pid="$(read_pid "$pid_file")"
    if ! is_alive "$pid"; then
      echo "$name exited before becoming ready. Last log lines:" >&2
      tail -n 80 "$log_file" >&2 || true
      return 1
    fi
    sleep 1
  done

  echo "$name did not become ready at $url within ${timeout_seconds}s. Last log lines:" >&2
  tail -n 80 "$log_file" >&2 || true
  return 1
}

stop_legacy_web

start_process "backend" "$BACKEND_PID_FILE" "$BACKEND_LOG" \
  bash -c 'cd "$1" && exec env HTTP_ADDR="$2" go run ./cmd/api' bash "$ROOT_DIR/apps/backend" "$BACKEND_BIND"
wait_for_url "backend" "$BACKEND_URL/health" "$BACKEND_PID_FILE" "$BACKEND_LOG" 60

cat <<INFO

Sauna backend is running.
- Backend: $BACKEND_URL
- Logs:    $LOG_DIR

Frontend is expected to run on Vercel or through npm run web:dev when local UI development is needed.

Stop backend with:
  npm run dev:stop
INFO
