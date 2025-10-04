#!/bin/bash

# =============================================================================
# Step 1: Reorganize Repository Structure
# =============================================================================
#
# CLEANS UP any partial work and creates fresh numbered folder structure
# =============================================================================

set -e

echo "Step 1: Cleaning up and creating fresh structure..."

# -----------------------------------------------------------------------------
# CLEANUP: Remove any existing partial synapsis-kg structure
# -----------------------------------------------------------------------------

echo "  Cleaning up any existing synapsis-kg structure..."

if [ -d "synapsis-kg" ]; then
    echo "  Found existing synapsis-kg/ - removing to start fresh..."
    git rm -rf synapsis-kg 2>/dev/null || rm -rf synapsis-kg
    echo "  ✓ Cleaned up old synapsis-kg/"
fi

# -----------------------------------------------------------------------------
# Create Fresh Generic KG Structure (Numbered)
# -----------------------------------------------------------------------------

echo "  Creating fresh numbered KG structure..."
mkdir -p synapsis-kg/1-start
mkdir -p synapsis-kg/2-architecture/1-decorator
mkdir -p synapsis-kg/2-architecture/2-discovery
mkdir -p synapsis-kg/2-architecture/3-style-guide
mkdir -p synapsis-kg/3-projects

echo "  ✓ Generic KG structure created"

# -----------------------------------------------------------------------------
# Create MIGOP Project Structure FIRST (before moving migop-editor)
# -----------------------------------------------------------------------------

echo "  Creating MIGOP project KG structure..."
mkdir -p synapsis-kg/3-projects/migop-editor/1-specification
mkdir -p synapsis-kg/3-projects/migop-editor/2-architecture/bootstrapping
mkdir -p synapsis-kg/3-projects/migop-editor/3-roadmap
mkdir -p synapsis-kg/3-projects/migop-editor/4-decorators
mkdir -p synapsis-kg/3-projects/migop-editor/5-code

echo "  ✓ MIGOP project structure created"

# -----------------------------------------------------------------------------
# Move Code Folders to 5-code/
# -----------------------------------------------------------------------------

echo "  Moving code folders to 5-code/..."

# Move V1
if [ -d "migop-editor/V1" ]; then
    git mv migop-editor/V1 synapsis-kg/3-projects/migop-editor/5-code/V1
    echo "  ✓ Moved V1 to 5-code/"
fi

# Move V3
if [ -d "migop-editor/V3" ]; then
    git mv migop-editor/V3 synapsis-kg/3-projects/migop-editor/5-code/V3
    echo "  ✓ Moved V3 to 5-code/"
fi

# Move and rename boostrap (with typo) to V2-bootstrap
if [ -d "migop-editor/boostrap" ]; then
    git mv migop-editor/boostrap synapsis-kg/3-projects/migop-editor/5-code/V2-bootstrap
    echo "  ✓ Renamed boostrap to V2-bootstrap and moved to 5-code/"
elif [ -d "migop-editor/bootstrap" ]; then
    git mv migop-editor/bootstrap synapsis-kg/3-projects/migop-editor/5-code/V2-bootstrap
    echo "  ✓ Renamed bootstrap to V2-bootstrap and moved to 5-code/"
fi

# -----------------------------------------------------------------------------
# Move Any Other Files from migop-editor/
# -----------------------------------------------------------------------------

echo "  Checking for other migop-editor files..."

# Move decorators if they exist
if [ -d "migop-editor/decorators" ]; then
    if [ "$(ls -A migop-editor/decorators)" ]; then
        for file in migop-editor/decorators/*; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                git mv "$file" "synapsis-kg/3-projects/migop-editor/4-decorators/$filename"
                echo "  ✓ Moved decorator: $filename"
            fi
        done
    fi
    # Remove empty decorators folder
    rmdir migop-editor/decorators 2>/dev/null || true
fi

# -----------------------------------------------------------------------------
# Clean Up Empty migop-editor/ at Root
# -----------------------------------------------------------------------------

echo "  Cleaning up migop-editor at root..."

if [ -d "migop-editor" ]; then
    # Check if truly empty
    if [ -z "$(ls -A migop-editor)" ]; then
        rmdir migop-editor
        echo "  ✓ Removed empty migop-editor/ folder"
    else
        echo "  ! migop-editor/ has remaining files:"
        ls -la migop-editor/
        echo "  ! Review and move manually if needed"
    fi
fi

# -----------------------------------------------------------------------------
# Create README Files
# -----------------------------------------------------------------------------

echo "  Creating README files..."

cat > synapsis-kg/README.md << 'EOF'
# Synapsis Knowledge Graph

AI-traversable knowledge graph for project documentation.

## Structure

- **1-start/** - AI entry point and orientation
- **2-architecture/** - Generic KG patterns (decorator, discovery, style-guide)
- **3-projects/** - Project-specific knowledge graphs

## Navigation

Use the GitHub link mapper utility (`utils/github-link-mapper`) to:
1. Traverse the KG structure
2. Generate cache-busted URLs
3. Discover all pages programmatically

## Naming Convention

- Folders are numbered to control display order (1-, 2-, 3-)
- First HTML file in each folder (1-*.html) is the main content
- Additional numbered files (2-*.html, 3-*.html) are decorators
- AI reads main file, then decorators in order, collapsing knowledge

## For AI

Start at `1-start/1-start.html` and follow the discovery instructions.
EOF

cat > synapsis-kg/3-projects/README.md << 'EOF'
# Projects

Each project has its own numbered knowledge graph structure.

## Current Projects

- **migop-editor/** - Document lifecycle management system for Google Docs
EOF

cat > synapsis-kg/3-projects/migop-editor/README.md << 'EOF'
# MIGOP Editor

## Structure

- **1-specification/** - Project requirements and specifications
- **2-architecture/** - Technical architecture and design decisions
  - **bootstrapping/** - Bootstrap system details
- **3-roadmap/** - Development timeline and version history
- **4-decorators/** - Project-specific decorators
- **5-code/** - All code versions
  - **V1/** - Original implementation
  - **V2-bootstrap/** - Bootstrap-compatible refactor
  - **V3/** - Workflow-based implementation

## Entry Point

Start at `/synapsis-kg/1-start/1-start.html` (KG root)
EOF

git add synapsis-kg/README.md
git add synapsis-kg/3-projects/README.md
git add synapsis-kg/3-projects/migop-editor/README.md

echo "  ✓ README files created"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "✓ Step 1 Complete: Fresh Structure Created"
echo ""
echo "New Structure:"
echo "  synapsis-kg/"
echo "  ├── 1-start/"
echo "  ├── 2-architecture/"
echo "  │   ├── 1-decorator/"
echo "  │   ├── 2-discovery/"
echo "  │   └── 3-style-guide/"
echo "  └── 3-projects/"
echo "      └── migop-editor/"
echo "          ├── 1-specification/"
echo "          ├── 2-architecture/"
echo "          │   └── bootstrapping/"
echo "          ├── 3-roadmap/"
echo "          ├── 4-decorators/"
echo "          └── 5-code/"
echo "              ├── V1/"
echo "              ├── V2-bootstrap/"
echo "              └── V3/"
echo ""