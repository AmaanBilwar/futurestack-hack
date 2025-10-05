/**
 * Fuzzy search utility using Fuse.js library
 * Provides fast, flexible text matching with professional-grade scoring
 */

import Fuse, { IFuseOptions } from "fuse.js";

export interface FuzzySearchOptions {
  /** Whether to ignore case when matching */
  ignoreCase?: boolean;
  /** Whether to match from the beginning of the string */
  matchFromStart?: boolean;
  /** Minimum score threshold for matches (0-1) */
  threshold?: number;
  /** Whether to include the original item in the result */
  includeOriginal?: boolean;
  /** Minimum query length before showing results */
  minQueryLength?: number;
  /** Fuse.js specific options */
  fuseOptions?: IFuseOptions<any>;
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
 * Perform fuzzy search on an array of items using Fuse.js
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  options: FuzzySearchOptions = {},
): FuzzyMatch<T>[] {
  if (!query.trim()) {
    return items.map((item) => ({
      item,
      text: getText(item),
      score: 1,
      highlighted: options.includeOriginal ? getText(item) : undefined,
    }));
  }

  const {
    threshold = 0.3,
    minQueryLength = 2,
    ignoreCase = true,
    matchFromStart = false,
    fuseOptions = {},
  } = options;

  // Don't show results until minimum query length is reached
  if (query.length < minQueryLength) {
    return [];
  }

  // Create Fuse.js instance with optimized options
  const fuse = new Fuse(items, {
    keys: [
      {
        name: "searchText",
        getFn: getText,
      },
    ],
    threshold: threshold,
    includeScore: true,
    includeMatches: false,
    shouldSort: true,
    ignoreLocation: !matchFromStart,
    isCaseSensitive: !ignoreCase,
    minMatchCharLength: 1,
    findAllMatches: false,
    ...fuseOptions,
  });

  // Perform search
  const results = fuse.search(query);

  // Transform results to match our interface
  return results.map((result) => ({
    item: result.item,
    text: getText(result.item),
    score: result.score ? 1 - result.score : 0, // Convert Fuse score (0-1, lower is better) to our format (0-1, higher is better)
    highlighted: options.includeOriginal ? getText(result.item) : undefined,
  }));
}

/**
 * Hook for managing fuzzy search state
 */
export function useFuzzySearch<T>(
  items: T[],
  getText: (item: T) => string,
  options: FuzzySearchOptions = {},
) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<FuzzyMatch<T>[]>([]);

  useEffect(() => {
    const results = fuzzySearch(items, query, getText, options);
    setMatches(results);
  }, [items, query, getText, JSON.stringify(options)]);

  return {
    query,
    setQuery,
    matches,
    clearQuery: () => setQuery(""),
  };
}

/**
 * Utility function to get searchable text from different item types
 */
export const getSearchableText = {
  repo: (repo: { full_name: string; name: string; owner: { login: string } }) =>
    `${repo.full_name} ${repo.name} ${repo.owner.login}`,

  branch: (branch: { name: string }) => branch.name,

  file: (file: { name: string; path: string }) => `${file.name} ${file.path}`,
};

// Re-export React hooks for convenience
import { useState, useEffect } from "react";
