#!/usr/bin/env bash
# Build script used by Render/Railway/Fly.io to prepare the ERP app.
set -e

echo "==> Installing server dependencies"
cd server
npm install --omit=dev
cd ..

echo "==> Installing client dependencies"
cd client
npm install
echo "==> Building React frontend"
npm run build
cd ..

echo "==> Build complete."
