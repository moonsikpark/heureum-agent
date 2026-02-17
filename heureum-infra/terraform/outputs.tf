output "acr_login_server" {
  description = "ACR login server URL"
  value       = azurerm_container_registry.acr.login_server
}

output "acr_name" {
  description = "ACR name"
  value       = azurerm_container_registry.acr.name
}

output "aks_cluster_name" {
  description = "AKS cluster name"
  value       = azurerm_kubernetes_cluster.aks.name
}

output "resource_group_name" {
  description = "Resource group name"
  value       = data.azurerm_resource_group.main.name
}

output "database_url" {
  description = "PostgreSQL connection string for Django"
  value       = "postgres://${var.postgres_admin_username}:${var.postgres_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/heureum?sslmode=require"
  sensitive   = true
}

output "postgres_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

# ─── Azure Storage Outputs ───────────────────────────────────────────────────

output "storage_account_name" {
  description = "Azure Storage Account name"
  value       = azurerm_storage_account.media.name
}

output "storage_account_key" {
  description = "Azure Storage Account primary access key"
  value       = azurerm_storage_account.media.primary_access_key
  sensitive   = true
}

output "storage_container_name" {
  description = "Azure Storage container name for media files"
  value       = azurerm_storage_container.media.name
}

# ─── Azure Communication Services Outputs ────────────────────────────────────

output "acs_connection_string" {
  description = "Azure Communication Service connection string"
  value       = azurerm_communication_service.main.primary_connection_string
  sensitive   = true
}

output "email_domain_verification_records" {
  description = "DNS verification records for the custom email domain. Configure these at your domain registrar, then verify in Azure Portal."
  value       = azurerm_email_communication_service_domain.custom.verification_records
}
