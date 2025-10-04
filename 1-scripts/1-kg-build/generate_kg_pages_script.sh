#!/bin/bash

# =============================================================================
# Step 2: Generate KG HTML Stub Pages
# =============================================================================
#
# Creates HTML stub files with proper structure and styling.
# Content can be filled in later from Google Sites manually.
# =============================================================================

set -e

echo "Step 2: Generating HTML stub pages..."

# =============================================================================
# HTML STUB TEMPLATE FUNCTION
# =============================================================================

create_html_stub() {
    local filepath="$1"
    local title="$2"
    local scope_instruction="$3"
    
    cat > "$filepath" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TITLE_PLACEHOLDER</title>
    <style>
        :root {
            --primary: #C8102E;
            --primary-dark: #9A0826;
            --text: #2d3748;
            --text-light: #718096;
            --bg: #ffffff;
            --bg-light: #f7fafc;
            --border: #e2e8f0;
            --code-bg: #1a202c;
            --code-text: #e2e8f0;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--text);
            background: var(--bg-light);
            padding: 20px;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: var(--bg);
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: var(--primary);
            font-size: 2rem;
            margin-bottom: 20px;
            border-bottom: 3px solid var(--primary);
            padding-bottom: 15px;
        }
        
        h2 {
            color: var(--primary-dark);
            font-size: 1.5rem;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        
        h3 {
            color: var(--text);
            font-size: 1.2rem;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        
        p { margin-bottom: 15px; }
        ul, ol { margin-left: 25px; margin-bottom: 15px; }
        li { margin-bottom: 8px; }
        
        code {
            background: var(--code-bg);
            color: var(--code-text);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9em;
        }
        
        pre {
            background: var(--code-bg);
            color: var(--code-text);
            padding: 20px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        pre code { background: none; padding: 0; }
        
        .page-scope {
            background: #ebf8ff;
            border-left: 4px solid #3182ce;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        
        .page-scope h2 {
            margin-top: 0;
            color: #2c5282;
        }
        
        .todo {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        
        strong { color: var(--primary-dark); }
        a { color: var(--primary); text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>TITLE_PLACEHOLDER</h1>
        
        <div class="page-scope">
            <h2>Page Scope</h2>
            SCOPE_PLACEHOLDER
        </div>
        
        <div class="todo">
            <h2>📝 TODO: Add Content</h2>
            <p>This is a stub page. Fill in content from Google Sites:</p>
            <ul>
                <li>Copy relevant content from the corresponding Google Sites page</li>
                <li>Collapse any decorator information into the main content</li>
                <li>Reference other pages by NAME (not URL - mapper provides URLs)</li>
                <li>Keep the Page Scope section updated</li>
            </ul>
            <p><strong>Google Sites Source:</strong> GOOGLE_SITES_URL</p>
        </div>
        
        <h2>Content</h2>
        <p><em>Add main content here...</em></p>
        
    </div>
</body>
</html>
HTMLEOF

    # Replace placeholders
    sed -i.bak "s|TITLE_PLACEHOLDER|$title|g" "$filepath"
    sed -i.bak "s|SCOPE_PLACEHOLDER|$scope_instruction|g" "$filepath"
    rm -f "${filepath}.bak"
    
    echo "  ✓ Created stub: $filepath"
}

# =============================================================================
# CREATE GENERIC KG STUBS
# =============================================================================

echo ""
echo "Creating generic KG stub pages..."

# 1-START
create_html_stub "synapsis-kg/1-start/1-start.html" \
    "Knowledge Graph - Start" \
    "<p>AI entry point for knowledge graph navigation. Explains structure and how to use the mapper utility.</p><p><strong>TODO:</strong> Copy from https://sites.google.com/view/migopeditor/home/start</p>"

# 2-ARCHITECTURE/1-DECORATOR
create_html_stub "synapsis-kg/2-architecture/1-decorator/1-decorator.html" \
    "Decorator Pattern" \
    "<p>Explains the decorator pattern for incremental updates using numbered files.</p><p><strong>TODO:</strong> Copy from https://sites.google.com/view/migopeditor/home/start/decorator</p>"

# 2-ARCHITECTURE/2-DISCOVERY
create_html_stub "synapsis-kg/2-architecture/2-discovery/1-discovery.html" \
    "Discovery Algorithm" \
    "<p>AI algorithm for traversing the KG using mapper utility and numbered files.</p><p><strong>TODO:</strong> Copy from https://sites.google.com/view/migopeditor/home/start/discovery</p>"

# 2-ARCHITECTURE/3-STYLE-GUIDE
create_html_stub "synapsis-kg/2-architecture/3-style-guide/1-style-guide.html" \
    "Style Guide" \
    "<p>Formatting and structure rules for KG pages.</p><p><strong>TODO:</strong> Copy from https://sites.google.com/view/migopeditor/home/start/style-guide</p>"

# =============================================================================
# CREATE MIGOP PROJECT STUBS
# =============================================================================

echo ""
echo "Creating MIGOP project stub pages..."

# 1-SPECIFICATION
create_html_stub "synapsis-kg/3-projects/migop-editor/1-specification/1-specification.html" \
    "MIGOP Editor - Specification" \
    "<p>Complete project specification and requirements.</p><p><strong>TODO:</strong> Copy from https://sites.google.com/view/migopeditor/home/start/projects/migop-editor</p>"

# 2-ARCHITECTURE
create_html_stub "synapsis-kg/3-projects/migop-editor/2-architecture/1-architecture.html" \
    "MIGOP Editor - Architecture" \
    "<p>Technical architecture decisions and rationale.</p><p><strong>TODO:</strong> Copy from https://sites.google.com/view/migopeditor/home/start/architecture</p>"

# 2-ARCHITECTURE/BOOTSTRAPPING
create_html_stub "synapsis-kg/3-projects/migop-editor/2-architecture/bootstrapping/1-bootstrapping.html" \
    "Bootstrap System" \
    "<p>How the bootstrap system dynamically loads modules.</p><p><strong>TODO:</strong> Copy from https://sites.google.com/view/migopeditor/home/start/runtime-bootstrapping</p>"

# 3-ROADMAP
create_html_stub "synapsis-kg/3-projects/migop-editor/3-roadmap/1-roadmap.html" \
    "MIGOP Editor - Roadmap" \
    "<p>Version history and development timeline.</p><p><strong>TODO:</strong> Copy from https://sites.google.com/view/migopeditor/home/start/development-status</p>"

# 5-CODE (Overview page)
create_html_stub "synapsis-kg/3-projects/migop-editor/5-code/1-code.html" \
    "MIGOP Editor - Code" \
    "<p>Overview of codebase structure and versions.</p><p><strong>TODO:</strong> Create overview of V1, V2-bootstrap, and V3 code structure</p>"

# =============================================================================
# CREATE INDEX FILES FOR NAVIGATION
# =============================================================================

echo ""
echo "Creating index files..."

# Main index at root
cat > synapsis-kg/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Synapsis Knowledge Graph</title>
    <meta http-equiv="refresh" content="0; url=1-start/1-start.html">
</head>
<body>
    <p>Redirecting to <a href="1-start/1-start.html">Start Page</a>...</p>
</body>
</html>
EOF

echo "  ✓ Created: synapsis-kg/index.html (redirects to start)"

# =============================================================================
# ADD ALL FILES TO GIT
# =============================================================================

echo ""
echo "Adding all stub files to git..."
git add synapsis-kg/

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "✓ Step 2 Complete: HTML Stubs Created"
echo ""
echo "Stub Pages Created:"
echo "  Generic KG:"
echo "    - 1-start/1-start.html"
echo "    - 2-architecture/1-decorator/1-decorator.html"
echo "    - 2-architecture/2-discovery/1-discovery.html"
echo "    - 2-architecture/3-style-guide/1-style-guide.html"
echo ""
echo "  MIGOP Project:"
echo "    - 3-projects/migop-editor/1-specification/1-specification.html"
echo "    - 3-projects/migop-editor/2-architecture/1-architecture.html"
echo "    - 3-projects/migop-editor/2-architecture/bootstrapping/1-bootstrapping.html"
echo "    - 3-projects/migop-editor/3-roadmap/1-roadmap.html"
echo "    - 3-projects/migop-editor/5-code/1-code.html"
echo ""
echo "Next Steps:"
echo "  1. Fill in content from Google Sites pages (URLs in TODO sections)"
echo "  2. Add decorators as needed (2-*.html, 3-*.html files)"
echo "  3. Update Page Scope sections to guide AI"
echo ""Archive old decorators (optional, for history)</li>
    <li>Start fresh with just new main page</li>
</ol>

<h2>Summary</h2>
<p>Decorators enable lightweight, incremental knowledge management:</p>
<ul>
    <li>Human or AI can add small updates without full regeneration</li>
    <li>Clear chronological change history via numbered files</li>
    <li>Implements 'open for extension, closed for modification' principle</li>
    <li>Minimal overhead, maximum flexibility</li>
</ul>
<p>The knowledge graph stays current with minimal effort.</p>
"

# Continue with remaining pages...
echo ""
echo "✓ Step 2 Partial: Core pages created"
echo "  (Additional pages will be created by subsequent script runs)"
echo ""
echo "Note: This is a template. Full implementation would create all KG pages."
echo "      For now, demonstrating the pattern with key pages."
echo ""