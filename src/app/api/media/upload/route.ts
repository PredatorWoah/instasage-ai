import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireUserId, unauthorized } from '@/lib/api';

// The browser uploads photos and videos straight to Vercel Blob (files are too big to pass through a
// function); this route only hands it a short-lived permission to do so, after checking who is asking.
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'File uploads are not set up. Turn on Vercel Blob for this project (Storage tab in Vercel), redeploy, then try again.', code: 'no_blob' }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  // Vercel calls back here when an upload finishes; that call is signed, not logged in
  if (body.type === 'blob.generate-client-token' && !(await requireUserId())) return unauthorized();
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('posts/')) throw new Error('Unexpected file name.');
        return {
          allowedContentTypes: ['image/jpeg', 'video/mp4', 'video/quicktime'],
          maximumSizeInBytes: 300 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'The upload could not start.' }, { status: 400 });
  }
}
