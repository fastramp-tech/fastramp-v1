/**
 * Firebase Configuration for FastRamp
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Add a Web app
 * 4. Copy the firebaseConfig object from Firebase Console
 * 5. Replace the placeholder values below with your actual config
 * 6. Enable Generative Language API in Google Cloud Console
 *
 * See FIREBASE-SETUP.md for detailed setup instructions
 */

// Firebase Configuration - Replace with your own values
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/**
 * Check if Firebase is configured
 * @returns {boolean} True if Firebase config is set up
 */
function isFirebaseConfigured() {
  return FIREBASE_CONFIG.apiKey !== "YOUR_FIREBASE_API_KEY" &&
         FIREBASE_CONFIG.projectId !== "YOUR_PROJECT_ID";
}

/**
 * Get Firebase configuration
 * @returns {object} Firebase config object
 */
function getFirebaseConfig() {
  if (!isFirebaseConfigured()) {
    console.warn('⚠️ Firebase not configured. Please update firebase-config.js with your Firebase project details.');
    console.warn('📖 See FIREBASE-SETUP.md for instructions');
    return null;
  }
  return FIREBASE_CONFIG;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getFirebaseConfig, isFirebaseConfigured, FIREBASE_CONFIG };
}
