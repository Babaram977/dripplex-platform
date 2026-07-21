import * as React from 'react';

import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
