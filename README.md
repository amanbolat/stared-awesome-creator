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
1) Install Node 24, clone the repo, then run:
   - `npm ci`
   - `npm run build`
2) Provide a GitHub PAT:
   - Either export `GITHUB_TOKEN=ghp_...` before running the deploy script, or
   - Create `/etc/stared-awesome-creator.env` with:
     - `GITHUB_TOKEN=ghp_...`
     - Optional: `STAR_CACHE_PATH=/var/lib/stared-awesome-creator/stars.db`
3) Add or update list configs in `configs/` (for example `configs/awesome-rust.yml`).
4) Deploy systemd units for every config:
   - `sudo ./scripts/deploy-systemd.sh`
   - This copies configs to `/etc/stared-awesome-creator/configs` and creates one timer per config.
5) Verify timers and logs:
   - `systemctl list-timers 'stared-awesome-creator-*'`
   - `journalctl -u stared-awesome-creator-<list-id>.service -n 200 --no-pager`
