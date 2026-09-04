export const dynamic = 'force-dynamic';

export default function WelcomePage() {
  return (
    <div className="card mx-auto mt-12 max-w-lg p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Choose a user to continue</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Authentication is stubbed for development. Pick a user from the switcher in
        the top right — try a venue staff member and then Head Office to see how what
        is visible changes.
      </p>
      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        If the switcher is empty, the API could not be reached. Check that it is
        running and that <code className="font-mono">API_INTERNAL_URL</code> points at
        it.
      </p>
    </div>
  );
}
