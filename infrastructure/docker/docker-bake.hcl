# docker-bake.hcl — Program D2 image matrix
variable "REGISTRY" {
  default = "ghcr.io/babaram977"
}

variable "TAG" {
  default = "latest"
}

variable "API_BASE" {
  default = "https://api.dripplex.com/api/v1"
}

group "default" {
  targets = ["backend-core", "customer-web", "merchant-portal", "rider-portal", "admin-portal"]
}

target "backend-core" {
  context    = "."
  dockerfile = "apps/backend/Dockerfile"
  tags = [
    "${REGISTRY}/dripplex-backend-core:${TAG}",
    "${REGISTRY}/dripplex-backend-core:latest",
  ]
}

target "customer-web" {
  context    = "."
  dockerfile = "apps/customer-web/Dockerfile"
  args = {
    NEXT_PUBLIC_API_BASE_URL = API_BASE
    NEXT_PUBLIC_APP_URL      = "https://www.dripplex.com"
  }
  tags = [
    "${REGISTRY}/dripplex-customer-web:${TAG}",
    "${REGISTRY}/dripplex-customer-web:latest",
  ]
}

target "merchant-portal" {
  context    = "."
  dockerfile = "apps/merchant-portal/Dockerfile"
  args = {
    NEXT_PUBLIC_API_BASE_URL = API_BASE
    NEXT_PUBLIC_APP_URL      = "https://merchant.dripplex.com"
  }
  tags = [
    "${REGISTRY}/dripplex-merchant-portal:${TAG}",
    "${REGISTRY}/dripplex-merchant-portal:latest",
  ]
}

target "rider-portal" {
  context    = "."
  dockerfile = "apps/rider-portal/Dockerfile"
  args = {
    NEXT_PUBLIC_API_BASE_URL = API_BASE
    NEXT_PUBLIC_APP_URL      = "https://rider.dripplex.com"
  }
  tags = [
    "${REGISTRY}/dripplex-rider-portal:${TAG}",
    "${REGISTRY}/dripplex-rider-portal:latest",
  ]
}

target "admin-portal" {
  context    = "."
  dockerfile = "apps/admin-portal/Dockerfile"
  args = {
    NEXT_PUBLIC_API_BASE_URL = API_BASE
    NEXT_PUBLIC_APP_URL      = "https://admin.dripplex.com"
  }
  tags = [
    "${REGISTRY}/dripplex-admin-portal:${TAG}",
    "${REGISTRY}/dripplex-admin-portal:latest",
  ]
}
