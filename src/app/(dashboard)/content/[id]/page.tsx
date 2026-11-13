import { PostAnalyzer } from '@/components/content/PostAnalyzer';

export const metadata = { title: 'Post Analysis' };

// ?vs=<post id> opens straight into Compare against that post
export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vs?: string | string[] }> }) {
  const { id } = await params;
  const { vs } = await searchParams;
  // Keyed by post, so flipping to the next one starts fresh instead of showing the last post meanwhile
  return <PostAnalyzer key={id} id={decodeURIComponent(id)} vs={typeof vs === 'string' ? vs : undefined} />;
}
