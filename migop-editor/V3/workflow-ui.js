/**
 * ============================================================================
 * MIGOP EDITOR V3 - WORKFLOW UI MODULE
 * ============================================================================
 * 
 * This module implements the MIGOP-branded user interface with:
 * - Banner with MIGOP branding
 * - Smart button (Start/Resume/Done - state-dependent)
 * - Version section (conditional - shown during pauses)
 * - Progress tracker (5 steps with status)
 * - Debug log window
 * 
 * Depends on: workflow-controller, version-manager
 * 
 * SYNTAX FIX: Removed trailing commas in renderProgressTracker that caused
 * appendChild syntax errors when injecting into DOM.
 * ============================================================================
 */

(function() {
  'use strict';
  
  // Dependency check
  if (!window.MIGOP || !window.MIGOP.WorkflowController || !window.MIGOP.workflowController) {
    throw new Error('workflow-ui.js requires workflow-controller');
  }
  
  var controller = window.MIGOP.workflowController;
  var WorkflowStates = window.MIGOP.WorkflowStates;
  var Log = window.MIGOP.Log;
  
  // ============================================================================
  // UI MANAGER CLASS
  // ============================================================================
  
  function WorkflowUI() {
    this.logger = Log.getLogger();
    this.logger.info('WorkflowUI', 'UI module initializing');
    
    this.elements = {};
    this.committeeOptions = [
      'PDBOR Subcommittee',
      'Policy Committee',
      'District 1', 'District 2', 'District 3', 'District 4',
      'District 5', 'District 6', 'District 7', 'District 8',
      'District 9', 'District 10', 'District 11', 'District 12',
      'District 13',
      'State Committee'
    ];
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.initialize.bind(this));
    } else {
      this.initialize();
    }
  }
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  /**
   * Initialize UI
   */
  WorkflowUI.prototype.initialize = function() {
    var self = this;
    
    self.logger.info('WorkflowUI', 'Initializing UI');
    
    // Render UI
    self.renderUI();
    
    // Cache element references
    self.cacheElements();
    
    // Setup event listeners
    self.setupEventListeners();
    
    // Initial UI state
    self.updateUI();
    
    self.logger.info('WorkflowUI', 'UI initialized successfully');
  };
  
  /**
   * Render complete UI structure
   */
  WorkflowUI.prototype.renderUI = function() {
    var html = [];
    
    // Main container
    html.push('<div id="migop-container" style="font-family: \'Google Sans\', Roboto, Arial, sans-serif;">');
    
    // Banner
    html.push(this.renderBanner());
    
    // Smart button
    html.push(this.renderSmartButton());
    
    // Version section (initially hidden)
    html.push(this.renderVersionSection());
    
    // Progress tracker
    html.push(this.renderProgressTracker());
    
    // Debug log
    html.push(this.renderDebugLog());
    
    html.push('</div>');
    
    // Insert into app div
    var appDiv = document.getElementById('app');
    if (appDiv) {
      appDiv.innerHTML = html.join('\n');
    }
  };
  
  /**
   * Render banner with MIGOP branding
   */
  WorkflowUI.prototype.renderBanner = function() {
    return [
      '<div style="background: linear-gradient(135deg, #C8102E 0%, #9A0826 100%); padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">',
      '  <h2 style="margin: 0; font-size: 24px; font-weight: 600;">MIGOP Editor</h2>',
      '  <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">Version 3.0 - Professional Workflow</div>',
      '</div>'
    ].join('\n');
  };
  
  /**
   * Render smart button
   */
  WorkflowUI.prototype.renderSmartButton = function() {
    return [
      '<div style="padding: 20px; background: white;">',
      '  <button id="smart-button" style="',
      '    width: 100%;',
      '    padding: 15px;',
      '    font-size: 16px;',
      '    font-weight: 600;',
      '    border: none;',
      '    border-radius: 6px;',
      '    cursor: pointer;',
      '    background: linear-gradient(135deg, #C8102E 0%, #9A0826 100%);',
      '    color: white;',
      '    transition: all 0.3s ease;',
      '    box-shadow: 0 2px 4px rgba(200, 16, 46, 0.3);',
      '  ">',
      '    Start Workflow',
      '  </button>',
      '</div>'
    ].join('\n');
  };
  
  /**
   * Render version section
   */
  WorkflowUI.prototype.renderVersionSection = function() {
    return [
      '<div id="version-section" style="display: none; padding: 20px; background: #f8f9fa; border-top: 2px solid #dee2e6;">',
      '  <div style="margin-bottom: 15px;">',
      '    <div style="font-weight: 600; color: #495057; margin-bottom: 8px;">Version Number:</div>',
      '    <div id="version-number" style="',
      '      background: white;',
      '      padding: 12px;',
      '      border-radius: 4px;',
      '      font-family: monospace;',
      '      font-size: 14px;',
      '      border: 2px solid #C8102E;',
      '      color: #C8102E;',
      '      font-weight: 600;',
      '    "></div>',
      '    <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">✓ Copied to clipboard</div>',
      '  </div>',
      '  ',
      '  <div id="version-instructions" style="',
      '    background: #e3f2fd;',
      '    border-left: 4px solid #1976d2;',
      '    padding: 12px;',
      '    margin-bottom: 15px;',
      '    font-size: 13px;',
      '    line-height: 1.5;',
      '  ">',
      '    <strong>Next Step:</strong><br>',
      '    1. Go to <strong>File → Version History → Name current version</strong><br>',
      '    2. Paste the version number above<br>',
      '    3. Return here and click <strong>Resume</strong>',
      '  </div>',
      '  ',
      '  <div id="official-section" style="display: none; margin-top: 15px;">',
      '    <label style="display: flex; align-items: center; margin-bottom: 15px; cursor: pointer;">',
      '      <input type="checkbox" id="official-checkbox" style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">',
      '      <span style="font-weight: 600; color: #495057;">Mark as Official Version</span>',
      '    </label>',
      '    ',
      '    <div id="official-details" style="display: none;">',
      '      <div style="margin-bottom: 15px;">',
      '        <label style="display: block; font-weight: 600; color: #495057; margin-bottom: 5px;">Committee:</label>',
      '        <select id="committee-select" style="',
      '          width: 100%;',
      '          padding: 10px;',
      '          border: 1px solid #ced4da;',
      '          border-radius: 4px;',
      '          font-size: 14px;',
      '        ">',
      '          <option value="">Select committee...</option>',
      '        </select>',
      '      </div>',
      '      ',
      '      <div>',
      '        <label style="display: block; font-weight: 600; color: #495057; margin-bottom: 5px;">Approval Comments:</label>',
      '        <textarea id="comments-textarea" style="',
      '          width: 100%;',
      '          padding: 10px;',
      '          border: 1px solid #ced4da;',
      '          border-radius: 4px;',
      '          font-size: 14px;',
      '          font-family: inherit;',
      '          resize: vertical;',
      '          min-height: 80px;',
      '        " placeholder="Enter approval comments..."></textarea>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };
  
  /**
   * Render progress tracker
   * FIX: Removed trailing commas that caused syntax errors
   */
  WorkflowUI.prototype.renderProgressTracker = function() {
    return [
      '<div style="padding: 20px; background: white; border-top: 1px solid #dee2e6;">',
      '  <div style="font-weight: 600; color: #495057; margin-bottom: 15px;">Progress:</div>',
      '  <div id="progress-tracker">',
      '    ' + this.renderProgressStep(0, 'Ready', 'Click Start to begin'),
      '    ' + this.renderProgressStep(1, 'Export & Analyze', 'Waiting...'),
      '    ' + this.renderProgressStep(2, 'Version (Before)', 'Waiting...'),
      '    ' + this.renderProgressStep(3, 'Transform & Replace', 'Waiting...'),
      '    ' + this.renderProgressStep(4, 'Version (After)', 'Waiting...'),
      '    ' + this.renderProgressStep(5, 'Complete', 'Waiting...'),
      '  </div>',
      '</div>'
    ].join('\n');
  };
  
  /**
   * Render single progress step
   */
  WorkflowUI.prototype.renderProgressStep = function(index, title, status) {
    return [
      '<div id="step-' + index + '" style="',
      '  display: flex;',
      '  align-items: center;',
      '  padding: 10px;',
      '  margin-bottom: 8px;',
      '  background: #f8f9fa;',
      '  border-radius: 4px;',
      '  border-left: 4px solid #dee2e6;',
      '">',
      '  <div id="step-' + index + '-icon" style="',
      '    width: 24px;',
      '    height: 24px;',
      '    border-radius: 50%;',
      '    background: #dee2e6;',
      '    display: flex;',
      '    align-items: center;',
      '    justify-content: center;',
      '    margin-right: 12px;',
      '    font-size: 12px;',
      '    color: white;',
      '    flex-shrink: 0;',
      '  ">○</div>',
      '  <div style="flex-grow: 1;">',
      '    <div id="step-' + index + '-title" style="font-weight: 600; font-size: 13px; color: #495057;">' + title + '</div>',
      '    <div id="step-' + index + '-status" style="font-size: 11px; color: #6c757d;">' + status + '</div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };
  
  /**
   * Render debug log
   */
  WorkflowUI.prototype.renderDebugLog = function() {
    return [
      '<div style="padding: 20px; background: white; border-top: 1px solid #dee2e6;">',
      '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">',
      '    <div style="font-weight: 600; color: #495057;">Debug Log:</div>',
      '    <div>',
      '      <button id="copy-log-btn" style="padding: 5px 10px; margin-right: 5px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Copy</button>',
      '      <button id="clear-log-btn" style="padding: 5px 10px; font-size: 11px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Clear</button>',
      '    </div>',
      '  </div>',
      '  <div id="log" style="',
      '    background: #2d3748;',
      '    color: #e2e8f0;',
      '    padding: 15px;',
      '    border-radius: 6px;',
      '    font-family: Consolas, Monaco, monospace;',
      '    font-size: 11px;',
      '    height: 250px;',
      '    overflow-y: auto;',
      '    white-space: pre-wrap;',
      '    line-height: 1.4;',
      '  ">MIGOP Editor V3 initialized\nWaiting to start...</div>',
      '</div>'
    ].join('\n');
  };
  
  // ============================================================================
  // ELEMENT CACHING
  // ============================================================================
  
  /**
   * Cache DOM element references
   */
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
    
    // Populate committee dropdown
    this.populateCommitteeDropdown();
  };
  
  /**
   * Populate committee dropdown
   */
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
  
  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================
  
  /**
   * Setup event listeners
   */
  WorkflowUI.prototype.setupEventListeners = function() {
    var self = this;
    
    // Smart button
    if (self.elements.smartButton) {
      self.elements.smartButton.addEventListener('click', function() {
        self.handleSmartButtonClick();
      });
    }
    
    // Official checkbox
    if (self.elements.officialCheckbox) {
      self.elements.officialCheckbox.addEventListener('change', function() {
        self.toggleOfficialDetails();
      });
    }
    
    // Log buttons
    if (self.elements.copyLogBtn) {
      self.elements.copyLogBtn.addEventListener('click', function() {
        self.copyLog();
      });
    }
    
    if (self.elements.clearLogBtn) {
      self.elements.clearLogBtn.addEventListener('click', function() {
        self.clearLog();
      });
    }
    
    // Workflow state change events
    window.addEventListener('workflowStateChange', function(event) {
      self.handleStateChange(event.detail);
    });
    
    // Workflow error events
    window.addEventListener('workflowError', function(event) {
      self.handleError(event.detail);
    });
  };
  
  /**
   * Handle smart button click
   */
  WorkflowUI.prototype.handleSmartButtonClick = function() {
    var self = this;
    var state = controller.getState();
    
    self.logger.info('WorkflowUI', 'Smart button clicked', {state: state});
    
    if (state === WorkflowStates.IDLE) {
      // Start workflow
      controller.startWorkflow();
    } else if (controller.isPaused()) {
      // Resume workflow
      var userData = self.getUserData();
      controller.resumeWorkflow(userData);
    } else if (controller.isComplete()) {
      // Reset workflow
      controller.reset();
      self.updateUI();
    }
  };
  
  /**
   * Get user data from form
   */
  WorkflowUI.prototype.getUserData = function() {
    var isOfficial = this.elements.officialCheckbox && this.elements.officialCheckbox.checked;
    
    if (!isOfficial) {
      return {isOfficial: false};
    }
    
    return {
      isOfficial: true,
      committee: this.elements.committeeSelect.value,
      comments: this.elements.commentsTextarea.value
    };
  };
  
  /**
   * Toggle official details visibility
   */
  WorkflowUI.prototype.toggleOfficialDetails = function() {
    var isChecked = this.elements.officialCheckbox.checked;
    this.elements.officialDetails.style.display = isChecked ? 'block' : 'none';
  };
  
  // ============================================================================
  // STATE CHANGE HANDLERS
  // ============================================================================
  
  /**
   * Handle workflow state change
   */
  WorkflowUI.prototype.handleStateChange = function(detail) {
    var self = this;
    
    self.logger.info('WorkflowUI', 'State changed', {
      from: detail.oldState,
      to: detail.newState
    });
    
    self.updateUI();
  };
  
  /**
   * Handle workflow error
   */
  WorkflowUI.prototype.handleError = function(detail) {
    var self = this;
    
    self.logger.error('WorkflowUI', 'Workflow error', detail);
    
    // Update button to show error
    if (self.elements.smartButton) {
      self.elements.smartButton.textContent = 'Error - Click to Reset';
      self.elements.smartButton.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
    }
    
    // Show error in progress
    self.updateProgressStep(5, 'Error', detail.message, 'error');
  };
  
  // ============================================================================
  // UI UPDATE
  // ============================================================================
  
  /**
   * Update entire UI based on current state
   */
  WorkflowUI.prototype.updateUI = function() {
    var self = this;
    var state = controller.getState();
    var workflowData = controller.getWorkflowData();
    
    self.logger.debug('WorkflowUI', 'Updating UI', {state: state});
    
    // Update smart button
    self.updateSmartButton(state);
    
    // Update version section
    self.updateVersionSection(state, workflowData);
    
    // Update progress tracker
    self.updateProgressTracker(state, workflowData);
  };
  
  /**
   * Update smart button
   */
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
  
  /**
   * Update version section
   */
  WorkflowUI.prototype.updateVersionSection = function(state, workflowData) {
    var section = this.elements.versionSection;
    if (!section) return;
    
    if (state === WorkflowStates.VERSION_1_PAUSE) {
      // Show version section for "Before" version
      section.style.display = 'block';
      this.elements.versionNumber.textContent = workflowData.phase1.versionNumber || '';
      this.elements.versionInstructions.innerHTML = 
        '<strong>Next Step:</strong><br>' +
        '1. Go to <strong>File → Version History → Name current version</strong><br>' +
        '2. Paste the version number above<br>' +
        '3. Return here and click <strong>Resume</strong>';
      this.elements.officialSection.style.display = 'none';
    } else if (state === WorkflowStates.VERSION_2_PAUSE) {
      // Show version section for "After" version with Official option
      section.style.display = 'block';
      this.elements.versionNumber.textContent = workflowData.phase2.versionNumber || '';
      this.elements.versionInstructions.innerHTML = 
        '<strong>Next Step:</strong><br>' +
        '1. Go to <strong>File → Version History → Name current version</strong><br>' +
        '2. Paste the version number above<br>' +
        '3. Optionally mark as Official (below)<br>' +
        '4. Return here and click <strong>Resume</strong>';
      this.elements.officialSection.style.display = 'block';
    } else {
      // Hide version section
      section.style.display = 'none';
    }
  };
  
  /**
   * Update progress tracker
   */
  WorkflowUI.prototype.updateProgressTracker = function(state, workflowData) {
    var self = this;
    
    // Reset all steps
    for (var i = 0; i <= 5; i++) {
      self.updateProgressStep(i, null, null, 'pending');
    }
    
    // Update based on state
    if (state === WorkflowStates.IDLE) {
      self.updateProgressStep(0, 'Ready', 'Click Start to begin', 'pending');
    } else if (state === WorkflowStates.PHASE_1_EXPORTING || state === WorkflowStates.PHASE_1_ANALYZING) {
      self.updateProgressStep(0, 'Ready', '✓ Started', 'complete');
      self.updateProgressStep(1, 'Export & Analyze', 'Processing...', 'active');
    } else if (state === WorkflowStates.VERSION_1_PAUSE) {
      self.updateProgressStep(0, 'Ready', '✓ Started', 'complete');
      self.updateProgressStep(1, 'Export & Analyze', '✓ Complete (' + workflowData.phase1.suggestions.length + ' suggestions)', 'complete');
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
  
  /**
   * Update single progress step
   */
  WorkflowUI.prototype.updateProgressStep = function(index, title, status, state) {
    var stepEl = document.getElementById('step-' + index);
    var iconEl = document.getElementById('step-' + index + '-icon');
    var titleEl = document.getElementById('step-' + index + '-title');
    var statusEl = document.getElementById('step-' + index + '-status');
    
    if (!stepEl) return;
    
    // Update title and status if provided
    if (title) titleEl.textContent = title;
    if (status) statusEl.textContent = status;
    
    // Update styling based on state
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
      iconEl.textContent = '
