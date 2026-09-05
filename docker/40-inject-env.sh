#!/bin/sh
set -e

# Retrieve Client ID from either GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID
CLIENT_ID="${GOOGLE_CLIENT_ID:-$VITE_GOOGLE_CLIENT_ID}"

# Retrieve Web3Forms Access Key from either WEB3FORMS_ACCESS_KEY or VITE_WEB3FORMS_ACCESS_KEY
WEB3FORMS_KEY="${WEB3FORMS_ACCESS_KEY:-$VITE_WEB3FORMS_ACCESS_KEY}"

cat <<EOF > /usr/share/nginx/html/env.js
window.__ENV__ = {
  GOOGLE_CLIENT_ID: "${CLIENT_ID}",
  VITE_GOOGLE_CLIENT_ID: "${CLIENT_ID}",
  WEB3FORMS_ACCESS_KEY: "${WEB3FORMS_KEY}",
  VITE_WEB3FORMS_ACCESS_KEY: "${WEB3FORMS_KEY}"
};
EOF

chmod 644 /usr/share/nginx/html/env.js
echo "Panda JWL-Sync: Runtime environment configured (Client ID: ${CLIENT_ID:+configured}, Web3Forms: ${WEB3FORMS_KEY:+configured})"
