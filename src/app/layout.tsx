import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sorted — Evidence-first recruiting',
  description: 'An AI screening workspace for Indian hiring teams, built with Sarvam AI.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
