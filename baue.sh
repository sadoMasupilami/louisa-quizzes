#!/usr/bin/env bash
# Baut die PDFs. Node und poppler kommen über Nix (werkzeuge/mit-nix.sh), wenn Nix da ist.
# Beispiele:  ./baue.sh          ./baue.sh --nur 03 --png
set -euo pipefail
cd "$(dirname "$0")"
if command -v nix >/dev/null 2>&1 && [ -z "${WERKSTATT_OHNE_NIX:-}" ]; then
  exec werkzeuge/mit-nix.sh sh -c '[ -d node_modules ] || npm install --no-audit --no-fund; node build.mjs "$@"' sh "$@"
fi
[ -d node_modules ] || npm install --no-audit --no-fund
exec node build.mjs "$@"
