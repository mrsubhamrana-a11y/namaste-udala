#!/bin/bash
set -euo pipefail

: "${ADMIN_PHONE:?Set ADMIN_PHONE to a valid 10-digit Indian mobile number}"
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD to a strong admin password}"
: "${SESSION_SECRET:?Set SESSION_SECRET to a random secret (for example: openssl rand -hex 32)}"

killall node 2>/dev/null || true

echo "🚀 Namaste Udala Server naye port par chalu ho raha hai..."
ADMIN_PHONE="$ADMIN_PHONE" ADMIN_PASSWORD="$ADMIN_PASSWORD" SESSION_SECRET="$SESSION_SECRET" node server.js &

sleep 2
echo "🌐 Internet Link banaya ja raha hai..."
ssh -R 80:localhost:8081 -o StrictHostKeyChecking=no nokey@localhost.run
