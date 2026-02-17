# Reference existing resources
data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

data "azurerm_virtual_network" "main" {
  name                = var.vnet_name
  resource_group_name = data.azurerm_resource_group.main.name
}

# Use vNet location (koreasouth) since resources must be in the same region as the vNet
locals {
  location = data.azurerm_virtual_network.main.location
}

# Resize existing subnet to make room for postgres subnet
resource "azurerm_subnet" "aks" {
  name                 = var.subnet_name
  resource_group_name  = data.azurerm_resource_group.main.name
  virtual_network_name = data.azurerm_virtual_network.main.name
  address_prefixes     = [var.aks_subnet_prefix]
}

# Azure Container Registry
resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  sku                 = "Basic"
  admin_enabled       = true
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "aks" {
  name                = var.aks_cluster_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  dns_prefix          = "heureum"

  default_node_pool {
    name                 = "default"
    vm_size              = var.aks_vm_size
    vnet_subnet_id       = azurerm_subnet.aks.id
    auto_scaling_enabled = true
    min_count            = var.aks_node_min
    max_count            = var.aks_node_max
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
    service_cidr   = var.aks_service_cidr
    dns_service_ip = var.aks_dns_service_ip
  }
}

# NOTE: AKS->ACR pull access is handled via ACR admin credentials + imagePullSecrets
# (acr-secret) because the current subscription role does not allow creating role assignments.
# If your infra team grants Owner/UAA permissions, you can replace this with:
#   resource "azurerm_role_assignment" "aks_acr" { ... }
# or run: az aks update -n <cluster> -g <rg> --attach-acr <acr>

# PostgreSQL Flexible Server subnet (delegated)
resource "azurerm_subnet" "postgres" {
  name                 = "snet-postgres"
  resource_group_name  = data.azurerm_resource_group.main.name
  virtual_network_name = data.azurerm_virtual_network.main.name
  address_prefixes     = [var.postgres_subnet_prefix]

  delegation {
    name = "postgres-delegation"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action",
      ]
    }
  }

  depends_on = [azurerm_subnet.aks]
}

# Private DNS Zone for PostgreSQL
resource "azurerm_private_dns_zone" "postgres" {
  name                = "heureum.postgres.database.azure.com"
  resource_group_name = data.azurerm_resource_group.main.name
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "postgres-vnet-link"
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  resource_group_name   = data.azurerm_resource_group.main.name
  virtual_network_id    = data.azurerm_virtual_network.main.id
}

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                          = var.postgres_server_name
  resource_group_name           = data.azurerm_resource_group.main.name
  location                      = local.location
  version                       = "16"
  delegated_subnet_id           = azurerm_subnet.postgres.id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  administrator_login           = var.postgres_admin_username
  administrator_password        = var.postgres_admin_password
  storage_mb                    = 32768
  sku_name                      = "B_Standard_B1ms"
  zone                          = null
  public_network_access_enabled = false

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]
}

resource "azurerm_postgresql_flexible_server_database" "heureum" {
  name      = "heureum"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Enable built-in PgBouncer connection pooler (port 6432)
resource "azurerm_postgresql_flexible_server_configuration" "pgbouncer_enabled" {
  name      = "pgbouncer.enabled"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "True"
}

resource "azurerm_postgresql_flexible_server_configuration" "pgbouncer_default_pool_size" {
  name      = "pgbouncer.default_pool_size"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "50"
}

resource "azurerm_postgresql_flexible_server_configuration" "pgbouncer_pool_mode" {
  name      = "pgbouncer.pool_mode"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "transaction"
}

# ─── Azure Communication Services ───────────────────────────────────────────

# ─── Azure Storage Account (media / session files) ─────────────────────────

resource "azurerm_storage_account" "media" {
  name                     = var.storage_account_name
  resource_group_name      = data.azurerm_resource_group.main.name
  location                 = local.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "media" {
  name                  = "media"
  storage_account_id    = azurerm_storage_account.media.id
  container_access_type = "private"
}

# ─── Azure Communication Services ───────────────────────────────────────────

resource "azurerm_communication_service" "main" {
  name                = var.communication_service_name
  resource_group_name = data.azurerm_resource_group.main.name
  data_location       = "United States"
}

resource "azurerm_email_communication_service" "main" {
  name                = var.email_service_name
  resource_group_name = data.azurerm_resource_group.main.name
  data_location       = "United States"
}

resource "azurerm_email_communication_service_domain" "custom" {
  name              = var.custom_email_domain
  email_service_id  = azurerm_email_communication_service.main.id
  domain_management = "CustomerManaged"
}

resource "azurerm_communication_service_email_domain_association" "custom" {
  communication_service_id = azurerm_communication_service.main.id
  email_service_domain_id  = azurerm_email_communication_service_domain.custom.id
}
