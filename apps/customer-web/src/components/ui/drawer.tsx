'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export function DrawerContent({
  className,
  children,
  side = 'right',
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: 'left' | 'right' | 'bottom';
}): React.JSX.Element {
  const sideClasses =
    side === 'left'
      ? 'inset-y-0 left-0 h-full w-[min(100%,20rem)] border-r data-[state=open]:animate-fade-in'
      : side === 'bottom'
        ? 'inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-lg border-t data-[state=open]:animate-fade-up'
        : 'inset-y-0 right-0 h-full w-[min(100%,20rem)] border-l data-[state=open]:animate-fade-in';

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=open]:animate-fade-in fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          'border-border bg-card shadow-elevation-3 fixed z-50 p-6 outline-none',
          sideClasses,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="text-muted-foreground hover:bg-muted absolute right-4 top-4 rounded-md p-1 transition"
          aria-label="Close drawer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DrawerTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): React.JSX.Element {
  return (
    <DialogPrimitive.Title
      className={cn('font-display text-lg font-semibold tracking-tight', className)}
      {...props}
    />
  );
}
