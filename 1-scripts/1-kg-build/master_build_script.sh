#!/bin/bash

# =============================================================================
# MIGOP Knowledge Graph - Master Build Script
# =============================================================================
#
# This master script orchestrates the complete KG rebuild process.
# It calls sub-scripts in sequence to reorganize, generate, and commit.
#
# Usage: ./build-kg.sh
#
# Location: epic/1-scripts/1-kg-build/build-kg.sh
# =============================================================================

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   MIGOP Knowledge Graph - Master Build System            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "This will:"
echo "  1. Reorganize repository structure with numbered folders"
echo "  2. Generate all KG HTML pages with collapsed decorators"
echo "  3. Commit and push changes to GitHub"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Build cancelled."
    exit 0
fi

echo ""
echo "=== Step 1: Reorganize Structure ==="
echo ""
"$SCRIPT_DIR/1-reorganize-structure.sh"

echo ""
echo "=== Step 2: Generate KG Pages ==="
echo ""
"$SCRIPT_DIR/2-generate-kg-pages.sh"

echo ""
echo "=== Step 3: Commit and Push ==="
echo ""
"$SCRIPT_DIR/3-commit-and-push.sh"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   ✓ Knowledge Graph Build Complete!                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Verify structure at: synapsis-kg/"
echo "  2. Test mapper utility with new URLs"
echo "  3. Update any external references to old paths"
echo ""