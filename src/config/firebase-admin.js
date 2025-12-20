/**
 * Firebase Admin SDK - Auto-initialized singleton
 * 
 * Automatically initializes on require using environment variables (.env) or firebase.json configuration.
 * Exports Firestore and Auth instances directly.
 * Gracefully handles missing credentials without breaking the app.
 * 
 * Priority: Environment variables > firebase.json > Application Default Credentials
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
    // Try to get Firebase config from environment variables first
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    // Fallback to firebase.json if env vars are not set (for backward compatibility)
    let firebaseConfig = null;
    if (!projectId || !privateKey || !clientEmail) {
      try {
        firebaseConfig = require('./firebase.json');
      } catch (e) {
        // firebase.json doesn't exist or can't be read
      }
    }

    // Use environment variables if available, otherwise fallback to firebase.json
    const hasServiceAccount = (privateKey && clientEmail) || (firebaseConfig && firebaseConfig.private_key && firebaseConfig.client_email);
    const finalProjectId = projectId || (firebaseConfig && (firebaseConfig.project_id || firebaseConfig.projectId));

    if (!finalProjectId) {
      console.warn('⚠️  Firebase Admin not initialized: Missing project ID. Set FIREBASE_PROJECT_ID in .env or firebase.json');
      return { firestore: null, auth: null, isReady: false };
    }

    // If service account credentials are available, use them directly
    if (hasServiceAccount) {
      try {
        const finalPrivateKey = privateKey || firebaseConfig.private_key;
        const finalClientEmail = clientEmail || firebaseConfig.client_email;

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: finalProjectId,
            privateKey: finalPrivateKey.replace(/\\n/g, '\n'),
            clientEmail: finalClientEmail,
          }),
          projectId: finalProjectId,
          databaseURL: process.env.FIREBASE_DATABASE_URL ||
            `https://${finalProjectId}-default-rtdb.firebaseio.com`,
        });

        firestore = admin.firestore();
        auth = admin.auth();
        isReady = true;

        const source = privateKey ? 'environment variables' : 'firebase.json';
        console.log(`✅ Firebase Admin initialized (Service Account from ${source})`);
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
      console.warn('   1. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in .env file');
      console.warn('   2. Add service account credentials (private_key, client_email) to firebase.json');
      console.warn('   3. Use Application Default Credentials (gcloud auth application-default login)');
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
