import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto mt-12 max-w-lg p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Issue not found</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        It may have been deleted, or it belongs to a venue you do not have access to.
      </p>
      <Link href="/issues" className="btn-primary mt-5">
        Back to issues
      </Link>
    </div>
  );
}
