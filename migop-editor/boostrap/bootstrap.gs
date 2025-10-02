/**
 * ============================================================================
 * MIGOP Editor - Dynamic Bootstrap System
 * ============================================================================
 *
 * PURPOSE:
 * This code stays in Code.gs and NEVER changes across documents.
 * All actual application code is loaded dynamically from Google Sites at runtime.
 *
 * ARCHITECTURE:
 * 1. Hardcoded bootstrap URL points to configuration document (JSON format)
 * 2. Configuration document lists which JavaScript modules to load
 * 3. Each module is fetched from Google Sites and injected into HTML
 * 4. Application runs entirely from remotely loaded code
 *
 * BENEFITS:
 * - Update code once on Google Sites → ALL documents get updates
 * - Zero maintenance across multiple documents
 * - Easy rollback (change bootstrap config)
 * - Version control via URL management
 *
 * ============================================================================
 */

/**
 * Create menu when document opens
 */
function onOpen() {
  DocumentApp.getUi()
    .createMenu('MIGOP Editor')
    .addItem('Launch Editor', 'launchMigopEditor')
    .addToUi();
}

/**
 * Manual launcher for testing - bypasses onOpen menu creation
 * Run this from Apps Script editor to add the menu
 */
function manualSetup() {
  var doc = DocumentApp.getActiveDocument();
  if (!doc) {
    Logger.log('No active document found. Open a Google Doc first.');
    return;
  }
  
  Logger.log('Setting up menu...');
  onOpen();
  Logger.log('Menu setup complete. Refresh your Google Doc.');
}

/**
 * Main entry point - loads system from bootstrap configuration
 * This is the ONLY function that gets called by the user
 */
function launchMigopEditor() {
  var ui = DocumentApp.getUi();
 
  // Hardcoded bootstrap configuration URL - this NEVER changes
  var bootstrapUrl = 'https://sites.google.com/view/migopeditor/home/start/runtime-bootstrapping/bootstrap-json';
 
  try {
    Logger.log('=== MIGOP Editor Bootstrap Starting ===');
    Logger.log('Bootstrap URL: ' + bootstrapUrl);
   
    // Step 1: Load bootstrap configuration
    var config = loadBootstrapConfig(bootstrapUrl);
    Logger.log('Configuration loaded: ' + JSON.stringify(config));
   
    // Step 2: Load all JavaScript modules specified in config
    var moduleCode = loadAllModules(config);
    Logger.log('All modules loaded successfully');
   
    // Step 3: Build HTML sidebar with injected code
    var html = buildHtmlSidebar(config, moduleCode);
   
    // Step 4: Display the sidebar
    var htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(600)
      .setTitle(config.title);
   
    DocumentApp.getUi().showSidebar(htmlOutput);
   
    Logger.log('=== MIGOP Editor Launched Successfully ===');
   
  } catch (error) {
    Logger.log('=== BOOTSTRAP ERROR ===');
    Logger.log('Error: ' + error.message);
    Logger.log('Stack: ' + error.stack);
   
    ui.alert(
      'Bootstrap Error',
      'Failed to load MIGOP Editor:\n\n' + error.message + '\n\nCheck script logs for details.',
      ui.ButtonSet.OK
    );
  }
}

/**
 * Load and parse bootstrap configuration from URL
 * Expects JSON format, handles Google Sites HTML wrapping, provides fallback
 * @param {string} url - Bootstrap configuration URL
 * @returns {Object} Configuration object with version, title, baseUrl, modules array
 */
function loadBootstrapConfig(url) {
  Logger.log('Fetching bootstrap config from: ' + url);
 
  // Try to fetch from Google Sites
  var response;
  var content;
  var useFallback = false;
  
  try {
    // Note: muteHttpExceptions prevents throwing on non-200 responses
    response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true
    });
    var responseCode = response.getResponseCode();
    
    Logger.log('Response code: ' + responseCode);
    
    if (responseCode === 200) {
      content = response.getContentText();
      Logger.log('Content length: ' + content.length + ' bytes');
    } else {
      Logger.log('Non-200 response code: ' + responseCode);
      Logger.log('Response body preview: ' + response.getContentText().substring(0, 200));
      useFallback = true;
    }
  } catch (e) {
    Logger.log('Fetch error (caught exception): ' + e.message);
    useFallback = true;
  }
  
  // If fetch failed, use fallback config
  if (useFallback) {
    Logger.log('Using fallback configuration');
    return getFallbackConfig();
  }
  
  // Parse JSON from content (handles HTML-wrapped JSON)
  var config = parseJsonConfig(content);
  
  // If parsing failed, use fallback
  if (!config) {
    Logger.log('JSON parsing failed, using fallback');
    return getFallbackConfig();
  }
  
  // Validate configuration
  if (!config.baseUrl) {
    Logger.log('baseUrl missing from config, using fallback');
    return getFallbackConfig();
  }
  
  if (!config.modules || config.modules.length === 0) {
    Logger.log('modules missing or empty, using fallback');
    return getFallbackConfig();
  }
 
  return config;
}

/**
 * Extract and parse JSON from content (handles Google Sites HTML wrapping)
 * @param {string} content - Raw content from Google Sites
 * @returns {Object|null} Parsed config object or null if failed
 */
function parseJsonConfig(content) {
  Logger.log('Attempting to parse JSON from content...');
  
  // Strategy 1: Try direct JSON.parse (works if content is pure JSON)
  try {
    var config = JSON.parse(content);
    Logger.log('✓ Direct JSON parse successful');
    return config;
  } catch (e) {
    Logger.log('Direct JSON parse failed (expected - Google Sites wraps in HTML)');
  }
  
  // Strategy 2: Look for our specific JSON structure with "baseUrl" key
  // This helps avoid Google's internal JSON (which has "productName", etc.)
  var pattern = /\{\s*"version"\s*:\s*"[^"]+"\s*,\s*"title"\s*:\s*"[^"]+"\s*,\s*"baseUrl"\s*:\s*"[^"]+"\s*,\s*"modules"\s*:\s*\[[^\]]*\]\s*\}/;
  var match = content.match(pattern);
  
  if (!match) {
    // Try simpler pattern - just look for object with baseUrl
    Logger.log('Trying broader pattern match...');
    var baseUrlPattern = /"baseUrl"\s*:\s*"[^"]+"/;
    var baseUrlMatch = content.match(baseUrlPattern);
    
    if (baseUrlMatch) {
      // Found baseUrl, now find the containing JSON object
      var baseUrlIndex = content.indexOf(baseUrlMatch[0]);
      
      // Search backwards for opening brace
      var openBrace = -1;
      for (var i = baseUrlIndex; i >= 0; i--) {
        if (content[i] === '{') {
          openBrace = i;
          break;
        }
      }
      
      // Search forwards for closing brace
      var closeBrace = -1;
      var braceCount = 0;
      for (var i = openBrace; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            closeBrace = i;
            break;
          }
        }
      }
      
      if (openBrace !== -1 && closeBrace !== -1) {
        var jsonStr = content.substring(openBrace, closeBrace + 1);
        Logger.log('Found JSON with baseUrl: ' + jsonStr.substring(0, 150) + '...');
        
        try {
          var config = JSON.parse(jsonStr);
          // Validate it has our expected structure
          if (config.baseUrl && config.modules) {
            Logger.log('✓ Found and parsed config JSON');
            return config;
          }
        } catch (e) {
          Logger.log('Parse failed: ' + e.message);
        }
      }
    }
  } else {
    Logger.log('Pattern matched, attempting parse...');
    try {
      var config = JSON.parse(match[0]);
      Logger.log('✓ Pattern match parse successful');
      return config;
    } catch (e) {
      Logger.log('Pattern match parse failed: ' + e.message);
    }
  }
  
  // Strategy 3: Look for JSON in code blocks or pre tags
  var codeBlockPatterns = [
    /<code[^>]*>([\s\S]*?)<\/code>/gi,
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi
  ];
  
  for (var p = 0; p < codeBlockPatterns.length; p++) {
    var matches = content.match(codeBlockPatterns[p]);
    if (matches) {
      for (var m = 0; m < matches.length; m++) {
        // Strip HTML tags
        var cleaned = matches[m].replace(/<[^>]*>/g, '');
        try {
          var config = JSON.parse(cleaned);
          if (config.baseUrl && config.modules) {
            Logger.log('✓ JSON found in code block');
            return config;
          }
        } catch (e) {
          // Continue trying other matches
        }
      }
    }
  }
  
  Logger.log('All JSON parsing strategies failed');
  return null;
}

/**
 * Get fallback configuration when primary config cannot be loaded
 * @returns {Object} Fallback configuration
 */
function getFallbackConfig() {
  return {
    version: '8.0-fallback',
    title: 'MIGOP Editor (Fallback Mode)',
    baseUrl: 'https://sites.google.com/view/migopeditor/home/',
    modules: [
      {
        name: 'bootstrap-test',
        url: 'https://sites.google.com/view/migopeditor/home/start/runtime-bootstrapping/bootstrap-js',
        priority: 10
      }
    ]
  };
}

/**
 * Load all JavaScript modules specified in configuration
 * @param {Object} config - Bootstrap configuration with modules array
 * @returns {Array<Object>} Array of module objects: [{name, code, priority}, ...]
 */
function loadAllModules(config) {
  var modules = [];
  
  // Sort modules by priority (lower numbers load first)
  var sortedModules = config.modules.slice().sort(function(a, b) {
    var priorityA = a.priority || 100;
    var priorityB = b.priority || 100;
    return priorityA - priorityB;
  });
  
  Logger.log('Loading ' + sortedModules.length + ' modules in priority order...');
 
  for (var i = 0; i < sortedModules.length; i++) {
    var moduleInfo = sortedModules[i];
    var moduleName = moduleInfo.name;
    var moduleUrl = moduleInfo.url;
    var priority = moduleInfo.priority || 100;
   
    Logger.log('Loading module ' + (i+1) + '/' + sortedModules.length + ': ' + moduleName + ' (priority: ' + priority + ')');
    Logger.log('Module URL: ' + moduleUrl);
   
    try {
      var response = UrlFetchApp.fetch(moduleUrl, {
        muteHttpExceptions: true,
        followRedirects: true
      });
      
      var responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        Logger.log('✗ Module returned HTTP ' + responseCode);
        throw new Error('HTTP ' + responseCode + ' when fetching module');
      }
      
      var rawContent = response.getContentText();
      Logger.log('Raw content length: ' + rawContent.length + ' bytes');
      
      // Extract JavaScript from HTML wrapper (Google Sites returns full HTML pages)
      var code = extractJavaScriptFromHtml(rawContent);
      Logger.log('Extracted JavaScript length: ' + code.length + ' bytes');
     
      modules.push({
        name: moduleName,
        code: code,
        size: code.length,
        priority: priority
      });
     
      Logger.log('✓ Module loaded successfully (' + code.length + ' bytes)');
     
    } catch (error) {
      Logger.log('✗ Failed to load module: ' + error.message);
      throw new Error('Failed to load module "' + moduleName + '": ' + error.message);
    }
  }
 
  return modules;
}

/**
 * Extract JavaScript code from HTML wrapper
 * Google Sites returns full HTML pages, we need just the JavaScript content
 * @param {string} html - Raw HTML content from Google Sites
 * @returns {string} Extracted JavaScript code
 */
function extractJavaScriptFromHtml(html) {
  // Strategy 1: Look for MIGOP module markers (most reliable)
  var startMarker = 'MIGOP_MODULE_START';
  var endMarker = 'MIGOP_MODULE_END';
  
  var startIndex = html.indexOf(startMarker);
  var endIndex = html.indexOf(endMarker);
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    // Extract everything between the markers
    var moduleCode = html.substring(startIndex + startMarker.length, endIndex);
    
    Logger.log('Raw extraction (first 500 chars): ' + moduleCode.substring(0, 500));
    
    // Clean up HTML tags first
    moduleCode = moduleCode.replace(/<[^>]*>/g, '');
    
    // Decode ALL HTML entities (not just the basic ones)
    moduleCode = moduleCode.replace(/&lt;/g, '<');
    moduleCode = moduleCode.replace(/&gt;/g, '>');
    moduleCode = moduleCode.replace(/&amp;/g, '&');
    moduleCode = moduleCode.replace(/&quot;/g, '"');
    moduleCode = moduleCode.replace(/&#39;/g, "'");
    moduleCode = moduleCode.replace(/&#x27;/g, "'");
    moduleCode = moduleCode.replace(/&apos;/g, "'");
    moduleCode = moduleCode.replace(/&nbsp;/g, ' ');
    
    moduleCode = moduleCode.trim();
    
    Logger.log('✓ Extracted JavaScript using MIGOP markers');
    Logger.log('Cleaned extraction (first 500 chars): ' + moduleCode.substring(0, 500));
    return moduleCode;
  }
  
  Logger.log('No MIGOP markers found, trying generic extraction...');
  
  // Strategy 2: Look for our JavaScript in the visible content area
  // Google Sites puts the actual page content in specific structures
  var contentPatterns = [
    /<div[^>]*class="[^"]*goog-ws-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*id="sites-canvas[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi
  ];
  
  for (var p = 0; p < contentPatterns.length; p++) {
    var match = html.match(contentPatterns[p]);
    if (match && match[0]) {
      var content = match[0];
      content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      content = content.replace(/<[^>]*>/g, '');
      content = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      
      if (content.indexOf('console.log') >= 0 || content.indexOf('function') >= 0) {
        Logger.log('Extracted JavaScript from content area');
        return content.trim();
      }
    }
  }
  
  // Strategy 3: Look in body content
  var bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    var bodyContent = bodyMatch[1];
    bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    bodyContent = bodyContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    bodyContent = bodyContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    bodyContent = bodyContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    
    var strippedContent = bodyContent.replace(/<[^>]*>/g, '');
    strippedContent = strippedContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    
    if (strippedContent.indexOf('console.log') >= 0 || strippedContent.indexOf('function') >= 0) {
      Logger.log('Extracted JavaScript from body content');
      return strippedContent.trim();
    }
  }
  
  Logger.log('WARNING: Could not reliably extract JavaScript');
  return '// Module extraction failed\nconsole.error("Failed to extract module code from HTML");';
}

/**
 * Build complete HTML sidebar with all modules injected
 * @param {Object} config - Bootstrap configuration
 * @param {Array<Object>} modules - Array of loaded modules
 * @returns {string} Complete HTML document
 */
function buildHtmlSidebar(config, modules) {
  var html = '<!DOCTYPE html>';
  html += '<html>';
  html += '<head>';
  html += '<base target="_top">';
  html += '<meta charset="utf-8">';
  html += '<title>' + config.title + ' ' + config.version + '</title>';
 
  // Basic styling
  html += '<style>';
  html += 'body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }';
  html += '#bootstrap-info { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #C8102E; }';
  html += '#bootstrap-info h3 { margin-top: 0; color: #C8102E; }';
  html += '#bootstrap-info p { margin: 5px 0; font-size: 0.9em; color: #666; }';
  html += '#app { background: white; padding: 20px; border-radius: 8px; }';
  html += '</style>';
  html += '</head>';
  html += '<body>';
 
  // Bootstrap info section
  html += '<div id="bootstrap-info">';
  html += '<h3>' + config.title + '</h3>';
  html += '<p><strong>Version:</strong> ' + config.version + '</p>';
  html += '<p><strong>Base URL:</strong> ' + config.baseUrl + '</p>';
  html += '<p><strong>Modules Loaded:</strong> ' + modules.length + '</p>';
  html += '</div>';
 
  // Application container
  html += '<div id="app">';
  html += '<div id="status">Initializing...</div>';
  html += '</div>';
 
  // Inject all module code
  html += '<script>';
  html += 'console.log("=== MIGOP Editor Bootstrap ===");';
  html += 'console.log("Version: ' + config.version + '");';
  html += 'console.log("Modules: ' + modules.length + '");';
  html += '\n';
 
  for (var i = 0; i < modules.length; i++) {
    html += '\n// ===== MODULE: ' + modules[i].name + ' (priority: ' + modules[i].priority + ', ' + modules[i].size + ' bytes) =====\n';
    html += modules[i].code;
    html += '\n// ===== END MODULE: ' + modules[i].name + ' =====\n\n';
    html += 'console.log("✓ Module loaded: ' + modules[i].name + '");';
    html += '\n';
  }
 
  html += '\nconsole.log("=== All Modules Loaded ===");';
  html += '</script>';
 
  html += '</body>';
  html += '</html>';
 
  return html;
}

/**
 * Test function - validates bootstrap without launching UI
 * Run this from Script Editor to test configuration
 */
function testBootstrap() {
  var bootstrapUrl = 'https://sites.google.com/view/migopeditor/home/start/runtime-bootstrapping/bootstrap-json';
 
  Logger.log('=== Testing Bootstrap Configuration ===');
 
  try {
    // Test 1: Load config
    Logger.log('\nTest 1: Loading configuration...');
    var config = loadBootstrapConfig(bootstrapUrl);
    Logger.log('✓ Configuration loaded successfully');
    Logger.log('  Version: ' + config.version);
    Logger.log('  Title: ' + config.title);
    Logger.log('  Base URL: ' + config.baseUrl);
    Logger.log('  Modules: ' + config.modules.length);
    for (var i = 0; i < config.modules.length; i++) {
      Logger.log('    - ' + config.modules[i].name + ' (priority: ' + (config.modules[i].priority || 100) + ')');
    }
   
    // Test 2: Load modules
    Logger.log('\nTest 2: Loading modules...');
    var modules = loadAllModules(config);
    Logger.log('✓ All modules loaded successfully');
    for (var i = 0; i < modules.length; i++) {
      Logger.log('  Module ' + (i+1) + ': ' + modules[i].name + ' (' + modules[i].size + ' bytes, priority: ' + modules[i].priority + ')');
    }
   
    // Test 3: Build HTML
    Logger.log('\nTest 3: Building HTML...');
    var html = buildHtmlSidebar(config, modules);
    Logger.log('✓ HTML built successfully (' + html.length + ' bytes)');
   
    Logger.log('\n=== Bootstrap Test PASSED ===');
    return true;
   
  } catch (error) {
    Logger.log('\n=== Bootstrap Test FAILED ===');
    Logger.log('Error: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    return false;
  }
}
