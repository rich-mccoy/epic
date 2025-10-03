/**
 * ============================================================================
 * MIGOP EDITOR V3 - WORKFLOW CONTROLLER MODULE (FIXED)
 * ============================================================================
 * 
 * This module implements the three-phase workflow state machine with pause
 * points for manual versioning.
 * 
 * State Flow:
 * IDLE → PHASE_1 → VERSION_1_PAUSE → PHASE_2 → VERSION_2_PAUSE → [PHASE_3] → COMPLETE
 * 
 * Phase 1: Export & Analyze (generates B version, pauses)
 * Phase 2: Transform & Replace (generates A/O version, pauses)
 * Phase 3: Write Version History (only if Official, completes)
 * 
 * Depends on: All V1 modules + version-manager
 * 
 * FIX: Removed duplicate/corrupted code at end of file that caused syntax errors
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
    self.logger.info('WorkflowController', 'Exporting document as DOCX');
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      callback({success: false, error: 'Apps Script bridge not available'});
      return;
    }
    google.script.run
      .withSuccessHandler(function(result) {
        self.logger.info('WorkflowController', 'Document exported successfully');
        callback(result);
      })
      .withFailureHandler(function(error) {
        self.logger.error('WorkflowController', 'Document export failed', error);
        callback({success: false, error: error.message});
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
            if (!replaceResult.success) {
              self.handleError('Phase 2 document replacement failed', replaceResult.error);
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
  
  WorkflowController.prototype.replaceDocument = function(base64Data, callback) {
    var self = this;
    self.logger.info('WorkflowController', 'Replacing document');
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      callback({success: false, error: 'Apps Script bridge not available'});
      return;
    }
    google.script.run
      .withSuccessHandler(function(result) {
        self.logger.info('WorkflowController', 'Document replaced successfully');
        callback(result);
      })
      .withFailureHandler(function(error) {
        self.logger.error('WorkflowController', 'Document replacement failed', error);
        callback({success: false, error: error.message});
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
    self.logger.error('WorkflowController', message, errorDetails);
    self.transitionTo(WorkflowStates.ERROR);
    var event = new CustomEvent('workflowError', {
      detail: {message: message, error: errorDetails, state: self.currentState, workflowData: self.workflowData}
    });
    window.dispatchEvent(event);
  };
  
  WorkflowController.prototype.reset = function() {
    var self = this;
    self.logger.info('WorkflowController', 'Resetting workflow');
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
      isOfficial: this.workflowData.phase2.isOfficial
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
