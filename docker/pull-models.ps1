# Download the local models RecallAI uses (one-time, ~2.3 GB for the defaults).
# Usage (PowerShell, from the repo root):  .\docker\pull-models.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$envVars = @{}
if (Test-Path ".env") {
  Get-Content ".env" | Where-Object { $_ -match "^\s*([A-Z_]+)=(.*)$" } | ForEach-Object {
    $envVars[$Matches[1]] = $Matches[2].Trim('"')
  }
}
$chat = if ($envVars["OLLAMA_CHAT_MODEL"]) { $envVars["OLLAMA_CHAT_MODEL"] } else { "llama3.2:3b" }
$embed = if ($envVars["OLLAMA_EMBEDDING_MODEL"]) { $envVars["OLLAMA_EMBEDDING_MODEL"] } else { "nomic-embed-text" }

Write-Host "Pulling chat model:      $chat"
docker compose exec ollama ollama pull $chat
Write-Host "Pulling embedding model: $embed"
docker compose exec ollama ollama pull $embed
Write-Host "Done. Check readiness at http://localhost:8000/api/v1/health/ready/"
