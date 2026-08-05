'use client';

import { Button, Textarea, toast } from '@dripplex/ui';
import * as React from 'react';

import { useAddCaseNote } from '@/hooks/use-operations-case';

/** DPX-OPS-001 Slice 2 — internal operator notes, logged as a NOTE_ADDED
 * timeline event (the "internal notes" capability from the founder's
 * original Support Centre scope). */
export function CaseNoteForm({ caseId }: { caseId: string }): React.JSX.Element {
  const addNote = useAddCaseNote(caseId);
  const [note, setNote] = React.useState('');

  const onSubmit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    addNote.mutate(
      { note: trimmed },
      {
        onSuccess: () => {
          setNote('');
        },
        onError: () => {
          toast({
            title: "Couldn't add note",
            description: 'Please try again.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={onSubmit}>
      <Textarea
        placeholder="Add an internal note — visible to Operations only…"
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
        }}
        rows={3}
      />
      <Button type="submit" variant="outline" disabled={!note.trim() || addNote.isPending}>
        {addNote.isPending ? 'Adding…' : 'Add note'}
      </Button>
    </form>
  );
}
