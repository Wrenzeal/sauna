#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${SAUNA_DEV_STATE_DIR:-$ROOT_DIR/.runtime/sauna-dev}"
BACKEND_PID_FILE="$STATE_DIR/backend.pid"
WEB_PID_FILE="$STATE_DIR/web.pid"

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

stop_process() {
  local name="$1"
  local pid_file="$2"
  local pid
  pid="$(read_pid "$pid_file")"

  if [[ -z "$pid" ]]; then
    echo "$name not tracked"
    rm -f "$pid_file"
    return 0
  fi

  if ! is_alive "$pid"; then
    echo "$name already stopped, stale pid $pid"
    rm -f "$pid_file"
    return 0
  fi

  echo "stopping $name, pid $pid"
  kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true

  for _ in $(seq 1 20); do
    if ! is_alive "$pid"; then
      rm -f "$pid_file"
      echo "$name stopped"
      return 0
    fi
    sleep 0.5
  done

  echo "$name did not exit after TERM, sending KILL"
  kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  echo "$name stopped"
}

stop_process "web" "$WEB_PID_FILE"
stop_process "backend" "$BACKEND_PID_FILE"
