// Simplified laughter detection using direct API calls
const { OpenAI } = require('openai');

class SimpleLaughterDetector {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  async detectLaughter(audioBase64) {
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      
      // Create a temporary file-like object
      const audioFile = {
        buffer: audioBuffer,
        name: 'audio.webm',
        type: 'audio/webm'
      };

      // First, transcribe the audio
      console.log('[SimpleLaughterDetector] Transcribing audio...');
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json'
      });

      console.log('[SimpleLaughterDetector] Transcription:', transcription.text);

      // Analyze for laughter patterns
      const laughterPatterns = [
        /\b(ha+|he+|ho+|hi+)+\b/gi,
        /\b(haha|hehe|hoho|hihi)+\b/gi,
        /\b(a{3,}|e{3,}|i{3,}|o{3,})\b/gi,
        /\b([aeiou]\s+){3,}\b/gi,
        /\b(lol|lmao|rofl)\b/gi
      ];

      let hasLaughter = false;
      let matchedPattern = null;

      for (const pattern of laughterPatterns) {
        if (pattern.test(transcription.text)) {
          hasLaughter = true;
          matchedPattern = pattern.source;
          break;
        }
      }

      // Use GPT to analyze if unsure
      if (!hasLaughter && transcription.text.length > 0) {
        console.log('[SimpleLaughterDetector] Using GPT for analysis...');
        const analysis = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are analyzing audio transcriptions for laughter. Respond with JSON only.'
            },
            {
              role: 'user',
              content: `Is this transcription laughter? "${transcription.text}"\nRespond: {"isLaughter": boolean, "confidence": 0-100}`
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 50
        });

        const result = JSON.parse(analysis.choices[0].message.content);
        hasLaughter = result.isLaughter;
        
        return {
          hasLaughter,
          confidence: result.confidence,
          transcription: transcription.text,
          method: 'gpt-analysis'
        };
      }

      return {
        hasLaughter,
        confidence: hasLaughter ? 95 : 5,
        transcription: transcription.text,
        pattern: matchedPattern,
        method: 'pattern-matching'
      };

    } catch (error) {
      console.error('[SimpleLaughterDetector] Error:', error);
      throw error;
    }
  }
}

module.exports = { SimpleLaughterDetector };