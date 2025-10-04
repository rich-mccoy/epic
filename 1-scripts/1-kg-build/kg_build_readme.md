# Knowledge Graph Build System

This directory contains scripts to rebuild the MIGOP Editor knowledge graph with a GitHub-native structure.

## Quick Start

```bash
# Make scripts executable
chmod +x *.sh

# Run full build
./build-kg.sh
```

## What This Does

The build system:

1. **Reorganizes** repository structure with numbered folders
2. **Generates** all KG HTML pages with collapsed decorator content  
3. **Commits** changes and pushes to GitHub

## Scripts

### `build-kg.sh` (Master)
Orchestrates the complete build process. Calls all sub-scripts in sequence.

### `1-reorganize-structure.sh`
- Creates numbered folder hierarchy (`1-start/`, `2-architecture/`, `3-projects/`)
- Moves `migop-editor/` to `synapsis-kg/3-projects/migop-editor/`
- Reorganizes code folders: V1, V2-bootstrap, V3 → `5-code/`
- Cleans up empty directories
- Creates README files

### `2-generate-kg-pages.sh`
- Generates HTML pages from Google Sites content
- Collapses decorators into main pages
- Applies GitHub-optimized structure (no internal KG URLs)
- Implements numbered file pattern (1-main, 2-decorator, etc.)
- Adds "Page Scope" sections for AI guidance

### `3-commit-and-push.sh`
- Stages all changes
- Creates descriptive commit message
- Pushes to GitHub (with confirmation)

## New KG Structure

```
synapsis-kg/
├── 1-start/                    # AI entry point
├── 2-architecture/             # Generic patterns
│   ├── 1-decorator/            # Decorator pattern guide
│   ├── 2-discovery/            # Discovery algorithm
│   └── 3-style-guide/          # Formatting rules
└── 3-projects/
    └── migop-editor/           # Project-specific KG
        ├── 1-specification/
        ├── 2-architecture/
        │   └── bootstrapping/
        ├── 3-roadmap/
        ├── 4-decorators/
        └── 5-code/             # All code versions
            ├── V1/
            ├── V2-bootstrap/
            └── V3/
```

## Key Concepts

### Numbered Folders
Folders are numbered to control GitHub display order:
- `1-start/` appears first
- `2-architecture/` appears second
- `3-projects/` appears third

### Numbered Files (Decorator Pattern)
Each folder uses numbered files:
- `1-[name].html` - Main content page
- `2-[name].html` - First decorator (extends main)
- `3-[name].html` - Second decorator (further extends)

AI reads files in order and synthesizes: Main + Dec1 + Dec2 = Complete Knowledge

### No Internal URLs
Pages don't link to other KG pages with URLs. Instead:
- Reference pages by NAME ("See the Decorator Guide")
- Mapper utility (`utils/github-link-mapper`) provides all URLs with cache-busting
- AI uses mapper output to navigate

### Page Scope
Every page has a "Page Scope" section explaining:
- What the page covers
- How AI should use it
- Related pages (by name, not URL)

## For AI

After running these scripts:

1. **Use mapper utility** to get all page URLs with cache-busting:
   ```bash
   node utils/github-link-mapper <repo-url>
   ```

2. **Start at entry point:**
   ```
   synapsis-kg/1-start/1-start.html
   ```

3. **Follow discovery algorithm** (documented in 2-architecture/2-discovery/)

4. **Read numbered files in order** in each folder to synthesize complete knowledge

5. **Create decorators** at end of sessions without being prompted

## Manual Steps

If you need to run steps individually:

```bash
# Step 1: Reorganize only
./1-reorganize-structure.sh

# Step 2: Generate HTML only  
./2-generate-kg-pages.sh

# Step 3: Commit only
./3-commit-and-push.sh
```

## Maintenance

### Adding New Pages
1. Create appropriately numbered file in target folder
2. Use HTML template from `2-generate-kg-pages.sh`
3. Include Page Scope section
4. Reference related pages by name (not URL)

### Creating Decorators
1. Find highest number in folder (e.g., 1-*.html, 2-*.html exist)
2. Create next number: `3-[descriptive-name].html`
3. Write decorator content
4. Commit

### Updating Scripts
These scripts are version-controlled in the repo. To modify:
1. Edit script file
2. Test on a branch first
3. Commit changes
4. Scripts are now updated for everyone

## Troubleshooting

### "File not found" errors
- Check that you're in repository root
- Verify paths in scripts match your structure

### Git conflicts
- Scripts assume clean working directory
- Commit or stash changes before running

### Scripts not executable
```bash
chmod +x *.sh
```

## GitHub Pages (Optional)

To enable nice URLs:
1. Go to repository Settings → Pages
2. Source: `main` branch, `/` root or `/docs` folder
3. KG accessible at: `https://rich-mccoy.github.io/epic/synapsis-kg/...`

## Architecture Decision

These scripts implement the GitHub-native KG architecture decided in the 2025-10-04 session:
- Numbered folders for display order control
- Numbered files for decorator pattern
- Mapper-based navigation (no hardcoded URLs)
- GitHub Pages ready structure
- Multi-project capable

See `synapsis-kg/3-projects/migop-editor/4-decorators/` for session history.