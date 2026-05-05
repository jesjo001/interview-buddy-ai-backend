import dotenv from 'dotenv';
import axios from 'axios';
// For Google Cloud TTS
// import { TextToSpeechClient } from '@google-cloud/text-to-speech';
// For ElevenLabs
// import { ElevenLabsClient } from 'elevenlabs';

dotenv.config();

// Placeholder for Google Cloud TTS client (uncomment and configure if used)
// const googleTtsClient = process.env.GOOGLE_CLOUD_TTS_KEY
//   ? new TextToSpeechClient({
//       credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_TTS_KEY, 'base64').toString('ascii')),
//     })
//   : null;

// Placeholder for ElevenLabs client (uncomment and configure if used)
// const elevenLabsClient = process.env.ELEVENLABS_API_KEY
//   ? new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
//   : null;

/**
 * Generates speech from text using a Text-to-Speech service.
 * Currently uses mock data if no TTS API key is provided.
 *
 * @param text The text to synthesize into speech.
 * @param voiceSettings Optional settings for the voice (e.g., gender, language).
 * @returns A promise that resolves with the audio content (e.g., base64 string or URL).
 */
export const synthesizeSpeech = async (text: string, voiceSettings?: any): Promise<string> => {
  const apiKey = process.env.TTS_API_KEY;
  const apiUrl = process.env.TTS_API_URL || process.env.TTS_API_URL_BASE || 'https://api.example.com/tts/api/generate';

  if (!apiKey) {
    console.warn('No TTS API key found. Using mock TTS response.');
    return `MOCK_AUDIO_CONTENT_FOR: "${text.substring(0, 50)}..."`;
  }

  try {
    const payload = {
      text,
      voice: voiceSettings?.voice || 'voice_1',
      settings: {
        speed: voiceSettings?.speed ?? 1.0,
        stability: voiceSettings?.stability ?? 0.5,
      },
    };

    const resp = await axios.post(apiUrl, payload, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      responseType: 'json',
    });

    // Expect the TTS API to return either a URL or base64 audio in `audio` or `url` field
    const data = resp.data as any;
    if (data.audio) return data.audio;
    if (data.url) return data.url;
    return JSON.stringify(data);
  } catch (err) {
    console.error('Error calling TTS provider:', (err as any)?.message || err);
    throw new Error('TTS provider error');
  }
};
