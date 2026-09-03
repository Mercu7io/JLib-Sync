#!/bin/sh
set -e

# Retrieve Client ID from either GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID
CLIENT_ID="${GOOGLE_CLIENT_ID:-$VITE_GOOGLE_CLIENT_ID}"

cat <<EOF > /usr/share/nginx/html/env.js
window.__ENV__ = {
  GOOGLE_CLIENT_ID: "${CLIENT_ID}"
};
EOF

chmod 644 /usr/share/nginx/html/env.js
echo "Panda JWL-Sync: Runtime environment configured (Client ID: ${CLIENT_ID:+configured})"
