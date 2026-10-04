#!/bin/bash
# Claude Code on the web: put Node 24 (package.json engines: >=24.16) first on
# PATH for the session, so pnpm and the husky pre-commit hook run, and install
# the dependencies. Local machines manage Node themselves.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

export NVM_DIR="${NVM_DIR:-/opt/nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm not found at $NVM_DIR; Node 24 not set up" >&2
  exit 0
fi
# nvm.sh reads unset variables.
set +u
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
nvm install 24 >/dev/null
NODE_BIN="$(dirname "$(nvm which 24)")"
set -u

# Later commands in the session see Node 24 before the image's default Node.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$NODE_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
export PATH="$NODE_BIN:$PATH"

corepack enable pnpm
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --prefer-offline
