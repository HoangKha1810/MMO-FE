import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function extractFacebookId(url: string) {
  const patterns = [
    /(?:profile\.php\?id=|facebook\.com\/)(\d{6,})/i,
    /(?:groups|posts|photos|videos|permalink|story\.php\?story_fbid=|fbid=)\/?(\d{6,})/i,
    /[?&](?:id|fbid|story_fbid)=(\d{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = String(body.url || '').trim();

    if (!url) {
      return NextResponse.json({ success: false, message: 'Vui lòng nhập link.' }, { status: 400 });
    }

    if (/facebook\.com|fb\.com|fb\.watch/i.test(url)) {
      const uid = extractFacebookId(url);

      if (uid) {
        return NextResponse.json({ success: true, uid, id: uid, platform: 'Facebook' });
      }
    }

    const tiktok = url.match(/tiktok\.com\/@([a-zA-Z0-9._-]+)/i);
    if (tiktok?.[1]) {
      return NextResponse.json({ success: true, id: `@${tiktok[1]}`, platform: 'TikTok' });
    }

    const instagram = url.match(/instagram\.com\/([a-zA-Z0-9._-]+)/i);
    if (instagram?.[1] && !['p', 'reels', 'reel', 'stories'].includes(instagram[1])) {
      return NextResponse.json({ success: true, id: instagram[1], platform: 'Instagram' });
    }

    const twitter = url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9._-]+)/i);
    if (twitter?.[1] && !['home', 'explore', 'notifications', 'messages'].includes(twitter[1])) {
      return NextResponse.json({ success: true, id: twitter[1], platform: 'Twitter' });
    }

    return NextResponse.json({
      success: false,
      message: 'Không thể nhận diện ID từ liên kết này.',
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Payload không hợp lệ' }, { status: 400 });
  }
}
