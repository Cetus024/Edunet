import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/globals.css';
import { Providers } from '@/app/providers';

export const metadata: Metadata = {
  title: 'EduNets',
  description: 'O-Level revision, memory tracking, quizzes, concept webs, and collaborative study tools.',
  icons: {
    icon: [{ url: '/branding/spidey-icon.png', type: 'image/png' }],
    shortcut: '/branding/spidey-icon.png',
    apple: '/branding/spidey-icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
