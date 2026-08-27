import functions_framework
from google.cloud import storage
import json
from flask import jsonify

# Initialize Cloud Storage client
storage_client = storage.Client()
BUCKET_NAME = 'myformsnapper-embeddings'

@functions_framework.http
def delete_embeddings(request):
    """
    Delete embeddings from Google Cloud Storage

    Input JSON:
    {
        "userId": "user_123",
        "documentId": "doc_456"  // Optional - if not provided, delete all documents for user
    }

    Output JSON:
    {
        "success": true,
        "documentsDeleted": 1,
        "message": "Successfully deleted document doc_456"
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
                'documentsDeleted': 0,
                'message': 'No documents to delete'
            }), 200, headers)

        deleted_count = 0

        if document_id:
            # Delete specific document
            print(f'🗑️  Deleting document {document_id} for user {user_id}')

            prefix = f'users/{user_id}/documents/{document_id}/'
            blobs = list(bucket.list_blobs(prefix=prefix))

            if not blobs:
                return (jsonify({
                    'success': False,
                    'error': f'Document {document_id} not found'
                }), 404, headers)

            for blob in blobs:
                blob.delete()
                print(f'   ✓ Deleted: {blob.name}')

            deleted_count = 1
            message = f'Successfully deleted document {document_id}'

        else:
            # Delete all documents for user
            print(f'🗑️  Deleting all documents for user {user_id}')

            prefix = f'users/{user_id}/documents/'
            blobs = list(bucket.list_blobs(prefix=prefix))

            # Group by document
            documents = set()
            for blob in blobs:
                parts = blob.name.split('/')
                if len(parts) >= 5:
                    doc_id = parts[3]
                    documents.add(doc_id)

            # Delete all blobs
            for blob in blobs:
                blob.delete()
                print(f'   ✓ Deleted: {blob.name}')

            deleted_count = len(documents)
            message = f'Successfully deleted {deleted_count} documents for user {user_id}'

        print(f'✅ {message}')

        return (jsonify({
            'success': True,
            'documentsDeleted': deleted_count,
            'message': message
        }), 200, headers)

    except Exception as e:
        print(f'❌ Error deleting embeddings: {str(e)}')
        return (jsonify({
            'success': False,
            'error': str(e)
        }), 500, headers)
