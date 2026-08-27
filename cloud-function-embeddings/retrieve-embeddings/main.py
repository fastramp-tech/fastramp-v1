import functions_framework
from google.cloud import storage
import json
from flask import jsonify

# Initialize Cloud Storage client
storage_client = storage.Client()
BUCKET_NAME = 'myformsnapper-embeddings'

@functions_framework.http
def retrieve_embeddings(request):
    """
    Retrieve embeddings from Google Cloud Storage

    Input JSON:
    {
        "userId": "user_123",
        "documentId": "doc_456"  // Optional - if not provided, retrieve all documents for user
    }

    Output JSON:
    {
        "success": true,
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
        },
        "documentsCount": 1
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
        if 'userId' not in request_json:
            return (jsonify({'success': False, 'error': 'Missing required field: userId'}), 400, headers)

        user_id = request_json['userId']
        document_id = request_json.get('documentId')  # Optional

        bucket = storage_client.bucket(BUCKET_NAME)

        if not bucket.exists():
            print(f'⚠️  Bucket {BUCKET_NAME} does not exist')
            return (jsonify({
                'success': True,
                'chunks': [],
                'metadata': [],
                'documentsCount': 0,
                'message': 'No documents found'
            }), 200, headers)

        all_chunks = []
        all_metadata = []

        if document_id:
            # Retrieve specific document
            print(f'📥 Retrieving document {document_id} for user {user_id}')

            # Get chunks
            chunks_blob_name = f'users/{user_id}/documents/{document_id}/chunks.json'
            chunks_blob = bucket.blob(chunks_blob_name)

            if not chunks_blob.exists():
                return (jsonify({
                    'success': False,
                    'error': f'Document {document_id} not found'
                }), 404, headers)

            chunks_data = chunks_blob.download_as_text()
            chunks = json.loads(chunks_data)
            all_chunks.extend(chunks)

            # Get metadata
            metadata_blob_name = f'users/{user_id}/documents/{document_id}/metadata.json'
            metadata_blob = bucket.blob(metadata_blob_name)

            if metadata_blob.exists():
                metadata_data = metadata_blob.download_as_text()
                metadata = json.loads(metadata_data)
                all_metadata.append(metadata)

            print(f'✅ Retrieved {len(chunks)} chunks for document {document_id}')

        else:
            # Retrieve all documents for user
            print(f'📥 Retrieving all documents for user {user_id}')

            prefix = f'users/{user_id}/documents/'
            blobs = bucket.list_blobs(prefix=prefix)

            # Group blobs by document
            documents = {}
            for blob in blobs:
                # Parse path: users/{userId}/documents/{documentId}/{file}.json
                parts = blob.name.split('/')
                if len(parts) >= 5:
                    doc_id = parts[3]
                    file_type = parts[4]  # chunks.json or metadata.json

                    if doc_id not in documents:
                        documents[doc_id] = {}

                    documents[doc_id][file_type] = blob

            # Retrieve all chunks and metadata
            for doc_id, files in documents.items():
                if 'chunks.json' in files:
                    chunks_data = files['chunks.json'].download_as_text()
                    chunks = json.loads(chunks_data)
                    all_chunks.extend(chunks)

                if 'metadata.json' in files:
                    metadata_data = files['metadata.json'].download_as_text()
                    metadata = json.loads(metadata_data)
                    all_metadata.append(metadata)

            print(f'✅ Retrieved {len(all_chunks)} chunks from {len(documents)} documents')

        return (jsonify({
            'success': True,
            'chunks': all_chunks,
            'metadata': all_metadata,
            'documentsCount': len(all_metadata),
            'message': f'Retrieved {len(all_chunks)} chunks from {len(all_metadata)} documents'
        }), 200, headers)

    except Exception as e:
        print(f'❌ Error retrieving embeddings: {str(e)}')
        return (jsonify({
            'success': False,
            'error': str(e)
        }), 500, headers)
