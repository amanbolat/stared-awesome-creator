# Operations Runbook

## Prerequisites
- Debian arm64 VM with Node.js 24 installed.
- A GitHub PAT with repo write access for the output repository.

## Install and Build
```sh
git clone <repo>
cd stared-awesome-creator
npm ci
npm run build
```

## Configuration
- Copy the template config to `/etc/stared-awesome-creator/list.yml`.
- Update `list.source` and `list.output` for the target awesome list.
- For multiple lists, create separate config files and service units.

## Secrets
Create `/etc/stared-awesome-creator.env`:
```
GITHUB_TOKEN=ghp_...
STAR_CACHE_PATH=/var/lib/stared-awesome-creator/cache.db
```
Set permissions: `chmod 600 /etc/stared-awesome-creator.env`.

## Systemd
```sh
sudo cp deploy/systemd/stared-awesome-creator.service /etc/systemd/system/
sudo cp deploy/systemd/stared-awesome-creator.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stared-awesome-creator.timer
```

## Logs and Troubleshooting
- View logs: `journalctl -u stared-awesome-creator.service -n 200 --no-pager`.
- Re-run manually: `/usr/bin/node /opt/stared-awesome-creator/dist/index.js --config /etc/stared-awesome-creator/list.yml`.
- For a dry run: `DRY_RUN=1 DRY_RUN_DIR=/tmp/stars-out ...`.

## Multi-List Instances
- Duplicate the service/timer files with unique names (e.g., `stared-awesome-creator-rust.service`).
- Point `--config` to a per-list config path and use a separate env file if needed.
