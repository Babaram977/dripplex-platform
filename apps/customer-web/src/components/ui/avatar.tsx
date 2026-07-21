'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';

import { cn } from '@/lib/utils';

export function Avatar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>): React.JSX.Element {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>): React.JSX.Element {
  return (
    <AvatarPrimitive.Image className={cn('aspect-square h-full w-full', className)} {...props} />
  );
}

export function AvatarFallback({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>): React.JSX.Element {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'bg-brand-muted text-foreground flex h-full w-full items-center justify-center rounded-full text-sm font-semibold',
        className,
      )}
      {...props}
    />
  );
}
