// FastRamp Content Script
// Only handles messages from background script - no automatic form detection

// Listen for messages from background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'togglePanel') {
    // Toggle the panel visibility
    const panelRoot = document.getElementById('fastramp-panel-root');
    if (panelRoot) {
      const panel = panelRoot.querySelector('.fastramp-panel');
      const overlay = panelRoot.querySelector('.fastramp-overlay');
      if (panel && overlay) {
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
        overlay.style.display = isVisible ? 'none' : 'block';
      }
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'fill') {
    fillForms(request.instructions).then(result => {
      sendResponse(result);
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'save') {
    saveForms().then(result => {
      sendResponse(result);
    });
    return true; // Will respond asynchronously
  }
});

// Fill forms with data
async function fillForms(instructions) {
  try {
    // Get saved data
    const storage = await chrome.storage.local.get(['savedData']);
    const savedData = storage.savedData || {};

    // Find all input fields (exclude extension's own UI)
    const inputs = document.querySelectorAll('input:not([id^="fastramp-"]), textarea:not([id^="fastramp-"]), select:not([id^="fastramp-"])');
    let filledCount = 0;

    inputs.forEach(input => {
      // Skip hidden and button inputs
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
        return;
      }

      // Skip extension's own inputs
      if (input.closest('#fastramp-panel-root')) {
        return;
      }

      // Try to fill from saved data
      const fieldName = input.name || input.id || input.placeholder || '';

      if (savedData[fieldName]) {
        input.value = savedData[fieldName];
        input.style.backgroundColor = '#e8f5e9';
        filledCount++;
      } else {
        // Use AI to generate appropriate value
        const value = generateValue(input, instructions);
        if (value) {
          input.value = value;
          input.style.backgroundColor = '#e8f5e9';
          filledCount++;
        }
      }
    });

    return { success: true, count: filledCount };
  } catch (error) {
    console.error('Error filling forms:', error);
    return { success: false, error: error.message };
  }
}

// Save form data
async function saveForms() {
  try {
    const inputs = document.querySelectorAll('input:not([id^="fastramp-"]), textarea:not([id^="fastramp-"]), select:not([id^="fastramp-"])');
    const formData = {};
    let savedCount = 0;

    inputs.forEach(input => {
      // Skip hidden and button inputs
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
        return;
      }

      // Skip extension's own inputs
      if (input.closest('#fastramp-panel-root')) {
        return;
      }

      // Only save filled fields
      if (input.value) {
        const fieldName = input.name || input.id || input.placeholder || `field_${savedCount}`;
        formData[fieldName] = input.value;
        input.style.backgroundColor = '#fff3cd';
        savedCount++;
      }
    });

    // Save to storage
    await chrome.storage.local.set({ savedData: formData });

    return { success: true, count: savedCount };
  } catch (error) {
    console.error('Error saving forms:', error);
    return { success: false, error: error.message };
  }
}

// Generate appropriate value for input
function generateValue(input, instructions) {
  const type = input.type || 'text';
  const name = (input.name || input.id || input.placeholder || '').toLowerCase();

  // Email fields
  if (type === 'email' || name.includes('email')) {
    return 'user@example.com';
  }

  // Phone fields
  if (type === 'tel' || name.includes('phone') || name.includes('tel')) {
    return '555-0100';
  }

  // Name fields
  if (name.includes('name')) {
    if (name.includes('first')) return 'John';
    if (name.includes('last')) return 'Doe';
    if (name.includes('full')) return 'John Doe';
    return 'John Doe';
  }

  // Address fields
  if (name.includes('address') || name.includes('street')) {
    return '123 Main Street';
  }

  if (name.includes('city')) {
    return 'New York';
  }

  if (name.includes('state')) {
    return 'NY';
  }

  if (name.includes('zip') || name.includes('postal')) {
    return '10001';
  }

  // Date fields
  if (type === 'date') {
    return new Date().toISOString().split('T')[0];
  }

  // Number fields
  if (type === 'number') {
    return '1';
  }

  // URL fields
  if (type === 'url' || name.includes('website') || name.includes('url')) {
    return 'https://example.com';
  }

  // Default text
  if (type === 'text' || type === 'textarea') {
    return 'Sample text';
  }

  return '';
}
