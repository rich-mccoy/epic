/**
 * ============================================================================
 * MIGOP EDITOR - BOOTSTRAP SYSTEM v2.0
 * ============================================================================
 * 
 * This is the ONLY .gs file that needs to be deployed to users.
 * It dynamically loads all JavaScript modules from remote URLs at runtime.
 * 
 * Architecture:
 * 1. User opens Google Doc and clicks Extensions → MIGOP Editor
 * 2. This script fetches JSON configuration from GitHub
 * 3. Configuration lists all module URLs to load
 * 4. Script generates HTML sidebar with module script tags
 * 5. Sidebar loads in browser, modules execute
 * 
 * Benefits:
 * - Single deployment (this file never changes)
 * - Modular architecture (each module is separate)
 * - Centralized updates (change code once, all users get it)
 * - No redeployment needed (users install once)
 * 
 * ============================================================================
 */

// Configuration
var BOOTSTRAP_CONFIG_URL = 'https://raw.githubusercontent.com/rich-mccoy/epic/refs/heads/main/migop-editor/boostrap/boostrap.json';
var FALLBACK_DISABLED = true; // Set to true to disable fallback mode

/**
 * Adds MIGOP Editor menu to Google Docs
 * Called automatically when document opens
 */
function onOpen() {
  DocumentApp.getUi()
    .createMenu('MIGOP Editor')
    .addItem('Launch Editor', 'showSidebar')
    .addToUi();
}

/**
 * Main entry point - creates and displays the sidebar
 */
function showSidebar() {
  try {
    Logger.log('=== MIGOP Editor Bootstrap Starting ===');
    Logger.log('Bootstrap URL: ' + BOOTSTRAP_CONFIG_URL);
    
    // Fetch bootstrap configuration from GitHub
    var config = fetchBootstrapConfig();
    
    if (!config.success) {
      // If config fetch fails and fallback is disabled, show error
      if (FALLBACK_DISABLED) {
        Logger.log('Config fetch failed, fallback disabled');
        showErrorSidebar(config.error);
        return;
      }
      // Otherwise use fallback (legacy behavior)
      Logger.log('Config fetch failed, using fallback');
      config = getFallbackConfig();
    }
    
    // Generate HTML with all modules
    var html = generateSidebarHTML(config);
    
    // Display sidebar
    var htmlOutput = HtmlService.createHtmlOutput(html)
      .setTitle('MIGOP Editor')
      .setWidth(400);
    
    DocumentApp.getUi().showSidebar(htmlOutput);
    
    Logger.log('=== MIGOP Editor Launched Successfully ===');
    
  } catch (error) {
    Logger.log('Error in showSidebar: ' + error.toString());
    showErrorSidebar('Failed to initialize MIGOP Editor: ' + error.message);
  }
}

/**
 * Fetches bootstrap configuration from GitHub raw URL
 * @returns {Object} {success: boolean, config: Object, error: string}
 */
function fetchBootstrapConfig() {
  try {
    Logger.log('Fetching bootstrap config from: ' + BOOTSTRAP_CONFIG_URL);
    
    // Fetch the JSON file from GitHub
    var response = UrlFetchApp.fetch(BOOTSTRAP_CONFIG_URL, {
      muteHttpExceptions: true,
      followRedirects: true
    });
    
    var responseCode = response.getResponseCode();
    Logger.log('Response code: ' + responseCode);
    
    if (responseCode !== 200) {
      return {
        success: false,
        error: 'Failed to fetch config (HTTP ' + responseCode + ')'
      };
    }
    
    var content = response.getContentText();
    Logger.log('Content length: ' + content.length + ' bytes');
    
    // Parse JSON directly (GitHub raw serves plain text, no HTML wrapping)
    var config = JSON.parse(content);
    
    // Validate required fields
    if (!config.baseUrl || !config.modules || config.modules.length === 0) {
      Logger.log('Config validation failed - missing required fields');
      return {
        success: false,
        error: 'Config missing required fields (baseUrl or modules)'
      };
    }
    
    Logger.log('Configuration loaded: ' + JSON.stringify(config));
    
    return {
      success: true,
      config: config
    };
    
  } catch (error) {
    Logger.log('Error fetching config: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate HTML for sidebar with all modules
 * @param {Object} configResult - Result from fetchBootstrapConfig
 * @returns {string} Complete HTML for sidebar
 */
function generateSidebarHTML(configResult) {
  var config = configResult.config;
  var html = [];
  
  html.push('<!DOCTYPE html>');
  html.push('<html>');
  html.push('<head>');
  html.push('  <base target="_top">');
  html.push('  <meta charset="utf-8">');
  html.push('  <title>' + (config.title || 'MIGOP Editor') + '</title>');
  html.push('  <style>');
  html.push('    body {');
  html.push('      font-family: "Google Sans", Roboto, Arial, sans-serif;');
  html.push('      margin: 0;');
  html.push('      padding: 0;');
  html.push('      background: #f5f5f5;');
  html.push('    }');
  html.push('    #status {');
  html.push('      padding: 10px;');
  html.push('      background: #fff;');
  html.push('      border-bottom: 1px solid #ddd;');
  html.push('      font-size: 12px;');
  html.push('      color: #666;');
  html.push('    }');
  html.push('    #app {');
  html.push('      padding: 0;');
  html.push('    }');
  html.push('    .loading {');
  html.push('      padding: 20px;');
  html.push('      text-align: center;');
  html.push('      color: #666;');
  html.push('    }');
  html.push('  </style>');
  html.push('</head>');
  html.push('<body>');
  html.push('  <div id="status">Loading MIGOP Editor v' + (config.version || '8.0') + '...</div>');
  html.push('  <div id="app">');
  html.push('    <div class="loading">Initializing modules...</div>');
  html.push('  </div>');
  
  // Add dependencies first (JSZip for DOCX processing)
  if (config.dependencies && config.dependencies.jszip) {
    html.push('  <script src="' + config.dependencies.jszip + '"></script>');
  } else {
    // Default JSZip if not in config
    html.push('  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>');
  }
  
  // Error handling wrapper
  html.push('  <script>');
  html.push('    window.addEventListener("error", function(e) {');
  html.push('      console.error("Global error:", e);');
  html.push('      var statusDiv = document.getElementById("status");');
  html.push('      if (statusDiv) {');
  html.push('        statusDiv.innerHTML = "Error: " + e.message;');
  html.push('        statusDiv.style.background = "#ffebee";');
  html.push('        statusDiv.style.color = "#d32f2f";');
  html.push('      }');
  html.push('    });');
  html.push('    console.log("Bootstrap: Starting module load...");');
  html.push('  </script>');
  
  // Sort modules by priority (lower = earlier)
  var sortedModules = config.modules.slice().sort(function(a, b) {
    return (a.priority || 100) - (b.priority || 100);
  });
  
  Logger.log('Loading ' + sortedModules.length + ' modules in priority order...');
  
  // Load each module
  for (var i = 0; i < sortedModules.length; i++) {
    var module = sortedModules[i];
    var moduleName = module.name;
    var moduleUrl = module.url;
    
    Logger.log('Loading module ' + (i + 1) + '/' + sortedModules.length + ': ' + moduleName + ' (priority: ' + (module.priority || 100) + ')');
    Logger.log('Module URL: ' + moduleUrl);
    
    html.push('  <!-- Module: ' + moduleName + ' (priority: ' + (module.priority || 100) + ') -->');
    html.push('  <script>');
    html.push('    (function() {');
    html.push('      console.log("Loading module: ' + moduleName + '");');
    html.push('      fetch("' + moduleUrl + '")');
    html.push('        .then(function(response) {');
    html.push('          if (!response.ok) throw new Error("HTTP " + response.status);');
    html.push('          return response.text();');
    html.push('        })');
    html.push('        .then(function(code) {');
    html.push('          console.log("Module ' + moduleName + ' fetched (" + code.length + " bytes)");');
    html.push('          // GitHub raw serves plain JavaScript, execute directly');
    html.push('          eval(code);');
    html.push('          console.log("Module ' + moduleName + ' loaded successfully");');
    html.push('        })');
    html.push('        .catch(function(error) {');
    html.push('          console.error("Failed to load module ' + moduleName + ':", error);');
    html.push('          var statusDiv = document.getElementById("status");');
    html.push('          if (statusDiv) {');
    html.push('            statusDiv.innerHTML += "<br>⚠️ Module ' + moduleName + ' failed";');
    html.push('            statusDiv.style.background = "#fff3cd";');
    html.push('          }');
    html.push('        });');
    html.push('    })();');
    html.push('  </script>');
  }
  
  // Finalization script
  html.push('  <script>');
  html.push('    setTimeout(function() {');
  html.push('      var statusDiv = document.getElementById("status");');
  html.push('      if (statusDiv && !statusDiv.innerHTML.includes("failed")) {');
  html.push('        statusDiv.innerHTML = "✓ MIGOP Editor ready";');
  html.push('        statusDiv.style.background = "#e8f5e9";');
  html.push('        statusDiv.style.color = "#2e7d32";');
  html.push('      }');
  html.push('    }, 2000);');
  html.push('  </script>');
  
  html.push('</body>');
  html.push('</html>');
  
  Logger.log('All modules loaded successfully');
  
  return html.join('\n');
}

/**
 * Show error message in sidebar
 * @param {string} errorMessage - Error message to display
 */
function showErrorSidebar(errorMessage) {
  var html = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '  <base target="_top">',
    '  <style>',
    '    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }',
    '    .error {',
    '      background: #ffebee;',
    '      border-left: 4px solid #d32f2f;',
    '      padding: 15px;',
    '      margin: 10px 0;',
    '      color: #d32f2f;',
    '    }',
    '    .help {',
    '      background: #e3f2fd;',
    '      border-left: 4px solid #1976d2;',
    '      padding: 15px;',
    '      margin: 20px 0;',
    '      font-size: 14px;',
    '    }',
    '    code {',
    '      background: #f5f5f5;',
    '      padding: 2px 6px;',
    '      border-radius: 3px;',
    '      font-family: monospace;',
    '    }',
    '  </style>',
    '</head>',
    '<body>',
    '  <h2>⚠️ Bootstrap Error</h2>',
    '  <div class="error">',
    '    <strong>Failed to load MIGOP Editor</strong><br><br>',
    '    ' + errorMessage,
    '  </div>',
    '  <div class="help">',
    '    <strong>Troubleshooting:</strong>',
    '    <ol>',
    '      <li>Verify the config URL is accessible: <code>' + BOOTSTRAP_CONFIG_URL + '</code></li>',
    '      <li>Check that the JSON is valid and contains required fields</li>',
    '      <li>Ensure module URLs are accessible from this environment</li>',
    '      <li>View Apps Script logs: View → Logs</li>',
    '    </ol>',
    '  </div>',
    '</body>',
    '</html>'
  ].join('\n');
  
  var htmlOutput = HtmlService.createHtmlOutput(html)
    .setTitle('MIGOP Editor - Error')
    .setWidth(400);
  
  DocumentApp.getUi().showSidebar(htmlOutput);
}

/**
 * Fallback configuration (embedded in bootstrap.gs)
 * Used only if config fetch fails AND FALLBACK_DISABLED = false
 * @returns {Object} Fallback config object
 */
function getFallbackConfig() {
  Logger.log('Using fallback configuration');
  return {
    success: true,
    config: {
      version: '8.0-fallback',
      title: 'MIGOP Editor (Fallback)',
      baseUrl: 'https://sites.google.com/view/migopeditor/home/',
      modules: [
        {
          name: 'bootstrap-test',
          url: 'https://sites.google.com/view/migopeditor/home/bootstrap/bootstrap-js',
          priority: 10
        }
      ],
      dependencies: {
        jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
      }
    }
  };
}

/**
 * Server-side function to get document properties
 * Called from client-side via google.script.run
 */
function getDocumentProperty(key) {
  try {
    var properties = PropertiesService.getDocumentProperties();
    return properties.getProperty(key);
  } catch (error) {
    Logger.log('Error getting property ' + key + ': ' + error.toString());
    return null;
  }
}

/**
 * Server-side function to set document properties
 * Called from client-side via google.script.run
 */
function setDocumentProperty(key, value) {
  try {
    var properties = PropertiesService.getDocumentProperties();
    properties.setProperty(key, value);
    return {success: true};
  } catch (error) {
    Logger.log('Error setting property ' + key + ': ' + error.toString());
    return {success: false, error: error.message};
  }
}

/**
 * Server-side function to get version counter
 * Increments if increment parameter is true
 */
function getOrIncrementVersionCounter(increment) {
  try {
    var properties = PropertiesService.getDocumentProperties();
    var currentCount = properties.getProperty('MIGOP_VERSION_COUNT');
    
    if (!currentCount) {
      currentCount = '0';
    }
    
    var numericCount = parseInt(currentCount);
    
    if (increment) {
      numericCount++;
      properties.setProperty('MIGOP_VERSION_COUNT', numericCount.toString());
    }
    
    return numericCount;
  } catch (error) {
    Logger.log('Error with version counter: ' + error.toString());
    return 1; // Default to 1 on error
  }
}
