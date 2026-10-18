import Link from 'next/link';

export const metadata = { title: 'Not found · InstaSage' };

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-[30px] bg-card border border-ink/[0.06] p-6 sm:p-8 space-y-4 text-center">
        <p className="font-display font-extrabold text-[64px] leading-none prism-text">404</p>
        <h1 className="text-2xl font-bold">Nothing here</h1>
        <p className="text-sm text-muted-foreground">This page doesn&apos;t exist, or the post was removed on the platform and dropped out at the last sync.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/" className="inline-flex items-center h-11 px-5 rounded-full bg-ink text-background text-sm font-bold">Overview</Link>
          <Link href="/content" className="inline-flex items-center h-11 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-sm font-bold">Content</Link>
        </div>
      </div>
    </div>
  );
}
