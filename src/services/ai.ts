import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';

import { prisma } from "@/lib/auth";;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function generateInsights(userId: string) {
  const profiles = await prisma.socialProfile.findMany({ where: { userId } });
  const profileIds = profiles.map(p => p.id);

  const posts = await prisma.post.findMany({
    where: { socialProfileId: { in: profileIds } },
    orderBy: { publishedAt: 'desc' },
    take: 20
  });

  const prompt = `Analyze this social media data for an account and provide 3 key strategic insights in JSON format. Each insight should have a "title", a "description", and an "impact" (high, medium, low). Focus on why certain posts worked and what to do next.\n\nData:\n${JSON.stringify(posts)}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON safely from markdown code blocks
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to generate insights:', error);
    return [
      { title: 'Insufficient Data', description: 'We need more synced data to generate AI insights for your account.', impact: 'medium' }
    ];
  }
}
