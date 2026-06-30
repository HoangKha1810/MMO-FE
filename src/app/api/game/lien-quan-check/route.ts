import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { db } from '@/lib/db';

// Register stealth plugin
chromium.use(stealthPlugin());

export const dynamic = 'force-dynamic';

async function getUserId() {
  return getVerifiedSessionUserId();
}

interface CheckedAccount {
  username: string;
  password: string;
  'TÌNH TRẠNG': string;
  UID?: string;
  NAME?: string;
  LEVEL?: string;
  RANK?: string;
  TƯỚNG?: string;
  SKIN?: string;
  VIP?: string;
  VÀNG?: string;
}

async function solveSliderCaptcha(page: any) {
  try {
    const iframeElement = await page.waitForSelector('iframe[src*="captcha-delivery.com"]', { timeout: 6000 }).catch(() => null);
    if (!iframeElement) return;

    console.log('Detected Garena DataDome Captcha iframe. Attempting auto-solve...');
    const frame = await iframeElement.contentFrame();
    if (!frame) return;

    const slider = await frame.waitForSelector('div.slider', { timeout: 5000 }).catch(() => null);
    if (!slider) return;

    const sliderBox = await slider.boundingBox();
    if (!sliderBox) return;

    const container = await frame.waitForSelector('div.sliderContainer').catch(() => null);
    const containerBox = container ? await container.boundingBox() : null;
    const dragDistance = containerBox ? (containerBox.width - sliderBox.width - 5) : 260;

    const startX = sliderBox.x + sliderBox.width / 2;
    const startY = sliderBox.y + sliderBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();

    const steps = 25;
    for (let i = 1; i <= steps; i++) {
      const x = startX + (dragDistance * i) / steps;
      const y = startY + (Math.random() * 4 - 2);
      await page.mouse.move(x, y);
      await page.waitForTimeout(60 + Math.random() * 50);
    }

    await page.mouse.up();
    console.log('Auto-dragged captcha slider.');
    await page.waitForTimeout(4000);
  } catch (err) {
    console.error('Error during auto-captcha solving:', err);
  }
}

async function checkAccount(username: string, password: string): Promise<CheckedAccount> {
  const result: CheckedAccount = {
    username,
    password,
    'TÌNH TRẠNG': 'ACC DIE',
  };

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    await page.goto('https://kientuong.lienquan.garena.vn/', { timeout: 40000 });
    await page.waitForTimeout(3000);

    // Click Login
    await page.click('a[href*="platform=1"]');
    await page.waitForSelector("input[placeholder*='Tài khoản Garena']", { timeout: 20000 });

    // Fill credentials
    await page.fill("input[placeholder*='Tài khoản Garena']", username);
    await page.waitForTimeout(800);
    await page.fill("input[placeholder*='Mật khẩu']", password);
    await page.waitForTimeout(800);

    // Submit
    await page.click("button:has-text('Đăng Nhập Ngay'), button.primary");

    // Wait and check if captcha pops up
    await page.waitForTimeout(3000);
    await solveSliderCaptcha(page);

    // Wait for redirect back to kientuong site (up to 90 seconds for user captcha resolution if auto-solve failed)
    let redirected = false;
    for (let i = 0; i < 90; i++) {
      const currentUrl = page.url();
      if (currentUrl.includes('kientuong.lienquan.garena.vn') && !currentUrl.includes('auth.garena.com')) {
        redirected = true;
        break;
      }
      await solveSliderCaptcha(page);
      await page.waitForTimeout(1000);
    }

    if (redirected) {
      await page.waitForTimeout(5000); // let it fully load
      const content = await page.content();
      result['TÌNH TRẠNG'] = 'ACC FULL';

      // Scrape stats using regexes
      const uidMatch = content.match(/"uid"\s*:\s*"?(\d+)"?|\buid\s*:\s*"?(\d+)"?|UID\s*:\s*(\d+)/i);
      if (uidMatch) {
        result.UID = uidMatch[1] || uidMatch[2] || uidMatch[3];
      }

      const nameMatch = content.match(/"nickname"\s*:\s*"([^"]+)"|"name"\s*:\s*"([^"]+)"|NAME\s*:\s*([^|]+)/i);
      if (nameMatch) {
        result.NAME = (nameMatch[1] || nameMatch[2] || nameMatch[3]).trim();
      }

      const levelMatch = content.match(/"level"\s*:\s*"?(\d+)"?|LEVEL\s*:\s*(\d+)/i);
      if (levelMatch) {
        result.LEVEL = levelMatch[1] || levelMatch[2];
      }

      const rankMatch = content.match(/"rank"\s*:\s*"([^"]+)"|RANK\s*:\s*([^|]+)/i);
      if (rankMatch) {
        result.RANK = (rankMatch[1] || rankMatch[2]).trim();
      }

      const heroMatch = content.match(/"hero_count"\s*:\s*"?(\d+)"?|"heros"\s*:\s*"?(\d+)"?|TƯỚNG\s*:\s*(\d+)/i);
      if (heroMatch) {
        result.TƯỚNG = heroMatch[1] || heroMatch[2] || heroMatch[3];
      }

      const skinMatch = content.match(/"skin_count"\s*:\s*"?(\d+)"?|"skins"\s*:\s*"?(\d+)"?|SKIN\s*:\s*(\d+)/i);
      if (skinMatch) {
        result.SKIN = skinMatch[1] || skinMatch[2] || skinMatch[3];
      }

      const vipMatch = content.match(/"vip"\s*:\s*"?(\d+)"?|VIP\s*:\s*(\d+)/i);
      if (vipMatch) {
        result.VIP = vipMatch[1] || vipMatch[2];
      }

      const goldMatch = content.match(/"gold"\s*:\s*"?(\d+)"?|VÀNG\s*:\s*(\d+)/i);
      if (goldMatch) {
        result.VÀNG = goldMatch[1] || goldMatch[2];
      }
    }
  } catch (err) {
    console.error(`Error checking ${username}:`, err);
  } finally {
    await browser.close();
  }

  return result;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Check lock auto check skins
  const isLocked = await db.settings.findFirst({
    where: { setting_key: 'disable_lien_quan_auto_check' },
  });
  if (isLocked?.setting_value === 'true') {
    return NextResponse.json(
      { success: false, message: 'Tính năng Auto Check Skins hiện đang bị Admin tạm khóa.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => null) as { accounts?: { username: string; password: string }[] } | null;
    const accounts = body?.accounts || [];

    if (!accounts.length) {
      return NextResponse.json({ success: false, message: 'Vui lòng cung cấp danh sách tài khoản cần check.' }, { status: 400 });
    }

    if (accounts.length > 5) {
      return NextResponse.json({ success: false, message: 'Chỉ hỗ trợ check tối đa 5 tài khoản cùng lúc trên giao diện web để tránh quá tải.' }, { status: 400 });
    }

    const results: CheckedAccount[] = [];
    for (const acc of accounts) {
      if (acc.username && acc.password) {
        const res = await checkAccount(acc.username, acc.password);
        results.push(res);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Đã check skins thành công!',
      results,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể thực hiện check skins.' },
      { status: 500 },
    );
  }
}
