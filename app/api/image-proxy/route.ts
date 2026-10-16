import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url.trim(), {
      signal: controller.signal,
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream HTTP ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType.split(';')[0]};base64,${base64}`;

    return NextResponse.json(
      { dataUrl },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch image' }, { status: 500 });
  }
}
