# Firebase Setup Guide

This guide will help you configure Firebase for the chat module.

---

## Prerequisites

1. Firebase project created at [Firebase Console](https://console.firebase.google.com/)
2. Node.js backend with Firebase Admin SDK installed

---

## Step 1: Install Firebase Admin SDK

```bash
cd planora_api
npm install firebase-admin
```

---

## Step 2: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the **Settings gear icon** → **Project settings**
4. Go to the **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file
7. Save it as `src/config/firebase-service-account.json`

**⚠️ Important**: Add this file to `.gitignore` to keep it secure!

```gitignore
# Firebase
src/config/firebase-service-account.json
```

---

## Step 3: Configure Environment Variables (Optional)

Alternatively, you can use environment variables instead of the service account file:

```bash
# .env file
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**Note**: The private key must include `\n` characters for newlines.

---

## Step 4: Enable Firestore

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (we'll set security rules later)
4. Select a location for your database
5. Click **Enable**

---

## Step 5: Set Up Firestore Security Rules

1. In Firebase Console, go to **Firestore Database** → **Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is channel member
    function isChannelMember(channelId, userId) {
      let channelMeta = get(/databases/$(database)/documents/channelMetadata/$(channelId));
      return channelMeta != null && 
             userId in channelMeta.data.memberIds;
    }
    
    // Channel metadata (read-only for members)
    match /channelMetadata/{channelId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.memberIds;
      allow write: if false; // Only backend can write
    }
    
    // Channel messages
    match /channels/{channelId}/messages/{messageId} {
      allow read: if request.auth != null && 
        isChannelMember(channelId, request.auth.uid);
      allow create: if request.auth != null && 
        request.resource.data.authorId == request.auth.uid &&
        isChannelMember(channelId, request.auth.uid);
      allow update, delete: if request.auth != null && 
        resource.data.authorId == request.auth.uid;
    }
    
    // Direct messages
    match /directMessages/{channelId}/messages/{messageId} {
      allow read: if request.auth != null && 
        isChannelMember(channelId, request.auth.uid);
      allow create: if request.auth != null && 
        request.resource.data.authorId == request.auth.uid &&
        isChannelMember(channelId, request.auth.uid);
      allow update, delete: if request.auth != null && 
        resource.data.authorId == request.auth.uid;
    }
    
    // User data (read-only for authenticated users)
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if false; // Only backend can write
    }
  }
}
```

3. Click **Publish**

---

## Step 6: Create Firestore Indexes

For efficient queries, create composite indexes:

1. Go to **Firestore Database** → **Indexes**
2. Click **Create Index**

**Index 1: Channel Messages**
- Collection ID: `channels/{channelId}/messages`
- Fields:
  - `createdAt` (Ascending)
  - `channelId` (Ascending)

**Index 2: Direct Messages**
- Collection ID: `directMessages/{channelId}/messages`
- Fields:
  - `createdAt` (Ascending)
  - `channelId` (Ascending)

---

## Step 7: Test Firebase Connection

1. Start your backend server:
   ```bash
   npm run dev
   ```

2. Check the console logs. You should see:
   ```
   ✅ Firebase Admin initialized with service account file
   ```

3. If you see a warning, check:
   - Service account file exists at `src/config/firebase-service-account.json`
   - File has correct JSON format
   - Service account has Firestore permissions

---

## Step 8: Generate Firebase Token (Test Endpoint)

After logging in, call:

```bash
POST /api/users/firebase-token
Authorization: Bearer <your-jwt-token>
```

Response:
```json
{
  "success": true,
  "data": {
    "firebaseToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## Step 9: Frontend Configuration

In your Angular app, create `src/environments/firebase.config.ts`:

```typescript
import { firebaseConfig } from 'path/to/firebase-config';

export const firebaseConfig = {
  apiKey: "AIzaSyCArEkC1Ykn975QZ1RXf_2WBvDg7KHMmGw",
  authDomain: "planora-9b2ef.firebaseapp.com",
  projectId: "planora-9b2ef",
  storageBucket: "planora-9b2ef.firebasestorage.app",
  messagingSenderId: "451847027508",
  appId: "1:451847027508:web:2d210b7929ed60e6994361",
  measurementId: "G-7SDMXS54BN"
};
```

---

## Troubleshooting

### Error: "Firebase Admin not initialized"

**Solution**: 
- Check that `firebase-service-account.json` exists
- Verify the JSON file is valid
- Check file permissions

### Error: "Permission denied" in Firestore

**Solution**:
- Verify security rules are published
- Check that user is authenticated
- Ensure user is a member of the channel

### Error: "Service account key is invalid"

**Solution**:
- Re-download the service account key from Firebase Console
- Ensure the key hasn't been revoked
- Check that the key has Firestore Admin permissions

### Firebase sync not working

**Solution**:
- Check backend logs for Firebase errors
- Verify Firestore is enabled in Firebase Console
- Test with a simple sync operation

---

## Security Best Practices

1. **Never commit service account keys to Git**
   - Add to `.gitignore`
   - Use environment variables in production

2. **Rotate keys regularly**
   - Generate new keys every 90 days
   - Revoke old keys

3. **Limit service account permissions**
   - Only grant necessary permissions
   - Use least privilege principle

4. **Monitor Firebase usage**
   - Check Firebase Console for unusual activity
   - Set up billing alerts

---

## Production Checklist

- [ ] Service account key stored securely (not in Git)
- [ ] Firestore security rules configured
- [ ] Firestore indexes created
- [ ] Firebase Admin initialized successfully
- [ ] Token generation endpoint working
- [ ] Channel sync to Firestore working
- [ ] Error handling implemented
- [ ] Monitoring/logging set up

---

## Support

For issues:
1. Check Firebase Console for errors
2. Review backend logs
3. Verify service account permissions
4. Test with Firebase Admin SDK directly

---

## Next Steps

After Firebase is configured:
1. Test channel creation (should sync to Firestore)
2. Test user profile updates (should sync to Firestore)
3. Implement frontend Firebase client
4. Test real-time message delivery

