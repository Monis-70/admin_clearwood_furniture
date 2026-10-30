#!/usr/bin/env bash
# Sourced by deploy.sh. The build needs Node 24+; when the system Node (the API's) is older, switch
# to nvm's Node 24 for this shell only, so the API's runtime is never touched.

NODE_MIN=24
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

if (( $(node_major) < NODE_MIN )); then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    set +eu
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh" --no-use
    nvm use "$NODE_MIN" >/dev/null 2>&1
    set -eu
  fi
fi

if (( $(node_major) < NODE_MIN )); then
  cat >&2 <<EOF
Node ${NODE_MIN} or newer is required to build the admin (found $(node -v 2>/dev/null || echo none)).
Install it next to the system Node, without changing what the API runs on:
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  source ~/.nvm/nvm.sh && nvm install ${NODE_MIN}
EOF
  exit 1
fi
echo "Using Node $(node -v)"
