/**
 * MIGOP Editor 8.0 - Apps Script with Drive API Update
 */

function AppsScriptLogger() {
  this.sessionId = Utilities.getUuid().substring(0, 8);
  this.startTime = new Date();
  console.log('APPSCRIPT_LOGGER: Session ' + this.sessionId + ' started at ' + this.startTime.toISOString());
}

AppsScriptLogger.prototype.log = function(level, component, message, data) {
  var timestamp = new Date().toISOString();
  var elapsed = new Date() - this.startTime;
  var logMessage = '[' + this.sessionId + '][' + elapsed + 'ms][' + level + '][' + component + '] ' + message;
  
  if (data) {
    if (typeof data === 'object') {
      try {
        logMessage += '\nDATA: ' + JSON.stringify(data, null, 2);
      } catch (e) {
        logMessage += '\nDATA: [stringify failed]';
      }
    } else {
      logMessage += '\nDATA: ' + data;
    }
  }
  
  console.log(logMessage);
  return logMessage;
};

AppsScriptLogger.prototype.error = function(component, message, error) {
  var errorData = {
    message: error.message || 'Unknown error',
    stack: error.stack || 'No stack trace',
    name: error.name || 'Error'
  };
  return this.log('ERROR', component, message, errorData);
};

AppsScriptLogger.prototype.info = function(component, message, data) {
  return this.log('INFO', component, message, data);
};

AppsScriptLogger.prototype.debug = function(component, message, data) {
  return this.log('DEBUG', component, message, data);
};

AppsScriptLogger.prototype.warn = function(component, message, data) {
  return this.log('WARN', component, message, data);
};

function GoogleDocsExportService(logger) {
  this.logger = logger;
  this.logger.info('GoogleDocsExportService', 'Service initialized');
}

GoogleDocsExportService.prototype.exportToDocx = function() {
  this.logger.info('GoogleDocsExportService', 'Starting DOCX export');
  
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
    
    this.logger.info('GoogleDocsExportService', 'DOCX export completed', {
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
    this.logger.error('GoogleDocsExportService', 'Export failed', error);
    return {
      success: false,
      error: error.message
    };
  }
};

function DocumentReplacementService(logger) {
  this.logger = logger;
  this.logger.info('DocumentReplacementService', 'Service initialized');
}

DocumentReplacementService.prototype.replaceWithProcessedContent = function(processedResult) {
  this.logger.info('DocumentReplacementService', 'Starting document replacement', {
    resultSuccess: processedResult.success,
    suggestionsCount: processedResult.suggestions ? processedResult.suggestions.length : 0,
    hasRebuiltDocx: !!(processedResult.metadata && processedResult.metadata.rebuiltDocxBase64)
  });

  try {
    if (!processedResult.success) {
      throw new Error('Cannot replace document with failed processing result');
    }

    if (processedResult.metadata && processedResult.metadata.rebuiltDocxBase64) {
      return this.replaceWithDriveAPI(processedResult);
    } else {
      throw new Error('No rebuilt DOCX data available');
    }

  } catch (error) {
    this.logger.error('DocumentReplacementService', 'Document replacement failed', error);
    return {
      success: false,
      error: error.message
    };
  }
};

DocumentReplacementService.prototype.replaceWithDriveAPI = function(processedResult) {
  this.logger.info('DocumentReplacementService', 'Replacing document using Drive API');
  
  try {
    var doc = DocumentApp.getActiveDocument();
    var docId = doc.getId();
    var docName = doc.getName();
    
    var base64Data = processedResult.metadata.rebuiltDocxBase64;
    var docxBytes = Utilities.base64Decode(base64Data);
    var docxBlob = Utilities.newBlob(
      docxBytes, 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'temp.docx'
    );
    
    this.logger.debug('DocumentReplacementService', 'DOCX blob created', {
      blobSize: docxBlob.getBytes().length
    });
    
    var resource = {
      title: docName,
      mimeType: 'application/vnd.google-apps.document'
    };
    
    var optionalArgs = {
      convert: true,
      newRevision: true
    };
    
    this.logger.info('DocumentReplacementService', 'Calling Drive.Files.update');
    
    var updatedFile = Drive.Files.update(resource, docId, docxBlob, optionalArgs);
    
    this.logger.info('DocumentReplacementService', 'Drive API update successful', {
      fileId: updatedFile.id,
      title: updatedFile.title,
      mimeType: updatedFile.mimeType
    });
    
    return {
      success: true,
      replacementDetails: {
        suggestionsProcessed: processedResult.suggestions.length,
        replacedAt: new Date().toISOString(),
        docId: updatedFile.id,
        replacementType: 'drive_api_v2'
      }
    };
    
  } catch (error) {
    this.logger.error('DocumentReplacementService', 'Drive API update failed', error);
    return {
      success: false,
      error: error.message
    };
  }
};

function AppsScriptController() {
  this.logger = new AppsScriptLogger();
  this.exportService = new GoogleDocsExportService(this.logger);
  this.replacementService = new DocumentReplacementService(this.logger);
  this.logger.info('AppsScriptController', 'Controller initialized');
}

AppsScriptController.prototype.getDocxDataForBrowser = function() {
  this.logger.info('AppsScriptController', 'getDocxDataForBrowser called from browser');
  return this.exportService.exportToDocx();
};

AppsScriptController.prototype.replaceDocumentWithProcessedResult = function(processedResult) {
  this.logger.info('AppsScriptController', 'replaceDocumentWithProcessedResult called');
  return this.replacementService.replaceWithProcessedContent(processedResult);
};

AppsScriptController.prototype.logFromBrowser = function(message) {
  this.logger.info('BROWSER_BRIDGE', message);
};

var appsScriptController = null;

function createMigopEditor7() {
  var logger = new AppsScriptLogger();
  logger.info('MAIN', 'MIGOP Editor 8.0 startup initiated');
  
  try {
    appsScriptController = new AppsScriptController();
    
    var htmlContent = generateModularInterface();
    var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(500)
      .setTitle('MIGOP Editor 8.0');
    
    DocumentApp.getUi().showSidebar(htmlOutput);
    logger.info('MAIN', 'MIGOP Editor 8.0 interface launched successfully');
    
  } catch (error) {
    logger.error('MAIN', 'Failed to launch MIGOP Editor 8.0', error);
    throw error;
  }
}

function getDocxDataForBrowser() {
  if (!appsScriptController) {
    appsScriptController = new AppsScriptController();
  }
  return appsScriptController.getDocxDataForBrowser();
}

function replaceDocumentWithProcessedResult(processedResult) {
  if (!appsScriptController) {
    appsScriptController = new AppsScriptController();
  }
  return appsScriptController.replaceDocumentWithProcessedResult(processedResult);
}

function logFromBrowser(message) {
  if (!appsScriptController) {
    appsScriptController = new AppsScriptController();
  }
  appsScriptController.logFromBrowser(message);
}

function generateModularInterface() {
  var html = '<!DOCTYPE html>';
  html += '<html>';
  html += '<head>';
  html += '<base target="_top">';
  html += '<meta charset="utf-8">';
  html += '<title>MIGOP Editor 8.0</title>';
  html += generateStyles();
  html += '</head>';
  html += '<body>';
  html += generateBody();
  html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>';
  
  html += loadModule('migop-base');
  html += loadModule('migop-log');
  html += loadModule('migop-detection');
  html += loadModule('migop-xml');
  html += loadModule('migop-docx');
  html += loadModule('migop-pipe');
  html += loadModule('migop-main');
  html += loadModule('migop-uihelp');
  
  html += '</body>';
  html += '</html>';
  
  return html;
}

function loadModule(moduleName) {
  try {
    return HtmlService.createHtmlOutputFromFile(moduleName).getContent();
  } catch (error) {
    console.log('Failed to load module: ' + moduleName + ' - ' + error.toString());
    return '<script>console.error("Failed to load module: ' + moduleName + '");</script>';
  }
}

function generateStyles() {
  return '<style>' +
    'body { font-family: "Segoe UI", Arial, sans-serif; padding: 20px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); margin: 0; }' +
    '.container { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }' +
    '.header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; }' +
    '.version { font-size: 12px; color: #6c757d; background: #f8f9fa; padding: 4px 8px; border-radius: 12px; display: inline-block; margin-left: 10px; }' +
    '.section { border: 1px solid #dee2e6; margin: 15px 0; padding: 20px; border-radius: 8px; background: #f8f9fa; }' +
    '.section-title { font-weight: 600; color: #495057; margin-bottom: 15px; font-size: 16px; }' +
    '.main-button { background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; padding: 12px 24px; width: 100%; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3); }' +
    '.main-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0, 123, 255, 0.4); }' +
    '.main-button:disabled { background: #6c757d; cursor: not-allowed; transform: none; box-shadow: none; }' +
    '.control-button { margin: 5px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }' +
    '.control-button:hover { background: #218838; }' +
    '.log-area { background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; padding: 15px; margin: 15px 0; height: 350px; overflow-y: auto; font-family: "Consolas", "Monaco", monospace; font-size: 11px; white-space: pre-wrap; border-radius: 6px; line-height: 1.4; }' +
    '.status { padding: 12px; margin: 15px 0; border-radius: 6px; font-weight: 500; }' +
    '.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }' +
    '.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }' +
    '.warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }' +
    '.info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }' +
    '.description { font-size: 13px; color: #6c757d; margin-top: 8px; line-height: 1.4; }' +
    '.controls { display: flex; gap: 10px; margin-top: 10px; }' +
    '.module-status { font-size: 10px; color: #28a745; margin-top: 5px; }' +
    '.checkbox-label { font-size: 13px; color: #495057; margin-top: 10px; display: block; }' +
    '.checkbox-label input { margin-right: 6px; }' +
    '</style>';
}

function generateBody() {
  return '<div class="container">' +
    '<div class="header">' +
    '<h2>MIGOP Editor <span class="version">v8.0</span></h2>' +
    '<div style="font-size: 14px; color: #6c757d;">Drive API Integration</div>' +
    '<div class="module-status" id="moduleStatus">Loading modules...</div>' +
    '</div>' +
    '<div class="section">' +
    '<div class="section-title">Document Processing</div>' +
    '<button class="main-button" id="processBtn" onclick="MIGOP.startProcessing()" disabled>Loading...</button>' +
    '<div class="description">Converts tracked changes to plain text formatting</div>' +
    '<label class="checkbox-label"><input type="checkbox" id="downloadDocx"> Auto-download processed DOCX for debugging</label>' +
    '</div>' +
    '<div class="section">' +
    '<div class="section-title">Debug Console</div>' +
    '<div id="log" class="log-area">MIGOP Editor 8.0\n\n[System] Loading modules...\nWait for initialization...</div>' +
    '<div class="controls">' +
    '<button class="control-button" onclick="MIGOP.UI.copyLog()">Copy</button>' +
    '<button class="control-button" onclick="MIGOP.UI.clearLog()">Clear</button>' +
    '<button class="control-button" onclick="MIGOP.UI.exportLog()">Export</button>' +
    '</div>' +
    '</div>' +
    '<div id="status" class="status info">Loading modular system...</div>' +
    '</div>';
}
