import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Epoch milliseconds `days` days ago (kept out of components so render stays pure)
export function daysAgo(days: number) {
  return Date.now() - days * 86_400_000;
}

// Browsers still report some zones by their old names; show the current ones
const ZONE_RENAMES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
};
export function displayTimeZone(tz: string) {
  return ZONE_RENAMES[tz] ?? tz;
}
