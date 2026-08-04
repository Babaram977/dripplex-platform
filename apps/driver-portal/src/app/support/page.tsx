'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  LoadingSpinner,
  Select,
  Textarea,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import type { DriverSupportCategory, DriverSupportTicketDto } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useCreateSupportTicket, useSupportTickets } from '@/hooks/use-driver-support';
import { formatDate } from '@/lib/format';

const CATEGORY_LABEL: Record<DriverSupportCategory, string> = {
  PAYOUT: 'Payout issue',
  ACCOUNT: 'Account issue',
  APP_BUG: 'App bug',
  KYC: 'KYC / documents',
  OTHER: 'Other',
};

const STATUS_BADGE: Record<DriverSupportTicketDto['status'], 'outline' | 'success'> = {
  OPEN: 'outline',
  IN_PROGRESS: 'outline',
  RESOLVED: 'success',
  CLOSED: 'outline',
};

/** Driver Slice 2 item 3 — Driver Support (founder-approved 2026-08-04): "a
 * basic 'submit an issue, admin sees a queue' loop." General account/
 * payout/app/KYC support — for a specific-trip problem, "Report an Issue"
 * on the trip receipt already covers that separately. */
export default function SupportPage(): React.JSX.Element {
  const tickets = useSupportTickets();
  const createTicket = useCreateSupportTicket();

  const [category, setCategory] = React.useState<DriverSupportCategory>('OTHER');
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');

  const onSubmit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    createTicket.mutate(
      { category, subject, description },
      {
        onSuccess: () => {
          toast({ title: 'Ticket submitted', description: "We'll follow up in-app." });
          setSubject('');
          setDescription('');
          setCategory('OTHER');
        },
        onError: () => {
          toast({
            title: "Couldn't submit ticket",
            description: 'Please try again.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Support</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Payout, account, app, or documentation issues not tied to a specific trip. For a problem
            on a completed trip, use &quot;Report an Issue&quot; on that trip&apos;s receipt
            instead.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="support-category">Category</Label>
                <Select
                  id="support-category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as DriverSupportCategory);
                  }}
                >
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="support-subject">Subject</Label>
                <Input
                  id="support-subject"
                  value={subject}
                  onChange={(event) => {
                    setSubject(event.target.value);
                  }}
                  minLength={3}
                  maxLength={200}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="support-description">Description</Label>
                <Textarea
                  id="support-description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  required
                />
              </div>
              <Button type="submit" disabled={createTicket.isPending} className="w-fit">
                Submit ticket
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Your tickets</h2>

          {tickets.isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : null}

          {!tickets.isLoading && (tickets.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No tickets yet"
              description="Submit a ticket above and we'll follow up here."
            />
          ) : null}

          <div className="flex flex-col gap-3">
            {(tickets.data ?? []).map((ticket) => (
              <Card key={ticket.id}>
                <CardContent className="flex flex-col gap-2 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{ticket.subject}</p>
                      <p className="text-muted-foreground text-xs">
                        {CATEGORY_LABEL[ticket.category]} · {formatDate(ticket.createdAt)}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[ticket.status]}>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm">{ticket.description}</p>
                  {ticket.adminResponse ? (
                    <div className="border-border/70 bg-muted/40 rounded-md border p-2 text-sm">
                      <p className="text-muted-foreground text-xs font-medium">DrippleX Support</p>
                      <p>{ticket.adminResponse}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
