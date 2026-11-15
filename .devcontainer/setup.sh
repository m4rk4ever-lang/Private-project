#!/usr/bin/env bash
# Runs once when the codespace is created: installs Yarn 4 and all dependencies,
# and points the client at this codespace's forwarded game port.
set -euo pipefail

# Yarn 4 via Corepack (the image ships Yarn 1, which this repo does not use).
sudo rm -f /usr/local/bin/yarn /usr/local/bin/yarnpkg
sudo corepack enable
corepack install

npm run setup

# In a codespace the browser cannot reach localhost:43594. The game port is
# forwarded as https://<codespace>-43594.<domain>, so the client connects there over wss.
if [ -n "${CODESPACE_NAME:-}" ]; then
  domain="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  host="${CODESPACE_NAME}-43594.${domain}"
  touch .env
  # Replace earlier codespace values, keep anything else in .env.
  sed -i '/^REACT_APP_DEFAULT_\(WS_URL\|SERVER_ADDRESS\|SERVER_SECURE\|SERVER_NAME\)=/d' .env
  cat >> .env <<EOF
REACT_APP_DEFAULT_WS_URL=wss://${host}
REACT_APP_DEFAULT_SERVER_ADDRESS=${host}
REACT_APP_DEFAULT_SERVER_SECURE=true
REACT_APP_DEFAULT_SERVER_NAME=Codespace
EOF
  echo "Client points at wss://${host}"
fi
