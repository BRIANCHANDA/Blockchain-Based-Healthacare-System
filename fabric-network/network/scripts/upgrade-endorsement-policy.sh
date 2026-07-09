#!/bin/bash
# Upgrades the running chaincode endorsement policy from OR(any 1) to OutOf(2-of-3).
# Run this ONCE on a live network — it does NOT restart containers or wipe data.
# Sequence bumps from 1 → 2; version stays at 1.0 (logic unchanged).
set -e

NETWORK_DIR="$HOME/Project/Final_year_project/fabric-network/network"
FABRIC_BIN="$HOME/Project/Final_year_project/fabric-network/fabric-samples/bin"
FABRIC_CFG_SAMPLES="$HOME/Project/Final_year_project/fabric-network/fabric-samples/config"

export PATH=$PATH:$FABRIC_BIN
export FABRIC_CFG_PATH=$FABRIC_CFG_SAMPLES

ORDERER_CA=$NETWORK_DIR/organizations/ordererOrganizations/healthcare.com/orderers/orderer.healthcare.com/tls/ca.crt
NEW_POLICY="OutOf(2, 'HospitalOrgMSP.peer', 'PractitionerOrgMSP.peer', 'PatientOrgMSP.peer')"

# Get the installed package ID (already on peers from sequence 1)
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt

PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep healthcare_1.0 | awk '{print $3}' | tr -d ',')
echo "Package ID: $PACKAGE_ID"

# ── Approve new policy at sequence 2 for all orgs ────────────────────────────

echo "Approving new policy for HospitalOrg (seq 2)..."
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare --name healthcare --version 1.0 \
  --package-id $PACKAGE_ID --sequence 2 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "$NEW_POLICY"

echo "Approving new policy for PractitionerOrg (seq 2)..."
export CORE_PEER_LOCALMSPID="PractitionerOrgMSP"
export CORE_PEER_ADDRESS=peer0.practitioner.healthcare.com:9051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/users/Admin@practitioner.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare --name healthcare --version 1.0 \
  --package-id $PACKAGE_ID --sequence 2 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "$NEW_POLICY"

echo "Approving new policy for PatientOrg (seq 2)..."
export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_ADDRESS=peer0.patient.healthcare.com:11051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/users/Admin@patient.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare --name healthcare --version 1.0 \
  --package-id $PACKAGE_ID --sequence 2 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "$NEW_POLICY"

# ── Commit at sequence 2 ──────────────────────────────────────────────────────

echo "Committing new endorsement policy..."
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
peer lifecycle chaincode commit \
  -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare --name healthcare --version 1.0 --sequence 2 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "$NEW_POLICY" \
  --peerAddresses peer0.hospital.healthcare.com:7051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt \
  --peerAddresses peer0.practitioner.healthcare.com:9051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt \
  --peerAddresses peer0.patient.healthcare.com:11051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt

echo ""
echo "✓ Endorsement policy upgraded to OutOf(2-of-3) at sequence 2"
echo "  Any transaction now requires endorsement from 2 of the 3 org peers."
echo "  The Fabric Gateway backend collects cross-org endorsements automatically."
