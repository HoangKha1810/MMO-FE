import 'server-only';

const SEPAY_REFERENCE_PATTERN = /\b(?:GAMESEP\d+T\d+|SEP\d+T\d+|PAY[0-9A-Z]+)\b/gi;

function isWalletMarker(value: string) {
  return /^WALLET:/i.test(value.trim());
}

function isSePayReferenceCode(value: string) {
  return /^(?:GAMESEP\d+T\d+|SEP\d+T\d+|PAY[0-9A-Z]+)$/i.test(value.trim());
}

function prioritizeSePayCodes(codes: string[]) {
  return codes.sort((left, right) => {
    const leftIsPay = /^PAY/i.test(left);
    const rightIsPay = /^PAY/i.test(right);
    if (leftIsPay !== rightIsPay) return leftIsPay ? -1 : 1;
    return 0;
  });
}

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

export function extractSePayPaymentReferenceCodes(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) {
    return [] as string[];
  }

  const unique = new Set<string>();

  extractSePayReferenceCodes(raw).forEach((part) => {
    if (!isWalletMarker(part) && isSePayReferenceCode(part)) {
      unique.add(part);
    }
  });

  raw.match(SEPAY_REFERENCE_PATTERN)?.forEach((matched) => {
    unique.add(matched);
  });

  return prioritizeSePayCodes(Array.from(unique));
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
  return extractSePayPaymentReferenceCodes(value)[0] || extractSePayReferenceCodes(value).find((code) => !isWalletMarker(code)) || '';
}
