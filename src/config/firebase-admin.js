/**
 * Firebase Admin SDK - Auto-initialized singleton
 * 
 * Automatically initializes on require using firebase.json configuration.
 * Exports Firestore and Auth instances directly.
 * Gracefully handles missing credentials without breaking the app.
 */

const admin = require('firebase-admin');

// Singleton instances
let firestore = null;
let auth = null;
let isReady = false;

/**
 * Initialize Firebase Admin SDK
 */
const initialize = () => {
  // Already initialized
  if (isReady && firestore && auth) {
    return { firestore, auth, isReady: true };
  }

  // Check if already initialized globally
  if (admin.apps.length > 0) {
    const app = admin.app();
    firestore = app.firestore();
    auth = app.auth();
    isReady = true;
    return { firestore, auth, isReady: true };
  }

  try {
    const firebaseConfig = require('./firebase.json');

    // Check if firebase.json contains service account credentials
    // Service account files have: project_id, private_key, client_email
    const hasServiceAccount = firebaseConfig.private_key && firebaseConfig.client_email;
    const projectId = firebaseConfig.project_id || firebaseConfig.projectId;

    if (!projectId) {
      console.warn('⚠️  Firebase Admin not initialized: Missing project ID in firebase.json');
      return { firestore: null, auth: null, isReady: false };
    }

    // If service account credentials are available, use them directly
    if (hasServiceAccount) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projectId,
            privateKey: firebaseConfig.private_key.replace(/\\n/g, '\n'),
            clientEmail: firebaseConfig.client_email,
          }),
          projectId: projectId,
          databaseURL: process.env.FIREBASE_DATABASE_URL ||
            `https://${projectId}-default-rtdb.firebaseio.com`,
        });

        firestore = admin.firestore();
        auth = admin.auth();
        isReady = true;

        console.log('✅ Firebase Admin initialized (Service Account from firebase.json)');
        return { firestore, auth, isReady: true };
      } catch (certError) {
        console.error('❌ Error initializing with service account:', certError.message);
        return { firestore: null, auth: null, isReady: false };
      }
    }

    // Try Application Default Credentials as fallback (works on GCP or with gcloud auth)
    try {
      admin.initializeApp({
        projectId: projectId,
        databaseURL: process.env.FIREBASE_DATABASE_URL ||
          `https://${projectId}-default-rtdb.firebaseio.com`,
      });

      firestore = admin.firestore();
      auth = admin.auth();
      isReady = true;

      console.log('✅ Firebase Admin initialized (Application Default Credentials)');
      return { firestore, auth, isReady: true };
    } catch (adcError) {
      // No credentials found - graceful fallback
      console.warn('⚠️  Firebase Admin not initialized: Missing credentials');
      console.warn('   Options:');
      console.warn('   1. Add service account credentials (private_key, client_email) to firebase.json');
      console.warn('   2. Use Application Default Credentials (gcloud auth application-default login)');
      return { firestore: null, auth: null, isReady: false };
    }

  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    return { firestore: null, auth: null, isReady: false };
  }
};

// Auto-initialize on module load
const { firestore: _firestore, auth: _auth, isReady: _isReady } = initialize();
firestore = _firestore;
auth = _auth;
isReady = _isReady;

// Export direct instances (null if not initialized - graceful fallback)
module.exports = {
  firestore,  // Direct Firestore instance: firestore.collection('users')...
  auth,       // Direct Auth instance: auth.createCustomToken(...)
  isReady,    // Boolean: true if initialized successfully
  admin,      // Raw admin SDK for advanced use cases
};
