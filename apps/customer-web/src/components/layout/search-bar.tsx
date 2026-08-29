'use client';

import { Input } from '@dripplex/ui';
import { cn } from '@dripplex/utils';
import { Search } from 'lucide-react';
import * as React from 'react';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
}

export function SearchBar({
  className,
  placeholder = 'Search DrippleX',
}: SearchBarProps): React.JSX.Element {
  return (
    <div className={cn('relative w-full max-w-md', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input type="search" placeholder={placeholder} aria-label={placeholder} className="pl-9" />
    </div>
  );
}
