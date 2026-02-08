.PHONY: format lint type-check check audit install-dev

# Install development dependencies
install-dev:
	pip install -r requirements.txt

# Format code with black
format:
	black app tests

# Lint with ruff
lint:
	ruff check app tests

# Fix linting issues
lint-fix:
	ruff check --fix app tests

# Type check with mypy
type-check:
	mypy app

# Run all checks
check: format lint type-check
	@echo "All checks passed!"

# Audit dependencies for vulnerabilities
audit:
	pip-audit

# Run all quality checks
quality: format lint-fix type-check audit
	@echo "Quality checks complete!"


