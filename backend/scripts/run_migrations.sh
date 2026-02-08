#!/bin/bash
# Script to run database migrations
# Usage: ./scripts/run_migrations.sh [upgrade|downgrade] [revision]

set -e

ACTION=${1:-upgrade}
REVISION=${2:-head}

if [ "$ACTION" = "upgrade" ]; then
    echo "Running database migrations (upgrade to $REVISION)..."
    alembic upgrade "$REVISION"
elif [ "$ACTION" = "downgrade" ]; then
    if [ -z "$REVISION" ] || [ "$REVISION" = "head" ]; then
        echo "Error: Downgrade requires a specific revision"
        exit 1
    fi
    echo "Running database migrations (downgrade to $REVISION)..."
    alembic downgrade "$REVISION"
else
    echo "Usage: $0 [upgrade|downgrade] [revision]"
    exit 1
fi

echo "Migrations completed successfully!"

