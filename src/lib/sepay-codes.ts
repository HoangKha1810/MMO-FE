import 'server-only';

export function extractSePayReferenceCodes(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) {
    return [] as string[];
  }

  const unique = new Set<string>();

  raw
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      unique.add(part);
    });

  return Array.from(unique);
}

export function buildSePayReferenceContent(codes: Array<string | null | undefined>) {
  const unique = new Set<string>();

  codes.forEach((value) => {
    const normalized = String(value || '').trim();
    if (normalized) {
      unique.add(normalized);
    }
  });

  return Array.from(unique).join('|');
}

export function getPrimarySePayReferenceCode(value: string | null | undefined) {
  return extractSePayReferenceCodes(value)[0] || '';
}
