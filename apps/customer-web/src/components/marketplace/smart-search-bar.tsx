'use client';

import { Button, Input } from '@dripplex/ui';
import { Search, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

interface SmartSearchBarProps {
  placeholder?: string;
  defaultValue?: string;
}

export function SmartSearchBar({
  placeholder = 'Try "Laptop under ₦500,000" or "shawarma near me"',
  defaultValue = '',
}: SmartSearchBarProps): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = React.useState(defaultValue);

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    router.push(`/marketplace/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-2xl" role="search">
      <Sparkles
        className="text-accent pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        aria-label="Search the marketplace"
        placeholder={placeholder}
        className="h-12 pl-10 pr-24"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <Button type="submit" className="absolute right-1.5 top-1.5 h-9">
        <Search className="mr-2 h-4 w-4" aria-hidden="true" />
        Search
      </Button>
    </form>
  );
}
