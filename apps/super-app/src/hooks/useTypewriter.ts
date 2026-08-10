import { useState, useEffect } from 'react';
import { DURATION } from '../tokens/animations';

// Cycles through an array of strings with a typewriter character-by-character effect.
// Returns the currently visible text slice.
export function useTypewriter(
  phrases: string[],
  msPerChar = DURATION.typewriter,
  cycleMs = 4000,
): string {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Cycle to next phrase
  useEffect(() => {
    const t = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % phrases.length);
      setCharCount(0);
    }, cycleMs);
    return () => clearInterval(t);
  }, [phrases.length, cycleMs]);

  // Type character by character
  useEffect(() => {
    const target = phrases[phraseIdx];
    if (charCount >= target.length) return;
    const t = setTimeout(() => setCharCount((c) => c + 1), msPerChar);
    return () => clearTimeout(t);
  }, [charCount, phraseIdx, phrases, msPerChar]);

  return phrases[phraseIdx].slice(0, charCount);
}
