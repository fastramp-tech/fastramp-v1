// Gemini Live Offscreen Handler
// Runs in offscreen.html to handle WebSocket connections and audio processing
// Service workers cannot access AudioContext, MediaStream, or maintain persistent WebSockets

import { GoogleGenAI } from '@google/genai';

console.log('🎭 Offscreen document loaded for Gemini Live API');

let geminiClient = null;
let liveSession = null;
let audioContext = null;
let audioPlaybackContext = null;
let mediaStream = null;
let processor = null;
let isRecording = false;
let nextStartTime = 0;

// Audio queue for gapless playback
const audioQueue = [];
let isPlayingAudio = false;

// Initialize when receiving setup message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Offscreen received message:', message.type || message.action);

  // Handle different message types
  if (message.type === 'gemini-live/setup') {
    handleSetup(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  if (message.type === 'gemini-live/start-session') {
    handleStartSession(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'gemini-live/send-text') {
    handleSendText(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'gemini-live/start-recording') {
    handleStartRecording()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'gemini-live/stop-recording') {
    handleStopRecording()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'gemini-live/cleanup') {
    handleCleanup()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Setup Gemini client
async function handleSetup(payload) {
  try {
    console.log('🔧 Setting up Gemini Live client...');
    const { apiKey } = payload;

    // GoogleGenAI is imported at top of file, no need to wait
    geminiClient = new GoogleGenAI({ apiKey });

    // Initialize audio contexts
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000 // Input: 16kHz for microphone
    });

    audioPlaybackContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 24000 // Output: 24kHz for Gemini voice
    });

    nextStartTime = audioPlaybackContext.currentTime;

    console.log('✅ Gemini client and audio contexts initialized');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

// Start Live API session
async function handleStartSession(payload) {
  try {
    console.log('🎤 Starting Gemini Live session...');
    const { systemInstruction, tools } = payload;

    if (!geminiClient) {
      throw new Error('Gemini client not initialized. Call setup first.');
    }

    // Prepare configuration
    const config = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
      }
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      config.tools = tools;
    }

    // Add system instruction if provided
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    // Connect to Live API
    liveSession = await geminiClient.live.connect({
      model: 'models/gemini-2.0-flash-exp',
      config: config,
      callbacks: {
        onopen: () => {
          console.log('✅ Gemini Live WebSocket opened');
          notifyContentScript({ type: 'session-opened' });
        },
        onmessage: (message) => {
          console.log('📨 Received from Gemini:', message);
          handleServerMessage(message);
        },
        onerror: (error) => {
          console.error('❌ Gemini Live error:', error);
          notifyContentScript({ type: 'error', error: error.message });
        },
        onclose: (event) => {
          console.log('🔌 Gemini Live WebSocket closed:', event.reason);
          notifyContentScript({ type: 'session-closed', reason: event.reason });
        }
      }
    });

    console.log('✅ Gemini Live session started');
  } catch (error) {
    console.error('❌ Failed to start session:', error);
    throw error;
  }
}

// Handle messages from Gemini server
function handleServerMessage(message) {
  // Handle audio response
  if (message.serverContent?.modelTurn?.parts) {
    for (const part of message.serverContent.modelTurn.parts) {
      if (part.inlineData?.data) {
        // Audio data received
        const audioData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'audio/pcm';
        console.log('🔊 Received audio chunk:', audioData.length, 'bytes');

        // Add to playback queue
        queueAudioForPlayback(audioData, mimeType);

        // Notify content script
        notifyContentScript({
          type: 'audio-response',
          audio: audioData,
          mimeType: mimeType
        });
      }

      if (part.text) {
        console.log('💬 Gemini text:', part.text);
        notifyContentScript({ type: 'text-response', text: part.text });
      }
    }
  }

  // Handle function calls
  if (message.toolCall?.functionCalls) {
    for (const functionCall of message.toolCall.functionCalls) {
      console.log('🔧 Function call:', functionCall.name, functionCall.args);

      // Forward to content script for execution
      notifyContentScript({
        type: 'function-call',
        name: functionCall.name,
        args: functionCall.args,
        id: functionCall.id
      });

      // CRITICAL: Send function response back to Gemini immediately
      // This tells Gemini the function was executed and it can continue
      if (liveSession) {
        liveSession.sendClientContent({
          turns: [{
            role: 'user',
            parts: [{
              functionResponse: {
                name: functionCall.name,
                id: functionCall.id,
                response: { success: true }
              }
            }]
          }]
        });
        console.log('✅ Sent function response back to Gemini');
      }
    }
  }

  // Handle turn complete
  if (message.serverContent?.turnComplete !== undefined) {
    console.log('✅ Turn complete');
    notifyContentScript({ type: 'turn-complete' });
  }
}

// Queue audio for gapless playback
function queueAudioForPlayback(base64Data, mimeType) {
  audioQueue.push({ base64Data, mimeType });

  if (!isPlayingAudio) {
    playNextAudioChunk();
  }
}

// Play next audio chunk with gapless scheduling
async function playNextAudioChunk() {
  if (audioQueue.length === 0) {
    isPlayingAudio = false;
    return;
  }

  isPlayingAudio = true;
  const { base64Data, mimeType } = audioQueue.shift();

  try {
    // Resume audio context if suspended
    if (audioPlaybackContext.state === 'suspended') {
      console.log('▶️ Resuming audio context...');
      await audioPlaybackContext.resume();
    }

    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert to Float32Array (PCM16)
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Create audio buffer (always use 24kHz for output)
    const playbackBuffer = audioPlaybackContext.createBuffer(
      1, // mono
      float32Array.length,
      audioPlaybackContext.sampleRate // 24kHz
    );
    playbackBuffer.getChannelData(0).set(float32Array);

    // Create source and schedule playback
    const source = audioPlaybackContext.createBufferSource();
    source.buffer = playbackBuffer;
    source.connect(audioPlaybackContext.destination);

    // Schedule for gapless playback
    const now = audioPlaybackContext.currentTime;
    nextStartTime = Math.max(nextStartTime, now);
    source.start(nextStartTime);
    nextStartTime += playbackBuffer.duration;

    console.log(`🔊 Playing audio chunk (${float32Array.length} samples, ${playbackBuffer.duration.toFixed(2)}s)`);

    // When done, play next chunk
    source.onended = () => {
      console.log('🔊 Chunk finished, playing next...');
      playNextAudioChunk();
    };
  } catch (error) {
    console.error('❌ Error playing audio:', error);
    // Continue to next chunk even if this one failed
    playNextAudioChunk();
  }
}

// Send text to Gemini
async function handleSendText(payload) {
  try {
    const { text } = payload;
    console.log('📤 Sending text to Gemini:', text);

    if (!liveSession) {
      throw new Error('Session not started');
    }

    await liveSession.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text }]
      }]
    });

    console.log('✅ Text sent');
  } catch (error) {
    console.error('❌ Failed to send text:', error);
    throw error;
  }
}

// Start recording microphone
async function handleStartRecording() {
  try {
    console.log('🎙️ Starting microphone recording...');

    // Request microphone access
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // Create audio source
    const source = audioContext.createMediaStreamSource(mediaStream);

    // Create processor for audio chunks
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    let audioChunksSent = 0;
    processor.onaudioprocess = async (e) => {
      if (!isRecording) {
        console.log('⏸️ Audio captured but isRecording=false, skipping');
        return;
      }

      const inputData = e.inputBuffer.getChannelData(0);

      // Calculate audio level to detect silence
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += Math.abs(inputData[i]);
      }
      const avgLevel = sum / inputData.length;

      // Convert Float32 to Int16 PCM
      const int16Array = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Convert to base64
      const bytes = new Uint8Array(int16Array.buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binary);

      // Send to Gemini
      if (liveSession) {
        try {
          await liveSession.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{
                inlineData: {
                  mimeType: 'audio/pcm',
                  data: base64Audio
                }
              }]
            }],
            turnComplete: false
          });

          audioChunksSent++;
          if (audioChunksSent % 10 === 0) {
            console.log(`🎤 Sent ${audioChunksSent} audio chunks (level: ${avgLevel.toFixed(4)})`);
          }
        } catch (error) {
          console.error('❌ Failed to send audio chunk:', error);
        }
      } else {
        console.error('❌ liveSession is null, cannot send audio');
      }
    };

    // Connect nodes
    source.connect(processor);
    processor.connect(audioContext.destination);

    isRecording = true;
    console.log('✅ Recording started');
  } catch (error) {
    console.error('❌ Failed to start recording:', error);

    // Provide user-friendly error message
    let errorMessage = error.message;
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Permission dismissed';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No microphone found';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Microphone already in use';
    }

    throw new Error(errorMessage);
  }
}

// Stop recording
async function handleStopRecording() {
  try {
    console.log('🛑 Stopping recording...');
    isRecording = false;

    if (processor) {
      processor.disconnect();
      processor = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    // Send turn complete
    if (liveSession) {
      await liveSession.sendClientContent({
        turns: [],
        turnComplete: true
      });
    }

    console.log('✅ Recording stopped');
  } catch (error) {
    console.error('❌ Failed to stop recording:', error);
    throw error;
  }
}

// Cleanup
async function handleCleanup() {
  try {
    console.log('🧹 Cleaning up offscreen resources...');

    isRecording = false;

    if (processor) {
      processor.disconnect();
      processor = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    if (liveSession) {
      // Close session gracefully
      try {
        await liveSession.close();
      } catch (e) {
        console.warn('Error closing session:', e);
      }
      liveSession = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
      audioContext = null;
    }

    if (audioPlaybackContext && audioPlaybackContext.state !== 'closed') {
      await audioPlaybackContext.close();
      audioPlaybackContext = null;
    }

    audioQueue.length = 0;
    isPlayingAudio = false;

    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    throw error;
  }
}

// Notify content script via background
function notifyContentScript(message) {
  chrome.runtime.sendMessage({
    type: 'gemini-live/to-content',
    payload: message
  }).catch(error => {
    console.error('❌ Failed to notify content script:', error);
  });
}

console.log('✅ Offscreen handler ready');
