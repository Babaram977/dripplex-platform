'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'border-border bg-popover text-popover-foreground shadow-elevation-2 data-[state=open]:animate-fade-in z-50 min-w-[10rem] overflow-hidden rounded-md border p-1',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'focus:bg-muted relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('text-muted-foreground px-2 py-1.5 text-xs font-semibold', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}
