#!/usr/bin/env bash
#
# Build and package the healthcare chaincode, then hand the package to the `cli`
# container so it can be installed on the peers.
#
# Usage: ./scripts/package-chaincode.sh <label>      e.g. ./scripts/package-chaincode.sh healthcare_4.3
#
# Two things this script does that a plain `peer lifecycle chaincode package`
# on the source tree does not:
#
#   1. Compiles TypeScript first, so dist/ in the package matches src/.
#   2. Strips devDependencies from the package.json that ships inside the
#      archive. The peer builds chaincode with `npm install --omit=dev`, but npm
#      still resolves metadata for dev dependencies while computing the tree —
#      which is where the `@types/node` ETIMEDOUT install failures came from.
#      dist/ is prebuilt, so typescript and @types/node have no role at runtime.

set -euo pipefail

LABEL="${1:-}"
if [[ -z "$LABEL" ]]; then
  echo "usage: $0 <label>   (e.g. healthcare_4.3)" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"
CC_DIR="$FABRIC_DIR/chaincode"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "==> Compiling TypeScript"
if [[ ! -x "$CC_DIR/node_modules/.bin/tsc" ]]; then
  echo "    installing build tooling (typescript, @types/node)"
  (cd "$CC_DIR" && npm install --no-save typescript@4.9.5 @types/node@18.15.0 >/dev/null)
fi
(cd "$CC_DIR" && ./node_modules/.bin/tsc)

echo "==> Staging package contents"
mkdir -p "$STAGE/cc"
cp -r "$CC_DIR/src" "$CC_DIR/dist" "$CC_DIR/tsconfig.json" "$STAGE/cc/"
cp "$CC_DIR/.npmrc" "$STAGE/cc/.npmrc"
[[ -f "$CC_DIR/README.md" ]] && cp "$CC_DIR/README.md" "$STAGE/cc/"

# package.json minus devDependencies
node -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  delete pkg.devDependencies;
  fs.writeFileSync(process.argv[2], JSON.stringify(pkg, null, 2) + "\n");
' "$CC_DIR/package.json" "$STAGE/cc/package.json"

echo "==> Copying into cli container"
docker exec cli rm -rf /tmp/cc
docker exec cli mkdir -p /tmp/cc
tar cf - -C "$STAGE/cc" . | docker exec -i cli tar xf - -C /tmp/cc

echo "==> Packaging as $LABEL"
docker exec cli rm -f "/tmp/$LABEL.tar.gz"
docker exec cli peer lifecycle chaincode package "/tmp/$LABEL.tar.gz" \
  --path /tmp/cc --lang node --label "$LABEL"

PKGID=$(docker exec cli peer lifecycle chaincode calculatepackageid "/tmp/$LABEL.tar.gz")
echo "==> Package ready inside cli at /tmp/$LABEL.tar.gz"
echo "==> Package ID: $PKGID"

# Also drop a copy on the host next to the other packages, for the record.
docker exec cli cat "/tmp/$LABEL.tar.gz" > "$FABRIC_DIR/network/$LABEL.tar.gz"
echo "==> Copy saved to network/$LABEL.tar.gz"
