# Deploy Cloud Storage for Embeddings - Web Console Guide

Since gcloud CLI is not installed, follow these steps to deploy using Google Cloud Console.

## Step 1: Create Cloud Storage Bucket

1. Go to https://console.cloud.google.com/storage/browser?project=crafty-cairn-469222-a8
2. Click **"CREATE BUCKET"**
3. Configure:
   - **Bucket name**: `myformsnapper-embeddings`
   - **Location type**: Region
   - **Region**: `us-central1` (same as your Cloud Functions)
   - **Storage class**: Standard
   - **Access control**: Uniform
   - Click **"CREATE"**

4. Set CORS configuration:
   - Click on the bucket name `myformsnapper-embeddings`
   - Go to **"PERMISSIONS"** tab
   - Click **"ADD"** under Principals
   - Add your service account: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
   - Role: **Storage Admin**
   - Click **"SAVE"**

## Step 2: Deploy save-embeddings Cloud Function

1. Go to https://console.cloud.google.com/functions/list?project=crafty-cairn-469222-a8
2. Click **"CREATE FUNCTION"**
3. **Configuration tab**:
   - **Environment**: 2nd gen
   - **Function name**: `save-embeddings`
   - **Region**: `us-central1`
   - **Trigger**: HTTPS
   - **Authentication**: Allow unauthenticated invocations ✓
   - Click **"SAVE"**
   - Click **"NEXT"**

4. **Code tab**:
   - **Runtime**: Python 3.11
   - **Entry point**: `save_embeddings`
   - **Source code**: Inline editor

5. Copy the following files:

**main.py** (see content below):
```python
import functions_framework
from google.cloud import storage
import json
from flask import jsonify

# Initialize Cloud Storage client
storage_client = storage.Client()
BUCKET_NAME = 'myformsnapper-embeddings'

@functions_framework.http
def save_embeddings(request):
    """Save embeddings to Google Cloud Storage"""

    # Enable CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {'Access-Control-Allow-Origin': '*'}

    try:
        request_json = request.get_json(silent=True)

        if not request_json:
            return (jsonify({'success': False, 'error': 'No JSON data provided'}), 400, headers)

        # Validate required fields
        required_fields = ['userId', 'documentId', 'fileName', 'chunks', 'metadata']
        for field in required_fields:
            if field not in request_json:
                return (jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400, headers)

        user_id = request_json['userId']
        document_id = request_json['documentId']
        file_name = request_json['fileName']
        chunks = request_json['chunks']
        metadata = request_json['metadata']

        # Get bucket
        bucket = storage_client.bucket(BUCKET_NAME)

        # Save chunks
        chunks_blob_name = f'users/{user_id}/documents/{document_id}/chunks.json'
        chunks_blob = bucket.blob(chunks_blob_name)
        chunks_blob.upload_from_string(json.dumps(chunks, indent=2), content_type='application/json')

        # Save metadata
        metadata_blob_name = f'users/{user_id}/documents/{document_id}/metadata.json'
        metadata_blob = bucket.blob(metadata_blob_name)
        metadata_blob.upload_from_string(json.dumps(metadata, indent=2), content_type='application/json')

        storage_url = f'gs://{BUCKET_NAME}/{chunks_blob_name}'

        print(f'✅ Saved embeddings for {file_name} - Chunks: {len(chunks)}')

        return (jsonify({
            'success': True,
            'documentId': document_id,
            'chunksSaved': len(chunks),
            'storageUrl': storage_url,
            'storage': 'cloud',
            'message': f'Successfully saved {len(chunks)} chunks for {file_name}'
        }), 200, headers)

    except Exception as e:
        print(f'❌ Error saving embeddings: {str(e)}')
        return (jsonify({'success': False, 'error': str(e)}), 500, headers)
```

**requirements.txt**:
```
functions-framework==3.*
google-cloud-storage==2.10.0
flask==3.0.0
```

6. Click **"DEPLOY"** (deployment takes 2-3 minutes)

## Step 3: Deploy retrieve-embeddings Cloud Function

1. Click **"CREATE FUNCTION"** again
2. **Configuration tab**:
   - **Function name**: `retrieve-embeddings`
   - **Region**: `us-central1`
   - **Trigger**: HTTPS
   - **Authentication**: Allow unauthenticated invocations ✓
   - Click **"NEXT"**

3. **Code tab**:
   - **Runtime**: Python 3.11
   - **Entry point**: `retrieve_embeddings`

**main.py**:
```python
import functions_framework
from google.cloud import storage
import json
from flask import jsonify

storage_client = storage.Client()
BUCKET_NAME = 'myformsnapper-embeddings'

@functions_framework.http
def retrieve_embeddings(request):
    """Retrieve embeddings from Google Cloud Storage"""

    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {'Access-Control-Allow-Origin': '*'}

    try:
        request_json = request.get_json(silent=True)

        if not request_json or 'userId' not in request_json:
            return (jsonify({'success': False, 'error': 'Missing userId'}), 400, headers)

        user_id = request_json['userId']
        document_id = request_json.get('documentId')

        bucket = storage_client.bucket(BUCKET_NAME)

        if not bucket.exists():
            return (jsonify({'success': True, 'chunks': [], 'metadata': [], 'documentsCount': 0}), 200, headers)

        all_chunks = []
        all_metadata = []

        if document_id:
            # Retrieve specific document
            chunks_blob_name = f'users/{user_id}/documents/{document_id}/chunks.json'
            chunks_blob = bucket.blob(chunks_blob_name)

            if not chunks_blob.exists():
                return (jsonify({'success': False, 'error': f'Document {document_id} not found'}), 404, headers)

            chunks_data = chunks_blob.download_as_text()
            chunks = json.loads(chunks_data)
            all_chunks.extend(chunks)

            metadata_blob_name = f'users/{user_id}/documents/{document_id}/metadata.json'
            metadata_blob = bucket.blob(metadata_blob_name)

            if metadata_blob.exists():
                metadata_data = metadata_blob.download_as_text()
                metadata = json.loads(metadata_data)
                all_metadata.append(metadata)

        else:
            # Retrieve all documents for user
            prefix = f'users/{user_id}/documents/'
            blobs = bucket.list_blobs(prefix=prefix)

            documents = {}
            for blob in blobs:
                parts = blob.name.split('/')
                if len(parts) >= 5:
                    doc_id = parts[3]
                    file_type = parts[4]
                    if doc_id not in documents:
                        documents[doc_id] = {}
                    documents[doc_id][file_type] = blob

            for doc_id, files in documents.items():
                if 'chunks.json' in files:
                    chunks_data = files['chunks.json'].download_as_text()
                    chunks = json.loads(chunks_data)
                    all_chunks.extend(chunks)

                if 'metadata.json' in files:
                    metadata_data = files['metadata.json'].download_as_text()
                    metadata = json.loads(metadata_data)
                    all_metadata.append(metadata)

        print(f'✅ Retrieved {len(all_chunks)} chunks from {len(all_metadata)} documents')

        return (jsonify({
            'success': True,
            'chunks': all_chunks,
            'metadata': all_metadata,
            'documentsCount': len(all_metadata)
        }), 200, headers)

    except Exception as e:
        print(f'❌ Error retrieving embeddings: {str(e)}')
        return (jsonify({'success': False, 'error': str(e)}), 500, headers)
```

**requirements.txt**: (same as save-embeddings)

4. Click **"DEPLOY"**

## Step 4: Deploy delete-embeddings Cloud Function

1. Click **"CREATE FUNCTION"** again
2. **Configuration tab**:
   - **Function name**: `delete-embeddings`
   - **Region**: `us-central1`
   - **Trigger**: HTTPS
   - **Authentication**: Allow unauthenticated invocations ✓
   - Click **"NEXT"**

3. **Code tab**:
   - **Runtime**: Python 3.11
   - **Entry point**: `delete_embeddings`

**main.py**:
```python
import functions_framework
from google.cloud import storage
import json
from flask import jsonify

storage_client = storage.Client()
BUCKET_NAME = 'myformsnapper-embeddings'

@functions_framework.http
def delete_embeddings(request):
    """Delete embeddings from Google Cloud Storage"""

    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {'Access-Control-Allow-Origin': '*'}

    try:
        request_json = request.get_json(silent=True)

        if not request_json or 'userId' not in request_json:
            return (jsonify({'success': False, 'error': 'Missing userId'}), 400, headers)

        user_id = request_json['userId']
        document_id = request_json.get('documentId')

        bucket = storage_client.bucket(BUCKET_NAME)

        if not bucket.exists():
            return (jsonify({'success': True, 'documentsDeleted': 0}), 200, headers)

        deleted_count = 0

        if document_id:
            # Delete specific document
            prefix = f'users/{user_id}/documents/{document_id}/'
            blobs = list(bucket.list_blobs(prefix=prefix))

            if not blobs:
                return (jsonify({'success': False, 'error': f'Document {document_id} not found'}), 404, headers)

            for blob in blobs:
                blob.delete()

            deleted_count = 1
            message = f'Successfully deleted document {document_id}'

        else:
            # Delete all documents for user
            prefix = f'users/{user_id}/documents/'
            blobs = list(bucket.list_blobs(prefix=prefix))

            documents = set()
            for blob in blobs:
                parts = blob.name.split('/')
                if len(parts) >= 5:
                    documents.add(parts[3])

            for blob in blobs:
                blob.delete()

            deleted_count = len(documents)
            message = f'Successfully deleted {deleted_count} documents'

        print(f'✅ {message}')

        return (jsonify({
            'success': True,
            'documentsDeleted': deleted_count,
            'message': message
        }), 200, headers)

    except Exception as e:
        print(f'❌ Error deleting embeddings: {str(e)}')
        return (jsonify({'success': False, 'error': str(e)}), 500, headers)
```

**requirements.txt**: (same as save-embeddings)

4. Click **"DEPLOY"**

## Step 5: Test Deployment

After all 3 functions are deployed, test them using curl or Postman:

**Test save-embeddings:**
```bash
curl -X POST https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/save-embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "documentId": "test_doc",
    "fileName": "test.txt",
    "chunks": [{"fileName": "test.txt", "chunkIndex": 0, "text": "Hello", "embedding": [0.1, 0.2], "timestamp": 1234567890}],
    "metadata": {"fileName": "test.txt", "documentId": "test_doc", "chunksProcessed": 1, "uploadedAt": 1234567890}
  }'
```

Expected response:
```json
{
  "success": true,
  "documentId": "test_doc",
  "chunksSaved": 1,
  "storageUrl": "gs://myformsnapper-embeddings/users/test_user/documents/test_doc/chunks.json",
  "storage": "cloud"
}
```

**Test retrieve-embeddings:**
```bash
curl -X POST https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/retrieve-embeddings \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user", "documentId": "test_doc"}'
```

**Test delete-embeddings:**
```bash
curl -X POST https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/delete-embeddings \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user", "documentId": "test_doc"}'
```

## Step 6: Verify in Extension

1. Reload your Chrome extension
2. Open the extension panel
3. Go to Settings (⚙️ icon)
4. Change **Embedding Storage Location** to **"Cloud Storage (Unlimited, requires internet)"**
5. Try uploading a PDF or LinkedIn resume
6. Check browser console for logs:
   - Should see: `💾 Saving embeddings: mode=cloud`
   - Should see: `✅ Successfully saved to cloud storage`

## Troubleshooting

**Error: "Bucket does not exist"**
- Make sure you created the bucket in Step 1
- Bucket name must be exactly `myformsnapper-embeddings`

**Error: "Permission denied"**
- Go to Cloud Storage bucket → Permissions
- Add service account with Storage Admin role

**Error: "CORS blocked"**
- Functions already have CORS headers in code
- No additional CORS configuration needed

## Cost Estimate

- **Cloud Storage**: $0.020/GB/month (~$1 for 50GB)
- **Cloud Functions**: Free tier covers hackathon usage (2M invocations/month free)
- **Expected total**: $0-2/month for hackathon