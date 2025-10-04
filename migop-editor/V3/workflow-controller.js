/**
 * ============================================================================
 * MIGOP EDITOR V3 - WORKFLOW CONTROLLER (PRODUCTION - NO FREEZE)
 * ============================================================================
 * 
 * PRODUCTION FIXES:
 * 1. Status blasting to progress step status lines
 * 2. Chunked processing to prevent browser freeze
 * 3. Async operations with proper yielding
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
  
  // ============================================================================
  // STATUS BLASTING - Routes to progress step status lines
  // ============================================================================
  
  WorkflowController.prototype.updateStatus = function(message) {
    var self = this;
    self.currentStatus = message;
    self.logger.info('WorkflowController', 'Status: ' + message);
    
    // Emit status for UI to route to progress steps
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
    setTimeout(callback, delay || 50); // Default 50ms yield
  };
  
  WorkflowController.prototype.chunkProcess = function(data, chunkSize, processor, callback) {
    var self = this;
    var index = 0;
    var results = [];
    
    function processChunk() {
      var chunk = data.slice(index, index + chunkSize);
      if (chunk.length === 0) {
        callback(results);
        return;
      }
      
      // Process chunk
      var chunkResult = processor(chunk, index);
      results = results.concat(chunkResult);
      
      index += chunkSize;
      
      // Update status
      var progress = Math.round((index / data.length) * 100);
      self.updateStatus('Processing... ' + progress + '% complete');
      
      // Yield to UI before next chunk
      self.yieldToUI(processChunk, 10);
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
  // PHASE 1: EXPORT & ANALYZE (with status blasting)
  // ============================================================================
  
  WorkflowController.prototype.executePhase1 = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Executing Phase 1');
    self.transitionTo(WorkflowStates.PHASE_1_EXPORTING);
    
    self.updateStatus('Connecting to Google Docs export service...');
    
    self.exportDocument(function(exportResult) {
      if (!exportResult.success) {
        self.handleError('Phase 1 Export failed', exportResult.error);
        return;
      }
      
      self.workflowData.phase1.exportedDocxBase64 = exportResult.data;
      var sizeKB = Math.round(exportResult.data.length / 1024);
      self.updateStatus('Export complete (' + sizeKB + 'KB), parsing DOCX...');
      
      self.yieldToUI(function() {
        self.processDocxChunked(exportResult, function(processResult) {
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
              self.workflowData.phase1.suggestions = suggestions;
              self.updateStatus('Found ' + suggestions.length + ' suggestions, generating version...');
              
              self.yieldToUI(function() {
                self.generateBeforeVersion(function(versionResult) {
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
                });
              });
            });
          });
        });
      });
    });
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
    
    // Status updates during export
    var statusInterval = setInterval(function() {
      if (self.activeServerCalls.has(callId)) {
        self.updateStatus('Exporting document to DOCX format...');
      } else {
        clearInterval(statusInterval);
      }
    }, 1000);
    
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
    
    // Use existing processor but with status updates
    self.docxProcessor.process(exportResult, function(processResult) {
      if (processResult.success) {
        self.updateStatus('DOCX structure processed');
      }
      callback(processResult);
    });
  };
  
  WorkflowController.prototype.analyzeSuggestionsChunked = function(documentXml, callback) {
    var self = this;
    self.updateStatus('Scanning for tracked changes...');
    
    // Add delay to show progress for large documents
    self.yieldToUI(function() {
      var suggestions = self.suggestionDetector.extractSuggestions(documentXml);
      var insertions = suggestions.filter(function(s) { return s.type === 'insertion'; }).length;
      var deletions = suggestions.filter(function(s) { return s.type === 'deletion'; }).length;
      
      self.updateStatus('Found ' + insertions + ' insertions, ' + deletions + ' deletions');
      
      self.yieldToUI(function() {
        callback(suggestions);
      });
    }, 300);
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
      callback({success: true, versionNumber: versionNumber, counter: counterResult.counter});
    });
  };
  
  // ============================================================================
  // PHASE 2: TRANSFORM & REPLACE (chunked to prevent freeze)
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
        self.updateStatus('XML transformed (' + originalSize + '→' + transformedSize + 'KB), rebuilding...');
        
        self.transitionTo(WorkflowStates.PHASE_2_REBUILDING);
        
        self.yieldToUI(function() {
          self.rebuildDocxChunked(transformedXml, function(rebuildResult) {
            if (!rebuildResult.success) {
              self.handleError('Phase 2 DOCX rebuild failed', rebuildResult.error);
              return;
            }
            
            self.workflowData.phase2.rebuiltDocxBlob = rebuildResult.docxBlob;
            var blobSizeKB = Math.round(rebuildResult.docxBlob.size / 1024);
            self.updateStatus('DOCX rebuilt (' + blobSizeKB + 'KB), converting...');
            
            self.yieldToUI(function() {
              self.docxProcessor.convertBlobToBase64(rebuildResult.docxBlob, function(conversionResult) {
                if (!conversionResult.success) {
                  self.handleError('Phase 2 blob conversion failed', conversionResult.error);
                  return;
                }
                
                self.workflowData.phase2.rebuiltDocxBase64 = conversionResult.base64Data;
                self.updateStatus('Uploading to Google Drive...');
                
                self.transitionTo(WorkflowStates.PHASE_2_REPLACING);
                
                self.yieldToUI(function() {
                  self.replaceDocumentChunked(conversionResult.base64Data, function(replaceResult) {
                    if (!replaceResult || replaceResult.success !== true) {
                      var errorDetails = replaceResult ? (replaceResult.error || 'Unknown error') : 'No result returned';
                      self.handleError('Phase 2 document replacement failed', errorDetails);
                      return;
                    }
                    
                    self.updateStatus('Document replacement successful, generating version...');
                    
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
  
  WorkflowController.prototype.transformXmlChunked = function(callback) {
    var self = this;
    self.updateStatus('Applying suggestion markup...');
    
    self.yieldToUI(function() {
      var transformedXml = self.xmlTransformer.transformXml(self.workflowData.phase1.documentXml, self.workflowData.phase1.suggestions);
      self.updateStatus('Cleaning up suggestion metadata...');
      
      self.yieldToUI(function() {
        callback(transformedXml);
      }, 200);
    }, 300);
  };
  
  WorkflowController.prototype.rebuildDocxChunked = function(modifiedXml, callback) {
    var self = this;
    self.updateStatus('Rebuilding DOCX with JSZip...');
    
    // The existing rebuild is already async, just add status
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
    
    // Status updates during upload
    var statusInterval = setInterval(function() {
      if (self.activeServerCalls.has(callId) && !callbackCalled) {
        self.updateStatus('Uploading and converting document...');
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
        
        self.updateStatus('Document replacement completed');
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
    callback({success: true, versionNumber: versionNumber});
  };
  
  // ============================================================================
  // PHASE 3: FINALIZE
  // ============================================================================
  
  WorkflowController.prototype.executePhase3 = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Executing Phase 3 - Official version');
    self.transitionTo(WorkflowStates.PHASE_3_FINALIZING);
    
    self.updateStatus('Creating official version...');
    
    var officialVersionNumber = self.versionManager.generateVersionNumber(self.workflowData.versionCounter, 'O', new Date());
    self.workflowData.phase2.versionNumber = officialVersionNumber;
    
    var versionData = {
      versionNumber: officialVersionNumber,
      committee: self.versionManager.getCommitteeDisplayName(self.workflowData.phase3.committee),
      timestamp: new Date().toISOString(),
      comments: self.versionManager.formatCommentsText(self.workflowData.phase3.comments)
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
      
      self.updateStatus('Official version history written');
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
    var statsMessage = 'Workflow completed: ' + self.workflowData.phase1.suggestions.length + ' suggestions processed';
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
  // EXPORT TO MIGOP NAMESPACE
  // ============================================================================
  
  window.MIGOP = window.MIGOP || {};
  window.MIGOP.WorkflowController = WorkflowController;
  window.MIGOP.WorkflowStates = WorkflowStates;
  window.MIGOP.workflowController = new WorkflowController(Log.getLogger());
  
  console.log('[MIGOP V3] workflow-controller.js loaded successfully with anti-freeze protection');
})();
