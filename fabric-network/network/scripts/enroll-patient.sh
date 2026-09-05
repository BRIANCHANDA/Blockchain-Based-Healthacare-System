#!/bin/bash
# Enrolls a patient identity with the PatientOrg Fabric CA.
# Run once per patient at account creation time.
#
# Usage:  ./scripts/enroll-patient.sh <patientId>
# Output: credentials written to  wallets/patients/<patientId>/
#         (cert.pem + key.pem)   — the backend reads these to sign
#         grantPermission / revokePermission on the patient's behalf.
#
# Prerequisites:
#   • start-network.sh has been run (ca.patient.healthcare.com is up)
#   • fabric-ca-client is on PATH (from fabric-samples/bin)
set -e

PATIENT_ID="${1:?Usage: $0 <patientId>}"
# Paths derived from this script's location rather than a fixed $HOME path, so
# the script works from any clone on any machine.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FABRIC_ROOT="$(cd "$NETWORK_DIR/.." && pwd)"
FABRIC_BIN="$FABRIC_ROOT/fabric-samples/bin"
export PATH=$PATH:$FABRIC_BIN

CA_URL="https://ca.patient.healthcare.com:7054"
CA_CERT="$NETWORK_DIR/organizations/peerOrganizations/patient.healthcare.com/ca/ca.patient.healthcare.com-cert.pem"
WALLET_DIR="$NETWORK_DIR/../wallets/patients/$PATIENT_ID"
export FABRIC_CA_CLIENT_HOME="$WALLET_DIR"

mkdir -p "$WALLET_DIR"

# ── Step 1: enroll the org CA admin (once per boot) ──────────────────────────
CA_ADMIN_DIR="$NETWORK_DIR/../wallets/ca-patient-admin"
if [ ! -f "$CA_ADMIN_DIR/msp/signcerts/cert.pem" ]; then
  mkdir -p "$CA_ADMIN_DIR"
  FABRIC_CA_CLIENT_HOME="$CA_ADMIN_DIR" \
    fabric-ca-client enroll \
      -u "https://admin:adminpw@ca.patient.healthcare.com:7054" \
      --caname ca.patient.healthcare.com \
      --tls.certfiles "$CA_CERT"
  echo "CA admin enrolled."
fi

# ── Step 2: register the patient with their patientId as enrollment ID ────────
FABRIC_CA_CLIENT_HOME="$CA_ADMIN_DIR" \
  fabric-ca-client register \
    --caname ca.patient.healthcare.com \
    --id.name "$PATIENT_ID" \
    --id.secret "patient-secret-${PATIENT_ID}" \
    --id.type client \
    --id.attrs "patientId=${PATIENT_ID}:ecert" \
    --tls.certfiles "$CA_CERT" 2>/dev/null || echo "(already registered, continuing)"

# ── Step 3: enroll the patient — cert CN will contain the patientId ───────────
fabric-ca-client enroll \
  -u "https://${PATIENT_ID}:patient-secret-${PATIENT_ID}@ca.patient.healthcare.com:7054" \
  --caname ca.patient.healthcare.com \
  --tls.certfiles "$CA_CERT" \
  --enrollment.attrs "patientId"

echo ""
echo "Patient '$PATIENT_ID' enrolled."
echo "  Cert: $WALLET_DIR/msp/signcerts/cert.pem"
echo "  Key:  $WALLET_DIR/msp/keystore/key.pem"
echo ""
echo "To enable per-patient enforcement in the chaincode, set ENFORCE_PATIENT_CN=true"
echo "in the backend environment and update requirePatientIdentity in accessControl.ts."
