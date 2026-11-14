'use client';

import { upload } from '@vercel/blob/client';
import type { PostKind } from '@/services/publish';

// Photos go to Instagram as JPEG, within the shapes the feed accepts (4:5 tall to 1.91:1 wide).
// Anything outside that is centre-cropped here, so Instagram never rejects it for its shape.
const FEED_MIN = 4 / 5;
const FEED_MAX = 1.91;
const MAX_WIDTH = 1440;

export const MAX_VIDEO_BYTES = { story: 100 * 1024 * 1024, other: 300 * 1024 * 1024 };

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This browser cannot open that photo. HEIC photos from an iPhone open in Safari; elsewhere, save it as JPEG or PNG first.'));
    };
    img.src = url;
  });
}

export async function prepareImage(file: File, kind: PostKind): Promise<{ blob: Blob; cropped: boolean }> {
  const img = await loadImage(file);
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  let cropped = false;
  if (kind !== 'story') {
    const ratio = sw / sh;
    if (ratio < FEED_MIN) {
      const h = Math.round(sw / FEED_MIN);
      sy = Math.round((sh - h) / 2);
      sh = h;
      cropped = true;
    } else if (ratio > FEED_MAX) {
      const w = Math.round(sh * FEED_MAX);
      sx = Math.round((sw - w) / 2);
      sw = w;
      cropped = true;
    }
  }
  const scale = Math.min(1, MAX_WIDTH / sw);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not prepare the photo.');
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
  if (!blob) throw new Error('This browser could not prepare the photo.');
  return { blob, cropped };
}

const safeName = (name: string) => name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';

// Straight from the browser to Vercel Blob: the server only signs the upload
export async function uploadFile(blob: Blob, name: string, ext: string, onProgress: (pct: number) => void) {
  const result = await upload(`posts/${safeName(name)}.${ext}`, blob, {
    access: 'public',
    handleUploadUrl: '/api/media/upload',
    contentType: blob.type,
    multipart: blob.size > 20 * 1024 * 1024,
    onUploadProgress: (e) => onProgress(Math.round(e.percentage)),
  });
  return result.url;
}
