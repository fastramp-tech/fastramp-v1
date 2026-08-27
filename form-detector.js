/**
 * FastRamp - Comprehensive Form Field Detector
 *
 * Detects form fields using multiple strategies:
 * - Traditional <form> elements
 * - ARIA roles and labels
 * - ContentEditable elements
 * - React/Vue component patterns
 * - Shadow DOM
 *
 * Works with: Google Forms, LinkedIn, Salesforce, modern SPAs
 */

class FormFieldDetector {
  constructor() {
    this.detectedFields = [];
  }

  /**
   * Main detection method - finds ALL form fields on the page
   */
  detectAllFields() {
    console.log('[FormDetector] 🔍 Starting comprehensive field detection...');

    this.detectedFields = [];

    // Strategy 1: Traditional form inputs
    this.detectTraditionalInputs();

    // Strategy 2: ARIA role-based inputs
    this.detectARIAInputs();

    // Strategy 3: ContentEditable elements
    this.detectContentEditableFields();

    // Strategy 4: Custom components (React/Vue)
    this.detectCustomComponents();

    // Strategy 5: Shadow DOM
    this.detectShadowDOMFields();

    // Remove duplicates
    this.detectedFields = this.deduplicateFields(this.detectedFields);

    console.log(`[FormDetector] ✅ Found ${this.detectedFields.length} fields`);
    console.log('[FormDetector] Field breakdown:', this.getFieldSummary());

    return this.detectedFields;
  }

  /**
   * Strategy 1: Traditional form elements
   */
  detectTraditionalInputs() {
    const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select';
    const elements = document.querySelectorAll(selector);

    console.log(`[FormDetector] Traditional inputs: ${elements.length}`);

    elements.forEach(el => {
      const field = this.analyzeElement(el, 'traditional');
      if (field) {
        this.detectedFields.push(field);
      }
    });
  }

  /**
   * Strategy 2: ARIA role-based inputs
   */
  detectARIAInputs() {
    const ariaRoles = [
      'textbox',
      'searchbox',
      'combobox',
      'listbox',
      'spinbutton',
      'slider',
      'switch',
      'checkbox',
      'radio',
      'radiogroup'
    ];

    ariaRoles.forEach(role => {
      const elements = document.querySelectorAll(`[role="${role}"]`);

      elements.forEach(el => {
        const field = this.analyzeElement(el, 'aria');
        if (field) {
          this.detectedFields.push(field);
        }
      });
    });

    console.log(`[FormDetector] ARIA inputs: ${ariaRoles.reduce((sum, role) =>
      sum + document.querySelectorAll(`[role="${role}"]`).length, 0)}`);
  }

  /**
   * Strategy 3: ContentEditable elements
   */
  detectContentEditableFields() {
    const elements = document.querySelectorAll('[contenteditable="true"]');

    console.log(`[FormDetector] ContentEditable: ${elements.length}`);

    elements.forEach(el => {
      const field = this.analyzeElement(el, 'contenteditable');
      if (field) {
        this.detectedFields.push(field);
      }
    });
  }

  /**
   * Strategy 4: Custom components (React/Vue patterns)
   */
  detectCustomComponents() {
    // Look for elements with data attributes that suggest they're form inputs
    const customSelectors = [
      '[data-testid*="input"]',
      '[data-testid*="field"]',
      '[data-cy*="input"]',
      '[data-cy*="field"]',
      '[class*="input"]',
      '[class*="field"]',
      '[class*="textbox"]'
    ];

    let count = 0;
    customSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);

      elements.forEach(el => {
        // Skip if already detected
        if (this.isAlreadyDetected(el)) return;

        // Check if element is interactive
        if (this.isInteractive(el)) {
          const field = this.analyzeElement(el, 'custom');
          if (field) {
            this.detectedFields.push(field);
            count++;
          }
        }
      });
    });

    console.log(`[FormDetector] Custom components: ${count}`);
  }

  /**
   * Strategy 5: Shadow DOM elements
   */
  detectShadowDOMFields() {
    // Find all elements with shadow roots
    const elementsWithShadow = this.findElementsWithShadowDOM(document.body);

    let count = 0;
    elementsWithShadow.forEach(host => {
      const shadowRoot = host.shadowRoot;
      if (shadowRoot) {
        // Search for inputs inside shadow DOM
        const inputs = shadowRoot.querySelectorAll('input, textarea, select, [role="textbox"]');

        inputs.forEach(el => {
          const field = this.analyzeElement(el, 'shadow-dom');
          if (field) {
            field.inShadowDOM = true;
            field.shadowHost = this.generateSelector(host);
            this.detectedFields.push(field);
            count++;
          }
        });
      }
    });

    console.log(`[FormDetector] Shadow DOM fields: ${count}`);
  }

  /**
   * Analyze a single element and extract field information
   */
  analyzeElement(element, detectionMethod) {
    try {
      // Get field type
      const type = this.inferFieldType(element);

      // Get label
      const label = this.getFieldLabel(element);

      // Generate unique selector
      const selector = this.generateSelector(element);

      // Get ARIA information
      const ariaInfo = this.getARIAInfo(element);

      // Infer purpose/semantic meaning
      const purpose = this.inferFieldPurpose(element, label, type);

      // Get current value
      const value = this.getCurrentValue(element);

      return {
        element: element,
        selector: selector,
        type: type,
        label: label,
        placeholder: element.placeholder || element.getAttribute('aria-placeholder') || element.getAttribute('placeholder'),
        required: element.required || element.getAttribute('aria-required') === 'true' || element.hasAttribute('required'),
        value: value,
        purpose: purpose,
        detectionMethod: detectionMethod,
        aria: ariaInfo,
        tagName: element.tagName.toLowerCase(),
        visible: this.isVisible(element),
        enabled: !element.disabled && element.getAttribute('aria-disabled') !== 'true'
      };

    } catch (error) {
      console.warn('[FormDetector] Error analyzing element:', error);
      return null;
    }
  }

  /**
   * Infer field type from element
   */
  inferFieldType(element) {
    // Traditional input type
    if (element.type) {
      return element.type;
    }

    // ARIA role
    const role = element.getAttribute('role');
    if (role) {
      const roleTypeMap = {
        'textbox': 'text',
        'searchbox': 'search',
        'combobox': 'select',
        'spinbutton': 'number',
        'slider': 'range',
        'switch': 'checkbox',
        'checkbox': 'checkbox',
        'radio': 'radio'
      };
      if (roleTypeMap[role]) {
        return roleTypeMap[role];
      }
    }

    // Tag name
    if (element.tagName === 'TEXTAREA') {
      return 'textarea';
    }
    if (element.tagName === 'SELECT') {
      return 'select';
    }

    // ContentEditable
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
      return 'contenteditable';
    }

    // Default
    return 'text';
  }

  /**
   * Get field label using multiple strategies
   */
  getFieldLabel(element) {
    // 1. aria-label (highest priority)
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    // 2. aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        return labelElement.textContent.trim();
      }
    }

    // 3. Associated <label> element
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }

    // 4. Parent <label>
    const parentLabel = element.closest('label');
    if (parentLabel) {
      // Get text, excluding the input's own text
      const clone = parentLabel.cloneNode(true);
      const inputClone = clone.querySelector('input, textarea, select');
      if (inputClone) {
        inputClone.remove();
      }
      const text = clone.textContent.trim();
      if (text) {
        return text;
      }
    }

    // 5. Nearby text (heuristic - look for text before the input)
    const nearbyText = this.findNearbyText(element);
    if (nearbyText) {
      return nearbyText;
    }

    // 6. Placeholder as fallback
    const placeholder = element.placeholder || element.getAttribute('aria-placeholder');
    if (placeholder) {
      return placeholder.trim();
    }

    // 7. Name attribute
    if (element.name) {
      return this.humanizeFieldName(element.name);
    }

    return 'Unlabeled field';
  }

  /**
   * Find nearby text that might be a label
   */
  findNearbyText(element) {
    // Look at previous siblings
    let sibling = element.previousElementSibling;
    let attempts = 0;

    while (sibling && attempts < 3) {
      const text = sibling.textContent.trim();
      if (text && text.length < 100 && text.length > 0) {
        // Likely a label if it ends with : or is short
        if (text.endsWith(':') || text.length < 50) {
          return text.replace(/:$/, '').trim();
        }
      }
      sibling = sibling.previousElementSibling;
      attempts++;
    }

    // Look at parent's previous siblings
    const parent = element.parentElement;
    if (parent) {
      sibling = parent.previousElementSibling;
      attempts = 0;

      while (sibling && attempts < 2) {
        const text = sibling.textContent.trim();
        if (text && text.length < 100 && text.length > 0) {
          if (text.endsWith(':') || text.length < 50) {
            return text.replace(/:$/, '').trim();
          }
        }
        sibling = sibling.previousElementSibling;
        attempts++;
      }
    }

    return null;
  }

  /**
   * Get ARIA information
   */
  getARIAInfo(element) {
    return {
      role: element.getAttribute('role'),
      label: element.getAttribute('aria-label'),
      labelledBy: element.getAttribute('aria-labelledby'),
      describedBy: element.getAttribute('aria-describedby'),
      required: element.getAttribute('aria-required'),
      invalid: element.getAttribute('aria-invalid'),
      placeholder: element.getAttribute('aria-placeholder')
    };
  }

  /**
   * Infer semantic purpose of field
   */
  inferFieldPurpose(element, label, type) {
    const text = (label || '').toLowerCase() + ' ' +
                 (element.name || '').toLowerCase() + ' ' +
                 (element.id || '').toLowerCase() + ' ' +
                 (element.placeholder || '').toLowerCase();

    // Email
    if (type === 'email' || text.includes('email') || text.includes('e-mail')) {
      return 'email';
    }

    // Phone
    if (type === 'tel' || text.includes('phone') || text.includes('telephone') || text.includes('mobile')) {
      return 'phone';
    }

    // Name
    if (text.includes('name') && !text.includes('username')) {
      if (text.includes('first')) return 'first_name';
      if (text.includes('last')) return 'last_name';
      if (text.includes('full')) return 'full_name';
      return 'name';
    }

    // Address
    if (text.includes('address')) {
      if (text.includes('street')) return 'street_address';
      if (text.includes('city')) return 'city';
      if (text.includes('state')) return 'state';
      if (text.includes('zip') || text.includes('postal')) return 'postal_code';
      return 'address';
    }

    // Company
    if (text.includes('company') || text.includes('organization')) {
      return 'company';
    }

    // Job Title
    if (text.includes('title') || text.includes('position') || text.includes('role')) {
      return 'job_title';
    }

    // Message/Comment
    if (type === 'textarea' || text.includes('message') || text.includes('comment') || text.includes('description')) {
      return 'message';
    }

    // Date
    if (type === 'date' || text.includes('date') || text.includes('birthday') || text.includes('birth')) {
      return 'date';
    }

    // URL/Website
    if (type === 'url' || text.includes('website') || text.includes('url') || text.includes('link')) {
      return 'url';
    }

    return 'text';
  }

  /**
   * Generate unique CSS selector for element
   */
  generateSelector(element) {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try name attribute
    if (element.name) {
      const selector = `${element.tagName.toLowerCase()}[name="${element.name}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Try aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      const selector = `[aria-label="${ariaLabel}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Try unique class combination
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        const selector = element.tagName.toLowerCase() + '.' + classes.join('.');
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }

    // Build path from root
    return this.getElementPath(element);
  }

  /**
   * Get full path to element
   */
  getElementPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      // Add index if there are siblings
      const siblings = current.parentElement ?
        Array.from(current.parentElement.children).filter(e => e.tagName === current.tagName) : [];

      if (siblings.length > 1) {
        const index = siblings.indexOf(current);
        selector += `:nth-of-type(${index + 1})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  /**
   * Get current value of field
   */
  getCurrentValue(element) {
    if (element.value !== undefined) {
      return element.value;
    }

    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
      return element.textContent || element.innerText;
    }

    if (element.type === 'checkbox') {
      return element.checked;
    }

    return '';
  }

  /**
   * Check if element is visible (Atlas-compliant)
   * Uses getBoundingClientRect() to handle CSS transforms (scale, translate, etc.)
   */
  isVisible(element) {
    // Quick check: hidden input type
    if (element.type === 'hidden') return false;

    // Check computed styles
    const style = window.getComputedStyle(element);
    if (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0') {
      return false;
    }

    // Check element has physical dimensions on screen
    // getBoundingClientRect() accounts for CSS transforms (scale, rotate, etc.)
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Check if element is interactive
   */
  isInteractive(element) {
    // Has input-like properties
    return element.isContentEditable ||
           element.tagName === 'INPUT' ||
           element.tagName === 'TEXTAREA' ||
           element.tagName === 'SELECT' ||
           element.getAttribute('role') === 'textbox' ||
           element.getAttribute('role') === 'combobox' ||
           element.getAttribute('contenteditable') === 'true';
  }

  /**
   * Check if element was already detected
   */
  isAlreadyDetected(element) {
    return this.detectedFields.some(field => field.element === element);
  }

  /**
   * Find elements with Shadow DOM
   */
  findElementsWithShadowDOM(root) {
    const result = [];

    function traverse(node) {
      if (node.shadowRoot) {
        result.push(node);
      }

      for (const child of node.children || []) {
        traverse(child);
      }
    }

    traverse(root);
    return result;
  }

  /**
   * Remove duplicate fields
   */
  deduplicateFields(fields) {
    const seen = new Set();
    const unique = [];

    fields.forEach(field => {
      const key = field.selector;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(field);
      }
    });

    return unique;
  }

  /**
   * Get summary of detected fields
   */
  getFieldSummary() {
    const summary = {
      total: this.detectedFields.length,
      byType: {},
      byPurpose: {},
      byMethod: {}
    };

    this.detectedFields.forEach(field => {
      summary.byType[field.type] = (summary.byType[field.type] || 0) + 1;
      summary.byPurpose[field.purpose] = (summary.byPurpose[field.purpose] || 0) + 1;
      summary.byMethod[field.detectionMethod] = (summary.byMethod[field.detectionMethod] || 0) + 1;
    });

    return summary;
  }

  /**
   * Humanize field name (convert camelCase/snake_case to readable)
   */
  humanizeFieldName(name) {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Export fields for sending to Chrome AI
   */
  exportForChromeAI() {
    return this.detectedFields.map(field => ({
      selector: field.selector,
      type: field.type,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      purpose: field.purpose,
      aria: field.aria,
      value: field.value,
      tagName: field.tagName,
      detectionMethod: field.detectionMethod
    }));
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormFieldDetector;
}
