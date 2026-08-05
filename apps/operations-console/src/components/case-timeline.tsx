import { formatDate } from '@dripplex/utils';
import * as React from 'react';

import type { OperationsCaseEventDto } from '@dripplex/types';

const EVENT_LABEL: Record<OperationsCaseEventDto['eventType'], string> = {
  CREATED: 'Case created',
  PRIORITY_CHANGED: 'Priority changed',
  ASSIGNED: 'Assigned',
  UNASSIGNED: 'Unassigned',
  STATUS_CHANGED: 'Status changed',
  NOTE_ADDED: 'Note added',
};

function timeOfDay(iso: string): string {
  return formatDate(iso, 'en-NG', { hour: '2-digit', minute: '2-digit' });
}

/** DPX-OPS-001 Slice 2 — the immutable event timeline, per the founder's
 * own example format ("10:03 SOS Triggered", "10:04 Assigned to
 * Operator" ...). This is the operational audit log for a case. */
export function CaseTimeline({ events }: { events: OperationsCaseEventDto[] }): React.JSX.Element {
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">No activity yet.</p>;
  }

  return (
    <ol className="border-border/70 ml-2 space-y-4 border-l pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="bg-primary absolute -left-[21px] top-1 h-2 w-2 rounded-full" />
          <p className="text-sm">
            <span className="text-muted-foreground tabular-nums">{timeOfDay(event.createdAt)}</span>{' '}
            <span className="font-medium">{EVENT_LABEL[event.eventType]}</span>
            {event.actorName ? (
              <span className="text-muted-foreground"> · {event.actorName}</span>
            ) : null}
          </p>
          {event.eventType === 'NOTE_ADDED' || event.description ? (
            <p className="text-muted-foreground mt-0.5 text-sm">{event.description}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
