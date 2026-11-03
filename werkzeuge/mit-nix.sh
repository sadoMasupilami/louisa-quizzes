#!/usr/bin/env bash
# Führt einen Befehl in einer Umgebung mit Node 22 und poppler aus (über Nix, nichts global installiert).
#   werkzeuge/mit-nix.sh node build.mjs --nur 02
# Ohne Nix: Node 20+ und poppler (pdfinfo, pdftoppm) selbst installieren und die Befehle direkt aufrufen.
set -euo pipefail
cd "$(dirname "$0")/.."
UMGEBUNG='let pkgs = (builtins.getFlake "nixpkgs").legacyPackages.${builtins.currentSystem}; in
  pkgs.buildEnv { name = "schau-werkstatt"; ignoreCollisions = true; paths = [ pkgs.nodejs_22 pkgs.poppler-utils ]; }'
exec nix shell --impure --expr "$UMGEBUNG" -c "$@"
