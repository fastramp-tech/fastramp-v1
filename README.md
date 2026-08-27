# FastRamp - Google Cloud AI DeepMind

## Inspiration

I was frustrated by the repetitive task of filling out countless forms—job applications, conference registrations, hackathon signups—all asking for the same information I've entered hundreds of times before. I realized that with **Chrome's built-in Gemini Nano AI**, **Firebase AI Logic SDK**, and **Google Cloud Functions**, I could eliminate this tedious workflow entirely. The idea was simple: what if my browser could intelligently fill forms by understanding my personal documents, without sending my private data to external servers? Moreover, what if I could import my LinkedIn profile directly instead of manually uploading PDFs?

The breakthrough came from realizing that with **Google Gemini embeddings**, **Google Cloud Functions**, **Firebase AI Logic SDK**, and **Chrome's Gemini Nano**, I could build a truly hybrid AI system that keeps sensitive data on-device when possible while leveraging cloud AI for complex reasoning when needed.

## What it does

FastRamp is an intelligent Chrome extension that automatically fills web forms using your personal knowledge base (resumes, portfolios, LinkedIn profiles). It combines **Google Cloud AI services** with **Chrome's built-in Gemini Nano** to deliver fast, accurate, and private form completion.

**Core Features:**

1. **LinkedIn Import via Google Cloud Functions**
   - One-click import from LinkedIn profile URLs
   - Serverless scraping powered by Google Cloud Functions
   - Automatic conversion to searchable embeddings

2. **Hybrid AI Form Analysis**
   - Small forms: Chrome Gemini Nano (on-device, private, instant)
   - Large forms: Google Gemini 2.5 Flash (cloud, accurate, powerful)
   - Automatic routing based on complexity

3. **Voice Assistant with Gemini Live API**
   - Conversational form filling using **Google Gemini 2.5 Live API**
   - Real-time bidirectional audio streaming
   - Function calling for automatic field population
   - Native audio processing (no text conversion needed)

4. **Knowledge Base with Google Gemini Embeddings**
   - Semantic search powered by **Google Gemini Embedding API**
   - Vector similarity matching for context understanding
   - Smart deduplication using content hashing

5. **Cloud Storage for Unlimited Embeddings**
   - **Google Cloud Storage** for unlimited document storage
   - **Google Cloud Functions** for embedding CRUD operations
   - User choice: Local storage (10MB limit) or Cloud storage (unlimited)


## 🚀 Getting Started

### Prerequisites

Before installing FastRamp, ensure you have:

- **Node.js** 18.x or higher ([Download here](https://nodejs.org/))
- **Chrome Browser** version 120+ with Gemini Nano enabled
- **Google Gemini API Key** ([Get free API key](https://aistudio.google.com/app/apikey))

### Installation

Follow these steps to install and run the extension locally:

**1. Clone the repository**
```bash
git clone https://github.com/fastramp-tech/fastramp-v1.git
cd fastramp-v1
```

**2. Install dependencies**
```bash
npm install
```

This installs the packages declared in `package.json`:
- `webpack` + `webpack-cli` (dev) — bundles the service worker and offscreen document
- `firebase` — Firebase AI Logic SDK
- `@google/genai` — Google Gen AI SDK, used by the Gemini Live voice handler

**3. Build the extension**
```bash
npm run build
```

This creates the `dist/` folder with:
- `background.js` (service worker bundle)
- `offscreen.js` (Gemini Live API handler)

Webpack prints three **asset size limit** warnings (the bundles are ~1 MB and ~650 KB). These are advisory only — bundle size is not a constraint for a locally loaded extension. As long as the output ends with `compiled with 3 warnings` and no `ERROR`, the build succeeded.

**4. Load extension in Chrome**

- Open Chrome and navigate to `chrome://extensions/`
- Enable **"Developer mode"** (toggle in top-right corner)
- Click **"Load unpacked"**
- Select the **project root directory** — the folder containing `manifest.json`, *not* the `dist/` folder
- The extension icon should appear in your Chrome toolbar (open the puzzle-piece **Extensions** menu and pin **FastRamp** if you don't see it)

To confirm it loaded cleanly, check that the extension card shows no red **Errors** button, then click **service worker** on the card. The background console should print:

```
✅ Background worker initialized
📊 Storage: Chrome Local Storage (10MB limit) + Google Cloud Storage
```

**5. Open the panel on a real webpage**

> ⚠️ **Navigate away from `chrome://extensions/` first.** Chrome forbids extensions from injecting scripts into `chrome://`, `chrome-extension://`, `view-source:`, and Chrome Web Store pages. Clicking the icon while still on the extensions page cannot work — see [Troubleshooting](#troubleshooting).

- Open any ordinary `http(s)://` page (e.g. `https://www.wikipedia.org`)
- Click the 🚀 **FastRamp** toolbar icon
- A **450px panel slides in from the right edge of the page**

The UI is injected into the page itself — it is not a popup window. Clicking the icon again toggles the panel closed. Once opened, the panel reopens automatically on subsequent pages until you close it (the open/closed state is persisted in local storage).

**6. Configure your API key**

The API section is collapsed by default:

- Click the **⚙️ gear icon** in the panel header (top-right, next to **✕**)
- The **⚙️ API Configuration** section expands
- Paste your **Gemini API key** into the input field
- Click **"Test Key"** (recommended) — this sends a live embedding request to the Gemini API and saves the key automatically if it succeeds. You'll see `✅ API key is valid and working!`

**"Save API Key" vs "Test Key":** *Save* only checks that the key is non-empty and begins with `AIza`, then stores it — a malformed or revoked key still reports `✅ API key saved to sync storage!`. Only *Test Key* verifies the key actually works. Prefer **Test Key** for first-time setup.

The key is stored in Chrome **sync** storage (syncs across your devices). Document embeddings are stored separately in **local** storage, which has a 10 MB cap.

### Usage

**Upload Documents:**
1. Click the extension icon on any webpage
2. Go to "Knowledge Base" section
3. Either:
   - **Upload PDF/Text files** (resume, portfolio, etc.)
   - **Import from LinkedIn** by pasting your profile URL

**Fill Forms:**
1. Navigate to any web form (job application, registration, etc.)
2. Click the extension icon
3. Click **"Fill Form"** button
4. The extension will analyze the form and auto-fill fields using your knowledge base

**Voice Assistant (Optional):**
1. On any form, click the **microphone icon** in the extension panel
2. Speak your responses naturally
3. The AI will automatically fill fields based on your voice input
4. Currently uses Web Speech API (Gemini Live API implementation is preserved but disabled)

### Troubleshooting

**Extension fails to load:**
- Make sure you ran `npm run build` successfully
- Check that `dist/background.js` and `dist/offscreen.js` exist
- Try reloading the extension from `chrome://extensions/`

**API key errors:**
- Verify your Gemini API key is valid at [Google AI Studio](https://aistudio.google.com/)
- Check that the key starts with "AIza"
- Ensure you have API quota available

**Forms not filling:**
- Upload at least one document to your knowledge base first
- Check browser console (F12) for error messages
- Verify the form has standard HTML input fields

---

