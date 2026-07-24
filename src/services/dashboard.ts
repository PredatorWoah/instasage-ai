import { PrismaClient } from '@prisma/client';
import { prisma } from "@/lib/auth";;

export async function getDashboardData(userId: string) {
  const profiles = await prisma.socialProfile.findMany({ where: { userId } });
  const profileIds = profiles.map(p => p.id);

  const posts = await prisma.post.findMany({
    where: { socialProfileId: { in: profileIds } },
    orderBy: { publishedAt: 'desc' },
    take: 10,
    include: { socialProfile: true }
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const metrics = await prisma.metric.findMany({
    where: {
      socialProfileId: { in: profileIds },
      date: { gte: thirtyDaysAgo }
    },
    orderBy: { date: 'asc' }
  });

  // Calculate KPIs
  const totalFollowers = profiles.reduce((sum, p) => sum + p.followerCount, 0);
  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const avgEngagement = posts.length > 0 ? posts.reduce((sum, p) => sum + p.performanceScore, 0) / posts.length : 0;

  return { profiles, posts, metrics, kpis: { followers: totalFollowers, views: totalViews, engagement: avgEngagement } };
}
