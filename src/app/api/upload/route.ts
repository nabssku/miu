import { NextRequest, NextResponse } from 'next/server';
import { uploadMediaToServerCloud } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file) {
        return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 });
      }
      if (typeof file === 'string') {
        const result = await uploadMediaToServerCloud(file);
        return NextResponse.json(result);
      }
      const result = await uploadMediaToServerCloud(file);
      return NextResponse.json(result);
    }

    const body = (await req.json()) as { dataUrl?: string };
    if (!body?.dataUrl) {
      return NextResponse.json({ error: 'Data gambar tidak ditemukan.' }, { status: 400 });
    }
    const result = await uploadMediaToServerCloud(body.dataUrl);
    return NextResponse.json(result);
  } catch (err) {
    console.warn('[API /upload POST] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengunggah media ke Cloud Catatan.' },
      { status: 500 }
    );
  }
}
