# Scripts Directory

This directory contains utility scripts for local development.

## Pre-Commit Checks

### `pre-commit-check.sh`

Run this script before committing or pushing to ensure code quality. It performs:

1. **Black formatting check** - Verifies code is properly formatted
2. **Ruff linting** - Checks for code quality issues
3. **MyPy type checking** - Type checking (warnings only, non-blocking)
4. **Pytest** - Runs the test suite
5. **Dependency audit** - Optional vulnerability scanning (disabled by default)

#### Usage

```bash
# From project root
./scripts/pre-commit-check.sh
```

The script will:
- Automatically install missing tools (black, ruff, mypy, pytest)
- Run all checks in sequence
- Provide clear feedback on what passed/failed
- Exit with code 0 if all checks pass, 1 if any fail

#### Tips

- If formatting fails, run `black app tests` in the backend directory to auto-format
- If linting fails, run `ruff check --fix app tests` to auto-fix some issues
- MyPy errors are non-blocking (warnings only) since SQLAlchemy type inference issues are common
- To enable dependency vulnerability scanning, uncomment the pip-audit section in the script

#### Integration with Git

You can add this as a git hook or alias:

```bash
# Add as git alias
git config alias.pre-commit '!./scripts/pre-commit-check.sh'

# Then use it before committing
git pre-commit
```

Or add to your `.git/hooks/pre-commit` (make it executable):

```bash
#!/bin/bash
./scripts/pre-commit-check.sh
```

## Local Development Scripts

- `start-local.sh` - Start local development environment (database, backend, frontend)
- `stop-local.sh` - Stop local development environment
- `create_admin_local.sh` - Create an admin user in local database

## Security & Quality

- `pre-commit-check.sh` - Run all code quality checks
- `audit-dependencies.sh` - Manual dependency vulnerability audit
