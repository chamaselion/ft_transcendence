#!/bin/bash
set -e

cd transcendence-spa

if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Fetching node_modules"
  npm install
fi

exec npm run dev
