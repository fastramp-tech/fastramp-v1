/**
 * Gemini Live Voice Wrapper for Panel Injector
 *
 * This module provides a browser-compatible wrapper for Gemini Live API
 * that can be used directly in content scripts without webpack bundling.
 *
 * It uses the @google/genai SDK loaded via CDN or bundled module.
 */

class GeminiLiveVoiceAssistant {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.isActive = false;
    this.responseCallback = null;
    this.onStatusChange = null;

    // Conversation history tracking
    this.conversationHistory = [];  // Array of {field, question, answer, timestamp}
    this.currentFieldIndex = 0;      // Which field we're currently asking about
    this.filledFields = new Map();   // Map of field.label -> {field, value, timestamp}

    // Listen for messages from offscreen document (via background relay)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Only handle messages without an action property (offscreen messages)
      if (message.action) {
        return; // Ignore other extension messages
      }

      console.log('📨 Content script received message:', message.type);

      if (message.type === 'session-opened') {
        console.log('✅ Gemini Live session opened');
      } else if (message.type === 'audio-response') {
        console.log('🔊 Audio response received');
      } else if (message.type === 'text-response') {
        console.log('💬 Text response:', message.text);
        this.handleTextResponse(message.text);
      } else if (message.type === 'function-call') {
        console.log('🔧 Function call received:', message.name, message.args);
        this.handleFunctionCall(message.name, message.args);
      } else if (message.type === 'turn-complete') {
        console.log('✅ Aria finished speaking');
      } else if (message.type === 'error') {
        console.error('❌ Error from offscreen:', message.error);
      } else if (message.type === 'session-closed') {
        console.log('🔌 Session closed:', message.reason);
        this.isActive = false;
        this.cleanup();
      }

      // Return false to indicate we don't need to send a response
      return false;
    });
  }

  /**
   * Check if Gemini Live API is supported (now via offscreen document)
   * TEMPORARILY DISABLED - Offscreen implementation has message delivery issues
   * Falling back to Web Speech API until fixed
   */
  static async checkSupport() {
    try {
      // DISABLED: Return false to force Web Speech API fallback
      console.log('⚠️ Gemini Live DISABLED - using Web Speech API fallback');
      return {
        supported: false,
        reason: 'Gemini Live temporarily disabled - using Web Speech API'
      };

      /* Original offscreen check (commented out for now):
      const pingResponse = await chrome.runtime.sendMessage({ action: 'ping' });
      return {
        supported: pingResponse && pingResponse.status === 'awake',
        reason: pingResponse ? 'Supported' : 'Background script not responding'
      };
      */
    } catch (error) {
      return {
        supported: false,
        reason: error.message
      };
    }
  }

  /**
   * Start voice conversation with context
   * @param {Array} missingFields - Array of form fields that need to be filled
   * @param {Object} formContext - Additional context about the form
   */
  async startConversation(missingFields, formContext = {}) {
    try {
      console.log('🎤 Starting Gemini Live voice conversation...');
      console.log('Missing fields:', missingFields);
      console.log('Form context:', formContext);

      // Store missing fields for extraction later
      this.missingFields = missingFields;

      // Build intelligent system instruction with form context
      const systemInstruction = this.buildSystemInstruction(missingFields, formContext);

      // Check if we can use Gemini Live
      const support = await GeminiLiveVoiceAssistant.checkSupport();

      if (!support.supported) {
        console.log('⚠️ Gemini Live not supported:', support.reason);
        return false;
      }

      console.log('✅ Gemini Live is supported - starting session...');

      // Step 1: Setup offscreen document with API key
      console.log('🔧 Step 1: Setting up offscreen document...');
      const setupResponse = await chrome.runtime.sendMessage({
        type: 'gemini-live/setup',
        payload: {
          apiKey: this.apiKey
        }
      });

      if (!setupResponse.success) {
        throw new Error(`Setup failed: ${setupResponse.error}`);
      }
      console.log('✅ Offscreen document setup complete');

      // Step 2: Start Live API session
      console.log('🔧 Step 2: Starting Gemini Live session...');
      const sessionResponse = await chrome.runtime.sendMessage({
        type: 'gemini-live/start-session',
        payload: {
          systemInstruction: systemInstruction,
          tools: [{
            functionDeclarations: [{
              name: "submitFieldValue",
              description: "Call this function when the user provides a value for a form field.",
              parameters: {
                type: "object",
                properties: {
                  fieldLabel: {
                    type: "string",
                    description: "The EXACT label of the form field"
                  },
                  value: {
                    type: "string",
                    description: "The value the user provided"
                  }
                },
                required: ["fieldLabel", "value"]
              }
            }]
          }]
        }
      });

      if (!sessionResponse.success) {
        throw new Error(`Session start failed: ${sessionResponse.error}`);
      }
      console.log('✅ Gemini Live session started');

      // Step 3: Send initial message to trigger Aria
      console.log('🔧 Step 3: Sending initial trigger message...');
      await chrome.runtime.sendMessage({
        type: 'gemini-live/send-text',
        payload: {
          text: "Hi Aria! The user just opened the form. Please introduce yourself and start helping them."
        }
      });

      // Step 4: Start microphone recording in offscreen
      console.log('🔧 Step 4: Starting microphone recording...');
      const recordResponse = await chrome.runtime.sendMessage({
        type: 'gemini-live/start-recording'
      });

      if (!recordResponse.success) {
        // Cleanup the session we just created
        console.log('🧹 Cleaning up due to microphone failure...');
        await this.cleanup();
        throw new Error(`Recording failed: ${recordResponse.error}`);
      }

      this.isActive = true;

      return true;

    } catch (error) {
      console.error('❌ Error starting Gemini Live conversation:', error);
      // Ensure cleanup on any error
      await this.cleanup().catch(() => {});
      return false;
    }
  }

  /**
   * Build intelligent system instruction with form context
   */
  buildSystemInstruction(missingFields, formContext) {
    const fieldList = missingFields.map((f, i) =>
      `${i + 1}. ${f.label} (${f.type}${f.required ? ', required' : ''})`
    ).join('\n');

    const instruction = `You are Aria, a professional and friendly voice assistant specializing in helping users complete forms efficiently.

**Your Personality:**
- Name: Aria (you can introduce yourself naturally)
- Tone: Warm, professional, efficient, and encouraging
- Style: Clear and concise but personable - you make tedious form-filling feel easy and pleasant
- Approach: You're like a helpful colleague who's great at organizing details
- You occasionally use light encouragement ("Great!", "Perfect!", "Almost done!")
- You're patient and understanding when users need to correct information
- You maintain professionalism while being conversational

**Form Context:**
- Form Type: ${formContext.formType || 'Generic form'}
- Page URL: ${formContext.pageUrl || window.location.href}
- Total Fields: ${formContext.totalFields || missingFields.length}
- Fields to Fill: ${missingFields.length}

**Fields that need to be filled:**
${fieldList}

**Your Task:**
1. Start with a brief, friendly introduction mentioning you noticed ${missingFields.length} missing field${missingFields.length !== 1 ? 's' : ''} and you're here to help complete ${missingFields.length !== 1 ? 'them' : 'it'}
2. Ask for each field value one at a time using the EXACT field label
3. Be conversational and natural - adapt to the user's communication style
4. Understand context (e.g., if they say "same as billing" for shipping address)
5. Confirm values that sound unusual with gentle verification
6. Help correct mistakes gracefully if user says "no wait" or "I meant"
7. Provide subtle progress updates ("Just ${missingFields.length - 2} more to go!")
8. Celebrate completion warmly when all fields are filled

**Navigation Commands (IMPORTANT):**
The user can navigate through fields using these commands:
- "go back" or "previous" or "back" → Go to the previous field
- "skip" or "next" or "skip this" → Skip current field and move to next
- "change [field name]" → Go to a specific field to change its value (e.g., "change email")
- "what did I say for [field name]?" → Repeat what they entered for a specific field
- "show history" or "what have I filled?" → List all fields they've filled so far

When the user uses a navigation command:
1. Acknowledge warmly (e.g., "Sure, let's go back to your email address")
2. For "go back": Ask about the previous field again
3. For "skip": Move to the next field smoothly
4. For "change [field]": Find that field and ask for the new value
5. For history requests: Summarize what they've filled so far in a clear, organized way

**Critical Rules:**
- ALWAYS use the EXACT field labels as shown above - never paraphrase them
- Only ask for the fields listed above in order
- Listen actively and extract the actual value from natural responses
- **IMPORTANT: When user provides a value, IMMEDIATELY call the submitFieldValue() function**
  - Call submitFieldValue(fieldLabel, value) where:
    - fieldLabel = EXACT field label from the list above (e.g., "Email Address")
    - value = what the user said (e.g., "john@example.com")
  - Example: User says "my email is john@example.com"
    → You say "Perfect!" (audio response)
    → You call submitFieldValue("Email Address", "john@example.com") (function call)
- The function call will automatically fill the form field
- After the function call succeeds, move to the next field
- Keep responses concise - aim for 1-2 sentences per turn unless clarification is needed
- Maintain your warm, professional personality throughout

**FIRST MESSAGE:** Introduce yourself briefly as Aria, mention you noticed ${missingFields.length} missing field${missingFields.length !== 1 ? 's' : ''}, say you'll help complete ${missingFields.length !== 1 ? 'them' : 'it'}, then immediately ask: "What should I put for ${missingFields[0]?.label}?" (use the EXACT label from the list above)`;

    return instruction;
  }

  // NOTE: setupMessageListener() removed - we use port.onMessage instead

  /**
   * Start capturing microphone and streaming to background script
   */
  async startMicrophoneStreaming() {
    try {
      console.log('🎙️ Starting microphone streaming...');

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Initialize audio context for INPUT (16kHz for microphone)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      // Initialize SEPARATE audio context for OUTPUT (24kHz for Gemini voice)
      // This prevents sample rate conflicts between input and output
      if (!this.audioPlaybackContext) {
        this.audioPlaybackContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000 // Gemini outputs at 24kHz
        });
        this.nextStartTime = this.audioPlaybackContext.currentTime;
        console.log('🔊 Created separate 24kHz AudioContext for playback');
      }

      // Create audio source from microphone
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create processor for audio chunks
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      // Flag to control when to send audio (turn-based)
      this.isMicrophoneActive = false; // Start paused - Aria will speak first

      this.processor.onaudioprocess = async (event) => {
        if (!this.isActive) return;

        // IMPORTANT: Only send audio when microphone is actively listening
        // This prevents feedback loop when Aria is speaking
        if (!this.isMicrophoneActive) return;

        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          console.warn('🔄 Extension context lost. Stopping audio capture.');
          this.isActive = false;
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32Array to Int16Array (PCM 16-bit)
        const pcm16 = this.convertToPCM16(inputData);

        // Convert to base64
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

        // Send audio chunk via persistent port (no message channel issues!)
        if (this.port) {
          this.port.postMessage({
            action: 'audioChunk',
            data: base64Audio
          });
        } else {
          console.warn('⚠️ Port not connected');
          this.isActive = false;
        }
      };

      // Connect audio nodes
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('✅ Microphone streaming initialized (paused - waiting for Aria to finish)');
    } catch (error) {
      console.error('❌ Failed to start microphone streaming:', error);
      throw error;
    }
  }

  /**
   * Pause microphone streaming (when AI is speaking)
   */
  pauseMicrophone() {
    this.isMicrophoneActive = false;
    console.log('🎤 Microphone paused (Aria is speaking)');
  }

  /**
   * Resume microphone streaming (when waiting for user response)
   */
  resumeMicrophone() {
    this.isMicrophoneActive = true;
    console.log('🎤 Microphone active (listening for user)');
  }

  /**
   * Play audio response from Gemini
   */
  async playAudioResponse(base64Audio, mimeType) {
    try {
      console.log('🔊 Received audio chunk from Gemini:', base64Audio.substring(0, 50) + '...');

      // Decode base64 audio
      const audioBuffer = this.base64ToArrayBuffer(base64Audio);

      // Parse sample rate from mime type
      const sampleRate = this.parseSampleRate(mimeType) || 24000;

      console.log(`📊 Audio chunk: ${audioBuffer.byteLength} bytes, ${sampleRate}Hz`);

      // Pause microphone while Aria is speaking (prevent feedback)
      this.pauseMicrophone();

      // Add to queue
      this.audioQueue.push({ audioBuffer, sampleRate, mimeType });

      // Start playing if not already playing
      if (!this.isPlayingAudio) {
        this.playNextAudioChunk();
      }

    } catch (error) {
      console.error('❌ Error queuing audio:', error);
    }
  }

  /**
   * Play next audio chunk in queue
   */
  async playNextAudioChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      console.log('✅ Audio playback complete');

      // Resume microphone - now it's the user's turn to speak
      this.resumeMicrophone();
      return;
    }

    this.isPlayingAudio = true;
    const { audioBuffer, sampleRate } = this.audioQueue.shift();

    try {
      // Audio playback context should already be created during initialization
      // If not, something went wrong - create it now as fallback
      if (!this.audioPlaybackContext) {
        console.warn('⚠️ Playback context missing - creating now (should have been created during init)');
        this.audioPlaybackContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000 // Always use 24kHz for Gemini output
        });
        this.nextStartTime = this.audioPlaybackContext.currentTime;
      }

      // Resume audio context if suspended (browser autoplay policy)
      if (this.audioPlaybackContext.state === 'suspended') {
        console.log('▶️ Resuming audio context...');
        await this.audioPlaybackContext.resume();
      }

      // Convert PCM16 to AudioBuffer
      const pcm16Array = new Int16Array(audioBuffer);
      const float32Array = new Float32Array(pcm16Array.length);

      // Convert Int16 to Float32 (-1.0 to 1.0)
      for (let i = 0; i < pcm16Array.length; i++) {
        float32Array[i] = pcm16Array[i] / 32768.0;
      }

      // Use the output context's sample rate (24kHz), NOT the input rate
      const playbackBuffer = this.audioPlaybackContext.createBuffer(
        1, // mono
        float32Array.length,
        this.audioPlaybackContext.sampleRate // Always use 24kHz for output
      );

      playbackBuffer.getChannelData(0).set(float32Array);

      // Create source and play
      const source = this.audioPlaybackContext.createBufferSource();
      source.buffer = playbackBuffer;
      source.connect(this.audioPlaybackContext.destination);

      // Schedule playback for gapless audio
      const now = this.audioPlaybackContext.currentTime;
      this.nextStartTime = Math.max(this.nextStartTime, now);

      source.start(this.nextStartTime);
      this.nextStartTime += playbackBuffer.duration;

      console.log(`🔊 Playing audio chunk (${float32Array.length} samples, ${playbackBuffer.duration.toFixed(2)}s)`);

      // When this chunk finishes, play the next one
      source.onended = () => {
        console.log('🔊 Chunk finished, playing next...');
        this.playNextAudioChunk();
      };

    } catch (error) {
      console.error('❌ Error playing audio chunk:', error);
      // Try next chunk anyway
      this.playNextAudioChunk();
    }
  }

  /**
   * Handle text response from Gemini (for field extraction)
   */
  handleTextResponse(text) {
    console.log('📝 Gemini text response:', text);

    try {
      // First, check if this is a navigation command response from the AI
      const navigationDetected = this.detectNavigationCommand(text);

      if (navigationDetected) {
        console.log('🧭 Navigation command detected:', navigationDetected.command);
        // Navigation is handled by the AI's response
        // Just update the UI if needed
        this.updateConversationUI();
        return;
      }

      // Check if AI is providing a value (prefixed with "VALUE:")
      const valueMatch = text.match(/VALUE:\s*(.+?)(?:\.|$)/i);
      if (valueMatch) {
        const extractedValue = valueMatch[1].trim();
        console.log('✅ Value extracted:', extractedValue);

        const currentField = this.getCurrentField();
        if (currentField) {
          this.recordAnswer(currentField, extractedValue);
          this.autoFillField(currentField, extractedValue);
          this.currentFieldIndex++;
        }
        return;
      }

      // Otherwise, try to extract field values from conversation
      const extractionPatterns = [
        // Pattern 1: "The email is john@example.com"
        /(?:email|e-mail)\s+is\s+([^\s,\.]+@[^\s,\.]+)/i,
        // Pattern 2: "Your name is John Smith"
        /(?:name)\s+is\s+([^,\.]+?)(?:\.|,|$)/i,
        // Pattern 3: "phone number: 123-456-7890"
        /(?:phone|tel|telephone)\s*(?:number)?\s*:?\s*([\d\-\(\)\s]+)/i,
        // Pattern 4: "I need [value] for [field]"
        /I need (.+?) for (.+?)(?:\.|$)/i
      ];

      let extracted = null;

      // Try each pattern
      for (const pattern of extractionPatterns) {
        const match = text.match(pattern);
        if (match) {
          extracted = { value: match[1].trim() };
          break;
        }
      }

      // If we extracted a value, try to match it to a field
      if (extracted && this.missingFields && this.missingFields.length > 0) {
        // Try to find which field this value belongs to
        const currentField = this.findMatchingField(text, extracted.value);

        if (currentField) {
          console.log(`✅ Extracted value "${extracted.value}" for field "${currentField.label}"`);

          // Auto-fill the field
          this.autoFillField(currentField, extracted.value);
        }
      }

      // Call response callback
      if (this.responseCallback) {
        this.responseCallback({ type: 'text', data: text, extracted });
      }

    } catch (error) {
      console.error('❌ Error extracting field values:', error);
    }
  }

  /**
   * Detect navigation commands in AI's response
   */
  detectNavigationCommand(text) {
    const textLower = text.toLowerCase();

    // Check for navigation keywords
    if (textLower.includes('going back') || textLower.includes('previous field')) {
      return { command: 'back', detected: true };
    }
    if (textLower.includes('skipping') || textLower.includes('moving to next')) {
      return { command: 'skip', detected: true };
    }
    if (textLower.includes('changing') || textLower.includes('let\'s update')) {
      return { command: 'change', detected: true };
    }
    if (textLower.includes('you entered') || textLower.includes('you said')) {
      return { command: 'history', detected: true };
    }

    return null;
  }

  /**
   * Get the current field being asked about
   */
  getCurrentField() {
    if (!this.missingFields || this.currentFieldIndex >= this.missingFields.length) {
      return null;
    }
    return this.missingFields[this.currentFieldIndex];
  }

  /**
   * Record an answer in conversation history
   */
  recordAnswer(field, value) {
    const entry = {
      field: field,
      question: `What is your ${field.label}?`,
      answer: value,
      timestamp: new Date().toISOString()
    };

    // Add to conversation history
    this.conversationHistory.push(entry);

    // Add to filled fields map
    this.filledFields.set(field.label, {
      field: field,
      value: value,
      timestamp: entry.timestamp
    });

    console.log('📝 Recorded answer:', entry);
  }

  /**
   * Navigate to a specific field by name
   */
  navigateToField(fieldName) {
    const fieldIndex = this.missingFields.findIndex(f =>
      f.label.toLowerCase().includes(fieldName.toLowerCase())
    );

    if (fieldIndex !== -1) {
      this.currentFieldIndex = fieldIndex;
      console.log(`🧭 Navigated to field: ${this.missingFields[fieldIndex].label}`);
      return this.missingFields[fieldIndex];
    }

    return null;
  }

  /**
   * Go back to previous field
   */
  goToPreviousField() {
    if (this.currentFieldIndex > 0) {
      this.currentFieldIndex--;
      const field = this.getCurrentField();
      console.log(`⬅️ Going back to field: ${field?.label}`);
      return field;
    }
    return null;
  }

  /**
   * Skip to next field
   */
  goToNextField() {
    if (this.currentFieldIndex < this.missingFields.length - 1) {
      this.currentFieldIndex++;
      const field = this.getCurrentField();
      console.log(`➡️ Skipping to field: ${field?.label}`);
      return field;
    }
    return null;
  }

  /**
   * Get conversation history summary
   */
  getHistorySummary() {
    if (this.conversationHistory.length === 0) {
      return "No fields have been filled yet.";
    }

    const summary = this.conversationHistory.map((entry, i) =>
      `${i + 1}. ${entry.field.label}: ${entry.answer}`
    ).join('\n');

    return `Fields filled so far:\n${summary}`;
  }

  /**
   * Update conversation UI (can be extended)
   */
  updateConversationUI() {
    // Send message to update UI panel
    const currentField = this.getCurrentField();
    const historyCount = this.conversationHistory.length;

    console.log(`📊 Conversation Status: ${historyCount}/${this.missingFields.length} fields filled`);
    if (currentField) {
      console.log(`📍 Current field: ${currentField.label}`);
    }

    // Could send message to panel-injector.js to update visual UI
    // For now, just log to console
  }

  /**
   * Find which field matches the extracted value
   */
  findMatchingField(text, value) {
    if (!this.missingFields || this.missingFields.length === 0) return null;

    // Try to match based on field labels mentioned in the text
    for (const field of this.missingFields) {
      const labelLower = field.label.toLowerCase();
      const textLower = text.toLowerCase();

      // Check if field label is mentioned in the text
      if (textLower.includes(labelLower)) {
        return field;
      }

      // Check for common field type keywords
      if (field.type === 'email' && (textLower.includes('email') || textLower.includes('e-mail'))) {
        return field;
      }
      if (field.type === 'tel' && (textLower.includes('phone') || textLower.includes('telephone'))) {
        return field;
      }
      if ((field.type === 'text' || field.type === 'name') && textLower.includes('name')) {
        return field;
      }
    }

    // If no match found, return the first unfilled field
    return this.missingFields[0];
  }

  /**
   * Handle function call from Gemini (via function calling)
   */
  handleFunctionCall(functionName, args) {
    console.log(`🔧 Handling function call: ${functionName}`, args);

    if (functionName === 'submitFieldValue') {
      const { fieldLabel, value } = args;
      console.log(`✅ Submitting field value: ${fieldLabel} = ${value}`);

      // Find the field by exact label match
      const field = this.missingFields.find(f =>
        f.label.toLowerCase() === fieldLabel.toLowerCase() ||
        f.label.toLowerCase().includes(fieldLabel.toLowerCase())
      );

      if (field) {
        console.log(`✅ Found field:`, field);

        // Record the answer in conversation history
        this.recordAnswer(field, value);

        // Auto-fill the field
        this.autoFillField(field, value);

        // Move to next field
        this.currentFieldIndex++;

        console.log(`✅ Field filled successfully! Moving to field ${this.currentFieldIndex + 1}/${this.missingFields.length}`);
      } else {
        console.error(`❌ Could not find field with label: ${fieldLabel}`);
        console.log('Available fields:', this.missingFields.map(f => f.label));
      }
    }
  }

  /**
   * Auto-fill a field with extracted value
   */
  autoFillField(field, value) {
    try {
      // Try to find the field element by label
      const fieldElements = document.querySelectorAll('input, select, textarea');

      for (const element of fieldElements) {
        // Check if this element matches the field
        const elementLabel = this.getFieldLabel(element);

        if (elementLabel && elementLabel.toLowerCase().includes(field.label.toLowerCase())) {
          // Fill the field
          if (element.tagName === 'SELECT') {
            // For select elements, try to find matching option
            const options = Array.from(element.options);
            const matchingOption = options.find(opt =>
              opt.text.toLowerCase().includes(value.toLowerCase()) ||
              opt.value.toLowerCase().includes(value.toLowerCase())
            );
            if (matchingOption) {
              element.value = matchingOption.value;
              element.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } else {
            // For input/textarea
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }

          console.log(`✅ Auto-filled field "${field.label}" with value "${value}"`);

          // Record the answer in conversation history
          this.recordAnswer(field, value);

          // Remove from missing fields (only if it's a new fill, not a change)
          if (!this.filledFields.has(field.label)) {
            this.missingFields = this.missingFields.filter(f => f !== field);
          }

          // Visual feedback
          element.style.backgroundColor = '#d4edda'; // Light green
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 2000);

          // Update UI
          this.updateConversationUI();

          return true;
        }
      }

      console.warn(`⚠️ Could not find field element for "${field.label}"`);
      return false;

    } catch (error) {
      console.error('❌ Error auto-filling field:', error);
      return false;
    }
  }

  /**
   * Get label for a field element
   */
  getFieldLabel(element) {
    // Try different methods to get the label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Check for placeholder
    if (element.placeholder) return element.placeholder;

    // Check for name attribute
    if (element.name) return element.name;

    // Check for aria-label
    if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');

    return null;
  }

  /**
   * Utility: Convert Float32Array to PCM16 (Int16Array)
   */
  convertToPCM16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  /**
   * Utility: Convert ArrayBuffer to base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert base64 to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Utility: Parse sample rate from MIME type
   */
  parseSampleRate(mimeType) {
    const match = mimeType.match(/rate=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Cleanup resources (called on disconnect or errors)
   */
  async cleanup() {
    console.log('🧹 Cleaning up Gemini Live resources...');

    // Tell offscreen document to cleanup (stops mic, closes session, etc.)
    try {
      await chrome.runtime.sendMessage({
        type: 'gemini-live/cleanup'
      });
      console.log('✅ Offscreen cleanup complete');
    } catch (error) {
      console.warn('⚠️ Offscreen cleanup failed (might already be closed):', error.message);
    }

    console.log('✅ Resources cleaned up');
  }

  /**
   * Stop the conversation
   */
  async stop() {
    console.log('🛑 Stopping Gemini Live voice conversation...');
    this.isActive = false;

    // Cleanup offscreen resources
    await this.cleanup();

    console.log('✅ Gemini Live session stopped');
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.GeminiLiveVoiceAssistant = GeminiLiveVoiceAssistant;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiLiveVoiceAssistant;
}
