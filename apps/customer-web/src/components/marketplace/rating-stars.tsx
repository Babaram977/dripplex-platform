import { Star } from 'lucide-react';
import * as React from 'react';

interface RatingStarsProps {
  average: number;
  count: number;
  className?: string;
}

export function RatingStars({ average, count, className }: RatingStarsProps): React.JSX.Element {
  if (count === 0) {
    return <span className="text-muted-foreground text-xs">No ratings yet</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="text-sm font-medium">{average.toFixed(1)}</span>
      <span className="text-muted-foreground text-xs">({count})</span>
    </span>
  );
}
