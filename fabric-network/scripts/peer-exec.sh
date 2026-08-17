#!/usr/bin/env bash
#
# Run a `peer` command inside the cli container as a given organisation's admin.
#
# Usage: ./scripts/peer-exec.sh <hospital|practitioner|patient> <command...>
#
#   ./scripts/peer-exec.sh patient peer lifecycle chaincode queryinstalled
#   ./scripts/peer-exec.sh hospital peer channel list
#
# The cli container sets FABRIC_CFG_PATH but no peer identity, so a bare
# `docker exec cli peer ...` fails with:
#   cannot init crypto, specified path ".../msp" does not exist
# This wrapper supplies the MSP, address and TLS material for the chosen org.

set -euo pipefail

ORG="${1:-}"; shift || true
if [[ -z "$ORG" || $# -eq 0 ]]; then
  echo "usage: $0 <hospital|practitioner|patient> <command...>" >&2
  exit 2
fi

PEERBASE=/opt/gopath/src/github.com/hyperledger/fabric/peer

case "$ORG" in
  hospital)     MSP=HospitalOrgMSP;     PORT=7051;;
  practitioner) MSP=PractitionerOrgMSP; PORT=9051;;
  patient)      MSP=PatientOrgMSP;      PORT=11051;;
  *) echo "unknown org: $ORG (expected hospital, practitioner or patient)" >&2; exit 2;;
esac

exec docker exec \
  -e CORE_PEER_LOCALMSPID="$MSP" \
  -e CORE_PEER_ADDRESS="peer0.$ORG.healthcare.com:$PORT" \
  -e CORE_PEER_TLS_ENABLED=true \
  -e CORE_PEER_TLS_ROOTCERT_FILE="$PEERBASE/organizations/peerOrganizations/$ORG.healthcare.com/peers/peer0.$ORG.healthcare.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="$PEERBASE/organizations/peerOrganizations/$ORG.healthcare.com/users/Admin@$ORG.healthcare.com/msp" \
  cli "$@"
