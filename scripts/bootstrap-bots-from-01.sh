#!/usr/bin/env bash
# One-time setup: make Botketoan02 / Botketoan03 track GitHub Botketoan01
# while keeping each bot's own .env (token, port, mongo, …).
#
# Run ON the VPS as root (or the deploy user):
#   bash /root/Botketoan01/scripts/bootstrap-bots-from-01.sh
# Or only for 02 and 03:
#   BOT_IDS="02 03" bash scripts/bootstrap-bots-from-01.sh
#
# Safe behavior:
# - Backs up existing folder to BotketoanNN.bak.<timestamp> if it is not already
#   a clone of Botketoan01
# - Restores .env from the old folder / backup
# - Does not restart pm2 (run update-bots-from-github.sh after)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bots.conf.sh
source "${SCRIPT_DIR}/bots.conf.sh"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd git
need_cmd npm

is_botketoan01_clone() {
  local dir="$1"
  [[ -d "${dir}/.git" ]] || return 1
  local url
  url="$(git -C "${dir}" remote get-url origin 2>/dev/null || true)"
  [[ "${url}" == *"/Alexistox/Botketoan01"* ]] || [[ "${url}" == *"Alexistox/Botketoan01.git" ]]
}

bootstrap_one() {
  local id="$1"
  local dir
  dir="$(bot_dir "${id}")"
  local stamp
  stamp="$(date +%Y%m%d%H%M%S)"
  local env_backup=""
  local tmp_env
  tmp_env="$(mktemp)"

  echo "==== bootstrap Botketoan${id} -> ${dir}"

  if [[ -f "${dir}/.env" ]]; then
    cp -a "${dir}/.env" "${tmp_env}"
    env_backup="${tmp_env}"
    echo "Saved existing .env"
  fi

  if is_botketoan01_clone "${dir}"; then
    echo "Already a Botketoan01 clone; fetching ${BOT_GITHUB_BRANCH}"
    git -C "${dir}" fetch origin "${BOT_GITHUB_BRANCH}"
    git -C "${dir}" checkout "${BOT_GITHUB_BRANCH}"
    git -C "${dir}" reset --hard "origin/${BOT_GITHUB_BRANCH}"
  else
    if [[ -e "${dir}" ]]; then
      local bak="${dir}.bak.${stamp}"
      echo "Moving existing folder to ${bak}"
      mv "${dir}" "${bak}"
      if [[ -z "${env_backup}" && -f "${bak}/.env" ]]; then
        cp -a "${bak}/.env" "${tmp_env}"
        env_backup="${tmp_env}"
        echo "Saved .env from backup folder"
      fi
    fi
    echo "Cloning ${BOT_GITHUB_REPO} (${BOT_GITHUB_BRANCH})"
    git clone --branch "${BOT_GITHUB_BRANCH}" --single-branch "${BOT_GITHUB_REPO}" "${dir}"
  fi

  if [[ -n "${env_backup}" && -s "${env_backup}" ]]; then
    cp -a "${env_backup}" "${dir}/.env"
    echo "Restored .env"
  else
    echo "WARNING: no .env found for Botketoan${id}. Create ${dir}/.env before starting." >&2
  fi
  rm -f "${tmp_env}"

  (
    cd "${dir}"
    if [[ -f package-lock.json ]]; then
      npm ci --omit=dev
    else
      npm install --omit=dev
    fi
  )

  echo "OK Botketoan${id}"
}

for id in ${BOT_IDS}; do
  bootstrap_one "${id}"
done

echo
echo "Bootstrap done. Next:"
echo "  bash ${SCRIPT_DIR}/update-bots-from-github.sh"
echo "Or restart manually, e.g. pm2 restart Botketoan02 Botketoan03"
