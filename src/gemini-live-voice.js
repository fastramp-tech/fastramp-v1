/**
 * Gemini Live API Voice Handler
 *
 * This module provides advanced voice interaction using Gemini 2.5 Live API
 * with real-time bidirectional audio streaming.
 *
 * Features:
 * - Native audio processing (no intermediate text conversion)
 * - Low-latency streaming
 * - Natural conversation with context
 * - High-quality voice output
 * - Support for interruptions
 */

import { GoogleGenAI, Modality, MediaResolution } from '@google/genai';

class GeminiLiveVoiceHandler {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ai = null;
    this.session = null;
    this.isConnected = false;
    this.audioContext = null;
    this.mediaStream = null;
    this.audioWorkletNode = null;
    this.audioQueue = [];
    this.isPlaying = false;

    // Configuration
    this.model = 'models/gemini-2.0-flash-exp'; // Use latest model with Live API support
    this.voiceName = 'Puck'; // Available voices: Puck, Charon, Kore, Fenrir, Aoede

    // Callbacks
    this.onTranscript = null;
    this.onError = null;
    this.onStatusChange = null;
  }

  /**
   * Initialize the Gemini Live API connection
   */
  async initialize() {
    try {
      console.log('🎤 Initializing Gemini Live API...');

      if (!this.apiKey) {
        throw new Error('Gemini API key is required');
      }

      // Initialize Google GenAI client
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });

      // Initialize Web Audio API for microphone and playback
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000 // 16kHz required for input
      });

      console.log('✅ Gemini Live API initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gemini Live API:', error);
      if (this.onError) this.onError(error);
      return false;
    }
  }

  /**
   * Start a live voice session
   */
  async startSession(systemInstruction = '') {
    try {
      console.log('🚀 Starting Gemini Live session...');

      if (this.isConnected) {
        console.warn('Session already active');
        return;
      }

      // Configuration for the live session
      const config = {
        responseModalities: [Modality.AUDIO],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.voiceName
            }
          }
        }
      };

      // Add system instruction if provided
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      // Connect to Gemini Live API
      this.session = await this.ai.live.connect({
        model: this.model,
        callbacks: {
          onopen: () => {
            console.log('✅ Gemini Live session opened');
            this.isConnected = true;
            if (this.onStatusChange) this.onStatusChange('connected');
          },
          onmessage: (message) => {
            this.handleServerMessage(message);
          },
          onerror: (error) => {
            console.error('❌ Gemini Live error:', error);
            this.isConnected = false;
            if (this.onError) this.onError(error);
            if (this.onStatusChange) this.onStatusChange('error');
          },
          onclose: (event) => {
            console.log('🔌 Gemini Live session closed:', event.reason);
            this.isConnected = false;
            if (this.onStatusChange) this.onStatusChange('disconnected');
            this.cleanup();
          }
        },
        config
      });

      // Start microphone capture
      await this.startMicrophoneCapture();

      console.log('✅ Gemini Live session started successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to start Gemini Live session:', error);
      this.isConnected = false;
      if (this.onError) this.onError(error);
      if (this.onStatusChange) this.onStatusChange('error');
      return false;
    }
  }

  /**
   * Start capturing audio from microphone
   */
  async startMicrophoneCapture() {
    try {
      console.log('🎙️ Starting microphone capture...');

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Gemini expects 16kHz input
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio source from microphone
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create ScriptProcessorNode for audio processing
      // Note: ScriptProcessorNode is deprecated but still widely supported
      // For production, consider using AudioWorklet
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (!this.isConnected) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32Array to Int16Array (PCM 16-bit)
        const pcm16 = this.convertToPCM16(inputData);

        // Convert to base64
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

        // Send audio to Gemini Live API
        if (this.session) {
          this.session.sendRealtimeInput([{
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio
          }]);
        }
      };

      // Connect the audio nodes
      source.connect(processor);
      processor.connect(this.audioContext.destination);

      this.audioWorkletNode = processor;

      console.log('✅ Microphone capture started');
    } catch (error) {
      console.error('❌ Failed to start microphone capture:', error);
      throw error;
    }
  }

  /**
   * Handle messages from Gemini Live API server
   */
  handleServerMessage(message) {
    try {
      // Handle server content (audio response)
      if (message.serverContent?.modelTurn?.parts) {
        const parts = message.serverContent.modelTurn.parts;

        parts.forEach(part => {
          // Handle audio data
          if (part.inlineData) {
            const audioData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType;

            console.log('🔊 Received audio from Gemini:', mimeType);
            this.playAudioResponse(audioData, mimeType);
          }

          // Handle text transcript (if available)
          if (part.text) {
            console.log('📝 Transcript:', part.text);
            if (this.onTranscript) {
              this.onTranscript(part.text);
            }
          }
        });
      }

      // Handle turn completion
      if (message.serverContent?.turnComplete) {
        console.log('✅ Turn complete');
        if (this.onStatusChange) this.onStatusChange('turn_complete');
      }

      // Handle setup complete
      if (message.setupComplete) {
        console.log('✅ Setup complete');
        if (this.onStatusChange) this.onStatusChange('setup_complete');
      }

    } catch (error) {
      console.error('❌ Error handling server message:', error);
      if (this.onError) this.onError(error);
    }
  }

  /**
   * Play audio response from Gemini
   */
  async playAudioResponse(base64Audio, mimeType) {
    try {
      // Decode base64 audio
      const audioBuffer = this.base64ToArrayBuffer(base64Audio);

      // Parse mime type to get sample rate
      const sampleRate = this.parseSampleRate(mimeType) || 24000;

      // Create audio buffer for playback
      const audioContextForPlayback = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: sampleRate
      });

      // Convert PCM16 to AudioBuffer
      const pcm16Array = new Int16Array(audioBuffer);
      const float32Array = new Float32Array(pcm16Array.length);

      // Convert Int16 to Float32 (-1.0 to 1.0)
      for (let i = 0; i < pcm16Array.length; i++) {
        float32Array[i] = pcm16Array[i] / 32768.0;
      }

      const playbackBuffer = audioContextForPlayback.createBuffer(
        1, // mono
        float32Array.length,
        sampleRate
      );

      playbackBuffer.getChannelData(0).set(float32Array);

      // Create source and play
      const source = audioContextForPlayback.createBufferSource();
      source.buffer = playbackBuffer;
      source.connect(audioContextForPlayback.destination);
      source.start(0);

      console.log('🔊 Playing audio response');

    } catch (error) {
      console.error('❌ Error playing audio:', error);
    }
  }

  /**
   * Send a text message to Gemini
   */
  async sendText(text) {
    if (!this.isConnected || !this.session) {
      console.error('❌ Session not connected');
      return false;
    }

    try {
      await this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: text }] }]
      });
      console.log('📤 Sent text to Gemini:', text);
      return true;
    } catch (error) {
      console.error('❌ Error sending text:', error);
      return false;
    }
  }

  /**
   * Stop the live session
   */
  async stopSession() {
    try {
      console.log('🛑 Stopping Gemini Live session...');

      if (this.session) {
        this.session.close();
        this.session = null;
      }

      this.cleanup();
      this.isConnected = false;

      console.log('✅ Session stopped');
      if (this.onStatusChange) this.onStatusChange('stopped');
    } catch (error) {
      console.error('❌ Error stopping session:', error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Stop microphone
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Disconnect audio nodes
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Convert Float32Array audio to PCM16 (Int16Array)
   */
  convertToPCM16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and convert to int16
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  /**
   * Convert ArrayBuffer to base64 string
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
   * Convert base64 string to ArrayBuffer
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
   * Parse sample rate from MIME type
   */
  parseSampleRate(mimeType) {
    const match = mimeType.match(/rate=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Check if Gemini Live API is supported
   */
  static isSupported() {
    // Check for required browser APIs
    const hasAudioContext = !!(window.AudioContext || window.webkitAudioContext);
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;

    return hasAudioContext && hasMediaDevices && hasGetUserMedia;
  }
}

// Export for use in background.js (webpack bundled)
export default GeminiLiveVoiceHandler;

// Make available globally for content scripts (when loaded directly in browser)
if (typeof window !== 'undefined') {
  window.GeminiLiveVoiceHandler = GeminiLiveVoiceHandler;
}
