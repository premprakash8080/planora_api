# Chat Module Architecture Documentation

## Overview

This document describes the backend architecture for the Slack-style chat module, which integrates MySQL for metadata management and Firebase Firestore for real-time messaging.

---

## Architecture

### Data Storage Strategy

**MySQL (Core Metadata)**:
- Channel definitions (name, type, description)
- Channel memberships and roles
- User authentication and profiles
- Read receipts tracking
- Unread message counts

**Firebase Firestore (Real-time Messages)**:
- Actual chat messages
- Real-time synchronization
- Message reactions
- Typing indicators (future)

### Data Flow

```
User Action → Backend API (MySQL) → Firebase Sync Service → Firestore
                ↓
         Update MySQL metadata
                ↓
         Return response to client
                ↓
         Client connects to Firestore for real-time updates
```

---

## Database Schema

### Tables

#### `channels`
Stores channel metadata:
- `id`: Primary key
- `name`: Channel name (null for direct messages)
- `description`: Optional description
- `type`: `direct`, `group`, `public`, or `private`
- `created_by`: User ID of creator
- `is_archived`: Archive flag
- `firestore_path`: Firestore collection path
- `last_message_at`: Last message timestamp for sorting
- `created_at`, `updated_at`, `deleted_at`: Timestamps

#### `channel_members`
Many-to-many relationship between channels and users:
- `id`: Primary key
- `channel_id`: Foreign key to channels
- `user_id`: Foreign key to users
- `role`: `owner`, `admin`, or `member`
- `joined_at`: When user joined
- `last_read_at`: Last time user read messages
- `unread_count`: Cached unread message count
- `is_muted`: Mute notifications flag

#### `channel_message_reads`
Tracks individual message read receipts:
- `id`: Primary key
- `channel_id`: Foreign key to channels
- `user_id`: Foreign key to users
- `firestore_message_id`: Firestore document ID
- `read_at`: Timestamp when read

---

## API Endpoints

### Base URL
All endpoints are prefixed with `/api/channels`

### Authentication
All endpoints require authentication via JWT token in the `Authorization` header.

---

### 1. Create Channel

**POST** `/api/channels`

**Request Body**:
```json
{
  "name": "General Discussion",
  "description": "Team chat for general topics",
  "type": "public",
  "memberIds": [2, 3, 4]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "channel": {
      "id": "1",
      "name": "General Discussion",
      "description": "Team chat for general topics",
      "type": "public",
      "createdBy": {
        "id": "1",
        "fullName": "John Doe",
        "email": "john@example.com",
        "avatarUrl": "https://...",
        "avatarColor": "#8b5cf6",
        "initials": "JD"
      },
      "members": [...],
      "memberCount": 4,
      "myRole": "owner",
      "myUnreadCount": 0,
      "firestorePath": "channels/1",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

**Notes**:
- For `direct` type, `name` is auto-generated from member names
- Creator is automatically added as `owner`
- Direct message channels are limited to 2 members

---

### 2. Get All Channels

**GET** `/api/channels?type=public&archived=false`

**Query Parameters**:
- `type` (optional): Filter by `direct`, `group`, `public`, or `private`
- `archived` (optional): `true` or `false` (default: `false`)

**Response**:
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "id": "1",
        "name": "General Discussion",
        "type": "public",
        "myUnreadCount": 5,
        "lastMessageAt": "2024-01-15T12:00:00Z",
        ...
      }
    ]
  }
}
```

**Notes**:
- Returns only channels where the user is a member
- Ordered by `last_message_at` (most recent first), then `created_at`

---

### 3. Get Channel by ID

**GET** `/api/channels/:channelId`

**Response**:
```json
{
  "success": true,
  "data": {
    "channel": {
      "id": "1",
      "name": "General Discussion",
      "members": [...],
      "myRole": "admin",
      "myUnreadCount": 3,
      ...
    }
  }
}
```

**Errors**:
- `404`: Channel not found
- `403`: User is not a member

---

### 4. Update Channel

**PUT** `/api/channels/:channelId`

**Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_archived": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "channel": {...}
  }
}
```

**Permissions**:
- Only `owner` or `admin` can update
- Direct message channels cannot be updated

---

### 5. Delete Channel

**DELETE** `/api/channels/:channelId`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Channel deleted successfully"
  }
}
```

**Permissions**:
- Only `owner` can delete
- Performs soft delete

---

### 6. Add Member

**POST** `/api/channels/:channelId/members`

**Request Body**:
```json
{
  "userId": 5
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "channel": {
      "members": [...],
      "memberCount": 5
    }
  }
}
```

**Permissions**:
- Only `owner` or `admin` can add members
- Cannot add members to direct message channels

---

### 7. Remove Member

**DELETE** `/api/channels/:channelId/members/:memberId`

**Response**:
```json
{
  "success": true,
  "data": {
    "channel": {...}
  }
}
```

**Permissions**:
- Users can remove themselves
- `owner` or `admin` can remove others
- Cannot remove channel `owner` (except themselves)

---

### 8. Update Member Role

**PATCH** `/api/channels/:channelId/members/:memberId/role`

**Request Body**:
```json
{
  "role": "admin"
}
```

**Valid Roles**: `owner`, `admin`, `member`

**Permissions**:
- Only `owner` can update roles
- Cannot change own role from `owner`

---

### 9. Mark Messages as Read

**POST** `/api/channels/:channelId/mark-read`

**Request Body**:
```json
{
  "firestoreMessageIds": ["msg_123", "msg_456"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Messages marked as read"
  }
}
```

**Notes**:
- Updates `last_read_at` in `channel_members`
- Resets `unread_count` to 0
- Optionally records individual message reads

---

### 10. Get Unread Counts

**GET** `/api/channels/unread-counts`

**Response**:
```json
{
  "success": true,
  "data": {
    "unreadCounts": [
      {
        "channelId": 1,
        "channelName": "General Discussion",
        "channelType": "public",
        "unreadCount": 5,
        "lastReadAt": "2024-01-15T10:00:00Z"
      }
    ],
    "totalUnread": 12
  }
}
```

---

## Firebase Integration

### Firestore Structure

#### Channel Messages
```
channels/{channelId}/messages/{messageId}
```

**Message Document**:
```json
{
  "id": "msg_1234567890",
  "channelId": 1,
  "authorId": 789,
  "author": {
    "id": 789,
    "fullName": "John Doe",
    "email": "john@example.com",
    "avatarUrl": "https://...",
    "avatarColor": "#8b5cf6",
    "initials": "JD"
  },
  "content": "Hello team!",
  "type": "text",
  "attachments": [],
  "reactions": {},
  "edited": false,
  "editedAt": null,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "deletedAt": null
}
```

#### Direct Messages
```
directMessages/{channelId}/messages/{messageId}
```

Same structure as channel messages.

#### Channel Metadata (Synced from MySQL)
```
channelMetadata/{channelId}
```

**Metadata Document**:
```json
{
  "mysqlChannelId": 1,
  "name": "General Discussion",
  "type": "public",
  "createdBy": 1,
  "memberIds": [1, 2, 3, 4],
  "memberCount": 4,
  "lastSyncedAt": "2024-01-15T10:00:00Z"
}
```

### Firebase Sync Service

The `firebase-sync.service.js` handles syncing MySQL data to Firestore:

- **syncUserToFirestore**: Syncs user profile updates
- **syncChannelToFirestore**: Syncs channel metadata
- **removeChannelFromFirestore**: Removes deleted channels
- **updateChannelLastMessage**: Updates last message timestamp
- **incrementUnreadCount**: Increments unread counts for members
- **generateFirebaseToken**: Generates custom token for client auth

### Client Integration

1. **Get Firebase Token**:
   ```javascript
   POST /api/auth/firebase-token
   // Returns Firebase custom token
   ```

2. **Initialize Firebase Client**:
   ```javascript
   import { signInWithCustomToken } from 'firebase/auth';
   await signInWithCustomToken(auth, firebaseToken);
   ```

3. **Subscribe to Messages**:
   ```javascript
   import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
   
   const messagesRef = collection(db, `channels/${channelId}/messages`);
   const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
   
   onSnapshot(q, (snapshot) => {
     // Handle new messages
   });
   ```

---

## Security Considerations

### MySQL Backend
- All endpoints require JWT authentication
- Role-based access control (owner/admin/member)
- Soft deletes for data retention

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check membership
    function isChannelMember(channelId, userId) {
      return exists(/databases/$(database)/documents/channelMetadata/$(channelId)) &&
        userId in get(/databases/$(database)/documents/channelMetadata/$(channelId)).data.memberIds;
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
      allow read, create: if request.auth != null && 
        isChannelMember(channelId, request.auth.uid);
      allow update, delete: if request.auth != null && 
        resource.data.authorId == request.auth.uid;
    }
  }
}
```

---

## Migration Steps

1. **Run Database Migration**:
   ```sql
   -- Execute channels_schema.sql
   ```

2. **Install Dependencies**:
   ```bash
   npm install firebase-admin
   ```

3. **Configure Firebase**:
   - Download service account JSON
   - Place in `src/config/firebase-service-account.json`

4. **Update User Controller**:
   - Add Firebase sync on user profile updates

5. **Test Endpoints**:
   - Use Postman or similar to test all endpoints
   - Verify Firebase sync is working

---

## Error Handling

All endpoints follow the standard response format:

**Success**:
```json
{
  "success": true,
  "data": {...}
}
```

**Error**:
```json
{
  "success": false,
  "message": "Error message",
  "statusCode": 400
}
```

**Common Status Codes**:
- `400`: Bad Request (validation errors)
- `403`: Forbidden (permission denied)
- `404`: Not Found
- `500`: Internal Server Error

---

## Performance Considerations

1. **Unread Counts**: Cached in `channel_members.unread_count`
2. **Last Message**: Cached in `channels.last_message_at` for sorting
3. **Firebase Sync**: Async, non-blocking
4. **Pagination**: Implement for large channel lists (future)

---

## Future Enhancements

- [ ] Typing indicators
- [ ] Message search
- [ ] File attachments
- [ ] Message reactions
- [ ] Thread replies
- [ ] Channel mentions (@channel)
- [ ] User mentions (@user)
- [ ] Push notifications
- [ ] Message editing/deletion
- [ ] Channel archiving

---

## Support

For issues or questions, refer to:
- Channel Controller: `src/controllers/channelController.js`
- Routes: `src/routes/channels.js`
- Models: `src/models/Channel.js`, `src/models/ChannelMember.js`
- Firebase Sync: `src/services/firebase-sync.service.js`

