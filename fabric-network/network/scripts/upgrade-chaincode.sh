#!/bin/bash
# Upgrades the healthcare chaincode to sequence 2.
# Run this after updating dist/record.js (added PatientOrgMSP to WRITER_MSPS).
# Usage: bash fabric-network/network/scripts/upgrade-chaincode.sh

set -e

NETWORK_DIR="$HOME/Project/Final_year_project/fabric-network/network"
CHAINCODE_DIR="$HOME/Project/Final_year_project/fabric-network/chaincode"
FABRIC_BIN="$HOME/Project/Final_year_project/fabric-network/fabric-samples/bin"
FABRIC_CFG_SAMPLES="$HOME/Project/Final_year_project/fabric-network/fabric-samples/config"
ORDERER_CA=$NETWORK_DIR/organizations/ordererOrganizations/healthcare.com/orderers/orderer.healthcare.com/tls/ca.crt

export PATH=$FABRIC_BIN:$PATH
export FABRIC_CFG_PATH=$FABRIC_CFG_SAMPLES

cd $NETWORK_DIR

echo "── Packaging updated chaincode (v2) ────────────────────────────────"
peer lifecycle chaincode package $NETWORK_DIR/healthcare_2.0.tar.gz \
  --path $CHAINCODE_DIR \
  --lang node \
  --label healthcare_2.0

echo "── Installing on HospitalOrg ───────────────────────────────────────"
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
export CORE_PEER_TLS_ENABLED=true
peer lifecycle chaincode install $NETWORK_DIR/healthcare_2.0.tar.gz

echo "── Installing on PractitionerOrg ───────────────────────────────────"
export CORE_PEER_LOCALMSPID="PractitionerOrgMSP"
export CORE_PEER_ADDRESS=peer0.practitioner.healthcare.com:9051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/users/Admin@practitioner.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt
peer lifecycle chaincode install $NETWORK_DIR/healthcare_2.0.tar.gz

echo "── Installing on PatientOrg ────────────────────────────────────────"
export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_ADDRESS=peer0.patient.healthcare.com:11051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/users/Admin@patient.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt
peer lifecycle chaincode install $NETWORK_DIR/healthcare_2.0.tar.gz

echo "── Getting new package ID ──────────────────────────────────────────"
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep healthcare_2.0 | awk '{print $3}' | tr -d ',')
echo "Package ID: $PACKAGE_ID"

POLICY="OutOf(2, 'HospitalOrgMSP.peer', 'PractitionerOrgMSP.peer', 'PatientOrgMSP.peer')"

echo "── Approving for HospitalOrg (seq 2) ──────────────────────────────"
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare --name healthcare --version 2.0 \
  --package-id $PACKAGE_ID --sequence 2 \
  --tls --cafile $ORDERER_CA --signature-policy "$POLICY"

echo "── Approving for PractitionerOrg (seq 2) ───────────────────────────"
export CORE_PEER_LOCALMSPID="PractitionerOrgMSP"
export CORE_PEER_ADDRESS=peer0.practitioner.healthcare.com:9051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/users/Admin@practitioner.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare --name healthcare --version 2.0 \
  --package-id $PACKAGE_ID --sequence 2 \
  --tls --cafile $ORDERER_CA --signature-policy "$POLICY"

echo "── Approving for PatientOrg (seq 2) ───────────────────────────────"
export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_ADDRESS=peer0.patient.healthcare.com:11051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/users/Admin@patient.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg \
  -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare --name healthcare --version 2.0 \
  --package-id $PACKAGE_ID --sequence 2 \
  --tls --cafile $ORDERER_CA --signature-policy "$POLICY"

echo "── Committing chaincode at sequence 2 ──────────────────────────────"
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
peer lifecycle chaincode commit \
  -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com \
  --channelID healthcare --name healthcare --version 2.0 --sequence 2 \
  --tls --cafile $ORDERER_CA \
  --signature-policy "$POLICY" \
  --peerAddresses peer0.hospital.healthcare.com:7051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt \
  --peerAddresses peer0.practitioner.healthcare.com:9051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt \
  --peerAddresses peer0.patient.healthcare.com:11051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt

echo "✓ Chaincode upgraded to v2.0 (sequence 2) — PatientOrgMSP now in WRITER_MSPS"
