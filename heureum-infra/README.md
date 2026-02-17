# Heureum Infrastructure

Infrastructure configuration for deploying Heureum to Azure Kubernetes Service (AKS).

## Directory Structure

```
heureum-infra/
├── terraform/      # Azure resource provisioning (ACR, AKS, PostgreSQL)
├── k8s/            # Kubernetes manifests (deployments, services, ingress)
└── README.md
```

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.0
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- An existing Azure resource group and virtual network (provided by infra team)

## Terraform Setup

Terraform provisions the following Azure resources:

- **Azure Container Registry (ACR)** — stores Docker images
- **Azure Kubernetes Service (AKS)** — runs the application
- **PostgreSQL Flexible Server** — application database
- **Subnets** — dedicated subnets for AKS and PostgreSQL
- **Private DNS Zone** — internal DNS for PostgreSQL connectivity

### Usage

```bash
cd terraform

# Create terraform.tfvars from the example
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Login to Azure
az login

# Initialize and apply
terraform init
terraform apply
```

### Required Variables

See `terraform.tfvars.example` for all variables. Key ones:

| Variable | Description |
|----------|-------------|
| `subscription_id` | Azure subscription ID |
| `resource_group_name` | Existing resource group name |
| `vnet_name` | Existing virtual network name |
| `acr_name` | Container registry name (no hyphens) |
| `aks_cluster_name` | AKS cluster name |
| `postgres_server_name` | PostgreSQL server name |
| `postgres_admin_password` | PostgreSQL admin password |

## Kubernetes Manifests

| File | Description |
|------|-------------|
| `namespace.yaml` | Creates the `heureum` namespace |
| `secrets.yaml` | Template for secrets (actual values injected by CI/CD) |
| `agent.yaml` | Deployment + Service for heureum-agent (FastAPI, port 8000) |
| `platform.yaml` | Deployment + Service for heureum-platform (Django, port 8001) |
| `frontend.yaml` | Deployment + Service for heureum-frontend (Nginx, port 80) |
| `ingress.yaml` | NGINX ingress routing `/api/*` and `/v1/*` to platform, `/` to frontend |

### Manual Deployment

```bash
# Get AKS credentials
az aks get-credentials --resource-group <rg-name> --name <aks-name>

# Login to ACR
az acr login --name <acr-name>

# Build and push images (from repo root)
docker build --platform linux/amd64 -t <acr>.azurecr.io/heureum-agent:latest -f heureum-agent/Dockerfile heureum-agent/
docker build --platform linux/amd64 -t <acr>.azurecr.io/heureum-platform:latest -f heureum-platform/Dockerfile heureum-platform/
docker build --platform linux/amd64 -t <acr>.azurecr.io/heureum-frontend:latest --build-arg VITE_API_URL=/ -f heureum-frontend/Dockerfile heureum-frontend/

docker push <acr>.azurecr.io/heureum-agent:latest
docker push <acr>.azurecr.io/heureum-platform:latest
docker push <acr>.azurecr.io/heureum-frontend:latest

# Apply manifests
kubectl apply -f heureum-infra/k8s/namespace.yaml
kubectl apply -f heureum-infra/k8s/agent.yaml
kubectl apply -f heureum-infra/k8s/platform.yaml
kubectl apply -f heureum-infra/k8s/frontend.yaml
kubectl apply -f heureum-infra/k8s/ingress.yaml

# Set image tags
kubectl set image deployment/heureum-agent agent=<acr>.azurecr.io/heureum-agent:latest -n heureum
kubectl set image deployment/heureum-platform platform=<acr>.azurecr.io/heureum-platform:latest -n heureum
kubectl set image deployment/heureum-platform migrate=<acr>.azurecr.io/heureum-platform:latest -n heureum
kubectl set image deployment/heureum-frontend frontend=<acr>.azurecr.io/heureum-frontend:latest -n heureum
```

### NGINX Ingress Controller

The ingress requires an NGINX ingress controller. Install it once per cluster:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/cloud/deploy.yaml
```

This provisions an Azure Load Balancer with a public IP.

## CI/CD

Automated deployment is handled by `.github/workflows/deploy.yml` on push to `main`.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON for Azure login |
| `ACR_NAME` | ACR name (e.g., `acrheureum`) |
| `ACR_PASSWORD` | ACR admin password |
| `RESOURCE_GROUP` | Resource group name |
| `CLUSTER_NAME` | AKS cluster name |
| `OPENAI_API_KEY` | OpenAI API key for the agent service |
| `DJANGO_SECRET_KEY` | Django secret key for the platform |
| `DATABASE_URL` | PostgreSQL connection string |

### ACR Password

Retrieve the ACR admin password:

```bash
az acr credential show --name <acr-name> --query "passwords[0].value" -o tsv
```

### Azure Service Principal

Create a service principal for GitHub Actions:

```bash
az ad sp create-for-rbac --name "github-heureum" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/<rg-name> \
  --sdk-auth
```

Copy the JSON output into the `AZURE_CREDENTIALS` GitHub secret.
