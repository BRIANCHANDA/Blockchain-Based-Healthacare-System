#!/bin/bash
set -e
cd $HOME/Project/Final_year_project/fabric-network/network
docker compose up -d
echo "Waiting for peers to start..."
sleep 15
echo "Network restarted! All containers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "peer|orderer"
