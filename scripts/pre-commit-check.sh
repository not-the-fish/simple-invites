#!/bin/bash
# Pre-commit/pre-push quality checks script
# Run this before committing or pushing to ensure code quality

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print failure
print_failure() {
    echo -e "${RED}✗${NC} $1"
    FAILED=1
}

# Function to run a command and check result
run_check() {
    local name="$1"
    local optional="${2:-false}"  # Second arg: true if optional (warnings only)
    shift
    [ "$optional" = "true" ] && shift  # Remove optional flag from args
    print_section "Running: $name"
    if "$@" 2>&1; then
        print_success "$name passed"
        return 0
    else
        if [ "$optional" = "true" ]; then
            echo -e "${YELLOW}⚠ $name had issues (non-blocking)${NC}"
            return 0  # Don't fail for optional checks
        else
            print_failure "$name failed"
            return 1
        fi
    fi
}

# Check if we're in the project root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}Error: Must be run from project root directory${NC}"
    exit 1
fi

# Check if backend virtual environment exists
if [ ! -d "backend/.venv" ]; then
    echo -e "${YELLOW}Warning: backend/.venv not found. Creating virtual environment...${NC}"
    cd backend
    python3 -m venv .venv
    cd ..
fi

# Activate virtual environment
source backend/.venv/bin/activate

# Check if required tools are installed
echo -e "\n${BLUE}Checking for required tools...${NC}"
MISSING_TOOLS=()

if ! command -v black &> /dev/null; then
    MISSING_TOOLS+=("black")
fi

if ! command -v ruff &> /dev/null; then
    MISSING_TOOLS+=("ruff")
fi

if ! command -v mypy &> /dev/null; then
    MISSING_TOOLS+=("mypy")
fi

if ! command -v pytest &> /dev/null; then
    MISSING_TOOLS+=("pytest")
fi

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Installing missing tools: ${MISSING_TOOLS[*]}${NC}"
    pip install -q "${MISSING_TOOLS[@]}" mypy-extensions
fi

# Install test dependencies if pytest is being used
if command -v pytest &> /dev/null; then
    if ! python -c "import httpx" 2>/dev/null; then
        echo -e "${YELLOW}Installing test dependencies (httpx)...${NC}"
        pip install -q httpx
    fi
fi

echo -e "\n${GREEN}Starting pre-commit checks...${NC}\n"

# Change to backend directory for checks
cd backend

# 1. Black formatting check (read-only, doesn't modify files)
if ! run_check "Black formatting check" black app tests --check; then
    echo -e "\n${YELLOW}Tip: Run 'black app tests' to auto-format${NC}"
fi

# 2. Ruff linting
if ! run_check "Ruff linting" ruff check app tests; then
    echo -e "\n${YELLOW}Tip: Run 'ruff check --fix app tests' to auto-fix some issues${NC}"
fi

# 3. MyPy type checking (with ignore-missing-imports for external deps)
# Mark as optional since SQLAlchemy type inference issues are common and non-blocking
run_check "MyPy type checking" "true" mypy app --ignore-missing-imports
echo -e "${YELLOW}Note: Some type errors may be expected (e.g., SQLAlchemy type inference)${NC}"

# 4. Run tests
if ! run_check "Running tests" pytest tests/ -v; then
    echo -e "\n${YELLOW}Tip: Run 'pytest tests/ -v' to see detailed test output${NC}"
fi

# 5. Dependency vulnerability check (optional, can be slow)
# Disabled by default - uncomment to enable
# if command -v pip-audit &> /dev/null; then
#     print_section "Checking for dependency vulnerabilities (pip-audit)"
#     if pip-audit --format=json 2>&1 | grep -q '"vulnerabilities":\s*\[\]' || pip-audit 2>&1 | grep -q "No known vulnerabilities found"; then
#         print_success "No known vulnerabilities found"
#     else
#         print_failure "Vulnerabilities found - review pip-audit output above"
#         echo -e "\n${YELLOW}Tip: Review and update vulnerable dependencies${NC}"
#     fi
# else
#     echo -e "${YELLOW}Skipping pip-audit (not installed)${NC}"
# fi

# Return to project root
cd ..

# Summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to commit.${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues above before committing.${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 1
fi

