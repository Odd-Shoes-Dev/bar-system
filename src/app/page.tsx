import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getBarBySubdomain, getBarByDomain } from '@/lib/tenants';

export default async function HomePage() {
  // Check if we're on a salon-specific domain/subdomain
  const headersList = await headers();
  const customDomain = headersList.get('x-custom-domain');
  const subdomain = headersList.get('x-salon-subdomain');
  
  // Check for custom domain first (set by middleware)
  let salon = null;
  if (customDomain) {
    salon = await getBarByDomain(customDomain);
  }
  
  // If not custom domain, check subdomain
  if (!salon && subdomain && subdomain !== 'custom') {
    salon = await getBarBySubdomain(subdomain);
  }
  
  // If we found a salon (custom domain or subdomain), redirect to login
  if (salon) {
    redirect('/login');
  }
  
  // Otherwise show the landing page
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo/Brand */}
          <div className="mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/assets/images/logo.png"
                alt="Blue Ox Logo"
                width={100}
                height={100}
                className="object-contain"
              />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Blue Ox
            </h1>
            <p className="text-lg text-gray-600">
              Salon Management Platform
            </p>
          </div>

          {/* Tagline */}
          <p className="text-base text-gray-500 mb-10">
            Powerful tools for modern salons
          </p>

          {/* Quick Access Buttons */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Link
              href="/pos"
              className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-10 border border-gray-200 hover:border-brand-primary"
            >
              <div className="w-16 h-16 bg-brand-primary rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                POS System
              </h2>
              <p className="text-gray-600">
                Quick checkout and sales recording
              </p>
            </Link>

            <Link
              href="/dashboard"
              className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-10 border border-gray-200 hover:border-brand-primary"
            >
              <div className="w-16 h-16 bg-brand-primary rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Dashboard
              </h2>
              <p className="text-gray-600">
                View sales, clients, and analytics
              </p>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-6 text-left">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Client Management
              </h3>
              <p className="text-sm text-gray-600">
                Track visits and preferences
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 text-left">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Loyalty Rewards
              </h3>
              <p className="text-sm text-gray-600">
                Automated points & rewards
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 text-left">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                WhatsApp Receipts
              </h3>
              <p className="text-sm text-gray-600">
                Instant digital receipts
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 text-left">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Mobile Money
              </h3>
              <p className="text-sm text-gray-600">
                MTN & Airtel payments
              </p>
            </div>
          </div>

          {/* Demo Notice */}
          <div className="mt-16 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              <strong className="text-gray-900">Platform Demo</strong> - Payments and WhatsApp messages are simulated.
              <br />
              Production integrations available upon request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
