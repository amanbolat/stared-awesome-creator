#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CONFIG_DIR=${CONFIG_DIR:-"$ROOT_DIR/configs"}
SYSTEMD_DIR=${SYSTEMD_DIR:-/etc/systemd/system}
DEPLOY_DIR=${DEPLOY_DIR:-/etc/stared-awesome-creator}
DEPLOY_CONFIG_DIR="$DEPLOY_DIR/configs"
ENV_FILE=${ENV_FILE:-"$DEPLOY_DIR.env"}
WORKING_DIR=${WORKING_DIR:-"$ROOT_DIR"}
NODE_BIN=${NODE_BIN:-$(command -v node || true)}

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must run as root (use sudo)." >&2
  exit 1
fi

if [ ! -d "$CONFIG_DIR" ]; then
  echo "Config directory not found: $CONFIG_DIR" >&2
  exit 1
fi

if [ -z "$NODE_BIN" ]; then
  echo "Node.js binary not found. Set NODE_BIN or install Node 24." >&2
  exit 1
fi

mapfile -t CONFIG_FILES < <(find "$CONFIG_DIR" -maxdepth 1 -type f \( -name "*.yml" -o -name "*.yaml" \) | sort)
if [ ${#CONFIG_FILES[@]} -eq 0 ]; then
  echo "No config files found in $CONFIG_DIR" >&2
  exit 1
fi

mkdir -p "$DEPLOY_CONFIG_DIR"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENV_EOF'
GITHUB_TOKEN=
# Optional: STAR_CACHE_PATH=/var/lib/stared-awesome-creator/stars.db
ENV_EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE. Set GITHUB_TOKEN before running timers." >&2
fi

for config_file in "${CONFIG_FILES[@]}"; do
  config_name=$(basename "$config_file")
  list_id=$("$NODE_BIN" --input-type=module -e "import fs from 'node:fs'; import yaml from 'yaml'; const raw = fs.readFileSync(process.argv[1], 'utf8'); const parsed = yaml.parse(raw); const id = parsed?.list?.id; if (!id) { console.error('Missing list.id'); process.exit(1); } console.log(String(id));" "$config_file")
  safe_id=$(echo "$list_id" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-')
  config_target="$DEPLOY_CONFIG_DIR/$config_name"
  cache_path="/var/lib/stared-awesome-creator/stars-${safe_id}.db"

  install -m 644 "$config_file" "$config_target"

  service_unit="$SYSTEMD_DIR/stared-awesome-creator-${safe_id}.service"
  timer_unit="$SYSTEMD_DIR/stared-awesome-creator-${safe_id}.timer"

  cat > "$service_unit" <<UNIT_EOF
[Unit]
Description=Stared Awesome Creator (${list_id})
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${WORKING_DIR}
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
Environment=STAR_CACHE_PATH=${cache_path}
ExecStart=${NODE_BIN} ${WORKING_DIR}/dist/index.js --config ${config_target}
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

done

systemctl daemon-reload

for config_file in "${CONFIG_FILES[@]}"; do
  list_id=$("$NODE_BIN" --input-type=module -e "import fs from 'node:fs'; import yaml from 'yaml'; const raw = fs.readFileSync(process.argv[1], 'utf8'); const parsed = yaml.parse(raw); const id = parsed?.list?.id; if (!id) { process.exit(1); } console.log(String(id));" "$config_file")
  safe_id=$(echo "$list_id" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-')
  systemctl enable --now "stared-awesome-creator-${safe_id}.timer"
done

echo "Deployed ${#CONFIG_FILES[@]} systemd timer(s)."
