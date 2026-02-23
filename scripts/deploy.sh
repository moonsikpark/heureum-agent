#!/bin/bash
set -euo pipefail

# Manual deploy script for Heureum.
#
# Usage:
#   ./scripts/deploy.sh infra         Terraform init + apply
#   ./scripts/deploy.sh aks           Build, push, and deploy to AKS
#   ./scripts/deploy.sh all           Both infra and aks (infra first)
#
# Reads configuration from heureum-infra/.env.deploy.
# See heureum-infra/.env.deploy.example for the template.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/heureum-infra/.env.deploy"

# ── Load env file ─────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found." >&2
  echo "Copy heureum-infra/.env.deploy.example to heureum-infra/.env.deploy and fill in values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── Defaults ──────────────────────────────────────────────────────────────────
TAG="${TAG:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
SERVICES="${SERVICES:-agent platform frontend mcp}"
SKIP_BUILD="${SKIP_BUILD:-0}"

# ── Subcommands ───────────────────────────────────────────────────────────────

deploy_infra() {
  echo ""
  echo "Terraform Deploy"
  echo "================"

  local tf_dir="$ROOT_DIR/heureum-infra/terraform"

  echo "Initializing Terraform..."
  terraform -chdir="$tf_dir" init

  echo "Planning..."
  terraform -chdir="$tf_dir" plan

  echo ""
  read -rp "Apply these changes? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    terraform -chdir="$tf_dir" apply -auto-approve
    echo "✓ Terraform applied"
  else
    echo "Terraform apply skipped."
  fi
}

deploy_aks() {
  # Validate required vars
  for var in ACR_NAME RESOURCE_GROUP CLUSTER_NAME DOMAIN; do
    if [ -z "${!var:-}" ]; then
      echo "Error: $var is not set in .env.deploy" >&2
      exit 1
    fi
  done

  local ACR="${ACR_NAME}.azurecr.io"

  echo ""
  echo "AKS Deploy"
  echo "=========="
  echo "  ACR:       $ACR"
  echo "  Cluster:   $CLUSTER_NAME"
  echo "  Domain:    $DOMAIN"
  echo "  Tag:       ${TAG:0:12}"
  echo "  Services:  $SERVICES"
  echo ""

  # --- Login ---
  echo "Logging in to Azure and ACR..."
  az acr login --name "$ACR_NAME"
  az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --overwrite-existing
  echo "✓ Logged in"

  # --- Build & Push ---
  if [ "$SKIP_BUILD" != "1" ]; then
    for svc in $SERVICES; do
      echo "Building heureum-$svc..."
      case "$svc" in
        frontend)
          docker build -t "$ACR/heureum-frontend:$TAG" \
            --build-arg VITE_API_URL=/ \
            -f "$ROOT_DIR/heureum-frontend/Dockerfile" "$ROOT_DIR/heureum-frontend/"
          ;;
        *)
          docker build -t "$ACR/heureum-$svc:$TAG" \
            -f "$ROOT_DIR/heureum-$svc/Dockerfile" "$ROOT_DIR/heureum-$svc/"
          ;;
      esac
      docker push "$ACR/heureum-$svc:$TAG"
      echo "✓ Pushed heureum-$svc:${TAG:0:12}"
    done
  else
    echo "Skipping build (SKIP_BUILD=1)"
  fi

  # --- Namespace & cert-manager ---
  echo "Applying namespace..."
  kubectl apply -f "$ROOT_DIR/heureum-infra/k8s/namespace.yaml"

  echo "Installing cert-manager..."
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.17.2/cert-manager.yaml
  kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=120s
  kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=120s

  echo "Applying ClusterIssuer..."
  kubectl apply -f "$ROOT_DIR/heureum-infra/k8s/cluster-issuer.yaml"

  # --- Secrets ---
  echo "Creating/updating K8s secrets..."
  kubectl create secret generic heureum-secrets \
    --namespace=heureum \
    --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
    --from-literal=SECRET_KEY="${DJANGO_SECRET_KEY:-}" \
    --from-literal=DATABASE_URL="${DATABASE_URL:-}" \
    --from-literal=AZURE_COMMUNICATION_CONNECTION_STRING="${AZURE_COMMUNICATION_CONNECTION_STRING:-}" \
    --from-literal=DEFAULT_FROM_EMAIL="${DEFAULT_FROM_EMAIL:-}" \
    --from-literal=FRONTEND_URL="${FRONTEND_URL:-}" \
    --from-literal=GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
    --from-literal=GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
    --from-literal=MICROSOFT_CLIENT_ID="${MICROSOFT_CLIENT_ID:-}" \
    --from-literal=MICROSOFT_CLIENT_SECRET="${MICROSOFT_CLIENT_SECRET:-}" \
    --from-literal=AZURE_STORAGE_ACCOUNT_NAME="${AZURE_STORAGE_ACCOUNT_NAME:-}" \
    --from-literal=AZURE_STORAGE_ACCOUNT_KEY="${AZURE_STORAGE_ACCOUNT_KEY:-}" \
    --from-literal=AZURE_STORAGE_CONTAINER_NAME="${AZURE_STORAGE_CONTAINER_NAME:-}" \
    --dry-run=client -o yaml | kubectl apply -f -

  # GCP service account key
  if [ -n "${GCP_SA_KEY_FILE:-}" ] && [ -f "$GCP_SA_KEY_FILE" ]; then
    echo "Creating/updating GCP service account secret..."
    kubectl create secret generic gcp-sa-key \
      --namespace=heureum \
      --from-file=key.json="$GCP_SA_KEY_FILE" \
      --dry-run=client -o yaml | kubectl apply -f -
  else
    echo "Warning: GCP_SA_KEY_FILE not set or file not found, skipping gcp-sa-key secret"
  fi

  # ACR pull secret
  kubectl create secret docker-registry acr-secret \
    --namespace=heureum \
    --docker-server="$ACR" \
    --docker-username="$ACR_NAME" \
    --docker-password="${ACR_PASSWORD:-}" \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "✓ Secrets applied"

  # --- Template domain into manifests (work on copies) ---
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  cp "$ROOT_DIR/heureum-infra/k8s/ingress.yaml" "$tmpdir/ingress.yaml"
  cp "$ROOT_DIR/heureum-infra/k8s/platform.yaml" "$tmpdir/platform.yaml"
  sed -i'' -e "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$tmpdir/ingress.yaml" "$tmpdir/platform.yaml"

  # --- Apply manifests ---
  echo "Applying Kubernetes manifests..."
  for svc in $SERVICES; do
    case "$svc" in
      platform)
        kubectl apply -f "$tmpdir/platform.yaml"
        ;;
      *)
        kubectl apply -f "$ROOT_DIR/heureum-infra/k8s/$svc.yaml"
        ;;
    esac
  done
  kubectl apply -f "$tmpdir/ingress.yaml"
  echo "✓ Manifests applied"

  # --- Update image tags ---
  echo "Updating image tags..."
  for svc in $SERVICES; do
    kubectl set image "deployment/heureum-$svc" "$svc=$ACR/heureum-$svc:$TAG" -n heureum
  done
  if echo "$SERVICES" | grep -qw platform; then
    kubectl set image deployment/heureum-platform "migrate=$ACR/heureum-platform:$TAG" -n heureum
  fi
  echo "✓ Image tags updated"

  # --- Wait for rollouts ---
  echo "Waiting for rollouts..."
  for svc in $SERVICES; do
    kubectl rollout status "deployment/heureum-$svc" -n heureum --timeout=120s
  done
  echo "✓ All deployments rolled out"
}

# ── Main ──────────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 {infra|aks|all}"
  echo ""
  echo "  infra    Terraform init + plan + apply"
  echo "  aks      Build, push, and deploy services to AKS"
  echo "  all      Run infra then aks"
  exit 1
}

COMMAND="${1:-}"

case "$COMMAND" in
  infra)
    deploy_infra
    ;;
  aks)
    deploy_aks
    ;;
  all)
    deploy_infra
    deploy_aks
    ;;
  *)
    usage
    ;;
esac

echo ""
echo "Done!"
