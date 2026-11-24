import '../shims/globals';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '../components/theme/ThemeProvider';
import { AxiomWebVitals } from 'next-axiom';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'Menza - Smart Multi-Tenant Restaurant Suite',
  description: 'Enterprise restaurant POS, inventory, table management, KOT dispatch, and multi-outlet analytics.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Menza POS',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#DE8626',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans min-h-screen bg-[#FAF8F5] dark:bg-[#0E1217] text-[#162028] dark:text-[#F8FAFC] transition-colors duration-200 antialiased selection:bg-amber-500/20 selection:text-[#DE8626]`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <AxiomWebVitals />
      </body>
    </html>
  );
}
