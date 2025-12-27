## About
This service fetches awesome list README files, parses GitHub repository links, fetches star counts via the GitHub GraphQL API, and publishes a star-sorted README to a target repository. It is designed to run daily on a Debian arm64 VM with systemd timers.

## Logic
- Download the source README.
- Parse categories and GitHub links.
- Fetch stars (cached in SQLite).
- Render markdown tables (optional TOC).
- Update the destination README.

## Awesome lists with stars
- Awesome go:
  - [Original repo](https://github.com/avelino/awesome-go)
  - [With stars](https://github.com/amanbolat/awesome-go-with-stars)

## Deploy (systemd on Debian arm64)
1) On the VM, install Node 24, npm, rsync, and ensure your SSH user has sudo access.
2) Locally, set a GitHub PAT and point to the VM:
   - `GITHUB_TOKEN=ghp_... DEPLOY_HOST=your-vm ./scripts/deploy-systemd.sh`
   - Optional: `DEPLOY_USER=debian`, `SSH_PORT=22`, `SSH_KEY=~/.ssh/id_ed25519`
3) Add or update list configs in `configs/` (for example `configs/awesome-rust.yml`), then re-run the deploy script.
4) The script syncs `dist/` and configs to `/opt/stared-awesome-creator`, runs `npm ci --omit=dev`, creates `/etc/stared-awesome-creator.env`, and installs one timer per config.
5) Verify timers and logs on the VM:
   - `systemctl list-timers 'stared-awesome-creator-*'`
   - `journalctl -u stared-awesome-creator-<list-id>.service -n 200 --no-pager`
