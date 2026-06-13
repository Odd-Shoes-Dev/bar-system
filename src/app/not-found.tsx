import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <h1 className="text-9xl font-bold text-brand-primary">404</h1>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h2>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-brand-primary text-white rounded-lg hover:opacity-90"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
