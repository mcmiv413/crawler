#!/bin/bash

# Docker Build Verification Script
# Tests that Docker images build and start successfully

set -e

echo "🐳 Docker Build Verification Test"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TIMEOUT=120
HEALTH_CHECK_INTERVAL=2
MAX_RETRIES=30

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Step 1: Clean up old containers
print_info "Cleaning up old containers and images..."
docker-compose down 2>/dev/null || true
docker system prune -f --volumes >/dev/null 2>&1 || true
print_status "Cleanup complete"

# Step 2: Build Docker images
print_info "Building Docker images..."
if docker-compose build --no-cache; then
    print_status "Docker images built successfully"
else
    print_error "Docker build failed"
    exit 1
fi

# Step 3: Start containers
print_info "Starting containers..."
docker-compose up -d
print_status "Containers started"

# Step 4: Health check - wait for services to be ready
print_info "Waiting for services to be healthy..."

# Check server health
server_ready=false
for i in $(seq 1 $MAX_RETRIES); do
    if curl -s http://localhost:3000/api/games >/dev/null 2>&1; then
        print_status "Server is healthy"
        server_ready=true
        break
    fi
    if [ $i -eq $MAX_RETRIES ]; then
        print_error "Server failed to start within ${TIMEOUT}s"
        docker-compose logs server
        exit 1
    fi
    echo -n "."
    sleep $HEALTH_CHECK_INTERVAL
done

# Check web health
web_ready=false
for i in $(seq 1 $MAX_RETRIES); do
    if curl -s http://localhost:8080 >/dev/null 2>&1; then
        print_status "Web is healthy"
        web_ready=true
        break
    fi
    if [ $i -eq $MAX_RETRIES ]; then
        print_error "Web failed to start within ${TIMEOUT}s"
        docker-compose logs web
        exit 1
    fi
    echo -n "."
    sleep $HEALTH_CHECK_INTERVAL
done

echo ""

# Step 5: Test API endpoints
print_info "Testing API endpoints..."

# Test GET /api/games
if curl -s http://localhost:3000/api/games -X POST -H "Content-Type: application/json" -d '{"playerName":"Docker Test"}' | grep -q "gameId"; then
    print_status "POST /api/games works"
else
    print_error "POST /api/games failed"
    docker-compose logs server
    exit 1
fi

# Step 6: Verify web app loads
print_info "Verifying web app..."
if curl -s http://localhost:8080 | grep -q "Dungeon Crawler"; then
    print_status "Web app loads successfully"
else
    print_error "Web app failed to load"
    docker-compose logs web
    exit 1
fi

# Step 7: Cleanup
print_info "Cleaning up..."
docker-compose down
print_status "Cleanup complete"

echo ""
echo "🎉 All Docker build tests passed!"
echo "=================================="
