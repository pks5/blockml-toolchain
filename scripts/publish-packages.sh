#!/usr/bin/env bash
# Publish all @blockml/* workspace packages to npm in dependency order.
# Prerequisites: npm login, npm run build, npm test
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PACKAGES=(
  "@blockml/bom"
  "@blockml/parser"
  "@blockml/serializer"
  "@blockml/framework"
  "@blockml/validator"
  "@blockml/compiler"
  "@blockml/blockdoc-target"
  "@blockml/xsd-target"
  "@blockml/fatblock-target"
  "@blockml/search"
  "@blockml/graph"
  "@blockml/transformer"
  "@blockml/cli"
  "@blockml/lsp"
)

echo "Building all packages..."
npm run build

for pkg in "${PACKAGES[@]}"; do
  echo "Publishing ${pkg}..."
  npm publish -w "$pkg" --access public
done

echo "Done. Published ${#PACKAGES[@]} packages."
