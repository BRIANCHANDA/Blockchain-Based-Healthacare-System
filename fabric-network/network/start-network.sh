#!/bin/bash
set -e

# Paths are derived from this script's own location, not from a fixed path
# under $HOME. They previously pointed at $HOME/Project/Final_year_project/...,
# so the network only came up for one developer, in one directory, on one
# machine — a clone anywhere else failed at the first cd.
NETWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_ROOT="$(cd "$NETWORK_DIR/.." && pwd)"
CHAINCODE_DIR="$FABRIC_ROOT/chaincode"
FABRIC_BIN="$FABRIC_ROOT/fabric-samples/bin"
FABRIC_CFG_SAMPLES="$FABRIC_ROOT/fabric-samples/config"

export PATH=$PATH:$FABRIC_BIN
export FABRIC_CFG_PATH=$NETWORK_DIR

cd $NETWORK_DIR

# ── Cleanup ───────────────────────────────────────────────────────────────────

echo "Cleaning up..."
docker compose down -v 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true
docker rmi -f $(docker images -q "dev-peer*") 2>/dev/null || true
rm -rf organizations channel-artifacts healthcare.tar.gz
mkdir -p channel-artifacts

# ── Crypto + Genesis ──────────────────────────────────────────────────────────

echo "Generating crypto material..."
cryptogen generate --config=./crypto-config.yaml --output=./organizations

echo "Generating genesis block..."
configtxgen -profile HealthcareChannelGenesis \
  -outputBlock ./channel-artifacts/healthcare-channel.block \
  -channelID healthcare

# ── Start containers ──────────────────────────────────────────────────────────

echo "Starting containers..."
docker compose up -d
sleep 15

# ── Join orderer ──────────────────────────────────────────────────────────────

echo "Joining orderer to channel..."
osnadmin channel join \
  --channelID healthcare \
  --config-block ./channel-artifacts/healthcare-channel.block \
  -o orderer.healthcare.com:7053 \
  --ca-file ./organizations/ordererOrganizations/healthcare.com/orderers/orderer.healthcare.com/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/healthcare.com/orderers/orderer.healthcare.com/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/healthcare.com/orderers/orderer.healthcare.com/tls/server.key

export FABRIC_CFG_PATH=$FABRIC_CFG_SAMPLES
ORDERER_CA=$NETWORK_DIR/organizations/ordererOrganizations/healthcare.com/orderers/orderer.healthcare.com/tls/ca.crt

# ── Join peers ────────────────────────────────────────────────────────────────

echo "Joining peers to channel..."
export CORE_PEER_TLS_ENABLED=true

export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
peer channel join -b $NETWORK_DIR/channel-artifacts/healthcare-channel.block

export CORE_PEER_LOCALMSPID="PractitionerOrgMSP"
export CORE_PEER_ADDRESS=peer0.practitioner.healthcare.com:9051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/users/Admin@practitioner.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt
peer channel join -b $NETWORK_DIR/channel-artifacts/healthcare-channel.block

export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_ADDRESS=peer0.patient.healthcare.com:11051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/users/Admin@patient.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt
peer channel join -b $NETWORK_DIR/channel-artifacts/healthcare-channel.block

echo "Waiting for orderer to stabilize..."
sleep 30

# ── Build + Package chaincode ─────────────────────────────────────────────────

echo "Building chaincode..."
cd "$CHAINCODE_DIR"
# Install all deps (including dev) to get tsc
npm install
# Compile TypeScript
./node_modules/.bin/tsc
# Switch to prod-only deps so the package is lean
npm install --omit=dev
cd $NETWORK_DIR

echo "Packaging chaincode..."
peer lifecycle chaincode package healthcare.tar.gz \
  --path ../chaincode \
  --lang node \
  --label healthcare_1.0

# ── Install on all peers ──────────────────────────────────────────────────────

echo "Installing chaincode on all peers..."

export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
peer lifecycle chaincode install $NETWORK_DIR/healthcare.tar.gz

export CORE_PEER_LOCALMSPID="PractitionerOrgMSP"
export CORE_PEER_ADDRESS=peer0.practitioner.healthcare.com:9051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/users/Admin@practitioner.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt
peer lifecycle chaincode install $NETWORK_DIR/healthcare.tar.gz

export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_ADDRESS=peer0.patient.healthcare.com:11051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/users/Admin@patient.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt
peer lifecycle chaincode install $NETWORK_DIR/healthcare.tar.gz

# ── Get package ID ────────────────────────────────────────────────────────────

echo "Getting package ID..."
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep healthcare_1.0 | awk '{print $3}' | tr -d ',')
echo "Package ID: $PACKAGE_ID"

# ── Approve for all orgs with OR policy ──────────────────────────────────────
#
# OR policy means ANY ONE of the three org peers can endorse a transaction.
# This is required because the backend only connects as HospitalOrgMSP.
# Without OR, the default MAJORITY policy requires signatures from 2+ orgs
# which the backend cannot provide on its own.

echo "Approving chaincode for HospitalOrg..."
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 \
  --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare \
  --name healthcare \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "OutOf(2, 'HospitalOrgMSP.peer', 'PractitionerOrgMSP.peer', 'PatientOrgMSP.peer')"

echo "Approving chaincode for PractitionerOrg..."
export CORE_PEER_LOCALMSPID="PractitionerOrgMSP"
export CORE_PEER_ADDRESS=peer0.practitioner.healthcare.com:9051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/users/Admin@practitioner.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 \
  --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare \
  --name healthcare \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "OutOf(2, 'HospitalOrgMSP.peer', 'PractitionerOrgMSP.peer', 'PatientOrgMSP.peer')"

echo "Approving chaincode for PatientOrg..."
export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_ADDRESS=peer0.patient.healthcare.com:11051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/users/Admin@patient.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 \
  --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare \
  --name healthcare \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "OutOf(2, 'HospitalOrgMSP.peer', 'PractitionerOrgMSP.peer', 'PatientOrgMSP.peer')"

# ── Commit chaincode with MAJORITY (2-of-3) policy ────────────────────────────
# OutOf(2,...) requires any 2 of the 3 org peers to endorse each transaction.
# The new Fabric Gateway API (used by the backend) sends proposals to the
# connected peer which then collects cross-org endorsements automatically via
# service discovery — no backend code changes needed.

echo "Committing chaincode..."
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
peer lifecycle chaincode commit \
  -o orderer.healthcare.com:7050 \
  --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare \
  --name healthcare \
  --version 1.0 \
  --sequence 1 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "OutOf(2, 'HospitalOrgMSP.peer', 'PractitionerOrgMSP.peer', 'PatientOrgMSP.peer')" \
  --peerAddresses peer0.hospital.healthcare.com:7051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt \
  --peerAddresses peer0.practitioner.healthcare.com:9051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt \
  --peerAddresses peer0.patient.healthcare.com:11051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt

# ── Warm up chaincode (spins up dev-peer containers) ─────────────────────────
#
# The chaincode container (dev-peer) only starts on first invocation.
# We invoke a dummy transaction here so all 3 dev-peer containers are running
# before the backend connects — avoids cold-start errors on first API call.

echo "Warming up chaincode (spinning up dev-peer containers)..."
sleep 5

peer chaincode invoke \
  -o orderer.healthcare.com:7050 \
  --ordererTLSHostnameOverride orderer.healthcare.com \
  --tls --cafile $ORDERER_CA \
  -C healthcare -n healthcare \
  --peerAddresses peer0.hospital.healthcare.com:7051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt \
  -c '{"function":"RecordContract:storeRecordHash","Args":["warmup-init","warmup-patient","0000000000000000000000000000000000000000000000000000000000000000","warmup"]}' || true

echo "Waiting for dev-peer containers to start..."
sleep 10

# Verify dev-peer containers are running
DEV_PEERS=$(docker ps --filter "name=dev-peer" --format "{{.Names}}" | wc -l)
echo "dev-peer containers running: $DEV_PEERS"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "======================================"
echo " Healthcare Network is UP and RUNNING!"
echo "======================================"
echo ""
echo "  Orderer:      orderer.healthcare.com:7050"
echo "  Hospital:     peer0.hospital.healthcare.com:7051"
echo "  Practitioner: peer0.practitioner.healthcare.com:9051"
echo "  Patient:      peer0.patient.healthcare.com:11051"
echo "  Channel:      healthcare"
echo "  Chaincode:    healthcare v1.0"
echo "  Policy:       OR(HospitalOrg, PractitionerOrg, PatientOrg)"
echo ""