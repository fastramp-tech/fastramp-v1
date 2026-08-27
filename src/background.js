// Background service worker for AI form processing
// Google Chrome AI Hackathon 2025 - Using Firebase AI Logic SDK (OFFICIAL)

// ES6 Module Imports - Firebase AI Logic SDK (from npm package, bundled with webpack)
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel } from 'firebase/ai';

// Import StorageManager for local/cloud storage abstraction
import StorageManager from './storage-manager.js';

// Import Gemini Live Voice Handler
import GeminiLiveVoiceHandler from './gemini-live-voice.js';

// ===================================
// DEBUG MODE UTILITY
// ===================================
// Global debug mode flag
let DEBUG_MODE = false;

// Load debug mode from storage
chrome.storage.sync.get(['debugMode'], (result) => {
  DEBUG_MODE = result.debugMode === true;
});

// Listen for debug mode changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.debugMode) {
    DEBUG_MODE = changes.debugMode.newValue === true;
    debugLog('🐛 Debug mode updated:', DEBUG_MODE);
  }
});

// Centralized debug logging functions
function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

function debugLogStyled(message, style) {
  if (DEBUG_MODE) {
    console.log(message, style);
  }
}

function debugWarn(...args) {
  if (DEBUG_MODE) {
    console.warn(...args);
  }
}

// Always show errors
function debugError(...args) {
  console.error(...args);
}

// Firebase Configuration (from firebase-config.js) - Replace with your own values
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase AI Logic SDK - OFFICIAL IMPLEMENTATION
let firebaseApp = null;
let firebaseAI = null;
let isFirebaseInitialized = false;

/**
 * Initialize Firebase AI Logic SDK (OFFICIAL)
 *
 * Documentation: https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference
 *
 * HYBRID INFERENCE MODES:
 * ✅ PREFER_ON_DEVICE (small forms ≤6000 tokens):
 *    - Primary: Chrome AI (Gemini Nano on-device)
 *    - Automatic fallback: Gemini Cloud API
 *
 * ✅ ONLY_IN_CLOUD (large/complex forms >6000 tokens):
 *    - Uses: Gemini Cloud API only
 *    - Reason: Exceeds on-device token limits
 *
 * This is the OFFICIAL Firebase AI Logic SDK implementation (required for hackathon qualification)
 */
async function initializeFirebase() {
  try {
    debugLog('🔥 Initializing Firebase AI Logic SDK...');

    // Step 1: Initialize Firebase App
    firebaseApp = initializeApp(FIREBASE_CONFIG);
    debugLog('   ✅ Firebase App initialized');

    // Step 2: Initialize Firebase AI service
    firebaseAI = getAI(firebaseApp);
    debugLog('   ✅ Firebase AI service initialized');

    isFirebaseInitialized = true;

    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('🎯 FIREBASE AI LOGIC SDK READY (OFFICIAL)');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('   Hybrid inference modes available:');
    debugLog('   • PREFER_ON_DEVICE: Small forms (≤6000 tokens)');
    debugLog('   • ONLY_IN_CLOUD: Large forms (>6000 tokens)');
    debugLog('   Automatic fallback: On-device → Cloud');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return true;
  } catch (error) {
    console.error('❌ Firebase AI Logic SDK initialization failed:', error);
    isFirebaseInitialized = false;
    return false;
  }
}

// Initialize on startup
initializeFirebase().then(success => {
  if (success) {
    debugLog('🎯 Firebase hybrid inference ready for form analysis');
  } else {
    debugLog('⚙️ Running without Firebase configuration');
  }
});

// Google Cloud Configuration
const GOOGLE_CLOUD_CONFIG = {
  // Google Cloud Function for PDF extraction
  extractPdfUrl: 'https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/extract-pdf-text',

  // Google Cloud Function for LinkedIn scraping (simple proxy to Toolhouse)
  scrapeLinkedInUrl: 'https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/scrape-linkedin',

  // Gemini API for embeddings (requires API key from user)
  geminiEmbeddingUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',

  // Chrome AI APIs (built-in, no API key needed)
  useChromeAI: true
};

// Initialize StorageManager (supports both local and cloud storage)
const storageManager = new StorageManager();
storageManager.init().then(() => {
  debugLog(`📦 StorageManager ready: mode=${storageManager.getMode()}`);
});

debugLog('🚀 FastRamp Background Worker Started (Google Cloud + Chrome AI)');
debugLog('✨ Using Chrome Prompt API (Gemini Nano) + Google Cloud Functions');

// Message handler for content script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugLog('📨 Background received message:', request.action);

  // Handle different actions
  switch (request.action) {
    case 'extractPdfText':
      handleExtractPdfText(request, sendResponse);
      return true; // Keep channel open for async response

    case 'embedDocument':
      handleEmbedDocument(request, sendResponse);
      return true;

    case 'embedText':
      handleEmbedText(request, sendResponse);
      return true;

    case 'searchKnowledgeBase':
      handleSearchKnowledgeBase(request, sendResponse);
      return true;

    case 'queryWithChromeAI':
      handleQueryWithChromeAI(request, sendResponse);
      return true;

    case 'analyzeFormWithChromeAI':
      handleAnalyzeFormWithChromeAI(request, sendResponse);
      return true;

    case 'getApiKey':
      handleGetApiKey(request, sendResponse);
      return true;

    case 'saveApiKey':
      handleSaveApiKey(request, sendResponse);
      return true;

    case 'getStorageMode':
      handleGetStorageMode(request, sendResponse);
      return true;

    case 'setStorageMode':
      handleSetStorageMode(request, sendResponse);
      return true;

    case 'getStorageUsage':
      handleGetStorageUsage(request, sendResponse);
      return true;

    case 'getEmbeddings':
      handleGetEmbeddings(request, sendResponse);
      return true;

    case 'deleteEmbeddings':
      handleDeleteEmbeddings(request, sendResponse);
      return true;

    case 'checkGeminiLiveSupport':
      handleCheckGeminiLiveSupport(request, sendResponse);
      return true;

    default:
      console.warn('⚠️ Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

/**
 * Extract PDF text using Google Cloud Function
 */
async function handleExtractPdfText(request, sendResponse) {
  try {
    debugLog('📄 Extracting PDF text via Google Cloud Function...');

    // Support both pdfData and base64Content field names
    const base64Content = request.pdfData || request.base64Content;
    const fileName = request.fileName;

    debugLog(`   Filename: ${fileName}`);
    debugLog(`   Base64 length: ${base64Content?.length || 0} characters`);

    // Try different payload formats for the Google Cloud Function
    // Some Cloud Functions expect 'pdf_base64', others 'file', others 'data'
    const payload = {
      pdf_base64: base64Content,
      file: base64Content,
      data: base64Content,
      filename: fileName,
      name: fileName
    };

    debugLog('🌐 Calling Google Cloud Function...');

    const response = await fetch(GOOGLE_CLOUD_CONFIG.extractPdfUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    debugLog(`📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Cloud Function error:', errorText);
      console.error('❌ Response status:', response.status);
      throw new Error(`PDF extraction failed: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();

    debugLog('✅ PDF text extracted successfully');
    debugLog(`   Text length: ${result.text?.length || 0} characters`);

    sendResponse({
      success: true,
      text: result.text,
      pageCount: result.pageCount || 1
    });

  } catch (error) {
    console.error('❌ Error extracting PDF:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Check if a chunk is a duplicate based on embedding similarity
 * @param {Array} newEmbedding - Embedding vector for the new chunk
 * @param {Array} existingChunks - Array of existing chunks with embeddings
 * @param {number} threshold - Similarity threshold (default 0.95 = 95%)
 * @returns {Object} {isDuplicate: boolean, matchedChunk: object, similarity: number}
 */
function isDuplicateChunk(newEmbedding, existingChunks, threshold = 0.95) {
  for (const existingChunk of existingChunks) {
    const similarity = cosineSimilarity(newEmbedding, existingChunk.embedding);

    if (similarity >= threshold) {
      return {
        isDuplicate: true,
        matchedChunk: existingChunk,
        similarity: similarity
      };
    }
  }

  return { isDuplicate: false, similarity: 0 };
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} vecA - First vector
 * @param {Array} vecB - Second vector
 * @returns {number} Similarity score between 0 and 1
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

  return magA === 0 || magB === 0 ? 0 : dotProduct / (magA * magB);
}

/**
 * Embed document using Gemini Embeddings
 * Stores in Chrome Local Storage (10MB limit)
 */
async function handleEmbedDocument(request, sendResponse) {
  try {
    debugLog('📄 Embedding document:', request.fileName);
    debugLog('┌─────────────────────────────────────────────');

    const { fileName, content, apiKey } = request;

    if (!apiKey) {
      throw new Error('Gemini API key is required. Please set it in the panel.');
    }

    // PHASE 1: Check if filename already exists (Overwrite Mode)
    // Use storageManager to retrieve embeddings (respects local/cloud mode)
    const existingKB = await storageManager.retrieveEmbeddings();
    const syncStorage = await chrome.storage.sync.get(['documentMetadata']);
    const existingMetadata = syncStorage.documentMetadata || [];

    const existingDoc = existingMetadata.find(doc => doc.fileName === fileName);
    let isOverwrite = false;
    let oldChunksCount = 0;

    if (existingDoc) {
      isOverwrite = true;
      const oldChunks = existingKB.filter(chunk => chunk.fileName === fileName);
      oldChunksCount = oldChunks.length;

      debugLog('│ 📝 OVERWRITE MODE: File already exists');
      debugLog(`│    Removing ${oldChunksCount} old chunks...`);

      // Remove old chunks and metadata using storageManager
      await storageManager.deleteEmbeddings(fileName);

      // Update metadata in sync storage
      const cleanedMetadata = existingMetadata.filter(doc => doc.fileName !== fileName);
      await chrome.storage.sync.set({ documentMetadata: cleanedMetadata });

      debugLog('│    ✅ Old data removed - ready for fresh upload');
    }

    // Split content into chunks (500 characters)
    debugLog('│ Step 1/4: Chunking text...');
    const chunks = chunkText(content, 500);
    debugLog(`│ ✓ Split into ${chunks.length} chunks`);

    const embeddedChunks = [];
    const skippedChunks = [];

    // Get current knowledge base for deduplication (after potential cleanup)
    // Use storageManager to retrieve embeddings (respects local/cloud mode)
    const currentKB = await storageManager.retrieveEmbeddings();

    // Embed each chunk using Gemini
    debugLog('│ Step 2/4: Creating embeddings with Gemini...');
    if (!isOverwrite && currentKB.length > 0) {
      debugLog(`│    ℹ️  Content deduplication enabled - checking against ${currentKB.length} existing chunks`);
    }
    const embeddingErrors = [];

    for (let i = 0; i < chunks.length; i++) {
      debugLog(`│   → Chunk ${i + 1}/${chunks.length}: Calling Gemini API`);

      try {
        const embedding = await getGeminiEmbedding(chunks[i], apiKey);
        debugLog(`│   ✓ Chunk ${i + 1}/${chunks.length}: Embedding created (${embedding.length} dimensions)`);

        // PHASE 2: Content-based deduplication (skip if overwrite mode or no existing chunks)
        if (!isOverwrite && currentKB.length > 0) {
          const duplicateCheck = isDuplicateChunk(embedding, currentKB, 0.95);

          if (duplicateCheck.isDuplicate) {
            debugLog(`│   ⏭️  Chunk ${i + 1}/${chunks.length}: DUPLICATE detected (${(duplicateCheck.similarity * 100).toFixed(1)}% similar to "${duplicateCheck.matchedChunk.fileName}")`);

            skippedChunks.push({
              chunkIndex: i,
              text: chunks[i].substring(0, 50) + '...',
              similarity: duplicateCheck.similarity,
              matchedSource: duplicateCheck.matchedChunk.fileName
            });

            continue; // Skip storing this chunk
          }
        }

        // Not a duplicate - store it
        embeddedChunks.push({
          fileName: fileName,
          chunkIndex: i,
          text: chunks[i],
          embedding: embedding,
          timestamp: Date.now()
        });

        debugLog(`│   ✅ Chunk ${i + 1}/${chunks.length}: Stored (unique content)`);

      } catch (error) {
        console.error(`│   ❌ Chunk ${i + 1}/${chunks.length}: Failed -`, error.message);
        embeddingErrors.push({ chunk: i + 1, error: error.message });
        // Continue with other chunks
      }
    }

    debugLog(`│ ✓ Step 2/4 Complete: ${embeddedChunks.length}/${chunks.length} chunks embedded`);

    if (skippedChunks.length > 0) {
      debugLog(`│   📊 Deduplication: ${skippedChunks.length} duplicate chunks skipped`);
      debugLog(`│   💾 Storage saved: ${((skippedChunks.length / chunks.length) * 100).toFixed(1)}%`);
    }

    if (embeddedChunks.length === 0) {
      console.error('│ ❌ CRITICAL: NO chunks were embedded!');
      console.error('│ ❌ All embedding API calls failed');
      console.error('│ ❌ Errors:', embeddingErrors);
      throw new Error(`Failed to embed any chunks. First error: ${embeddingErrors[0]?.error || 'Unknown'}`);
    }

    if (embeddingErrors.length > 0) {
      console.warn(`│ ⚠️ ${embeddingErrors.length} chunks failed to embed`);
    }

    // Store using StorageManager (supports local or cloud storage)
    debugLog('│ Step 3/4: Storing embeddings...');
    const documentId = `doc_${Date.now()}`;
    const metadata = {
      fileName: fileName,
      documentId: documentId,
      chunksProcessed: embeddedChunks.length,
      uploadedAt: Date.now(),
      storageLocation: storageManager.getMode()
    };

    const saveResult = await storageManager.saveEmbeddings(fileName, embeddedChunks, metadata);
    debugLog(`│ ✓ Step 3/4 Complete: Stored ${embeddedChunks.length} chunks in ${saveResult.storage} storage`);

    // ALWAYS save metadata to chrome.storage.sync (for UI state tracking)
    debugLog('│ Step 4/4: Saving metadata to chrome.storage.sync...');
    const metadataSyncStorage = await chrome.storage.sync.get(['documentMetadata']);
    let metadataList = metadataSyncStorage.documentMetadata || [];

    // Remove old metadata for this file (if exists)
    metadataList = metadataList.filter(m => m.fileName !== fileName);

    // Add new metadata
    metadataList.push(metadata);

    await chrome.storage.sync.set({ documentMetadata: metadataList });
    debugLog(`│ ✓ Step 4/4 Complete: Metadata saved (${metadataList.length} documents tracked)`);

    debugLog(`└─────────────────────────────────────────────`);

    if (isOverwrite) {
      debugLog(`✏️  Successfully UPDATED ${fileName}: ${oldChunksCount} old → ${embeddedChunks.length} new chunks`);
    } else if (skippedChunks.length > 0) {
      debugLog(`✅ Successfully embedded ${embeddedChunks.length} NEW chunks for ${fileName}`);
      debugLog(`   📊 ${skippedChunks.length} duplicates skipped - ${((skippedChunks.length / chunks.length) * 100).toFixed(1)}% storage saved`);
    } else {
      debugLog(`✅ Successfully embedded ${embeddedChunks.length} chunks for ${fileName}`);
    }

    sendResponse({
      success: true,
      chunksEmbedded: embeddedChunks.length,
      chunksProcessed: embeddedChunks.length,
      totalChunks: chunks.length,
      documentId: documentId,
      storageKey: fileName,
      fileName: fileName,
      storage: saveResult.storage,  // 'local' or 'cloud'
      storageUrl: saveResult.storageUrl,  // Only for cloud
      // Deduplication stats
      isOverwrite: isOverwrite,
      oldChunksCount: isOverwrite ? oldChunksCount : undefined,
      duplicatesSkipped: skippedChunks.length,
      newChunks: embeddedChunks.length,
      storageEfficiency: skippedChunks.length > 0
        ? `${((skippedChunks.length / chunks.length) * 100).toFixed(1)}% saved`
        : undefined
    });

  } catch (error) {
    console.error('❌ Error embedding document:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Search knowledge base using cosine similarity
 */
async function handleSearchKnowledgeBase(request, sendResponse) {
  try {
    debugLog('🔍 Searching knowledge base...');

    const { query, apiKey } = request;

    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    // Get query embedding
    debugLog('   Creating query embedding...');
    const queryEmbedding = await getGeminiEmbedding(query, apiKey, 'RETRIEVAL_QUERY');

    // Get stored chunks using storageManager (respects local/cloud mode)
    const knowledgeBase = await storageManager.retrieveEmbeddings();

    if (knowledgeBase.length === 0) {
      debugLog('   ⚠️ Knowledge base is empty');
      sendResponse({ success: true, results: [] });
      return;
    }

    debugLog(`   Searching through ${knowledgeBase.length} chunks...`);

    // Calculate cosine similarity for each chunk
    const results = knowledgeBase.map(chunk => ({
      ...chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .filter(r => r.similarity > 0.3) // Filter low similarity
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5); // Top 5 results

    debugLog(`✅ Found ${results.length} relevant chunks`);
    results.forEach((r, i) => {
      debugLog(`   ${i + 1}. ${r.fileName} (chunk ${r.chunkIndex}) - similarity: ${r.similarity.toFixed(3)}`);
    });

    sendResponse({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('❌ Error searching knowledge base:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Query Chrome AI (Prompt API) - Uses Gemini Nano locally
 */
async function handleQueryWithChromeAI(request, sendResponse) {
  try {
    debugLog('🤖 Querying Chrome AI (Gemini Nano)...');

    const { prompt, context } = request;

    // Check if Chrome AI is available (official API)
    if (typeof LanguageModel === 'undefined') {
      throw new Error('Chrome AI is not available on this device');
    }

    const {available} = await LanguageModel.params();

    if (available === "no") {
      throw new Error('Chrome AI is not available on this device');
    }

    if (available === "after-download") {
      debugLog('⏳ Chrome AI model needs to be downloaded...');
      sendResponse({
        success: false,
        error: 'Chrome AI model needs to be downloaded. Please wait for download to complete.',
        needsDownload: true
      });
      return;
    }

    debugLog('   Creating AI session...');
    const session = await LanguageModel.create({
      systemPrompt: context || "You are a helpful assistant that answers questions based on the provided context."
    });

    debugLog('   Sending prompt to Gemini Nano...');
    const result = await session.prompt(prompt);

    debugLog('✅ Response received from Chrome AI');
    debugLog(`   Response length: ${result.length} characters`);

    // Clean up session
    session.destroy();

    sendResponse({
      success: true,
      response: result
    });

  } catch (error) {
    console.error('❌ Error querying Chrome AI:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Analyze form using JavaScript (fallback when Chrome AI not available)
 * TIER 3: Last resort - always works but less accurate than AI methods
 */
function analyzeFormWithJavaScript(pageHTML) {
  debugLog('📋 JavaScript Fallback Analysis Starting...');
  debugLog('   Method: DOM-based form field detection');
  debugLog('   Advantage: Works on any browser, no AI required');
  debugLog('   Limitation: Cannot infer field meaning from context');
  debugLog('');

  // Create a temporary DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(pageHTML, 'text/html');

  const detectedFields = [];

  // Find all form fields
  const inputs = doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
  const textareas = doc.querySelectorAll('textarea');
  const selects = doc.querySelectorAll('select');

  debugLog('🔍 Scanning DOM for form elements...');
  debugLog(`   Found ${inputs.length} <input> elements`);
  debugLog(`   Found ${textareas.length} <textarea> elements`);
  debugLog(`   Found ${selects.length} <select> elements`);

  // Process inputs
  inputs.forEach(input => {
    const field = extractFieldInfo(input, doc);
    if (field) detectedFields.push(field);
  });

  // Process textareas
  textareas.forEach(textarea => {
    const field = extractFieldInfo(textarea, doc);
    if (field) detectedFields.push(field);
  });

  // Process selects
  selects.forEach(select => {
    const field = extractFieldInfo(select, doc);
    if (field) detectedFields.push(field);
  });

  debugLog('');
  debugLog(`✅ Successfully extracted ${detectedFields.length} form fields`);
  debugLog('📊 Confidence: 85% (JavaScript detection)');
  debugLog('💡 For better accuracy, enable Firebase AI or Chrome AI');

  return {
    detectedFields: detectedFields,
    formPurpose: 'Form detected (JavaScript analysis)',
    confidence: 0.85
  };
}

/**
 * Extract field information from an element
 */
function extractFieldInfo(element, doc) {
  const tagName = element.tagName.toLowerCase();
  const type = element.type || tagName;
  const id = element.id;
  const name = element.name;
  const placeholder = element.placeholder;
  const ariaLabel = element.getAttribute('aria-label');
  const required = element.required || element.getAttribute('aria-required') === 'true';

  // Try to find label
  let label = '';

  // 1. Try aria-label
  if (ariaLabel) {
    label = ariaLabel;
  }
  // 2. Try associated label element
  else if (id) {
    const labelElement = doc.querySelector(`label[for="${id}"]`);
    if (labelElement) {
      label = labelElement.textContent.trim();
    }
  }
  // 3. Try parent label
  if (!label) {
    const parentLabel = element.closest('label');
    if (parentLabel) {
      label = parentLabel.textContent.trim();
    }
  }
  // 4. Try placeholder
  if (!label && placeholder) {
    label = placeholder;
  }
  // 5. Try name attribute
  if (!label && name) {
    label = name.replace(/[-_]/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  }
  // 6. Fallback to id
  if (!label && id) {
    label = id.replace(/[-_]/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  }

  // Skip if no label found
  if (!label) {
    return null;
  }

  // Create selector
  let selector = '';
  if (id) {
    selector = `#${id}`;
  } else if (name) {
    selector = `${tagName}[name="${name}"]`;
  } else {
    // Use a more complex selector
    selector = tagName;
    if (type !== tagName) selector += `[type="${type}"]`;
    if (placeholder) selector += `[placeholder="${placeholder}"]`;
  }

  return {
    selector: selector,
    type: type === 'select-one' ? 'select' : type,
    label: label,
    required: required,
    suggestedValue: null // Will be filled by knowledge base search
  };
}

/**
 * Analyze form using Gemini API Cloud (for large forms > 6000 tokens)
 */
async function analyzeFormWithGeminiCloud(pageHTML, apiKey, knowledgeBaseContext, customInstructions) {
  debugLog('☁️  Analyzing form with Gemini API Cloud...');

  const prompt = `Analyze this HTML and detect all form fields. Look for:
- <input>, <textarea>, <select> elements
- Elements with role="textbox", role="radiogroup", role="checkbox"
- ARIA labels (aria-label, aria-labelledby)
- ContentEditable elements

PRIORITY SYSTEM:
1. DEFAULT: Use knowledge base for ALL fields
2. OVERRIDE: If custom instructions explicitly override a field, use that instead
3. NULL: Only if not in knowledge base AND not in custom instructions

${knowledgeBaseContext ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 KNOWLEDGE BASE (PRIMARY SOURCE - DEFAULT):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${knowledgeBaseContext.substring(0, 30000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXTRACT ALL fields from knowledge base BY DEFAULT:
- "First name"/"Given name" → first name from documents
- "Last name"/"Surname" → last name from documents
- "Full name" → full name from documents
- "Email" → email from documents
- "Company" → company from documents
- "Job title" → job title from documents

ALWAYS use knowledge base UNLESS custom instructions override!
` : ''}

${customInstructions ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CUSTOM INSTRUCTIONS (OVERRIDES ONLY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${customInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use these to OVERRIDE knowledge base ONLY when explicitly stated:
- "Devpost username is X" → OVERRIDE Devpost username (use X, not from KB)
- "use email@x.com for non-work" → OVERRIDE non-work email fields (use this, not from KB)

If custom instructions DON'T mention a field:
→ USE KNOWLEDGE BASE (default source)
→ Example: "first name" not in custom → use first name from knowledge base
` : ''}

Return ONLY valid JSON in this exact format:
{
  "detectedFields": [
    {
      "selector": "CSS selector for the field",
      "type": "text|email|number|radio|checkbox|select|textarea",
      "label": "Field label text",
      "required": true/false,
      "suggestedValue": "extracted value from knowledge base or null"
    }
  ],
  "formPurpose": "description of the form",
  "confidence": 0.95
}

HTML to analyze:
${pageHTML}

Return the JSON response now.`;

  try {
    // CRITICAL: Standard model names not working with REST API
    // Using experimental model based on official SDK examples
    // Model name from official docs: https://ai.google.dev/gemini-api/docs/models/gemini
    // TODO: Replace with Firebase AI Logic (mandatory for hackathon - see firebase-config.js)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192  // Increased for large forms
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.candidates[0].content.parts[0].text;

    debugLog('   Raw Gemini Cloud response:', text.substring(0, 500));

    // Parse JSON from response
    let analysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini Cloud response as JSON:', parseError);
      throw new Error('Gemini API returned invalid JSON format');
    }

    debugLog(`✅ Detected ${analysis.detectedFields?.length || 0} fields with Gemini Cloud`);

    return analysis;

  } catch (error) {
    console.error('❌ Gemini Cloud API error:', error);
    throw error;
  }
}

/**
 * Analyze form using Hybrid AI Strategy
 *
 * UPDATED FOR HACKATHON - Priority order:
 * 1. Firebase AI Logic (PREFERRED - Qualifies for hackathon prize)
 *    - Automatic hybrid inference (on-device + cloud)
 *    - API key managed server-side
 *    - No client-side API key needed
 *
 * 2. Manual Hybrid (FALLBACK if Firebase not configured)
 *    - Small forms (< 6000 tokens): Chrome AI (Gemini Nano)
 *    - Large forms (> 6000 tokens): Gemini API Cloud
 *    - Requires user API key for large forms
 *
 * 3. JavaScript (LAST RESORT if all AI methods fail)
 *    - DOM-based form field detection
 *    - Always works, but less accurate
 */
async function handleAnalyzeFormWithChromeAI(request, sendResponse) {
  try {
    const { url, pageHTML, apiKey, knowledgeBaseContext, customInstructions } = request;

    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('🔍 FORM ANALYSIS STARTING');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(`   URL: ${url}`);
    debugLog(`   HTML length: ${pageHTML?.length || 0} characters`);
    debugLog(`   Knowledge base: ${knowledgeBaseContext ? `${knowledgeBaseContext.length} characters ✅` : 'Not provided'}`);
    debugLog(`   Custom instructions: ${customInstructions ? `"${customInstructions}" ✅` : 'None provided'}`);

    // Estimate tokens (rough: 4 chars = 1 token)
    const estimatedTokens = Math.ceil(pageHTML.length / 4);
    const kbTokens = knowledgeBaseContext ? Math.ceil(knowledgeBaseContext.length / 4) : 0;
    debugLog(`   Estimated tokens: ${estimatedTokens} (form) + ${kbTokens} (knowledge base) = ${estimatedTokens + kbTokens} total`);
    debugLog('');

    // ========================================
    // STRATEGY 1: Firebase AI Logic (PREFERRED)
    // ========================================
    debugLog('📋 THREE-TIER STRATEGY:');
    debugLog('   1️⃣  Firebase AI Logic (PREFERRED)');
    debugLog('   2️⃣  Manual Hybrid (FALLBACK)');
    debugLog('   3️⃣  JavaScript (LAST RESORT)');
    debugLog('');

    if (isFirebaseInitialized) {
      debugLog('╔═══════════════════════════════════════════╗');
      debugLog('║  🎯 TIER 1: FIREBASE AI LOGIC             ║');
      debugLog('╚═══════════════════════════════════════════╝');
      debugLog('✅ Firebase AI Logic initialized');
      debugLog(`   Page HTML size: ${estimatedTokens} tokens`);
      debugLog(`   Note: Complete prompt token count calculated inside Firebase AI function`);

      try {
        debugLog('');
        debugLog('╔═══════════════════════════════════════════════════════════╗');
        debugLog('║  🎯 USING: FIREBASE AI LOGIC SDK (TIER 1)               ║');
        debugLog('╚═══════════════════════════════════════════════════════════╝');

        const result = await analyzeFormWithFirebaseAI(pageHTML, knowledgeBaseContext, customInstructions, request.pageContext);

        debugLog('');
        debugLog('╔═══════════════════════════════════════════════════════════╗');
        debugLog('║  ✅ SUCCESS - FIREBASE AI LOGIC COMPLETED                ║');
        debugLog('╚═══════════════════════════════════════════════════════════╝');
        debugLog('🔥 Official Firebase AI Logic SDK used (hackathon-compliant)');
        debugLog(`📊 Mode: ${result.mode} (${result.totalPromptTokens} tokens)`);
        debugLog(`📝 Fields detected: ${result.analysis.detectedFields?.length || 0}`);
        debugLog('💡 Automatic fallback: On-device unavailable → Cloud');
        debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        sendResponse({
          success: true,
          analysis: result.analysis,
          method: 'firebase_ai_logic_sdk',
          mode: result.mode,
          totalPromptTokens: result.totalPromptTokens,
          stage1Tokens: result.stage1Tokens,
          stage2Tokens: result.stage2Tokens,
          stage1Logs: result.stage1Logs,
          stage2Logs: result.stage2Logs,
          reason: 'firebase_ai_logic_official_sdk',
          tier: 1
        });
        return;
      } catch (firebaseError) {
        debugLog('');
        debugLog('❌ TIER 1 FAILED:', firebaseError.message);
        debugLog('⬇️  Falling back to TIER 2 (Manual Hybrid)...');
        debugLog('');
        // Continue to fallback methods
      }
    } else {
      debugLog('╔═══════════════════════════════════════════╗');
      debugLog('║  ⚠️  TIER 1: NOT AVAILABLE                ║');
      debugLog('╚═══════════════════════════════════════════╝');
      debugLog('❌ Firebase AI Logic not initialized');
      debugLog('💡 To use TIER 1: Configure Firebase (see FIREBASE-SETUP.md)');
      debugLog('⬇️  Using TIER 2 (Manual Hybrid) instead...');
      debugLog('');
    }

    // ========================================
    // STRATEGY 2: Manual Hybrid (FALLBACK)
    // ========================================
    debugLog('');
    debugLog('╔═══════════════════════════════════════════════════════════╗');
    debugLog('║  🔧 USING: MANUAL GEMINI API (TIER 2 - FALLBACK)        ║');
    debugLog('╚═══════════════════════════════════════════════════════════╝');
    debugLog('⚠️  Not using Firebase AI Logic SDK (Tier 1 failed)');
    debugLog('📡 Using direct Gemini API REST calls instead');

    const CHROME_AI_TOKEN_LIMIT = 6000; // Chrome AI (Gemini Nano) limit

    // For LARGE forms (> 6000 tokens): Use Gemini API Cloud
    if (estimatedTokens > CHROME_AI_TOKEN_LIMIT) {
      debugLog(`⚠️  Form is LARGE (${estimatedTokens} > ${CHROME_AI_TOKEN_LIMIT} tokens)`);
      debugLog('📊 Decision: Use Gemini API Cloud (direct API call)');

      if (!apiKey) {
        debugLog('');
        debugLog('❌ TIER 2 FAILED: No API key provided');
        debugLog('💡 To use TIER 2 for large forms: Add API key in Settings');
        debugLog('⬇️  Falling back to TIER 3 (JavaScript)...');
        debugLog('');
        debugLog('╔═══════════════════════════════════════════╗');
        debugLog('║  📝 TIER 3: JAVASCRIPT                    ║');
        debugLog('╚═══════════════════════════════════════════╝');
        debugLog('✅ Using DOM-based form detection (always works)');
        const analysis = analyzeFormWithJavaScript(pageHTML);
        debugLog('');
        debugLog('✅ SUCCESS - JavaScript analysis completed');
        debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        sendResponse({
          success: true,
          analysis: analysis,
          method: 'javascript',
          reason: 'large_form_no_api_key',
          tier: 3
        });
        return;
      }

      // Use Gemini API Cloud for large forms
      debugLog('☁️  Calling Gemini 1.5 Flash API directly...');

      // Show token breakdown for Gemini Cloud path
      const pageHTMLTokens = Math.ceil(pageHTML.length / 4);
      const knowledgeBaseTokens = knowledgeBaseContext ? Math.ceil(knowledgeBaseContext.length / 4) : 0;
      const customInstructionsTokens = customInstructions ? Math.ceil(customInstructions.length / 4) : 0;
      const systemInstructionEstimate = Math.ceil(1000 / 4);
      const promptOverheadEstimate = Math.ceil(500 / 4);
      const totalPromptTokens = pageHTMLTokens + knowledgeBaseTokens + customInstructionsTokens +
                                systemInstructionEstimate + promptOverheadEstimate;

      debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      debugLog('📊 COMPLETE PROMPT TOKEN BREAKDOWN:');
      debugLog(`   • Page HTML: ${pageHTMLTokens} tokens`);
      debugLog(`   • Knowledge base: ${knowledgeBaseTokens} tokens`);
      debugLog(`   • Custom instructions: ${customInstructionsTokens} tokens`);
      debugLog(`   • System instruction: ~${systemInstructionEstimate} tokens`);
      debugLog(`   • Prompt overhead: ~${promptOverheadEstimate} tokens`);
      debugLog('   ─────────────────────────────────────────');
      debugLog(`   📦 TOTAL PROMPT: ${totalPromptTokens} tokens`);
      debugLog(`   🎯 Limit: ${CHROME_AI_TOKEN_LIMIT} tokens`);
      debugLog(`   🔥 Decision: ONLY_IN_CLOUD (exceeds limit - using Gemini 1.5 Flash)`);
      debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const analysis = await analyzeFormWithGeminiCloud(pageHTML, apiKey, knowledgeBaseContext, customInstructions);
      debugLog('');
      debugLog('✅ SUCCESS - Gemini API Cloud completed');
      debugLog('☁️  Large form analyzed with cloud model');
      debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      sendResponse({
        success: true,
        analysis: analysis,
        method: 'gemini_cloud',
        reason: 'form_too_large_for_chrome_ai',
        tier: 2
      });
      return;
    }

    // For SMALL forms: Try Chrome AI first (fast & private)
    debugLog(`✅ Form is SMALL (${estimatedTokens} ≤ ${CHROME_AI_TOKEN_LIMIT} tokens)`);
    debugLog('📊 Decision: Try Chrome AI (Gemini Nano on-device)');

    let useChromeAI = false;
    try {
      if (typeof LanguageModel !== 'undefined') {
        const {available} = await LanguageModel.params();
        if (available !== "no") {
          useChromeAI = true;
          debugLog('🤖 Chrome AI (Gemini Nano) is available');
        }
      }
    } catch (e) {
      debugLog('⚠️  Chrome AI not available:', e.message);
    }

    // If Chrome AI not available, use JavaScript-based detection
    if (!useChromeAI) {
      debugLog('');
      debugLog('❌ TIER 2 FAILED: Chrome AI not available');
      debugLog('💡 To use TIER 2: Use Chrome Canary with AI enabled');
      debugLog('⬇️  Falling back to TIER 3 (JavaScript)...');
      debugLog('');
      debugLog('╔═══════════════════════════════════════════╗');
      debugLog('║  📝 TIER 3: JAVASCRIPT                    ║');
      debugLog('╚═══════════════════════════════════════════╝');
      debugLog('✅ Using DOM-based form detection (always works)');
      const analysis = analyzeFormWithJavaScript(pageHTML);
      debugLog('');
      debugLog('✅ SUCCESS - JavaScript analysis completed');
      debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      sendResponse({
        success: true,
        analysis: analysis,
        method: 'javascript',
        reason: 'chrome_ai_not_available',
        tier: 3
      });
      return;
    }

    debugLog('   Creating AI session...');
    const session = await LanguageModel.create({
      systemPrompt: `Form analyzer. DEFAULT: Use knowledge base. OVERRIDE: Use custom instructions only when explicitly stated.

JSON:
{
  "detectedFields": [{
    "selector": "CSS",
    "type": "text|email",
    "label": "label",
    "required": true/false,
    "suggestedValue": "value or null"
  }]
}`
    });

    const prompt = `Detect form fields.

PRIORITY:
1. DEFAULT: Use knowledge base for ALL fields
2. OVERRIDE: Custom instructions override ONLY when explicitly stated
3. NULL: If not in knowledge base AND not in custom

${knowledgeBaseContext ? `
📚 KNOWLEDGE BASE (PRIMARY - USE BY DEFAULT):
${knowledgeBaseContext.substring(0, 20000)}

Extract from KB by default:
- First name → first name from docs
- Last name → last name from docs
- Email → email from docs
- Company → company from docs

USE knowledge base UNLESS custom overrides!
` : ''}

${customInstructions ? `
⚠️ CUSTOM (OVERRIDES ONLY):
${customInstructions}

Override KB ONLY when explicitly stated.
If field NOT mentioned → USE KB.
Example: "first name" not in custom → use first name from KB
` : ''}

HTML:

HTML to analyze:
${pageHTML.substring(0, 50000)}

Return the JSON response now.`;

    debugLog('📤 Sending to Chrome AI (Gemini Nano on-device)...');
    const result = await session.prompt(prompt);

    debugLog('📥 Received response from Chrome AI');
    debugLog('   Preview:', result.substring(0, 200) + '...');

    // Parse JSON from response
    let analysis;
    try {
      // Try to extract JSON from response (AI might add extra text)
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(result);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      console.error('   Raw response:', result);
      throw new Error('AI returned invalid JSON format');
    }

    debugLog(`✅ Parsed ${analysis.detectedFields?.length || 0} fields from response`);

    // Clean up session
    session.destroy();

    debugLog('');
    debugLog('✅ SUCCESS - Chrome AI (on-device) completed');
    debugLog('🤖 Small form analyzed with Gemini Nano');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    sendResponse({
      success: true,
      analysis: analysis,
      method: 'chromeai',
      tier: 2
    });

  } catch (error) {
    console.error('❌ Error analyzing form:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get Gemini API key from storage
 */
async function handleGetApiKey(request, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    sendResponse({
      success: true,
      apiKey: result.geminiApiKey || null
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Save Gemini API key to storage
 */
async function handleSaveApiKey(request, sendResponse) {
  try {
    await chrome.storage.local.set({ geminiApiKey: request.apiKey });
    debugLog('✅ Gemini API key saved');
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * ============================================================================
 * TWO-STAGE AI ANALYSIS ARCHITECTURE (PRIVACY-OPTIMIZED)
 * ============================================================================
 *
 * Instead of sending everything in one huge prompt (HTML + user data),
 * we split into two stages:
 *
 * STAGE 1: Form Structure Analysis (NO user data - privacy safe ✅)
 *    - Input: Page HTML only
 *    - Output: Field metadata (labels, types, selectors)
 *    - Tokens: ~10,000 (large but NO PRIVACY RISK)
 *    - Can safely go to cloud - contains zero user data
 *
 * STAGE 2: Value Extraction (HAS user data - privacy critical ⚠️)
 *    - Input: Field list + knowledge base + custom instructions
 *    - Output: Values for each field
 *    - Tokens: ~8,000 (smaller than single-stage!)
 *    - Higher chance of on-device inference (user data stays local)
 *
 * Benefits:
 * ✅ Better privacy - Stage 1 has zero user data
 * ✅ Token efficiency - Stage 2 is much smaller
 * ✅ Higher chance of on-device for user data
 * ✅ Clearer separation of concerns
 * ============================================================================
 */

// STAGE 1: FORM STRUCTURE ANALYSIS (NO USER DATA)
async function analyzeFormStructure(pageHTML, pageContext = null) {
  const stage1Logs = []; // Collect logs to send to page console

  try {
    // Show stage headers only in debug mode
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: blue; font-weight: bold; font-size: 16px;');
    debugLogStyled('%c📋 STAGE 1: FORM STRUCTURE ANALYSIS', 'color: blue; font-weight: bold; font-size: 20px;');
    debugLogStyled('%c🔒 Privacy: NO USER DATA in this stage', 'color: green; font-weight: bold; font-size: 16px;');
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: blue; font-weight: bold; font-size: 16px;');

    stage1Logs.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    stage1Logs.push('📋 STAGE 1: FORM STRUCTURE ANALYSIS');
    stage1Logs.push('🔒 Privacy: NO USER DATA in this stage');
    stage1Logs.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!isFirebaseInitialized || !firebaseAI) {
      throw new Error('Firebase AI Logic SDK not initialized');
    }

    const CHROME_AI_TOKEN_LIMIT = 6000;
    const pageHTMLTokens = Math.ceil(pageHTML.length / 4);
    const pageContextTokens = pageContext ? Math.ceil(JSON.stringify(pageContext).length / 4) : 0;
    const systemInstructionEstimate = Math.ceil(800 / 4);
    const promptOverheadEstimate = Math.ceil(400 / 4);
    const totalPromptTokens = pageHTMLTokens + pageContextTokens + systemInstructionEstimate + promptOverheadEstimate;
    const useOnlyCloud = totalPromptTokens > CHROME_AI_TOKEN_LIMIT;

    // Show token breakdown only in debug mode
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📊 STAGE 1 TOKEN BREAKDOWN (NO USER DATA):');
    debugLog(`   • Page HTML: ${pageHTMLTokens.toLocaleString()} tokens`);
    debugLog(`   • Page context: ${pageContextTokens.toLocaleString()} tokens`);
    debugLog(`   • System instruction: ~${systemInstructionEstimate} tokens`);
    debugLog(`   • Prompt overhead: ~${promptOverheadEstimate} tokens`);
    debugLog('   ─────────────────────────────────────────');
    debugLog(`   📦 TOTAL: ${totalPromptTokens.toLocaleString()} tokens`);
    debugLog(`   🎯 Limit: ${CHROME_AI_TOKEN_LIMIT.toLocaleString()} tokens`);
    debugLog(`   🔥 Decision: ${useOnlyCloud ? 'ONLY_IN_CLOUD' : 'PREFER_ON_DEVICE'}`);
    debugLog(`   🔒 User Data: NONE (privacy safe)`);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const systemInstruction = `You are an expert form analyzer. Extract the STRUCTURE of the form only.

DO NOT try to fill values - that will happen in Stage 2.
Just detect what fields exist and their properties.

${pageContext ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 PAGE CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify(pageContext, null, 2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

Return ONLY valid JSON in this exact format:
{
  "detectedFields": [
    {
      "selector": "CSS selector",
      "type": "text|email|number|radio|checkbox|select|textarea",
      "label": "Field label text",
      "required": true/false,
      "options": ["option1", "option2"]
    }
  ],
  "formPurpose": "Brief description",
  "formType": "google_forms|typeform|jotform|traditional_html|react_spa|vue_spa|custom",
  "confidence": 0.95,
  "navigationButton": {
    "exists": true/false,
    "text": "Button text",
    "selector": "CSS selector",
    "type": "next|previous|submit"
  }
}`;

    const prompt = `${systemInstruction}

Analyze this HTML and detect all form fields:
${pageHTML}

Return the JSON response now.`;

    // Debug: Log the complete prompt being sent to AI
    debugLog('');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📤 STAGE 1 PROMPT PREVIEW (first 1000 chars):');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(prompt.substring(0, 1000) + '...\n[truncated - see full prompt below]');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📋 FULL STAGE 1 PROMPT:');
    debugLog(prompt);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(`📊 Prompt length: ${prompt.length} characters (~${Math.ceil(prompt.length / 4)} tokens)`);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('');

    const model = getGenerativeModel(firebaseAI, {
      mode: useOnlyCloud ? 'ONLY_IN_CLOUD' : 'PREFER_ON_DEVICE',
      inCloudParams: { model: 'gemini-2.5-pro', temperature: 0.1, topK: 10, maxOutputTokens: 8192 }
    });

    debugLog('   🚀 Sending Stage 1 prompt to Firebase AI Logic...');
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const endTime = Date.now();
    const responseText = result.response.text();

    debugLogStyled('%c✅ STAGE 1 COMPLETE', 'color: green; font-weight: bold; font-size: 18px;');
    debugLog(`   Time: ${endTime - startTime}ms`);

    // Debug: Log the AI response
    debugLog('');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📥 STAGE 1 AI RESPONSE:');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(responseText);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(`📊 Response length: ${responseText.length} characters`);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

    debugLog(`   📋 Detected ${analysis.detectedFields?.length || 0} fields`);

    // Collect logs for page console
    stage1Logs.push('');
    stage1Logs.push('📊 STAGE 1 TOKEN BREAKDOWN (NO USER DATA):');
    stage1Logs.push(`   • Page HTML: ${pageHTMLTokens.toLocaleString()} tokens`);
    stage1Logs.push(`   • Page context: ${pageContextTokens.toLocaleString()} tokens`);
    stage1Logs.push(`   • System instruction: ~${systemInstructionEstimate} tokens`);
    stage1Logs.push(`   • Prompt overhead: ~${promptOverheadEstimate} tokens`);
    stage1Logs.push('   ─────────────────────────────────────────');
    stage1Logs.push(`   📦 TOTAL: ${totalPromptTokens.toLocaleString()} tokens`);
    stage1Logs.push(`   🎯 Limit: 6,000 tokens`);
    stage1Logs.push(`   ${useOnlyCloud ? '🔴' : '🟢'} Decision: ${useOnlyCloud ? 'ONLY_IN_CLOUD' : 'PREFER_ON_DEVICE'}`);
    stage1Logs.push(`   🔒 User Data: NONE (privacy safe)`);
    stage1Logs.push('');
    stage1Logs.push('📤 STAGE 1 PROMPT (first 1000 chars):');
    stage1Logs.push(prompt.substring(0, 1000) + '...');
    stage1Logs.push('');
    stage1Logs.push('📥 STAGE 1 AI RESPONSE:');
    stage1Logs.push(responseText);
    stage1Logs.push('');
    stage1Logs.push(`✅ Detected ${analysis.detectedFields?.length || 0} fields`);
    stage1Logs.push(`⏱️  Time: ${endTime - startTime}ms`);

    return {
      ...analysis,
      totalTokens: totalPromptTokens,
      mode: useOnlyCloud ? 'ONLY_IN_CLOUD' : 'PREFER_ON_DEVICE',
      stage1Logs: stage1Logs
    };

  } catch (error) {
    console.error('❌ Stage 1 failed:', error);
    throw error;
  }
}

// STAGE 2: VALUE EXTRACTION (HAS USER DATA)
async function extractFieldValues(detectedFields, knowledgeBaseContext, customInstructions, pageContext = null) {
  const stage2Logs = []; // Collect logs to send to page console

  try {
    // Show stage headers only in debug mode
    debugLog('');
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: purple; font-weight: bold; font-size: 16px;');
    debugLogStyled('%c💎 STAGE 2: VALUE EXTRACTION', 'color: purple; font-weight: bold; font-size: 20px;');
    debugLogStyled('%c⚠️  Privacy: CONTAINS USER DATA', 'color: orange; font-weight: bold; font-size: 16px;');
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: purple; font-weight: bold; font-size: 16px;');

    stage2Logs.push('');
    stage2Logs.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    stage2Logs.push('💎 STAGE 2: VALUE EXTRACTION');
    stage2Logs.push('⚠️  Privacy: CONTAINS USER DATA');
    stage2Logs.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!isFirebaseInitialized || !firebaseAI) {
      throw new Error('Firebase AI Logic SDK not initialized');
    }

    const CHROME_AI_TOKEN_LIMIT = 6000;
    const fieldListText = detectedFields.map((f, i) =>
      `${i + 1}. "${f.label}" (${f.type}${f.required ? ', required' : ''}${f.options ? ', options: ' + f.options.join('/') : ''})`
    ).join('\n');

    const fieldListTokens = Math.ceil(fieldListText.length / 4);
    const knowledgeBaseTokens = knowledgeBaseContext ? Math.ceil(knowledgeBaseContext.length / 4) : 0;
    const customInstructionsTokens = customInstructions ? Math.ceil(customInstructions.length / 4) : 0;
    const pageContextTokens = pageContext ? Math.ceil(JSON.stringify(pageContext).length / 4) : 0;
    const systemInstructionEstimate = Math.ceil(1000 / 4);
    const promptOverheadEstimate = Math.ceil(500 / 4);
    const totalPromptTokens = fieldListTokens + knowledgeBaseTokens + customInstructionsTokens +
                              pageContextTokens + systemInstructionEstimate + promptOverheadEstimate;
    const useOnlyCloud = totalPromptTokens > CHROME_AI_TOKEN_LIMIT;

    // Show token breakdown only in debug mode
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📊 STAGE 2 TOKEN BREAKDOWN (HAS USER DATA):');
    debugLog(`   • Field list: ${fieldListTokens.toLocaleString()} tokens`);
    debugLog(`   • Knowledge base: ${knowledgeBaseTokens.toLocaleString()} tokens 🔒`);
    debugLog(`   • Custom instructions: ${customInstructionsTokens.toLocaleString()} tokens`);
    debugLog(`   • Page context: ${pageContextTokens.toLocaleString()} tokens`);
    debugLog(`   • System instruction: ~${systemInstructionEstimate} tokens`);
    debugLog(`   • Prompt overhead: ~${promptOverheadEstimate} tokens`);
    debugLog('   ─────────────────────────────────────────');
    debugLog(`   📦 TOTAL: ${totalPromptTokens.toLocaleString()} tokens`);
    debugLog(`   🎯 Limit: ${CHROME_AI_TOKEN_LIMIT.toLocaleString()} tokens`);
    debugLog(`   🔥 Decision: ${useOnlyCloud ? 'ONLY_IN_CLOUD (user data → cloud)' : 'PREFER_ON_DEVICE (user data stays local!)'}`);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const systemInstruction = `You are a data extraction expert. Extract values for form fields from user documents.

FILLING PRIORITY:
1. DEFAULT: Use knowledge base documents
2. OVERRIDE: Use custom instructions if specified
3. NULL: Use "NOT POSSIBLE TO ANSWER" if not found

${knowledgeBaseContext ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 KNOWLEDGE BASE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${knowledgeBaseContext.substring(0, 30000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${customInstructions ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CUSTOM INSTRUCTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${customInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

Return ONLY valid JSON with the EXACT field labels as keys:
{
  "fieldValues": {
    "First name": "extracted value or NOT POSSIBLE TO ANSWER",
    "Last name": "extracted value or NOT POSSIBLE TO ANSWER",
    "Email": "extracted value or NOT POSSIBLE TO ANSWER"
  }
}

CRITICAL: Use the EXACT field label text from the field list above as the key in fieldValues object. Do NOT use generic keys like "field label 1" or "field label 2".`;

    const prompt = `${systemInstruction}

Extract values for these form fields:
${fieldListText}

Return the JSON response now.`;

    // Debug: Log the complete prompt being sent to AI (with privacy warning)
    debugLog('');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📤 STAGE 2 PROMPT PREVIEW (first 1000 chars):');
    debugLog('⚠️  WARNING: Contains user data (knowledge base)');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(prompt.substring(0, 1000) + '...\n[truncated - see full prompt below]');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📋 FULL STAGE 2 PROMPT (⚠️  CONTAINS PRIVATE DATA):');
    debugLog(prompt);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(`📊 Prompt length: ${prompt.length} characters (~${Math.ceil(prompt.length / 4)} tokens)`);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('');

    const model = getGenerativeModel(firebaseAI, {
      mode: useOnlyCloud ? 'ONLY_IN_CLOUD' : 'PREFER_ON_DEVICE',
      inCloudParams: { model: 'gemini-2.5-pro', temperature: 0.1, topK: 10, maxOutputTokens: 8192 }
    });

    debugLog('   🚀 Sending Stage 2 prompt to Firebase AI Logic...');
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const endTime = Date.now();
    const responseText = result.response.text();

    debugLogStyled('%c✅ STAGE 2 COMPLETE', 'color: green; font-weight: bold; font-size: 18px;');
    debugLog(`   Time: ${endTime - startTime}ms`);
    debugLog(`   Mode: ${useOnlyCloud ? 'ONLY_IN_CLOUD (⚠️  user data in cloud)' : 'PREFER_ON_DEVICE (✅ user data local!)'}`);

    // Debug: Log the AI response
    debugLog('');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📥 STAGE 2 AI RESPONSE:');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(responseText);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog(`📊 Response length: ${responseText.length} characters`);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const resultData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

    debugLog(`   💎 Extracted values for ${Object.keys(resultData.fieldValues || {}).length} fields`);

    // Collect logs for page console
    stage2Logs.push('');
    stage2Logs.push('📊 STAGE 2 TOKEN BREAKDOWN (HAS USER DATA):');
    stage2Logs.push(`   • Field list: ${fieldListTokens.toLocaleString()} tokens`);
    stage2Logs.push(`   • Knowledge base: ${knowledgeBaseTokens.toLocaleString()} tokens 🔒`);
    stage2Logs.push(`   • Custom instructions: ${customInstructionsTokens.toLocaleString()} tokens`);
    stage2Logs.push(`   • Page context: ${pageContextTokens.toLocaleString()} tokens`);
    stage2Logs.push(`   • System instruction: ~${systemInstructionEstimate} tokens`);
    stage2Logs.push(`   • Prompt overhead: ~${promptOverheadEstimate} tokens`);
    stage2Logs.push('   ─────────────────────────────────────────');
    stage2Logs.push(`   📦 TOTAL: ${totalPromptTokens.toLocaleString()} tokens`);
    stage2Logs.push(`   🎯 Limit: 6,000 tokens`);
    stage2Logs.push(`   ${useOnlyCloud ? '🔴' : '🟢'} Decision: ${useOnlyCloud ? 'ONLY_IN_CLOUD' : 'PREFER_ON_DEVICE'}`);
    stage2Logs.push(`   ⚠️  User Data: YES (knowledge base + custom instructions)`);
    stage2Logs.push('');
    stage2Logs.push('📤 STAGE 2 PROMPT (first 1000 chars):');
    stage2Logs.push(prompt.substring(0, 1000) + '...');
    stage2Logs.push('');
    stage2Logs.push('📥 STAGE 2 AI RESPONSE:');
    stage2Logs.push(responseText);
    stage2Logs.push('');
    stage2Logs.push(`✅ Extracted values for ${Object.keys(resultData.fieldValues || {}).length} fields`);
    stage2Logs.push(`⏱️  Time: ${endTime - startTime}ms`);

    return {
      fieldValues: resultData.fieldValues || {},
      totalTokens: totalPromptTokens,
      mode: useOnlyCloud ? 'ONLY_IN_CLOUD' : 'PREFER_ON_DEVICE',
      stage2Logs: stage2Logs
    };

  } catch (error) {
    console.error('❌ Stage 2 failed:', error);
    throw error;
  }
}

/**
 * Analyze form using Firebase AI Logic SDK (OFFICIAL) - TWO-STAGE APPROACH
 *
 * NEW: Split into two stages for better privacy and token efficiency
 *
 * Documentation: https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference
 */
async function analyzeFormWithFirebaseAI(pageHTML, knowledgeBaseContext, customInstructions, pageContext = null) {
  try {
    // Show two-stage analysis header only in debug mode
    debugLog('');
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: red; font-weight: bold; font-size: 16px;');
    debugLogStyled('%c🔥 FIREBASE AI LOGIC SDK - TWO-STAGE ANALYSIS 🔥', 'color: red; font-weight: bold; font-size: 20px;');
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: red; font-weight: bold; font-size: 16px;');
    debugLog('');

    if (!isFirebaseInitialized || !firebaseAI) {
      debugLogStyled('%c❌ FIREBASE NOT INITIALIZED!', 'color: red; font-weight: bold; font-size: 18px;');
      throw new Error('Firebase AI Logic SDK not initialized');
    }

    debugLogStyled('%c✅ Firebase AI initialized - proceeding with TWO-STAGE analysis...', 'color: green; font-weight: bold; font-size: 16px;');

    // ═══════════════════════════════════════════════════════════════
    // STAGE 1: Extract Form Structure (NO user data - privacy safe)
    // ═══════════════════════════════════════════════════════════════
    const stage1Start = Date.now();
    const structureAnalysis = await analyzeFormStructure(pageHTML, pageContext);
    const stage1End = Date.now();

    debugLog('');
    debugLog(`⏱️  Stage 1 completed in ${stage1End - stage1Start}ms`);
    debugLog('');

    // ═══════════════════════════════════════════════════════════════
    // STAGE 2: Extract Field Values (HAS user data - privacy critical)
    // ═══════════════════════════════════════════════════════════════
    const stage2Start = Date.now();
    const valueExtraction = await extractFieldValues(
      structureAnalysis.detectedFields,
      knowledgeBaseContext,
      customInstructions,
      pageContext
    );
    const stage2End = Date.now();

    debugLog('');
    debugLog(`⏱️  Stage 2 completed in ${stage2End - stage2Start}ms`);
    debugLog('');

    // ═══════════════════════════════════════════════════════════════
    // COMBINE RESULTS: Merge field structure + extracted values
    // ═══════════════════════════════════════════════════════════════
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: green; font-weight: bold;');
    debugLogStyled('%c✅ TWO-STAGE ANALYSIS COMPLETE', 'color: green; font-weight: bold; font-size: 20px;');
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: green; font-weight: bold;');
    debugLog(`%c   Total Time: ${stage2End - stage1Start}ms`, 'color: green; font-weight: bold;');
    debugLog(`%c   Stage 1 (Structure): ${stage1End - stage1Start}ms - Mode: ${structureAnalysis.mode}`, 'color: blue; font-weight: bold;');
    debugLog(`%c   Stage 2 (Values): ${stage2End - stage2Start}ms - Mode: ${valueExtraction.mode}`, 'color: purple; font-weight: bold;');
    debugLogStyled('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: green; font-weight: bold;');

    // Merge field structure with extracted values
    const fieldsWithValues = structureAnalysis.detectedFields.map(field => ({
      ...field,
      suggestedValue: valueExtraction.fieldValues[field.label] || 'NOT POSSIBLE TO ANSWER'
    }));

    debugLog('');
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog('📊 PRIVACY & TOKEN SUMMARY:');
    debugLog(`   🔒 Stage 1 Tokens: ${structureAnalysis.totalTokens} (NO user data)`);
    debugLog(`   🔒 Stage 2 Tokens: ${valueExtraction.totalTokens} (HAS user data)`);
    debugLog(`   📦 Total Tokens: ${structureAnalysis.totalTokens + valueExtraction.totalTokens}`);
    debugLog('');
    debugLog('   ✅ Privacy Benefits:');
    debugLog('   • Stage 1: HTML analysis sent to cloud (safe - no user data)');
    debugLog(`   • Stage 2: User data ${valueExtraction.mode === 'PREFER_ON_DEVICE' ? 'processed on-device!' : 'sent to cloud'}`);
    debugLog(`   • Improvement: ${valueExtraction.mode === 'PREFER_ON_DEVICE' ? 'USER DATA STAYED LOCAL!' : 'Reduced token count for user data stage'}`);
    debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Return combined analysis
    return {
      analysis: {
        detectedFields: fieldsWithValues,
        formPurpose: structureAnalysis.formPurpose,
        formType: structureAnalysis.formType,
        confidence: structureAnalysis.confidence,
        navigationButton: structureAnalysis.navigationButton
      },
      totalPromptTokens: structureAnalysis.totalTokens + valueExtraction.totalTokens,
      mode: valueExtraction.mode, // Use Stage 2 mode since that's what matters for privacy
      stage1Tokens: structureAnalysis.totalTokens,
      stage2Tokens: valueExtraction.totalTokens,
      stage1Mode: structureAnalysis.mode,
      stage2Mode: valueExtraction.mode,
      stage1Logs: structureAnalysis.stage1Logs,
      stage2Logs: valueExtraction.stage2Logs
    };

  } catch (error) {
    console.error('❌ Firebase AI Logic SDK analysis failed:', error);
    console.error('   Error details:', error.message);
    throw error;
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get embedding from Gemini API
 */
async function getGeminiEmbedding(text, apiKey, taskType = 'RETRIEVAL_DOCUMENT') {
  const response = await fetch(`${GOOGLE_CLOUD_CONFIG.geminiEmbeddingUrl}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: {
        parts: [{ text: text }]
      },
      taskType: taskType,
      outputDimensionality: 768
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (!result.embedding || !result.embedding.values) {
    throw new Error('Invalid embedding response from Gemini');
  }

  return result.embedding.values;
}

/**
 * Handle embedText action - Create embedding for a single text (e.g., user question)
 */
async function handleEmbedText(request, sendResponse) {
  try {
    const { text, apiKey } = request;

    if (!text) {
      sendResponse({ success: false, error: 'Text is required' });
      return;
    }

    if (!apiKey) {
      sendResponse({ success: false, error: 'Gemini API key is required' });
      return;
    }

    debugLog(`🔢 Creating embedding for text: "${text.substring(0, 50)}..."`);

    // Use RETRIEVAL_QUERY task type for search queries
    const embedding = await getGeminiEmbedding(text, apiKey, 'RETRIEVAL_QUERY');

    debugLog(`✅ Embedding created: ${embedding.length} dimensions`);

    sendResponse({
      success: true,
      embedding: embedding
    });

  } catch (error) {
    console.error('❌ Error creating embedding:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Split text into chunks
 */
function chunkText(text, maxChunkSize = 500) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// cosineSimilarity function already defined at line 232 - removed duplicate

// ==========================================
// STORAGE MANAGEMENT HANDLERS
// ==========================================

/**
 * Get current storage mode (local or cloud)
 */
async function handleGetStorageMode(request, sendResponse) {
  try {
    const mode = storageManager.getMode();
    const usage = await storageManager.getStorageUsage();

    sendResponse({
      success: true,
      mode: mode,
      usage: usage
    });
  } catch (error) {
    console.error('❌ Error getting storage mode:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Set storage mode (local or cloud)
 */
async function handleSetStorageMode(request, sendResponse) {
  try {
    const { mode } = request;

    if (!mode || (mode !== 'local' && mode !== 'cloud')) {
      throw new Error('Invalid storage mode. Must be "local" or "cloud"');
    }

    await storageManager.setMode(mode);

    debugLog(`✅ Storage mode changed to: ${mode}`);

    sendResponse({
      success: true,
      mode: mode,
      message: `Storage mode changed to ${mode}`
    });
  } catch (error) {
    console.error('❌ Error setting storage mode:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get storage usage statistics
 */
async function handleGetStorageUsage(request, sendResponse) {
  try {
    const usage = await storageManager.getStorageUsage();

    sendResponse({
      success: true,
      usage: usage
    });
  } catch (error) {
    console.error('❌ Error getting storage usage:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get embeddings from storage (respects local/cloud mode)
 */
async function handleGetEmbeddings(request, sendResponse) {
  try {
    debugLog('📦 Getting embeddings from storage...');
    const embeddings = await storageManager.retrieveEmbeddings();

    debugLog(`   Retrieved ${embeddings.length} chunks from ${storageManager.getMode()} storage`);

    sendResponse({
      success: true,
      embeddings: embeddings,
      mode: storageManager.getMode()
    });
  } catch (error) {
    console.error('❌ Error getting embeddings:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete embeddings for a specific file (respects local/cloud mode)
 */
async function handleDeleteEmbeddings(request, sendResponse) {
  try {
    const { fileName } = request;
    debugLog(`🗑️ Deleting embeddings for: ${fileName}`);

    await storageManager.deleteEmbeddings(fileName);

    // Also update document metadata in sync storage
    const syncStorage = await chrome.storage.sync.get(['documentMetadata']);
    const metadata = syncStorage.documentMetadata || [];
    const updatedMetadata = metadata.filter(doc => doc.fileName !== fileName);
    await chrome.storage.sync.set({ documentMetadata: updatedMetadata });

    debugLog(`   ✅ Deleted embeddings and metadata for ${fileName}`);

    sendResponse({
      success: true,
      fileName: fileName,
      mode: storageManager.getMode()
    });
  } catch (error) {
    console.error('❌ Error deleting embeddings:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// ==========================================
// GEMINI LIVE VOICE HANDLERS
// ==========================================

/**
 * Check if Gemini Live API is supported in current browser
 */
async function handleCheckGeminiLiveSupport(request, sendResponse) {
  try {
    const isSupported = GeminiLiveVoiceHandler.isSupported();

    sendResponse({
      success: true,
      supported: isSupported,
      message: isSupported
        ? 'Gemini Live API is supported'
        : 'Browser does not support required APIs for Gemini Live'
    });
  } catch (error) {
    console.error('❌ Error checking Gemini Live support:', error);
    sendResponse({
      success: false,
      supported: false,
      error: error.message
    });
  }
}

debugLog('✅ Background worker initialized');
debugLog('📊 Storage: Chrome Local Storage (10MB limit) + Google Cloud Storage');
debugLog('🤖 AI: Chrome Prompt API (Gemini Nano) + Gemini Embeddings + Gemini Live Voice');
debugLog('☁️ Cloud: Google Cloud Functions for PDF extraction & embedding storage');

// Pages Chrome refuses to let extensions inject into
const RESTRICTED_URL_PATTERN = /^(chrome|chrome-extension|edge|about|devtools|view-source):|^https:\/\/chromewebstore\.google\.com|^https:\/\/chrome\.google\.com\/webstore/;

function isRestrictedUrl(url) {
  // Only block when we can actually see a restricted URL. If `url` is redacted
  // (no activeTab/host permission yet) fall through and let the injection
  // attempt decide - failing open avoids breaking normal pages.
  return !!url && RESTRICTED_URL_PATTERN.test(url);
}

// Handle extension icon click - inject panel into active tab
chrome.action.onClicked.addListener(async (tab) => {
  debugLog('🖱️ Extension icon clicked, injecting panel into tab:', tab.id);

  // Chrome blocks injection on internal pages - bail out with a clear signal
  // instead of letting insertCSS throw "Cannot access a chrome:// URL"
  if (isRestrictedUrl(tab.url)) {
    debugLog('🚫 Cannot open panel on restricted page:', tab.url);
    chrome.action.setBadgeText({ tabId: tab.id, text: 'N/A' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#d93025' });
    chrome.action.setTitle({
      tabId: tab.id,
      title: 'FastRamp cannot run on Chrome internal pages.\nOpen a normal website and try again.'
    });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }), 3000);
    return;
  }

  try {
    // Inject the panel by sending a message to content script
    await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
  } catch (error) {
    // If content script not loaded, inject it first
    debugLog('📝 Content script not found, injecting scripts...');

    try {
      // Inject CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['panel.css']
      });

      // Inject JavaScript files in order
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['form-detector.js', 'content.js', 'panel-injector.js']
      });

      // Wait a bit for scripts to initialize, then toggle panel
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
        } catch (e) {
          console.error('Failed to toggle panel after injection:', e);
        }
      }, 500);

    } catch (injectError) {
      const msg = String(injectError?.message || injectError);
      if (/Cannot access|cannot be scripted|Missing host permission/i.test(msg)) {
        console.warn(
          `FastRamp cannot run on this page (${tab.url}). ` +
          `Chrome blocks extensions here. For local file:// pages, enable ` +
          `"Allow access to file URLs" on chrome://extensions for this extension.`
        );
      } else {
        console.error('Failed to inject content scripts:', injectError);
      }
    }
  }
});
