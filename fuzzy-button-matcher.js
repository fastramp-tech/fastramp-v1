/**
 * Fuzzy Button Matcher for Multi-Page Forms
 *
 * Intelligently finds "Next", "Continue", "Submit" buttons even when:
 * - Text is slightly different ("Next" vs "Next Step")
 * - Case varies ("CONTINUE" vs "Continue")
 * - Extra symbols exist ("Next →" vs "Next")
 * - Buttons are styled as <div> instead of <button>
 *
 * Adapted from: clickByText.tsx fuzzy matching algorithm
 */

class FuzzyButtonMatcher {
  /**
   * Calculate text similarity between two strings (0-100 score)
   *
   * @param {string} a - Target text (what we're looking for)
   * @param {string} b - Element text (what's on the page)
   * @returns {number} - Similarity score (0-100)
   */
  textSimilarity(a, b) {
    // Normalize both strings
    a = a.toLowerCase().trim();
    b = b.toLowerCase().trim();

    // LEVEL 1: Exact match (after normalization)
    if (a === b) {
      return 100;  // ✅ "next" === "next" → 100%
    }

    // LEVEL 2: Contains check (substring match)
    if (a.includes(b) || b.includes(a)) {
      return 80;  // ✅ "next step →" contains "next" → 80%
    }

    // LEVEL 3: Word overlap (smart partial matching)
    const wordsA = a.split(/\s+/);  // Split by whitespace
    const wordsB = b.split(/\s+/);
    let matchingWords = 0;

    for (const wordB of wordsB) {
      if (wordsA.some(wordA => wordA.includes(wordB) || wordB.includes(wordA))) {
        matchingWords++;
      }
    }

    if (matchingWords > 0) {
      // Calculate percentage of matching words
      const overlapPercentage = matchingWords / wordsB.length;
      return overlapPercentage * 60;  // Max 60 points for partial match
    }

    // LEVEL 4: Character overlap (Levenshtein-like)
    const maxLength = Math.max(a.length, b.length);
    const commonChars = this.countCommonCharacters(a, b);
    if (commonChars / maxLength > 0.5) {
      return 40;  // Some similarity exists
    }

    return 0;  // No match
  }

  /**
   * Count common characters between two strings
   */
  countCommonCharacters(a, b) {
    const charsA = a.split('');
    const charsB = b.split('');
    let count = 0;

    for (const char of charsA) {
      const index = charsB.indexOf(char);
      if (index !== -1) {
        count++;
        charsB.splice(index, 1);  // Remove to avoid double-counting
      }
    }

    return count;
  }

  /**
   * Find the best matching button for multi-page form navigation
   *
   * @param {string} targetText - What we're looking for (e.g., "next", "continue", "submit")
   * @param {string} buttonType - Type of button: "next", "previous", "submit"
   * @returns {Element|null} - The best matching button element
   */
  findNavigationButton(targetText = null, buttonType = 'next') {
    console.log(`🔍 [FuzzyMatcher] Finding ${buttonType} button...`);

    // Define common patterns for each button type
    const patterns = {
      next: ['next', 'continue', 'proceed', 'forward', 'go', 'siguiente', 'suivant'],
      previous: ['previous', 'back', 'anterior', 'précédent'],
      submit: ['submit', 'send', 'complete', 'finish', 'done', 'enviar', 'envoyer']
    };

    // If no specific text provided, search for common patterns
    const searchTexts = targetText ? [targetText] : patterns[buttonType] || [];

    // Find all potential button elements
    const candidates = this.findAllButtonElements();

    console.log(`   Found ${candidates.length} button candidates`);

    // Score each candidate
    const scoredCandidates = [];

    for (const candidate of candidates) {
      const text = this.getElementText(candidate);
      let bestScore = 0;
      let matchedPattern = '';

      // Test against all search patterns
      for (const searchText of searchTexts) {
        const score = this.calculateElementScore(candidate, text, searchText, buttonType);
        if (score > bestScore) {
          bestScore = score;
          matchedPattern = searchText;
        }
      }

      // Only consider candidates with score >= 30
      if (bestScore >= 30) {
        scoredCandidates.push({
          element: candidate,
          score: bestScore,
          text: text,
          matchedPattern: matchedPattern
        });
      }
    }

    // Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Log results
    console.log(`   Scored ${scoredCandidates.length} matches:`);
    scoredCandidates.slice(0, 5).forEach((c, i) => {
      console.log(`   ${i + 1}. "${c.text}" (score: ${c.score}, pattern: "${c.matchedPattern}")`);
    });

    // Return best match
    if (scoredCandidates.length > 0) {
      const best = scoredCandidates[0];
      console.log(`✅ [FuzzyMatcher] Selected: "${best.text}" (score: ${best.score})`);
      return best.element;
    }

    console.log(`❌ [FuzzyMatcher] No matching button found`);
    return null;
  }

  /**
   * Find all potential button elements on the page
   */
  findAllButtonElements() {
    const candidates = [];

    // Strategy 1: Actual <button> elements
    const buttons = document.querySelectorAll('button:not([type="hidden"])');
    candidates.push(...Array.from(buttons));

    // Strategy 2: <input type="submit|button">
    const inputs = document.querySelectorAll('input[type="submit"], input[type="button"]');
    candidates.push(...Array.from(inputs));

    // Strategy 3: Links that look like buttons
    const links = document.querySelectorAll('a[role="button"], a.btn, a.button');
    candidates.push(...Array.from(links));

    // Strategy 4: Divs/spans with button-like attributes
    const divButtons = document.querySelectorAll('[role="button"], .btn, .button, [onclick]');
    candidates.push(...Array.from(divButtons));

    // Strategy 5: ARIA buttons
    const ariaButtons = document.querySelectorAll('[aria-label*="next"], [aria-label*="continue"], [aria-label*="submit"]');
    candidates.push(...Array.from(ariaButtons));

    // Remove duplicates and hidden elements (Atlas-compliant visibility check)
    return [...new Set(candidates)].filter(el => {
      // Skip hidden input types
      if (el.type === 'hidden') return false;

      // Check computed styles
      const style = window.getComputedStyle(el);
      if (style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0') {
        return false;
      }

      // Check physical dimensions (getBoundingClientRect handles CSS transforms)
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  /**
   * Get text content from element
   */
  getElementText(element) {
    // Try aria-label first (most semantic)
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // Try value (for input buttons)
    if (element.value) return element.value.trim();

    // Try textContent
    const text = element.textContent.trim();
    if (text) return text;

    // Try alt/title
    return element.getAttribute('alt') || element.getAttribute('title') || '';
  }

  /**
   * Calculate comprehensive score for an element
   *
   * @param {Element} element - The candidate element
   * @param {string} text - Element's text content
   * @param {string} searchText - What we're searching for
   * @param {string} buttonType - Expected button type (next/previous/submit)
   * @returns {number} - Total score
   */
  calculateElementScore(element, text, searchText, buttonType) {
    // Base score from text similarity
    let score = this.textSimilarity(text, searchText);

    // Must meet minimum threshold
    if (score < 30) return 0;

    const tagName = element.tagName.toLowerCase();
    const rect = element.getBoundingClientRect();

    // BONUS 1: Semantic HTML (+20 points)
    if (tagName === 'button' || (tagName === 'input' && element.type === 'submit')) {
      score += 20;
    }

    // BONUS 2: Appropriate size (+10 points)
    if (rect.width > 50 && rect.height > 20) {
      score += 10;
    }

    // BONUS 3: Position-based bonuses
    if (buttonType === 'next' || buttonType === 'submit') {
      // "Next" buttons are usually on the right or bottom
      const isRightAligned = rect.right > window.innerWidth * 0.6;
      const isBottomAligned = rect.bottom > window.innerHeight * 0.5;

      if (isRightAligned || isBottomAligned) {
        score += 5;
      }
    } else if (buttonType === 'previous') {
      // "Back" buttons are usually on the left
      const isLeftAligned = rect.left < window.innerWidth * 0.4;
      if (isLeftAligned) {
        score += 5;
      }
    }

    // BONUS 4: Primary button styling (+15 points)
    const classList = Array.from(element.classList);
    const hasPrimaryClass = classList.some(c =>
      c.includes('primary') ||
      c.includes('main') ||
      c.includes('cta') ||
      c.includes('action')
    );
    if (hasPrimaryClass) {
      score += 15;
    }

    // BONUS 5: Not a cancel/close button (+10 points if correct type)
    const isNegativeButton = text.toLowerCase().match(/cancel|close|dismiss|skip/);
    if (!isNegativeButton) {
      score += 10;
    } else if (buttonType === 'next' || buttonType === 'submit') {
      // PENALTY: This is a cancel button but we're looking for next/submit
      score -= 40;
    }

    // BONUS 6: Has forward arrow symbols (+5 points for next buttons)
    if (buttonType === 'next' && text.match(/→|>|»|➔|▶/)) {
      score += 5;
    }

    // BONUS 7: Has backward arrow symbols (+5 points for previous buttons)
    if (buttonType === 'previous' && text.match(/←|<|«|◀/)) {
      score += 5;
    }

    // PENALTY 1: Wrong button type attribute
    if (element.type === 'button' && buttonType === 'submit') {
      score -= 10;  // Expected submit, got generic button
    }

    // PENALTY 2: Disabled buttons
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
      score -= 50;  // Heavily penalize disabled buttons
    }

    return Math.max(0, score);  // Never negative
  }

  /**
   * Click the best matching navigation button
   *
   * @param {string} buttonType - Type: "next", "previous", "submit"
   * @param {string} customText - Optional custom search text
   * @returns {boolean} - True if button was found and clicked
   */
  clickNavigationButton(buttonType = 'next', customText = null) {
    const button = this.findNavigationButton(customText, buttonType);

    if (button) {
      console.log(`🖱️  [FuzzyMatcher] Clicking button:`, button);

      // Scroll into view
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Wait a bit for scroll
      setTimeout(() => {
        button.click();
        console.log(`✅ [FuzzyMatcher] Button clicked successfully`);
      }, 500);

      return true;
    }

    return false;
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FuzzyButtonMatcher;
}

// LAZY LOAD: Don't instantiate immediately - only create when accessed
// This prevents interference with other features during page load
// Wrap in try-catch to prevent any errors from breaking other scripts
(function() {
  try {
    Object.defineProperty(window, 'fuzzyButtonMatcher', {
      get: function() {
        if (!this._fuzzyButtonMatcherInstance) {
          console.log('⚡ Lazy-loading FuzzyButtonMatcher...');
          this._fuzzyButtonMatcherInstance = new FuzzyButtonMatcher();
        }
        return this._fuzzyButtonMatcherInstance;
      },
      configurable: true
    });
  } catch (error) {
    console.error('Failed to initialize fuzzyButtonMatcher:', error);
  }
})();
