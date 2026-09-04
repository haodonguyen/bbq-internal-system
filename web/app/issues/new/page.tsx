import { api } from '@/lib/api';
import { NewIssueForm } from '@/components/NewIssueForm';
import type { UserSummary, Venue } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewIssuePage() {
  const [me, venues] = await Promise.all([
    api<UserSummary>('/me'),
    api<Venue[]>('/venues'),
  ]);

  // Preloaded per venue so the assignee list updates instantly when Head Office
  // switches venue, without a round trip.
  const lists = await Promise.all(
    venues.map(async (venue) => [
      venue.id,
      await api<UserSummary[]>(`/venues/${venue.id}/assignable-users`),
    ] as const),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Raise an issue</h1>
      <p className="mb-5 text-sm text-slate-500">
        Describe the problem and add photos where they help.
      </p>
      <NewIssueForm
        me={me}
        venues={venues}
        assignableByVenue={Object.fromEntries(lists)}
      />
    </div>
  );
}
