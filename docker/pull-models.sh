#!/usr/bin/env sh
# Download the local models RecallAI uses (one-time, ~2.3 GB for the defaults).
# Usage: ./docker/pull-models.sh            (reads model names from .env)
set -e

cd "$(dirname "$0")/.."
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && . ./.env && set +a
fi
CHAT_MODEL="${OLLAMA_CHAT_MODEL:-llama3.2:3b}"
EMBED_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"

echo "Pulling chat model:      $CHAT_MODEL"
docker compose exec ollama ollama pull "$CHAT_MODEL"
echo "Pulling embedding model: $EMBED_MODEL"
docker compose exec ollama ollama pull "$EMBED_MODEL"
echo "Done. Check readiness at http://localhost:8000/api/v1/health/ready/"
