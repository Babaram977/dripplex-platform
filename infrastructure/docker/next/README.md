# Thin wrappers so `docker build -f apps/<portal>/Dockerfile` works

# Actual build uses infrastructure/docker/Dockerfile.next

# syntax=docker/dockerfile:1.7

FROM scratch

# placeholder — see apps/*/Dockerfile which COPY from shared file via include
