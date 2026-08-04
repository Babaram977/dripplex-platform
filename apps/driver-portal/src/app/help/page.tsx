'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import type { CmsContentDto } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useDriverHelp } from '@/hooks/use-driver-help';

interface FaqBody {
  question: string;
  answer: string;
  category?: string;
}

function isFaqBody(body: unknown): body is FaqBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { question?: unknown }).question === 'string' &&
    typeof (body as { answer?: unknown }).answer === 'string'
  );
}

function articleText(body: unknown): string | null {
  if (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { text?: unknown }).text === 'string'
  ) {
    return (body as { text: string }).text;
  }
  return null;
}

/** Driver Slice 2 item 7 — Help Centre (founder-scoped 2026-08-04, reusing
 * the existing Cms module rather than a new content system). FAQ entries
 * (`body: { question, answer, category? }`) render as an expandable list;
 * full articles (`body: { text }`) render as plain-text cards. Malformed
 * content (an author saved a shape this page doesn't recognize) is
 * skipped silently rather than crashing the page — an honest gap, not a
 * guess at rendering arbitrary JSON. */
export default function HelpPage(): React.JSX.Element {
  const help = useDriverHelp();

  const faqs = React.useMemo(
    () => (help.data ?? []).filter((item) => item.type === 'DRIVER_FAQ' && isFaqBody(item.body)),
    [help.data],
  );
  const articles = React.useMemo(
    () => (help.data ?? []).filter((item) => item.type === 'DRIVER_STATIC_PAGE'),
    [help.data],
  );

  const grouped = React.useMemo(() => {
    const byCategory = new Map<string, CmsContentDto[]>();
    for (const item of faqs) {
      const category = isFaqBody(item.body) && item.body.category ? item.body.category : 'General';
      const bucket = byCategory.get(category) ?? [];
      bucket.push(item);
      byCategory.set(category, bucket);
    }
    return byCategory;
  }, [faqs]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Help Centre</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Answers to common questions. For anything else, use Support or Report an Incident.
          </p>
        </div>

        {help.isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : null}

        {!help.isLoading && faqs.length === 0 && articles.length === 0 ? (
          <EmptyState
            title="No help articles yet"
            description="Check back soon, or reach out via Support if you need help now."
          />
        ) : null}

        {[...grouped.entries()].map(([category, items]) => (
          <div key={category}>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{category}</h2>
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const body = item.body as FaqBody;
                return (
                  <details
                    key={item.id}
                    className="border-border/70 rounded-md border p-3 [&_summary]:cursor-pointer"
                  >
                    <summary className="text-sm font-medium">{body.question}</summary>
                    <p className="text-muted-foreground mt-2 text-sm">{body.answer}</p>
                  </details>
                );
              })}
            </div>
          </div>
        ))}

        {articles.length > 0 ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">Articles</h2>
            <div className="flex flex-col gap-3">
              {articles.map((article) => {
                const text = articleText(article.body);
                return (
                  <Card key={article.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{article.title}</CardTitle>
                    </CardHeader>
                    {text ? (
                      <CardContent className="text-muted-foreground whitespace-pre-wrap text-sm">
                        {text}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
