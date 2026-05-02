#!/bin/bash

# Safe Docker cleanup script for ft_transcendence project
# This script removes only this project's containers, volumes, and images

set -e

PROJECT_NAME="transcendence"
FORCE_FLAG="${1:-}"

echo "=========================================="
echo "Docker Cleanup for $PROJECT_NAME"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker daemon is not running."
  exit 1
fi

# Ask for confirmation unless --force is passed
if [ "$FORCE_FLAG" != "--force" ]; then
  echo "This will remove:"
  echo "  - All containers named *${PROJECT_NAME}*"
  echo "  - All volumes named *${PROJECT_NAME}*"
  echo "  - All images built for ${PROJECT_NAME}"
  echo ""
  read -p "Are you sure? (yes/no): " -r CONFIRM
  echo ""
  
  if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
  fi
fi

# Stop and remove containers
echo "[1/4] Stopping and removing containers..."
CONTAINERS=$(docker ps -a --filter "label=com.docker.compose.project=${PROJECT_NAME}" -q 2>/dev/null || true)
if [ -n "$CONTAINERS" ]; then
  docker stop $CONTAINERS 2>/dev/null || true
  docker rm $CONTAINERS 2>/dev/null || true
  echo "  ✓ Containers removed"
else
  echo "  ✓ No containers found"
fi

# Remove volumes
echo "[2/4] Removing volumes..."
VOLUMES=$(docker volume ls --filter "name=${PROJECT_NAME}" -q 2>/dev/null || true)
if [ -n "$VOLUMES" ]; then
  docker volume rm $VOLUMES 2>/dev/null || true
  echo "  ✓ Volumes removed"
else
  echo "  ✓ No volumes found"
fi

# Remove images
echo "[3/4] Removing images..."
IMAGES=$(docker images --filter "reference=*${PROJECT_NAME}*" -q 2>/dev/null || true)
if [ -n "$IMAGES" ]; then
  docker rmi $IMAGES 2>/dev/null || true
  echo "  ✓ Images removed"
else
  echo "  ✓ No images found"
fi

# Prune dangling resources
echo "[4/4] Pruning dangling resources..."
docker image prune -f --filter "until=1h" > /dev/null 2>&1 || true
docker container prune -f > /dev/null 2>&1 || true
echo "  ✓ Dangling resources pruned"

echo ""
echo "=========================================="
echo "✓ Cleanup complete!"
echo "=========================================="
echo ""
echo "To restart, run:"
echo "  docker compose up --build"
echo ""
