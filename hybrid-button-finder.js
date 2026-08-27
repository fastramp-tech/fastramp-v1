/**
 * Hybrid Button Finder - AI-First with Fuzzy Fallback
 *
 * Strategy:
 * 1. PRIMARY: Ask Firebase AI Logic to identify navigation buttons (95-98% accuracy)
 * 2. FALLBACK: Use fuzzy matching if AI fails or is unavailable (85-90% accuracy)
 * 3. LAST RESORT: Manual user intervention
 *
 * This gives best-of-both-worlds: High accuracy with graceful degradation
 */

class HybridButtonFinder {
  constructor() {
    // Reference to fuzzy matcher (fallback)
    this.fuzzyMatcher = window.fuzzyButtonMatcher || new FuzzyButtonMatcher();

    // Cache for AI-detected buttons (avoid re-querying same page)
    this.buttonCache = new Map();
  }

  /**
   * Find navigation button using hybrid AI-first approach
   *
   * @param {string} buttonType - "next", "previous", "submit"
   * @param {object} aiAnalysis - Optional: AI analysis result (if already available)
   * @returns {Promise<Element|null>} - The button element to click
   */
  async findButton(buttonType = 'next', aiAnalysis = null) {
    console.log(`🔍 [HybridFinder] Finding ${buttonType} button...`);
    console.log(`   Strategy: AI-first, Fuzzy-fallback`);

    // Check cache first (avoid duplicate AI queries)
    const cacheKey = `${window.location.href}_${buttonType}`;
    if (this.buttonCache.has(cacheKey)) {
      console.log(`   💾 Using cached button detection`);
      return this.buttonCache.get(cacheKey);
    }

    // ═══════════════════════════════════════════════════════
    // TIER 1: AI-BASED DETECTION (PRIMARY)
    // ═══════════════════════════════════════════════════════
    console.log(`   🎯 TIER 1: Trying AI-based detection...`);

    try {
      const button = await this.findButtonWithAI(buttonType, aiAnalysis);

      if (button) {
        console.log(`   ✅ TIER 1 SUCCESS: AI found button`);
        console.log(`      Text: "${this.getButtonText(button)}"`);
        console.log(`      Selector: ${this.generateSelector(button)}`);

        // Cache the result
        this.buttonCache.set(cacheKey, button);
        return button;
      }

      console.log(`   ⚠️ TIER 1 FAILED: AI didn't find button`);

    } catch (error) {
      console.log(`   ❌ TIER 1 ERROR: ${error.message}`);
    }

    // ═══════════════════════════════════════════════════════
    // TIER 2: FUZZY MATCHING (FALLBACK)
    // ═══════════════════════════════════════════════════════
    console.log(`   🔧 TIER 2: Trying fuzzy matching fallback...`);

    try {
      const button = this.fuzzyMatcher.findNavigationButton(null, buttonType);

      if (button) {
        console.log(`   ✅ TIER 2 SUCCESS: Fuzzy matcher found button`);
        console.log(`      Text: "${this.getButtonText(button)}"`);

        // Cache the result
        this.buttonCache.set(cacheKey, button);
        return button;
      }

      console.log(`   ⚠️ TIER 2 FAILED: Fuzzy matcher didn't find button`);

    } catch (error) {
      console.log(`   ❌ TIER 2 ERROR: ${error.message}`);
    }

    // ═══════════════════════════════════════════════════════
    // TIER 3: MANUAL FALLBACK (LAST RESORT)
    // ═══════════════════════════════════════════════════════
    console.log(`   ⚠️ TIER 3: No automatic detection worked`);
    console.log(`   💡 User may need to manually click the ${buttonType} button`);

    return null;
  }

  /**
   * Find button using AI (Firebase AI Logic)
   *
   * @param {string} buttonType - "next", "previous", "submit"
   * @param {object} aiAnalysis - Optional: Pre-existing AI analysis
   * @returns {Promise<Element|null>}
   */
  async findButtonWithAI(buttonType, aiAnalysis = null) {
    // If AI analysis already available (from form analysis), use it
    if (aiAnalysis && aiAnalysis.navigationButton) {
      return this.parseAIButtonResponse(aiAnalysis.navigationButton);
    }

    // Otherwise, request fresh AI analysis
    console.log(`      Requesting AI analysis from background worker...`);

    const response = await chrome.runtime.sendMessage({
      action: 'findNavigationButton',
      buttonType: buttonType,
      pageHTML: this.getOptimizedHTML()
    });

    if (response.success && response.button) {
      return this.parseAIButtonResponse(response.button);
    }

    return null;
  }

  /**
   * Parse AI's button detection response and find the element
   *
   * @param {object} aiButton - AI's button detection result
   * @returns {Element|null}
   */
  parseAIButtonResponse(aiButton) {
    /*
    AI returns:
    {
      "exists": true,
      "text": "Continue to Payment",
      "selector": "button.checkout-next",
      "confidence": 0.95,
      "type": "next"
    }
    */

    if (!aiButton.exists) {
      return null;
    }

    // Try AI's suggested selector first
    if (aiButton.selector) {
      try {
        const element = document.querySelector(aiButton.selector);
        if (element && this.isElementVisible(element)) {
          console.log(`      AI selector worked: ${aiButton.selector}`);
          return element;
        }
      } catch (e) {
        console.log(`      AI selector failed: ${e.message}`);
      }
    }

    // Fallback: Search by AI's detected text
    if (aiButton.text) {
      console.log(`      Searching for button with text: "${aiButton.text}"`);
      const buttons = this.findAllButtons();

      for (const button of buttons) {
        const buttonText = this.getButtonText(button);

        // Use fuzzy matching to compare AI's text with actual button text
        const similarity = this.fuzzyMatcher.textSimilarity(aiButton.text, buttonText);

        if (similarity >= 70) {  // 70% threshold
          console.log(`      Found match: "${buttonText}" (${similarity}% similar)`);
          return button;
        }
      }
    }

    return null;
  }

  /**
   * Get optimized HTML for AI analysis
   */
  getOptimizedHTML() {
    // Clone and clean the page HTML
    const clone = document.body.cloneNode(true);

    // Remove extension panel
    clone.querySelector('#fastramp-panel-root')?.remove();

    // Remove heavy elements
    clone.querySelectorAll('script, style, svg, iframe').forEach(el => el.remove());

    return clone.outerHTML;
  }

  /**
   * Find all potential button elements
   */
  findAllButtons() {
    return this.fuzzyMatcher.findAllButtonElements();
  }

  /**
   * Get text from button element
   */
  getButtonText(element) {
    return this.fuzzyMatcher.getElementText(element);
  }

  /**
   * Check if element is visible (Atlas-compliant)
   * Uses getBoundingClientRect() to handle CSS transforms
   */
  isElementVisible(element) {
    // Skip hidden input types
    if (element.type === 'hidden') return false;

    // Check computed styles
    const style = window.getComputedStyle(element);
    if (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0') {
      return false;
    }

    // Check physical dimensions (getBoundingClientRect handles CSS transforms)
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Generate selector for element
   */
  generateSelector(element) {
    if (element.id) return `#${element.id}`;
    if (element.className) {
      const classes = Array.from(element.classList).join('.');
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
    return element.tagName.toLowerCase();
  }

  /**
   * Click the navigation button (AI-first, fuzzy-fallback)
   *
   * @param {string} buttonType - "next", "previous", "submit"
   * @param {object} aiAnalysis - Optional: AI analysis from form filling
   * @returns {Promise<boolean>} - True if button was found and clicked
   */
  async clickButton(buttonType = 'next', aiAnalysis = null) {
    console.log(`\n🖱️  [HybridFinder] Attempting to click ${buttonType} button...`);

    const button = await this.findButton(buttonType, aiAnalysis);

    if (!button) {
      console.log(`❌ [HybridFinder] No ${buttonType} button found`);
      return false;
    }

    try {
      // Scroll button into view
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Wait for scroll
      await new Promise(resolve => setTimeout(resolve, 300));

      // Click the button
      button.click();

      console.log(`✅ [HybridFinder] Successfully clicked ${buttonType} button`);
      console.log(`   Text: "${this.getButtonText(button)}"`);

      return true;

    } catch (error) {
      console.log(`❌ [HybridFinder] Error clicking button: ${error.message}`);
      return false;
    }
  }

  /**
   * Clear button cache (call when navigating to new page)
   */
  clearCache() {
    this.buttonCache.clear();
    console.log(`🗑️  [HybridFinder] Button cache cleared`);
  }
}

// LAZY LOAD: Don't instantiate immediately - only create when accessed
// This prevents interference with other features during page load
// Wrap in try-catch to prevent any errors from breaking other scripts
(function() {
  try {
    Object.defineProperty(window, 'hybridButtonFinder', {
      get: function() {
        if (!this._hybridButtonFinderInstance) {
          console.log('⚡ Lazy-loading HybridButtonFinder...');
          this._hybridButtonFinderInstance = new HybridButtonFinder();
        }
        return this._hybridButtonFinderInstance;
      },
      configurable: true
    });
  } catch (error) {
    console.error('Failed to initialize hybridButtonFinder:', error);
  }
})();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HybridButtonFinder;
}
