'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  LoadingSpinner,
  Textarea,
} from '@dripplex/ui';
import { Star } from 'lucide-react';
import * as React from 'react';

import type { ReviewAggregateDto, ReviewDto } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function Stars({ rating }: { rating: number }): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${String(rating)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={
            value <= rating
              ? 'fill-promotion text-promotion h-4 w-4'
              : 'text-muted-foreground/40 h-4 w-4 fill-none'
          }
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default function ReviewsPage(): React.JSX.Element {
  const [items, setItems] = React.useState<ReviewDto[]>([]);
  const [aggregate, setAggregate] = React.useState<ReviewAggregateDto | null>(null);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.reviews.listMerchant({ page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setAggregate(result.aggregate);
      setTotalPages(result.meta.totalPages);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            What customers are saying about your store and products, and your replies.
          </p>
        </div>
        {aggregate && aggregate.reviewCount > 0 ? (
          <div className="flex items-center gap-2">
            <Stars rating={Math.round(aggregate.averageRating)} />
            <span className="text-sm font-medium">{aggregate.averageRating.toFixed(1)}</span>
            <span className="text-muted-foreground text-xs">
              ({aggregate.reviewCount} store review{aggregate.reviewCount === 1 ? '' : 's'})
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Reviews from customers will show up here once they start rating your store or products."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onReplied={(updated) => {
                setItems((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                );
              }}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((current) => Math.min(totalPages, current + 1));
            }}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewCard({
  review,
  onReplied,
}: {
  review: ReviewDto;
  onReplied: (updated: ReviewDto) => void;
}): React.JSX.Element {
  const [replying, setReplying] = React.useState(false);
  const [draft, setDraft] = React.useState(review.merchantReply ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = replying;
  const hasReply = review.merchantReply !== null;

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const updated = await sdk.reviews.reply(review.id, { reply: trimmed });
        onReplied(updated);
        setReplying(false);
      } catch (replyError) {
        setError(describeSdkError(replyError).description);
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <Stars rating={review.rating} />
            <Badge variant={review.targetType === 'PRODUCT' ? 'secondary' : 'accent'}>
              {review.targetType === 'PRODUCT' ? 'Product review' : 'Store review'}
            </Badge>
            {review.verifiedPurchase ? <Badge variant="success">Verified purchase</Badge> : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{formatDate(review.createdAt)}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {review.comment ? <p className="text-sm">{review.comment}</p> : null}

        {hasReply && !isEditing ? (
          <div className="border-border/70 bg-muted/40 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">Your reply</p>
              <p className="text-muted-foreground text-xs">
                {review.merchantRepliedAt ? formatDate(review.merchantRepliedAt) : null}
              </p>
            </div>
            <p className="mt-1 text-sm">{review.merchantReply}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setDraft(review.merchantReply ?? '');
                setReplying(true);
              }}
            >
              Edit reply
            </Button>
          </div>
        ) : isEditing ? (
          <form className="flex flex-col gap-2" onSubmit={onSubmit}>
            <Textarea
              aria-label="Reply to this review"
              value={draft}
              maxLength={5000}
              minLength={1}
              required
              rows={3}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
            />
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setReplying(false);
                  setDraft(review.merchantReply ?? '');
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving || draft.trim().length === 0}>
                {saving ? 'Saving…' : hasReply ? 'Save reply' : 'Post reply'}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setReplying(true);
              }}
            >
              Reply
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
