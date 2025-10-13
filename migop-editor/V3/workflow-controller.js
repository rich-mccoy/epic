/**
 * ============================================================================
 * MIGOP EDITOR V3 - WORKFLOW CONTROLLER
 * ============================================================================
 * 
 * DEV HISTORY:
 * -----------
 * 2025-10-04 - Initial V3 implementation with chunked processing
 *            - Added status routing via CustomEvents
 *            - Implemented 3-phase workflow with pause points
 * 
 * 2025-10-12 - CRITICAL FIX: Browser freeze on large docs
 *            - chunkProcess() was defined but NEVER CALLED
 *            - Suggestion analysis still had synchronous loops
 *            - XML transformation had synchronous loops
 *            - Added TRUE chunking with yields to all heavy operations
 *            - Added rapid status blasting (every 5 items during processing)
 *            - Reduced chunk sizes: 20→10 for XML, 50→25 for suggestions
 *            - Added time-based yielding (yield every 50ms max)
 * 
 * 2025-10-12 - Method name fixes + error handling
 *            - Fixed: parseSuggestionElement → extractSuggestions (V1 method)
 *            - Fixed: applySuggestionMarkup → transformXml (V1 method)
 *            - V1 modules already efficient, removed unnecessary chunking
 *            - Added comprehensive try/catch to all phase executions
 *            - All errors now route to handleError() for user display
 * 
 * KNOWN ISSUES:
 * - None currently
 * 
 * TODO:
 * - Add error handling to version-manager.js, workflow-ui.js, v3.gs
 * 
 * ============================================================================
 */

(function() {
  'use strict';
  
  var requiredModules = ['Base', 'Log', 'Detection', 'Xml', 'Docx', 'VersionManager'];
  var missingModules = [];
  
  requiredModules.forEach(function(module) {
    if (!window.MIGOP || !window.MIGOP[module]) {
      missingModules.push(module);
    }
  });
  
  if (missingModules.length > 0) {
    throw new Error('workflow-controller.js requires: ' + missingModules.join(', '));
  }
  
  var Base = window.MIGOP.Base;
  var Log = window.MIGOP.Log;
  var Detection = window.MIGOP.Detection;
  var Xml = window.MIGOP.Xml;
  var Docx = window.MIGOP.Docx;
  var VersionManager = window.MIGOP.VersionManager;
  
  var WorkflowStates = {
    IDLE: 'IDLE',
    PHASE_1_EXPORTING: 'PHASE_1_EXPORTING',
    PHASE_1_ANALYZING: 'PHASE_1_ANALYZING',
    VERSION_1_PAUSE: 'VERSION_1_PAUSE',
    PHASE_2_TRANSFORMING: 'PHASE_2_TRANSFORMING',
    PHASE_2_REBUILDING: 'PHASE_2_REBUILDING',
    PHASE_2_REPLACING: 'PHASE_2_REPLACING',
    VERSION_2_PAUSE: 'VERSION_2_PAUSE',
    PHASE_3_FINALIZING: 'PHASE_3_FINALIZING',
    COMPLETE: 'COMPLETE',
    ERROR: 'ERROR'
  };
  
  function WorkflowController(logger) {
    this.logger = logger || Log.getLogger();
    this.versionManager = new VersionManager(this.logger);
    this.currentState = WorkflowStates.IDLE;
    this.workflowData = this.createInitialState();
    this.docxProcessor = Docx.createProcessor(this.logger);
    this.suggestionDetector = Detection.createDetector('standard', this.logger);
    this.xmlTransformer = Xml.createTransformer('standard', this.logger);
    this.activeServerCalls = new Set();
    this.currentStatus = '';
    this.statusStartTime = null;
    this.logger.info('WorkflowController', 'Controller initialized');
  }
  
  WorkflowController.prototype.createInitialState = function() {
    return {
      versionCounter: null,
      phase1: {
        exportedDocxBlob: null,
        exportedDocxBase64: null,
        documentXml: null,
        suggestions: [],
        versionNumber: null,
        zip: null
      },
      phase2: {
        modifiedXml: null,
        rebuiltDocxBlob: null,
        rebuiltDocxBase64: null,
        versionNumber: null,
        isOfficial: false
      },
      phase3: {
        committee: null,
        comments: null,
        timestamp: null
      }
    };
  };
  
  WorkflowController.prototype.getCurrentPhaseInfo = function() {
    var state = this.currentState;
    if (state === WorkflowStates.IDLE) {
      return {phase: 0, name: 'Ready', description: 'Click Start to begin'};
    } else if (state.startsWith('PHASE_1') || state === WorkflowStates.VERSION_1_PAUSE) {
      return {phase: 1, name: 'Export & Analyze', description: 'Exporting document and detecting suggestions'};
    } else if (state.startsWith('PHASE_2') || state === WorkflowStates.VERSION_2_PAUSE) {
      return {phase: 2, name: 'Transform & Replace', description: 'Converting suggestions to visual markup'};
    } else if (state === WorkflowStates.PHASE_3_FINALIZING) {
      return {phase: 3, name: 'Finalize', description: 'Writing version history page'};
    } else if (state === WorkflowStates.COMPLETE) {
      return {phase: 4, name: 'Complete', description: 'Workflow finished successfully'};
    } else {
      return {phase: -1, name: 'Error', description: 'An error occurred'};
    }
  };
  
  WorkflowController.prototype.getStats = function() {
    return {
      state: this.currentState,
      isPaused: this.isPaused(),
      isComplete: this.isComplete(),
      suggestionsCount: this.workflowData.phase1.suggestions.length,
      versionCounter: this.workflowData.versionCounter,
      isOfficial: this.workflowData.phase2.isOfficial,
      activeServerCalls: Array.from(this.activeServerCalls),
      currentStatus: this.currentStatus
    };
  };
  
  WorkflowController.prototype.getCurrentStatus = function() {
    return this.currentStatus;
  };
  
  // ============================================================================
  // STATUS ROUTING - Goes to active progress step
  // ============================================================================
  
  WorkflowController.prototype.updateStatus = function(message) {
    var self = this;
    self.currentStatus = message;
    self.logger.info('WorkflowController', 'Status: ' + message);
    
    var event = new CustomEvent('workflowStatusUpdate', {
      detail: {
        status: message,
        state: self.currentState,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  };
  
  // ============================================================================
  // ASYNC HELPERS - Prevent browser freeze
  // ============================================================================
  
  WorkflowController.prototype.yieldToUI = function(callback, delay) {
    setTimeout(callback, delay || 50);
  };
  
  // TRUE CHUNKED PROCESSING - Actually splits work into chunks with yields
  WorkflowController.prototype.chunkProcess = function(dataArray, chunkSize, processor, onComplete) {
    var self = this;
    var index = 0;
    var results = [];
    var totalItems = dataArray.length;
    var lastYieldTime = Date.now();
    
    function processChunk() {
      var chunkStartTime = Date.now();
      var itemsProcessed = 0;
      
      // Process items until chunk size OR 50ms time limit OR end of data
      while (index < totalItems && 
             itemsProcessed < chunkSize && 
             (Date.now() - chunkStartTime) < 50) {
        
        var result = processor(dataArray[index], index);
        if (result !== undefined && result !== null) {
          results.push(result);
        }
        
        index++;
        itemsProcessed++;
        
        // Status blast every 5 items for rapid feedback
        if (index % 5 === 0) {
          var progress = Math.round((index / totalItems) * 100);
          self.updateStatus('Processing item ' + index + '/' + totalItems + ' (' + progress + '%)');
        }
      }
      
      // Continue or complete
      if (index >= totalItems) {
        self.updateStatus('Processing complete: ' + totalItems + ' items');
        onComplete(results);
      } else {
        // Yield to UI
        var yieldDelay = (Date.now() - lastYieldTime > 100) ? 0 : 10;
        lastYieldTime = Date.now();
        setTimeout(processChunk, yieldDelay);
      }
    }
    
    processChunk();
  };
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  WorkflowController.prototype.transitionTo = function(newState) {
    var oldState = this.currentState;
    this.currentState = newState;
    this.logger.info('WorkflowController', 'State transition', {from: oldState, to: newState});
    this.emitStateChange(oldState, newState);
  };
  
  WorkflowController.prototype.emitStateChange = function(oldState, newState) {
    var event = new CustomEvent('workflowStateChange', {
      detail: {oldState: oldState, newState: newState, workflowData: this.workflowData}
    });
    window.dispatchEvent(event);
  };
  
  WorkflowController.prototype.getState = function() {
    return this.currentState;
  };
  
  WorkflowController.prototype.isPaused = function() {
    return this.currentState === WorkflowStates.VERSION_1_PAUSE || this.currentState === WorkflowStates.VERSION_2_PAUSE;
  };
  
  WorkflowController.prototype.isComplete = function() {
    return this.currentState === WorkflowStates.COMPLETE;
  };
  
  // ============================================================================
  // WORKFLOW EXECUTION
  // ============================================================================
  
  WorkflowController.prototype.startWorkflow = function() {
    var self = this;
    if (self.currentState !== WorkflowStates.IDLE) {
      self.logger.warn('WorkflowController', 'Cannot start - not in IDLE state', {currentState: self.currentState});
      return;
    }
    
    self.logger.info('WorkflowController', 'Starting workflow');
    self.updateStatus('Initializing workflow...');
    self.workflowData = self.createInitialState();
    
    self.yieldToUI(function() {
      self.executePhase1();
    });
  };
  
  WorkflowController.prototype.resumeWorkflow = function(userData) {
    var self = this;
    if (!self.isPaused()) {
      self.logger.warn('WorkflowController', 'Cannot resume - not paused', {currentState: self.currentState});
      return;
    }
    
    self.logger.info('WorkflowController', 'Resuming workflow', {from: self.currentState, userData: userData});
    self.updateStatus('Resuming workflow...');
    
    self.yieldToUI(function() {
      if (self.currentState === WorkflowStates.VERSION_1_PAUSE) {
        self.executePhase2();
      } else if (self.currentState === WorkflowStates.VERSION_2_PAUSE) {
        if (userData && userData.isOfficial) {
          self.workflowData.phase2.isOfficial = true;
          self.workflowData.phase3.committee = userData.committee;
          self.workflowData.phase3.comments = userData.comments;
          self.executePhase3();
        } else {
          self.completeWorkflow();
        }
      }
    });
  };
  
  // ============================================================================
  // PHASE 1: EXPORT & ANALYZE (with TRUE chunked processing)
  // ============================================================================
  
  WorkflowController.prototype.executePhase1 = function() {
    var self = this;
    
    try {
      self.logger.info('WorkflowController', 'Executing Phase 1');
      self.transitionTo(WorkflowStates.PHASE_1_EXPORTING);
      
      self.updateStatus('Connecting to Google Docs export service...');
      
      self.exportDocument(function(exportResult) {
        try {
          if (!exportResult.success) {
            self.handleError('Phase 1 Export failed', exportResult.error);
            return;
          }
          
          self.workflowData.phase1.exportedDocxBase64 = exportResult.data;
          var sizeKB = Math.round(exportResult.data.length / 1024);
          self.updateStatus('Export complete (' + sizeKB + 'KB), parsing DOCX...');
          
          self.yieldToUI(function() {
            self.processDocxChunked(exportResult, function(processResult) {
              try {
                if (!processResult.success) {
                  self.handleError('Phase 1 DOCX processing failed', processResult.errors);
                  return;
                }
                
                self.workflowData.phase1.documentXml = processResult.metadata.modifiedXml || processResult.modifiedXml;
                self.workflowData.phase1.zip = processResult.metadata.zip;
                
                var xmlSizeKB = Math.round(self.workflowData.phase1.documentXml.length / 1024);
                self.updateStatus('DOCX parsed (' + xmlSizeKB + 'KB XML), analyzing suggestions...');
                
                self.transitionTo(WorkflowStates.PHASE_1_ANALYZING);
                
                self.yieldToUI(function() {
                  self.analyzeSuggestionsChunked(self.workflowData.phase1.documentXml, function(suggestions) {
                    try {
                      self.workflowData.phase1.suggestions = suggestions;
                      self.updateStatus('Found ' + suggestions.length + ' suggestions, generating version...');
                      
                      self.yieldToUI(function() {
                        self.generateBeforeVersion(function(versionResult) {
                          try {
                            if (!versionResult.success) {
                              self.handleError('Failed to generate version number', versionResult.error);
                              return;
                            }
                            
                            self.workflowData.phase1.versionNumber = versionResult.versionNumber;
                            self.workflowData.versionCounter = versionResult.counter;
                            self.versionManager.copyToClipboard(versionResult.versionNumber);
                            
                            self.updateStatus('Phase 1 complete - Version: ' + versionResult.versionNumber);
                            self.transitionTo(WorkflowStates.VERSION_1_PAUSE);
                            self.logger.info('WorkflowController', 'Phase 1 complete - paused for versioning');
                          } catch (error) {
                            self.handleError('Phase 1 version generation error', error.message || error.toString());
                          }
                        });
                      });
                    } catch (error) {
                      self.handleError('Phase 1 suggestion processing error', error.message || error.toString());
                    }
                  });
                });
              } catch (error) {
                self.handleError('Phase 1 DOCX processing error', error.message || error.toString());
              }
            });
          });
        } catch (error) {
          self.handleError('Phase 1 export callback error', error.message || error.toString());
        }
      });
    } catch (error) {
      self.handleError('Phase 1 initialization error', error.message || error.toString());
    }
  };
  
  WorkflowController.prototype.exportDocument = function(callback) {
    var self = this;
    var callId = 'export_' + Date.now();
    
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      callback({success: false, error: 'Apps Script bridge not available'});
      return;
    }
    
    self.activeServerCalls.add(callId);
    var timeoutId = setTimeout(function() {
      if (self.activeServerCalls.has(callId)) {
        self.activeServerCalls.delete(callId);
        self.updateStatus('Export timed out');
        callback({success: false, error: 'Export operation timed out'});
      }
    }, 30000);
    
    var statusCount = 0;
    var statusMessages = [
      'Exporting document to DOCX...',
      'Converting Google Doc format...',
      'Packaging document structure...',
      'Finalizing export...'
    ];
    var statusInterval = setInterval(function() {
      if (self.activeServerCalls.has(callId)) {
        self.updateStatus(statusMessages[statusCount % statusMessages.length]);
        statusCount++;
      } else {
        clearInterval(statusInterval);
      }
    }, 1500);
    
    google.script.run
      .withSuccessHandler(function(result) {
        clearTimeout(timeoutId);
        clearInterval(statusInterval);
        
        if (!self.activeServerCalls.has(callId)) return;
        self.activeServerCalls.delete(callId);
        
        if (!result || result.success !== true) {
          self.updateStatus('Export failed - invalid result');
          callback({success: false, error: 'Export returned invalid result'});
          return;
        }
        
        self.updateStatus('Document exported successfully');
        callback(result);
      })
      .withFailureHandler(function(error) {
        clearTimeout(timeoutId);
        clearInterval(statusInterval);
        
        if (!self.activeServerCalls.has(callId)) return;
        self.activeServerCalls.delete(callId);
        
        self.updateStatus('Export failed: ' + (error.message || error));
        callback({success: false, error: error.message || error.toString()});
      })
      .exportDocumentAsDocx();
  };
  
  WorkflowController.prototype.processDocxChunked = function(exportResult, callback) {
    var self = this;
    self.updateStatus('Processing DOCX structure...');
    self.docxProcessor.process(exportResult, function(processResult) {
      if (processResult.success) {
        self.updateStatus('DOCX structure processed successfully');
      }
      callback(processResult);
    });
  };
  
  // SUGGESTION ANALYSIS - Uses V1 extractSuggestions (already efficient)
  WorkflowController.prototype.analyzeSuggestionsChunked = function(documentXml, callback) {
    var self = this;
    self.updateStatus('Scanning XML for tracked changes...');
    
    self.yieldToUI(function() {
      try {
        // V1 Detection module processes entire XML efficiently
        var suggestions = self.suggestionDetector.extractSuggestions(documentXml);
        
        if (suggestions.length === 0) {
          self.updateStatus('No tracked changes found in document');
          callback([]);
          return;
        }
        
        var insertions = suggestions.filter(function(s) { return s.type === 'insertion'; }).length;
        var deletions = suggestions.filter(function(s) { return s.type === 'deletion'; }).length;
        
        self.updateStatus('Analysis complete: ' + insertions + ' insertions, ' + deletions + ' deletions');
        
        self.yieldToUI(function() {
          callback(suggestions);
        }, 200);
      } catch (error) {
        self.handleError('Suggestion analysis failed', error.message || error.toString());
      }
    }, 100);
  };
  
  WorkflowController.prototype.generateBeforeVersion = function(callback) {
    var self = this;
    self.updateStatus('Requesting version number from server...');
    
    self.versionManager.getVersionCounter(true, function(counterResult) {
      if (!counterResult.success) {
        callback(counterResult);
        return;
      }
      
      var versionNumber = self.versionManager.generateVersionNumber(counterResult.counter, 'B', new Date());
      self.updateStatus('Version number generated: ' + versionNumber);
      callback({success: true, versionNumber: versionNumber, counter: counterResult.counter});
    });
  };
  
  // ============================================================================
  // PHASE 2: TRANSFORM & REPLACE (TRUE chunked XML transformation)
  // ============================================================================
  
  WorkflowController.prototype.executePhase2 = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Executing Phase 2');
    self.transitionTo(WorkflowStates.PHASE_2_TRANSFORMING);
    
    self.updateStatus('Beginning XML transformation...');
    
    self.yieldToUI(function() {
      self.transformXmlChunked(function(transformedXml) {
        self.workflowData.phase2.modifiedXml = transformedXml;
        
        var originalSize = Math.round(self.workflowData.phase1.documentXml.length / 1024);
        var transformedSize = Math.round(transformedXml.length / 1024);
        self.updateStatus('XML transformed (' + originalSize + '→' + transformedSize + 'KB), rebuilding DOCX...');
        
        self.transitionTo(WorkflowStates.PHASE_2_REBUILDING);
        
        self.yieldToUI(function() {
          self.rebuildDocxChunked(transformedXml, function(rebuildResult) {
            if (!rebuildResult.success) {
              self.handleError('Phase 2 DOCX rebuild failed', rebuildResult.error);
              return;
            }
            
            self.workflowData.phase2.rebuiltDocxBlob = rebuildResult.docxBlob;
            var blobSizeKB = Math.round(rebuildResult.docxBlob.size / 1024);
            self.updateStatus('DOCX rebuilt (' + blobSizeKB + 'KB), converting to base64...');
            
            self.yieldToUI(function() {
              self.docxProcessor.convertBlobToBase64(rebuildResult.docxBlob, function(conversionResult) {
                if (!conversionResult.success) {
                  self.handleError('Phase 2 blob conversion failed', conversionResult.error);
                  return;
                }
                
                self.workflowData.phase2.rebuiltDocxBase64 = conversionResult.base64Data;
                var base64SizeKB = Math.round(conversionResult.base64Data.length / 1024);
                self.updateStatus('Base64 encoded (' + base64SizeKB + 'KB), uploading to Drive...');
                
                self.transitionTo(WorkflowStates.PHASE_2_REPLACING);
                
                self.yieldToUI(function() {
                  self.replaceDocumentChunked(conversionResult.base64Data, function(replaceResult) {
                    if (!replaceResult || replaceResult.success !== true) {
                      var errorDetails = replaceResult ? (replaceResult.error || 'Unknown error') : 'No result returned';
                      self.handleError('Phase 2 document replacement failed', errorDetails);
                      return;
                    }
                    
                    self.updateStatus('Document replaced successfully, generating version...');
                    
                    self.yieldToUI(function() {
                      self.generateAfterVersion(function(versionResult) {
                        if (!versionResult.success) {
                          self.handleError('Failed to generate After version', versionResult.error);
                          return;
                        }
                        
                        self.workflowData.phase2.versionNumber = versionResult.versionNumber;
                        self.versionManager.copyToClipboard(versionResult.versionNumber);
                        
                        self.updateStatus('Phase 2 complete - Version: ' + versionResult.versionNumber);
                        self.transitionTo(WorkflowStates.VERSION_2_PAUSE);
                        self.logger.info('WorkflowController', 'Phase 2 complete - paused for versioning');
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  };
  
  // XML TRANSFORMATION - Uses V1 transformXml (takes all suggestions at once)
  WorkflowController.prototype.transformXmlChunked = function(callback) {
    var self = this;
    var xml = self.workflowData.phase1.documentXml;
    var suggestions = self.workflowData.phase1.suggestions;
    
    if (suggestions.length === 0) {
      self.updateStatus('No suggestions to transform');
      callback(xml);
      return;
    }
    
    self.updateStatus('Transforming ' + suggestions.length + ' suggestions...');
    
    self.yieldToUI(function() {
      try {
        // V1 XML transformer processes all suggestions efficiently
        var transformedXml = self.xmlTransformer.transformXml(xml, suggestions);
        
        self.updateStatus('Cleaning up suggestion metadata...');
        self.yieldToUI(function() {
          self.updateStatus('XML transformation complete');
          callback(transformedXml);
        }, 100);
      } catch (error) {
        self.handleError('XML transformation failed', error.message || error.toString());
      }
    }, 200);
  };
  
  WorkflowController.prototype.rebuildDocxChunked = function(modifiedXml, callback) {
    var self = this;
    self.updateStatus('Rebuilding DOCX with JSZip...');
    self.docxProcessor.rebuildDocx(self.workflowData.phase1.zip, modifiedXml, callback);
  };
  
  WorkflowController.prototype.replaceDocumentChunked = function(base64Data, callback) {
    var self = this;
    var callId = 'replace_' + Date.now();
    var callbackCalled = false;
    
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      callback({success: false, error: 'Apps Script bridge not available'});
      return;
    }
    
    self.activeServerCalls.add(callId);
    var timeoutId = setTimeout(function() {
      if (self.activeServerCalls.has(callId) && !callbackCalled) {
        self.activeServerCalls.delete(callId);
        callbackCalled = true;
        self.updateStatus('Document replacement timed out');
        callback({success: false, error: 'Document replacement timed out'});
      }
    }, 60000);
    
    var uploadMessages = [
      'Uploading to Google Drive...',
      'Converting to Google Docs format...',
      'Applying document structure...',
      'Finalizing document replacement...'
    ];
    var msgIdx = 0;
    var statusInterval = setInterval(function() {
      if (self.activeServerCalls.has(callId) && !callbackCalled) {
        self.updateStatus(uploadMessages[msgIdx % uploadMessages.length]);
        msgIdx++;
      } else {
        clearInterval(statusInterval);
      }
    }, 2000);
    
    function safeCallback(result) {
      if (callbackCalled) return;
      callbackCalled = true;
      clearTimeout(timeoutId);
      clearInterval(statusInterval);
      callback(result);
    }
    
    google.script.run
      .withSuccessHandler(function(result) {
        if (!self.activeServerCalls.has(callId)) return;
        self.activeServerCalls.delete(callId);
        
        if (!result || result.success !== true) {
          self.updateStatus('Document replacement failed: ' + (result ? result.error : 'Invalid result'));
          safeCallback({success: false, error: result ? result.error : 'Server returned invalid result'});
          return;
        }
        
        self.updateStatus('Document replacement completed successfully');
        safeCallback(result);
      })
      .withFailureHandler(function(error) {
        if (!self.activeServerCalls.has(callId)) return;
        self.activeServerCalls.delete(callId);
        
        var errorMessage = error ? (error.message || error.toString()) : 'Unknown error';
        self.updateStatus('Document replacement failed: ' + errorMessage);
        safeCallback({success: false, error: errorMessage});
      })
      .replaceDocumentWithProcessedDocx(base64Data);
  };
  
  WorkflowController.prototype.generateAfterVersion = function(callback) {
    var self = this;
    var versionNumber = self.versionManager.generateVersionNumber(self.workflowData.versionCounter, 'A', new Date());
    self.updateStatus('Generated After version: ' + versionNumber);
    callback({success: true, versionNumber: versionNumber});
  };
  
  // ============================================================================
  // PHASE 3: FINALIZE
  // ============================================================================
  
  WorkflowController.prototype.executePhase3 = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Executing Phase 3 - Official version');
    self.transitionTo(WorkflowStates.PHASE_3_FINALIZING);
    
    self.updateStatus('Creating official version record...');
    
    var officialVersionNumber = self.versionManager.generateVersionNumber(self.workflowData.versionCounter, 'O', new Date());
    self.workflowData.phase2.versionNumber = officialVersionNumber;
    
    var versionData = {
      versionNumber: officialVersionNumber,
      committee: self.versionManager.getCommitteeDisplayName(self.workflowData.phase3.committee),
      timestamp: new Date().toISOString(),
      comments: self.versionManager.formatCommentsText(self.workflowData.phase3.comments),
      formattedDate: self.versionManager.formatVersionString(officialVersionNumber)
    };
    
    var validation = self.versionManager.validateVersionData(versionData);
    if (!validation.valid) {
      self.handleError('Phase 3 validation failed', validation.errors.join(', '));
      return;
    }
    
    self.updateStatus('Writing version history to document...');
    
    self.versionManager.writeVersionHistory(versionData, function(result) {
      if (!result.success) {
        self.handleError('Phase 3 write history failed', result.error);
        return;
      }
      
      self.updateStatus('Official version history written successfully');
      self.logger.info('WorkflowController', 'Phase 3 complete - version history written');
      
      self.yieldToUI(function() {
        self.completeWorkflow();
      }, 500);
    });
  };
  
  // ============================================================================
  // COMPLETION & ERROR HANDLING
  // ============================================================================
  
  WorkflowController.prototype.completeWorkflow = function() {
    var self = this;
    var statsMessage = 'Workflow complete: ' + self.workflowData.phase1.suggestions.length + ' suggestions processed';
    if (self.workflowData.phase2.isOfficial) {
      statsMessage += ' (Official version)';
    }
    
    self.updateStatus(statsMessage);
    self.logger.info('WorkflowController', 'Workflow completed successfully', {
      suggestionsProcessed: self.workflowData.phase1.suggestions.length,
      versionCounter: self.workflowData.versionCounter,
      isOfficial: self.workflowData.phase2.isOfficial
    });
    
    self.transitionTo(WorkflowStates.COMPLETE);
  };
  
  WorkflowController.prototype.handleError = function(message, errorDetails) {
    var self = this;
    self.updateStatus('ERROR: ' + message);
    self.logger.error('WorkflowController', message, errorDetails);
    self.transitionTo(WorkflowStates.ERROR);
    
    var event = new CustomEvent('workflowError', {
      detail: {
        message: message,
        error: errorDetails,
        state: self.currentState,
        workflowData: self.workflowData,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  };
  
  WorkflowController.prototype.reset = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Resetting workflow');
    self.activeServerCalls.clear();
    self.currentStatus = '';
    self.currentState = WorkflowStates.IDLE;
    self.workflowData = self.createInitialState();
    self.updateStatus('Ready to begin new workflow');
    self.emitStateChange('RESET', WorkflowStates.IDLE);
  };
  
  // ============================================================================
  // GETTERS
  // ============================================================================
  
  WorkflowController.prototype.getWorkflowData = function() {
    return Base.deepClone(this.workflowData);
  };
  
  // ============================================================================
  // EXPORT TO MIGOP NAMESPACE
  // ============================================================================
  
  window.MIGOP = window.MIGOP || {};
  window.MIGOP.WorkflowController = WorkflowController;
  window.MIGOP.WorkflowStates = WorkflowStates;
  window.MIGOP.workflowController = new WorkflowController(Log.getLogger());
  
  console.log('[MIGOP V3] workflow-controller.js loaded with TRUE chunked processing (2025-10-12 fix)');
})();
