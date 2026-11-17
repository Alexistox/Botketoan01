#!/usr/bin/env bash
# Shared layout for multi-bot deploy on the VPS.
# Override any value by exporting it before sourcing this file.

# GitHub source of truth for all ketoan bots
: "${BOT_GITHUB_REPO:=https://github.com/Alexistox/Botketoan01.git}"
: "${BOT_GITHUB_BRANCH:=main}"

# Parent directory that contains each bot folder on the VPS
: "${BOT_ROOT:=/root}"

# Space-separated bot ids (folder + default pm2 name = BotketoanNN)
: "${BOT_IDS:=01 02 03}"

bot_dir() {
  local id="$1"
  echo "${BOT_ROOT}/Botketoan${id}"
}

bot_pm2_name() {
  local id="$1"
  echo "Botketoan${id}"
}
