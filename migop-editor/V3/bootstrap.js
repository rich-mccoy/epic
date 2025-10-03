/**
 * ============================================================================
 * MIGOP EDITOR V3 - BOOTSTRAP LOADER
 * ============================================================================
 * 
 * This is the ONLY client-side file loaded directly by v3.gs.
 * It handles:
 * - Fetching bootstrap config JSON
 * - Cache-busting for all module URLs
 * - Sequential module loading
 * - Error handling and user feedback
 * - UI initialization
 * 
 * Philosophy: Keep v3.gs minimal (Apps Script only), do everything else here.
 * ============================================================================
 */

(function() {
  'use strict';
  
  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  var CONFIG = {
    BOOTSTRAP_JSON_URL: 'https://raw.githubusercontent.com/rich-mccoy/epic/main/migop-editor/V3/v3-bootstrap.json',
    CACHE_BUSTER: '?v=' + Date.now()
  };
  
  // ============================================================================
  // BOOTSTRAP CONFIG ACCESSOR (with cache-busting)
  // ============================================================================
  
  var BootstrapConfig = {
    _config: null,
    _cacheBuster: CONFIG.CACHE_BUSTER,
    
    /**
     * Initialize - fetch and parse bootstrap config
     */
    init: async function() {
      console.log('[Bootstrap] Fetching config from:', CONFIG.BOOTSTRAP_JSON_URL);
      console.log('[Bootstrap] Cache buster:', this._cacheBuster);
      
      try {
        var response = await fetch(CONFIG.BOOTSTRAP_JSON_URL + this._cacheBuster);
        if (!response.ok) {
          throw new Error('Failed to fetch config: ' + response.status);
        }
        
        this._config = await response.json();
        console.log('[Bootstrap] Config loaded successfully:', this._config);
        
        return this._config;
      } catch (error) {
        console.error('[Bootstrap] Failed to load config:', error);
        throw error;
      }
    },
    
    /**
     * Get module URL with cache-busting
     */
    getModuleUrl: function(moduleName) {
      if (!this._config) {
        throw new Error('Bootstrap config not initialized. Call init() first.');
      }
      
      var url = this._config.modules && this._config.modules[moduleName];
      
      if (!url) {
        throw new Error('Module not found in config: ' + moduleName);
      }
      
      return url + this._cacheBuster;
    },
    
    /**
     * Get load order array
     */
    getLoadOrder: function() {
      if (!this._config) {
        throw new Error('Bootstrap config not initialized. Call init() first.');
      }
      
      return this._config.loadOrder || [];
    },
    
    /**
     * Get all module names
     */
    getModuleList: function() {
      if (!this._config) {
        throw new Error('Bootstrap config not initialized. Call init() first.');
      }
      
      return Object.keys(this._config.modules || {});
    }
  };
  
  // ============================================================================
  // MODULE LOADER
  // ============================================================================
  
  var ModuleLoader = {
    /**
     * Load all modules in sequence
     */
    loadAll: async function(loadOrder) {
      console.log('[Bootstrap] Loading ' + loadOrder.length + ' modules...');
      updateStatus('Loading modules...', 'loading');
      
      for (var i = 0; i < loadOrder.length; i++) {
        var moduleName = loadOrder[i];
        
        try {
          console.log('[Bootstrap] Loading module ' + (i + 1) + '/' + loadOrder.length + ': ' + moduleName);
          updateStatus('Loading ' + moduleName + '... (' + (i + 1) + '/' + loadOrder.length + ')', 'loading');
          
          await this.loadModule(moduleName);
          
          console.log('[Bootstrap] ✓ Module loaded: ' + moduleName);
        } catch (error) {
          console.error('[Bootstrap] ✗ Failed to load module: ' + moduleName, error);
          updateStatus('⚠️ Module ' + moduleName + ' failed: ' + error.message, 'warning');
          // Continue loading other modules
        }
      }
      
      console.log('[Bootstrap] All modules loaded');
      updateStatus('✓ MIGOP Editor V3 ready', 'success');
    },
    
    /**
     * Load single module
     */
    loadModule: async function(moduleName) {
      var url = BootstrapConfig.getModuleUrl(moduleName);
      
      var response = await fetch(url);
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      
      var code = await response.text();
      
      // Extract from <script> tags if present (legacy support)
      var scriptMatch = code.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
      if (scriptMatch && scriptMatch[1]) {
        code = scriptMatch[1];
      }
      
      // Inject and execute
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.text = code;
      document.head.appendChild(script);
      
      console.log('[Bootstrap] Module ' + moduleName + ' injected (' + code.length + ' bytes)');
    }
  };
  
  // ============================================================================
  // UI HELPERS
  // ============================================================================
  
  /**
   * Update status message
   */
  function updateStatus(message, type) {
    var statusDiv = document.getElementById('status');
    if (!statusDiv) {
      // Create status div if it doesn't exist
      statusDiv = document.createElement('div');
      statusDiv.id = 'status';
      statusDiv.style.cssText = 'padding: 10px; background: #fff; border-bottom: 1px solid #ddd; font-size: 12px;';
      document.body.insertBefore(statusDiv, document.body.firstChild);
    }
    
    statusDiv.textContent = message;
    
    if (type === 'success') {
      statusDiv.style.background = '#e8f5e9';
      statusDiv.style.color = '#2e7d32';
    } else if (type === 'error') {
      statusDiv.style.background = '#ffebee';
      statusDiv.style.color = '#d32f2f';
    } else if (type === 'warning') {
      statusDiv.style.background = '#fff3cd';
      statusDiv.style.color = '#856404';
    } else {
      statusDiv.style.background = '#e3f2fd';
      statusDiv.style.color = '#1976d2';
    }
  }
  
  /**
   * Show error screen
   */
  function showError(title, message, details) {
    var appDiv = document.getElementById('app');
    if (!appDiv) return;
    
    var html = [
      '<div style="padding: 20px; font-family: Arial, sans-serif;">',
      '  <h2 style="color: #d32f2f;">⚠️ ' + title + '</h2>',
      '  <div style="background: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 10px 0;">',
      '    <strong>' + message + '</strong>',
      '    ' + (details ? '<br><br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">' + details + '</code>' : ''),
      '  </div>',
      '  <div style="background: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin: 20px 0; font-size: 14px;">',
      '    <strong>Troubleshooting:</strong>',
      '    <ol>',
      '      <li>Check browser console for errors</li>',
      '      <li>Verify JSON config is accessible</li>',
      '      <li>Ensure all module URLs are valid</li>',
      '      <li>Try refreshing the page</li>',
      '    </ol>',
      '  </div>',
      '</div>'
    ].join('\n');
    
    appDiv.innerHTML = html;
  }
  
  // ============================================================================
  // FALLBACK CONFIG
  // ============================================================================
  
  function getFallbackConfig() {
    console.warn('[Bootstrap] Using fallback configuration');
    return {
      version: '3.0-fallback',
      modules: {
        'migop-base': 'https://raw.githubusercontent.com/rich-mccoy/epic/main/migop-editor/V1/migop-base.html',
        'migop-log': 'https://raw.githubusercontent.com/rich-mccoy/epic/main/migop-editor/V1/migop-log.html'
      },
      loadOrder: ['migop-base', 'migop-log']
    };
  }
  
  // ============================================================================
  // BOOTSTRAP INITIALIZATION
  // ============================================================================
  
  async function bootstrap() {
    console.log('[Bootstrap] Starting MIGOP Editor V3 bootstrap...');
    updateStatus('Initializing...', 'loading');
    
    try {
      // Fetch config
      try {
        await BootstrapConfig.init();
      } catch (configError) {
        console.error('[Bootstrap] Config fetch failed, using fallback:', configError);
        updateStatus('⚠️ Using fallback configuration', 'warning');
        BootstrapConfig._config = getFallbackConfig();
      }
      
      // Get load order
      var loadOrder = BootstrapConfig.getLoadOrder();
      
      if (loadOrder.length === 0) {
        throw new Error('No modules to load (loadOrder is empty)');
      }
      
      // Load all modules
      await ModuleLoader.loadAll(loadOrder);
      
      console.log('[Bootstrap] Bootstrap complete!');
      
    } catch (error) {
      console.error('[Bootstrap] Bootstrap failed:', error);
      updateStatus('✗ Bootstrap failed', 'error');
      showError(
        'Bootstrap Error',
        'Failed to initialize MIGOP Editor V3',
        error.message
      );
    }
  }
  
  // ============================================================================
  // EXPORT TO GLOBAL NAMESPACE
  // ============================================================================
  
  window.MIGOP = window.MIGOP || {};
  window.MIGOP.BootstrapConfig = BootstrapConfig;
  window.MIGOP.ModuleLoader = ModuleLoader;
  
  // ============================================================================
  // AUTO-START
  // ============================================================================
  
  // Start bootstrap when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
  
  console.log('[Bootstrap] bootstrap.js loaded');
})();
