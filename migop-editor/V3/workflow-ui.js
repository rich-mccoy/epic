/**
 * ============================================================================
 * MIGOP EDITOR V3 - WORKFLOW UI MODULE (FIXED - Event Data Issue)
 * ============================================================================
 * 
 * FIX: The UI was not showing the version section during pauses because
 * updateUI() was calling controller.getWorkflowData() which returns a fresh
 * clone, instead of using the workflowData from the state change event.
 * Changed to use event.detail.workflowData directly.
 * ============================================================================
 */

(function() {
  'use strict';
  
  if (!window.MIGOP || !window.MIGOP.WorkflowController || !window.MIGOP.workflowController) {
    throw new Error('workflow-ui.js requires workflow-controller');
  }
  
  var controller = window.MIGOP.workflowController;
  var WorkflowStates = window.MIGOP.WorkflowStates;
  var Log = window.MIGOP.Log;
  
  function WorkflowUI() {
    this.logger = Log.getLogger();
    this.logger.info('WorkflowUI', 'UI module initializing');
    
    this.elements = {};
    this.committeeOptions = [
      'PDBOR Subcommittee', 'Policy Committee',
      'District 1', 'District 2', 'District 3', 'District 4',
      'District 5', 'District 6', 'District 7', 'District 8',
      'District 9', 'District 10', 'District 11', 'District 12',
      'District 13', 'State Committee'
    ];
    
    // Store latest workflow data from events
    this.latestWorkflowData = null;
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.initialize.bind(this));
    } else {
      this.initialize();
    }
  }
  
  WorkflowUI.prototype.initialize = function() {
    var self = this;
    self.logger.info('WorkflowUI', 'Initializing UI');
    self.renderUI();
    self.cacheElements();
    self.setupEventListeners();
    self.updateUI();
    self.logger.info('WorkflowUI', 'UI initialized successfully');
  };
  
  WorkflowUI.prototype.renderUI = function() {
    var html = [];
    html.push('<div id="migop-container" style="font-family: \'Google Sans\', Roboto, Arial, sans-serif;">');
    html.push(this.renderBanner());
    html.push(this.renderSmartButton());
    html.push(this.renderVersionSection());
    html.push(this.renderProgressTracker());
    html.push(this.renderDebugLog());
    html.push('</div>');
    
    var appDiv = document.getElementById('app');
    if (appDiv) {
      appDiv.innerHTML = html.join('\n');
    }
  };
  
  WorkflowUI.prototype.renderBanner = function() {
    return [
      '<div style="background: linear-gradient(135deg, #C8102E 0%, #9A0826 100%); padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">',
      '  <h2 style="margin: 0; font-size: 24px; font-weight: 600;">MIGOP Editor</h2>',
      '  <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">Version 3.0 - Professional Workflow</div>',
      '</div>'
    ].join('\n');
  };
  
  WorkflowUI.prototype.renderSmartButton = function() {
    return [
      '<div style="padding: 20px; background: white;">',
      '  <button id="smart-button" style="width: 100%; padding: 15px; font-size: 16px; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; background: linear-gradient(135deg, #C8102E 0%, #9A0826 100%); color: white; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(200, 16, 46, 0.3);">Start Workflow</button>',
      '</div>'
    ].join('\n');
  };
  
  WorkflowUI.prototype.renderVersionSection = function() {
    return [
      '<div id="version-section" style="display: none; padding: 20px; background: #f8f9fa; border-top: 2px solid #dee2e6;">',
      '  <div style="margin-bottom: 15px;">',
      '    <div style="font-weight: 600; color: #495057; margin-bottom: 8px;">Version Number:</div>',
      '    <div id="version-number" style="background: white; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 14px; border: 2px solid #C8102E; color: #C8102E; font-weight: 600;"></div>',
      '    <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">✓ Copied to clipboard</div>',
      '  </div>',
      '  <div id="version-instructions" style="background: #e3f2fd; border-left: 4px solid #1976d2; padding: 12px; margin-bottom: 15px; font-size: 13px; line-height: 1.5;"><strong>Next Step:</strong><br>1. Go to <strong>File → Version History → Name current version</strong><br>2. Paste the version number above<br>3. Return here and click <strong>Resume</strong></div>',
      '  <div id="official-section" style="display: none; margin-top: 15px;">',
      '    <label style="display: flex; align-items: center; margin-bottom: 15px; cursor: pointer;"><input type="checkbox" id="official-checkbox" style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;"><span style="font-weight: 600; color: #495057;">Mark as Official Version</span></label>',
      '    <div id="official-details" style="display: none;">',
      '      <div style="margin-bottom: 15px;"><label style="display: block; font-weight: 600; color: #495057; margin-bottom: 5px;">Committee:</label><select id="committee-select" style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;"><option value="">Select committee...</option></select></div>',
      '      <div><label style="display: block; font-weight: 600; color: #495057; margin-bottom: 5px;">Approval Comments:</label><textarea id="comments-textarea" style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 80px;" placeholder="Enter approval comments..."></textarea></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };
  
  WorkflowUI.prototype.renderProgressTracker = function() {
    var steps = [];
    steps.push(this.renderProgressStep(0, 'Ready', 'Click Start to begin'));
    steps.push(this.renderProgressStep(1, 'Export & Analyze', 'Waiting...'));
    steps.push(this.renderProgressStep(2, 'Version (Before)', 'Waiting...'));
    steps.push(this.renderProgressStep(3, 'Transform & Replace', 'Waiting...'));
    steps.push(this.renderProgressStep(4, 'Version (After)', 'Waiting...'));
    steps.push(this.renderProgressStep(5, 'Complete', 'Waiting...'));
    
    return [
      '<div style="padding: 20px; background: white; border-top: 1px solid #dee2e6;">',
      '  <div style="font-weight: 600; color: #495057; margin-bottom: 15px;">Progress:</div>',
      '  <div id="progress-tracker">',
      steps.join('\n'),
      '  </div>',
      '</div>'
    ].join('\n');
  };
  
  WorkflowUI.prototype.renderProgressStep = function(index, title, status) {
    return [
      '<div id="step-' + index + '" style="display: flex; align-items: center; padding: 10px; margin-bottom: 8px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid #dee2e6;">',
      '  <div id="step-' + index + '-icon" style="width: 24px; height: 24px; border-radius: 50%; background: #dee2e6; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 12px; color: white; flex-shrink: 0;">○</div>',
      '  <div style="flex-grow: 1;">',
      '    <div id="step-' + index + '-title" style="font-weight: 600; font-size: 13px; color: #495057;">' + title + '</div>',
      '    <div id="step-' + index + '-status" style="font-size: 11px; color: #6c757d;">' + status + '</div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };
  
  WorkflowUI.prototype.renderDebugLog = function() {
    return [
      '<div style="padding: 20px; background: white; border-top: 1px solid #dee2e6;">',
      '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">',
      '    <div style="font-weight: 600; color: #495057;">Debug Log:</div>',
      '    <div><button id="copy-log-btn" style="padding: 5px 10px; margin-right: 5px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Copy</button><button id="clear-log-btn" style="padding: 5px 10px; font-size: 11px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Clear</button></div>',
      '  </div>',
      '  <div id="log" style="background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 6px; font-family: Consolas, Monaco, monospace; font-size: 11px; height: 250px; overflow-y: auto; white-space: pre-wrap; line-height: 1.4;">MIGOP Editor V3 initialized\nWaiting to start...</div>',
      '</div>'
    ].join('\n');
  };
  
  WorkflowUI.prototype.cacheElements = function() {
    this.elements = {
      smartButton: document.getElementById('smart-button'),
      versionSection: document.getElementById('version-section'),
      versionNumber: document.getElementById('version-number'),
      versionInstructions: document.getElementById('version-instructions'),
      officialSection: document.getElementById('official-section'),
      officialCheckbox: document.getElementById('official-checkbox'),
      officialDetails: document.getElementById('official-details'),
      committeeSelect: document.getElementById('committee-select'),
      commentsTextarea: document.getElementById('comments-textarea'),
      progressTracker: document.getElementById('progress-tracker'),
      log: document.getElementById('log'),
      copyLogBtn: document.getElementById('copy-log-btn'),
      clearLogBtn: document.getElementById('clear-log-btn')
    };
    this.populateCommitteeDropdown();
  };
  
  WorkflowUI.prototype.populateCommitteeDropdown = function() {
    var select = this.elements.committeeSelect;
    if (!select) return;
    this.committeeOptions.forEach(function(option) {
      var optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      select.appendChild(optionEl);
    });
  };
  
  WorkflowUI.prototype.setupEventListeners = function() {
    var self = this;
    if (self.elements.smartButton) {
      self.elements.smartButton.addEventListener('click', function() { self.handleSmartButtonClick(); });
    }
    if (self.elements.officialCheckbox) {
      self.elements.officialCheckbox.addEventListener('change', function() { self.toggleOfficialDetails(); });
    }
    if (self.elements.copyLogBtn) {
      self.elements.copyLogBtn.addEventListener('click', function() { self.copyLog(); });
    }
    if (self.elements.clearLogBtn) {
      self.elements.clearLogBtn.addEventListener('click', function() { self.clearLog(); });
    }
    // FIX: Store workflowData from event for use in updateUI
    window.addEventListener('workflowStateChange', function(event) { self.handleStateChange(event); });
    window.addEventListener('workflowError', function(event) { self.handleError(event.detail); });
  };
  
  WorkflowUI.prototype.handleSmartButtonClick = function() {
    var self = this;
    var state = controller.getState();
    self.logger.info('WorkflowUI', 'Smart button clicked', {state: state});
    if (state === WorkflowStates.IDLE) {
      controller.startWorkflow();
    } else if (controller.isPaused()) {
      var userData = self.getUserData();
      controller.resumeWorkflow(userData);
    } else if (controller.isComplete()) {
      controller.reset();
      self.updateUI();
    }
  };
  
  WorkflowUI.prototype.getUserData = function() {
    var isOfficial = this.elements.officialCheckbox && this.elements.officialCheckbox.checked;
    if (!isOfficial) return {isOfficial: false};
    return {
      isOfficial: true,
      committee: this.elements.committeeSelect.value,
      comments: this.elements.commentsTextarea.value
    };
  };
  
  WorkflowUI.prototype.toggleOfficialDetails = function() {
    var isChecked = this.elements.officialCheckbox.checked;
    this.elements.officialDetails.style.display = isChecked ? 'block' : 'none';
  };
  
  // FIX: Store workflowData from event
  WorkflowUI.prototype.handleStateChange = function(event) {
    var self = this;
    var detail = event.detail;
    self.logger.info('WorkflowUI', 'State changed', {from: detail.oldState, to: detail.newState});
    
    // Store the workflowData from the event
    self.latestWorkflowData = detail.workflowData;
    
    self.updateUI();
  };
  
  WorkflowUI.prototype.handleError = function(detail) {
    var self = this;
    self.logger.error('WorkflowUI', 'Workflow error', detail);
    if (self.elements.smartButton) {
      self.elements.smartButton.textContent = 'Error - Click to Reset';
      self.elements.smartButton.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
    }
    self.updateProgressStep(5, 'Error', detail.message, 'error');
  };
  
  // FIX: Use stored workflowData instead of calling getWorkflowData()
  WorkflowUI.prototype.updateUI = function() {
    var self = this;
    var state = controller.getState();
    
    // Use stored workflowData from event, or get fresh if not available
    var workflowData = self.latestWorkflowData || controller.getWorkflowData();
    
    self.logger.debug('WorkflowUI', 'Updating UI', {state: state});
    self.updateSmartButton(state);
    self.updateVersionSection(state, workflowData);
    self.updateProgressTracker(state, workflowData);
  };
  
  WorkflowUI.prototype.updateSmartButton = function(state) {
    var button = this.elements.smartButton;
    if (!button) return;
    if (state === WorkflowStates.IDLE) {
      button.textContent = 'Start Workflow';
      button.disabled = false;
      button.style.background = 'linear-gradient(135deg, #C8102E 0%, #9A0826 100%)';
    } else if (state === WorkflowStates.VERSION_1_PAUSE || state === WorkflowStates.VERSION_2_PAUSE) {
      button.textContent = 'Resume';
      button.disabled = false;
      button.style.background = 'linear-gradient(135deg, #28a745 0%, #218838 100%)';
    } else if (state === WorkflowStates.COMPLETE) {
      button.textContent = '✓ Done - Click to Start New Workflow';
      button.disabled = false;
      button.style.background = 'linear-gradient(135deg, #28a745 0%, #218838 100%)';
    } else if (state === WorkflowStates.ERROR) {
      button.textContent = 'Error - Click to Reset';
      button.disabled = false;
      button.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
    } else {
      button.textContent = 'Processing...';
      button.disabled = true;
      button.style.background = '#6c757d';
    }
  };
  
  WorkflowUI.prototype.updateVersionSection = function(state, workflowData) {
    var section = this.elements.versionSection;
    if (!section) return;
    
    // Debug logging to see what we have
    this.logger.debug('WorkflowUI', 'updateVersionSection called', {
      state: state,
      hasWorkflowData: !!workflowData,
      hasPhase1: !!(workflowData && workflowData.phase1),
      versionNumber: workflowData && workflowData.phase1 ? workflowData.phase1.versionNumber : 'MISSING'
    });
    
    if (state === WorkflowStates.VERSION_1_PAUSE) {
      section.style.display = 'block';
      this.elements.versionNumber.textContent = (workflowData && workflowData.phase1 && workflowData.phase1.versionNumber) || 'ERROR: Version not found';
      this.elements.versionInstructions.innerHTML = '<strong>Next Step:</strong><br>1. Go to <strong>File → Version History → Name current version</strong><br>2. Paste the version number above<br>3. Return here and click <strong>Resume</strong>';
      this.elements.officialSection.style.display = 'none';
    } else if (state === WorkflowStates.VERSION_2_PAUSE) {
      section.style.display = 'block';
      this.elements.versionNumber.textContent = (workflowData && workflowData.phase2 && workflowData.phase2.versionNumber) || 'ERROR: Version not found';
      this.elements.versionInstructions.innerHTML = '<strong>Next Step:</strong><br>1. Go to <strong>File → Version History → Name current version</strong><br>2. Paste the version number above<br>3. Optionally mark as Official (below)<br>4. Return here and click <strong>Resume</strong>';
      this.elements.officialSection.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  };
  
  WorkflowUI.prototype.updateProgressTracker = function(state, workflowData) {
    var self = this;
    for (var i = 0; i <= 5; i++) { self.updateProgressStep(i, null, null, 'pending'); }
    if (state === WorkflowStates.IDLE) {
      self.updateProgressStep(0, 'Ready', 'Click Start to begin', 'pending');
    } else if (state === WorkflowStates.PHASE_1_EXPORTING || state === WorkflowStates.PHASE_1_ANALYZING) {
      self.updateProgressStep(0, 'Ready', '✓ Started', 'complete');
      self.updateProgressStep(1, 'Export & Analyze', 'Processing...', 'active');
    } else if (state === WorkflowStates.VERSION_1_PAUSE) {
      self.updateProgressStep(0, 'Ready', '✓ Started', 'complete');
      var suggestionCount = (workflowData && workflowData.phase1 && workflowData.phase1.suggestions) ? workflowData.phase1.suggestions.length : 0;
      self.updateProgressStep(1, 'Export & Analyze', '✓ Complete (' + suggestionCount + ' suggestions)', 'complete');
      self.updateProgressStep(2, 'Version (Before)', 'Please create version in Google Docs', 'active');
    } else if (state === WorkflowStates.PHASE_2_TRANSFORMING || state === WorkflowStates.PHASE_2_REBUILDING || state === WorkflowStates.PHASE_2_REPLACING) {
      self.updateProgressStep(0, 'Ready', '✓ Started', 'complete');
      self.updateProgressStep(1, 'Export & Analyze', '✓ Complete', 'complete');
      self.updateProgressStep(2, 'Version (Before)', '✓ Created', 'complete');
      self.updateProgressStep(3, 'Transform & Replace', 'Processing...', 'active');
    } else if (state === WorkflowStates.VERSION_2_PAUSE) {
      self.updateProgressStep(0, 'Ready', '✓ Started', 'complete');
      self.updateProgressStep(1, 'Export & Analyze', '✓ Complete', 'complete');
      self.updateProgressStep(2, 'Version (Before)', '✓ Created', 'complete');
      self.updateProgressStep(3, 'Transform & Replace', '✓ Complete', 'complete');
      self.updateProgressStep(4, 'Version (After)', 'Please create version in Google Docs', 'active');
    } else if (state === WorkflowStates.PHASE_3_FINALIZING) {
      self.updateProgressStep(0, 'Ready', '✓ Started', 'complete');
      self.updateProgressStep(1, 'Export & Analyze', '✓ Complete', 'complete');
      self.updateProgressStep(2, 'Version (Before)', '✓ Created', 'complete');
      self.updateProgressStep(3, 'Transform & Replace', '✓ Complete', 'complete');
      self.updateProgressStep(4, 'Version (After)', '✓ Created (Official)', 'complete');
      self.updateProgressStep(5, 'Complete', 'Writing version history...', 'active');
    } else if (state === WorkflowStates.COMPLETE) {
      self.updateProgressStep(0, 'Ready', '✓ Started', 'complete');
      self.updateProgressStep(1, 'Export & Analyze', '✓ Complete', 'complete');
      self.updateProgressStep(2, 'Version (Before)', '✓ Created', 'complete');
      self.updateProgressStep(3, 'Transform & Replace', '✓ Complete', 'complete');
      self.updateProgressStep(4, 'Version (After)', '✓ Created', 'complete');
      self.updateProgressStep(5, 'Complete', '✓ Workflow finished!', 'complete');
    }
  };
  
  WorkflowUI.prototype.updateProgressStep = function(index, title, status, state) {
    var stepEl = document.getElementById('step-' + index);
    var iconEl = document.getElementById('step-' + index + '-icon');
    var titleEl = document.getElementById('step-' + index + '-title');
    var statusEl = document.getElementById('step-' + index + '-status');
    if (!stepEl) return;
    if (title) titleEl.textContent = title;
    if (status) statusEl.textContent = status;
    if (state === 'complete') {
      stepEl.style.borderLeftColor = '#28a745';
      iconEl.style.background = '#28a745';
      iconEl.textContent = '✓';
      titleEl.style.color = '#28a745';
    } else if (state === 'active') {
      stepEl.style.borderLeftColor = '#C8102E';
      iconEl.style.background = '#C8102E';
      iconEl.textContent = '●';
      titleEl.style.color = '#C8102E';
    } else if (state === 'error') {
      stepEl.style.borderLeftColor = '#dc3545';
      iconEl.style.background = '#dc3545';
      iconEl.textContent = '✕';
      titleEl.style.color = '#dc3545';
    } else {
      stepEl.style.borderLeftColor = '#dee2e6';
      iconEl.style.background = '#dee2e6';
      iconEl.textContent = '○';
      titleEl.style.color = '#495057';
    }
  };
  
  WorkflowUI.prototype.copyLog = function() {
    var self = this;
    var logText = Log.getLogsAsText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(logText).then(function() {
        self.logger.info('WorkflowUI', 'Log copied to clipboard');
        self.showCopyFeedback();
      }).catch(function(error) {
        self.logger.error('WorkflowUI', 'Failed to copy log', error);
      });
    }
  };
  
  WorkflowUI.prototype.showCopyFeedback = function() {
    var btn = this.elements.copyLogBtn;
    if (!btn) return;
    var originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.background = '#28a745';
    setTimeout(function() {
      btn.textContent = originalText;
      btn.style.background = '#28a745';
    }, 2000);
  };
  
  WorkflowUI.prototype.clearLog = function() {
    Log.clear();
    this.logger.info('WorkflowUI', 'Log cleared by user');
  };
  
  window.MIGOP = window.MIGOP || {};
  window.MIGOP.WorkflowUI = WorkflowUI;
  window.MIGOP.ui = new WorkflowUI();
  window.MIGOP.UI = {
    copyLog: function() { window.MIGOP.ui.copyLog(); },
    clearLog: function() { window.MIGOP.ui.clearLog(); },
    updateUI: function() { window.MIGOP.ui.updateUI(); }
  };
  
  console.log('[MIGOP V3] workflow-ui.js loaded successfully');
})();
