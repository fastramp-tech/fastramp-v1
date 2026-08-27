import functions_framework
from google.cloud import storage
import json
from flask import jsonify

# Initialize Cloud Storage client
storage_client = storage.Client()
BUCKET_NAME = 'myformsnapper-embeddings'

@functions_framework.http
def save_embeddings(request):
    """
    Save embeddings to Google Cloud Storage

    Input JSON:
    {
        "userId": "user_123",
        "documentId": "doc_456",
        "fileName": "resume.pdf",
        "chunks": [
            {
                "fileName": "resume.pdf",
                "chunkIndex": 0,
                "text": "chunk text...",
                "embedding": [768 float values],
                "timestamp": 1234567890
            }
        ],
        "metadata": {
            "fileName": "resume.pdf",
            "documentId": "doc_456",
            "chunksProcessed": 5,
            "uploadedAt": 1234567890
        }
    }

    Output JSON:
    {
        "success": true,
        "documentId": "doc_456",
        "chunksSaved": 5,
        "storageUrl": "gs://bucket/path/to/file",
        "storage": "cloud"
    }
    """

    # Enable CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*'
    }

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

        # Validate data types
        if not isinstance(chunks, list):
            return (jsonify({'success': False, 'error': 'chunks must be an array'}), 400, headers)

        if len(chunks) == 0:
            return (jsonify({'success': False, 'error': 'chunks array is empty'}), 400, headers)

        # Get or create bucket
        try:
            bucket = storage_client.bucket(BUCKET_NAME)
            if not bucket.exists():
                bucket = storage_client.create_bucket(BUCKET_NAME, location='us-central1')
                print(f'✅ Created bucket: {BUCKET_NAME}')
        except Exception as e:
            print(f'⚠️  Bucket access: {str(e)}')
            bucket = storage_client.bucket(BUCKET_NAME)

        # Save chunks to Cloud Storage
        # Path: /users/{userId}/documents/{documentId}/chunks.json
        chunks_blob_name = f'users/{user_id}/documents/{document_id}/chunks.json'
        chunks_blob = bucket.blob(chunks_blob_name)
        chunks_blob.upload_from_string(
            json.dumps(chunks, indent=2),
            content_type='application/json'
        )

        # Save metadata to Cloud Storage
        # Path: /users/{userId}/documents/{documentId}/metadata.json
        metadata_blob_name = f'users/{user_id}/documents/{document_id}/metadata.json'
        metadata_blob = bucket.blob(metadata_blob_name)
        metadata_blob.upload_from_string(
            json.dumps(metadata, indent=2),
            content_type='application/json'
        )

        storage_url = f'gs://{BUCKET_NAME}/{chunks_blob_name}'

        print(f'✅ Saved embeddings for {file_name}')
        print(f'   User: {user_id}')
        print(f'   Document: {document_id}')
        print(f'   Chunks: {len(chunks)}')
        print(f'   Storage URL: {storage_url}')

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
        return (jsonify({
            'success': False,
            'error': str(e)
        }), 500, headers)
