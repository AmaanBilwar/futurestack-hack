/**
 * Fuzzy search utility for filtering dropdown options
 * Provides fast, flexible text matching with scoring
 */

export interface FuzzySearchOptions {
  /** Whether to ignore case when matching */
  ignoreCase?: boolean;
  /** Whether to match from the beginning of the string */
  matchFromStart?: boolean;
  /** Minimum score threshold for matches (0-1) */
  threshold?: number;
  /** Whether to include the original item in the result */
  includeOriginal?: boolean;
}

export interface FuzzyMatch<T> {
  /** The original item */
  item: T;
  /** The text that was matched */
  text: string;
  /** Match score (0-1, higher is better) */
  score: number;
  /** Highlighted text with match indicators */
  highlighted?: string;
}

/**
 * Calculate fuzzy match score between query and text
 * Uses a simple but effective algorithm based on character sequence matching
 */
function calculateFuzzyScore(query: string, text: string, options: FuzzySearchOptions = {}): number {
  const { ignoreCase = true, matchFromStart = false } = options;
  
  const q = ignoreCase ? query.toLowerCase() : query;
  const t = ignoreCase ? text.toLowerCase() : text;
  
  if (q === t) return 1.0;
  if (q.length === 0) return 0;
  if (t.length === 0) return 0;
  
  // Exact substring match gets high score
  if (t.includes(q)) {
    const position = t.indexOf(q);
    const startBonus = matchFromStart && position === 0 ? 0.2 : 0;
    return 0.8 + startBonus + (1 - position / t.length) * 0.1;
  }
  
  // Character sequence matching
  let queryIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  
  for (let i = 0; i < t.length && queryIndex < q.length; i++) {
    if (t[i] === q[queryIndex]) {
      score += 1;
      queryIndex++;
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    } else {
      consecutiveMatches = 0;
    }
  }
  
  if (queryIndex < q.length) return 0; // Not all query characters found
  
  // Normalize score and add bonuses
  const baseScore = score / q.length;
  const consecutiveBonus = maxConsecutive / q.length * 0.3;
  const lengthPenalty = Math.max(0, 1 - (t.length - q.length) / q.length * 0.1);
  
  return Math.min(1, baseScore + consecutiveBonus + lengthPenalty);
}

/**
 * Create highlighted text showing matched characters
 */
function createHighlightedText(text: string, query: string, options: FuzzySearchOptions = {}): string {
  const { ignoreCase = true } = options;
  const q = ignoreCase ? query.toLowerCase() : query;
  const t = ignoreCase ? text.toLowerCase() : text;
  
  if (q.length === 0) return text;
  
  let result = '';
  let queryIndex = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const lowerChar = ignoreCase ? char.toLowerCase() : char;
    
    if (queryIndex < q.length && lowerChar === q[queryIndex]) {
      result += `<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">${char}</mark>`;
      queryIndex++;
    } else {
      result += char;
    }
  }
  
  return result;
}

/**
 * Perform fuzzy search on an array of items
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  options: FuzzySearchOptions = {}
): FuzzyMatch<T>[] {
  if (!query.trim()) {
    return items.map(item => ({
      item,
      text: getText(item),
      score: 1,
      highlighted: options.includeOriginal ? getText(item) : undefined
    }));
  }
  
  const { threshold = 0.1 } = options;
  const matches: FuzzyMatch<T>[] = [];
  
  for (const item of items) {
    const text = getText(item);
    const score = calculateFuzzyScore(query, text, options);
    
    if (score >= threshold) {
      matches.push({
        item,
        text,
        score,
        highlighted: options.includeOriginal ? createHighlightedText(text, query, options) : undefined
      });
    }
  }
  
  // Sort by score (highest first)
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Hook for managing fuzzy search state
 */
export function useFuzzySearch<T>(
  items: T[],
  getText: (item: T) => string,
  options: FuzzySearchOptions = {}
) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<FuzzyMatch<T>[]>([]);
  
  useEffect(() => {
    const results = fuzzySearch(items, query, getText, options);
    setMatches(results);
  }, [items, query, getText, JSON.stringify(options)]);
  
  return {
    query,
    setQuery,
    matches,
    clearQuery: () => setQuery('')
  };
}

/**
 * Utility function to get searchable text from different item types
 */
export const getSearchableText = {
  repo: (repo: { full_name: string; name: string; owner: { login: string } }) => 
    `${repo.full_name} ${repo.name} ${repo.owner.login}`,
  
  branch: (branch: { name: string }) => branch.name,
  
  file: (file: { name: string; path: string }) => `${file.name} ${file.path}`
};

// Re-export React hooks for convenience
import { useState, useEffect } from 'react';
