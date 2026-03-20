import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'WMS Pro',
  description: 'Warehouse Management System',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
