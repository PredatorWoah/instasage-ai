import { PostAnalyzer } from '@/components/content/PostAnalyzer';

export const metadata = { title: 'Post Analysis — InstaSage AI' };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostAnalyzer id={decodeURIComponent(id)} />;
}
