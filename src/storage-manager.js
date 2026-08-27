/**
 * Storage Manager - Abstraction layer for embedding storage
 * Supports both local Chrome storage and Google Cloud Storage
 *
 * This module is completely decoupled from existing storage logic
 * and provides seamless switching between storage modes.
 */

// Google Cloud Configuration
const CLOUD_STORAGE_CONFIG = {
  saveUrl: 'https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/save-embeddings',
  retrieveUrl: 'https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/retrieve-embeddings',
  deleteUrl: 'https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/delete-embeddings'
};

class StorageManager {
  constructor() {
    this.mode = 'local'; // default to local (preserves existing behavior)
    this.userId = null;
    this.initialized = false;
  }

  /**
   * Initialize storage manager
   * Loads storage mode and user ID from chrome.storage.sync
   */
  async init() {
    try {
      const result = await chrome.storage.sync.get(['storageMode', 'cloudUserId']);

      // Set storage mode (default to 'local' if not set)
      this.mode = result.storageMode || 'local';

      // Generate or retrieve user ID for cloud storage
      if (result.cloudUserId) {
        this.userId = result.cloudUserId;
      } else {
        this.userId = this.generateUserId();
        await chrome.storage.sync.set({ cloudUserId: this.userId });
      }

      this.initialized = true;
      console.log(`📦 StorageManager initialized: mode=${this.mode}, userId=${this.userId}`);

      return true;
    } catch (error) {
      console.error('❌ StorageManager initialization failed:', error);
      // Fallback to local mode on error
      this.mode = 'local';
      this.initialized = true;
      return false;
    }
  }

  /**
   * Get current storage mode
   */
  getMode() {
    return this.mode;
  }

  /**
   * Set storage mode
   * @param {string} mode - 'local' or 'cloud'
   */
  async setMode(mode) {
    if (mode !== 'local' && mode !== 'cloud') {
      throw new Error('Invalid storage mode. Must be "local" or "cloud"');
    }

    const previousMode = this.mode;
    this.mode = mode;
    await chrome.storage.sync.set({ storageMode: mode });
    console.log(`📦 Storage mode changed to: ${mode}`);

    // Clear the opposite storage when switching modes
    if (previousMode !== mode) {
      try {
        if (mode === 'cloud') {
          // Switching to cloud: clear local storage embeddings and metadata
          await this.clearLocalStorage();
          console.log(`🧹 Cleared local storage embeddings (switched to cloud mode)`);
        } else if (mode === 'local') {
          // Switching to local: clear cloud storage embeddings and metadata
          await this.clearCloudStorage();
          console.log(`🧹 Cleared cloud storage embeddings (switched to local mode)`);
        }
      } catch (error) {
        console.error(`⚠️ Error clearing ${previousMode} storage:`, error);
        // Don't throw - the mode switch should still succeed
      }
    }
  }

  /**
   * Clear all embeddings from local storage
   */
  async clearLocalStorage() {
    // Clear embeddings from local storage
    await chrome.storage.local.set({ knowledgeBase: [] });

    // Clear document metadata from sync storage
    await chrome.storage.sync.set({ documentMetadata: [] });

    console.log(`✅ Cleared local storage: knowledgeBase and documentMetadata`);
  }

  /**
   * Clear all embeddings from cloud storage
   */
  async clearCloudStorage() {
    // Get all document metadata to find documents to delete
    const syncStorage = await chrome.storage.sync.get(['documentMetadata']);
    const metadata = syncStorage.documentMetadata || [];

    if (metadata.length === 0) {
      console.log(`ℹ️ No documents to clear from cloud storage`);
      return;
    }

    // Delete each document from cloud storage
    for (const doc of metadata) {
      try {
        const response = await fetch(CLOUD_STORAGE_CONFIG.deleteUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: this.userId,
            documentId: doc.documentId
          })
        });

        if (!response.ok) {
          console.warn(`⚠️ Failed to delete ${doc.fileName} from cloud: ${response.status}`);
        } else {
          console.log(`✅ Deleted ${doc.fileName} from cloud storage`);
        }
      } catch (error) {
        console.warn(`⚠️ Error deleting ${doc.fileName} from cloud:`, error.message);
      }
    }

    // Clear document metadata from sync storage
    await chrome.storage.sync.set({ documentMetadata: [] });

    console.log(`✅ Cleared cloud storage and documentMetadata`);
  }

  /**
   * Save embeddings to storage (local or cloud based on mode)
   * @param {string} fileName - Document file name
   * @param {Array} chunks - Array of embedding chunks
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} Result object with success, storage type, documentId
   */
  async saveEmbeddings(fileName, chunks, metadata) {
    if (!this.initialized) {
      await this.init();
    }

    console.log(`💾 Saving embeddings: mode=${this.mode}, fileName=${fileName}, chunks=${chunks.length}`);

    try {
      if (this.mode === 'local') {
        return await this.saveToLocal(fileName, chunks, metadata);
      } else {
        return await this.saveToCloud(fileName, chunks, metadata);
      }
    } catch (error) {
      console.error(`❌ Error saving to ${this.mode} storage:`, error);

      // Graceful fallback: if cloud fails, try local
      if (this.mode === 'cloud') {
        console.warn('⚠️  Cloud save failed, falling back to local storage...');
        return await this.saveToLocal(fileName, chunks, metadata);
      }

      throw error;
    }
  }

  /**
   * Retrieve embeddings from storage (local or cloud based on mode)
   * @param {string} documentId - Optional document ID (if null, retrieve all)
   * @returns {Promise<Array>} Array of embedding chunks
   */
  async retrieveEmbeddings(documentId = null) {
    if (!this.initialized) {
      await this.init();
    }

    console.log(`📥 Retrieving embeddings: mode=${this.mode}, documentId=${documentId || 'all'}`);

    try {
      if (this.mode === 'local') {
        return await this.retrieveFromLocal(documentId);
      } else {
        return await this.retrieveFromCloud(documentId);
      }
    } catch (error) {
      console.error(`❌ Error retrieving from ${this.mode} storage:`, error);

      // Graceful fallback: if cloud fails, try local
      if (this.mode === 'cloud') {
        console.warn('⚠️  Cloud retrieve failed, falling back to local storage...');
        return await this.retrieveFromLocal(documentId);
      }

      throw error;
    }
  }

  /**
   * Delete embeddings from storage (local or cloud based on mode)
   * @param {string} fileName - Document file name to delete
   * @returns {Promise<Object>} Result object with success
   */
  async deleteEmbeddings(fileName) {
    if (!this.initialized) {
      await this.init();
    }

    console.log(`🗑️  Deleting embeddings: mode=${this.mode}, fileName=${fileName}`);

    try {
      if (this.mode === 'local') {
        return await this.deleteFromLocal(fileName);
      } else {
        return await this.deleteFromCloud(fileName);
      }
    } catch (error) {
      console.error(`❌ Error deleting from ${this.mode} storage:`, error);
      throw error;
    }
  }

  // ============================================================
  // LOCAL STORAGE METHODS (existing logic)
  // ============================================================

  /**
   * Save embeddings to local Chrome storage
   */
  async saveToLocal(fileName, chunks, metadata) {
    const storage = await chrome.storage.local.get(['knowledgeBase']);
    const kb = storage.knowledgeBase || [];

    // Remove old embeddings for this file
    const filtered = kb.filter(c => c.fileName !== fileName);

    // Add new embeddings
    const updated = [...filtered, ...chunks];

    await chrome.storage.local.set({ knowledgeBase: updated });

    console.log(`✅ Saved ${chunks.length} chunks to local storage`);

    return {
      success: true,
      storage: 'local',
      documentId: metadata.documentId,
      chunksSaved: chunks.length
    };
  }

  /**
   * Retrieve embeddings from local Chrome storage
   */
  async retrieveFromLocal(documentId) {
    const storage = await chrome.storage.local.get(['knowledgeBase']);
    const kb = storage.knowledgeBase || [];

    console.log(`✅ Retrieved ${kb.length} chunks from local storage`);

    return kb;
  }

  /**
   * Delete embeddings from local Chrome storage
   */
  async deleteFromLocal(fileName) {
    const storage = await chrome.storage.local.get(['knowledgeBase']);
    const kb = storage.knowledgeBase || [];
    const filtered = kb.filter(c => c.fileName !== fileName);

    await chrome.storage.local.set({ knowledgeBase: filtered });

    const deletedCount = kb.length - filtered.length;
    console.log(`✅ Deleted ${deletedCount} chunks from local storage`);

    return {
      success: true,
      chunksDeleted: deletedCount
    };
  }

  // ============================================================
  // CLOUD STORAGE METHODS (new)
  // ============================================================

  /**
   * Save embeddings to Google Cloud Storage
   */
  async saveToCloud(fileName, chunks, metadata) {
    console.log(`☁️  Calling Cloud Function: save-embeddings`);
    console.log(`   UserId: ${this.userId}`);
    console.log(`   DocumentId: ${metadata.documentId}`);
    console.log(`   Chunks: ${chunks.length}`);

    const response = await fetch(CLOUD_STORAGE_CONFIG.saveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: this.userId,
        documentId: metadata.documentId,
        fileName: fileName,
        chunks: chunks,
        metadata: metadata
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloud save failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    console.log(`✅ Saved ${result.chunksSaved} chunks to cloud storage`);
    console.log(`   Storage URL: ${result.storageUrl}`);

    return result;
  }

  /**
   * Retrieve embeddings from Google Cloud Storage
   */
  async retrieveFromCloud(documentId) {
    console.log(`☁️  Calling Cloud Function: retrieve-embeddings`);
    console.log(`   UserId: ${this.userId}`);
    console.log(`   DocumentId: ${documentId || 'all'}`);

    const requestBody = {
      userId: this.userId
    };

    if (documentId) {
      requestBody.documentId = documentId;
    }

    const response = await fetch(CLOUD_STORAGE_CONFIG.retrieveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloud retrieve failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    console.log(`✅ Retrieved ${result.chunks.length} chunks from cloud storage`);
    console.log(`   Documents: ${result.documentsCount}`);

    return result.chunks || [];
  }

  /**
   * Delete embeddings from Google Cloud Storage
   */
  async deleteFromCloud(fileName) {
    console.log(`☁️  Calling Cloud Function: delete-embeddings`);
    console.log(`   UserId: ${this.userId}`);
    console.log(`   FileName: ${fileName}`);

    // Find document ID from metadata
    const syncStorage = await chrome.storage.sync.get(['documentMetadata']);
    const metadata = syncStorage.documentMetadata || [];
    const doc = metadata.find(d => d.fileName === fileName);

    if (!doc) {
      console.warn(`⚠️  Document ${fileName} not found in metadata`);
      return {
        success: false,
        error: 'Document not found in metadata'
      };
    }

    const response = await fetch(CLOUD_STORAGE_CONFIG.deleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: this.userId,
        documentId: doc.documentId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloud delete failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    console.log(`✅ Deleted from cloud storage: ${result.message}`);

    return result;
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Generate unique user ID
   */
  generateUserId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `user_${timestamp}_${random}`;
  }

  /**
   * Get storage usage statistics
   * @returns {Promise<Object>} Storage usage info
   */
  async getStorageUsage() {
    const storage = await chrome.storage.local.get(null);
    const bytesUsed = JSON.stringify(storage).length;
    const maxBytes = 10 * 1024 * 1024; // 10MB limit for chrome.storage.local

    return {
      mode: this.mode,
      bytesUsed: bytesUsed,
      maxBytes: this.mode === 'local' ? maxBytes : Infinity,
      percentUsed: this.mode === 'local' ? ((bytesUsed / maxBytes) * 100).toFixed(2) : 0,
      formattedUsed: this.formatBytes(bytesUsed),
      formattedMax: this.mode === 'local' ? this.formatBytes(maxBytes) : 'Unlimited'
    };
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// ES6 export for background.js (webpack bundled)
export default StorageManager;

// Make available globally for content scripts (when loaded directly in browser)
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
