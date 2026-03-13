#!/bin/bash
set -e

NETWORK_DIR="$HOME/Project/Final_year_project/fabric-network/network"
FABRIC_BIN="$HOME/Project/Final_year_project/fabric-network/fabric-samples/bin"
FABRIC_CFG_SAMPLES="$HOME/Project/Final_year_project/fabric-network/fabric-samples/config"

export PATH=$PATH:$FABRIC_BIN
export FABRIC_CFG_PATH=$NETWORK_DIR

cd $NETWORK_DIR

echo "Cleaning up..."
docker compose down -v 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true
rm -rf organizations channel-artifacts
mkdir -p channel-artifacts

echo "Generating crypto material..."
cryptogen generate --config=./crypto-config.yaml --output=./organizations

echo "Generating genesis block..."
configtxgen -profile HealthcareChannelGenesis \
  -outputBlock ./channel-artifacts/healthcare-channel.block \
  -channelID healthcare

echo "Starting containers..."
docker compose up -d
sleep 15

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

echo "Building chaincode..."
cd $HOME/Project/Final_year_project/fabric-network/chaincode
./node_modules/.bin/tsc
cd $NETWORK_DIR

echo "Packaging chaincode..."
peer lifecycle chaincode package healthcare.tar.gz \
  --path ../chaincode \
  --lang node \
  --label healthcare_1.0

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

echo "Getting package ID..."
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep healthcare_1.0 | awk '{print $3}' | tr -d ',')
echo "Package ID: $PACKAGE_ID"

echo "Approving chaincode..."
export CORE_PEER_LOCALMSPID="HospitalOrgMSP"
export CORE_PEER_ADDRESS=peer0.hospital.healthcare.com:7051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com --channelID healthcare --name healthcare --version 1.0 --package-id $PACKAGE_ID --sequence 1 --tls --cafile $ORDERER_CA

export CORE_PEER_LOCALMSPID="PractitionerOrgMSP"
export CORE_PEER_ADDRESS=peer0.practitioner.healthcare.com:9051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/users/Admin@practitioner.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com --channelID healthcare --name healthcare --version 1.0 --package-id $PACKAGE_ID --sequence 1 --tls --cafile $ORDERER_CA

export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_ADDRESS=peer0.patient.healthcare.com:11051
export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/users/Admin@patient.healthcare.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt
peer lifecycle chaincode approveformyorg -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com --channelID healthcare --name healthcare --version 1.0 --package-id $PACKAGE_ID --sequence 1 --tls --cafile $ORDERER_CA

echo "Committing chaincode..."
peer lifecycle chaincode commit -o orderer.healthcare.com:7050 --ordererTLSHostnameOverride orderer.healthcare.com --channelID healthcare --name healthcare --version 1.0 --sequence 1 --tls --cafile $ORDERER_CA \
  --peerAddresses peer0.hospital.healthcare.com:7051 --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt \
  --peerAddresses peer0.practitioner.healthcare.com:9051 --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt \
  --peerAddresses peer0.patient.healthcare.com:11051 --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt

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
echo ""
