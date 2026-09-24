import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';

const NO_DATA_INSIGHT = [
  { title: 'Insufficient Data', description: 'We need more synced data to generate AI insights for your account.', impact: 'medium' },
];

export async function generateInsights(userId: string) {
  const profiles = await prisma.socialProfile.findMany({ where: { userId } });
  const profileIds = profiles.map(p => p.id);

  const posts = await prisma.post.findMany({
    where: { socialProfileId: { in: profileIds } },
    orderBy: { publishedAt: 'desc' },
    take: 20
  });

  // Skip the Gemini round trip when there is nothing to analyze or no key configured
  if (posts.length === 0 || !process.env.GEMINI_API_KEY) return NO_DATA_INSIGHT;

  const prompt = `Analyze this social media data for an account and provide 3 key strategic insights in JSON format. Each insight should have a "title", a "description", and an "impact" (high, medium, low). Focus on why certain posts worked and what to do next.\n\nData:\n${JSON.stringify(posts)}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON safely from markdown code blocks
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to generate insights:', error);
    return NO_DATA_INSIGHT;
  }
}
