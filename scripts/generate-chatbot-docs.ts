import { promises as fs } from 'fs';
import path from 'path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import { chatbotDocumentDefinitions } from '../src/lib/chatbot-knowledge';

type FontSet = {
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>;
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 46;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 46;
const MAX_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const PRISMA_ASSETS_DIR = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'public', 'assets');

function stripMarkdown(line: string) {
  return line
    .replace(/^#{1,3}\s+/, '')
    .replace(/^-\s+/, '• ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function wrapText(text: string, font: FontSet['regular'], size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);
    if (width <= maxWidth || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

async function createDocumentPdf(input: {
  title: string;
  summary: string;
  markdown: string;
  outputPath: string;
}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFontBytes = await getBundledInterFontBytes(['inter-all-400-normal.', 'inter-vietnamese-400-normal.']);
  const boldFontBytes = await getBundledInterFontBytes(['inter-all-600-normal.', 'inter-vietnamese-600-normal.']);
  const regular = await pdfDoc.embedFont(regularFontBytes, { subset: true });
  const bold = await pdfDoc.embedFont(boldFontBytes, { subset: true });
  const fonts: FontSet = { regular, bold };

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  function ensureSpace(requiredHeight: number) {
    if (cursorY - requiredHeight >= MARGIN_BOTTOM) {
      return;
    }

    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN_TOP;
  }

  function drawTextBlock(text: string, options: { size: number; lineHeight: number; color?: ReturnType<typeof rgb>; bold?: boolean; indent?: number }) {
    const font = options.bold ? fonts.bold : fonts.regular;
    const lines = wrapText(text, font, options.size, MAX_WIDTH - (options.indent || 0));
    ensureSpace(lines.length * options.lineHeight + 6);

    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN_X + (options.indent || 0),
        y: cursorY,
        size: options.size,
        font,
        color: options.color || rgb(0.16, 0.18, 0.23),
      });
      cursorY -= options.lineHeight;
    }
  }

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 138,
    width: PAGE_WIDTH,
    height: 138,
    color: rgb(0.05, 0.09, 0.16),
  });

  cursorY = PAGE_HEIGHT - 70;
  drawTextBlock(input.title, {
    size: 22,
    lineHeight: 28,
    color: rgb(1, 1, 1),
    bold: true,
  });
  cursorY -= 10;
  drawTextBlock(input.summary, {
    size: 11,
    lineHeight: 16,
    color: rgb(0.8, 0.86, 0.98),
  });

  cursorY -= 36;

  const lines = input.markdown.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      cursorY -= 8;
      continue;
    }

    if (line.startsWith('# ')) {
      cursorY -= 8;
      drawTextBlock(stripMarkdown(line), {
        size: 18,
        lineHeight: 24,
        bold: true,
        color: rgb(0.05, 0.09, 0.16),
      });
      cursorY -= 2;
      continue;
    }

    if (line.startsWith('## ')) {
      cursorY -= 6;
      drawTextBlock(stripMarkdown(line), {
        size: 14,
        lineHeight: 20,
        bold: true,
        color: rgb(0.11, 0.25, 0.68),
      });
      continue;
    }

    if (line.startsWith('### ')) {
      drawTextBlock(stripMarkdown(line), {
        size: 12,
        lineHeight: 18,
        bold: true,
        color: rgb(0.12, 0.14, 0.19),
      });
      continue;
    }

    if (line.startsWith('- ')) {
      drawTextBlock(stripMarkdown(line), {
        size: 10.5,
        lineHeight: 15,
        indent: 8,
      });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      drawTextBlock(stripMarkdown(line), {
        size: 10.5,
        lineHeight: 15,
      });
      continue;
    }

    drawTextBlock(stripMarkdown(line), {
      size: 10.5,
      lineHeight: 15.5,
    });
  }

  const pdfBytes = await pdfDoc.save();
  await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
  await fs.writeFile(input.outputPath, pdfBytes);
}

async function getBundledInterFontBytes(prefixes: string[]) {
  const assetNames = await fs.readdir(PRISMA_ASSETS_DIR);

  for (const prefix of prefixes) {
    const matchedAsset = assetNames.find((assetName) => assetName.startsWith(prefix));
    if (matchedAsset) {
      return fs.readFile(path.join(PRISMA_ASSETS_DIR, matchedAsset));
    }
  }

  throw new Error(`Không tìm thấy font Inter phù hợp trong ${PRISMA_ASSETS_DIR}.`);
}

async function main() {
  for (const doc of chatbotDocumentDefinitions) {
    const markdown = await fs.readFile(doc.sourcePath, 'utf8');
    await createDocumentPdf({
      title: doc.title,
      summary: doc.summary,
      markdown,
      outputPath: doc.pdfPath,
    });
    console.log(`Generated ${path.relative(process.cwd(), doc.pdfPath)}`);
  }
}

void main();
