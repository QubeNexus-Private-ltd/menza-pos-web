import { NextRequest, NextResponse } from 'next/server';

/**
 * Production Log Ingestion Endpoint for Vercel
 * Receives client-side warnings, exceptions, and critical events,
 * and emits structured JSON to Vercel Runtime stdout/stderr.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      level = 'ERROR',
      category = 'CLIENT',
      event = 'CLIENT_EVENT',
      message = 'No message provided',
      metadata,
      errorName,
      errorMessage,
      errorStack,
      screen,
      url,
      userId,
      restaurantId,
    } = body;

    // Structured JSON log for Vercel Log Drain indexing (Axiom, Datadog, Better Stack, etc.)
    const structuredLog = {
      timestamp: new Date().toISOString(),
      service: 'menza-web',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
      vercelRegion: process.env.VERCEL_REGION || 'local',
      clientReported: true,
      level,
      category,
      event,
      message,
      metadata: metadata || undefined,
      error:
        errorName || errorMessage || errorStack
          ? {
              name: errorName,
              message: errorMessage,
              stack: errorStack,
            }
          : undefined,
      context: {
        screen,
        url,
        userId,
        restaurantId,
        clientIp: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    };

    const serialized = JSON.stringify(structuredLog);

    if (level === 'ERROR') {
      console.error(serialized);
    } else if (level === 'WARN') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'menza-web',
        level: 'ERROR',
        category: 'LOG_INGESTION',
        event: 'INGESTION_FAILURE',
        message: err?.message || 'Failed to process incoming client log',
      })
    );
    return NextResponse.json({ success: false, error: 'Invalid log payload' }, { status: 400 });
  }
}
