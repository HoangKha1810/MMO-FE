import { promises as fs } from 'fs';
import path from 'path';

export interface ChatbotDocumentDefinition {
  id: string;
  title: string;
  summary: string;
  sourcePath: string;
  pdfPath: string;
  downloadUrl: string;
}

export interface ChatbotDocument extends ChatbotDocumentDefinition {
  content: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  heading: string;
  content: string;
  score: number;
}

const DOCS_ROOT = path.join(process.cwd(), 'content', 'chatbot-docs');
const PDF_ROOT = path.join(process.cwd(), 'public', 'docs', 'chatbot');

export const chatbotDocumentDefinitions: ChatbotDocumentDefinition[] = [
  {
    id: 'tong-quan',
    title: 'TRUNGTAMMMO: Tổng quan nền tảng và hệ sinh thái dịch vụ',
    summary: 'Giới thiệu TRUNGTAMMMO, các module, dịch vụ chính, định vị và cách sử dụng tổng quát.',
    sourcePath: path.join(DOCS_ROOT, '01-trungtammmo-tong-quan.md'),
    pdfPath: path.join(PDF_ROOT, '01-trungtammmo-tong-quan.pdf'),
    downloadUrl: '/docs/chatbot/01-trungtammmo-tong-quan.pdf',
  },
  {
    id: 'mua-hang-va-thanh-toan',
    title: 'TRUNGTAMMMO: Hướng dẫn mua dịch vụ, tài nguyên, VPS và nạp tiền',
    summary: 'Hướng dẫn chi tiết cách nạp tiền, mua SMM, mua tài nguyên MMO, đặt VPS và theo dõi đơn hàng.',
    sourcePath: path.join(DOCS_ROOT, '02-huong-dan-mua-va-thanh-toan.md'),
    pdfPath: path.join(PDF_ROOT, '02-huong-dan-mua-va-thanh-toan.pdf'),
    downloadUrl: '/docs/chatbot/02-huong-dan-mua-va-thanh-toan.pdf',
  },
  {
    id: 'faq-bao-mat-ho-tro',
    title: 'TRUNGTAMMMO: FAQ, bảo mật, vận hành và hỗ trợ',
    summary: 'Tổng hợp câu hỏi thường gặp, lưu ý bảo mật, cách liên hệ hỗ trợ và quy tắc sử dụng chatbot.',
    sourcePath: path.join(DOCS_ROOT, '03-faq-ho-tro-bao-mat.md'),
    pdfPath: path.join(PDF_ROOT, '03-faq-ho-tro-bao-mat.pdf'),
    downloadUrl: '/docs/chatbot/03-faq-ho-tro-bao-mat.pdf',
  },
];

let docsCache: ChatbotDocument[] | null = null;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function splitMarkdownIntoChunks(document: ChatbotDocument): KnowledgeChunk[] {
  const lines = document.content.split(/\r?\n/);
  const chunks: KnowledgeChunk[] = [];
  let currentHeading = document.title;
  let buffer: string[] = [];
  let sectionIndex = 0;

  function flushChunk() {
    const content = buffer.join('\n').trim();
    if (!content) {
      return;
    }

    sectionIndex += 1;
    chunks.push({
      id: `${document.id}-${sectionIndex}`,
      documentId: document.id,
      documentTitle: document.title,
      heading: currentHeading,
      content,
      score: 0,
    });
    buffer = [];
  }

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line.trim())) {
      flushChunk();
      currentHeading = line.replace(/^#{1,3}\s+/, '').trim();
      continue;
    }
    buffer.push(line);
  }

  flushChunk();
  return chunks;
}

export async function getChatbotDocuments() {
  if (docsCache) {
    return docsCache;
  }

  const docs = await Promise.all(
    chatbotDocumentDefinitions.map(async (doc) => ({
      ...doc,
      content: await fs.readFile(doc.sourcePath, 'utf8'),
    }))
  );

  docsCache = docs;
  return docs;
}

export function getChatbotDocumentCatalog() {
  return chatbotDocumentDefinitions.map((doc) => ({
    id: doc.id,
    title: doc.title,
    summary: doc.summary,
    downloadUrl: doc.downloadUrl,
  }));
}

export async function retrieveKnowledgeChunks(query: string, limit = 6) {
  const docs = await getChatbotDocuments();
  const queryTokens = tokenize(query);
  const chunks = docs.flatMap(splitMarkdownIntoChunks);

  const scored = chunks
    .map((chunk) => {
      const haystack = normalizeText(`${chunk.heading}\n${chunk.content}`);
      let score = 0;

      for (const token of queryTokens) {
        if (haystack.includes(token)) {
          score += token.length > 5 ? 3 : 2;
        }
      }

      const headingTokens = tokenize(chunk.heading);
      for (const token of queryTokens) {
        if (headingTokens.includes(token)) {
          score += 4;
        }
      }

      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.content.length - b.content.length)
    .slice(0, limit);

  if (scored.length > 0) {
    return scored;
  }

  return chunks.slice(0, Math.max(1, Math.min(limit, 4))).map((chunk, index) => ({
    ...chunk,
    score: limit - index,
  }));
}

export async function buildKnowledgeContext(query: string, limit = 6) {
  const chunks = await retrieveKnowledgeChunks(query, limit);
  return chunks
    .map(
      (chunk, index) =>
        `[Nguon ${index + 1}] ${chunk.documentTitle} :: ${chunk.heading}\n${chunk.content}`
    )
    .join('\n\n');
}
