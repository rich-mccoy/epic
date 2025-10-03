/**
 * ============================================================================
 * MIGOP EDITOR V3 - Apps Script Server-Side Code (MINIMAL)
 * ============================================================================
 * 
 * This file contains ONLY functions that require Google Apps Script APIs.
 * All client-side logic (fetching config, loading modules, UI) is in bootstrap.js
 * 
 * Philosophy: Keep .gs as lightweight as possible for portability.
 * JavaScript is modular and portable; Apps Script is not.
 * 
 * CSP FIX: Uses inline fetch + eval pattern (proven in V2) instead of
 * external <script src> which violates Apps Script CSP restrictions.
 * ============================================================================
 */

// ============================================================================
// MENU INTEGRATION
// ============================================================================

function onOpen() {
  DocumentApp.getUi()
    .createMenu('MIGOP Editor')
    .addItem('Launch V3 Editor', 'showV3Sidebar')
    .addToUi();
}

/**
 * Show V3 sidebar - minimal HTML that loads bootstrap.js
 * Bootstrap.js does ALL the heavy lifting (fetch config, load modules, render UI)
 * 
 * CSP WORKAROUND: Cannot use <script src="..."> due to Apps Script CSP.
 * Instead, use inline <script> that fetches bootstrap.js as text and evals it.
 * This is the exact pattern that V2 (bootstrap.gs) proved works.
 */
function showV3Sidebar() {
  var cacheBuster = '?v=' + new Date().getTime();
  var bootstrapUrl = 'https://raw.githubusercontent.com/rich-mccoy/epic/main/migop-editor/V3/bootstrap.js' + cacheBuster;
  
  var html = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '  <base target="_top">',
    '  <meta charset="utf-8">',
    '  <title>MIGOP Editor V3</title>',
    '  <style>',
    '    body { font-family: "Google Sans", Roboto, Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }',
    '    #app { min-height: 100vh; }',
    '    .loading { padding: 20px; text-align: center; color: #666; }',
    '    .error { padding: 20px; background: #ffebee; color: #d32f2f; border-left: 4px solid #d32f2f; margin: 10px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div id="app">',
    '    <div class="loading">Loading MIGOP Editor V3...</div>',
    '  </div>',
    '  ',
    '  <!-- JSZip dependency (external CDN allowed) -->',
    '  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>',
    '  ',
    '  <!-- Bootstrap.js loaded via inline fetch + eval (CSP workaround) -->',
    '  <script>',
    '    (function() {',
    '      console.log("[v3.gs] Starting bootstrap load...");',
    '      console.log("[v3.gs] Bootstrap URL: ' + bootstrapUrl + '");',
    '      ',
    '      fetch("' + bootstrapUrl + '")',
    '        .then(function(response) {',
    '          console.log("[v3.gs] Bootstrap fetch response:", response.status);',
    '          if (!response.ok) {',
    '            throw new Error("Failed to fetch bootstrap.js: HTTP " + response.status);',
    '          }',
    '          return response.text();',
    '        })',
    '        .then(function(code) {',
    '          console.log("[v3.gs] Bootstrap.js fetched (" + code.length + " bytes), executing...");',
    '          eval(code);',
    '          console.log("[v3.gs] Bootstrap.js executed successfully");',
    '        })',
    '        .catch(function(error) {',
    '          console.error("[v3.gs] Bootstrap load failed:", error);',
    '          var appDiv = document.getElementById("app");',
    '          if (appDiv) {',
    '            appDiv.innerHTML = [',
    '              "<div class=\\"error\\">",',
    '              "  <h3>⚠️ Failed to Load Bootstrap</h3>",',
    '              "  <p><strong>Error:</strong> " + error.message + "</p>",',
    '              "  <p><strong>URL:</strong> <code>' + bootstrapUrl + '</code></p>",',
    '              "  <hr>",',
    '              "  <p><strong>Troubleshooting:</strong></p>",',
    '              "  <ol>",',
    '              "    <li>Check browser console for detailed errors (F12)</li>",',
    '              "    <li>Verify bootstrap.js is accessible at the URL above</li>",',
    '              "    <li>Check network tab for failed requests</li>",',
    '              "  </ol>",',
    '              "</div>"',
    '            ].join("");',
    '          }',
    '        });',
    '    })();',
    '  </script>',
    '</body>',
    '</html>'
  ].join('\n');
  
  var htmlOutput = HtmlService.createHtmlOutput(html)
    .setTitle('MIGOP Editor V3')
    .setWidth(500);
  
  DocumentApp.getUi().showSidebar(htmlOutput);
}

// ============================================================================
// DOCUMENT OPERATIONS (Require Apps Script APIs)
// ============================================================================

/**
 * Export active document as DOCX
 * Returns: {success: boolean, data: base64String, metadata: object}
 */
function exportDocumentAsDocx() {
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
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Replace active document content with processed DOCX
 * Param: base64Data - Base64-encoded DOCX file
 * Returns: {success: boolean, replacementDetails: object}
 */
function replaceDocumentWithProcessedDocx(base64Data) {
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
    
    var resource = {
      title: docName,
      mimeType: 'application/vnd.google-apps.document'
    };
    
    var optionalArgs = {
      convert: true,
      newRevision: true
    };
    
    var updatedFile = Drive.Files.update(resource, docId, docxBlob, optionalArgs);
    
    return {
      success: true,
      replacementDetails: {
        replacedAt: new Date().toISOString(),
        docId: updatedFile.id,
        replacementType: 'drive_api_v2'
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// VERSION MANAGEMENT (Require PropertiesService)
// ============================================================================

/**
 * Get or increment version counter
 * Param: increment - boolean, if true increments counter
 * Returns: number (current counter value)
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
    return 1;
  }
}

/**
 * Get document property
 */
function getDocumentProperty(key) {
  try {
    var properties = PropertiesService.getDocumentProperties();
    return properties.getProperty(key);
  } catch (error) {
    return null;
  }
}

/**
 * Set document property
 */
function setDocumentProperty(key, value) {
  try {
    var properties = PropertiesService.getDocumentProperties();
    properties.setProperty(key, value);
    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Save version metadata to document properties
 */
function saveVersionMetadata(versionData) {
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
    
    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Load version metadata from document properties
 */
function loadVersionMetadata() {
  try {
    var properties = PropertiesService.getDocumentProperties();
    var historyJson = properties.getProperty('MIGOP_VERSION_HISTORY');
    
    if (!historyJson) {
      return [];
    }
    
    return JSON.parse(historyJson);
  } catch (error) {
    return [];
  }
}

/**
 * Write version history page to document
 */
function writeVersionHistoryPage(versionData) {
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
    
    return {
      success: true,
      message: 'Version history updated successfully'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create version history page (first time)
 */
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

/**
 * Insert version entry into history page
 * NOTE: versionData.formattedDate is provided by client (version-manager.js)
 */
function insertVersionEntry(body, position, versionData) {
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
  
  var datePara = cell.appendParagraph('Date: ' + versionData.formattedDate);
  datePara.setFontSize(10);
  datePara.setItalic(true);
  
  cell.appendParagraph('');
  
  var commentsLabel = cell.appendParagraph('Comments:');
  commentsLabel.setFontSize(10);
  commentsLabel.setBold(true);
  
  var commentsPara = cell.appendParagraph(versionData.comments);
  commentsPara.setFontSize(10);
}
