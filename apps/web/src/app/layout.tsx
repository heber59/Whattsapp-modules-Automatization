import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Portal } from './portal';

export const metadata: Metadata = {
  title: 'Whattsapp Automatization',
  description: 'WhatsApp order automation for Colombian businesses.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><Portal>{children}</Portal></body>
    </html>
  );
}
