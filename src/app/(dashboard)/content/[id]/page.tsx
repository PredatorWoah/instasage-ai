import { PostAnalyzer } from '@/components/content/PostAnalyzer';

export const metadata = { title: 'Post Analysis · InstaSage' };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Keyed by post, so flipping to the next one starts fresh instead of showing the last post meanwhile
  return <PostAnalyzer key={id} id={decodeURIComponent(id)} />;
}
