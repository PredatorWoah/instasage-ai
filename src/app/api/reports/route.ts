import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

import { prisma } from "@/lib/auth";;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'csv';

  const profiles = await prisma.socialProfile.findMany({ where: { userId: session.user.id } });
  const profileIds = profiles.map(p => p.id);

  const posts = await prisma.post.findMany({
    where: { socialProfileId: { in: profileIds } },
    include: { socialProfile: true }
  });

  if (type === 'csv') {
    const data = posts.map(p => ({
      platform: p.platform,
      account: p.socialProfile.displayName,
      type: p.type,
      caption: p.caption,
      publishedAt: p.publishedAt.toISOString(),
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      score: p.performanceScore
    }));

    const csv = Papa.unparse(data);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="report.csv"'
      }
    });
  }

  // Simplified response for PDF/PPTX generation requests which typically require client-side libs or heavier server setup
  return NextResponse.json({ error: 'Unsupported format in this demo route' }, { status: 400 });
}
