import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['500', '600', '700', '800'] });
const sans = DM_Sans({ subsets: ['latin'], variable: '--font-dmsans' });

export const metadata: Metadata = {
  title: 'InstaSage',
  description: 'Production-grade social media analytics dashboard for creators. Track performance, get AI insights, and grow faster.',
};

import { Providers } from "@/components/Providers";
import { THEME_SCRIPT } from "@/lib/themeScript";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
