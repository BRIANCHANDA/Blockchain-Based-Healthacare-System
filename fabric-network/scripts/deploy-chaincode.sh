#!/usr/bin/env bash
#
# Approve a chaincode definition for all three organisations and commit it.
#
# Usage: ./scripts/deploy-chaincode.sh <label> <version> <sequence>
#   e.g. ./scripts/deploy-chaincode.sh healthcare_4.3 4.3 4
#
# The package must already be installed on every peer (scripts/package-chaincode.sh
# builds it; `peer lifecycle chaincode install` puts it on each peer).
#
# The endorsement policy below reproduces the one committed at sequence 3 —
# two of the three organisations' peers must endorse. Keeping it means no single
# organisation can forge a consent grant on its own.

set -euo pipefail

LABEL="${1:-}"; VERSION="${2:-}"; SEQUENCE="${3:-}"
if [[ -z "$LABEL" || -z "$VERSION" || -z "$SEQUENCE" ]]; then
  echo "usage: $0 <label> <version> <sequence>   (e.g. healthcare_4.3 4.3 4)" >&2
  exit 2
fi

CHANNEL=healthcare
CC_NAME=healthcare
POLICY="OutOf(2, 'HospitalOrgMSP.peer', 'PractitionerOrgMSP.peer', 'PatientOrgMSP.peer')"

PEERBASE=/opt/gopath/src/github.com/hyperledger/fabric/peer
ORDERER=orderer.healthcare.com:7050
ORDCA=$PEERBASE/organizations/ordererOrganizations/healthcare.com/orderers/orderer.healthcare.com/msp/tlscacerts/tlsca.healthcare.com-cert.pem

org_msp()  { case $1 in hospital) echo HospitalOrgMSP;; practitioner) echo PractitionerOrgMSP;; patient) echo PatientOrgMSP;; esac; }
org_port() { case $1 in hospital) echo 7051;; practitioner) echo 9051;; patient) echo 11051;; esac; }
org_tls()  { echo "$PEERBASE/organizations/peerOrganizations/$1.healthcare.com/peers/peer0.$1.healthcare.com/tls/ca.crt"; }

as_org() {
  local org=$1; shift
  docker exec \
    -e CORE_PEER_LOCALMSPID="$(org_msp "$org")" \
    -e CORE_PEER_ADDRESS="peer0.$org.healthcare.com:$(org_port "$org")" \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_ROOTCERT_FILE="$(org_tls "$org")" \
    -e CORE_PEER_MSPCONFIGPATH="$PEERBASE/organizations/peerOrganizations/$org.healthcare.com/users/Admin@$org.healthcare.com/msp" \
    cli "$@"
}

echo "==> Resolving package ID for label $LABEL"
PKGID=""
for org in hospital practitioner patient; do
  found=$(as_org "$org" peer lifecycle chaincode queryinstalled 2>/dev/null \
            | sed -n "s/^Package ID: \(${LABEL}:[a-f0-9]*\), Label: .*/\1/p" | head -1)
  if [[ -z "$found" ]]; then
    echo "ERROR: $LABEL is not installed on peer0.$org — install it before deploying." >&2
    exit 1
  fi
  echo "    peer0.$org -> $found"
  PKGID="$found"
done

echo
echo "==> Approving for each organisation (sequence $SEQUENCE)"
for org in hospital practitioner patient; do
  echo "--- $(org_msp "$org") ---"
  as_org "$org" peer lifecycle chaincode approveformyorg \
    -o "$ORDERER" --tls --cafile "$ORDCA" \
    --channelID "$CHANNEL" --name "$CC_NAME" \
    --version "$VERSION" --package-id "$PKGID" --sequence "$SEQUENCE" \
    --signature-policy "$POLICY"
done

echo
echo "==> Checking commit readiness"
as_org hospital peer lifecycle chaincode checkcommitreadiness \
  --channelID "$CHANNEL" --name "$CC_NAME" --version "$VERSION" --sequence "$SEQUENCE" \
  --signature-policy "$POLICY" --output json

echo
echo "==> Committing definition"
as_org hospital peer lifecycle chaincode commit \
  -o "$ORDERER" --tls --cafile "$ORDCA" \
  --channelID "$CHANNEL" --name "$CC_NAME" \
  --version "$VERSION" --sequence "$SEQUENCE" \
  --signature-policy "$POLICY" \
  --peerAddresses "peer0.hospital.healthcare.com:7051"     --tlsRootCertFiles "$(org_tls hospital)" \
  --peerAddresses "peer0.practitioner.healthcare.com:9051" --tlsRootCertFiles "$(org_tls practitioner)" \
  --peerAddresses "peer0.patient.healthcare.com:11051"     --tlsRootCertFiles "$(org_tls patient)"

echo
echo "==> Committed definition"
as_org hospital peer lifecycle chaincode querycommitted \
  -C "$CHANNEL" -n "$CC_NAME" -o "$ORDERER" --tls --cafile "$ORDCA" --output json
