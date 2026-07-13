import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PostCard } from './PostCard';
import { Button } from '@/components/ui/button';
import type { Post } from '@/types';

type RecentContentProps = {
  posts: Post[];
};

export function RecentContent({ posts }: RecentContentProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recent Content</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Your latest published posts across all platforms</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" asChild>
          <Link href="/content">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
