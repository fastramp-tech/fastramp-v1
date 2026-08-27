# FastRamp - Technical Architecture

**Detailed system design and data flow documentation**

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Google Cloud Infrastructure](#google-cloud-infrastructure)
3. [Chrome Extension Architecture](#chrome-extension-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [AI Inference Routing](#ai-inference-routing)
6. [Storage Management](#storage-management)
7. [Voice Assistant Architecture](#voice-assistant-architecture)
8. [Security & Privacy](#security--privacy)

---

## System Overview

FastRamp is a Chrome extension built with a serverless Google Cloud backend, hybrid AI inference, and intelligent storage management.

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          User's Browser                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  Chrome Extension                             │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │  Content    │  │   Service    │  │   Extension      │   │  │
│  │  │  Scripts    │  │   Worker     │  │   Popup UI       │   │  │
│  │  │             │  │ (background) │  │  (panel-injector)│   │  │
│  │  │ - Form Det. │  │ - AI Logic   │  │  - Settings      │   │  │
│  │  │ - Field Fill│  │ - Storage    │  │  - Upload        │   │  │
│  │  │ - Voice UI  │  │ - Cloud Sync │  │  - KB Mgmt       │   │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │  │
│  │         │                │                    │             │  │
│  └─────────┼────────────────┼────────────────────┼─────────────┘  │
│            │                │                    │                │
└────────────┼────────────────┼────────────────────┼────────────────┘
             │                │                    │
             │         ┌──────▼────────┐           │
             │         │  Chrome APIs  │           │
             │         │  - Storage    │           │
             │         │  - Runtime    │           │
             │         │  - Tabs       │           │
             │         └──────┬────────┘           │
             │                │                    │
             └────────────────┼────────────────────┘
                              │
     ┌────────────────────────┼────────────────────────┐
     │                        │                        │
┌────▼──────────┐   ┌─────────▼─────────┐   ┌────────▼────────┐
│  Google Cloud │   │  Gemini AI APIs   │   │ Chrome Built-in │
│ Infrastructure│   │                   │   │      AI         │
│               │   │  - Gemini 2.5     │   │  - Gemini Nano  │
│  - Functions  │   │    Flash          │   │  - Prompt API   │
│  - Storage    │   │  - Live API 2.5   │   │                 │
│  - IAM        │   │  - Embeddings     │   │                 │
└───────────────┘   └───────────────────┘   └─────────────────┘
```

---

## Google Cloud Infrastructure

### Cloud Functions Architecture

```
┌──────────────────────────────────────────────────────────┐
│            Google Cloud Functions (Gen2)                  │
│                 Region: us-central1                      │
└─────────────────────┬────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼────┐  ┌────▼────┐  ┌───▼──────┐  ┌──────────┐
    │scrape-  │  │  save-  │  │retrieve- │  │ delete-  │
    │linkedin │  │embeddings│ │embeddings│  │embeddings│
    │         │  │          │  │          │  │          │
    │Python311│  │Python311 │  │Python311 │  │Python311 │
    │512MB    │  │512MB     │  │512MB     │  │256MB     │
    │540s     │  │540s      │  │540s      │  │540s      │
    └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
         │            │             │             │
         │       ┌────▼─────────────▼─────────────▼──────┐
         │       │    Google Cloud Storage Bucket        │
         │       │   myformsnapper-embeddings            │
         │       │   - Standard class                    │
         │       │   - us-central1 region                │
         │       │   - Unlimited capacity                │
         │       └───────────────────────────────────────┘
         │
    ┌────▼────────────┐
    │  Toolhouse API  │
    │ (3rd party)     │
    │ LinkedIn Scraper│
    └─────────────────┘
```

### Cloud Function Specifications

| Function | Purpose | Memory | Timeout | Concurrency |
|----------|---------|--------|---------|-------------|
| **scrape-linkedin** | Scrape LinkedIn profiles | 512MB | 540s | Auto-scale |
| **save-embeddings** | Save to Cloud Storage | 512MB | 540s | Auto-scale |
| **retrieve-embeddings** | Retrieve from Cloud Storage | 512MB | 540s | Auto-scale |
| **delete-embeddings** | Delete from Cloud Storage | 256MB | 540s | Auto-scale |

### Cloud Storage Structure

```
gs://myformsnapper-embeddings/
  └── users/
      └── {userId}/                    # UUID per user
          └── documents/
              ├── {documentId}/        # UUID per document
              │   ├── chunks.json      # Embedding vectors (768-dim)
              │   └── metadata.json    # Document metadata
              ├── {documentId}/
              │   ├── chunks.json
              │   └── metadata.json
              └── ...
```

**chunks.json format:**
```json
[
  {
    "fileName": "resume.pdf",
    "chunkIndex": 0,
    "text": "John Doe is a Software Engineer...",
    "embedding": [0.123, -0.456, 0.789, ...],  // 768 dimensions
    "hash": "a1b2c3d4e5f6",
    "timestamp": 1699564800000
  },
  ...
]
```

**metadata.json format:**
```json
{
  "fileName": "resume.pdf",
  "documentId": "doc_abc123",
  "chunksProcessed": 15,
  "uploadedAt": 1699564800000,
  "storage": "cloud"
}
```

---

## Chrome Extension Architecture

### Manifest V3 Structure

```json
{
  "manifest_version": 3,
  "name": "FastRamp",
  "version": "2.0.0",

  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "panel-injector.js",
        "gemini-live-voice-wrapper.js"
      ]
    }
  ],

  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],

  "host_permissions": [
    "https://generativelanguage.googleapis.com/*",
    "https://us-central1-crafty-cairn-469222-a8.cloudfunctions.net/*"
  ]
}
```

### Component Communication

```
┌─────────────────────────────────────────────────────────────┐
│                    Message Flow                             │
└─────────────────────────────────────────────────────────────┘

  Content Script              Service Worker              Cloud
  (panel-injector.js)         (background.js)

       │                            │
       │  1. embedDocument          │
       ├───────────────────────────►│
       │                            │
       │                            │  2. Generate embeddings
       │                            ├────────────────────────►
       │                            │                    Gemini API
       │                            │◄────────────────────────┤
       │                            │     3. Embeddings
       │                            │
       │                            │  4. Save to storage
       │                            ├────────────────────────►
       │                            │                    Cloud Storage
       │                            │◄────────────────────────┤
       │                            │     5. Success
       │  6. Embedding complete     │
       │◄───────────────────────────┤
       │                            │
       │  7. fillForm               │
       ├───────────────────────────►│
       │                            │
       │                            │  8. Analyze form
       │                            ├────────────────────────►
       │                            │                    Gemini API
       │                            │◄────────────────────────┤
       │                            │     9. Field values
       │  10. Fill instructions     │
       │◄───────────────────────────┤
       │                            │
```

---

## Data Flow Diagrams

### 1. Document Upload Flow

```
┌─────────┐
│  User   │
│ Uploads │
│   PDF   │
└────┬────┘
     │
     ▼
┌─────────────────┐
│ panel-injector  │ 1. Read file content
│                 ├──────────┐
│ File.text()     │          │
└────┬────────────┘          │
     │                       │
     │ 2. Chunk text         │
     │ (500 words/chunk,     │
     │  100-word overlap)    │
     │                       │
     ▼                       │
┌─────────────────┐          │
│  background.js  │          │
│  Service Worker │          │
└────┬────────────┘          │
     │                       │
     │ 3. For each chunk     │
     │                       │
     ▼                       │
┌───────────────────────────┐│
│  Gemini Embedding API     ││
│  text-embedding-004       ││
│  768-dimensional vectors  ││
└────┬──────────────────────┘│
     │                       │
     │ 4. Return embeddings  │
     │                       │
     ▼                       │
┌─────────────────┐          │
│ storage-manager │          │
│  .saveEmbeddings│          │
└────┬────────────┘          │
     │                       │
     │ 5. Cloud or Local?    │
     │                       │
     ├──────────┬────────────┘
     │          │
┌────▼─────┐ ┌─▼─────────────┐
│  Cloud   │ │ Local Storage │
│ Storage  │ │ (10MB limit)  │
│(Unlimited)│ │               │
└──────────┘ └───────────────┘
```

### 2. Form Filling Flow

```
┌─────────┐
│  User   │
│ Clicks  │
│"Fill    │
│ Form"   │
└────┬────┘
     │
     ▼
┌─────────────────────────────────┐
│ panel-injector.js               │
│ 1. Extract form HTML            │
│ 2. Estimate token count         │
│    (HTML length / 4)            │
└────┬────────────────────────────┘
     │
     │ 3. Send to Service Worker
     │
     ▼
┌─────────────────────────────────┐
│ background.js                   │
│ 4. Route based on size          │
└────┬────────────────────────────┘
     │
     ├──────────┬────────────────┐
     │          │                │
     │ Small    │ Large          │
     │ (<6K     │ (>6K           │
     │ tokens)  │ tokens)        │
     │          │                │
┌────▼─────┐ ┌─▼──────────┐ ┌───▼──────────┐
│ Gemini   │ │  Gemini    │ │   Gemini     │
│  Nano    │ │  2.5 Flash │ │   2.5 Flash  │
│(On-device)│ │  (Cloud)   │ │   (Cloud)    │
│ Optional │ │  Fallback  │ │   Primary    │
└────┬─────┘ └─┬──────────┘ └───┬──────────┘
     │         │                │
     └─────────┼────────────────┘
               │
               │ 5. Two-stage analysis
               │
     ┌─────────▼──────────┐
     │  Stage 1:          │
     │  Form Structure    │
     │  Detection         │
     │                    │
     │  Extract:          │
     │  - Field labels    │
     │  - Field types     │
     │  - Field IDs       │
     └─────────┬──────────┘
               │
               │ 6. Search KB
               │
     ┌─────────▼──────────┐
     │  Semantic Search   │
     │  with Embeddings   │
     │                    │
     │  Cosine Similarity │
     │  Top 5 chunks      │
     └─────────┬──────────┘
               │
               │ 7. Extract values
               │
     ┌─────────▼──────────┐
     │  Stage 2:          │
     │  Value Extraction  │
     │                    │
     │  Match KB chunks   │
     │  to form fields    │
     └─────────┬──────────┘
               │
               │ 8. Return JSON
               │
     ┌─────────▼──────────┐
     │ {                  │
     │   "Email": "...",  │
     │   "Phone": "...",  │
     │   "Name": "..."    │
     │ }                  │
     └─────────┬──────────┘
               │
               │ 9. Auto-fill
               │
     ┌─────────▼──────────┐
     │ panel-injector.js  │
     │ Fill form fields   │
     │ using DOM          │
     └────────────────────┘
```

### 3. LinkedIn Import Flow

```
┌─────────┐
│  User   │
│ Pastes  │
│LinkedIn │
│   URL   │
└────┬────┘
     │
     ▼
┌──────────────────────────────────┐
│ panel-injector.js                │
│ 1. Validate URL format           │
└────┬─────────────────────────────┘
     │
     │ 2. Call Cloud Function
     │
     ▼
┌──────────────────────────────────────────┐
│ Cloud Function: scrape-linkedin          │
│ https://us-central1-...                  │
│   cloudfunctions.net/scrape-linkedin     │
└────┬─────────────────────────────────────┘
     │
     │ 3. Forward to Toolhouse API
     │
     ▼
┌──────────────────────────────────┐
│ Toolhouse AI Agent               │
│ Scrapes LinkedIn profile         │
│                                  │
│ Returns JSON:                    │
│ {                                │
│   "name": "John Doe",            │
│   "headline": "Engineer...",     │
│   "experience": [...],           │
│   "education": [...],            │
│   "skills": [...]                │
│ }                                │
└────┬─────────────────────────────┘
     │
     │ 4. Convert to text
     │
     ▼
┌──────────────────────────────────┐
│ panel-injector.js                │
│ 5. Format as resume text         │
│                                  │
│ "John Doe                        │
│  Software Engineer at Google     │
│  Experience:                     │
│  - Software Engineer (2020-...)  │
│  Education:                      │
│  - MIT (2016-2020)               │
│  Skills: Python, JS, ..."        │
└────┬─────────────────────────────┘
     │
     │ 6. Create virtual file
     │
     ▼
┌──────────────────────────────────┐
│ new File([text],                 │
│   "LinkedIn_JohnDoe.txt",        │
│   { type: "text/plain" })        │
└────┬─────────────────────────────┘
     │
     │ 7. Process through
     │    embedding pipeline
     │    (same as PDF upload)
     │
     ▼
[See Document Upload Flow above]
```

---

## AI Inference Routing

### Decision Tree

```
                  ┌──────────────┐
                  │ User clicks  │
                  │ "Fill Form"  │
                  └──────┬───────┘
                         │
                         ▼
               ┌─────────────────┐
               │ Extract HTML    │
               │ Estimate tokens │
               └─────────┬───────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ tokens > 6000?       │
              └──┬──────────────┬────┘
                 │NO            │YES
                 │              │
        ┌────────▼──────┐  ┌────▼───────────┐
        │  Small Form   │  │  Large Form    │
        │  (<6K tokens) │  │  (>6K tokens)  │
        └────────┬──────┘  └────┬───────────┘
                 │              │
                 ▼              ▼
       ┌──────────────────┐  ┌────────────────┐
       │ Try Gemini Nano  │  │  Use Gemini    │
       │   (On-device)    │  │  2.5 Flash     │
       │                  │  │  (Cloud)       │
       │ If available:    │  │                │
       │ ✅ Fast (<200ms) │  │ ✅ Accurate    │
       │ ✅ Private       │  │ ✅ Large       │
       │ ✅ Free          │  │    context     │
       └────┬─────────────┘  └────┬───────────┘
            │                     │
            │ If fails or         │
            │ not available       │
            │                     │
            └────────┬────────────┘
                     │
                     ▼
          ┌──────────────────┐
          │ Fallback to      │
          │ Gemini 2.5 Flash │
          │ (Cloud)          │
          └──────┬───────────┘
                 │
                 ▼
       ┌──────────────────┐
       │ Return field     │
       │ values as JSON   │
       └──────────────────┘
```

### Model Selection Matrix

| Form Size | Primary Model | Fallback Model | Execution Time | Privacy |
|-----------|--------------|----------------|----------------|---------|
| **Small** (<6K tokens) | Gemini Nano (on-device) | Gemini 2.5 Flash (cloud) | <200ms | 100% private |
| **Large** (>6K tokens) | Gemini 2.5 Flash (cloud) | N/A | <2 seconds | Data sent to Google |

---

## Storage Management

### Storage Manager Architecture

```
┌──────────────────────────────────────────────────────────┐
│             StorageManager (Abstraction Layer)            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  - mode: 'local' | 'cloud'                               │
│  - userId: UUID                                          │
│                                                          │
│  Methods:                                                │
│  - saveEmbeddings(fileName, chunks, metadata)            │
│  - retrieveEmbeddings(documentId)                        │
│  - deleteEmbeddings(fileName)                            │
│  - setMode(mode)                                         │
│  - getMode()                                             │
└────────────┬────────────────────────┬────────────────────┘
             │                        │
             │ mode='local'           │ mode='cloud'
             │                        │
    ┌────────▼────────┐      ┌────────▼────────────┐
    │  Local Storage  │      │  Cloud Storage      │
    │                 │      │                     │
    │ - Chrome API    │      │ - Cloud Functions   │
    │ - 10MB limit    │      │ - Google Storage    │
    │ - Synchronous   │      │ - Unlimited         │
    │ - Offline OK    │      │ - Async             │
    └─────────────────┘      └─────────────────────┘
```

### Storage Mode Comparison

| Feature | Local Storage | Cloud Storage |
|---------|--------------|---------------|
| **Capacity** | 10MB (~20-30 docs) | Unlimited (petabytes) |
| **Speed** | Instant (<10ms) | Fast (~500ms) |
| **Privacy** | 100% private | Data in cloud |
| **Offline** | ✅ Yes | ❌ No |
| **Multi-device** | ❌ No | ✅ Yes |
| **Cost** | Free | ~$0.02/GB/month |
| **Backup** | Manual | Automatic |

### Migration Between Modes

When user switches storage mode:

```javascript
// User switches from Local → Cloud
async function migrateToCloud() {
  // 1. Retrieve all local embeddings
  const localChunks = await chrome.storage.local.get(['knowledgeBase']);

  // 2. Upload to Cloud Storage
  for (const doc of localChunks.knowledgeBase) {
    await storageManager.saveToCloud(doc.fileName, doc.chunks, doc.metadata);
  }

  // 3. Verify cloud save successful
  // 4. Clear local storage (optional)
  // 5. Update mode to 'cloud'
  await storageManager.setMode('cloud');
}
```

---

## Voice Assistant Architecture

### Gemini Live API Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Voice Assistant Flow                        │
└─────────────────────────────────────────────────────────────┘

  User                Content Script        Service Worker      Gemini Live API

   │                       │                      │                    │
   │ 1. Click voice btn    │                      │                    │
   ├──────────────────────►│                      │                    │
   │                       │                      │                    │
   │                       │ 2. Wake up worker    │                    │
   │                       ├─────────────────────►│                    │
   │                       │                      │                    │
   │                       │ 3. Create port       │                    │
   │                       ├─────────────────────►│                    │
   │                       │                      │                    │
   │                       │                      │ 4. Init session    │
   │                       │                      ├───────────────────►│
   │                       │                      │                    │
   │                       │                      │◄───────────────────┤
   │                       │                      │  5. Session ready  │
   │                       │                      │                    │
   │                       │ 6. Start mic         │                    │
   │◄──────────────────────┤                      │                    │
   │                       │                      │                    │
   │ 7. Speak: "john@..."  │                      │                    │
   ├──────────────────────►│                      │                    │
   │                       │                      │                    │
   │                       │ 8. Stream audio      │                    │
   │                       ├─────────────────────►│                    │
   │                       │                      │                    │
   │                       │                      │ 9. Send audio      │
   │                       │                      ├───────────────────►│
   │                       │                      │                    │
   │                       │                      │◄───────────────────┤
   │                       │                      │ 10. AI response    │
   │                       │                      │  + function call   │
   │                       │                      │                    │
   │                       │ 11. Function call    │                    │
   │                       │◄─────────────────────┤                    │
   │                       │  submitFieldValue(   │                    │
   │                       │    "Email",          │                    │
   │                       │    "john@..."        │                    │
   │                       │  )                   │                    │
   │                       │                      │                    │
   │ 12. Field filled      │                      │                    │
   │◄──────────────────────┤                      │                    │
   │                       │                      │                    │
```

### Audio Processing Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                    Audio Capture                             │
└──────────────────────────────────────────────────────────────┘

  Microphone           AudioContext       Processor        Gemini API
      │                    │                  │                │
      │ Raw Audio          │                  │                │
      ├───────────────────►│                  │                │
      │                    │                  │                │
      │                    │ Float32 PCM      │                │
      │                    ├─────────────────►│                │
      │                    │                  │                │
      │                    │                  │ Convert to     │
      │                    │                  │ Int16 PCM      │
      │                    │                  │                │
      │                    │                  │ Base64 encode  │
      │                    │                  │                │
      │                    │                  │ Stream chunks  │
      │                    │                  ├───────────────►│
      │                    │                  │                │


┌──────────────────────────────────────────────────────────────┐
│                   Audio Playback                             │
└──────────────────────────────────────────────────────────────┘

  Gemini API         Decoder           AudioContext       Speaker
      │                  │                  │                │
      │ Base64 audio     │                  │                │
      ├─────────────────►│                  │                │
      │                  │                  │                │
      │                  │ Decode PCM16     │                │
      │                  │                  │                │
      │                  │ Create buffer    │                │
      │                  ├─────────────────►│                │
      │                  │                  │                │
      │                  │                  │ Play audio     │
      │                  │                  ├───────────────►│
      │                  │                  │                │
```

### Function Calling Schema

```javascript
{
  tools: [{
    functionDeclarations: [{
      name: "submitFieldValue",
      description: "Automatically fill a form field with the user's spoken value",

      parametersJsonSchema: {
        type: "object",
        properties: {
          fieldLabel: {
            type: "string",
            description: "The EXACT label of the form field (e.g., 'Email Address')"
          },
          value: {
            type: "string",
            description: "The value the user provided (e.g., 'john@example.com')"
          }
        },
        required: ["fieldLabel", "value"]
      }
    }]
  }]
}
```

**Example Function Call from AI:**
```json
{
  "toolCall": {
    "functionCalls": [{
      "name": "submitFieldValue",
      "id": "call_abc123",
      "args": {
        "fieldLabel": "Email Address",
        "value": "john.doe@example.com"
      }
    }]
  }
}
```

**Function Response to AI:**
```json
{
  "turns": [{
    "role": "user",
    "parts": [{
      "functionResponse": {
        "name": "submitFieldValue",
        "id": "call_abc123",
        "response": {
          "success": true
        }
      }
    }]
  }]
}
```

---

## Security & Privacy

### Data Encryption

```
┌──────────────────────────────────────────────────────────┐
│                 Data at Rest                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Local Storage (Chrome):                                 │
│  - Encrypted by Chrome automatically                     │
│  - OS-level encryption (FileVault/BitLocker)             │
│  - No network transmission                               │
│                                                          │
│  Cloud Storage (Google):                                 │
│  - AES-256 encryption at rest                            │
│  - Automatic key rotation                                │
│  - Isolated per user (UUID-based paths)                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                 Data in Transit                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Extension ↔ Gemini API:                                 │
│  - TLS 1.3                                               │
│  - HTTPS only                                            │
│  - Certificate pinning                                   │
│                                                          │
│  Extension ↔ Cloud Functions:                            │
│  - TLS 1.3                                               │
│  - CORS-enabled (Chrome extensions only)                 │
│  - API key in headers (encrypted)                        │
└──────────────────────────────────────────────────────────┘
```

### IAM Permissions

```
┌──────────────────────────────────────────────────────────┐
│         Google Cloud IAM Configuration                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Service Account:                                        │
│  - PROJECT_NUMBER-compute@developer.gserviceaccount.com  │
│                                                          │
│  Roles:                                                  │
│  - roles/storage.admin                                   │
│    (Read/write to Cloud Storage)                         │
│                                                          │
│  - roles/cloudfunctions.invoker                          │
│    (Execute Cloud Functions)                             │
│                                                          │
│  - roles/logging.logWriter                               │
│    (Write logs for debugging)                            │
└──────────────────────────────────────────────────────────┘
```

### Privacy Guarantees

| Data Type | Local Mode | Cloud Mode |
|-----------|-----------|------------|
| **Document Content** | ✅ Never leaves device | ⚠️ Sent to Gemini API for embedding |
| **Embeddings** | ✅ Stored locally only | ⚠️ Stored in Cloud Storage |
| **Form Data** | ⚠️ Sent to AI for analysis | ⚠️ Sent to AI for analysis |
| **API Keys** | ✅ Chrome Storage (encrypted) | ✅ Chrome Storage (encrypted) |
| **User ID** | ✅ Generated locally (UUID) | ✅ Generated locally (UUID) |

---

## Performance Optimization

### Caching Strategy

```
┌──────────────────────────────────────────────────────────┐
│                  Cache Layers                             │
└──────────────────────────────────────────────────────────┘

  Layer 1: In-Memory Cache (Service Worker)
  ┌─────────────────────────────────────────┐
  │ - Knowledge base chunks (100MB max)     │
  │ - Recently used embeddings              │
  │ - Form field mappings                   │
  │ - TTL: Until service worker restarts    │
  └─────────────────────────────────────────┘

  Layer 2: Chrome Storage API
  ┌─────────────────────────────────────────┐
  │ - Persistent embeddings (10MB max)      │
  │ - User settings                         │
  │ - Document metadata                     │
  │ - TTL: Infinite (until user clears)     │
  └─────────────────────────────────────────┘

  Layer 3: Cloud Storage
  ┌─────────────────────────────────────────┐
  │ - All embeddings (unlimited)            │
  │ - Multi-device sync                     │
  │ - Automatic backup                      │
  │ - TTL: User-controlled                  │
  └─────────────────────────────────────────┘
```

### Request Batching

```javascript
// Batch multiple embedding requests
const batchEmbeddings = async (chunks) => {
  const batchSize = 10;
  const results = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    // Parallel requests within batch
    const embeddings = await Promise.all(
      batch.map(chunk => generateEmbedding(chunk))
    );

    results.push(...embeddings);
  }

  return results;
};
```

---

## Monitoring & Logging

### Cloud Function Logs

```bash
# View logs for specific function
gcloud functions logs read save-embeddings --region=us-central1 --limit=50

# Stream logs in real-time
gcloud functions logs tail save-embeddings --region=us-central1

# Filter by severity
gcloud functions logs read save-embeddings --filter="severity>=ERROR"
```

### Extension Logs

**Service Worker Console:**
```javascript
// Structured logging
console.log('🎯 Form Analysis:', {
  tokens: estimatedTokens,
  mode: useOnlyCloud ? 'CLOUD' : 'ON_DEVICE',
  fields: fieldCount,
  timestamp: Date.now()
});
```

**Content Script Console:**
```javascript
// Structured logging
console.log('✅ Form Filled:', {
  totalFields: fields.length,
  filledFields: filledCount,
  successRate: (filledCount / fields.length * 100).toFixed(1) + '%',
  timestamp: Date.now()
});
```

---

## Deployment Pipeline

```
┌──────────────────────────────────────────────────────────┐
│                Development Workflow                       │
└──────────────────────────────────────────────────────────┘

  Local Development
       │
       │ npm run build
       │
       ▼
  Webpack Bundling
  (src/ → dist/)
       │
       │
       ▼
  Load Unpacked
  (chrome://extensions/)
       │
       │ Test locally
       │
       ▼
  Cloud Functions
  Deployment
       │
       │ ./deploy-cloud-storage.sh
       │
       ▼
  Google Cloud
  (us-central1)
       │
       │ ./test-cloud-storage.sh
       │
       ▼
  Production Ready
```

---

## Appendix: Technology Versions

| Technology | Version | Purpose |
|-----------|---------|---------|
| Chrome Manifest | V3 | Extension framework |
| Google Cloud Functions | Gen2 | Serverless backend |
| Python Runtime | 3.11 | Cloud Functions |
| Node.js | 18.x | Build tooling |
| Webpack | 5.x | Module bundling |
| Gemini 2.5 Flash | Latest | Form analysis |
| Gemini Live API | 2.5 | Voice assistant |
| Gemini Embedding | text-embedding-004 | Semantic search |
| Chrome Gemini Nano | Latest | On-device AI (optional) |

---

*For implementation details, see source code and inline comments.*
