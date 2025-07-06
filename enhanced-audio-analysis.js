// Enhanced audio analysis with multiple detection strategies

const { OpenAI } = require('openai');

// Laughter patterns that Whisper might transcribe
const LAUGHTER_PATTERNS = [
  // Direct laughter
  /\b(ha+|he+|ho+|hi+)+\b/gi,
  /\b(haha|hehe|hoho|hihi|huhu)+\b/gi,
  /\b(ahaha|ehehe|ohoh)+\b/gi,
  
  // Repeated vowels (often how Whisper transcribes laughter)
  /\b(a{3,}|e{3,}|i{3,}|o{3,})\b/gi,
  /(ah\s*){2,}/gi,
  /(eh\s*){2,}/gi,
  
  // Common mistranscriptions of laughter
  /\b(uh\s*){3,}\b/gi,
  /\b(um\s*){3,}\b/gi,
  
  // Breathing/giggling patterns
  /(\s|^)(h+[aeiou]+\s*){2,}/gi,
  
  // Single letters repeated (common Whisper output for laughter)
  /\b([aeiou]\s+){3,}\b/gi,
  /\b(a\s+a\s+a)+\b/gi,
  /\b(e\s+e\s+e)+\b/gi,
];

// Analyze segments for laughter characteristics
function analyzeSegmentsForLaughter(segments) {
  if (!segments || segments.length === 0) return null;
  
  const laughterSegments = [];
  
  for (const segment of segments) {
    const text = segment.text.toLowerCase().trim();
    
    // Check if segment matches laughter patterns
    let isLaughter = false;
    let matchedPattern = null;
    
    for (const pattern of LAUGHTER_PATTERNS) {
      if (pattern.test(text)) {
        isLaughter = true;
        matchedPattern = pattern.source;
        break;
      }
    }
    
    // Check for very short segments (often laughter)
    if (!isLaughter && text.length <= 5 && /^[aeiouhn\s]+$/.test(text)) {
      isLaughter = true;
      matchedPattern = 'short vowel sounds';
    }
    
    // Check for segments with high token-to-text ratio (repetitive sounds)
    if (!isLaughter && segment.tokens && segment.tokens.length > text.length * 0.8) {
      isLaughter = true;
      matchedPattern = 'high token density';
    }
    
    if (isLaughter) {
      laughterSegments.push({
        text: segment.text,
        start: segment.start,
        end: segment.end,
        duration: segment.end - segment.start,
        pattern: matchedPattern
      });
    }
  }
  
  return laughterSegments;
}

// Enhanced detection using multiple strategies
async function enhancedLaughterDetection(transcription, openai) {
  // Strategy 1: Pattern matching
  const patternMatches = [];
  let hasPatternMatch = false;
  
  for (const pattern of LAUGHTER_PATTERNS) {
    const matches = transcription.text.match(pattern);
    if (matches) {
      hasPatternMatch = true;
      patternMatches.push({
        pattern: pattern.source,
        matches: matches
      });
    }
  }
  
  // Strategy 2: Segment analysis
  const laughterSegments = analyzeSegmentsForLaughter(transcription.segments);
  
  // Strategy 3: GPT-4 Vision (if we had audio spectrograms)
  // This would analyze the visual pattern of the audio
  
  // Strategy 4: Use GPT-4o (full model) for complex cases
  let gpt4Analysis = null;
  if (transcription.text.length < 100) { // Only for short clips to save costs
    try {
      const gpt4Response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are analyzing an audio transcription for laughter detection.
The transcription system (Whisper) often captures laughter as:
- Repeated single letters: "a a a a" or "e e e"
- Repeated vowel sounds: "aaa" or "eee"
- Traditional: "haha", "hehe"
- Breathing sounds between words

Analyze if this represents laughter or regular speech.`
          },
          {
            role: "user",
            content: `Transcription: "${transcription.text}"
Duration: ${transcription.duration}s
Number of segments: ${transcription.segments?.length || 0}

Is this laughter? Respond with JSON: {isLaughter: boolean, confidence: 0-100, reasoning: string}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 100,
        temperature: 0.1
      });
      
      gpt4Analysis = JSON.parse(gpt4Response.choices[0].message.content);
    } catch (error) {
      console.error('GPT-4o analysis failed:', error);
    }
  }
  
  // Combine all strategies
  const finalDecision = {
    hasLaughter: hasPatternMatch || (laughterSegments && laughterSegments.length > 0),
    confidence: 0,
    evidence: {
      patternMatches,
      laughterSegments,
      gpt4Analysis
    }
  };
  
  // Calculate confidence
  if (finalDecision.hasLaughter) {
    let confidence = 50; // Base confidence
    
    if (patternMatches.length > 0) confidence += 20;
    if (laughterSegments && laughterSegments.length > 0) confidence += 20;
    if (gpt4Analysis && gpt4Analysis.isLaughter) confidence += 30;
    
    // Adjust based on transcription clarity
    if (transcription.text.includes(' ')) confidence -= 10; // Has spaces (less likely pure laughter)
    if (transcription.duration < 2) confidence += 10; // Short clips often just laughter
    
    finalDecision.confidence = Math.min(100, Math.max(0, confidence));
  } else if (gpt4Analysis) {
    finalDecision.confidence = 100 - gpt4Analysis.confidence;
  } else {
    finalDecision.confidence = 90; // High confidence it's NOT laughter
  }
  
  return finalDecision;
}

module.exports = {
  enhancedLaughterDetection,
  analyzeSegmentsForLaughter,
  LAUGHTER_PATTERNS
};