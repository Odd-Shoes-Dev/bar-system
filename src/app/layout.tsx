import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { headers } from 'next/headers';
import { getBarBySubdomain, getBarByDomain } from '@/lib/tenants';
import { getCurrentUser } from '@/lib/auth';
import { BarProvider } from '@/contexts/BarContext';
import { UserProvider } from '@/contexts/UserContext';
import CommandPalette from '@/components/CommandPalette';
import NavSidebar from '@/components/NavSidebar';
import AppShell from '@/components/AppShell';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { EscProvider } from '@/contexts/EscContext';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const subdomain = headersList.get('x-salon-subdomain');

  if (subdomain) {
    const bar = await getBarBySubdomain(subdomain);
    if (bar) {
      return {
        title: `${bar.name} - Bar Management`,
        description: 'Bar management system',
        manifest: '/manifest.json',
        icons: {
          icon: '/assets/images/logo.png',
          apple: '/assets/images/logo.png',
        },
      };
    }
  }

  return {
    title: 'Bar Management System',
    description: 'Bar management system',
    manifest: '/manifest.json',
    icons: {
      icon: '/assets/images/logo.png',
      apple: '/assets/images/logo.png',
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load salon based on custom domain or subdomain
  const headersList = await headers();
  const customDomain = headersList.get('x-custom-domain');
  const subdomain = headersList.get('x-salon-subdomain');

  let bar = null;
  if (customDomain) {
    bar = await getBarByDomain(customDomain);
  }
  if (!bar && subdomain) {
    bar = await getBarBySubdomain(subdomain);
  }
  
  // Get current authenticated user
  const user = await getCurrentUser();
  
  // Convert hex color to HSL for CSS variables
  const hexToHSL = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '217 91% 60%'; // fallback blue
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const primaryColor = bar?.theme_primary_color ? hexToHSL(bar.theme_primary_color) : '217 91% 60%';
  
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Bar POS" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bar POS" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#E31C23" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/assets/images/logo.png" />
        
        <style dangerouslySetInnerHTML={{
          __html: `:root { --brand-primary: ${primaryColor}; }`
        }} />
      </head>
      <body className={inter.className}>
        <BarProvider initialBar={bar}>
          <UserProvider initialUser={user}>
            <SidebarProvider>
              <EscProvider>
                <NavSidebar />
                <AppShell>{children}</AppShell>
                <CommandPalette />
              </EscProvider>
            </SidebarProvider>
            <Toaster position="top-center" />
          </UserProvider>
        </BarProvider>
      </body>
    </html>
  );
}
