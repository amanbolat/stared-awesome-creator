#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CONFIG_DIR=${CONFIG_DIR:-"$ROOT_DIR/configs"}
DEPLOY_HOST=${DEPLOY_HOST:-${REMOTE_HOST:-}}
DEPLOY_USER=${DEPLOY_USER:-${REMOTE_USER:-$USER}}
REMOTE_WORKING_DIR=${REMOTE_WORKING_DIR:-/opt/stared-awesome-creator}
REMOTE_SYSTEMD_DIR=${REMOTE_SYSTEMD_DIR:-/etc/systemd/system}
REMOTE_DEPLOY_DIR=${REMOTE_DEPLOY_DIR:-/etc/stared-awesome-creator}
REMOTE_CONFIG_DIR=${REMOTE_CONFIG_DIR:-"$REMOTE_DEPLOY_DIR/configs"}
REMOTE_ENV_FILE=${REMOTE_ENV_FILE:-"$REMOTE_DEPLOY_DIR.env"}
SSH_PORT=${SSH_PORT:-}
SSH_KEY=${SSH_KEY:-}

cd "$ROOT_DIR"

if [ -z "$DEPLOY_HOST" ]; then
  echo "DEPLOY_HOST is required (for example DEPLOY_HOST=your-vm)." >&2
  exit 1
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN is required to create the remote env file." >&2
  exit 1
fi

if [ ! -d "$CONFIG_DIR" ]; then
  echo "Config directory not found: $CONFIG_DIR" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required locally to parse configs." >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required locally to sync files." >&2
  exit 1
fi

SSH_OPTS=()
if [ -n "$SSH_PORT" ]; then
  SSH_OPTS+=("-p" "$SSH_PORT")
fi
if [ -n "$SSH_KEY" ]; then
  SSH_OPTS+=("-i" "$SSH_KEY")
fi

SSH_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"

remote_cmd() {
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$@"
}

remote_cmd_quiet() {
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$@" >/dev/null
}

REMOTE_NODE_BIN=$(remote_cmd "command -v node || true")
if [ -z "$REMOTE_NODE_BIN" ]; then
  echo "Node.js is required on the remote host (install Node 24)." >&2
  exit 1
fi

if ! remote_cmd_quiet "command -v npm"; then
  echo "npm is required on the remote host." >&2
  exit 1
fi

if ! remote_cmd_quiet "command -v rsync"; then
  echo "rsync is required on the remote host." >&2
  exit 1
fi

mapfile -t CONFIG_FILES < <(find "$CONFIG_DIR" -maxdepth 1 -type f \( -name "*.yml" -o -name "*.yaml" \) | sort)
if [ ${#CONFIG_FILES[@]} -eq 0 ]; then
  echo "No config files found in $CONFIG_DIR" >&2
  exit 1
fi

npm run build

remote_cmd "sudo mkdir -p '$REMOTE_WORKING_DIR' '$REMOTE_CONFIG_DIR' /var/lib/stared-awesome-creator"
remote_cmd "sudo chown -R '$DEPLOY_USER':'$DEPLOY_USER' '$REMOTE_WORKING_DIR'"
remote_cmd "sudo id -u stared >/dev/null 2>&1 || sudo useradd --system --home /var/lib/stared-awesome-creator --shell /usr/sbin/nologin stared"
remote_cmd "sudo chown -R stared:stared /var/lib/stared-awesome-creator"

rsync -az --delete \
  --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  "$ROOT_DIR/dist" "$ROOT_DIR/package.json" "$ROOT_DIR/package-lock.json" "$ROOT_DIR/configs" \
  "${SSH_TARGET}:${REMOTE_WORKING_DIR}/"

remote_cmd "cd '$REMOTE_WORKING_DIR' && npm ci --omit=dev"

remote_env_content="GITHUB_TOKEN=${GITHUB_TOKEN}"
if [ -n "${STAR_CACHE_PATH:-}" ]; then
  remote_env_content+=$'\n'"STAR_CACHE_PATH=${STAR_CACHE_PATH}"
fi

printf '%s\n' "$remote_env_content" | remote_cmd "sudo tee '$REMOTE_ENV_FILE' >/dev/null"
remote_cmd "sudo chmod 600 '$REMOTE_ENV_FILE'"

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

for config_file in "${CONFIG_FILES[@]}"; do
  config_name=$(basename "$config_file")
  list_id=$(node --input-type=module -e "import fs from 'node:fs'; import yaml from 'yaml'; const raw = fs.readFileSync(process.argv[1], 'utf8'); const parsed = yaml.parse(raw); const id = parsed?.list?.id; if (!id) { console.error('Missing list.id'); process.exit(1); } console.log(String(id));" "$config_file")
  safe_id=$(echo "$list_id" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-')
  config_target="$REMOTE_CONFIG_DIR/$config_name"
  cache_path="/var/lib/stared-awesome-creator/stars-${safe_id}.db"

  service_unit="$TEMP_DIR/stared-awesome-creator-${safe_id}.service"
  timer_unit="$TEMP_DIR/stared-awesome-creator-${safe_id}.timer"

  cat > "$service_unit" <<UNIT_EOF
[Unit]
Description=Stared Awesome Creator (${list_id})
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${REMOTE_WORKING_DIR}
EnvironmentFile=${REMOTE_ENV_FILE}
Environment=NODE_ENV=production
Environment=STAR_CACHE_PATH=${cache_path}
ExecStart=${REMOTE_NODE_BIN} ${REMOTE_WORKING_DIR}/dist/index.js --config ${config_target}
User=stared
Group=stared
StateDirectory=stared-awesome-creator

[Install]
WantedBy=multi-user.target
UNIT_EOF

  cat > "$timer_unit" <<UNIT_EOF
[Unit]
Description=Daily run for Stared Awesome Creator (${list_id})

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
UNIT_EOF

  remote_cmd "sudo tee '$config_target' >/dev/null" < "$config_file"
  remote_cmd "sudo chmod 644 '$config_target'"

  remote_cmd "sudo tee '$REMOTE_SYSTEMD_DIR/stared-awesome-creator-${safe_id}.service' >/dev/null" < "$service_unit"
  remote_cmd "sudo tee '$REMOTE_SYSTEMD_DIR/stared-awesome-creator-${safe_id}.timer' >/dev/null" < "$timer_unit"
  remote_cmd "sudo chmod 644 '$REMOTE_SYSTEMD_DIR/stared-awesome-creator-${safe_id}.service'"
  remote_cmd "sudo chmod 644 '$REMOTE_SYSTEMD_DIR/stared-awesome-creator-${safe_id}.timer'"

done

remote_cmd "sudo systemctl daemon-reload"

for config_file in "${CONFIG_FILES[@]}"; do
  list_id=$(node --input-type=module -e "import fs from 'node:fs'; import yaml from 'yaml'; const raw = fs.readFileSync(process.argv[1], 'utf8'); const parsed = yaml.parse(raw); const id = parsed?.list?.id; if (!id) { process.exit(1); } console.log(String(id));" "$config_file")
  safe_id=$(echo "$list_id" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-')
  remote_cmd "sudo systemctl enable --now 'stared-awesome-creator-${safe_id}.timer'"
done

echo "Deployed ${#CONFIG_FILES[@]} systemd timer(s) to ${DEPLOY_HOST}."
