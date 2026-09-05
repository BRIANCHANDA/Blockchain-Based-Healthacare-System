#!/bin/bash
set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docker compose up -d
echo "Waiting for peers to start..."
sleep 15
echo "Network restarted! All containers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "peer|orderer"
