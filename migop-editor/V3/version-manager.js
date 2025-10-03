/**
 * ============================================================================
 * MIGOP EDITOR V3 - VERSION MANAGER MODULE
 * ============================================================================
 * 
 * This module handles version number generation, parsing, and version history
 * management for the MIGOP Editor V3 workflow system.
 * 
 * Version Number Format: #:TYPE:yy:mm:dd:hh:mm:ss
 * - # = Sequential number (1, 2, 3...)
 * - TYPE = B (Before), A (After), O (Official)
 * - yy:mm:dd = Date (2-digit year, month, day)
 * - hh:mm:ss = Time (24-hour format)
 * 
 * Depends on: migop-base, migop-log
 * ============================================================================
 */

(function() {
  'use strict';
  
  // Dependency check
  if (!window.MIGOP || !window.MIGOP.Base || !window.MIGOP.Log) {
    throw new Error('version-manager.js requires migop-base and migop-log');
  }
  
  var Base = window.MIGOP.Base;
  var Log = window.MIGOP.Log;
  
  // ============================================================================
  // VERSION MANAGER CLASS
  // ============================================================================
  
  function VersionManager(logger) {
    this.logger = logger || Log.getLogger();
    this.logger.info('VersionManager', 'Module initialized');
  }
  
  // ============================================================================
  // VERSION NUMBER GENERATION
  // ============================================================================
  
  /**
   * Generate a formatted version number
   * @param {number} sequentialNumber - Counter from Document Properties
   * @param {string} type - 'B', 'A', or 'O'
   * @param {Date} timestamp - Optional timestamp (defaults to now)
   * @returns {string} Formatted version: #:B/A/O:yy:mm:dd:hh:mm:ss
   */
  VersionManager.prototype.generateVersionNumber = function(sequentialNumber, type, timestamp) {
    this.logger.info('VersionManager', 'Generating version number', {
      sequential: sequentialNumber,
      type: type
    });
    
    if (!timestamp) {
      timestamp = new Date();
    }
    
    // Validate type
    if (!['B', 'A', 'O'].includes(type)) {
      this.logger.error('VersionManager', 'Invalid version type', {type: type});
      return null;
    }
    
    // Format date/time components (zero-padded)
    var yy = String(timestamp.getFullYear()).slice(-2).padStart(2, '0');
    var mm = String(timestamp.getMonth() + 1).padStart(2, '0');
    var dd = String(timestamp.getDate()).padStart(2, '0');
    var hh = String(timestamp.getHours()).padStart(2, '0');
    var min = String(timestamp.getMinutes()).padStart(2, '0');
    var ss = String(timestamp.getSeconds()).padStart(2, '0');
    
    // Build version string
    var versionString = sequentialNumber + ':' + type + ':' + yy + ':' + mm + ':' + dd + ':' + hh + ':' + min + ':' + ss;
    
    this.logger.info('VersionManager', 'Version number generated', {
      versionNumber: versionString
    });
    
    return versionString;
  };
  
  /**
   * Parse version number into components
   * @param {string} versionString - Formatted version number
   * @returns {Object} Parsed components or null if invalid
   */
  VersionManager.prototype.parseVersionNumber = function(versionString) {
    this.logger.debug('VersionManager', 'Parsing version number', {
      versionString: versionString
    });
    
    var parts = versionString.split(':');
    
    if (parts.length !== 8) {
      this.logger.error('VersionManager', 'Invalid version string format', {
        versionString: versionString,
        partsCount: parts.length
      });
      return null;
    }
    
    var parsed = {
      sequential: parseInt(parts[0]),
      type: parts[1],
      year: parseInt(parts[2]),
      month: parseInt(parts[3]),
      day: parseInt(parts[4]),
      hour: parseInt(parts[5]),
      minute: parseInt(parts[6]),
      second: parseInt(parts[7])
    };
    
    this.logger.debug('VersionManager', 'Version number parsed', parsed);
    return parsed;
  };
  
  /**
   * Format version date for display
   * @param {Object} parsed - Parsed version from parseVersionNumber()
   * @returns {string} Human-readable date: "September 30, 2025 at 9:15 AM"
   */
  VersionManager.prototype.formatVersionDate = function(parsed) {
    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    var monthName = monthNames[parsed.month - 1];
    var fullYear = 2000 + parsed.year;
    
    // Convert to 12-hour format
    var hour12 = parsed.hour % 12;
    if (hour12 === 0) hour12 = 12;
    var ampm = parsed.hour >= 12 ? 'PM' : 'AM';
    
    var formatted = monthName + ' ' + parsed.day + ', ' + fullYear + 
                   ' at ' + hour12 + ':' + String(parsed.minute).padStart(2, '0') + ' ' + ampm;
    
    return formatted;
  };
  
  // ============================================================================
  // VERSION COUNTER MANAGEMENT (Server-side bridge)
  // ============================================================================
  
  /**
   * Get version counter (calls server-side function)
   * @param {boolean} increment - Whether to increment
   * @param {function} callback - Callback with counter value
   */
  VersionManager.prototype.getVersionCounter = function(increment, callback) {
    var self = this;
    self.logger.info('VersionManager', 'Getting version counter from server', {
      increment: increment
    });
    
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      self.logger.error('VersionManager', 'Google Apps Script bridge not available');
      callback({success: false, error: 'Apps Script bridge not available'});
      return;
    }
    
    google.script.run
      .withSuccessHandler(function(counter) {
        self.logger.info('VersionManager', 'Version counter retrieved', {
          counter: counter
        });
        callback({success: true, counter: counter});
      })
      .withFailureHandler(function(error) {
        self.logger.error('VersionManager', 'Failed to get version counter', error);
        callback({success: false, error: error.message});
      })
      .getOrIncrementVersionCounter(increment);
  };
  
  // ============================================================================
  // VERSION HISTORY PAGE (Server-side bridge)
  // ============================================================================
  
  /**
   * Write version history page (calls server-side function)
   * @param {Object} versionData - {versionNumber, committee, timestamp, comments}
   * @param {function} callback - Callback with result
   */
  VersionManager.prototype.writeVersionHistory = function(versionData, callback) {
    var self = this;
    self.logger.info('VersionManager', 'Writing version history to document', {
      versionNumber: versionData.versionNumber,
      committee: versionData.committee
    });
    
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      self.logger.error('VersionManager', 'Google Apps Script bridge not available');
      callback({success: false, error: 'Apps Script bridge not available'});
      return;
    }
    
    google.script.run
      .withSuccessHandler(function(result) {
        self.logger.info('VersionManager', 'Version history written successfully', result);
        callback(result);
      })
      .withFailureHandler(function(error) {
        self.logger.error('VersionManager', 'Failed to write version history', error);
        callback({success: false, error: error.message});
      })
      .writeVersionHistoryPage(versionData);
  };
  
  // ============================================================================
  // VALIDATION
  // ============================================================================
  
  /**
   * Validate version data before writing
   * @param {Object} versionData - Version data to validate
   * @returns {Object} {valid: boolean, errors: Array<string>}
   */
  VersionManager.prototype.validateVersionData = function(versionData) {
    var errors = [];
    
    if (!versionData.versionNumber) {
      errors.push('Version number is required');
    } else {
      var parsed = this.parseVersionNumber(versionData.versionNumber);
      if (!parsed) {
        errors.push('Invalid version number format');
      }
    }
    
    if (!versionData.committee) {
      errors.push('Committee is required');
    }
    
    if (!versionData.timestamp) {
      errors.push('Timestamp is required');
    }
    
    if (!versionData.comments) {
      errors.push('Comments are required');
    }
    
    var valid = errors.length === 0;
    
    if (!valid) {
      this.logger.warn('VersionManager', 'Version data validation failed', {
        errors: errors
      });
    }
    
    return {
      valid: valid,
      errors: errors
    };
  };
  
  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  /**
   * Get committee display name
   * @param {string} committeeValue - Committee abbreviation or full name
   * @returns {string} Full committee name
   */
  VersionManager.prototype.getCommitteeDisplayName = function(committeeValue) {
    var committeeMap = {
      'PDBOR': 'PDBOR Subcommittee',
      'Policy': 'Policy Committee',
      'D1': 'District 1',
      'D2': 'District 2',
      'D3': 'District 3',
      'D4': 'District 4',
      'D5': 'District 5',
      'D6': 'District 6',
      'D7': 'District 7',
      'D8': 'District 8',
      'D9': 'District 9',
      'D10': 'District 10',
      'D11': 'District 11',
      'D12': 'District 12',
      'D13': 'District 13',
      'State': 'State Committee'
    };
    
    return committeeMap[committeeValue] || committeeValue;
  };
  
  /**
   * Format comments text
   * @param {string} comments - Raw comments from input
   * @returns {string} Cleaned comments
   */
  VersionManager.prototype.formatCommentsText = function(comments) {
    if (!comments) return '';
    
    var formatted = comments.trim();
    
    // Replace multiple newlines with double newline
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    // Remove HTML tags if present
    formatted = formatted.replace(/<[^>]*>/g, '');
    
    return formatted;
  };
  
  /**
   * Copy version number to clipboard
   * @param {string} versionNumber - Version number to copy
   */
  VersionManager.prototype.copyToClipboard = function(versionNumber) {
    var self = this;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(versionNumber).then(function() {
        self.logger.info('VersionManager', 'Version number copied to clipboard', {
          versionNumber: versionNumber
        });
      }).catch(function(error) {
        self.logger.error('VersionManager', 'Failed to copy to clipboard', error);
      });
    } else {
      // Fallback for older browsers
      var textArea = document.createElement('textarea');
      textArea.value = versionNumber;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        self.logger.info('VersionManager', 'Version number copied (fallback method)');
      } catch (error) {
        self.logger.error('VersionManager', 'Fallback copy failed', error);
      }
      
      document.body.removeChild(textArea);
    }
  };
  
  // ============================================================================
  // EXPORT TO MIGOP NAMESPACE
  // ============================================================================
  
  window.MIGOP = window.MIGOP || {};
  window.MIGOP.VersionManager = VersionManager;
  
  // Create singleton instance
  window.MIGOP.versionManager = new VersionManager(Log.getLogger());
  
  console.log('[MIGOP V3] version-manager.js loaded successfully');
})();
