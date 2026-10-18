// Shared by the server layout and the client theme hooks, so no 'use client' here
export type ThemeChoice = 'dark' | 'light' | 'system';
export const THEME_KEY = 'instasage:theme';

// Runs before the first paint (inlined in the root layout) so a light theme never flashes dark
export const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem('${THEME_KEY}')||'"dark"');if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';var c=document.documentElement.classList;c.toggle('light',t==='light');c.toggle('dark',t!=='light')}catch(e){}`;
