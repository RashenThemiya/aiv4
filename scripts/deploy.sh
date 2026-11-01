#!/usr/bin/env bash
set -euo pipefail
cd /opt/whatsapp-chatbot
umask 077
chmod 600 .env .env.backend .env.rag
export IMAGE_TAG="${1:-latest}"
docker compose config --quiet
docker compose pull
docker compose up -d --remove-orphans --wait --wait-timeout 300
docker compose ps
# Keep data volumes and previous images for backups and manual rollback.
