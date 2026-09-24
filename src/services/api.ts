/**
 * API Service Layer
 * All functions currently return mock data.
 * Replace imports and return values with real fetch/axios calls when integrating a backend.
 */
import type { AudienceData, Competitor } from '@/types';
import { mockAudienceData } from '@/data/mockAudience';
import { mockCompetitors } from '@/data/mockCompetitors';

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchAudienceData(): Promise<AudienceData> {
  await delay();
  return mockAudienceData;
}

export async function fetchCompetitors(): Promise<Competitor[]> {
  await delay();
  return mockCompetitors;
}
