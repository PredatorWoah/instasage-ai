import type { MetadataRoute } from 'next';

// Lets phones and desktops install InstaSage as an app (and is required for push on iPhone)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'InstaSage',
    short_name: 'InstaSage',
    description: 'Your Instagram and YouTube numbers, AI insights and ideas.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0A0A0F',
    theme_color: '#0A0A0F',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Ideas', url: '/recommendations', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Content', url: '/content', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Analytics', url: '/analytics', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
