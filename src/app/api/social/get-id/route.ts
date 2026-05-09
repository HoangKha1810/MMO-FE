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

function normalizeFacebookUrl(url: string) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const normalized = new URL(raw);
    normalized.search = '';
    return normalized.toString().replace(/\/+$/, '');
  } catch {
    return raw.split('?')[0]?.replace(/\/+$/, '') || raw;
  }
}

async function postForm(requestUrl: string, body: Record<string, string>, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers,
      },
      body: new URLSearchParams(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFacebookUid(url: string) {
  const originalUrl = String(url || '').trim();
  const cleanedUrl = normalizeFacebookUrl(originalUrl);

  const directUid = extractFacebookId(originalUrl) || extractFacebookId(cleanedUrl);
  if (directUid) {
    return directUid;
  }

  try {
    const tdsResponse = await postForm(
      'https://id.traodoisub.com/api.php',
      { link: originalUrl },
      { Referer: 'https://id.traodoisub.com/' }
    );
    if (tdsResponse) {
      const payload = JSON.parse(tdsResponse) as { id?: string | number };
      const candidate = String(payload?.id || '').trim();
      if (/^\d{6,}$/.test(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Fallback below.
  }

  try {
    const atpResponse = await postForm('https://id.atpsoftware.vn/api/getUID', { link: originalUrl });
    if (atpResponse) {
      try {
        const payload = JSON.parse(atpResponse) as { id?: string | number };
        const candidate = String(payload?.id || '').trim();
        if (/^\d{6,}$/.test(candidate)) {
          return candidate;
        }
      } catch {
        const cleaned = atpResponse.trim();
        if (/^\d{6,}$/.test(cleaned)) {
          return cleaned;
        }
      }
    }
  } catch {
    // Final failure handled by caller.
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
      const uid = await resolveFacebookUid(url);

      if (uid) {
        return NextResponse.json({ success: true, uid, id: uid, platform: 'Facebook' });
      }

      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy UID. Hãy đảm bảo link công khai hoặc thử lại sau.',
      });
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
