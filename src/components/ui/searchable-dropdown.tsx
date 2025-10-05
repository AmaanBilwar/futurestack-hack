"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fuzzySearch, FuzzyMatch } from "@/lib/fuzzy-search";
import { cn } from "@/lib/utils";

export interface SearchableDropdownProps<T> {
  /** Array of items to display */
  items: T[];
  /** Function to extract searchable text from item */
  getText: (item: T) => string;
  /** Function to render item display */
  renderItem: (item: T, highlighted?: string) => React.ReactNode;
  /** Function to get unique key for item */
  getKey: (item: T) => string;
  /** Currently selected item */
  selected?: T | null;
  /** Callback when item is selected */
  onSelect: (item: T) => void;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Placeholder text for dropdown trigger */
  triggerPlaceholder?: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Loading text */
  loadingText?: string;
  /** Empty state text */
  emptyText?: string;
  /** Maximum height for dropdown content */
  maxHeight?: string;
  /** Whether to show search input */
  showSearch?: boolean;
  /** Custom className for dropdown content */
  contentClassName?: string;
}

export function SearchableDropdown<T>({
  items,
  getText,
  renderItem,
  getKey,
  selected,
  onSelect,
  searchPlaceholder = "Search...",
  triggerPlaceholder = "Select an option",
  disabled = false,
  loading = false,
  loadingText = "Loading...",
  emptyText = "No items found",
  maxHeight = "320px",
  showSearch = true,
  contentClassName,
}: SearchableDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<FuzzyMatch<T>[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Perform fuzzy search when query or items change
  useEffect(() => {
    const results = fuzzySearch(items, query, getText, {
      threshold: 0.1,
      includeOriginal: true,
    });
    setMatches(results);
  }, [items, query, getText]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && showSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open, showSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    } else if (event.key === "Enter" && matches.length > 0) {
      onSelect(matches[0].item);
      setOpen(false);
      setQuery("");
    }
  };

  const handleSelect = (item: T) => {
    onSelect(item);
    setOpen(false);
    setQuery("");
  };

  const displayText = selected ? getText(selected) : triggerPlaceholder;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={disabled || loading}
          variant="outline"
          className="w-full justify-between"
        >
          <span className="truncate">
            {loading ? loadingText : displayText}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        ref={dropdownRef}
        className={cn(
          "w-[var(--radix-dropdown-menu-trigger-width)]",
          contentClassName
        )}
        style={{ maxHeight }}
      >
        {showSearch && (
          <>
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-8"
                />
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <DropdownMenuItem disabled>
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                {loadingText}
              </div>
            </DropdownMenuItem>
          ) : matches.length === 0 ? (
            <DropdownMenuItem disabled>
              {query ? "No matches found" : emptyText}
            </DropdownMenuItem>
          ) : (
            matches.map((match) => (
              <DropdownMenuItem
                key={getKey(match.item)}
                onSelect={() => handleSelect(match.item)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  {renderItem(match.item, match.highlighted)}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Specialized repository dropdown component
 */
export function RepositoryDropdown({
  repos,
  selected,
  onSelect,
  loading = false,
}: {
  repos: Array<{
    id: number;
    full_name: string;
    name: string;
    owner: { login: string };
  }>;
  selected?: {
    id: number;
    full_name: string;
    name: string;
    owner: { login: string };
  } | null;
  onSelect: (repo: {
    id: number;
    full_name: string;
    name: string;
    owner: { login: string };
  }) => void;
  loading?: boolean;
}) {
  return (
    <SearchableDropdown
      items={repos}
      getText={(repo) => repo.full_name}
      renderItem={(repo, highlighted) => (
        <div className="flex flex-col">
          <span
            className="font-medium"
            dangerouslySetInnerHTML={{ __html: highlighted || repo.full_name }}
          />
          <span className="text-xs text-muted-foreground">
            {repo.owner.login}
          </span>
        </div>
      )}
      getKey={(repo) => repo.id.toString()}
      selected={selected}
      onSelect={onSelect}
      triggerPlaceholder="Select repository"
      searchPlaceholder="Search repositories..."
      loading={loading}
      loadingText="Loading repositories..."
      emptyText="No repositories found"
    />
  );
}

/**
 * Specialized branch dropdown component
 */
export function BranchDropdown({
  branches,
  selected,
  onSelect,
  loading = false,
}: {
  branches: Array<{ name: string; commitSha?: string; protected?: boolean }>;
  selected?: string | null;
  onSelect: (branchName: string) => void;
  loading?: boolean;
}) {
  const selectedBranch = selected
    ? branches.find((b) => b.name === selected)
    : null;

  return (
    <SearchableDropdown
      items={branches}
      getText={(branch) => branch.name}
      renderItem={(branch, highlighted) => (
        <div className="flex items-center justify-between w-full">
          <span
            dangerouslySetInnerHTML={{ __html: highlighted || branch.name }}
          />
          {branch.protected && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
              Protected
            </span>
          )}
        </div>
      )}
      getKey={(branch) => branch.name}
      selected={selectedBranch}
      onSelect={(branch) => onSelect(branch.name)}
      triggerPlaceholder="Select branch"
      searchPlaceholder="Search branches..."
      loading={loading}
      loadingText="Loading branches..."
      emptyText="No branches found"
    />
  );
}
