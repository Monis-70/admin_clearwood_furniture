'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-browser';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onSearch(value: string): void;
  label: string;
  placeholder?: string;
  /** Shorter terms are not sent (they rarely help and cost a request each). */
  minLength?: number;
  className?: string;
}

/** Debounced (350 ms) search box; the committed value lives in the URL. */
export function SearchInput({
  value,
  onSearch,
  label,
  placeholder,
  minLength = 1,
  className,
}: SearchInputProps) {
  const [text, setText] = useState(value);
  const debounced = useDebouncedValue(text, 350);
  const [shown, setShown] = useState(value);
  // The URL changed without typing here (Clear filters, a saved filter, Back): show it, or the
  // stale text would be debounced straight back into the URL. The echo of our own commit equals
  // the debounced text and leaves anything typed since untouched.
  if (value !== shown) {
    setShown(value);
    if (value !== debounced.trim()) setText(value);
  }
  const committed = useRef(value);

  useEffect(() => {
    committed.current = value;
  }, [value]);

  useEffect(() => {
    const term = debounced.trim();
    if (term === committed.current) return;
    if (term.length > 0 && term.length < minLength) return;
    committed.current = term;
    onSearch(term);
  }, [debounced, minLength, onSearch]);

  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            const term = text.trim();
            committed.current = term;
            onSearch(term);
          }
        }}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {text ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-0.5 right-0.5 text-muted-foreground"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            committed.current = '';
            onSearch('');
          }}
        >
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
