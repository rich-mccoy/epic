/**
 * ============================================================================
 * MIGOP EDITOR V3 - WORKFLOW CONTROLLER MODULE (FIXED - Document Replacement)
 * ============================================================================
 * 
 * FIX: Added robust error handling and logging for document replacement to
 * prevent the race condition that was causing "success" followed by "failure".
 * 
 * Changes:
 * 1. Added detailed result structure logging in replaceDocument()
 * 2. Added timeout protection for Apps Script calls
 * 3. Added defensive success/failure checking
 * 4. Improved error messages with more context
 * ============================================================================
 */

(function() {
  'use strict';
  
  // Dependency check
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
  
  // ============================================================================
  // WORKFLOW STATES
  // ============================================================================
  
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
  
  // ============================================================================
  // WORKFLOW CONTROLLER CLASS
  // ============================================================================
  
  function WorkflowController(logger) {
    this.logger = logger || Log.getLogger();
    this.versionManager = new VersionManager(this.logger);
    
    // State
    this.currentState = WorkflowStates.IDLE;
    this.workflowData = this.createInitialState();
    
    // Processors
    this.docxProcessor = Docx.createProcessor(this.logger);
    this.suggestionDetector = Detection.createDetector('standard', this.logger);
    this.xmlTransformer = Xml.createTransformer('standard', this.logger);
    
    // FIX: Add call tracking to prevent race conditions
    this.activeServerCalls = new Set();
    
    this.logger.info('WorkflowController', 'Controller initialized');
  }
  
  /**
   * Create initial workflow state
   */
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
    self.workflowData = self.createInitialState();
    self.executePhase1();
  };
  
  WorkflowController.prototype.resumeWorkflow = function(userData) {
    var self = this;
    if (!self.isPaused()) {
      self.logger.warn('WorkflowController', 'Cannot resume - not paused', {currentState: self.currentState});
      return;
    }
    self.logger.info('WorkflowController', 'Resuming workflow', {from: self.currentState, userData: userData});
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
  };
  
  // ============================================================================
  // PHASE 1: EXPORT & ANALYZE
  // ============================================================================
  
  WorkflowController.prototype.executePhase1 = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Executing Phase 1');
    self.transitionTo(WorkflowStates.PHASE_1_EXPORTING);
    
    self.exportDocument(function(exportResult) {
      if (!exportResult.success) {
        self.handleError('Phase 1 Export failed', exportResult.error);
        return;
      }
      self.workflowData.phase1.exportedDocxBase64 = exportResult.data;
      
      self.processDocx(exportResult, function(processResult) {
        if (!processResult.success) {
          self.handleError('Phase 1 DOCX processing failed', processResult.errors);
          return;
        }
        self.workflowData.phase1.documentXml = processResult.metadata.modifiedXml || processResult.modifiedXml;
        self.workflowData.phase1.zip = processResult.metadata.zip;
        
        self.transitionTo(WorkflowStates.PHASE_1_ANALYZING);
        self.analyzeSuggestions(processResult.metadata.modifiedXml || processResult.modifiedXml, function(suggestions) {
          self.workflowData.phase1.suggestions = suggestions;
          
          self.generateBeforeVersion(function(versionResult) {
            if (!versionResult.success) {
              self.handleError('Failed to generate version number', versionResult.error);
              return;
            }
            self.workflowData.phase1.versionNumber = versionResult.versionNumber;
            self.workflowData.versionCounter = versionResult.counter;
            self.versionManager.copyToClipboard(versionResult.versionNumber);
            self.transitionTo(WorkflowStates.VERSION_1_PAUSE);
            self.logger.info('WorkflowController', 'Phase 1 complete - paused for versioning');
          });
        });
      });
    });
  };
  
  WorkflowController.prototype.exportDocument = function(callback) {
    var self = this;
    var callId = 'export_' + Date.now();
    
    self.logger.info('WorkflowController', 'Exporting document as DOCX');
    
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      callback({success: false, error: 'Apps Script bridge not available'});
      return;
    }
    
    // FIX: Add call tracking and timeout
    self.activeServerCalls.add(callId);
    var timeoutId = setTimeout(function() {
      if (self.activeServerCalls.has(callId)) {
        self.activeServerCalls.delete(callId);
        self.logger.error('WorkflowController', 'Document export timed out after 30 seconds');
        callback({success: false, error: 'Export operation timed out'});
      }
    }, 30000);
    
    google.script.run
      .withSuccessHandler(function(result) {
        clearTimeout(timeoutId);
        if (!self.activeServerCalls.has(callId)) {
          self.logger.warn('WorkflowController', 'Export success handler called after timeout/cleanup');
          return;
        }
        self.activeServerCalls.delete(callId);
        
        // FIX: Add result validation
        self.logger.info('WorkflowController', 'Document export result received', {
          hasResult: !!result,
          resultType: typeof result,
          success: result ? result.success : 'undefined',
          hasData: result ? !!result.data : false,
          dataLength: result && result.data ? result.data.length : 0
        });
        
        if (!result || result.success !== true) {
          self.logger.error('WorkflowController', 'Export returned invalid result', result);
          callback({success: false, error: 'Export returned invalid result: ' + JSON.stringify(result)});
          return;
        }
        
        self.logger.info('WorkflowController', 'Document exported successfully');
        callback(result);
      })
      .withFailureHandler(function(error) {
        clearTimeout(timeoutId);
        if (!self.activeServerCalls.has(callId)) {
          self.logger.warn('WorkflowController', 'Export failure handler called after timeout/cleanup');
          return;
        }
        self.activeServerCalls.delete(callId);
        
        self.logger.error('WorkflowController', 'Document export failed', error);
        callback({success: false, error: error.message || error.toString()});
      })
      .exportDocumentAsDocx();
  };
  
  WorkflowController.prototype.processDocx = function(exportResult, callback) {
    var self = this;
    self.logger.info('WorkflowController', 'Processing DOCX');
    self.docxProcessor.process(exportResult, function(processResult) {
      callback(processResult);
    });
  };
  
  WorkflowController.prototype.analyzeSuggestions = function(documentXml, callback) {
    var self = this;
    self.logger.info('WorkflowController', 'Analyzing suggestions');
    var suggestions = self.suggestionDetector.extractSuggestions(documentXml);
    self.logger.info('WorkflowController', 'Suggestions analyzed', {totalSuggestions: suggestions.length});
    callback(suggestions);
  };
  
  WorkflowController.prototype.generateBeforeVersion = function(callback) {
    var self = this;
    self.logger.info('WorkflowController', 'Generating Before version number');
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
  // PHASE 2: TRANSFORM & REPLACE
  // ============================================================================
  
  WorkflowController.prototype.executePhase2 = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Executing Phase 2');
    self.transitionTo(WorkflowStates.PHASE_2_TRANSFORMING);
    
    self.transformXml(function(transformedXml) {
      self.workflowData.phase2.modifiedXml = transformedXml;
      self.transitionTo(WorkflowStates.PHASE_2_REBUILDING);
      self.rebuildDocx(transformedXml, function(rebuildResult) {
        if (!rebuildResult.success) {
          self.handleError('Phase 2 DOCX rebuild failed', rebuildResult.error);
          return;
        }
        self.workflowData.phase2.rebuiltDocxBlob = rebuildResult.docxBlob;
        self.docxProcessor.convertBlobToBase64(rebuildResult.docxBlob, function(conversionResult) {
          if (!conversionResult.success) {
            self.handleError('Phase 2 blob conversion failed', conversionResult.error);
            return;
          }
          self.workflowData.phase2.rebuiltDocxBase64 = conversionResult.base64Data;
          self.transitionTo(WorkflowStates.PHASE_2_REPLACING);
          self.replaceDocument(conversionResult.base64Data, function(replaceResult) {
            // FIX: Enhanced result validation and logging
            self.logger.info('WorkflowController', 'Document replacement callback received', {
              hasResult: !!replaceResult,
              resultType: typeof replaceResult,
              resultKeys: replaceResult ? Object.keys(replaceResult) : [],
              successValue: replaceResult ? replaceResult.success : 'undefined',
              errorValue: replaceResult ? replaceResult.error : 'undefined'
            });
            
            if (!replaceResult || replaceResult.success !== true) {
              var errorDetails = replaceResult ? 
                (replaceResult.error || 'Unknown error - invalid result structure') : 
                'No result returned from server';
              self.handleError('Phase 2 document replacement failed', errorDetails);
              return;
            }
            
            self.generateAfterVersion(function(versionResult) {
              if (!versionResult.success) {
                self.handleError('Failed to generate After version', versionResult.error);
                return;
              }
              self.workflowData.phase2.versionNumber = versionResult.versionNumber;
              self.versionManager.copyToClipboard(versionResult.versionNumber);
              self.transitionTo(WorkflowStates.VERSION_2_PAUSE);
              self.logger.info('WorkflowController', 'Phase 2 complete - paused for versioning');
            });
          });
        });
      });
    });
  };
  
  WorkflowController.prototype.transformXml = function(callback) {
    var self = this;
    self.logger.info('WorkflowController', 'Transforming XML');
    var transformedXml = self.xmlTransformer.transformXml(self.workflowData.phase1.documentXml, self.workflowData.phase1.suggestions);
    self.logger.info('WorkflowController', 'XML transformation complete');
    callback(transformedXml);
  };
  
  WorkflowController.prototype.rebuildDocx = function(modifiedXml, callback) {
    var self = this;
    self.logger.info('WorkflowController', 'Rebuilding DOCX');
    self.docxProcessor.rebuildDocx(self.workflowData.phase1.zip, modifiedXml, callback);
  };
  
  // FIX: Enhanced document replacement with better error handling
  WorkflowController.prototype.replaceDocument = function(base64Data, callback) {
    var self = this;
    var callId = 'replace_' + Date.now();
    var callbackCalled = false;
    
    self.logger.info('WorkflowController', 'Replacing document', {
      base64Length: base64Data.length,
      callId: callId
    });
    
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      callback({success: false, error: 'Apps Script bridge not available'});
      return;
    }
    
    // FIX: Add call tracking and timeout protection
    self.activeServerCalls.add(callId);
    var timeoutId = setTimeout(function() {
      if (self.activeServerCalls.has(callId) && !callbackCalled) {
        self.activeServerCalls.delete(callId);
        callbackCalled = true;
        self.logger.error('WorkflowController', 'Document replacement timed out after 60 seconds', {callId: callId});
        callback({success: false, error: 'Document replacement timed out after 60 seconds'});
      }
    }, 60000);
    
    // FIX: Wrapper to prevent multiple callback calls
    function safeCallback(result) {
      if (callbackCalled) {
        self.logger.warn('WorkflowController', 'Attempted duplicate callback call prevented', {callId: callId});
        return;
      }
      callbackCalled = true;
      clearTimeout(timeoutId);
      callback(result);
    }
    
    google.script.run
      .withSuccessHandler(function(result) {
        if (!self.activeServerCalls.has(callId)) {
          self.logger.warn('WorkflowController', 'Replace success handler called after cleanup', {callId: callId});
          return;
        }
        self.activeServerCalls.delete(callId);
        
        // FIX: Detailed result logging and validation
        self.logger.info('WorkflowController', 'Document replacement success handler called', {
          callId: callId,
          hasResult: !!result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          success: result ? result.success : 'undefined',
          hasReplacementDetails: result ? !!result.replacementDetails : false
        });
        
        // FIX: Validate result structure
        if (!result) {
          self.logger.error('WorkflowController', 'Server returned null result', {callId: callId});
          safeCallback({success: false, error: 'Server returned null result'});
          return;
        }
        
        if (typeof result !== 'object') {
          self.logger.error('WorkflowController', 'Server returned non-object result', {
            callId: callId,
            resultType: typeof result,
            result: result
          });
          safeCallback({success: false, error: 'Server returned invalid result type: ' + typeof result});
          return;
        }
        
        if (result.success !== true) {
          self.logger.error('WorkflowController', 'Server reported failure in success handler', {
            callId: callId,
            result: result
          });
          safeCallback({success: false, error: result.error || 'Server reported failure but provided no error message'});
          return;
        }
        
        self.logger.info('WorkflowController', 'Document replaced successfully', {
          callId: callId,
          replacementDetails: result.replacementDetails
        });
        safeCallback(result);
      })
      .withFailureHandler(function(error) {
        if (!self.activeServerCalls.has(callId)) {
          self.logger.warn('WorkflowController', 'Replace failure handler called after cleanup', {callId: callId});
          return;
        }
        self.activeServerCalls.delete(callId);
        
        self.logger.error('WorkflowController', 'Document replacement failed', {
          callId: callId,
          error: error,
          errorMessage: error ? error.message : 'undefined',
          errorType: typeof error
        });
        
        var errorMessage = 'Unknown error';
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.toString) {
            errorMessage = error.toString();
          }
        }
        
        safeCallback({success: false, error: errorMessage});
      })
      .replaceDocumentWithProcessedDocx(base64Data);
  };
  
  WorkflowController.prototype.generateAfterVersion = function(callback) {
    var self = this;
    self.logger.info('WorkflowController', 'Generating After version number');
    var versionNumber = self.versionManager.generateVersionNumber(self.workflowData.versionCounter, 'A', new Date());
    callback({success: true, versionNumber: versionNumber});
  };
  
  // ============================================================================
  // PHASE 3: FINALIZE (Official only)
  // ============================================================================
  
  WorkflowController.prototype.executePhase3 = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Executing Phase 3 - Official version');
    self.transitionTo(WorkflowStates.PHASE_3_FINALIZING);
    
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
    
    self.versionManager.writeVersionHistory(versionData, function(result) {
      if (!result.success) {
        self.handleError('Phase 3 write history failed', result.error);
        return;
      }
      self.logger.info('WorkflowController', 'Phase 3 complete - version history written');
      self.completeWorkflow();
    });
  };
  
  // ============================================================================
  // COMPLETION & ERROR HANDLING
  // ============================================================================
  
  WorkflowController.prototype.completeWorkflow = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Workflow completed successfully', {
      suggestionsProcessed: self.workflowData.phase1.suggestions.length,
      versionCounter: self.workflowData.versionCounter,
      isOfficial: self.workflowData.phase2.isOfficial
    });
    self.transitionTo(WorkflowStates.COMPLETE);
  };
  
  WorkflowController.prototype.handleError = function(message, errorDetails) {
    var self = this;
    
    // FIX: Enhanced error logging
    self.logger.error('WorkflowController', message, {
      errorDetails: errorDetails,
      errorType: typeof errorDetails,
      currentState: self.currentState,
      activeServerCalls: Array.from(self.activeServerCalls),
      workflowPhase: self.getCurrentPhaseInfo()
    });
    
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
    
    // FIX: Clear active server calls on reset
    self.activeServerCalls.clear();
    
    self.currentState = WorkflowStates.IDLE;
    self.workflowData = self.createInitialState();
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
      activeServerCalls: Array.from(this.activeServerCalls)
    };
  };
  
  // ============================================================================
  // EXPORT TO MIGOP NAMESPACE
  // ============================================================================
  
  window.MIGOP = window.MIGOP || {};
  window.MIGOP.WorkflowController = WorkflowController;
  window.MIGOP.WorkflowStates = WorkflowStates;
  window.MIGOP.workflowController = new WorkflowController(Log.getLogger());
  
  console.log('[MIGOP V3] workflow-controller.js loaded successfully');
})();
