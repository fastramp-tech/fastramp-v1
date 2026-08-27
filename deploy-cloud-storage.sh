#!/bin/bash

# Deployment script for Cloud Storage embeddings
# This script deploys all 3 Cloud Functions to Google Cloud

set -e  # Exit on error

PROJECT_ID="crafty-cairn-469222-a8"
REGION="us-central1"
BUCKET_NAME="myformsnapper-embeddings"

echo "======================================"
echo "Cloud Storage Embeddings Deployment"
echo "======================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Bucket: $BUCKET_NAME"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ ERROR: gcloud CLI is not installed"
    echo ""
    echo "Please install Google Cloud SDK first:"
    echo "  brew install --cask google-cloud-sdk"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Check if authenticated
echo "📋 Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated. Running gcloud auth login..."
    gcloud auth login
fi

# Set project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Create bucket
echo ""
echo "======================================"
echo "Step 1: Creating Cloud Storage Bucket"
echo "======================================"
if gsutil ls -b gs://$BUCKET_NAME &> /dev/null; then
    echo "✅ Bucket $BUCKET_NAME already exists"
else
    echo "📦 Creating bucket $BUCKET_NAME..."
    gsutil mb -c STANDARD -l $REGION gs://$BUCKET_NAME
    echo "✅ Bucket created successfully"
fi

# Deploy save-embeddings
echo ""
echo "======================================"
echo "Step 2: Deploying save-embeddings"
echo "======================================"
cd cloud-function-embeddings/save-embeddings

gcloud functions deploy save-embeddings \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=save_embeddings \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB

echo "✅ save-embeddings deployed successfully"

# Deploy retrieve-embeddings
echo ""
echo "======================================"
echo "Step 3: Deploying retrieve-embeddings"
echo "======================================"
cd ../retrieve-embeddings

gcloud functions deploy retrieve-embeddings \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=retrieve_embeddings \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB

echo "✅ retrieve-embeddings deployed successfully"

# Deploy delete-embeddings
echo ""
echo "======================================"
echo "Step 4: Deploying delete-embeddings"
echo "======================================"
cd ../delete-embeddings

gcloud functions deploy delete-embeddings \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=delete_embeddings \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=256MB

echo "✅ delete-embeddings deployed successfully"

# Return to root directory
cd ../..

echo ""
echo "======================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "Deployed Cloud Functions:"
echo "  1. https://us-central1-$PROJECT_ID.cloudfunctions.net/save-embeddings"
echo "  2. https://us-central1-$PROJECT_ID.cloudfunctions.net/retrieve-embeddings"
echo "  3. https://us-central1-$PROJECT_ID.cloudfunctions.net/delete-embeddings"
echo ""
echo "Cloud Storage Bucket:"
echo "  gs://$BUCKET_NAME"
echo ""
echo "Next Steps:"
echo "  1. Run ./test-cloud-storage.sh to test deployment"
echo "  2. Reload your Chrome extension"
echo "  3. Change storage mode to 'Cloud Storage' in settings"
echo ""
