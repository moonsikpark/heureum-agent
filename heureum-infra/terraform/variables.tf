variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "resource_group_name" {
  description = "Existing resource group name"
  type        = string
}

variable "vnet_name" {
  description = "Existing virtual network name"
  type        = string
}

variable "subnet_name" {
  description = "Existing subnet name"
  type        = string
}

variable "aks_subnet_prefix" {
  description = "CIDR prefix for the AKS subnet"
  type        = string
}

variable "postgres_subnet_prefix" {
  description = "CIDR prefix for the PostgreSQL subnet"
  type        = string
}

variable "aks_service_cidr" {
  description = "CIDR for AKS service network"
  type        = string
}

variable "aks_dns_service_ip" {
  description = "DNS service IP within aks_service_cidr"
  type        = string
}

variable "acr_name" {
  description = "Azure Container Registry name (no hyphens allowed)"
  type        = string
}

variable "aks_cluster_name" {
  description = "AKS cluster name"
  type        = string
}

variable "postgres_server_name" {
  description = "PostgreSQL Flexible Server name"
  type        = string
}

variable "postgres_admin_username" {
  description = "PostgreSQL admin username"
  type        = string
}

variable "postgres_admin_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "aks_node_min" {
  description = "Minimum number of AKS nodes (cluster autoscaler)"
  type        = number
  default     = 2
}

variable "aks_node_max" {
  description = "Maximum number of AKS nodes (cluster autoscaler)"
  type        = number
  default     = 5
}

variable "aks_vm_size" {
  description = "AKS node VM size"
  type        = string
  default     = "Standard_B2s"
}

variable "storage_account_name" {
  description = "Azure Storage Account name (3-24 chars, lowercase alphanumeric only)"
  type        = string
  default     = "stheureum"
}

variable "communication_service_name" {
  description = "Azure Communication Service name"
  type        = string
  default     = "acs-heureum"
}

variable "email_service_name" {
  description = "Azure Email Communication Service name"
  type        = string
  default     = "ecs-heureum"
}

variable "custom_email_domain" {
  description = "Custom domain for email (e.g., heureum.ai)"
  type        = string
}
