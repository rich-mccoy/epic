/**
 * ============================================================================
 * MIGOP EDITOR V3 - Apps Script Server-Side Code
 * ============================================================================
 * 
 * This is the ONLY .gs file deployed to Google Apps Script.
 * It combines:
 * - V2 Bootstrap system (dynamic module loading)
 * - V1 Server functions (export, replace, logging)
 * - V3 Version management (counter, metadata, history page)
 * 
 * All client-side code loads dynamically from GitHub via bootstrap.
 * 
 * ============================================================================
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var V3_CONFIG = {
  BOOTSTRAP_URL: 'https://raw.githubusercontent.com/rich-mccoy/epic/main/migop-editor/V3/v3-bootstrap.json',
  VERSION: '3.0',
  FALLBACK_DISABLED: true
};

// ============================================================================
// MENU INTEGRATION
// ============================================================================

function onOpen() {
  DocumentApp.getUi()
    .createMenu('MIGOP Editor')
    .addItem('Launch V3 Editor', 'showV3Sidebar')
    .addSeparator()
    .addItem('Launch V1 Editor (Legacy)', 'showV1Sidebar')
    .addToUi();
}

function showV3Sidebar() {
  try {
    console.log('=== MIGOP Editor V3 Bootstrap Starting ===');
    console.log('Bootstrap URL: ' + V3_CONFIG.BOOTSTRAP_URL);
    
    var config = fetchBootstrapConfig();
    
    if (!config.success) {
      if (V3_CONFIG.FALLBACK_DISABLED) {
        console.log('Config fetch failed, fallback disabled');
        showErrorSidebar(config.error);
        return;
      }
      console.log('Config fetch failed, using fallback');
      config = getFallbackConfig();
    }
    
    var html = generateSidebarHTML(config);
    
    var htmlOutput = HtmlService.createHtmlOutput(html)
      .setTitle('MIGOP Editor V3')
      .setWidth(500);
    
    DocumentApp.getUi().showSidebar(htmlOutput);
    
    console.log('=== MIGOP Editor V3 Launched Successfully ===');
    
  } catch (error) {
    console.log('Error in showV3Sidebar: ' + error.toString());
    showErrorSidebar('Failed to initialize MIGOP Editor V3: ' + error.message);
  }
}

// ============================================================================
// BOOTSTRAP SYSTEM
// ============================================================================

function fetchBootstrapConfig() {
  try {
    console.log('Fetching bootstrap config from: ' + V3_CONFIG.BOOTSTRAP_URL);
    
    var response = UrlFetchApp.fetch(V3_CONFIG.BOOTSTRAP_URL, {
      muteHttpExceptions: true,
      followRedirects: true
    });
    
    var responseCode = response.getResponseCode();
    console.log('Response code: ' + responseCode);
    
    if (responseCode !== 200) {
      return {
        success: false,
        error: 'Failed to fetch config (HTTP ' + responseCode + ')'
      };
    }
    
    var content = response.getContentText();
    console.log('Content length: ' + content.length + ' bytes');
    
    var config = JSON.parse(content);
    
    if (!config.baseUrl || !config.modules || config.modules.length === 0) {
      console.log('Config validation failed - missing required fields');
      return {
        success: false,
        error: 'Config missing required fields (baseUrl or modules)'
      };
    }
    
    console.log('Configuration loaded: ' + JSON.stringify(config));
    
    return {
      success: true,
      config: config
    };
    
  } catch (error) {
    console.log('Error fetching config: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

function generateSidebarHTML(configResult) {
  var config = configResult.config;
  var html = [];
  
  html.push('<!DOCTYPE html>');
  html.push('<html>');
  html.push('<head>');
  html.push('  <base target="_top">');
  html.push('  <meta charset="utf-8">');
  html.push('  <title>' + (config.title || 'MIGOP Editor V3') + '</title>');
  html.push('  <style>');
  html.push('    body { font-family: "Google Sans", Roboto, Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }');
  html.push('    #status { padding: 10px; background: #fff; border-bottom: 1px solid #ddd; font-size: 12px; color: #666; }');
  html.push('    #app { padding: 0; }');
  html.push('    .loading { padding: 20px; text-align: center; color: #666; }');
  html.push('  </style>');
  html.push('</head>');
  html.push('<body>');
  html.push('  <div id="status">Loading MIGOP Editor v' + (config.version || '3.0') + '...</div>');
  html.push('  <div id="app"><div class="loading">Initializing modules...</div></div>');
  
  // Add JSZip
  if (config.dependencies && config.dependencies.jszip) {
    html.push('  <script src="' + config.dependencies.jszip + '"></script>');
  } else {
    html.push('  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>');
  }
  
  // Error handling
  html.push('  <script>');
  html.push('    window.addEventListener("error", function(e) {');
  html.push('      console.error("Global error:", e);');
  html.push('      var statusDiv = document.getElementById("status");');
  html.push('      if (statusDiv) {');
  html.push('        statusDiv.innerHTML = "Error: " + e.message;');
  html.push('        statusDiv.style.background = "#ffebee"; statusDiv.style.color = "#d32f2f";');
  html.push('      }');
  html.push('    });');
  html.push('    console.log("Bootstrap: Starting module load...");');
  html.push('  </script>');
  
  // Sort and load modules
  var sortedModules = config.modules.slice().sort(function(a, b) {
    return (a.priority || 100) - (b.priority || 100);
  });
  
  console.log('Loading ' + sortedModules.length + ' modules in priority order...');
  
  // Generate sequential module loading using script injection (CSP-safe)
  html.push('  <script>');
  html.push('    (function() {');
  html.push('      var modules = ' + JSON.stringify(sortedModules) + ';');
  html.push('      var currentIndex = 0;');
  html.push('      ');
  html.push('      function loadNextModule() {');
  html.push('        if (currentIndex >= modules.length) {');
  html.push('          console.log("All modules loaded successfully");');
  html.push('          setTimeout(function() {');
  html.push('            var statusDiv = document.getElementById("status");');
  html.push('            if (statusDiv && !statusDiv.innerHTML.includes("failed")) {');
  html.push('              statusDiv.innerHTML = "✓ MIGOP Editor V3 ready";');
  html.push('              statusDiv.style.background = "#e8f5e9";');
  html.push('              statusDiv.style.color = "#2e7d32";');
  html.push('            }');
  html.push('          }, 500);');
  html.push('          return;');
  html.push('        }');
  html.push('        ');
  html.push('        var module = modules[currentIndex];');
  html.push('        console.log("Loading module " + (currentIndex + 1) + "/" + modules.length + ": " + module.name);');
  html.push('        ');
  html.push('        fetch(module.url)');
  html.push('          .then(function(response) {');
  html.push('            if (!response.ok) throw new Error("HTTP " + response.status);');
  html.push('            return response.text();');
  html.push('          })');
  html.push('          .then(function(code) {');
  html.push('            console.log("Module " + module.name + " fetched (" + code.length + " bytes)");');
  html.push('            var scriptCode = code;');
  html.push('            var scriptMatch = code.match(/<script[^>]*>([\\s\\S]*?)<\\/script>/i);');
  html.push('            if (scriptMatch && scriptMatch[1]) {');
  html.push('              scriptCode = scriptMatch[1];');
  html.push('              console.log("Extracted from <script> tags");');
  html.push('            }');
  html.push('            ');
  html.push('            var script = document.createElement("script");');
  html.push('            script.type = "text/javascript";');
  html.push('            script.text = scriptCode;');
  html.push('            document.head.appendChild(script);');
  html.push('            console.log("Module " + module.name + " loaded successfully");');
  html.push('            currentIndex++;');
  html.push('            setTimeout(loadNextModule, 100);');
  html.push('          })');
  html.push('          .catch(function(error) {');
  html.push('            console.error("Failed to load module " + module.name + ":", error);');
  html.push('            var statusDiv = document.getElementById("status");');
  html.push('            if (statusDiv) {');
  html.push('              statusDiv.innerHTML += "<br>⚠️ Module " + module.name + " failed: " + error.message;');
  html.push('              statusDiv.style.background = "#fff3cd";');
  html.push('            }');
  html.push('            currentIndex++;');
  html.push('            loadNextModule();');
  html.push('          });');
  html.push('      }');
  html.push('      ');
  html.push('      loadNextModule();');
  html.push('    })();');
  html.push('  </script>');
  
  html.push('</body>');
  html.push('</html>');
  
  console.log('All modules loaded successfully');
  return html.join('\n');
}

function showErrorSidebar(errorMessage) {
  var html = [
    '<!DOCTYPE html><html><head><base target="_top"><style>',
    'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }',
    '.error { background: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 10px 0; color: #d32f2f; }',
    '.help { background: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin: 20px 0; font-size: 14px; }',
    'code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: monospace; }',
    '</style></head><body>',
    '<h2>⚠️ Bootstrap Error</h2>',
    '<div class="error"><strong>Failed to load MIGOP Editor V3</strong><br><br>' + errorMessage + '</div>',
    '<div class="help"><strong>Troubleshooting:</strong><ol>',
    '<li>Verify config URL: <code>' + V3_CONFIG.BOOTSTRAP_URL + '</code></li>',
    '<li>Check JSON is valid and contains required fields</li>',
    '<li>Ensure module URLs are accessible</li>',
    '<li>View Apps Script logs: View → Logs</li>',
    '</ol></div></body></html>'
  ].join('\n');
  
  var htmlOutput = HtmlService.createHtmlOutput(html)
    .setTitle('MIGOP Editor V3 - Error')
    .setWidth(500);
  
  DocumentApp.getUi().showSidebar(htmlOutput);
}

function getFallbackConfig() {
  console.log('Using fallback configuration');
  return {
    success: true,
    config: {
      version: '3.0-fallback',
      title: 'MIGOP Editor V3 (Fallback)',
      baseUrl: 'https://raw.githubusercontent.com/rich-mccoy/epic/main/migop-editor/V3/',
      modules: [
        {name: 'test-module', url: 'https://raw.githubusercontent.com/rich-mccoy/epic/main/migop-editor/boostrap/bootstrap.js', priority: 10}
      ],
      dependencies: {
        jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
      }
    }
  };
}

// ============================================================================
// V1 SERVER FUNCTIONS
// ============================================================================

function AppsScriptLogger() {
  this.sessionId = Utilities.getUuid().substring(0, 8);
  this.startTime = new Date();
  console.log('APPSCRIPT_LOGGER: Session ' + this.sessionId + ' started');
}

AppsScriptLogger.prototype.log = function(level, component, message, data) {
  var timestamp = new Date().toISOString();
  var elapsed = new Date() - this.startTime;
  var logMessage = '[' + this.sessionId + '][' + elapsed + 'ms][' + level + '][' + component + '] ' + message;
  if (data) logMessage += '\nDATA: ' + JSON.stringify(data, null, 2);
  console.log(logMessage);
  return logMessage;
};

AppsScriptLogger.prototype.info = function(component, message, data) { return this.log('INFO', component, message, data); };
AppsScriptLogger.prototype.error = function(component, message, error) { 
  return this.log('ERROR', component, message, {message: error.message, stack: error.stack}); 
};

function exportDocumentAsDocx() {
  var logger = new AppsScriptLogger();
  logger.info('ExportService', 'Starting DOCX export');
  
  try {
    var doc = DocumentApp.getActiveDocument();
    var docId = doc.getId();
    var docName = doc.getName();
    
    var exportUrl = 'https://docs.google.com/document/d/' + docId + '/export?format=docx';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('Export failed with HTTP ' + response.getResponseCode());
    }

    var bytes = response.getBlob().getBytes();
    var base64Data = Utilities.base64Encode(bytes);
    
    logger.info('ExportService', 'DOCX export completed', {
      originalSize: bytes.length,
      base64Size: base64Data.length
    });

    return {
      success: true,
      data: base64Data,
      metadata: {
        originalSize: bytes.length,
        base64Size: base64Data.length,
        docId: docId,
        docName: docName,
        exportedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('ExportService', 'Export failed', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function replaceDocumentWithProcessedDocx(base64Data) {
  var logger = new AppsScriptLogger();
  logger.info('ReplaceService', 'Starting document replacement');
  
  try {
    var doc = DocumentApp.getActiveDocument();
    var docId = doc.getId();
    var docName = doc.getName();
    
    var docxBytes = Utilities.base64Decode(base64Data);
    var docxBlob = Utilities.newBlob(
      docxBytes, 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'temp.docx'
    );
    
    logger.info('ReplaceService', 'DOCX blob created', {blobSize: docxBlob.getBytes().length});
    
    var resource = {
      title: docName,
      mimeType: 'application/vnd.google-apps.document'
    };
    
    var optionalArgs = {
      convert: true,
      newRevision: true
    };
    
    logger.info('ReplaceService', 'Calling Drive.Files.update');
    var updatedFile = Drive.Files.update(resource, docId, docxBlob, optionalArgs);
    
    logger.info('ReplaceService', 'Drive API update successful', {
      fileId: updatedFile.id,
      title: updatedFile.title
    });
    
    return {
      success: true,
      replacementDetails: {
        replacedAt: new Date().toISOString(),
        docId: updatedFile.id,
        replacementType: 'drive_api_v2'
      }
    };
    
  } catch (error) {
    logger.error('ReplaceService', 'Drive API update failed', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// V3 VERSION MANAGEMENT
// ============================================================================

function getOrIncrementVersionCounter(increment) {
  var logger = new AppsScriptLogger();
  logger.info('VersionManager', 'Getting version counter', {increment: increment});
  
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
      logger.info('VersionManager', 'Version counter incremented', {newCount: numericCount});
    }
    
    return numericCount;
  } catch (error) {
    logger.error('VersionManager', 'Failed to get version counter', error);
    return 1;
  }
}

function getDocumentProperty(key) {
  try {
    var properties = PropertiesService.getDocumentProperties();
    return properties.getProperty(key);
  } catch (error) {
    console.log('Error getting property ' + key + ': ' + error.toString());
    return null;
  }
}

function setDocumentProperty(key, value) {
  try {
    var properties = PropertiesService.getDocumentProperties();
    properties.setProperty(key, value);
    return {success: true};
  } catch (error) {
    console.log('Error setting property ' + key + ': ' + error.toString());
    return {success: false, error: error.message};
  }
}

function saveVersionMetadata(versionData) {
  var logger = new AppsScriptLogger();
  logger.info('VersionManager', 'Saving version metadata', {versionNumber: versionData.versionNumber});
  
  try {
    var properties = PropertiesService.getDocumentProperties();
    var historyJson = properties.getProperty('MIGOP_VERSION_HISTORY');
    
    var history = [];
    if (historyJson) {
      history = JSON.parse(historyJson);
    }
    
    history.unshift({
      versionNumber: versionData.versionNumber,
      committee: versionData.committee,
      timestamp: versionData.timestamp,
      comments: versionData.comments
    });
    
    properties.setProperty('MIGOP_VERSION_HISTORY', JSON.stringify(history));
    
    logger.info('VersionManager', 'Version metadata saved successfully');
    return {success: true};
  } catch (error) {
    logger.error('VersionManager', 'Failed to save version metadata', error);
    return {success: false, error: error.message};
  }
}

function loadVersionMetadata() {
  try {
    var properties = PropertiesService.getDocumentProperties();
    var historyJson = properties.getProperty('MIGOP_VERSION_HISTORY');
    
    if (!historyJson) {
      return [];
    }
    
    return JSON.parse(historyJson);
  } catch (error) {
    console.log('Failed to load version metadata: ' + error.toString());
    return [];
  }
}

function writeVersionHistoryPage(versionData) {
  var logger = new AppsScriptLogger();
  logger.info('VersionManager', 'Writing version history page', {
    versionNumber: versionData.versionNumber,
    committee: versionData.committee
  });
  
  try {
    var saveResult = saveVersionMetadata(versionData);
    if (!saveResult.success) {
      return saveResult;
    }
    
    var doc = DocumentApp.getActiveDocument();
    var body = doc.getBody();
    
    var historyExists = false;
    var historyTitleIndex = -1;
    
    var numChildren = body.getNumChildren();
    for (var i = 0; i < numChildren; i++) {
      var child = body.getChild(i);
      if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
        var text = child.asParagraph().getText();
        if (text.indexOf('MIGOP Document Version History') !== -1) {
          historyExists = true;
          historyTitleIndex = i;
          break;
        }
      }
    }
    
    if (historyExists) {
      insertVersionEntry(body, historyTitleIndex + 2, versionData);
    } else {
      createVersionHistoryPage(body, versionData);
    }
    
    logger.info('VersionManager', 'Version history page updated successfully');
    return {
      success: true,
      message: 'Version history updated successfully'
    };
    
  } catch (error) {
    logger.error('VersionManager', 'Failed to write version history page', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function createVersionHistoryPage(body, versionData) {
  var title = body.insertParagraph(0, 'MIGOP Document Version History');
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  title.setFontSize(18);
  title.setBold(true);
  title.setForegroundColor('#C8102E');
  
  body.insertParagraph(1, '');
  insertVersionEntry(body, 2, versionData);
  body.insertPageBreak(3);
}

function insertVersionEntry(body, position, versionData) {
  var parts = versionData.versionNumber.split(':');
  var dateStr = formatVersionDate(parts);
  
  var table = body.insertTable(position);
  var row = table.appendTableRow();
  var cell = row.appendTableCell();
  
  cell.setBackgroundColor('#F5F5F5');
  cell.setPaddingTop(10);
  cell.setPaddingBottom(10);
  cell.setPaddingLeft(10);
  cell.setPaddingRight(10);
  
  var versionPara = cell.appendParagraph('Version: ' + versionData.versionNumber);
  versionPara.setFontSize(12);
  versionPara.setBold(true);
  
  var committeePara = cell.appendParagraph('Approved By: ' + versionData.committee);
  committeePara.setFontSize(11);
  
  var datePara = cell.appendParagraph('Date: ' + dateStr);
  datePara.setFontSize(10);
  datePara.setItalic(true);
  
  cell.appendParagraph('');
  
  var commentsLabel = cell.appendParagraph('Comments:');
  commentsLabel.setFontSize(10);
  commentsLabel.setBold(true);
  
  var commentsPara = cell.appendParagraph(versionData.comments);
  commentsPara.setFontSize(10);
  
  body.insertParagraph(position + 1, '');
}

function formatVersionDate(parts) {
  if (parts.length < 8) return 'Invalid date';
  
  var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
  
  var year = 2000 + parseInt(parts[2]);
  var month = monthNames[parseInt(parts[3]) - 1];
  var day = parseInt(parts[4]);
  var hour = parseInt(parts[5]);
  var minute = parts[6];
  
  var hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  var ampm = hour >= 12 ? 'PM' : 'AM';
  
  return month + ' ' + day + ', ' + year + ' at ' + hour12 + ':' + minute + ' ' + ampm;
}

function logFromBrowser(message) {
  console.log('[BROWSER] ' + message);
}

function showV1Sidebar() {
  DocumentApp.getUi().alert('V1 Legacy editor not yet implemented in V3');
}
