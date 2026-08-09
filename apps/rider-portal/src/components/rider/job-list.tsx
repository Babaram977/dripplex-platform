'use client';

import { EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { JobCard } from '@/components/rider/job-card';
import { useRiderJobs } from '@/hooks/deliveries/use-rider-jobs';
import { describeSdkError } from '@/lib/sdk';

export function JobList(): React.JSX.Element {
  const jobs = useRiderJobs();

  if (jobs.isPending) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (jobs.isError) {
    const described = describeSdkError(jobs.error);
    return <EmptyState title={described.title} description={described.description} />;
  }

  if (jobs.data.length === 0) {
    return (
      <EmptyState
        title="No active deliveries"
        description="Assigned delivery jobs will appear here. Go online to start receiving assignments."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {jobs.data.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
