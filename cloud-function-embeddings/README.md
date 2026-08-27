# Cloud Storage for Embeddings - Deployment Guide

This folder contains Google Cloud Functions for storing embeddings in Google Cloud Storage instead of Chrome's local storage (10MB limit).

## Architecture

```
Chrome Extension → Cloud Functions → Cloud Storage Bucket
                                      (myformsnapper-embeddings)
```

**Storage Structure:**
```
myformsnapper-embeddings/
  └── users/
      └── {userId}/
          └── documents/
              └── {documentId}/
                  ├── chunks.json      (embedding vectors + text)
                  └── metadata.json    (document metadata)
```

## Cloud Functions

### 1. save-embeddings
- **Purpose**: Save embedding chunks to Cloud Storage
- **Endpoint**: `https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/save-embeddings`
- **Method**: POST
- **Input**: userId, documentId, fileName, chunks array, metadata
- **Output**: success, documentId, chunksSaved, storageUrl

### 2. retrieve-embeddings
- **Purpose**: Retrieve embeddings from Cloud Storage
- **Endpoint**: `https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/retrieve-embeddings`
- **Method**: POST
- **Input**: userId, documentId (optional - if omitted, returns all documents)
- **Output**: success, chunks array, metadata array, documentsCount

### 3. delete-embeddings
- **Purpose**: Delete embeddings from Cloud Storage
- **Endpoint**: `https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/delete-embeddings`
- **Method**: POST
- **Input**: userId, documentId (optional - if omitted, deletes all user documents)
- **Output**: success, documentsDeleted, message

## Deployment Steps

### Prerequisites
```bash
# Install Google Cloud SDK
brew install --cask google-cloud-sdk

# Authenticate
gcloud auth login

# Set project
gcloud config set project crafty-cairn-469222-a8
```

### Step 1: Create Cloud Storage Bucket
```bash
# Create bucket in us-central1 (same region as cloud functions)
gsutil mb -c STANDARD -l us-central1 gs://myformsnapper-embeddings

# Set CORS configuration for Chrome Extension
cat > cors-config.json << 'EOF'
[
  {
    "origin": ["chrome-extension://*"],
    "method": ["GET", "POST", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors-config.json gs://myformsnapper-embeddings
rm cors-config.json
```

### Step 2: Deploy Cloud Functions

**Deploy save-embeddings:**
```bash
cd cloud-function-embeddings/save-embeddings

gcloud functions deploy save-embeddings \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=save_embeddings \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB
```

**Deploy retrieve-embeddings:**
```bash
cd ../retrieve-embeddings

gcloud functions deploy retrieve-embeddings \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=retrieve_embeddings \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB
```

**Deploy delete-embeddings:**
```bash
cd ../delete-embeddings

gcloud functions deploy delete-embeddings \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=delete_embeddings \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=256MB
```

### Step 3: Verify Deployment

```bash
# List deployed functions
gcloud functions list --region=us-central1

# Test save-embeddings
curl -X POST https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/save-embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "documentId": "test_doc_456",
    "fileName": "test.txt",
    "chunks": [
      {
        "fileName": "test.txt",
        "chunkIndex": 0,
        "text": "Hello world",
        "embedding": [0.1, 0.2, 0.3],
        "timestamp": 1234567890
      }
    ],
    "metadata": {
      "fileName": "test.txt",
      "documentId": "test_doc_456",
      "chunksProcessed": 1,
      "uploadedAt": 1234567890
    }
  }'

# Test retrieve-embeddings
curl -X POST https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/retrieve-embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "documentId": "test_doc_456"
  }'

# Test delete-embeddings
curl -X POST https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/delete-embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "documentId": "test_doc_456"
  }'
```

### Step 4: View Logs

```bash
# View logs for save-embeddings
gcloud functions logs read save-embeddings --region=us-central1 --limit=50

# View logs for retrieve-embeddings
gcloud functions logs read retrieve-embeddings --region=us-central1 --limit=50

# View logs for delete-embeddings
gcloud functions logs read delete-embeddings --region=us-central1 --limit=50
```

## Testing Locally

You can test cloud functions locally using Functions Framework:

```bash
cd save-embeddings

# Install dependencies
pip install -r requirements.txt

# Run locally
functions-framework --target=save_embeddings --debug

# Test with curl (in another terminal)
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "documentId": "doc1", ...}'
```

## Cost Estimation

**Cloud Storage:**
- Storage: $0.020 per GB/month
- Operations: $0.05 per 10,000 operations
- Example: 1000 users × 50MB = 50GB = **$1/month**

**Cloud Functions (Gen2):**
- Invocations: First 2M free/month
- Compute: First 400K GB-seconds free/month
- Memory: First 200K GHz-seconds free/month
- Expected: **Free tier** for hackathon usage

## Security Considerations

1. **No Authentication Required**: Functions are `--allow-unauthenticated` for hackathon demo
2. **Production**: Add API key authentication or Firebase Auth
3. **CORS**: Configured to accept requests from Chrome extensions
4. **Rate Limiting**: Consider adding rate limits for production
5. **Data Privacy**: User data stored in Cloud Storage bucket (ensure proper IAM policies)

## Troubleshooting

**Error: "Bucket does not exist"**
- Run: `gsutil mb -l us-central1 gs://myformsnapper-embeddings`

**Error: "Permission denied"**
- Ensure Cloud Functions service account has Storage Admin role
- Run: `gcloud projects add-iam-policy-binding crafty-cairn-469222-a8 --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/storage.admin"`

**Error: "CORS blocked"**
- Verify CORS config: `gsutil cors get gs://myformsnapper-embeddings`
- Re-apply CORS: `gsutil cors set cors-config.json gs://myformsnapper-embeddings`

## Next Steps

After deploying these cloud functions:
1. ✅ Create `storage-manager.js` abstraction layer
2. ✅ Add UI toggle in extension settings
3. ✅ Integrate StorageManager into background.js
4. ✅ Test with real embeddings data
