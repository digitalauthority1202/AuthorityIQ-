import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    service: 'authorityiq',
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
}
