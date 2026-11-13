#!/usr/bin/env bash
# Pull latest Botketoan01 from GitHub into each bot folder and restart pm2.
#
# Run ON the VPS:
#   bash /root/Botketoan01/scripts/update-bots-from-github.sh
# Only 02 + 03:
#   BOT_IDS="02 03" bash scripts/update-bots-from-github.sh
# Skip npm:
#   SKIP_NPM=1 bash scripts/update-bots-from-github.sh
# Skip pm2 restart:
#   SKIP_PM2=1 bash scripts/update-bots-from-github.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bots.conf.sh
source "${SCRIPT_DIR}/bots.conf.sh"

: "${SKIP_NPM:=0}"
: "${SKIP_PM2:=0}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd git
if [[ "${SKIP_NPM}" != "1" ]]; then
  need_cmd npm
fi
if [[ "${SKIP_PM2}" != "1" ]]; then
  need_cmd pm2
fi

update_one() {
  local id="$1"
  local dir
  dir="$(bot_dir "${id}")"
  local name
  name="$(bot_pm2_name "${id}")"

  echo "==== update ${name} (${dir})"

  if [[ ! -d "${dir}/.git" ]]; then
    echo "ERROR: ${dir} is not a git repo. Run bootstrap-bots-from-01.sh first." >&2
    return 1
  fi

  local url
  url="$(git -C "${dir}" remote get-url origin 2>/dev/null || true)"
  if [[ "${url}" != *"/Alexistox/Botketoan01"* && "${url}" != *"Alexistox/Botketoan01.git" ]]; then
    echo "ERROR: ${dir} origin is not Botketoan01 (${url}). Run bootstrap-bots-from-01.sh first." >&2
    return 1
  fi

  git -C "${dir}" fetch origin "${BOT_GITHUB_BRANCH}"
  git -C "${dir}" checkout "${BOT_GITHUB_BRANCH}"
  git -C "${dir}" reset --hard "origin/${BOT_GITHUB_BRANCH}"
  git -C "${dir}" log -1 --oneline
  git -C "${dir}" status -sb

  if [[ ! -f "${dir}/.env" ]]; then
    echo "WARNING: missing ${dir}/.env" >&2
  fi

  if [[ "${SKIP_NPM}" != "1" ]]; then
    (
      cd "${dir}"
      if [[ -f package-lock.json ]]; then
        npm ci --omit=dev
      else
        npm install --omit=dev
      fi
    )
  fi

  if [[ "${SKIP_PM2}" != "1" ]]; then
    if pm2 describe "${name}" >/dev/null 2>&1; then
      pm2 restart "${name}" --update-env
    else
      echo "WARNING: pm2 process '${name}' not found. Start it once, e.g.:" >&2
      echo "  cd ${dir} && pm2 start app.js --name ${name}" >&2
    fi
  fi

  echo "OK ${name}"
}

failed=0
for id in ${BOT_IDS}; do
  if ! update_one "${id}"; then
    failed=1
  fi
done

if [[ "${SKIP_PM2}" != "1" ]]; then
  pm2 save >/dev/null 2>&1 || true
  echo
  pm2 list || true
fi

if [[ "${failed}" -ne 0 ]]; then
  echo "Finished with errors." >&2
  exit 1
fi

echo "All requested bots updated from ${BOT_GITHUB_REPO} (${BOT_GITHUB_BRANCH})."
