import '../shims/globals';
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../components/theme/ThemeProvider';
import { AxiomWebVitals } from 'next-axiom';

export const metadata: Metadata = {
  title: 'Menza - Smart Multi-Tenant Restaurant Suite',
  description: 'Enterprise restaurant POS, inventory, table management, KOT dispatch, and multi-outlet analytics.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#FAF7F2] dark:bg-[#111418] text-[#1E2930] dark:text-[#F3F4F6] transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <AxiomWebVitals />
      </body>
    </html>
  );
}
