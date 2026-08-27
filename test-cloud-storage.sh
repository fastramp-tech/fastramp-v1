#!/bin/bash

# Test script for Cloud Storage embeddings deployment

set -e

PROJECT_ID="crafty-cairn-469222-a8"
BASE_URL="https://us-central1-$PROJECT_ID.cloudfunctions.net"

echo "======================================"
echo "Testing Cloud Storage Deployment"
echo "======================================"
echo ""

# Test save-embeddings
echo "1️⃣  Testing save-embeddings..."
SAVE_RESPONSE=$(curl -s -X POST $BASE_URL/save-embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "documentId": "test_doc_456",
    "fileName": "test.txt",
    "chunks": [
      {
        "fileName": "test.txt",
        "chunkIndex": 0,
        "text": "Hello world from test",
        "embedding": [0.1, 0.2, 0.3, 0.4, 0.5],
        "timestamp": 1234567890
      }
    ],
    "metadata": {
      "fileName": "test.txt",
      "documentId": "test_doc_456",
      "chunksProcessed": 1,
      "uploadedAt": 1234567890
    }
  }')

echo "Response: $SAVE_RESPONSE"

if echo "$SAVE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ save-embeddings working correctly"
else
    echo "❌ save-embeddings failed"
    exit 1
fi

echo ""

# Test retrieve-embeddings
echo "2️⃣  Testing retrieve-embeddings..."
RETRIEVE_RESPONSE=$(curl -s -X POST $BASE_URL/retrieve-embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "documentId": "test_doc_456"
  }')

echo "Response: $RETRIEVE_RESPONSE"

if echo "$RETRIEVE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ retrieve-embeddings working correctly"
else
    echo "❌ retrieve-embeddings failed"
    exit 1
fi

echo ""

# Test delete-embeddings
echo "3️⃣  Testing delete-embeddings..."
DELETE_RESPONSE=$(curl -s -X POST $BASE_URL/delete-embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "documentId": "test_doc_456"
  }')

echo "Response: $DELETE_RESPONSE"

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ delete-embeddings working correctly"
else
    echo "❌ delete-embeddings failed"
    exit 1
fi

echo ""
echo "======================================"
echo "✅ ALL TESTS PASSED!"
echo "======================================"
echo ""
echo "Cloud Storage embeddings are fully functional."
echo "You can now use Cloud Storage mode in your extension."
echo ""
