import { NextResponse } from 'next/server';

export function GET(request: Request) {
  return NextResponse.redirect(new URL('/favicon-32x32.png?v=4', request.url), 308);
}
