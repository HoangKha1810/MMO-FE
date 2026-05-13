import fs from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { buildGameApiDocs } from '../src/lib/game-api-docs';
import { getGameApiPublicBaseUrl } from '../src/lib/game-api-public-url';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const MARGIN_Y = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

type Cursor = {
  page: PDFPage;
  y: number;
};

type Fonts = {
  body: PDFFont;
  mono: PDFFont;
};

type DocState = {
  pdf: PDFDocument;
  cursor: Cursor;
  fonts: Fonts;
};

function toRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

const colors = {
  ink: toRgb('#0f172a'),
  muted: toRgb('#475569'),
  panel: toRgb('#0f172a'),
  panelSoft: toRgb('#111827'),
  line: toRgb('#dbe3ef'),
  accent: toRgb('#2563eb'),
  successBg: toRgb('#ecfdf5'),
  successText: toRgb('#065f46'),
  noteBg: toRgb('#fff7d6'),
  noteText: toRgb('#713f12'),
  white: toRgb('#ffffff'),
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const raw = paragraph.trimEnd();
    if (!raw) {
      lines.push('');
      continue;
    }

    const words = raw.split(/\s+/);
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) {
          lines.push(current);
        }
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines;
}

function createPage(pdf: PDFDocument) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: colors.white,
  });
  return page;
}

function initDoc(pdf: PDFDocument, fonts: Fonts): DocState {
  const page = createPage(pdf);
  return {
    pdf,
    fonts,
    cursor: {
      page,
      y: PAGE_HEIGHT - MARGIN_Y,
    },
  };
}

function ensureSpace(state: DocState, neededHeight: number) {
  if (state.cursor.y - neededHeight >= MARGIN_Y) {
    return;
  }
  state.cursor.page = createPage(state.pdf);
  state.cursor.y = PAGE_HEIGHT - MARGIN_Y;
}

function moveDown(state: DocState, amount: number) {
  state.cursor.y -= amount;
}

function drawParagraph(state: DocState, text: string, options?: {
  size?: number;
  color?: ReturnType<typeof rgb>;
  lineHeight?: number;
  gapAfter?: number;
}) {
  const size = options?.size ?? 11;
  const lineHeight = options?.lineHeight ?? size * 1.55;
  const gapAfter = options?.gapAfter ?? 8;
  const font = state.fonts.body;
  const lines = wrapText(text, font, size, CONTENT_WIDTH);
  ensureSpace(state, lines.length * lineHeight + gapAfter);
  for (const line of lines) {
    state.cursor.page.drawText(line, {
      x: MARGIN_X,
      y: state.cursor.y - size,
      size,
      font,
      color: options?.color ?? colors.ink,
    });
    moveDown(state, lineHeight);
  }
  moveDown(state, gapAfter);
}

function drawHeading(state: DocState, text: string, level: 1 | 2 | 3 = 2) {
  const size = level === 1 ? 24 : level === 2 ? 17 : 13;
  const gapAfter = level === 1 ? 10 : 8;
  ensureSpace(state, size + gapAfter + 12);
  state.cursor.page.drawText(text, {
    x: MARGIN_X,
    y: state.cursor.y - size,
    size,
    font: state.fonts.body,
    color: colors.ink,
  });
  moveDown(state, size + gapAfter);
}

function drawLabel(state: DocState, text: string) {
  ensureSpace(state, 18);
  state.cursor.page.drawText(text.toUpperCase(), {
    x: MARGIN_X,
    y: state.cursor.y - 10,
    size: 9,
    font: state.fonts.body,
    color: colors.muted,
  });
  moveDown(state, 16);
}

function drawBulletList(state: DocState, items: string[], color = colors.ink, background?: ReturnType<typeof rgb>) {
  const prepared = items.map((item) => wrapText(`• ${item}`, state.fonts.body, 11, CONTENT_WIDTH - 24));
  const totalHeight = prepared.reduce((sum, lines) => sum + lines.length * 17, 0) + 18;
  ensureSpace(state, totalHeight + 8);

  const topY = state.cursor.y;
  if (background) {
    state.cursor.page.drawRectangle({
      x: MARGIN_X,
      y: topY - totalHeight,
      width: CONTENT_WIDTH,
      height: totalHeight,
      color: background,
      borderColor: colors.line,
      borderWidth: 1,
    });
  }

  const textX = MARGIN_X + 14;
  if (background) {
    moveDown(state, 12);
  }

  for (const lines of prepared) {
    for (const line of lines) {
      state.cursor.page.drawText(line, {
        x: textX,
        y: state.cursor.y - 11,
        size: 11,
        font: state.fonts.body,
        color,
      });
      moveDown(state, 17);
    }
  }

  if (background) {
    moveDown(state, 10);
  } else {
    moveDown(state, 6);
  }
}

function drawCodeBlock(state: DocState, title: string, code: string) {
  const font = state.fonts.mono;
  const titleHeight = 18;
  const codeLines = wrapText(code, font, 8.5, CONTENT_WIDTH - 26);
  const lineHeight = 11.5;
  const blockHeight = 14 + titleHeight + codeLines.length * lineHeight + 14;

  ensureSpace(state, blockHeight + 10);
  const y = state.cursor.y;

  state.cursor.page.drawRectangle({
    x: MARGIN_X,
    y: y - blockHeight,
    width: CONTENT_WIDTH,
    height: blockHeight,
    color: colors.panel,
  });

  state.cursor.page.drawRectangle({
    x: MARGIN_X,
    y: y - titleHeight - 10,
    width: CONTENT_WIDTH,
    height: titleHeight + 10,
    color: colors.panelSoft,
  });

  state.cursor.page.drawText(title.toUpperCase(), {
    x: MARGIN_X + 12,
    y: y - 18,
    size: 8.5,
    font: state.fonts.body,
    color: colors.white,
  });

  let codeY = y - 34;
  for (const line of codeLines) {
    state.cursor.page.drawText(line, {
      x: MARGIN_X + 12,
      y: codeY,
      size: 8.5,
      font,
      color: colors.white,
    });
    codeY -= lineHeight;
  }

  moveDown(state, blockHeight + 10);
}

function drawCover(state: DocState, title: string, subtitle: string, stats: Array<{ label: string; value: string }>) {
  const page = state.cursor.page;
  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - 270,
    width: CONTENT_WIDTH,
    height: 220,
    color: colors.panel,
  });

  page.drawRectangle({
    x: MARGIN_X + 14,
    y: PAGE_HEIGHT - 98,
    width: CONTENT_WIDTH - 28,
    height: 1.5,
    color: colors.accent,
  });

  page.drawText('ADMIN API DOCS', {
    x: MARGIN_X + 22,
    y: PAGE_HEIGHT - 82,
    size: 9,
    font: state.fonts.body,
    color: colors.white,
  });

  page.drawText(title, {
    x: MARGIN_X + 22,
    y: PAGE_HEIGHT - 120,
    size: 26,
    font: state.fonts.body,
    color: colors.white,
  });

  const subtitleLines = wrapText(subtitle, state.fonts.body, 11, CONTENT_WIDTH - 44);
  let subtitleY = PAGE_HEIGHT - 148;
  for (const line of subtitleLines) {
    page.drawText(line, {
      x: MARGIN_X + 22,
      y: subtitleY,
      size: 11,
      font: state.fonts.body,
      color: colors.white,
    });
    subtitleY -= 16;
  }

  const cardWidth = (CONTENT_WIDTH - 22 * 5) / 4;
  let cardX = MARGIN_X + 22;
  for (const stat of stats) {
    page.drawRectangle({
      x: cardX,
      y: PAGE_HEIGHT - 242,
      width: cardWidth,
      height: 64,
      color: colors.panelSoft,
    });
    page.drawText(stat.label.toUpperCase(), {
      x: cardX + 10,
      y: PAGE_HEIGHT - 198,
      size: 8,
      font: state.fonts.body,
      color: colors.white,
    });
    page.drawText(stat.value, {
      x: cardX + 10,
      y: PAGE_HEIGHT - 224,
      size: 12,
      font: state.fonts.body,
      color: colors.white,
    });
    cardX += cardWidth + 22;
  }

  state.cursor.y = PAGE_HEIGHT - 302;
}

async function resolveFontPath() {
  const candidates = [
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Verdana.ttf',
    path.join(process.cwd(), 'node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  throw new Error('Không tìm thấy font Unicode để tạo PDF Game API docs.');
}

async function main() {
  const docs = buildGameApiDocs(getGameApiPublicBaseUrl());
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontPath = await resolveFontPath();
  const fontBytes = await fs.readFile(fontPath);
  const bodyFont = await pdf.embedFont(fontBytes, { subset: true });

  const state = initDoc(pdf, {
    body: bodyFont,
    mono: bodyFont,
  });

  drawCover(
    state,
    'Tài Liệu Tích Hợp Game API',
    'File PDF tĩnh này dùng để đội kỹ thuật tải xuống trực tiếp từ admin, bao gồm cách kết nối, request mẫu, response mẫu và ghi chú tích hợp cho từng endpoint.',
    [
      { label: 'Base URL', value: 'api.trungtammmo.vn' },
      { label: 'Endpoints', value: String(docs.endpoints.length) },
      { label: 'Kết nối', value: String(docs.connectionMethods.length) },
      { label: 'Header', value: 'x-api-key' },
    ]
  );

  drawLabel(state, 'Auth');
  drawHeading(state, 'Cách xác thực và nguyên tắc kết nối', 2);
  drawParagraph(state, 'Mỗi account trên web có một API key riêng. Key này chỉ admin nhìn thấy và chỉ dùng trong luồng game API.', {
    color: colors.muted,
    gapAfter: 12,
  });
  drawBulletList(state, docs.authNotes, colors.noteText, colors.noteBg);

  drawLabel(state, 'Kết nối');
  drawHeading(state, 'Các cách kết nối API', 2);
  drawParagraph(state, 'Các mẫu bên dưới đủ để đội dev bên đối tác tích hợp trực tiếp vào backend hoặc dùng để test nhanh.', {
    color: colors.muted,
    gapAfter: 10,
  });

  for (const method of docs.connectionMethods) {
    drawHeading(state, method.title, 3);
    drawParagraph(state, method.description, { color: colors.muted, gapAfter: 8 });
    drawCodeBlock(state, `${method.language} example`, method.code);
  }

  ensureSpace(state, 40);
  drawLabel(state, 'Endpoints');
  drawHeading(state, 'Mẫu gửi và nhận dữ liệu theo từng API', 2);
  drawParagraph(state, 'Mỗi endpoint bên dưới đều có dữ liệu mẫu gửi vào, response thành công và response lỗi để web đối tác triển khai trực tiếp.', {
    color: colors.muted,
    gapAfter: 12,
  });

  for (const endpoint of docs.endpoints) {
    drawHeading(state, endpoint.title, 3);
    drawParagraph(state, endpoint.endpoint, {
      size: 10,
      color: colors.accent,
      gapAfter: 6,
    });
    drawParagraph(state, endpoint.description, {
      color: colors.muted,
      gapAfter: 8,
    });
    drawParagraph(state, endpoint.requestPayloadTitle, {
      size: 10,
      color: colors.ink,
      gapAfter: 4,
    });
    drawParagraph(state, endpoint.requestPayload, {
      color: colors.ink,
      gapAfter: 8,
    });
    drawCodeBlock(state, 'Request Example', endpoint.requestExample);
    drawCodeBlock(state, 'Response Example', endpoint.responseExample);
    drawCodeBlock(state, 'Error Example', endpoint.errorExample);
    drawBulletList(state, endpoint.notes, colors.successText, colors.successBg);
    moveDown(state, 4);
  }

  pdf.setTitle('TRUNGTAMMMO Game API Docs');
  pdf.setAuthor('OpenAI Codex');
  pdf.setSubject('Game API integration docs');
  pdf.setKeywords(['TRUNGTAMMMO', 'Game API', 'API Docs']);
  pdf.setProducer('pdf-lib');
  pdf.setCreator('OpenAI Codex');
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());

  const bytes = await pdf.save();
  const outputDir = path.join(process.cwd(), 'public', 'docs');
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'trungtammmo-game-api-docs.pdf');
  await fs.writeFile(outputPath, bytes);

  console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
