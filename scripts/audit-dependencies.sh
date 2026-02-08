#!/bin/bash
# Dependency vulnerability scanning script

set -e

echo "🔍 Scanning dependencies for vulnerabilities..."
echo ""

# Python dependencies
echo "📦 Python dependencies (pip-audit):"
cd backend
if [ -d ".venv" ]; then
    source .venv/bin/activate
    pip-audit || echo "⚠️  pip-audit not installed. Run: pip install pip-audit"
else
    echo "⚠️  Virtual environment not found. Skipping Python audit."
fi
cd ..

echo ""
echo "📦 Node.js dependencies (npm audit):"
cd frontend
if [ -f "package-lock.json" ]; then
    npm audit --audit-level=moderate || echo "⚠️  npm audit found issues. Review above."
else
    echo "⚠️  package-lock.json not found. Run: npm install"
fi
cd ..

echo ""
echo "✅ Dependency audit complete!"


