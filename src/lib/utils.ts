import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Epoch milliseconds `days` days ago (kept out of components so render stays pure)
export function daysAgo(days: number) {
  return Date.now() - days * 86_400_000;
}
