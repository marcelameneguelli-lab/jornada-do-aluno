#!/bin/bash
# roda um teste de tela com o servidor simulado recém-iniciado
pkill -f servidor.js 2>/dev/null; sleep 0.5
node servidor.js > /tmp/servidor.log 2>&1 &
for i in $(seq 1 30); do curl -s localhost:8765/ >/dev/null && break; sleep 0.3; done
python3 "$1"; r=$?
pkill -f servidor.js; exit $r
