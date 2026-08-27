import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: {
    background: './src/background.js',  // Service worker
    offscreen: './offscreen.js'          // Offscreen document for Gemini Live
  },
  output: {
    filename: '[name].js',  // Produces background.js and offscreen.js
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  mode: 'production',
  target: 'web',  // Changed from webworker - offscreen needs DOM APIs
  resolve: {
    extensions: ['.js'],
    fallback: {
      "crypto": false,
      "stream": false,
      "buffer": false
    }
  },
  optimization: {
    minimize: false  // Keep readable for debugging
  }
};
