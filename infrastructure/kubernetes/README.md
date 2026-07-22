# Apply order for Kubernetes (when migrating off Compose)

# 1. kubectl apply -f base/namespace.yaml

# 2. Create secret dripplex-backend-secrets (from sealed-secrets / external-secrets)

# 3. kubectl apply -f backend/

# 4. kubectl apply -f frontends/

# 5. kubectl apply -f ingress/

# Launch recommendation: Docker Compose on Hetzner; use these manifests when

# cluster ops maturity is ready (autoscaling already defined).
