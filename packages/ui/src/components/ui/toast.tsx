'use client';

import { cn } from '@dripplex/utils';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import * as React from 'react';
import { create } from 'zustand';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

export function toast(input: Omit<ToastItem, 'id'>): void {
  useToastStore.getState().push(input);
}

export function Toaster(): React.JSX.Element {
  const { toasts, dismiss } = useToastStore();

  return (
    <ToastPrimitives.Provider swipeDirection="right">
      {toasts.map((item) => (
        <ToastPrimitives.Root
          key={item.id}
          open
          onOpenChange={(open) => {
            if (!open) {
              dismiss(item.id);
            }
          }}
          className={cn(
            'border-border bg-card shadow-elevation-2 data-[state=open]:animate-fade-up pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-md border p-4',
            item.variant === 'destructive' && 'border-destructive/40 bg-destructive/10',
          )}
        >
          <div className="grid gap-1">
            <ToastPrimitives.Title className="text-sm font-semibold">
              {item.title}
            </ToastPrimitives.Title>
            {item.description ? (
              <ToastPrimitives.Description className="text-muted-foreground text-sm">
                {item.description}
              </ToastPrimitives.Description>
            ) : null}
          </div>
          <ToastPrimitives.Close
            className="text-muted-foreground hover:bg-muted absolute right-2 top-2 rounded-md p-1"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </ToastPrimitives.Close>
        </ToastPrimitives.Root>
      ))}
      <ToastPrimitives.Viewport className="fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitives.Provider>
  );
}
