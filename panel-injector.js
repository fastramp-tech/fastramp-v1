// Panel injector - injects the panel directly into the page
(function() {
  // Check if panel already exists
  if (document.getElementById('fastramp-panel-root')) {
    return;
  }

  // ===================================
  // Chrome AI Helper Functions
  // ===================================
  async function checkChromeAI() {
    try {
      // Check if Prompt API exists (correct way as per official docs)
      if (!self.ai || !self.ai.languageModel) {
        console.log('ℹ️ Chrome Prompt API not available (optional)');
        console.log('✅ Extension uses Firebase AI Logic instead');
        console.log('💡 On-device AI optional - to enable:');
        console.log('   1. Enable chrome://flags/#prompt-api-for-gemini-nano');
        console.log('   2. Download model at chrome://components/');
        console.log('   3. Restart Chrome');
        return false;
      }

      // Check availability as per official Prompt API docs
      const { available, defaultTemperature, defaultTopK, maxTopK } = await ai.languageModel.params();

      if (available !== "no") {
        console.log('✅ Chrome Prompt API (Gemini Nano) available!');
        console.log('📊 Model params:', { defaultTemperature, defaultTopK, maxTopK });
        console.log('💡 Firebase AI Logic can use on-device inference');
        return true;
      } else {
        console.log('ℹ️ Chrome Prompt API not available (status: no)');
        console.log('✅ Extension uses Firebase AI Logic with cloud inference');
        console.log('💡 On-device AI optional - extension fully functional without it');
        return false;
      }
    } catch (error) {
      console.log('ℹ️ Chrome Prompt API check failed:', error.message);
      console.log('✅ Extension uses Firebase AI Logic (cloud inference)');
      return false;
    }
  }

  // =====================================
  // HTML EXTRACTION HELPER (OPTIMIZED)
  // =====================================
  function getOptimizedHTML() {
    // AGGRESSIVE OPTIMIZATION: Remove all scripts, styles, and SVGs to reduce size
    // This makes Chrome AI processing faster

    const clone = document.body.cloneNode(true);

    // CRITICAL: Remove extension's own panel to avoid detecting it as a form!
    // The panel has input fields (API key, etc.) that should NOT be analyzed
    const extensionPanel = clone.querySelector('#fastramp-panel-root');
    if (extensionPanel) {
      extensionPanel.remove();
      console.log('   ✅ Removed extension panel from analysis');
    }

    // Remove heavy elements that aren't needed for form detection
    const elementsToRemove = [
      'script',
      'style',
      'svg',
      'img[src*="base64"]', // Remove base64 images
      'iframe',
      'noscript'
    ];

    elementsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Remove inline styles (but keep classes for AI to understand)
    clone.querySelectorAll('[style]').forEach(el => {
      el.removeAttribute('style');
    });

    const optimizedHTML = clone.outerHTML;
    const fullHTML = document.documentElement.outerHTML;
    const bodyHTML = document.body.outerHTML;

    const reduction = Math.round((1 - optimizedHTML.length / bodyHTML.length) * 100);
    console.log(`📤 Sending ${optimizedHTML.length.toLocaleString()} characters`);
    console.log(`   Reduction from body: ${reduction}%`);
    console.log(`   Removed: extension panel, scripts, styles, SVGs, images, inline styles`);

    return optimizedHTML;
  }

  // ===================================
  // FORM FIELD FILLING HELPER (HYBRID)
  // ===================================
  function fillFieldElement(element, value, fieldLabel) {
    if (!element || !value) return false;

    try {
      console.log(`   🔧 Filling "${fieldLabel}"...`);

      if (element.tagName === 'INPUT' && element.type === 'hidden') {
        // Google Forms: fill both hidden and visible elements
        element.value = value;

        // Find visible element by aria-label
        let visibleInput = document.querySelector(`input[aria-label="${fieldLabel}"], textarea[aria-label="${fieldLabel}"], div[role="textbox"][aria-label="${fieldLabel}"]`);

        // Try partial match if exact match fails
        if (!visibleInput) {
          const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, div[role="textbox"]'))
            .filter(inp => !inp.closest('#fastramp-panel-root')); // Exclude extension panel
          for (const inp of allInputs) {
            const ariaLabel = (inp.getAttribute('aria-label') || '').toLowerCase();
            const searchLabel = fieldLabel.toLowerCase();
            if (ariaLabel === searchLabel || ariaLabel.includes(searchLabel)) {
              visibleInput = inp;
              break;
            }
          }
        }

        if (visibleInput) {
          if (visibleInput.hasAttribute('contenteditable') || visibleInput.getAttribute('role') === 'textbox') {
            visibleInput.textContent = value;
            visibleInput.innerText = value;
          } else {
            visibleInput.value = value;
          }

          ['input', 'change', 'blur', 'focus', 'keyup'].forEach(eventType => {
            visibleInput.dispatchEvent(new Event(eventType, { bubbles: true }));
          });

          visibleInput.focus();
          setTimeout(() => visibleInput.blur(), 50);
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

      } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

      } else if (element.hasAttribute('contenteditable') || element.getAttribute('role') === 'textbox') {
        element.textContent = value;
        element.innerText = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

      } else if (element.tagName === 'SELECT') {
        const options = Array.from(element.options);
        const matchingOption = options.find(opt =>
          opt.value === value || opt.text === value
        );
        if (matchingOption) {
          element.value = matchingOption.value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      console.log(`   ✓ Filled "${fieldLabel}": ${value}`);
      return true;

    } catch (error) {
      console.warn(`   ⚠️ Could not fill "${fieldLabel}":`, error.message);
      return false;
    }
  }

  // ============================================
  // DIRECT DOM MANIPULATION FOR GOOGLE FORMS
  // ============================================
  async function fillFieldDirectly(field) {
    const { label, suggestedValue, selector, type } = field;

    console.log(`   🎯 Finding field: "${label}"`);
    console.log(`   📍 Selector: ${selector}`);
    console.log(`   📋 Type: ${type}`);

    try {
      // RADIO BUTTON HANDLING
      // Check if this is a radio button field
      if (type === 'radio' || (selector && selector.includes('[role="radiogroup"]'))) {
        console.log(`   🔘 Radio button detected - searching for option: "${suggestedValue}"`);

        // Strategy 1: Find radio group by label
        let radioGroup = null;

        // Try to find all radio groups
        const allRadioGroups = document.querySelectorAll('[role="radiogroup"]');

        for (const group of allRadioGroups) {
          // Check aria-labelledby
          const ariaLabelledBy = group.getAttribute('aria-labelledby');
          if (ariaLabelledBy) {
            const labelIds = ariaLabelledBy.split(' ');
            const labelTexts = labelIds.map(id => {
              const el = document.getElementById(id);
              return el ? el.textContent.trim() : '';
            }).join(' ');

            const cleanLabel = label.toLowerCase().replace(/\s*\*\s*$/, '').replace(/required question/i, '').trim();
            const cleanLabelText = labelTexts.toLowerCase().replace(/\s*\*\s*$/, '').replace(/required question/i, '').trim();

            if (cleanLabelText.includes(cleanLabel) || cleanLabel.includes(cleanLabelText)) {
              radioGroup = group;
              console.log(`   ✅ Found radio group by aria-labelledby: "${labelTexts}"`);
              break;
            }
          }
        }

        // Strategy 2: Try the AI-provided selector
        if (!radioGroup && selector) {
          radioGroup = document.querySelector(selector);
          if (radioGroup) {
            console.log(`   ✅ Found radio group by selector`);
          }
        }

        if (!radioGroup) {
          console.warn(`   ❌ Could not locate radio group for "${label}"`);
          return false;
        }

        // Find all radio options within the group
        const radioOptions = radioGroup.querySelectorAll('[role="radio"]');
        console.log(`   🔍 Found ${radioOptions.length} radio options in group`);

        // Find the option that matches the suggestedValue
        let matchedOption = null;
        const cleanValue = suggestedValue.toLowerCase().trim();

        for (const option of radioOptions) {
          // Get the option's label text
          const ariaLabelledBy = option.getAttribute('aria-labelledby');
          let optionText = '';

          if (ariaLabelledBy) {
            const labelIds = ariaLabelledBy.split(' ');
            optionText = labelIds.map(id => {
              const el = document.getElementById(id);
              return el ? el.textContent.trim() : '';
            }).join(' ');
          }

          // Also check aria-label
          const ariaLabel = option.getAttribute('aria-label');
          if (ariaLabel) {
            optionText = ariaLabel;
          }

          // Also check text content of the option or nearby label
          if (!optionText) {
            optionText = option.textContent.trim();
          }

          const cleanOptionText = optionText.toLowerCase().trim();
          console.log(`   🔍 Checking option: "${optionText}"`);

          // Match the option (case-insensitive, partial match)
          if (cleanOptionText.includes(cleanValue) || cleanValue.includes(cleanOptionText)) {
            matchedOption = option;
            console.log(`   ✅ Matched option: "${optionText}"`);
            break;
          }
        }

        if (!matchedOption) {
          console.warn(`   ❌ Could not find radio option matching "${suggestedValue}"`);
          console.warn(`   Available options: ${Array.from(radioOptions).map(o => o.textContent.trim()).join(', ')}`);
          return false;
        }

        // Click the matched radio option
        console.log(`   ⚡ Clicking radio option...`);
        matchedOption.click();
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify it was selected
        const isChecked = matchedOption.getAttribute('aria-checked') === 'true';
        if (isChecked) {
          console.log(`   ✅ Radio option selected successfully`);
          return true;
        } else {
          console.warn(`   ⚠️ Radio option clicked but aria-checked is not true`);
          return false;
        }
      }

      // TEXT INPUT HANDLING (original code)
      // Strategy 1: Find by analyzing Google Forms structure
      // Google Forms typically has the visible input without a name attribute
      // but with aria-labelledby pointing to the label element

      // First, try to find all inputs in the form (EXCLUDING extension panel)
      const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], textarea'))
        .filter(input => {
          // Exclude inputs inside the extension panel
          return !input.closest('#fastramp-panel-root');
        });

      let targetInput = null;

      // Strategy 1: Try the AI-provided selector FIRST (most accurate for Google Forms with duplicate labels)
      if (selector) {
        const selectorElement = document.querySelector(selector);
        if (selectorElement) {
          if (selectorElement.type === 'hidden') {
            // Find the visible input in the same parent container
            const container = selectorElement.closest('[jsmodel], [jscontroller], .freebirdFormviewerComponentsQuestionBaseRoot');
            if (container) {
              targetInput = container.querySelector('input:not([type="hidden"]), textarea');
              console.log(`   ✅ Found visible input in container using AI selector (PRIORITY METHOD)`);
            }
          } else {
            targetInput = selectorElement;
            console.log(`   ✅ Found input by AI selector (PRIORITY METHOD - prevents duplicate label issues)`);
          }
        }
      }

      // Strategy 2: Try to match by label text (fallback only when selector fails)
      if (!targetInput) {
        for (const input of allInputs) {
        // Check aria-labelledby
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
          const labelIds = ariaLabelledBy.split(' ');
          const labelTexts = labelIds.map(id => {
            const el = document.getElementById(id);
            return el ? el.textContent.trim() : '';
          }).join(' ');

          // Check if label matches (remove "Required question" and "*" for comparison)
          const cleanLabel = label.toLowerCase().replace(/\s*\*\s*$/, '').replace(/required question/i, '').trim();
          const cleanLabelText = labelTexts.toLowerCase().replace(/\s*\*\s*$/, '').replace(/required question/i, '').trim();

          // IMPROVED: Exact match first, then partial match (prevents "Email" matching "Email address you used to sign up for Devpost")
          const isExactMatch = cleanLabelText === cleanLabel;
          const isCloseMatch = cleanLabelText.includes(cleanLabel) && cleanLabel.length > 4; // Avoid short generic matches
          const isFullMatch = cleanLabel.includes(cleanLabelText) && cleanLabelText.length > 4;

          if (isExactMatch || isCloseMatch || isFullMatch) {
            // Prefer exact matches
            if (isExactMatch || !targetInput) {
              targetInput = input;
              console.log(`   ✅ Found input by aria-labelledby: "${labelTexts}" (${isExactMatch ? 'exact' : 'partial'} match)`);
              if (isExactMatch) break; // Stop on exact match
            }
          }
        }

        // Also check aria-label attribute
        const ariaLabel = input.getAttribute('aria-label');
        if (ariaLabel) {
          const cleanLabel = label.toLowerCase().replace(/\s*\*\s*$/, '').trim();
          const cleanAriaLabel = ariaLabel.toLowerCase().replace(/\s*\*\s*$/, '').trim();

          if (cleanAriaLabel.includes(cleanLabel) || cleanLabel.includes(cleanAriaLabel)) {
            targetInput = input;
            console.log(`   ✅ Found input by aria-label: "${ariaLabel}" (FALLBACK)`);
            break;
          }
        }
        }
      }

      if (!targetInput) {
        console.warn(`   ❌ Could not locate input for "${label}"`);
        return false;
      }

      // Now fill the field with proper events
      console.log(`   ⚡ Filling field with value: "${suggestedValue}"`);

      // Step 1: Click and focus (simulate user interaction)
      targetInput.click();
      targetInput.focus();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Clear any existing value first
      targetInput.value = '';

      // Step 3: Simulate typing each character (Google Forms may validate on keydown/keyup)
      for (let i = 0; i < suggestedValue.length; i++) {
        const char = suggestedValue[i];

        // Simulate keydown
        targetInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          bubbles: true,
          cancelable: true
        }));

        // Add the character
        targetInput.value += char;

        // Simulate keypress
        targetInput.dispatchEvent(new KeyboardEvent('keypress', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          bubbles: true,
          cancelable: true
        }));

        // Trigger input event after each character
        targetInput.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: char
        }));

        // Simulate keyup
        targetInput.dispatchEvent(new KeyboardEvent('keyup', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          bubbles: true,
          cancelable: true
        }));

        // Small delay between characters to simulate human typing
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Step 4: Set data-initial-value attribute (Google Forms uses this)
      targetInput.setAttribute('data-initial-value', suggestedValue);

      // Also set data-initial-dir if it exists
      if (targetInput.hasAttribute('data-initial-dir')) {
        targetInput.setAttribute('data-initial-dir', 'auto');
      }

      // Remove badinput attribute if present
      targetInput.setAttribute('badinput', 'false');

      // Step 5: Trigger change event
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Step 6: Blur the field (triggers validation)
      targetInput.blur();
      targetInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log(`   ✅ Successfully filled and triggered events`);
      return true;

    } catch (error) {
      console.error(`   ❌ Error filling field "${label}":`, error);
      return false;
    }
  }

  // Create root container for our panel
  const root = document.createElement('div');
  root.id = 'fastramp-panel-root';
  
  // Panel HTML structure
  root.innerHTML = `
    <div class="fastramp-overlay" id="fastramp-overlay"></div>
    
    <div class="fastramp-panel" id="fastramp-panel">
      <div class="fastramp-header">
        <div class="fastramp-header-content">
          <div class="fastramp-logo">🚀</div>
          <div class="fastramp-header-text">
            <h1>FastRamp</h1>
            <p>Powered by Chrome AI (Gemini Nano)</p>
          </div>
        </div>
        <div class="fastramp-header-actions">
          <button class="fastramp-settings-btn" id="fastramp-settings" title="Settings">⚙️</button>
          <button class="fastramp-close-btn" id="fastramp-close">✕</button>
        </div>
      </div>
      
      <div class="fastramp-panel-content">
        <!-- API Key Configuration Section (Hidden by default when configured) -->
        <div class="fastramp-api-section" id="fastramp-api-section" style="display: none;">
          <div class="fastramp-api-header">
            <span class="fastramp-api-title">⚙️ API Configuration</span>
            <button class="fastramp-api-toggle" id="fastramp-api-toggle">✕</button>
          </div>
          <div class="fastramp-api-content">
            <div class="fastramp-api-status" id="fastramp-api-status">
              <span class="fastramp-status-icon" id="fastramp-status-icon">⏳</span>
              <span class="fastramp-status-text" id="fastramp-status-text">Checking Chrome AI...</span>
            </div>
            <div class="fastramp-api-status" style="margin-top: 10px;">
              <span class="fastramp-status-icon">✅</span>
              <span class="fastramp-status-text">Chrome AI (Gemini Nano) Ready</span>
            </div>

            <!-- Gemini API Key Input -->
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              <div style="margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 13px;">
                🔑 Gemini API Key (Required for Embeddings)
              </div>
              <div style="margin-bottom: 8px; font-size: 11px; color: #6b7280;">
                Get your free API key: <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #3b82f6; text-decoration: underline;">aistudio.google.com</a>
              </div>
              <div style="margin-bottom: 8px; font-size: 10px; color: #9ca3af; font-style: italic;">
                💾 Saved to Sync Storage (syncs across devices). Embeddings use Local Storage (10MB).
              </div>
              <input
                type="password"
                id="fastramp-gemini-api-key"
                placeholder="Paste your Gemini API key here..."
                value=""
                style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; font-family: monospace; margin-bottom: 8px;"
              />
              <div style="display: flex; gap: 8px;">
                <button
                  id="fastramp-save-api-key"
                  style="flex: 1; padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;"
                >
                  Save API Key
                </button>
                <button
                  id="fastramp-test-api-key"
                  style="flex: 1; padding: 8px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;"
                >
                  Test Key
                </button>
              </div>
              <div id="fastramp-api-key-status" style="margin-top: 8px; font-size: 11px; padding: 6px; border-radius: 4px; display: none;"></div>
            </div>

            <!-- Debug Mode Toggle -->
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              <div style="margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 13px;">
                🐛 Debug Mode
              </div>
              <div style="margin-bottom: 8px; font-size: 11px; color: #6b7280;">
                Enable detailed console logging for debugging (increases console output)
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                  <input
                    type="checkbox"
                    id="fastramp-debug-mode"
                    style="width: 18px; height: 18px; cursor: pointer; margin-right: 8px;"
                  />
                  <span style="font-size: 12px; color: #374151;">Enable debug logging</span>
                </label>
              </div>
            </div>

            <!-- Storage Mode Selection -->
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              <div style="margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 13px;">
                💾 Embedding Storage Location
              </div>
              <div style="margin-bottom: 8px; font-size: 11px; color: #6b7280;">
                Choose where to store your document embeddings
              </div>
              <select
                id="fastramp-storage-mode"
                style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 8px; background: white; cursor: pointer;"
              >
                <option value="local">🏠 Local Storage (10MB limit, faster)</option>
                <option value="cloud">☁️ Cloud Storage (Unlimited, requires internet)</option>
              </select>
              <div style="margin-bottom: 8px; font-size: 10px; color: #9ca3af; font-style: italic;" id="fastramp-storage-usage">
                📊 Usage: Calculating...
              </div>
              <div style="margin-top: 8px; padding: 8px; background: #f3f4f6; border-radius: 4px; font-size: 10px; color: #6b7280;">
                <strong style="color: #374151;">💡 Tip:</strong> Local storage is faster but limited to 10MB. Cloud storage is unlimited but requires internet connection.
              </div>
            </div>
          </div>
        </div>

        <div class="fastramp-content-wrapper" id="fastramp-content-wrapper">
        <!-- Main action button - Single button for both analyze and fill -->
        <div class="fastramp-main-buttons">
          <button class="fastramp-main-btn fastramp-primary-btn" id="fastramp-smart-fill">
            <span class="fastramp-icon">🚀</span>
            <span class="fastramp-label">Analyze & Fill Form</span>
          </button>
        </div>

        <!-- Progress Bar Section -->
        <div class="fastramp-progress-section" id="fastramp-progress-section" style="display: none;">
          <div class="fastramp-progress-title">Processing Workflow</div>
          <div class="fastramp-progress-stages">
            <div class="fastramp-stage" id="stage-scanning">
              <span class="fastramp-stage-icon">⏳</span>
              <span class="fastramp-stage-text">Scanning page for forms...</span>
            </div>
            <div class="fastramp-stage" id="stage-analyzing">
              <span class="fastramp-stage-icon">⏳</span>
              <span class="fastramp-stage-text">Analyzing form structure...</span>
            </div>
            <div class="fastramp-stage" id="stage-embedding">
              <span class="fastramp-stage-icon">⏳</span>
              <span class="fastramp-stage-text">Loading knowledge base with Gemini...</span>
            </div>
            <div class="fastramp-stage" id="stage-matching">
              <span class="fastramp-stage-icon">⏳</span>
              <span class="fastramp-stage-text">Matching fields with knowledge base...</span>
            </div>
            <div class="fastramp-stage" id="stage-filling">
              <span class="fastramp-stage-icon">⏳</span>
              <span class="fastramp-stage-text">Filling form fields...</span>
            </div>
            <div class="fastramp-stage" id="stage-complete">
              <span class="fastramp-stage-icon">⏳</span>
              <span class="fastramp-stage-text">Complete!</span>
            </div>
          </div>
        </div>

        <!-- Analysis Results Section (Collapsible) -->
        <div class="fastramp-section" id="fastramp-results-section" style="display: none;">
          <div class="fastramp-section-header" id="fastramp-results-header">
            <div class="fastramp-section-title">
              <span class="fastramp-section-icon">📊</span>
              <span>Analysis Results</span>
            </div>
            <span class="fastramp-expand-icon fastramp-expanded" id="fastramp-results-icon">▼</span>
          </div>
          <div class="fastramp-section-content fastramp-expanded" id="fastramp-results-content">
            <div class="fastramp-results-summary">
              <div class="fastramp-result-item">
                <span class="fastramp-result-label">Forms Detected:</span>
                <span class="fastramp-result-value" id="result-forms-count">-</span>
              </div>
              <div class="fastramp-result-item">
                <span class="fastramp-result-label">Fields Found:</span>
                <span class="fastramp-result-value" id="result-fields-count">-</span>
              </div>
              <div class="fastramp-result-item">
                <span class="fastramp-result-label">Fields Filled:</span>
                <span class="fastramp-result-value" id="result-filled-count">-</span>
              </div>
              <div class="fastramp-result-item">
                <span class="fastramp-result-label">Success Rate:</span>
                <span class="fastramp-result-value" id="result-success-rate">-</span>
              </div>
            </div>
            <div class="fastramp-results-details" id="fastramp-results-details">
              <div class="fastramp-results-details-title">Detected Fields:</div>
              <div class="fastramp-results-fields-list" id="results-fields-list"></div>
            </div>
          </div>
        </div>

          <!-- Voice chat section -->
          <div class="fastramp-voice-section" id="fastramp-voice">
            <div class="fastramp-voice-content">
              <span class="fastramp-voice-icon">🎙️</span>
              <div class="fastramp-voice-text">
                <h3>Real-time Voice Chat</h3>
                <p>Powered by Web Speech API</p>
              </div>
            </div>
            <span class="fastramp-voice-badge" id="fastramp-voice-badge" style="display: none; background: #f59e0b; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 8px;">0</span>
            <span class="fastramp-voice-arrow">→</span>
          </div>
        
        <!-- Custom Instructions -->
        <div class="fastramp-section">
          <div class="fastramp-section-header" id="fastramp-instructions-header">
            <div class="fastramp-section-title">
              <span class="fastramp-section-icon">📝</span>
              <span>Custom Instructions</span>
            </div>
            <span class="fastramp-expand-icon" id="fastramp-instructions-icon">▼</span>
          </div>
          <div class="fastramp-section-content" id="fastramp-instructions-content">
            <textarea class="fastramp-instructions-textarea" id="fastramp-instructions-text" 
              placeholder="Add any specific instructions for form filling..."></textarea>
          </div>
        </div>
        
        <!-- Knowledge Base -->
        <div class="fastramp-section">
          <div class="fastramp-section-header" id="fastramp-knowledge-header">
            <div class="fastramp-section-title">
              <span class="fastramp-section-icon">📚</span>
              <span>Knowledge Base</span>
            </div>
            <span class="fastramp-expand-icon fastramp-expanded" id="fastramp-knowledge-icon">▼</span>
          </div>
          <div class="fastramp-section-content fastramp-expanded" id="fastramp-knowledge-content">
            <div class="fastramp-upload-area">
              <div class="fastramp-upload-icon">📁</div>
              <div class="fastramp-upload-title">Upload Documents</div>
              <div class="fastramp-upload-subtitle">TXT, PDF, MD, JSON, CSV</div>
              <button class="fastramp-choose-files-btn" id="fastramp-choose-files">Choose Files</button>
            </div>

            <!-- LinkedIn Import Section -->
            <div class="fastramp-linkedin-import" style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #0077b5 0%, #005582 100%); border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 24px;">💼</span>
                <div>
                  <div style="font-weight: 600; color: white; font-size: 14px;">Import from LinkedIn</div>
                  <div style="font-size: 12px; color: rgba(255,255,255,0.8);">Import your resume directly from LinkedIn</div>
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <input
                  type="text"
                  id="fastramp-linkedin-url"
                  placeholder="https://linkedin.com/in/your-profile"
                  style="flex: 1; padding: 8px 12px; border: none; border-radius: 6px; font-size: 13px;"
                />
                <button
                  id="fastramp-linkedin-import-btn"
                  style="padding: 8px 16px; background: white; color: #0077b5; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; white-space: nowrap;"
                >Import Resume</button>
              </div>
            </div>

            <div id="fastramp-files-list"></div>
            
            <div class="fastramp-kb-status" id="fastramp-kb-status">No files in knowledge base</div>
            
            <div class="fastramp-success-message" id="fastramp-success" style="display: none;">
              <span class="fastramp-success-icon">✅</span>
              <span class="fastramp-success-text" id="fastramp-success-text">Successfully embedded chunks</span>
            </div>

            <!-- Embedding Progress Indicator -->
            <div class="fastramp-embedding-progress" id="fastramp-embedding-progress" style="display: none;">
              <div class="fastramp-progress-header">
                <span class="fastramp-progress-icon" id="fastramp-progress-icon">🔄</span>
                <span class="fastramp-progress-title">Creating Embeddings...</span>
              </div>
              <div class="fastramp-progress-bar">
                <div class="fastramp-progress-fill" id="fastramp-progress-fill" style="width: 0%; transition: width 0.3s ease;"></div>
              </div>
              <div class="fastramp-progress-text" id="fastramp-progress-text">Processing chunk 0/0...</div>
            </div>

            <!-- Knowledge Base Chatbox -->
            <div class="fastramp-kb-chat">
              <div class="fastramp-chat-header">
                <span class="fastramp-chat-icon">💬</span>
                <span class="fastramp-chat-title">Ask your Knowledge Base</span>
              </div>
              <div class="fastramp-chat-messages" id="fastramp-chat-messages">
                <div class="fastramp-chat-message system">
                  Upload documents to query them using AI
                </div>
              </div>
              <div class="fastramp-chat-input-group">
                <input type="text" 
                       class="fastramp-chat-input" 
                       id="fastramp-chat-input" 
                       placeholder="Ask a question about your documents..."
                       disabled>
                <button class="fastramp-chat-send" id="fastramp-chat-send" disabled>Send</button>
              </div>
            </div>
          </div>
        </div>
        </div> <!-- End content wrapper -->
      </div>
    </div>
    
    <input type="file" id="fastramp-file-input" multiple accept=".txt,.pdf,.docx,.md,.json,.csv" style="display: none;">
  `;

  // Append to body
  document.body.appendChild(root);

  // Panel state management
  let isPanelOpen = false;
  let apiKeyConfigured = false;
  const panel = document.getElementById('fastramp-panel');
  const overlay = document.getElementById('fastramp-overlay');
  const closeBtn = document.getElementById('fastramp-close');
  const settingsBtn = document.getElementById('fastramp-settings');

  // API Key elements
  const apiSection = document.getElementById('fastramp-api-section');
  const apiToggleBtn = document.getElementById('fastramp-api-toggle');
  const apiInput = document.getElementById('fastramp-api-input');
  const apiSaveBtn = document.getElementById('fastramp-api-save');
  const apiStatusIcon = document.getElementById('fastramp-status-icon');
  const apiStatusText = document.getElementById('fastramp-status-text');
  const contentWrapper = document.getElementById('fastramp-content-wrapper');
  const apiInputGroup = root.querySelector('.fastramp-api-input-group');
  const apiHelp = root.querySelector('.fastramp-api-help');

  // Open panel function
  function openPanel() {
    isPanelOpen = true;
    panel.classList.add('open');
    overlay.classList.add('show');
    chrome.storage.local.set({ panelOpen: true });
  }

  // Close panel function
  function closePanel() {
    isPanelOpen = false;
    panel.classList.remove('open');
    overlay.classList.remove('show');
    chrome.storage.local.set({ panelOpen: false });
  }

  // Check Gemini API key configuration
  async function checkApiKey() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['geminiApiKey'], (syncResult) => {
        if (syncResult.geminiApiKey) {
          apiKeyConfigured = true;
          updateApiStatus(true);
          enableMainFeatures();
          hideApiSection();
          resolve(true);
        } else {
          chrome.storage.local.get(['geminiApiKey'], (localResult) => {
            if (localResult.geminiApiKey) {
              // Sync to sync storage
              chrome.storage.sync.set({ geminiApiKey: localResult.geminiApiKey });
              apiKeyConfigured = true;
              updateApiStatus(true);
              enableMainFeatures();
              hideApiSection();
              resolve(true);
            } else {
              apiKeyConfigured = false;
              updateApiStatus(false);
              showApiSection();
              resolve(false);
            }
          });
        }
      });
    });
  }
  
  function showApiSection() {
    apiSection.style.display = 'block';
    contentWrapper.style.opacity = '0.5';
    contentWrapper.style.pointerEvents = 'none';
  }
  
  function hideApiSection() {
    apiSection.style.display = 'none';
    contentWrapper.style.opacity = '1';
    contentWrapper.style.pointerEvents = 'auto';
  }

  function updateApiStatus(isConfigured) {
    if (isConfigured) {
      if (apiStatusIcon) apiStatusIcon.textContent = '✅';
      if (apiStatusText) apiStatusText.textContent = 'Chrome AI Connected';
      if (apiSection) {
        apiSection.style.background = '#d4edda';
        apiSection.style.border = '1px solid #c3e6cb';
      }
      if (apiInput) {
        apiInput.value = '••••••••••••••••••••••••';
        apiInput.disabled = true;
      }
      if (apiSaveBtn) {
        apiSaveBtn.textContent = 'Change';
        apiSaveBtn.disabled = false;
      }
      if (apiInputGroup) apiInputGroup.style.display = 'flex';
      if (apiHelp) apiHelp.style.display = 'block';
    } else {
      if (apiStatusIcon) apiStatusIcon.textContent = '⚠️';
      if (apiStatusText) apiStatusText.textContent = 'Chrome AI Configuration';
      if (apiSection) {
        apiSection.style.background = '#fff3cd';
        apiSection.style.border = '1px solid #ffeeba';
      }
      if (apiInput) {
        apiInput.value = '';
        apiInput.disabled = false;
      }
      if (apiSaveBtn) {
        apiSaveBtn.textContent = 'Save';
        apiSaveBtn.disabled = false;
      }
      if (apiInputGroup) apiInputGroup.style.display = 'flex';
      if (apiHelp) apiHelp.style.display = 'block';
    }
  }

  function enableMainFeatures() {
    // Features are always enabled now, controlled by show/hide API section
  }

  async function saveApiKey() {
    // If currently showing Change button, switch to edit mode
    if (apiSaveBtn.textContent === 'Change') {
      apiInput.disabled = false;
      apiInput.value = '';
      apiInput.focus();
      apiSaveBtn.textContent = 'Save';
      return;
    }

    const apiKey = apiInput.value.trim();
    if (!apiKey) {
      showNotification('Please enter a valid Gemini API key', 'error');
      return;
    }

    // Validate Gemini API key format (starts with AIza)
    if (!apiKey.startsWith('AIza')) {
      showNotification('Invalid Gemini API key format. Key should start with "AIza"', 'error');
      return;
    }

    // Save to BOTH local and sync storage for persistence
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
      chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
        // Send to background script to reinitialize services
        chrome.runtime.sendMessage({
          action: 'apiKeyUpdated',
          apiKey: apiKey
        }, (response) => {
          apiKeyConfigured = true;
          updateApiStatus(true);
          hideApiSection(); // Auto-hide after saving
          showNotification('Gemini API key saved successfully!', 'success');
        });
      });
    });
  }


  // Event listeners
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);

  // API Save button for Gemini API key
  if (apiSaveBtn) {
    apiSaveBtn.addEventListener('click', saveApiKey);
  }

  // Auto-save custom instructions when user types (debounced)
  const instructionsTextarea = document.getElementById('fastramp-instructions-text');
  let instructionsSaveTimeout;
  if (instructionsTextarea) {
    instructionsTextarea.addEventListener('input', () => {
      clearTimeout(instructionsSaveTimeout);
      instructionsSaveTimeout = setTimeout(() => {
        const instructions = instructionsTextarea.value.trim();
        chrome.storage.local.set({ customInstructions: instructions }, () => {
          console.log('💾 Custom instructions auto-saved:', instructions);
        });
      }, 1000); // Save 1 second after user stops typing
    });

    // Load saved custom instructions on panel open - happens IMMEDIATELY
    chrome.storage.local.get(['customInstructions'], (result) => {
      if (result.customInstructions) {
        instructionsTextarea.value = result.customInstructions;
        console.log('✅ Loaded custom instructions from storage:', result.customInstructions);

        // Show brief confirmation to user
        const instructionsSection = document.getElementById('fastramp-instructions-content');
        if (instructionsSection) {
          instructionsSection.style.border = '2px solid #10b981';
          setTimeout(() => {
            instructionsSection.style.border = '';
          }, 2000);
        }
      } else {
        console.log('ℹ️  No custom instructions found in storage');
      }
    });
  }

  // Settings button toggles API configuration
  settingsBtn.addEventListener('click', () => {
    if (apiSection.style.display === 'none' || !apiSection.style.display) {
      showApiSection();
    } else {
      hideApiSection();
    }
  });

  // Close API section button - only if it exists
  if (apiToggleBtn) {
    apiToggleBtn.addEventListener('click', () => {
      hideApiSection();
    });
  }

  // Allow Enter key to save API key - only if input exists
  if (apiInput) {
    apiInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveApiKey();
      }
    });
  }

  // Gemini API Key handlers
  const geminiApiKeyInput = document.getElementById('fastramp-gemini-api-key');
  const saveApiKeyBtn = document.getElementById('fastramp-save-api-key');
  const testApiKeyBtn = document.getElementById('fastramp-test-api-key');
  const apiKeyStatusDiv = document.getElementById('fastramp-api-key-status');

  // Load existing API key AND debug mode from sync storage
  chrome.storage.sync.get(['geminiApiKey', 'debugMode'], (result) => {
    if (result.geminiApiKey && geminiApiKeyInput) {
      geminiApiKeyInput.value = result.geminiApiKey;
      showApiKeyStatus('✅ API key loaded from sync storage', 'success');
    } else if (geminiApiKeyInput && geminiApiKeyInput.value) {
      // Auto-save the pre-filled API key
      chrome.storage.sync.set({ geminiApiKey: geminiApiKeyInput.value }, () => {
        showApiKeyStatus('✅ API key auto-configured and saved!', 'success');
        console.log('✅ API key auto-saved:', geminiApiKeyInput.value.substring(0, 10) + '...');
      });
    }

    // Load debug mode setting
    const debugModeCheckbox = document.getElementById('fastramp-debug-mode');
    if (debugModeCheckbox) {
      debugModeCheckbox.checked = result.debugMode === true;
    }
  });

  // Save API key
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', async () => {
      const apiKey = geminiApiKeyInput.value.trim();

      if (!apiKey) {
        showApiKeyStatus('❌ Please enter an API key', 'error');
        return;
      }

      if (!apiKey.startsWith('AIza')) {
        showApiKeyStatus('⚠️ API key should start with "AIza"', 'warning');
        return;
      }

      // Save to sync storage (syncs across devices)
      await chrome.storage.sync.set({ geminiApiKey: apiKey });
      showApiKeyStatus('✅ API key saved to sync storage!', 'success');

      console.log('✅ Gemini API key saved to sync storage');
    });
  }

  // Test API key
  if (testApiKeyBtn) {
    testApiKeyBtn.addEventListener('click', async () => {
      const apiKey = geminiApiKeyInput.value.trim();

      if (!apiKey) {
        showApiKeyStatus('❌ Please enter an API key first', 'error');
        return;
      }

      showApiKeyStatus('⏳ Testing API key...', 'info');
      testApiKeyBtn.disabled = true;
      testApiKeyBtn.textContent = 'Testing...';

      try {
        // Test with a simple embedding request
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=' + apiKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text: 'test' }] }
          })
        });

        if (response.ok) {
          showApiKeyStatus('✅ API key is valid and working!', 'success');
          // Auto-save to sync storage if valid
          await chrome.storage.sync.set({ geminiApiKey: apiKey });
        } else {
          const error = await response.text();
          showApiKeyStatus('❌ Invalid API key or quota exceeded', 'error');
          console.error('API test failed:', error);
        }
      } catch (error) {
        showApiKeyStatus('❌ Test failed: ' + error.message, 'error');
        console.error('API test error:', error);
      } finally {
        testApiKeyBtn.disabled = false;
        testApiKeyBtn.textContent = 'Test Key';
      }
    });
  }

  // Show API key status message
  function showApiKeyStatus(message, type) {
    if (!apiKeyStatusDiv) return;

    const colors = {
      success: { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
      error: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
      warning: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
      info: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' }
    };

    const color = colors[type] || colors.info;

    apiKeyStatusDiv.style.display = 'block';
    apiKeyStatusDiv.style.background = color.bg;
    apiKeyStatusDiv.style.border = `1px solid ${color.border}`;
    apiKeyStatusDiv.style.color = color.text;
    apiKeyStatusDiv.textContent = message;
  }

  // Enter key to save
  if (geminiApiKeyInput) {
    geminiApiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && saveApiKeyBtn) {
        saveApiKeyBtn.click();
      }
    });
  }

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPanelOpen) {
      closePanel();
    }
  });

  // Section expansion
  const instructionsHeader = document.getElementById('fastramp-instructions-header');
  const instructionsContent = document.getElementById('fastramp-instructions-content');
  const instructionsIcon = document.getElementById('fastramp-instructions-icon');

  instructionsHeader.addEventListener('click', () => {
    instructionsContent.classList.toggle('fastramp-expanded');
    instructionsIcon.classList.toggle('fastramp-expanded');
  });

  const knowledgeHeader = document.getElementById('fastramp-knowledge-header');
  const knowledgeContent = document.getElementById('fastramp-knowledge-content');
  const knowledgeIcon = document.getElementById('fastramp-knowledge-icon');

  knowledgeHeader.addEventListener('click', () => {
    knowledgeContent.classList.toggle('fastramp-expanded');
    knowledgeIcon.classList.toggle('fastramp-expanded');
  });

  // Results section expansion
  const resultsHeader = document.getElementById('fastramp-results-header');
  const resultsContent = document.getElementById('fastramp-results-content');
  const resultsIcon = document.getElementById('fastramp-results-icon');

  if (resultsHeader) {
    resultsHeader.addEventListener('click', () => {
      resultsContent.classList.toggle('fastramp-expanded');
      resultsIcon.classList.toggle('fastramp-expanded');
    });
  }

  // Progress Bar Management
  const progressSection = document.getElementById('fastramp-progress-section');
  const resultsSection = document.getElementById('fastramp-results-section');

  function showProgress() {
    progressSection.style.display = 'block';
    resultsSection.style.display = 'none';
    resetAllStages();
  }

  function hideProgress() {
    progressSection.style.display = 'none';
  }

  function resetAllStages() {
    const stages = ['scanning', 'analyzing', 'embedding', 'matching', 'filling', 'complete'];
    stages.forEach(stage => {
      const stageEl = document.getElementById(`stage-${stage}`);
      const icon = stageEl.querySelector('.fastramp-stage-icon');
      icon.textContent = '⏳';
      stageEl.classList.remove('completed', 'active', 'error');
    });
  }

  function updateStage(stageName, status = 'active') {
    const stageEl = document.getElementById(`stage-${stageName}`);
    const icon = stageEl.querySelector('.fastramp-stage-icon');

    stageEl.classList.remove('completed', 'active', 'error');

    if (status === 'active') {
      stageEl.classList.add('active');
      icon.textContent = '⏳';
    } else if (status === 'completed') {
      stageEl.classList.add('completed');
      icon.textContent = '✅';
    } else if (status === 'error') {
      stageEl.classList.add('error');
      icon.textContent = '❌';
    }
  }

  function showResults(analysisData, fillData) {
    resultsSection.style.display = 'block';

    // Get detected fields array from analysisData
    const detectedFields = analysisData?.detectedFields || [];
    const fieldCount = detectedFields.length;

    // Count missing fields (fields without values)
    const missingFieldsRaw = detectedFields.filter(field => {
      const fieldLabel = field.label || field.id || 'Unnamed';
      const wasFilled = fillData?.fields?.[fieldLabel]?.filled || false;
      const hasValue = field.suggestedValue && field.suggestedValue !== 'NOT POSSIBLE TO ANSWER';
      return !wasFilled && !hasValue;
    });

    // DEDUPLICATION: Remove duplicate fields with same label (prevents asking same question twice)
    const seenLabels = new Set();
    const missingFields = missingFieldsRaw.filter(field => {
      const fieldLabel = field.label || field.id || 'Unnamed';
      const normalizedLabel = fieldLabel.toLowerCase().trim();

      if (seenLabels.has(normalizedLabel)) {
        console.log(`   ⚠️ Skipping duplicate missing field: "${fieldLabel}"`);
        return false; // Skip duplicate
      }

      seenLabels.add(normalizedLabel);
      return true;
    });

    const missingCount = missingFields.length;

    // Update summary values
    document.getElementById('result-forms-count').textContent = '1'; // Always 1 form on the page
    document.getElementById('result-fields-count').textContent = fieldCount;
    document.getElementById('result-filled-count').textContent = fillData?.filledCount || 0;

    const successRate = fieldCount > 0
      ? Math.round((fillData?.filledCount || 0) / fieldCount * 100)
      : 0;
    document.getElementById('result-success-rate').textContent = `${successRate}%`;

    // Store missing fields and analysis for voice agent
    window.fastRampMissingFields = missingFields;
    window.fastRampLastAnalysis = analysisData;

    // Update voice badge with missing fields count
    const voiceBadge = document.getElementById('fastramp-voice-badge');
    if (missingCount > 0) {
      voiceBadge.textContent = missingCount;
      voiceBadge.style.display = 'inline-block';
    } else {
      voiceBadge.style.display = 'none';
    }

    // Auto-trigger voice chat if there are missing fields
    if (missingCount > 0) {
      console.log(`🎤 ${missingCount} fields are missing values - triggering voice chat...`);

      // Show notification
      showNotification(`📢 ${missingCount} fields need your input. Starting voice chat...`, 'info');

      // Wait 2 seconds then trigger voice chat
      setTimeout(() => {
        triggerVoiceAssistantForMissingFields(missingFields);
      }, 2000);
    }

    // Update fields list
    const fieldsList = document.getElementById('results-fields-list');
    fieldsList.innerHTML = '';

    if (detectedFields && Array.isArray(detectedFields) && detectedFields.length > 0) {
      detectedFields.forEach((field, index) => {
        // Check if this field was filled by looking in fillData.fields
        // Use field.label as the key (matches how we store in fillData.fields)
        const fieldLabel = field.label || field.id || 'Unnamed';
        const wasFilled = fillData?.fields?.[fieldLabel]?.filled || false;
        const filledValue = fillData?.fields?.[fieldLabel]?.value || field.suggestedValue || '';

        const fieldItem = document.createElement('div');
        fieldItem.className = 'fastramp-field-item';

        // Show field status more clearly
        let statusBadge = '';
        if (wasFilled) {
          statusBadge = '<span class="fastramp-field-status" style="color: #10b981;">✅ Filled</span>';
        } else if (field.suggestedValue && field.suggestedValue !== 'NOT POSSIBLE TO ANSWER') {
          statusBadge = '<span class="fastramp-field-status" style="color: #3b82f6;">📝 Has Value</span>';
        } else {
          statusBadge = '<span class="fastramp-field-status" style="color: #f59e0b;">⚠️ No Value</span>';
        }

        // Format: "1. First name (text) ✅ Filled"
        // Get ACTUAL field type from DOM, not AI's guess
        let fieldType = field.type || 'text';

        // Try to get actual type from the DOM element
        try {
          const element = document.querySelector(field.selector);
          if (element) {
            if (element.tagName === 'TEXTAREA') {
              fieldType = 'textarea';
            } else if (element.tagName === 'SELECT') {
              fieldType = 'select';
            } else if (element.getAttribute('role') === 'textbox') {
              fieldType = 'text';
            } else if (element.getAttribute('role') === 'radiogroup') {
              fieldType = 'radio';
            } else if (element.getAttribute('role') === 'checkbox') {
              fieldType = 'checkbox';
            } else if (element.type && element.type !== 'hidden') {
              fieldType = element.type;
            } else if (element.type === 'hidden') {
              // For hidden inputs, check if there's a visible associated element
              fieldType = 'text'; // Default to text for Google Forms
            }
          }
        } catch (e) {
          // Keep AI's type if DOM check fails
        }

        const fieldNumber = index + 1;
        fieldItem.innerHTML = `
          <span class="fastramp-field-number" style="color: #6b7280; font-weight: 600; margin-right: 8px;">${fieldNumber}.</span>
          <span class="fastramp-field-name" style="flex: 1;">${fieldLabel}</span>
          <span class="fastramp-field-type" style="background: #e5e7eb; color: #374151; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; margin: 0 8px;">(${fieldType})</span>
          ${statusBadge}
        `;

        // Add tooltip with filled value if available
        if (filledValue && filledValue !== 'NOT POSSIBLE TO ANSWER') {
          fieldItem.title = `Value: ${filledValue.substring(0, 50)}${filledValue.length > 50 ? '...' : ''}`;
        } else {
          fieldItem.title = 'No value found in knowledge base';
        }

        fieldsList.appendChild(fieldItem);
      });
    } else {
      fieldsList.innerHTML = '<div class="fastramp-no-fields">No fields detected</div>';
    }
  }

  // File upload
  const chooseFilesBtn = document.getElementById('fastramp-choose-files');
  const fileInput = document.getElementById('fastramp-file-input');
  const filesList = document.getElementById('fastramp-files-list');
  const kbStatus = document.getElementById('fastramp-kb-status');
  const chatMessages = document.getElementById('fastramp-chat-messages');
  const chatInput = document.getElementById('fastramp-chat-input');
  const chatSendBtn = document.getElementById('fastramp-chat-send');
  
  let uploadedFiles = [];
  let embeddedDocuments = [];

  chooseFilesBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      if (!uploadedFiles.find(f => f.name === file.name)) {
        uploadedFiles.push(file);
        addFileToList(file);
        
        // Process and embed the file
        console.log(`📄 Processing file: ${file.name}`);
        await processAndEmbedFile(file);
      }
    }
    
    updateKBStatus();
    fileInput.value = '';
  });

  function addFileToList(file, isLinkedIn = false) {
    const fileItem = document.createElement('div');
    fileItem.className = 'fastramp-file-item';
    const icon = isLinkedIn ? '💼' : '📄';
    fileItem.innerHTML = `
      <span class="fastramp-file-name">${icon} ${file.name}</span>
      <button class="fastramp-remove-btn" data-filename="${file.name}">Remove</button>
    `;
    
    fileItem.querySelector('.fastramp-remove-btn').addEventListener('click', async (e) => {
      const filename = e.target.getAttribute('data-filename');
      console.log(`🗑️ Removing ${filename} from knowledge base...`);

      // Remove from UI arrays
      uploadedFiles = uploadedFiles.filter(f => f.name !== filename);
      embeddedDocuments = embeddedDocuments.filter(doc => doc.fileName !== filename);

      // Remove from storage via background script (respects local/cloud mode)
      chrome.runtime.sendMessage({ action: 'deleteEmbeddings', fileName: filename }, (result) => {
        if (result.success) {
          console.log(`✅ Removed ${filename} from ${result.mode} storage`);
        } else {
          console.error(`❌ Failed to remove ${filename}:`, result.error);
        }
      });

      // Disable chat if no documents left
      if (embeddedDocuments.length === 0) {
        chatInput.disabled = true;
        chatSendBtn.disabled = true;
        chatInput.placeholder = "Upload documents first...";
        chatMessages.innerHTML = '<div class="fastramp-chat-message system">Upload documents to query them using AI</div>';
      }

      // Remove from UI
      fileItem.remove();
      updateKBStatus();
    });
    
    filesList.appendChild(fileItem);
  }

  function updateKBStatus() {
    const totalFiles = uploadedFiles.length;
    console.log(`🔍 updateKBStatus called: ${totalFiles} files in uploadedFiles array`);
    if (totalFiles === 0) {
      kbStatus.textContent = '📂 No documents uploaded yet - Upload PDFs or text files to fill forms';
      kbStatus.style.color = '#6b7280'; // Gray color for empty state
    } else {
      kbStatus.textContent = `✅ ${totalFiles} file${totalFiles !== 1 ? 's' : ''} in knowledge base`;
      kbStatus.style.color = '#4CAF50'; // Green color when files exist
    }
  }

  function showSuccessMessage(message) {
    const successMessage = document.getElementById('fastramp-success');
    const successText = document.getElementById('fastramp-success-text');
    successText.textContent = message;
    successMessage.style.display = 'flex';

    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 5000);
  }

  // ============================================================================
  // LINKEDIN IMPORT FUNCTIONALITY
  // ============================================================================

  // LinkedIn Import Event Listener
  const linkedinImportBtn = document.getElementById('fastramp-linkedin-import-btn');
  const linkedinUrlInput = document.getElementById('fastramp-linkedin-url');

  linkedinImportBtn.addEventListener('click', async () => {
    const linkedinUrl = linkedinUrlInput.value.trim();

    if (!linkedinUrl) {
      showNotification('⚠️ Please enter a LinkedIn profile URL', 'error');
      return;
    }

    // Validate LinkedIn URL format
    if (!linkedinUrl.includes('linkedin.com/in/')) {
      showNotification('⚠️ Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/your-name)', 'error');
      return;
    }

    console.log('💼 Importing LinkedIn resume from:', linkedinUrl);
    linkedinImportBtn.disabled = true;
    linkedinImportBtn.textContent = 'Importing...';

    showNotification('💼 Importing LinkedIn resume...', 'info');

    try {
      await importLinkedInResume(linkedinUrl);
      linkedinUrlInput.value = ''; // Clear input after success
    } catch (error) {
      console.error('❌ LinkedIn import failed:', error);
      showNotification(`❌ Failed to import: ${error.message}`, 'error');
    } finally {
      linkedinImportBtn.disabled = false;
      linkedinImportBtn.textContent = 'Import Resume';
    }
  });

  // Import LinkedIn resume function
  async function importLinkedInResume(linkedinUrl) {
    console.log('💼 ========== IMPORTING LINKEDIN RESUME ==========');
    console.log('📍 URL:', linkedinUrl);

    try {
      // 🗑️ STEP 1: Delete ONLY old LinkedIn imports (not all documents)
      console.log('🗑️ Checking for old LinkedIn resume to replace...');

      // Get document metadata to find old LinkedIn documents
      const metaStorage = await chrome.storage.sync.get(['documentMetadata']);
      const metadata = metaStorage.documentMetadata || [];

      // Find old LinkedIn documents
      const oldLinkedInDocs = metadata.filter(doc => doc.fileName && doc.fileName.startsWith('LinkedIn_'));

      if (oldLinkedInDocs.length > 0) {
        console.log(`🗑️ Found ${oldLinkedInDocs.length} old LinkedIn document(s) - will be replaced`);

        // Delete each old LinkedIn document via background script (respects local/cloud mode)
        for (const doc of oldLinkedInDocs) {
          await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'deleteEmbeddings', fileName: doc.fileName }, (result) => {
              if (result.success) {
                console.log(`   ✅ Deleted ${doc.fileName} from ${result.mode} storage`);
              } else {
                console.warn(`   ⚠️ Failed to delete ${doc.fileName}:`, result.error);
              }
              resolve();
            });
          });
        }

        // Remove from UI
        uploadedFiles = uploadedFiles.filter(f => !f.name.startsWith('LinkedIn_'));
        embeddedDocuments = embeddedDocuments.filter(doc => !doc.fileName.startsWith('LinkedIn_'));

        // Remove from files list UI
        const fileItems = filesList.querySelectorAll('.fastramp-file-item');
        fileItems.forEach(item => {
          const filenameElement = item.querySelector('.fastramp-file-name');
          const filename = filenameElement.textContent.replace('💼 ', '').replace('📄 ', '');
          if (filename.startsWith('LinkedIn_')) {
            item.remove();
          }
        });

        console.log(`✅ Removed ${oldLinkedInDocs.length} old LinkedIn document(s)`);
      } else {
        console.log('ℹ️ No old LinkedIn resume found - this will be a fresh import');
      }

      // STEP 2: Call Cloud Function (simple proxy to Toolhouse)
      const agentUrl = 'https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/scrape-linkedin';
      console.log('📡 Calling Toolhouse via Cloud Function...');

      // Build the message to send to the agent
      const message = `Please scrape my full LinkedIn profile from ${linkedinUrl}. Return ONLY the JSON data with no additional text before or after.`;

      const requestBody = {
        message: message
      };

      console.log('📤 Sending request:', requestBody);

      const response = await fetch(agentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Toolhouse API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📥 Received response from Toolhouse:', data);

      // Parse LinkedIn data from response
      let resumeData;

      // CASE 1: Response is already a parsed LinkedIn object (has profile_url, name, etc.)
      if (data.profile_url || data.name || data.headline) {
        console.log('✅ Response is already parsed LinkedIn data (direct object)');
        resumeData = data;
      }
      // CASE 2: Response has data wrapped in response.message or message (string format)
      else if (data.response && data.response.message) {
        console.log('📝 Extracting from response.message...');
        const fullResponse = data.response.message;
        resumeData = parseLinkedInFromString(fullResponse);
      } else if (data.message) {
        console.log('📝 Extracting from message...');
        const fullResponse = data.message;
        resumeData = parseLinkedInFromString(fullResponse);
      } else {
        console.error('❌ Unexpected response format:', data);
        throw new Error('Unexpected response format from Toolhouse agent');
      }

      console.log('✅ Parsed LinkedIn data:', resumeData);

      // Helper function to parse LinkedIn data from string
      function parseLinkedInFromString(str) {
        try {
          // Try to parse directly first
          return JSON.parse(str);
        } catch (e) {
          // If that fails, try to extract JSON from markdown code blocks
          const jsonMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
          } else {
            // Try to find JSON object in the text
            const objectMatch = str.match(/\{[\s\S]*\}/);
            if (objectMatch) {
              return JSON.parse(objectMatch[0]);
            } else {
              throw new Error(`Could not parse JSON from string: ${str.substring(0, 200)}...`);
            }
          }
        }
      }

      // STEP 3: Convert LinkedIn JSON to text format
      const resumeText = convertLinkedInToText(resumeData);

      console.log('📝 ========== RESUME TEXT FOR EMBEDDINGS ==========');
      console.log(resumeText);
      console.log('='.repeat(60));
      console.log(`📊 Text length: ${resumeText.length} characters`);
      console.log(`📊 Text preview (first 500 chars):`);
      console.log(resumeText.substring(0, 500) + '...');
      console.log('='.repeat(60));

      // STEP 4: Create a pseudo-file object with the resume text
      const fileName = `LinkedIn_${resumeData.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Resume'}.txt`;
      const textBlob = new Blob([resumeText], { type: 'text/plain' });
      const linkedinFile = new File([textBlob], fileName, { type: 'text/plain' });

      console.log('📄 Created file object:', {
        name: fileName,
        size: linkedinFile.size,
        type: linkedinFile.type
      });

      // STEP 5: Add to files list
      uploadedFiles.push(linkedinFile);
      addFileToList(linkedinFile, true); // Pass true to indicate it's a LinkedIn import

      // STEP 6: Process and embed the file
      console.log('🔄 Sending resume text to embedding function...');
      showNotification('📄 Generating embeddings for LinkedIn resume...', 'info');
      await processAndEmbedFile(linkedinFile);
      console.log('✅ Embedding complete!');

      showNotification(`✅ LinkedIn resume imported successfully! Added to knowledge base for ${resumeData.name}`, 'success');

      // Update KB status immediately after successful LinkedIn import
      updateKBStatus();

    } catch (error) {
      console.error('❌ LinkedIn import error:', error);
      throw error;
    }
  }

  // Convert LinkedIn JSON to readable text format
  function convertLinkedInToText(data) {
    const sections = [];

    // Header
    sections.push('='.repeat(60));
    sections.push(`RESUME - ${data.name || 'N/A'}`);
    sections.push('='.repeat(60));
    sections.push('');

    // Profile Info
    if (data.headline) {
      sections.push(`HEADLINE:`);
      sections.push(data.headline);
      sections.push('');
    }

    if (data.location) {
      sections.push(`LOCATION: ${data.location}`);
      sections.push('');
    }

    if (data.profile_url) {
      sections.push(`LINKEDIN: ${data.profile_url}`);
      sections.push('');
    }

    // About
    if (data.about) {
      sections.push(`ABOUT:`);
      sections.push(data.about);
      sections.push('');
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      sections.push(`SKILLS:`);
      data.skills.forEach(skill => {
        sections.push(`  • ${skill}`);
      });
      sections.push('');
    }

    // Experience
    if (data.experience && data.experience.length > 0) {
      sections.push(`WORK EXPERIENCE:`);
      sections.push('');
      data.experience.forEach((exp, index) => {
        sections.push(`${index + 1}. ${exp.title || 'N/A'}`);
        sections.push(`   Company: ${exp.company || 'N/A'}`);
        if (exp.location) sections.push(`   Location: ${exp.location}`);
        if (exp.date_range) sections.push(`   Duration: ${exp.date_range}`);
        if (exp.description) {
          sections.push(`   Description:`);
          sections.push(`   ${exp.description}`);
        }
        sections.push('');
      });
    }

    // Education
    if (data.education && data.education.length > 0) {
      sections.push(`EDUCATION:`);
      sections.push('');
      data.education.forEach((edu, index) => {
        sections.push(`${index + 1}. ${edu.degree || edu.field || 'N/A'}`);
        sections.push(`   School: ${edu.school || 'N/A'}`);
        if (edu.field && edu.degree) sections.push(`   Field: ${edu.field}`);
        if (edu.date_range) sections.push(`   Years: ${edu.date_range}`);
        sections.push('');
      });
    }

    // Languages
    if (data.languages && data.languages.length > 0) {
      sections.push(`LANGUAGES:`);
      data.languages.forEach(lang => {
        sections.push(`  • ${lang.language}: ${lang.proficiency || 'N/A'}`);
      });
      sections.push('');
    }

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
      sections.push(`CERTIFICATIONS:`);
      data.certifications.forEach(cert => {
        sections.push(`  • ${cert.name} ${cert.issuer ? `(${cert.issuer})` : ''} ${cert.year ? `- ${cert.year}` : ''}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  // ============================================================================
  // END LINKEDIN IMPORT FUNCTIONALITY
  // ============================================================================

  // Embedding progress functions
  function showEmbeddingProgress(totalChunks, fileName = '', characterCount = 0) {
    const progressContainer = document.getElementById('fastramp-embedding-progress');
    const progressText = document.getElementById('fastramp-progress-text');
    const progressFill = document.getElementById('fastramp-progress-fill');
    const progressIcon = document.getElementById('fastramp-progress-icon');

    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';

    // Add spinning animation to icon
    if (progressIcon) {
      progressIcon.style.display = 'inline-block';
      progressIcon.style.animation = 'spin 1s linear infinite';
    }

    // Show appropriate message based on stage
    if (totalChunks === 0 && characterCount === 0 && fileName) {
      // Initial stage - PDF extraction
      progressText.textContent = `📄 Extracting text from ${fileName}...`;
    } else if (fileName && characterCount > 0) {
      // After extraction - show character count
      progressText.textContent = `✅ Extracted ${characterCount.toLocaleString()} characters from ${fileName}`;
    } else {
      // Processing chunks
      progressText.textContent = `Processing chunk 0/${totalChunks}...`;
    }
  }

  function updateEmbeddingProgress(current, total, fileName) {
    const progressText = document.getElementById('fastramp-progress-text');
    const progressFill = document.getElementById('fastramp-progress-fill');

    const percentage = Math.round((current / total) * 100);
    progressFill.style.width = `${percentage}%`;

    // More detailed status messages based on progress
    let statusMessage = '';
    if (percentage === 0) {
      statusMessage = `Starting to process ${fileName}...`;
    } else if (percentage < 30) {
      statusMessage = `Generating embeddings for ${fileName}... ${percentage}%`;
    } else if (percentage < 60) {
      statusMessage = `Processing chunks ${current}/${total}... ${percentage}%`;
    } else if (percentage < 90) {
      statusMessage = `Saving to Chrome Storage... ${percentage}%`;
    } else if (percentage < 100) {
      statusMessage = `Finalizing ${fileName}... ${percentage}%`;
    } else {
      statusMessage = `✅ Successfully processed ${total} chunks from ${fileName}`;
    }

    progressText.textContent = statusMessage;
  }

  function hideEmbeddingProgress() {
    const progressContainer = document.getElementById('fastramp-embedding-progress');
    const progressIcon = document.getElementById('fastramp-progress-icon');

    // Stop spinning animation
    if (progressIcon) {
      progressIcon.style.animation = 'none';
    }

    progressContainer.style.display = 'none';
  }

  // Process and embed file content
  async function processAndEmbedFile(file) {
    let extractionProgressInterval = null;

    try {
      console.log(`🔄 Starting to process ${file.name}...`);

      // SHOW PROGRESS BAR IMMEDIATELY - before PDF extraction
      showEmbeddingProgress(0, file.name, 0);

      // Simulate progress during PDF extraction (which can take 5-15 seconds)
      extractionProgressInterval = setInterval(() => {
        const progressFill = document.getElementById('fastramp-progress-fill');
        if (progressFill) {
          const currentWidth = parseFloat(progressFill.style.width) || 0;
          // Slowly increase to 10% during extraction
          if (currentWidth < 10) {
            progressFill.style.width = `${Math.min(currentWidth + 1, 10)}%`;
          }
        }
      }, 500); // Update every 500ms

      // Read file content (handles PDF via backend API)
      const text = await readFileContent(file);
      clearInterval(extractionProgressInterval); // Stop extraction progress
      extractionProgressInterval = null;

      console.log(`📖 Extracted ${text.length} characters from ${file.name}`);

      // Chunk the text for progress estimation
      const chunks = chunkText(text, 500); // Gemini can handle 500 char chunks
      console.log(`✂️ Will split into ${chunks.length} chunks`);

      // Update progress bar with estimated chunk count
      showEmbeddingProgress(chunks.length, file.name, text.length);

      // Upload document - create embeddings and save to Chrome Storage
      // Note: We pass the full text, background script will do the chunking
      console.log('🚀 Creating embeddings with Gemini...');
      console.log(`   File: ${file.name}`);
      console.log(`   Text length: ${text.length} characters`);

      const uploadResult = await uploadDocument(file.name, text);

      // Hide progress bar when done
      hideEmbeddingProgress();

      console.log('📦 Upload result received:', uploadResult);

      if (!uploadResult.success) {
        showNotification(`❌ Failed to process ${file.name}. ${uploadResult.error}`, 'error');
        console.error(`❌ Upload failed:`, uploadResult);
        return;
      }

      // Check if any chunks were actually embedded
      if (uploadResult.chunksProcessed === 0 || uploadResult.chunksEmbedded === 0) {
        console.error('⚠️ WARNING: No chunks were embedded!');
        console.error('   This means the Gemini Embedding API failed for all chunks');
        console.error('   Check background console for API errors');
        showNotification(`⚠️ ${file.name} uploaded but NO embeddings created. Check API key and background console.`, 'error');
        return;
      }

      // Check if this is an overwrite (same filename re-uploaded)
      if (uploadResult.overwrite) {
        console.log('✏️ Document overwritten:', {
          documentId: uploadResult.documentId,
          fileName: file.name,
          message: uploadResult.message
        });

        showNotification(`✏️ ${uploadResult.message || `Updated ${file.name}`}`, 'info');

        // Update existing document in list
        const existingIndex = embeddedDocuments.findIndex(doc => doc.documentId === uploadResult.documentId);
        if (existingIndex !== -1) {
          embeddedDocuments[existingIndex] = {
            fileName: file.name,
            documentId: uploadResult.documentId,
            chunksCount: uploadResult.chunksProcessed,
            uploadedAt: Date.now(),
            storageKey: uploadResult.storageKey
          };
        } else {
          // Add if somehow not in list
          embeddedDocuments.push({
            fileName: file.name,
            documentId: uploadResult.documentId,
            chunksCount: uploadResult.chunksProcessed,
            uploadedAt: Date.now(),
            storageKey: uploadResult.storageKey
          });
        }

        // Enable chat
        if (embeddedDocuments.length > 0) {
          chatInput.disabled = false;
          chatSendBtn.disabled = false;
          chatInput.placeholder = "Ask a question about your documents...";
          updateChatMessage('Ready! Ask questions about your documents.', 'system');
        }

        return; // Skip the rest
      }

      // Check if this is a duplicate (different filename, same content)
      if (uploadResult.duplicate) {
        console.log('⚠️ Duplicate content detected:', {
          documentId: uploadResult.documentId,
          fileName: file.name,
          originalFileName: uploadResult.originalFileName,
          message: uploadResult.message
        });

        const originalFile = uploadResult.originalFileName || 'another file';
        showNotification(`ℹ️ ${file.name} has identical content to "${originalFile}" (duplicate skipped)`, 'info');

        // Don't add to list - it's truly a duplicate of existing content
        // The original filename is already in the knowledge base

        // Enable chat if we have documents
        if (embeddedDocuments.length > 0) {
          chatInput.disabled = false;
          chatSendBtn.disabled = false;
          chatInput.placeholder = "Ask a question about your documents...";
          updateChatMessage('Ready! Ask questions about your documents.', 'system');
        }

        return; // Skip the rest
      }

      console.log('✅ Document uploaded to Chrome Storage:', {
        documentId: uploadResult.documentId,
        chunksProcessed: uploadResult.chunksProcessed,
        newChunks: uploadResult.newChunks,
        duplicatesSkipped: uploadResult.duplicatesSkipped,
        storageEfficiency: uploadResult.storageEfficiency,
        isOverwrite: uploadResult.isOverwrite,
        storageName: 'chrome.storage.local',
        storageKey: uploadResult.storageKey
      });

      // Show appropriate message based on deduplication results
      if (uploadResult.isOverwrite) {
        // Scenario 1: Same filename - overwrite
        showNotification(
          `✏️ Updated "${file.name}" - ${uploadResult.newChunks} chunks replaced (was ${uploadResult.oldChunksCount})`,
          'info'
        );
      } else if (uploadResult.duplicatesSkipped > 0) {
        // Scenario 2: Different filename with duplicates
        showNotification(
          `✅ Uploaded "${file.name}" - ${uploadResult.newChunks} new chunks (${uploadResult.duplicatesSkipped} duplicates skipped, ${uploadResult.storageEfficiency})`,
          'success'
        );
      } else {
        // Fresh upload, no duplicates
        showNotification(
          `✅ Successfully uploaded ${uploadResult.chunksProcessed} chunks from ${file.name} to Chrome Storage`,
          'success'
        );
      }

      // Store document metadata in local memory (for UI display)
      embeddedDocuments.push({
        fileName: file.name,
        documentId: uploadResult.documentId,
        chunksCount: uploadResult.chunksProcessed,
        uploadedAt: Date.now(),
        storageKey: uploadResult.storageKey
      });

      // Cache document metadata in chrome.storage for persistence
      chrome.storage.local.get(['documentMetadata'], (result) => {
        let metadata = result.documentMetadata || [];
        if (!Array.isArray(metadata)) metadata = [];

        metadata.push({
          fileName: file.name,
          documentId: uploadResult.documentId,
          chunksProcessed: uploadResult.chunksProcessed,
          uploadedAt: Date.now(),
          storageKey: uploadResult.storageKey
        });

        chrome.storage.local.set({ documentMetadata: metadata }, () => {
          console.log('💾 Document metadata cached locally:', {
            totalDocuments: metadata.length,
            latestDocument: file.name
          });

          // Show console success message with deduplication info
          let message;
          if (uploadResult.isOverwrite) {
            message = `✏️ Updated ${file.name}: ${uploadResult.oldChunksCount} old → ${uploadResult.newChunks} new chunks`;
          } else if (uploadResult.duplicatesSkipped > 0) {
            message = `✅ Uploaded ${file.name}: ${uploadResult.newChunks} new chunks (${uploadResult.duplicatesSkipped} duplicates skipped)`;
          } else {
            message = `✅ Successfully uploaded ${uploadResult.chunksProcessed} chunks from ${file.name} to Chrome Storage`;
          }

          console.log(message);
          showSuccessMessage(message);

          // Update KB status immediately after successful embedding
          updateKBStatus();
        });
      });

      // Enable chat after successful upload
      chatInput.disabled = false;
      chatSendBtn.disabled = false;
      chatInput.placeholder = "Ask a question about your documents...";

      // Update chat message to show ready state
      const chatMessages = document.getElementById('fastramp-chat-messages');
      if (chatMessages) {
        chatMessages.innerHTML = '<div class="fastramp-chat-message system">✅ Ready! Ask questions about your documents.</div>';
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${file.name}:`, error);

      // Clean up extraction progress interval if it's still running
      if (extractionProgressInterval) {
        clearInterval(extractionProgressInterval);
      }

      hideEmbeddingProgress(); // Hide progress bar on error
      showNotification(`Failed to process ${file.name}: ${error.message}`, 'error');
    }
  }

  // Read file content
  async function readFileContent(file) {
    return new Promise(async (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const content = e.target.result;

        // For PDFs, use backend API extraction
        if (file.type === 'application/pdf') {
          try {
            console.log('📄 Extracting PDF via backend API...');

            // Convert ArrayBuffer to base64
            const base64 = btoa(
              new Uint8Array(content).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ''
              )
            );

            // Call backend extract-pdf endpoint
            const result = await new Promise((resolveMsg) => {
              chrome.runtime.sendMessage({
                action: 'extractPdfText',
                pdfData: base64,
                fileName: file.name
              }, resolveMsg);
            });

            if (result && result.success) {
              console.log(`✅ Extracted ${result.text.length} characters from PDF using ${result.extractionMethod}`);
              resolve(result.text);
            } else {
              console.error('❌ PDF extraction failed:', result?.error);
              reject(new Error(`PDF extraction failed: ${result?.error || 'Unknown error'}`));
            }
          } catch (error) {
            console.error('❌ PDF extraction error:', error);
            reject(error);
          }
          return;
        }

        // For text files, return content directly
        resolve(content);
      };

      reader.onerror = reject;

      // Read as ArrayBuffer for PDFs, text for others
      if (file.type === 'application/pdf') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  }

  // Extract text using PDF.js library
  async function extractTextWithPdfJs(arrayBuffer) {
    // Ensure PDF.js is loaded
    await ensurePdfJs();

    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library failed to load');
    }

    try {
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      console.log(`📄 PDF loaded: ${pdf.numPages} pages`);

      let fullText = '';

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine text items
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');

        fullText += pageText + '\n\n';
      }

      // Clean up the text
      fullText = fullText
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/\n\s*\n/g, '\n')  // Remove extra newlines
        .trim();

      console.log(`✅ Extracted ${fullText.length} characters from PDF`);
      return fullText;

    } catch (error) {
      console.error('❌ PDF.js extraction error:', error);
      throw error;
    }
  }

  // OLD METHOD - DEPRECATED (kept for reference, not used)
  function extractTextFromPDF_OLD(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let pdfContent = decoder.decode(bytes);

    // Method 1: Extract text between BT and ET markers (PDF text objects)
    const textObjects = [];
    const btEtPattern = /BT([\s\S]*?)ET/g;
    let match;
    
    while ((match = btEtPattern.exec(pdfContent)) !== null) {
      const textObj = match[1];
      // Extract text in parentheses or angle brackets
      const textMatches = textObj.match(/\(([^)]*)\)/g) || [];
      const hexMatches = textObj.match(/<([^>]*)>/g) || [];
      
      textMatches.forEach(t => {
        let decoded = t.slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, ' ')
          .replace(/\\t/g, ' ')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        
        // Handle octal escape sequences
        decoded = decoded.replace(/\\(\d{3})/g, (m, oct) => 
          String.fromCharCode(parseInt(oct, 8))
        );
        
        if (decoded.trim()) textObjects.push(decoded);
      });
      
      // Decode hex strings
      hexMatches.forEach(h => {
        const hex = h.slice(1, -1);
        let decoded = '';
        for (let i = 0; i < hex.length; i += 2) {
          const byte = parseInt(hex.substr(i, 2), 16);
          if (byte >= 32 && byte <= 126) {
            decoded += String.fromCharCode(byte);
          } else if (byte === 10 || byte === 13) {
            decoded += ' ';
          }
        }
        if (decoded.trim()) textObjects.push(decoded);
      });
    }
    
    // Method 2: Extract from streams (for compressed content)
    const streamPattern = /stream([\s\S]*?)endstream/g;
    const streams = [];
    
    while ((match = streamPattern.exec(pdfContent)) !== null) {
      const stream = match[1];
      // Extract readable ASCII text
      const readable = stream.match(/[\x20-\x7E]{10,}/g) || [];
      readable.forEach(text => {
        // Filter out code/data patterns
        if (!text.match(/^[\d\s.]+$/) && 
            !text.includes('<<') && 
            !text.includes('>>') &&
            !text.match(/^[A-F0-9]+$/)) {
          streams.push(text);
        }
      });
    }
    
    // Method 3: Direct text extraction for uncompressed PDFs
    const directText = [];
    const lines = pdfContent.split(/\r?\n/);
    
    for (const line of lines) {
      // Skip PDF commands and binary data
      if (line.match(/^%/) || line.match(/^\d+ \d+ obj/) || 
          line.match(/^endobj/) || line.match(/^xref/) ||
          line.match(/^trailer/) || line.match(/^startxref/)) {
        continue;
      }
      
      // Extract readable text
      const readable = line.match(/[\x20-\x7E]+/g) || [];
      readable.forEach(text => {
        if (text.length > 5 && !text.match(/^[\d\s.]+$/)) {
          directText.push(text);
        }
      });
    }
    
    // Combine all extracted text
    let allText = [...textObjects, ...streams, ...directText].join(' ');
    
    // Clean up
    allText = allText
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
      .trim();
    
    // Remove duplicates (sometimes PDF repeats text)
    const lines2 = allText.split('\n');
    const uniqueLines = [...new Set(lines2)];
    allText = uniqueLines.join('\n');
    
    console.log('📄 PDF Extraction Results:');
    console.log(`   - Text objects found: ${textObjects.length}`);
    console.log(`   - Stream text found: ${streams.length}`);
    console.log(`   - Direct text found: ${directText.length}`);
    console.log(`   - Total characters: ${allText.length}`);
    console.log('📄 Preview:', allText.substring(0, 500));
    
    return allText || 'Could not extract text from PDF. The file might be encrypted or use an unsupported format.';
  }

  // OCR fallback using Gemini Vision via background
  async function ocrPdfPages(arrayBuffer) {
    // Ensure PDF.js is available
    await ensurePdfJs();
    if (typeof pdfjsLib === 'undefined') {
      console.warn('PDF.js failed to load, OCR cannot proceed.');
      return '';
    }

    // Get Gemini API key
    const apiKey = await getGeminiKey();
    if (!apiKey) {
      showNotification('Gemini API key required for OCR. Please configure it in Settings.', 'error');
      return '';
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'geminiOCR', imageDataUrl: dataUrl, apiKey }, resolve);
      });
      if (result && result.success) {
        fullText += `\n\n${result.text}`;
      } else {
        console.error('OCR error:', result?.error);
      }
    }
    return fullText.trim();
  }

  // Dynamically load PDF.js from CDN into the page context
  async function ensurePdfJs() {
    if (typeof pdfjsLib !== 'undefined') return;
    await new Promise((resolve) => {
      const existing = document.querySelector('script[data-fastramp-pdfjs]');
      if (existing) {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', resolve);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.js';
      script.setAttribute('data-fastramp-pdfjs', '1');
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  // Chunk text for Gemini embeddings (up to 2048 tokens per request)
  function chunkText(text, chunkSize = 2000, overlap = 200) {
    const chunks = [];
    
    // First, try to split by paragraphs or double newlines
    let paragraphs = text.split(/\n\n+/);
    
    // If no paragraphs, split by sentences
    if (paragraphs.length <= 1) {
      paragraphs = text.match(/[^.!?]+[.!?]+/g) || [text];
    }
    
    let currentChunk = '';
    let previousChunk = '';
    
    for (const para of paragraphs) {
      // If adding this paragraph exceeds chunk size
      if ((currentChunk + para).length > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          // Keep last part for overlap
          const sentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [currentChunk];
          previousChunk = sentences.slice(-2).join(' ').substring(0, overlap);
          currentChunk = previousChunk + ' ' + para;
        } else {
          // Single paragraph too long, split it
          const words = para.split(' ');
          let tempChunk = previousChunk;
          
          for (const word of words) {
            if ((tempChunk + ' ' + word).length <= chunkSize) {
              tempChunk += ' ' + word;
            } else {
              chunks.push(tempChunk.trim());
              // Create overlap
              const lastWords = tempChunk.split(' ').slice(-20).join(' ');
              tempChunk = lastWords + ' ' + word;
            }
          }
          currentChunk = tempChunk;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }
    
    // Add the last chunk
    if (currentChunk && currentChunk.trim() !== previousChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Log chunking details
    console.log(`📝 Chunking: ${text.length} chars → ${chunks.length} chunks (avg ${Math.round(text.length / chunks.length)} chars/chunk)`);
    
    return chunks;
  }

  // Create embedding using Gemini API
  async function createEmbedding(text) {
    // Get API key from sync storage
    const storage = await chrome.storage.sync.get(['geminiApiKey']);
    const apiKey = storage.geminiApiKey;

    if (!apiKey) {
      console.error('Gemini API key not found. Please add it in Settings.');
      return null;
    }

    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'embedText',
        text: text,
        apiKey: apiKey
      }, resolve);
    });

    if (result && result.success) return result.embedding;
    console.error('Embedding error:', result?.error);
    return null;
  }

  // Upload document with chunks using Chrome AI + Gemini
  async function uploadDocument(fileName, content) {
    try {
      // Estimate chunks for progress (background will do actual chunking)
      const estimatedChunks = Math.ceil(content.length / 500);

      // Show initial progress
      updateEmbeddingProgress(0, estimatedChunks, fileName);

      // Simulate progress during upload for better UX
      let simulatedProgress = 0;
      const totalSteps = estimatedChunks;

      // Estimate time per chunk (based on typical embedding speed)
      const estimatedTimePerChunk = 1000; // 1 second per chunk
      const totalEstimatedTime = totalSteps * estimatedTimePerChunk;
      const updateInterval = 200; // Update every 200ms
      const progressIncrement = (100 / totalEstimatedTime) * updateInterval;

      // Start simulated progress updates
      const progressInterval = setInterval(() => {
        simulatedProgress += progressIncrement;

        // Cap at 90% - wait for actual response for final 10%
        if (simulatedProgress >= 90) {
          simulatedProgress = 90;
          clearInterval(progressInterval);
        }

        const currentChunk = Math.floor((simulatedProgress / 100) * totalSteps);
        updateEmbeddingProgress(currentChunk, totalSteps, fileName);
      }, updateInterval);

      // Make actual API call
      // Get API key from sync storage first
      const storage = await chrome.storage.sync.get(['geminiApiKey']);
      const apiKey = storage.geminiApiKey;

      if (!apiKey) {
        return {
          success: false,
          error: 'Gemini API key required. Please add your API key in settings.'
        };
      }

      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'embedDocument',
          fileName: fileName,
          content: content,
          apiKey: apiKey
        }, resolve);
      });

      // Stop simulated progress
      clearInterval(progressInterval);

      // Update to 100% when done
      if (result.success) {
        const actualChunks = result.chunksProcessed || estimatedChunks;
        updateEmbeddingProgress(actualChunks, actualChunks, fileName);
        // Keep at 100% for a moment so user sees completion
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return result || { success: false, error: 'No response from background script' };
    } catch (error) {
      console.error('Error uploading document:', error);
      return { success: false, error: error.message };
    }
  }

  // Update chat message
  function updateChatMessage(message, type = 'system') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `fastramp-chat-message ${type}`;
    messageDiv.textContent = message;
    
    // Clear system message if adding user/assistant message
    if (type !== 'system' && chatMessages.children.length === 1) {
      chatMessages.innerHTML = '';
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Handle chat input
  chatSendBtn.addEventListener('click', () => queryKnowledgeBase());
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') queryKnowledgeBase();
  });

  async function queryKnowledgeBase() {
    const query = chatInput.value.trim();
    if (!query) return;

    // Add user message
    updateChatMessage(query, 'user');
    chatInput.value = '';
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    try {
      console.log('🔍 Querying knowledge base with RAG (Retrieval-Augmented Generation)...');

      // STEP 1: Get knowledge base from storage (respects local/cloud mode)
      console.log('   Retrieving knowledge base via background script...');
      const storageResult = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getEmbeddings' }, resolve);
      });
      console.log('   Storage result:', storageResult);

      if (!storageResult.success) {
        throw new Error(storageResult.error || 'Failed to retrieve embeddings');
      }

      const knowledgeBase = storageResult.embeddings || [];
      console.log(`   Knowledge base array length: ${knowledgeBase.length} (from ${storageResult.mode} storage)`);

      if (knowledgeBase.length === 0) {
        console.warn('❌ Knowledge base is empty!');
        console.log('   Checking document metadata...');
        const metaStorage = await chrome.storage.local.get(['documentMetadata']);
        console.log('   Document metadata:', metaStorage);
        updateChatMessage("Please upload documents first before asking questions.", 'assistant');
        return;
      }

      console.log(`📚 Found ${knowledgeBase.length} chunks in knowledge base`);

      // Group chunks by document for better organization
      const documentMap = {};
      knowledgeBase.forEach(chunk => {
        if (!documentMap[chunk.source]) {
          documentMap[chunk.source] = {
            fileName: chunk.source,
            chunks: []
          };
        }
        documentMap[chunk.source].chunks.push(chunk);
      });

      const documents = Object.values(documentMap);
      console.log(`📚 Organized into ${documents.length} documents`);

      // STEP 2: Create embedding for the user's question
      console.log('🔢 Creating embedding for question...');
      const queryEmbedding = await createEmbedding(query);

      if (!queryEmbedding) {
        throw new Error('Failed to create embedding for question. Please check your Gemini API key.');
      }

      console.log('✅ Question embedding created');

      // STEP 3: Find most relevant chunks using cosine similarity
      console.log('🔍 Searching for relevant content...');
      const relevantChunks = findSimilarChunks(queryEmbedding, documents, 5); // Top 5 chunks

      if (relevantChunks.length === 0) {
        updateChatMessage("I couldn't find any relevant information in your documents to answer that question.", 'assistant');
        return;
      }

      console.log(`✅ Found ${relevantChunks.length} relevant chunks:`);
      relevantChunks.forEach((chunk, i) => {
        console.log(`   ${i + 1}. Similarity: ${(chunk.similarity * 100).toFixed(1)}% - "${chunk.text.substring(0, 50)}..."`);
      });

      // STEP 4: Build context from relevant chunks
      const context = relevantChunks
        .map((chunk) => chunk.text)
        .join('\n\n');

      console.log(`📄 Context built: ${context.length} characters from ${relevantChunks.length} chunks`);

      // STEP 5: Query Chrome AI with context
      console.log('🤖 Querying Chrome AI with context...');
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'queryWithChromeAI',
          prompt: `Based on the following information from the user's documents, answer their question naturally.

CONTEXT FROM USER'S DOCUMENTS:
${context}

QUESTION: ${query}

INSTRUCTIONS:
- Answer based ONLY on the information provided in the context above
- Write in a natural, conversational style as if you're explaining to a friend
- Do NOT use phrases like "According to Source 1" or "Source 2 says" - just state the information naturally
- If the context doesn't contain relevant information, say "I don't have enough information in your documents to answer that"
- Keep your answer concise but complete
- Present the information as a cohesive narrative, not as a list of citations`,
          context: "You are a helpful AI assistant that answers questions based on the user's personal knowledge base. Answer naturally and conversationally, without citing sources. Simply synthesize the information into a natural response."
        }, resolve);
      });

      if (!result.success) {
        console.error('❌ Query failed:', result.error);
        throw new Error(result.error || 'Query failed');
      }

      const response = result.response; // Note: Changed from result.answer to result.response

      console.log('✅ Response received from Chrome AI');

      // Add assistant message
      updateChatMessage(response, 'assistant');

    } catch (error) {
      // Log technical details to console for debugging
      console.error('❌ Query error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });

      // Show user-friendly error message in chat
      let userMessage = '';
      if (error.message.includes('ValidationException') || error.message.includes('Malformed')) {
        userMessage = "I'm having trouble processing your question right now. The service is being updated. Please try again in a moment.";
      } else if (error.message.includes('500')) {
        userMessage = "The AI service encountered an error. Please try again in a moment.";
      } else if (error.message.includes('No documents')) {
        userMessage = "Please upload documents first before asking questions.";
      } else {
        userMessage = "Sorry, I couldn't process your question. Please try rephrasing it or check that your documents are uploaded.";
      }

      updateChatMessage(userMessage, 'assistant');
    } finally {
      chatInput.disabled = false;
      chatSendBtn.disabled = false;
      chatInput.focus();
    }
  }

  // Find similar chunks using cosine similarity
  function findSimilarChunks(queryEmbedding, documents, topK = 20) {  // Default to 20 chunks for GPT-5
    const similarities = [];
    
    for (const doc of documents) {
      for (const chunk of doc.chunks) {
        const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
        similarities.push({
          text: chunk.text,
          source: chunk.source,
          similarity: similarity
        });
      }
    }
    
    // Sort by similarity and return top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`📊 Search results: Top ${topK} chunks with similarities:`, 
      similarities.slice(0, topK).map(s => s.similarity.toFixed(3)));
    
    return similarities.slice(0, topK);
  }

  // Calculate cosine similarity
  function cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // Generate response using Gemini
  async function generateResponseGemini(query, relevantChunks) {
    const apiKey = await getGeminiKey();
    if (!apiKey) {
      showNotification('Please configure your Gemini API key first', 'error');
      throw new Error('Missing Gemini API key');
    }
    const context = relevantChunks.map(c => c.text).join('\n\n---\n\n');
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'geminiGenerate', context, query, apiKey }, resolve);
    });
    if (result && result.success) return result.response;
    throw new Error(result?.error || 'Unknown Gemini generation error');
  }

  // Main action button - Smart fill (analyze + fill in one click)
  const smartFillBtn = document.getElementById('fastramp-smart-fill');
  const voiceSection = document.getElementById('fastramp-voice');

  // MAIN BUTTON: Analyze and Fill in Same Tab using Chrome AI
  smartFillBtn.addEventListener('click', async () => {
    const instructions = document.getElementById('fastramp-instructions-text').value;

    // Disable button during processing
    smartFillBtn.disabled = true;
    smartFillBtn.querySelector('.fastramp-label').textContent = 'Processing...';

    // Show progress bar and reset stages
    showProgress();

    console.log('🚀 === STARTING SMART FORM FILL (ANALYZE + FILL) ===');
    console.log('📋 Stage 1: Scanning page for form elements...');
    console.log('🔎 Looking for: <form>, <input>, <select>, <textarea> elements');
    console.log('📝 Custom instructions:', instructions || 'None provided');
    console.log('📚 Knowledge base files:', uploadedFiles.length > 0 ? uploadedFiles.map(f => f.name) : 'No files uploaded');

    let analysisData = null;
    let fillData = null;
    let usingDesktopAgent = false;

    try {
      // Using same-tab filling with Chrome AI
      console.log('\n⚡ === USING CHROME AI FILLING MODE ===');
      console.log('✨ Chrome AI will analyze the form and fill it directly in this tab');
      console.log('🎯 Best for hackathon demos - fast and reliable!');

      // STEP 1: Scanning
      updateStage('scanning', 'active');
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay for visual feedback

      // STEP 2: AI-Powered Form Analysis with Chrome AI (Gemini Nano)
      updateStage('scanning', 'completed');
      updateStage('analyzing', 'active');
      console.log('\n🤖 STEP 2: AI-Powered Form Analysis with Chrome AI...');
      console.log('📄 Sending page HTML to Gemini Nano');
      console.log('🧠 AI will:');
      console.log('   1. Detect all form fields (traditional + ARIA)');
      console.log('   2. Understand field purpose and context');
      console.log('   3. Search knowledge base for relevant values');
      console.log('   4. Return smart field mappings');

      // Get API key for hybrid analysis (needed for large forms)
      const storage = await chrome.storage.sync.get(['geminiApiKey']);
      const apiKey = storage.geminiApiKey;

      // Get knowledge base documents via background script (respects local/cloud mode)
      const kbResult = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getEmbeddings' }, resolve);
      });
      const knowledgeBase = kbResult.success ? (kbResult.embeddings || []) : [];

      // Build context from knowledge base
      let knowledgeBaseContext = '';
      if (knowledgeBase.length > 0) {
        // Group chunks by source document
        const docs = {};
        knowledgeBase.forEach(chunk => {
          if (!docs[chunk.source]) {
            docs[chunk.source] = [];
          }
          docs[chunk.source].push(chunk.text);
        });

        // Create context string
        knowledgeBaseContext = Object.entries(docs)
          .map(([source, chunks]) => {
            return `=== ${source} ===\n${chunks.join('\n')}`;
          })
          .join('\n\n');
      }

      // Send form analysis request with hybrid AI strategy
      console.log('📤 Sending form analysis request (hybrid AI)...');
      console.log('   URL:', window.location.href);
      console.log('   HTML length:', document.documentElement.outerHTML.length, 'characters');
      console.log('   API key:', apiKey ? 'Available ✅' : 'Not available (will use JavaScript fallback)');
      console.log('   Knowledge base:', knowledgeBase.length > 0 ? `${knowledgeBase.length} chunks from uploaded documents ✅` : 'No documents uploaded');

      const analysisResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'analyzeFormWithChromeAI',
          url: window.location.href,
          pageHTML: getOptimizedHTML(),
          apiKey: apiKey,  // Pass API key for Gemini Cloud fallback
          knowledgeBaseContext: knowledgeBaseContext,  // Pass knowledge base for AI to extract values
          customInstructions: instructions  // Pass custom user instructions
        }, resolve);
      });

      console.log('📥 Received analysis response:', analysisResponse);

      if (!analysisResponse || !analysisResponse.success) {
        updateStage('analyzing', 'error');
        console.error('❌ Analysis failed:', analysisResponse?.error);
        console.error('   Full response:', analysisResponse);
        throw new Error(analysisResponse?.error || 'AI form analysis failed');
      }

      updateStage('analyzing', 'completed');

      // Log which method was used with TIER information
      const analysisMethod = analysisResponse.method || 'unknown';
      const analysisReason = analysisResponse.reason || '';
      const analysisTier = analysisResponse.tier || null;

      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ FORM ANALYSIS COMPLETE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // SHOW BIG RED FIREBASE LOGS IN PAGE CONSOLE
      if (analysisMethod === 'firebase_ai_logic_sdk') {
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: red; font-weight: bold; font-size: 16px;');
        console.log('%c🔥 FIREBASE AI LOGIC SDK USED (OFFICIAL) 🔥', 'color: red; font-weight: bold; font-size: 24px;');
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: red; font-weight: bold; font-size: 16px;');
        console.log('%c✅ TIER 1: Official Firebase AI Logic SDK', 'color: red; font-weight: bold; font-size: 18px;');
        console.log('%c🔥 Mode: ' + (analysisResponse.mode || 'UNKNOWN'), 'color: red; font-weight: bold; font-size: 18px;');
        console.log('%c✅ Hackathon Compliant - Official SDK Used', 'color: green; font-weight: bold; font-size: 18px;');
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: red; font-weight: bold; font-size: 16px;');
      } else if (analysisMethod === 'firebase_ai') {
        console.log('🎯 TIER 1 USED: Firebase AI Logic');
        console.log('   🔥 Automatic hybrid inference (on-device or cloud)');
        console.log('   ✅ Best option - qualifies for hackathon prize');
      } else if (analysisMethod === 'chromeai') {
        console.log('🔧 TIER 2 USED: Manual Hybrid - Chrome AI');
        console.log('   🤖 Gemini Nano (on-device) for small form');
        console.log('   ✅ Fast and private');
      } else if (analysisMethod === 'gemini_cloud') {
        console.log('🔧 TIER 2 USED: Manual Hybrid - Gemini Cloud');
        console.log('   ☁️  Gemini 1.5 Flash (cloud) for large form');
        console.log('   ℹ️  Reason: ' + analysisReason);
      } else if (analysisMethod === 'javascript') {
        console.log('📝 TIER 3 USED: JavaScript Fallback');
        console.log('   🔍 DOM-based form detection');
        console.log('   ⚠️  AI methods not available');
        if (analysisReason) console.log('   ℹ️  Reason: ' + analysisReason);
      } else {
        console.log('%c⚠️  UNKNOWN METHOD: ' + analysisMethod, 'color: orange; font-weight: bold; font-size: 16px;');
        console.log('%c   This might be Firebase AI Logic SDK with wrong method name', 'color: orange; font-weight: bold;');
      }

      // Show two-stage token breakdown with FULL LOGS from background.js
      if (analysisResponse.stage1Logs && analysisResponse.stage2Logs) {
        // Print Stage 1 logs (all lines from background.js)
        analysisResponse.stage1Logs.forEach(log => console.log(log));

        // Print Stage 2 logs (all lines from background.js)
        analysisResponse.stage2Logs.forEach(log => console.log(log));
      }

      // Show method details
      const methodName = {
        'firebase_ai': '🔥 TIER 1: Firebase AI Logic (Hybrid)',
        'chromeai': '🤖 TIER 2: Chrome AI (Gemini Nano)',
        'gemini_cloud': '☁️  TIER 2: Gemini API Cloud',
        'javascript': '📝 TIER 3: JavaScript Fallback'
      }[analysisMethod] || 'Unknown';

      console.log('');
      console.log(`📊 Method Used: ${methodName}`);
      console.log(`🤖 Detected ${analysisResponse.analysis?.detectedFields?.length || 0} fields`);
      console.log(`📋 Form purpose: ${analysisResponse.analysis?.formPurpose || 'unknown'}`);
      console.log(`📝 Form type: ${analysisResponse.analysis?.formType || 'unknown'}`);
      console.log(`🎯 Confidence: ${((analysisResponse.analysis?.confidence || 0) * 100).toFixed(0)}%`);

      if (analysisResponse.analysis?.detectedFields) {
        console.log('📝 Field details:');
        analysisResponse.analysis.detectedFields.forEach((field, i) => {
          console.log(`   ${i+1}. ${field.label} (${field.type}${field.required ? ', required' : ''})`);
        });
      }

      analysisData = analysisResponse.analysis;

      // STEP 3: Knowledge Base Loading (happens in Step 2 with Chrome AI)
      updateStage('embedding', 'active');
      console.log('\n📚 STEP 3: Loading knowledge base documents...');
      console.log('📄 Reading full document text from Chrome Storage');
      console.log('💾 Chrome AI already received up to 30KB of document content');
      console.log('🔄 AI is analyzing all uploaded documents for relevant information');

      // Brief delay for visual feedback - actual work done in Step 2
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStage('embedding', 'completed');
      console.log('✅ Stage 3 Complete: Knowledge base loaded into AI context');

      // STEP 4: AI Semantic Matching (happens in Step 2 with Chrome AI)
      updateStage('matching', 'active');
      console.log('\n🔍 STEP 4: AI semantic matching...');
      console.log('🤖 Chrome AI is:');
      console.log('   - Understanding field requirements');
      console.log('   - Searching through document content');
      console.log('   - Extracting relevant values (name, email, skills, experience, etc.)');
      console.log('   - Calculating confidence scores');
      console.log(`📊 Processing ${analysisData?.detectedFields?.length || 0} detected fields`);

      // Brief delay for visual feedback - actual work done in Step 2
      await new Promise(resolve => setTimeout(resolve, 400));
      updateStage('matching', 'completed');
      console.log('✅ Stage 4 Complete: AI matching complete');

      // STEP 5: Fill the form using analysis results
      updateStage('filling', 'active');
      console.log('\n📝 STEP 5: Filling form fields...');

      // Use the analysis results to fill the form
      const detectedFields = analysisData?.detectedFields || [];
      let filledCount = 0;
      const filledFields = {};

      // === SAME-TAB FILLING (NO NOVA ACT) ===
      // Fill fields directly using DOM manipulation
      console.log('⚡ Filling fields directly in current tab...');

      if (false) { // Disabled desktop agent path
        console.log('🖥️ Using Desktop Agent (Playwright + CDP)');
        console.log('🤖 Playwright will:');
        console.log('   1. Connect to your Chrome via CDP (port 9222)');
        console.log('   2. Find THIS tab with the Google Form');
        console.log('   3. Intelligently fill fields using AI automation');
        console.log('   4. Fill happens in THIS tab - no new window!');
        console.log('\n✨ Form will be filled in THIS current tab!');

        try {
          const desktopResult = await DesktopAgentConnector.fillForm(
            window.location.href,
            detectedFields
          );

          if (desktopResult.success) {
            console.log('✅ Desktop agent successfully filled the form!');
            console.log('   Response:', desktopResult.response);
            console.log('   ℹ️ The form was filled in a new browser window.');
            console.log('   👀 Please review the filled form and submit it manually.');

            // Count filled fields for reporting
            if (desktopResult.filled_values) {
              filledCount = Object.keys(desktopResult.filled_values).length;
              // Mark fields as processed for UI display
              for (const [fieldLabel, fieldValue] of Object.entries(desktopResult.filled_values)) {
                filledFields[fieldLabel] = {
                  filled: true,
                  value: fieldValue,
                  confidence: 0.95,
                  source: 'desktop_agent'
                };
              }
            }

            updateStage('filling', 'completed');
            console.log('✅ Stage 5 Complete: Desktop agent form filling complete');
            console.log(`📊 Fields filled: ${filledCount}/${detectedFields.length}`);
            console.log('\n💡 TIP: Check the new browser window to review and submit the form.');

            // Desktop agent handles everything - no fallback needed
          } else {
            throw new Error(desktopResult.error || 'Desktop Agent failed');
          }
        } catch (error) {
          console.error('❌ Desktop Agent failed:', error.message);
          console.log('⚠️ Falling back to manual form filling...');
          usingDesktopAgent = false; // Fall through to manual filling
        }
      }

      // === SAME-TAB DIRECT FILLING ===
      // Always use same-tab filling for hackathon demo
      console.log('⚡ Filling fields directly in this tab...');

      for (const field of detectedFields) {
        if (!field.suggestedValue || field.suggestedValue === 'NOT POSSIBLE TO ANSWER') {
          console.log(`⏭️  Skipping "${field.label}" - no value available`);
          continue;
        }

        console.log(`📝 Filling "${field.label}" with "${field.suggestedValue}"`);
        const filled = await fillFieldDirectly(field);
        if (filled) {
          filledCount++;
          filledFields[field.label] = {
            filled: true,
            value: field.suggestedValue,
            confidence: 0.95,
            source: 'same_tab_fill'
          };
          console.log(`   ✅ Successfully filled`);
        } else {
          console.warn(`   ⚠️ Could not fill field`);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      updateStage('filling', 'completed');
      console.log('✅ Stage 5 Complete: Form filling complete');
      console.log(`📊 Fields filled: ${filledCount}/${detectedFields.length}`);

      fillData = {
        filledCount: filledCount,
        totalFields: detectedFields.length,
        fields: filledFields,
        averageConfidence: 0.95
      };

      // OLD MANUAL FILLING CODE (keeping as reference but disabled)
      if (false) {
      for (const oldfield of detectedFields) {
        try {
          // Use default text if no value found in knowledge base
          const DEFAULT_MISSING_VALUE = 'ANSWER NOT FOUND IN PERSONAL KNOWLEDGE';
          const valueToFill = field.suggestedValue || DEFAULT_MISSING_VALUE;

          console.log(`\n🔍 Attempting to fill field: "${field.label}"`);
          console.log(`   Selector: ${field.selector}`);
          console.log(`   Suggested Value: ${valueToFill}`);
          if (!field.suggestedValue) {
            console.log(`   ⚠️ No value found in knowledge base - using default placeholder`);
          }

          const element = document.querySelector(field.selector);
          console.log(`   Element found: ${element ? 'YES ✅' : 'NO ❌'}`);

          if (element) {
            console.log(`   Element tag: <${element.tagName.toLowerCase()}>`);
            console.log(`   Element type: ${element.type || 'N/A'}`);
            console.log(`   Element name: ${element.name || 'N/A'}`);
          }

          if (element) {
            // Google Forms special handling: hidden inputs + visible elements
            if (element.tagName === 'INPUT' && element.type === 'hidden') {
              console.log(`   🔧 Google Forms detected! Finding visible element...`);

              // Fill the hidden field first
              element.value = valueToFill;

              // Google Forms structure: hidden input is NOT near the visible element
              // We need to search globally using aria-label
              const fieldName = element.name;

              // DIAGNOSTIC: Show what aria-labels exist
              console.log(`   🔍 Searching for visible element with label: "${field.label}"`);
              const allInteractive = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, div[role="textbox"]'))
                .filter(el => !el.closest('#fastramp-panel-root')); // Exclude extension panel
              console.log(`   📊 Found ${allInteractive.length} potential visible elements`);

              // Show first 5 aria-labels for debugging
              const sampleLabels = Array.from(allInteractive).slice(0, 5).map(el =>
                el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '(no label)'
              );
              console.log(`   📝 Sample aria-labels: ${JSON.stringify(sampleLabels)}`);

              // Strategy 1: Find by exact aria-label match
              let visibleInput = document.querySelector(`input[aria-label="${field.label}"], textarea[aria-label="${field.label}"], div[role="textbox"][aria-label="${field.label}"]`);

              // Strategy 2: Find by partial aria-label match (case-insensitive)
              if (!visibleInput) {
                const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, div[role="textbox"]'))
                  .filter(inp => !inp.closest('#fastramp-panel-root')); // Exclude extension panel
                for (const inp of allInputs) {
                  const ariaLabel = (inp.getAttribute('aria-label') || '').toLowerCase();
                  const searchLabel = field.label.toLowerCase();
                  if (ariaLabel === searchLabel || ariaLabel.includes(searchLabel)) {
                    visibleInput = inp;
                    console.log(`   🎯 Matched by partial aria-label: "${ariaLabel}"`);
                    break;
                  }
                }
              }

              if (visibleInput) {
                console.log(`   ✅ Found visible element: <${visibleInput.tagName.toLowerCase()}>`);
                console.log(`   📍 Aria-label: "${visibleInput.getAttribute('aria-label')}"`);

                if (visibleInput.hasAttribute('contenteditable') || visibleInput.getAttribute('role') === 'textbox') {
                  // For div with role=textbox (Google Forms Material Design)
                  visibleInput.textContent = valueToFill;
                  visibleInput.innerText = valueToFill;
                } else {
                  // For regular input/textarea
                  visibleInput.value = valueToFill;
                }

                // Trigger ALL events Google Forms might listen to
                ['input', 'change', 'blur', 'focus', 'keyup'].forEach(eventType => {
                  visibleInput.dispatchEvent(new Event(eventType, { bubbles: true }));
                });

                // Focus/blur to trigger Google Forms validation
                visibleInput.focus();
                setTimeout(() => visibleInput.blur(), 50);

                console.log(`   ✅ Filled visible element successfully`);
              } else {
                console.log(`   ⚠️ Could not find visible element for "${field.label}"`);
              }

              // Dispatch events on hidden field
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));

            } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
              // Regular input/textarea (not hidden)
              element.value = valueToFill;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));

            } else if (element.hasAttribute('contenteditable')) {
              element.textContent = valueToFill;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));

            } else if (element.tagName === 'SELECT') {
              // Find option that matches suggested value
              const options = Array.from(element.options);
              const matchingOption = options.find(opt =>
                opt.value === valueToFill ||
                opt.text === valueToFill
              );
              if (matchingOption) {
                element.value = matchingOption.value;
              }
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
            }

            filledCount++;
            filledFields[field.label || field.selector] = {
              filled: true,
              value: valueToFill,
              confidence: field.confidence || 0,
              source: field.suggestedValue ? 'knowledge_base' : 'placeholder'
            };

            console.log(`   ✓ Filled "${field.label}": ${valueToFill} (confidence: ${((field.confidence || 0) * 100).toFixed(1)}%)`);
          }
        } catch (error) {
          console.warn(`   ⚠️ Could not fill field "${field.label}":`, error.message);
        }
      }

        updateStage('filling', 'completed');
        console.log('✅ Stage 5 Complete: Form filling complete');
        console.log(`📊 Fields filled: ${filledCount}/${detectedFields.length}`);

        // Calculate average confidence
        const confidences = Object.values(filledFields).map(f => f.confidence);
        const averageConfidence = confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0;

        console.log('🎯 Average confidence:', `${(averageConfidence * 100).toFixed(1)}%`);

        console.log('\n📋 Applied values to form fields:');
        for (const [fieldName, fieldData] of Object.entries(filledFields)) {
          console.log(`   • ${fieldName}: "${fieldData.value}" (confidence: ${(fieldData.confidence * 100).toFixed(1)}%, source: ${fieldData.source})`);
        }

        fillData = {
          filledCount: filledCount,
          totalFields: detectedFields.length,
          fields: filledFields,
          averageConfidence: averageConfidence
        };
      } // End manual filling section

      // STEP 6: Complete
      updateStage('complete', 'completed');
      console.log('\n🎉 === SMART FORM FILL COMPLETE ===');
      console.log('📋 Fill summary:', fillData);

      // Show results section
      showResults(analysisData, fillData);

      // Show success notification
      showNotification(`Successfully analyzed and filled ${fillData.filledCount} fields!`, 'success');

    } catch (error) {
      console.error('❌ Smart form fill failed:', error.message);
      console.log('🔧 Troubleshooting tips:');
      console.log('   1. Ensure forms are detected on the page');
      console.log('   2. Verify knowledge base files are uploaded');
      console.log('   3. Check browser console for detailed errors');
      console.log('   4. Verify Chrome AI is enabled in chrome://flags/');
      showNotification(`Failed: ${error.message}`, 'error');
    } finally {
      // Re-enable button
      smartFillBtn.disabled = false;
      smartFillBtn.querySelector('.fastramp-label').textContent = 'Analyze & Fill Form';
    }
  });

  voiceSection.addEventListener('click', () => {
    console.log('Voice chat clicked');

    // ALWAYS allow manual trigger - use stored missing fields or get from last analysis
    if (window.fastRampMissingFields && window.fastRampMissingFields.length > 0) {
      console.log('✅ Triggering voice for', window.fastRampMissingFields.length, 'missing fields');
      triggerVoiceAssistantForMissingFields(window.fastRampMissingFields);
    } else if (window.fastRampLastAnalysis) {
      // Try to get missing fields from last analysis
      const allFields = window.fastRampLastAnalysis.detectedFields || [];
      const missingFields = allFields.filter(f => !f.suggestedValue || f.suggestedValue === 'NOT POSSIBLE TO ANSWER');

      if (missingFields.length > 0) {
        console.log('✅ Triggering voice for', missingFields.length, 'missing fields from last analysis');
        triggerVoiceAssistantForMissingFields(missingFields);
      } else {
        showNotification('✅ All fields are already filled! No missing fields to ask about.', 'success');
      }
    } else {
      showNotification('⚠️ Please run "Analyze & Fill Form" first', 'info');
    }
  });

  // Voice Assistant for Missing Fields - Speaks and listens automatically
  async function triggerVoiceAssistantForMissingFields(missingFields) {
    console.log('🎤 Starting voice assistant for missing fields...');
    console.log('Missing fields:', missingFields);

    // Check if browser supports Web Speech API
    if (!('speechSynthesis' in window) || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.error('❌ Web Speech API not supported');
      showNotification('❌ Voice features not supported in this browser', 'error');
      return;
    }

    let currentFieldIndex = 0;
    let filledCount = 0;
    let voiceStopped = false;

    // Create STOP button - 50% smaller, cleaner design
    const stopButton = document.createElement('div');
    stopButton.innerHTML = `
      <button style="
        width: 100%;
        padding: 10px 16px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
        transition: all 0.2s ease;
      ">🛑 STOP</button>
    `;
    stopButton.id = 'fastramp-stop-voice-container';
    stopButton.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      width: 200px;
      max-width: 90vw;
      background: rgba(0, 0, 0, 0.85);
      padding: 12px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    const button = stopButton.querySelector('button');
    button.onclick = () => {
      voiceStopped = true;
      window.speechSynthesis.cancel();
      try { recognition.stop(); } catch(e) {}
      stopButton.remove();
      console.log('🛑 STOP button clicked');
      showNotification('🛑 Voice assistant stopped', 'info');
    };

    document.body.appendChild(stopButton);
    console.log('✅ STOP button added to page - should be visible at top center');

    // Create LIVE TRANSCRIPT display - shows what's being heard in real-time
    const transcriptDisplay = document.createElement('div');
    transcriptDisplay.id = 'fastramp-transcript-display';
    transcriptDisplay.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      width: 600px;
      max-width: 90vw;
      background: rgba(59, 130, 246, 0.95);
      color: white;
      padding: 20px 24px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
      font-size: 18px;
      font-weight: 500;
      text-align: center;
      display: none;
      animation: pulse 1.5s ease-in-out infinite;
    `;
    document.body.appendChild(transcriptDisplay);

    // Add pulse animation for transcript display
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);

    // CRITICAL FIX: Load voices BEFORE starting voice assistant
    // Based on Web Speech API research - voices load asynchronously
    let availableVoices = [];
    let voicesLoaded = false;

    // Load voices immediately (might work on some browsers)
    availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      voicesLoaded = true;
      console.log(`✅ Voices loaded immediately: ${availableVoices.length} voices`);
    }

    // Wait for voiceschanged event (required for Chrome)
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      availableVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      console.log(`✅ Voices loaded: ${availableVoices.length} voices available`);
    }, { once: true });

    // Initialize speech recognition with IMPROVED settings
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true; // Enable interim results for visual feedback
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy

    // Function to speak text using best available voice
    function speak(text) {
      return new Promise((resolve) => {
        if (voiceStopped) {
          resolve();
          return;
        }

        // CRITICAL: Cancel any ongoing speech first
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // IMPROVED VOICE SETTINGS for better clarity
        utterance.rate = 0.95; // Slightly faster for natural conversation
        utterance.pitch = 1.0; // Natural pitch
        utterance.volume = 1.0; // Full volume

        // PROPER VOICE SELECTION - Use pre-loaded voices
        if (voicesLoaded && availableVoices.length > 0) {
          console.log(`🔍 Selecting voice from ${availableVoices.length} available voices`);

          // PRIORITY ORDER: Try these voices in order (AVOID Samantha)
          const voicePreferences = [
            'Alex',                       // macOS male voice (clear, different from Samantha)
            'Google US English',          // Google voice
            'Fred',                       // macOS male voice
            'Victoria',                   // macOS female (but not Samantha)
            'Karen',                      // macOS female
            'Google UK English Female',   // Google voice
            'Microsoft David',            // Windows male
            'Zira'                        // Windows female
          ];

          let selectedVoice = null;

          // Try exact name match first
          for (const voiceName of voicePreferences) {
            selectedVoice = availableVoices.find(v => v.name === voiceName);
            if (selectedVoice) {
              console.log(`✅ EXACT MATCH: Selected "${selectedVoice.name}"`);
              break;
            }
          }

          // If no exact match, try partial match (but EXCLUDE Samantha explicitly)
          if (!selectedVoice) {
            for (const voiceName of voicePreferences) {
              selectedVoice = availableVoices.find(v =>
                v.name.includes(voiceName) &&
                !v.name.includes('Samantha')
              );
              if (selectedVoice) {
                console.log(`✅ PARTIAL MATCH: Selected "${selectedVoice.name}" (matched "${voiceName}")`);
                break;
              }
            }
          }

          // Fallback: First English voice that's NOT Samantha
          if (!selectedVoice) {
            selectedVoice = availableVoices.find(v =>
              v.lang.startsWith('en-') &&
              !v.name.includes('Samantha')
            );
            if (selectedVoice) {
              console.log(`⚠️ FALLBACK: Using first non-Samantha English voice: "${selectedVoice.name}"`);
            }
          }

          // Last resort: Use any voice
          if (!selectedVoice && availableVoices.length > 0) {
            selectedVoice = availableVoices[0];
            console.log(`⚠️ LAST RESORT: Using "${selectedVoice.name}"`);
          }

          // Apply the selected voice
          if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log(`🎤 SPEAKING WITH: "${selectedVoice.name}" (${selectedVoice.lang})`);
          }
        } else {
          console.warn(`⚠️ Voices not loaded yet, using system default (this might be Samantha)`);
        }

        utterance.onend = () => {
          // Wait 1.5 seconds after speaking before listening (prevent echo)
          setTimeout(resolve, 1500);
        };
        window.speechSynthesis.speak(utterance);
      });
    }

    // Function to listen for user response
    // IMPROVED listen function with visual feedback and retry logic
    function listen() {
      return new Promise((resolve, reject) => {
        if (voiceStopped) {
          reject('stopped');
          return;
        }

        // CRITICAL: Ensure speech is completely stopped
        window.speechSynthesis.cancel();

        let finalTranscript = '';
        let interimTranscript = '';
        let hasResolved = false;
        let confidenceScore = 0;

        // Show transcript display
        transcriptDisplay.style.display = 'block';
        transcriptDisplay.innerHTML = '🎤 <strong>Listening...</strong> (Speak now)';

        recognition.onresult = (event) => {
          interimTranscript = '';

          // Process all results
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;

            if (result.isFinal) {
              // Get the best result with confidence
              finalTranscript = transcript;
              confidenceScore = result[0].confidence;

              // Log all alternatives for debugging
              console.log('🎤 Final result:', finalTranscript);
              console.log('🎯 Confidence:', (confidenceScore * 100).toFixed(0) + '%');

              if (result.length > 1) {
                console.log('📋 Alternatives:');
                for (let j = 0; j < Math.min(3, result.length); j++) {
                  console.log(`   ${j + 1}. "${result[j].transcript}" (${(result[j].confidence * 100).toFixed(0)}%)`);
                }
              }

              // Update display with final result
              transcriptDisplay.innerHTML = `✅ <strong>Heard:</strong> "${finalTranscript}"`;
            } else {
              // Show interim results in real-time
              interimTranscript += transcript;
              transcriptDisplay.innerHTML = `🎤 <strong>Hearing:</strong> "${interimTranscript}"`;
              console.log('🎤 Interim:', interimTranscript);
            }
          }
        };

        recognition.onspeechend = () => {
          console.log('🛑 SPEECH ENDED - User stopped talking (auto-detected!)');
          // Recognition will automatically stop when continuous=false
        };

        recognition.onerror = (event) => {
          console.error('🎤 Speech recognition error:', event.error);
          transcriptDisplay.style.display = 'none';

          if (!hasResolved) {
            hasResolved = true;

            // Provide helpful error messages
            if (event.error === 'no-speech') {
              reject('no-speech');
            } else if (event.error === 'audio-capture') {
              reject('audio-capture');
            } else if (event.error === 'not-allowed') {
              reject('not-allowed');
            } else {
              reject(event.error);
            }
          }
        };

        recognition.onend = () => {
          console.log('🎤 Listening ended');

          // Keep display visible for 1 second before hiding
          setTimeout(() => {
            transcriptDisplay.style.display = 'none';
          }, 1000);

          if (!hasResolved) {
            hasResolved = true;

            if (finalTranscript) {
              // Return result with confidence score
              resolve({
                transcript: finalTranscript,
                confidence: confidenceScore
              });
            } else {
              reject('no-speech');
            }
          }
        };

        try {
          recognition.start();
          console.log('🎤 ===== LISTENING STARTED =====');
          console.log('   Auto-stop when you finish speaking (NO hardcoded timeout!)');
          console.log('   Speak naturally - Web Speech API will detect when you stop');
        } catch (error) {
          console.error('🎤 Failed to start recognition:', error);
          transcriptDisplay.style.display = 'none';
          reject('start-failed');
        }

        // REMOVED HARDCODED 12-SECOND TIMEOUT!
        // Web Speech API automatically stops when user stops speaking (recognition.continuous = false)
        // No artificial time limits - speak as long as you need!
      });
    }

    // Process each missing field one by one with RETRY logic
    async function processNextField(retryCount = 0) {
      if (voiceStopped) {
        stopButton.remove();
        return;
      }

      if (currentFieldIndex >= missingFields.length) {
        // All done!
        await speak(`Great! I've filled ${filledCount} additional fields for you.`);
        showNotification(`✅ Filled ${filledCount} additional fields via voice!`, 'success');

        // Remove stop button and clear missing fields
        stopButton.remove();
        window.fastRampMissingFields = [];
        const voiceBadge = document.getElementById('fastramp-voice-badge');
        voiceBadge.style.display = 'none';
        return;
      }

      const field = missingFields[currentFieldIndex];
      const fieldNumber = currentFieldIndex + 1;

      try {
        // Ask for the field value (different prompt for retry)
        if (retryCount === 0) {
          await speak(`Field ${fieldNumber} of ${missingFields.length}. What should I put for ${field.label}?`);
        } else if (retryCount === 1) {
          await speak(`Sorry, I didn't catch that. Please say your ${field.label} again.`);
        } else {
          await speak(`One more time. What's your ${field.label}?`);
        }

        if (voiceStopped) {
          stopButton.remove();
          return;
        }

        // Listen for response
        showNotification(`🎤 Listening for: ${field.label}`, 'info');
        const response = await listen();

        if (voiceStopped) {
          stopButton.remove();
          return;
        }

        // Extract transcript and confidence
        const userResponse = response.transcript;
        const confidence = response.confidence;

        console.log(`🎤 Captured: "${userResponse}" with ${(confidence * 100).toFixed(0)}% confidence`);

        // CONFIDENCE CHECK - If confidence is low and we haven't retried too many times, confirm
        if (confidence < 0.6 && retryCount < 2) {
          console.warn(`⚠️ Low confidence (${(confidence * 100).toFixed(0)}%) - asking for confirmation`);
          await speak(`I heard ${userResponse}. Is that correct? Say yes or no.`);

          try {
            const confirmation = await listen();
            const confirmText = confirmation.transcript.toLowerCase();

            if (confirmText.includes('yes') || confirmText.includes('correct') || confirmText.includes('right')) {
              console.log('✅ User confirmed the answer');
              // Proceed with filling
            } else {
              console.log('❌ User rejected - retrying');
              // Retry the same field
              await processNextField(retryCount + 1);
              return;
            }
          } catch (confirmError) {
            console.warn('⚠️ No confirmation heard - proceeding anyway');
            // Proceed with filling
          }
        }

        // Fill the field
        field.suggestedValue = userResponse;
        const filled = await fillFieldDirectly(field);

        if (filled) {
          filledCount++;
          console.log(`✅ Filled "${field.label}" with "${userResponse}"`);
          await speak(`Got it.`);

          // Move to next field
          currentFieldIndex++;
          processNextField(0); // Reset retry count for next field
        } else {
          console.warn(`⚠️ Could not fill "${field.label}"`);
          await speak(`Sorry, couldn't fill that field. Moving on.`);

          // Move to next field even if filling failed
          currentFieldIndex++;
          processNextField(0);
        }

      } catch (error) {
        if (error === 'stopped' || voiceStopped) {
          stopButton.remove();
          return;
        }

        console.error('❌ Voice processing error:', error);

        // Handle different error types
        if (error === 'no-speech') {
          if (retryCount < 3) {
            console.log('⚠️ No speech detected - retrying');
            await speak(`I didn't hear anything. Let me try again.`);
            await processNextField(retryCount + 1);
            return;
          } else {
            console.log('⚠️ Too many retries - skipping field');
            await speak(`I'm having trouble hearing. Let's skip this one.`);
            currentFieldIndex++;
            processNextField(0);
          }
        } else if (error === 'audio-capture') {
          await speak(`I can't access your microphone. Please check your browser settings.`);
          stopButton.remove();
          showNotification('❌ Microphone access denied', 'error');
        } else if (error === 'not-allowed') {
          await speak(`Microphone permission is required. Please allow access.`);
          stopButton.remove();
          showNotification('❌ Microphone permission denied', 'error');
        } else {
          // Unknown error - skip and continue
          console.warn('⚠️ Unknown error - skipping field');
          currentFieldIndex++;
          processNextField(0);
        }
      }
    }

    // Start the conversation
    await speak(`I noticed ${missingFields.length} fields need your input. Let me help you fill them.`);
    await new Promise(resolve => setTimeout(resolve, 500));
    processNextField();
  }

  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'fastramp-notification';

    // Support success, error, and info types
    let icon, bgColor, borderColor, textColor;

    if (type === 'error') {
      icon = '❌';
      bgColor = '#f8d7da';
      borderColor = '#f5c6cb';
      textColor = '#721c24';
    } else if (type === 'info') {
      icon = 'ℹ️';
      bgColor = '#d1ecf1';
      borderColor = '#bee5eb';
      textColor = '#0c5460';
    } else {
      icon = '✅';
      bgColor = '#d4edda';
      borderColor = '#c3e6cb';
      textColor = '#155724';
    }

    notification.style.background = bgColor;
    notification.style.border = `1px solid ${borderColor}`;

    notification.innerHTML = `
      <span class="fastramp-success-icon">${icon}</span>
      <span class="fastramp-success-text" style="color: ${textColor}">${message}</span>
    `;

    root.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 4000);
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'togglePanel') {
      if (isPanelOpen) {
        closePanel();
      } else {
        openPanel();
      }
      sendResponse({ success: true });
    }
    return true;
  });

  // Check initial state
  chrome.storage.local.get(['panelOpen'], (result) => {
    if (result.panelOpen) {
      openPanel();
    }
  });

  // Check if documents exist and update chat UI (via background script to respect storage mode)
  chrome.runtime.sendMessage({ action: 'getEmbeddings' }, (result) => {
    if (!result || !result.success) {
      console.warn('Failed to check knowledge base on load');
      return;
    }

    const knowledgeBase = result.embeddings || [];
    if (knowledgeBase.length > 0) {
      console.log(`📚 Found ${knowledgeBase.length} chunks in knowledge base on load (from ${result.mode} storage)`);

      // Enable chat
      if (chatInput && chatSendBtn) {
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatInput.placeholder = "Ask a question about your documents...";
      }

      // Update chat message
      const chatMessages = document.getElementById('fastramp-chat-messages');
      if (chatMessages) {
        chatMessages.innerHTML = '<div class="fastramp-chat-message system">✅ Ready! Ask questions about your documents.</div>';
      }
    }
  });
  
  // Check if Chrome Prompt API is available (optional - for Firebase AI Logic on-device mode)
  checkChromeAI().then(available => {
    if (available) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 FIREBASE AI LOGIC - HYBRID MODE READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   ✅ On-device inference available (Gemini Nano)');
      console.log('   ✅ Cloud inference available (Gemini API)');
      console.log('   🔄 Auto-routing: PREFER_ON_DEVICE mode enabled');
      console.log('   💡 Small forms → on-device, large forms → cloud');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const statusText = document.getElementById('fastramp-status-text');
      if (statusText) {
        statusText.textContent = 'Firebase AI Logic Hybrid Mode - On-device + Cloud';
      }
    } else {
      // On-device not available, Firebase AI Logic uses cloud-only mode
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 FIREBASE AI LOGIC - CLOUD MODE READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   ✅ Cloud inference available (Gemini API)');
      console.log('   ✅ Document upload & embeddings');
      console.log('   ✅ Semantic search & knowledge base');
      console.log('   ✅ Form analysis (cloud inference)');
      console.log('   🔄 Mode: ONLY_IN_CLOUD (automatic)');
      console.log('   💡 On-device optional - extension fully functional');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const statusText = document.getElementById('fastramp-status-text');
      if (statusText) {
        statusText.textContent = 'Firebase AI Logic Cloud Mode - Fully Functional';
        statusText.style.color = '#10b981'; // Green for success
      }
    }
  });

  // Enable all features (embeddings work via Gemini API regardless of Chrome AI)
  enableMainFeatures();
  hideApiSection();
  
  // Load document metadata from local cache
  // Note: Actual embeddings are stored in Chrome Storage, we just cache metadata for UI
  chrome.storage.local.get(['documentMetadata'], (result) => {
    if (result.documentMetadata && result.documentMetadata.length > 0) {
      const metadata = result.documentMetadata;
      console.log(`📚 Loaded ${metadata.length} documents from local cache`);

      // Deduplicate metadata by fileName (keep most recent)
      const uniqueDocs = {};
      metadata.forEach(doc => {
        if (!uniqueDocs[doc.fileName] || uniqueDocs[doc.fileName].uploadedAt < doc.uploadedAt) {
          uniqueDocs[doc.fileName] = doc;
        }
      });

      const deduplicatedMetadata = Object.values(uniqueDocs);
      if (deduplicatedMetadata.length < metadata.length) {
        console.log(`🧹 Cleaned up duplicates: ${metadata.length} → ${deduplicatedMetadata.length} unique documents`);
        // Save cleaned metadata back to storage
        chrome.storage.local.set({ documentMetadata: deduplicatedMetadata });
      }

      // Reconstruct embedded documents from deduplicated metadata
      deduplicatedMetadata.forEach(doc => {
        embeddedDocuments.push({
          fileName: doc.fileName,
          documentId: doc.documentId,
          chunksCount: doc.chunksProcessed,
          uploadedAt: doc.uploadedAt,
          storageKey: doc.storageKey
        });

        // Add to file list for UI
        const mockFile = { name: doc.fileName, size: 0 };
        uploadedFiles.push(mockFile);
        addFileToList(mockFile);
      });

      console.log(`📚 Documents ready:`, embeddedDocuments.map(d => ({
        fileName: d.fileName,
        chunks: d.chunksCount,
        storageKey: d.storageKey
      })));

      updateKBStatus();

      // Enable chat if we have documents
      if (embeddedDocuments.length > 0) {
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatInput.placeholder = "Ask a question about your documents...";
        updateChatMessage('Ready! Ask questions about your documents. Embeddings are stored securely in Chrome Storage.', 'system');
      }
    } else {
      // No documents loaded - show empty state
      updateKBStatus();
    }
  });

  // ============================================================================
  // DEBUG MODE EVENT HANDLER
  // ============================================================================
  const debugModeCheckbox = document.getElementById('fastramp-debug-mode');
  if (debugModeCheckbox) {
    debugModeCheckbox.addEventListener('change', () => {
      const isDebugEnabled = debugModeCheckbox.checked;
      chrome.storage.sync.set({ debugMode: isDebugEnabled }, () => {
        if (isDebugEnabled) {
          showNotification('🐛 Debug mode enabled - Background console logs active', 'success');
        } else {
          showNotification('🐛 Debug mode disabled - Background console logs minimized', 'info');
        }
      });
    });
  }

  // ============================================================================
  // STORAGE MODE EVENT HANDLER
  // ============================================================================
  const storageModeSelect = document.getElementById('fastramp-storage-mode');
  const storageUsageDiv = document.getElementById('fastramp-storage-usage');

  // Load current storage mode and usage
  async function loadStorageMode() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'getStorageMode'
        }, resolve);
      });

      if (response && response.success) {
        storageModeSelect.value = response.mode;
        updateStorageUsageDisplay(response.usage);
      }
    } catch (error) {
      console.error('Error loading storage mode:', error);
    }
  }

  // Update storage usage display
  function updateStorageUsageDisplay(usage) {
    if (!usage) return;

    const usageText = usage.mode === 'local'
      ? `📊 Local Storage: ${usage.formattedUsed} / ${usage.formattedMax} (${usage.percentUsed}% used)`
      : `📊 Cloud Storage: ${usage.formattedUsed} used (Unlimited)`;

    storageUsageDiv.textContent = usageText;

    // Color code based on usage
    if (usage.mode === 'local') {
      if (usage.percentUsed > 80) {
        storageUsageDiv.style.color = '#ef4444'; // Red
      } else if (usage.percentUsed > 50) {
        storageUsageDiv.style.color = '#f59e0b'; // Orange
      } else {
        storageUsageDiv.style.color = '#10b981'; // Green
      }
    } else {
      storageUsageDiv.style.color = '#3b82f6'; // Blue for cloud
    }
  }

  // Initialize storage mode on load
  loadStorageMode();

  // Handle storage mode change
  if (storageModeSelect) {
    storageModeSelect.addEventListener('change', async () => {
      const newMode = storageModeSelect.value;

      // Confirm mode change
      const isConfirmed = confirm(
        `Switch to ${newMode === 'local' ? 'Local' : 'Cloud'} storage?\n\n` +
        `${newMode === 'local'
          ? '🏠 Local Storage:\n• Faster access\n• 10MB limit\n• Works offline'
          : '☁️ Cloud Storage:\n• Unlimited storage\n• Requires internet\n• Stored on Google Cloud'}\n\n` +
        'Your existing documents will remain accessible.'
      );

      if (!isConfirmed) {
        // Revert selection
        loadStorageMode();
        return;
      }

      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'setStorageMode',
            mode: newMode
          }, resolve);
        });

        if (response && response.success) {
          showNotification(
            `✅ Storage mode changed to ${newMode === 'local' ? 'Local' : 'Cloud'} storage`,
            'success'
          );

          // Reload usage info
          setTimeout(loadStorageMode, 500);
        } else {
          showNotification(
            `❌ Failed to change storage mode: ${response.error || 'Unknown error'}`,
            'error'
          );
          // Revert selection
          loadStorageMode();
        }
      } catch (error) {
        console.error('Error changing storage mode:', error);
        showNotification(`❌ Error changing storage mode: ${error.message}`, 'error');
        // Revert selection
        loadStorageMode();
      }
    });
  }
})();