import { Injectable } from '@nestjs/common';
import { ITextToSpeech, AudioOptions } from '../interfaces/text-to-speech.interface';

@Injectable()
export class MockTTSProvider implements ITextToSpeech {
  async textToSpeech(optionsOrText: AudioOptions | string): Promise<Buffer> {
    // Return a mock audio buffer (silent audio for testing)
    // In a real scenario, you might want to use a local TTS library
    // For now, return an empty buffer with a warning
    console.warn(
      '⚠️  Mock TTS Provider: Returning empty audio buffer. Set OPENAI_API_KEY for real TTS.',
    );

    // Return a minimal WAV file header (silent audio)
    // This is a 1-second silent WAV file
    const silentWav = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // "RIFF"
      0x24,
      0x08,
      0x00,
      0x00, // File size
      0x57,
      0x41,
      0x56,
      0x45, // "WAVE"
      0x66,
      0x6d,
      0x74,
      0x20, // "fmt "
      0x10,
      0x00,
      0x00,
      0x00, // Subchunk1Size
      0x01,
      0x00, // AudioFormat (PCM)
      0x01,
      0x00, // NumChannels (Mono)
      0x44,
      0xac,
      0x00,
      0x00, // SampleRate (44100)
      0x88,
      0x58,
      0x01,
      0x00, // ByteRate
      0x02,
      0x00, // BlockAlign
      0x10,
      0x00, // BitsPerSample (16)
      0x64,
      0x61,
      0x74,
      0x61, // "data"
      0x00,
      0x08,
      0x00,
      0x00, // Subchunk2Size
      // ... silent audio data (zeros)
    ]);

    // Fill with zeros for silent audio
    const audioData = Buffer.alloc(8000, 0);
    return Buffer.concat([silentWav, audioData]);
  }
}
