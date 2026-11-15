#!/usr/bin/env bash
# Imported/adapted 2026-10-14 from plant-vs-zombie/run-platform-deploy-skills/templates/.
# Runs ON the server (called by deploy.ps1). Idempotent: extract tarball -> install deps -> stop old process -> start -> health check.
# Usage: bash ~/remote-setup.sh <remote_dir> <app_port> "<start_cmd>" "<install_cmd>" "<health_path>"
set -e
REMOTE_DIR="${1:-my-app}"
[[ "$REMOTE_DIR" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || { echo "Use a simple remote folder name under home."; exit 1; }
DIR="$HOME/$REMOTE_DIR"; PORT="${2:-3000}"; START="${3:-node server.js}"; INSTALL="${4:-}"; HEALTH="${5:-/}"
export PATH="$HOME/.local/node/bin:$PATH"

# Runtime selection is project-specific. Install a verified compatible release before deploying.
# Do not automatically download the historical source template's pinned runtime.
if echo "$START $INSTALL" | grep -q "node\|npm"; then
  command -v node >/dev/null || { echo "Node is missing. Install a supported release compatible with this app, then retry."; exit 1; }
  if echo "$INSTALL" | grep -q "npm"; then command -v npm >/dev/null || { echo "npm is missing."; exit 1; }; fi
  echo "Node $(node -v)"
fi

# Stop the old process first (otherwise EADDRINUSE / stale code keeps serving)
if [ -f "$DIR/server.pid" ]; then
  OLD_PID=$(cat "$DIR/server.pid")
  [[ "$OLD_PID" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid server.pid; inspect it before retrying."; exit 1; }
  if kill -0 "$OLD_PID" 2>/dev/null; then kill "$OLD_PID"; sleep 1; fi
fi

mkdir -p "$DIR"; tar -xzf "$HOME/app.tgz" -C "$DIR"
cd "$DIR"
[ -n "$INSTALL" ] && eval "$INSTALL"

PORT="$PORT" nohup bash -c "$START" > server.log 2>&1 &
echo $! > server.pid; sleep 3
if kill -0 "$(cat server.pid)" 2>/dev/null && curl -fs "http://localhost:$PORT$HEALTH" >/dev/null; then
  echo "Server OK on port $PORT (pid $(cat server.pid))"
else
  echo "Server FAILED - last 30 log lines:"; tail -30 server.log; exit 1
fi
