#!/bin/bash
###############################################################################
# P1-B2 PostgreSQL Integration Test Execution Script
#
# This script runs the P1-B2 audit constraint tests against a real PostgreSQL
# database and captures actual execution evidence (not just expected output).
#
# Usage:
#   ./scripts/run-p1-b2-tests.sh [options]
#
# Options:
#   -p, --password PASSWORD    PostgreSQL password (default: testpassword)
#   -u, --user USER           PostgreSQL user (default: postgres)
#   -h, --host HOST           PostgreSQL host (default: localhost)
#   -P, --port PORT           PostgreSQL port (default: 5432)
#   -d, --db DATABASE         Database name (default: dripplex_test)
#   -o, --output FILE         Save test output to file (default: p1-b2-test-output.log)
#   --verbose                 Enable verbose test output
#
# Prerequisites:
#   - PostgreSQL 16+ running and accessible
#   - psql command-line tool installed
#   - npm/node installed
#   - pnpm or npm configured for package management
#
# Returns:
#   0 if all tests PASS
#   1 if any tests FAIL
#   2 if setup failed
###############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Defaults
DB_PASSWORD="testpassword"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="dripplex_test"
OUTPUT_FILE="p1-b2-test-output.log"
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--password) DB_PASSWORD="$2"; shift 2 ;;
    -u|--user) DB_USER="$2"; shift 2 ;;
    -h|--host) DB_HOST="$2"; shift 2 ;;
    -P|--port) DB_PORT="$2"; shift 2 ;;
    -d|--db) DB_NAME="$2"; shift 2 ;;
    -o|--output) OUTPUT_FILE="$2"; shift 2 ;;
    --verbose) VERBOSE=true; shift ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
done

echo -e "${YELLOW}P1-B2 PostgreSQL Integration Test Execution${NC}"
echo "=========================================="
echo "Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "Output file: $OUTPUT_FILE"
echo ""

# Step 1: Verify PostgreSQL is running
echo -e "${YELLOW}Step 1: Verifying PostgreSQL connection...${NC}"
export PGPASSWORD="$DB_PASSWORD"
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "SELECT 1;" &>/dev/null; then
  echo -e "${RED}✗ Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT${NC}"
  echo "  Please start PostgreSQL and verify credentials."
  exit 2
fi
echo -e "${GREEN}✓ PostgreSQL accessible${NC}"

# Step 2: Drop and recreate test database (clean state)
echo -e "${YELLOW}Step 2: Preparing test database (${DB_NAME})...${NC}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" &>/dev/null
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "CREATE DATABASE \"$DB_NAME\";" &>/dev/null
echo -e "${GREEN}✓ Test database ready${NC}"

# Step 3: Apply Prisma migrations
echo -e "${YELLOW}Step 3: Applying Prisma migrations...${NC}"
cd "$(dirname "$0")/.."
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
if ! npx prisma migrate deploy --schema="apps/backend/prisma/schema.prisma" 2>&1 | tee -a "$OUTPUT_FILE" | grep -q "All migrations have been successfully applied"; then
  echo -e "${RED}✗ Migration failed${NC}"
  exit 2
fi
echo -e "${GREEN}✓ Migrations applied${NC}"

# Step 4: Run P1-B2 integration tests
echo -e "${YELLOW}Step 4: Running P1-B2 constraint tests...${NC}"
echo "---" >> "$OUTPUT_FILE"
echo "Test Execution: $(date)" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"

if [ "$VERBOSE" = true ]; then
  npm test -- --testPathPattern='audit-segments.constraint' --verbose 2>&1 | tee -a "$OUTPUT_FILE"
  TEST_RESULT=${PIPESTATUS[0]}
else
  npm test -- --testPathPattern='audit-segments.constraint' 2>&1 | tee -a "$OUTPUT_FILE"
  TEST_RESULT=${PIPESTATUS[0]}
fi

# Step 5: Parse and display results
echo ""
echo -e "${YELLOW}Test Results:${NC}"
echo "=========================================="

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"

  # Extract test count from output
  TEST_COUNT=$(grep "Tests:" "$OUTPUT_FILE" | tail -1)
  if [ -n "$TEST_COUNT" ]; then
    echo "$TEST_COUNT"
  fi

  echo ""
  echo -e "${GREEN}✓ P1-B2 PostgreSQL Integration Tests: PASS${NC}"
  echo ""
  echo "Full output saved to: $OUTPUT_FILE"
  echo ""
  echo "Evidence:"
  echo "  - Authoritative-write boundary: ENFORCED (legacy NULL writes rejected)"
  echo "  - Global sequence uniqueness: ENFORCED (same sequence across segments rejected)"
  echo "  - Per-segment sequence uniqueness: ENFORCED"
  echo "  - Authoritative field atomicity: ENFORCED"
  echo "  - Segment lifecycle constraints: ENFORCED"
  echo ""
  exit 0
else
  echo -e "${RED}✗ TESTS FAILED${NC}"
  echo ""
  echo "Test failures detected. Review output:"
  echo ""
  tail -50 "$OUTPUT_FILE"
  echo ""
  echo "Full output saved to: $OUTPUT_FILE"
  exit 1
fi
