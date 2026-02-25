import { getScriptGenerationPrompt, getOpenAIScriptSystemPrompt } from './script-prompts';

describe('script-prompts (Hindi support)', () => {
  describe('getScriptGenerationPrompt', () => {
    it('includes Devanagari-only instruction when language is Hindi', () => {
      const prompt = getScriptGenerationPrompt('Valentine Day', 45, 'Hindi');
      expect(prompt).toContain('Devanagari');
      expect(prompt).toContain('NO Romanized');
      expect(prompt).toContain('NO English');
      expect(prompt).toContain('देखो यह बंदर'); // example Hindi text
      expect(prompt).not.toContain('Romanized form only'); // old wording we avoid
      // Prompt instructs no transliteration and no Latin/English (single language only)
    });

    it('includes audio_text hint for Hindi (Devanagari only) when language is Hindi', () => {
      const prompt = getScriptGenerationPrompt('Topic', 30, 'Hindi');
      expect(prompt).toContain('in Hindi, in Devanagari script only');
    });

    it('does not include Hindi instruction when language is English', () => {
      const prompt = getScriptGenerationPrompt('Valentine Day', 45, 'English (US)');
      expect(prompt).not.toContain('Devanagari');
      expect(prompt).not.toContain('NO English words');
    });

    it('includes Hindi instruction when language is "hi"', () => {
      const prompt = getScriptGenerationPrompt('Test', 30, 'hi');
      expect(prompt).toContain('Devanagari');
    });
  });

  describe('getOpenAIScriptSystemPrompt', () => {
    it('uses Hindi audio_text hint when language is Hindi', () => {
      const prompt = getOpenAIScriptSystemPrompt(30, 'Hindi');
      expect(prompt).toContain('Devanagari');
      expect(prompt).toContain('10-12 spoken words in Hindi, Devanagari script only');
    });

    it('uses generic narration hint when language is English', () => {
      const prompt = getOpenAIScriptSystemPrompt(30, 'English (US)');
      expect(prompt).toContain('10-12 spoken words in English (US)');
      expect(prompt).not.toContain('Devanagari only');
    });
  });
});
