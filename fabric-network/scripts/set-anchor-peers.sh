#!/usr/bin/env bash
#
# Set the anchor peer for each organisation on the healthcare channel.
#
# Why this is needed: without anchor peers, gossip membership never forms
# ACROSS organisations. Each peer only ever knows about itself, so the peer's
# discovery service cannot build an endorsement plan that spans two orgs — and
# the chaincode's OutOf(2, HospitalOrgMSP, PractitionerOrgMSP, PatientOrgMSP)
# policy needs exactly that. The symptom is:
#
#   FailedPrecondition ... no combination of peers can be derived which satisfy
#   the endorsement policy
#
# Each org's anchor peer lives in that org's own config group, whose mod_policy
# is that org's Admins — so each update only needs that one org's signature.
#
# Idempotent: an org that already has an anchor peer is skipped.

set -euo pipefail

CHANNEL=healthcare
PEERBASE=/opt/gopath/src/github.com/hyperledger/fabric/peer
ORDERER=orderer.healthcare.com:7050
ORDCA=$PEERBASE/organizations/ordererOrganizations/healthcare.com/orderers/orderer.healthcare.com/msp/tlscacerts/tlsca.healthcare.com-cert.pem

org_msp()  { case $1 in hospital) echo HospitalOrgMSP;; practitioner) echo PractitionerOrgMSP;; patient) echo PatientOrgMSP;; esac; }
org_port() { case $1 in hospital) echo 7051;; practitioner) echo 9051;; patient) echo 11051;; esac; }

# Run a peer/configtxlator command inside the cli container as <org>'s admin.
as_org() {
  local org=$1; shift
  docker exec \
    -e CORE_PEER_LOCALMSPID="$(org_msp "$org")" \
    -e CORE_PEER_ADDRESS="peer0.$org.healthcare.com:$(org_port "$org")" \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_ROOTCERT_FILE="$PEERBASE/organizations/peerOrganizations/$org.healthcare.com/peers/peer0.$org.healthcare.com/tls/ca.crt" \
    -e CORE_PEER_MSPCONFIGPATH="$PEERBASE/organizations/peerOrganizations/$org.healthcare.com/users/Admin@$org.healthcare.com/msp" \
    cli "$@"
}

for org in hospital practitioner patient; do
  MSP=$(org_msp "$org")
  PORT=$(org_port "$org")
  HOST="peer0.$org.healthcare.com"
  W=/tmp/anchor_$org

  echo "=================== $MSP ==================="
  as_org "$org" rm -rf "$W"
  as_org "$org" mkdir -p "$W"

  echo "--> fetching current channel config"
  as_org "$org" peer channel fetch config "$W/config_block.pb" \
    -o "$ORDERER" -c "$CHANNEL" --tls --cafile "$ORDCA" >/dev/null 2>&1

  as_org "$org" sh -c "cd $W && configtxlator proto_decode --input config_block.pb --type common.Block --output config_block.json"
  as_org "$org" sh -c "cd $W && jq '.data.data[0].payload.data.config' config_block.json > config.json"

  if as_org "$org" sh -c "jq -e '.channel_group.groups.Application.groups.\"$MSP\".values.AnchorPeers' $W/config.json" >/dev/null 2>&1; then
    echo "--> anchor peer already set, skipping"
    continue
  fi

  echo "--> adding anchor peer $HOST:$PORT"
  as_org "$org" sh -c "cd $W && jq '.channel_group.groups.Application.groups.\"$MSP\".values += {\"AnchorPeers\":{\"mod_policy\":\"Admins\",\"value\":{\"anchor_peers\":[{\"host\":\"$HOST\",\"port\":$PORT}]},\"version\":\"0\"}}' config.json > modified_config.json"

  as_org "$org" sh -c "cd $W && configtxlator proto_encode --input config.json          --type common.Config --output config.pb"
  as_org "$org" sh -c "cd $W && configtxlator proto_encode --input modified_config.json --type common.Config --output modified_config.pb"
  as_org "$org" sh -c "cd $W && configtxlator compute_update --channel_id $CHANNEL --original config.pb --updated modified_config.pb --output update.pb"
  as_org "$org" sh -c "cd $W && configtxlator proto_decode --input update.pb --type common.ConfigUpdate --output update.json"
  as_org "$org" sh -c "cd $W && echo '{\"payload\":{\"header\":{\"channel_header\":{\"channel_id\":\"$CHANNEL\",\"type\":2}},\"data\":{\"config_update\":'\$(cat update.json)'}}}' | jq . > update_in_envelope.json"
  as_org "$org" sh -c "cd $W && configtxlator proto_encode --input update_in_envelope.json --type common.Envelope --output update_in_envelope.pb"

  echo "--> submitting config update"
  as_org "$org" peer channel update -f "$W/update_in_envelope.pb" -c "$CHANNEL" \
    -o "$ORDERER" --tls --cafile "$ORDCA"
done

echo
echo "=================== verification ==================="
docker exec cli sh -c "cd /tmp/anchor_hospital && jq -r '.data.data[0].payload.data.config.channel_group.groups.Application.groups | to_entries[] | \"\(.key): \(.value.values.AnchorPeers.value.anchor_peers // \"NONE\")\"' config_block.json" 2>/dev/null || true
echo "(re-run to see the post-update state)"
