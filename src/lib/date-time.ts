const databaseDatePattern =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const databaseDateHasTimezonePattern = /(Z|[+-]\d{2}:?\d{2})$/i;
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function partsFromDatabaseDate(value: Date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(value);
  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '00';

  return {
    year: Number(lookup('year')),
    month: Number(lookup('month')),
    day: Number(lookup('day')),
    hour: Number(lookup('hour')),
    minute: Number(lookup('minute')),
    second: Number(lookup('second')),
  };
}

function formatDateParts(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function serializeDatabaseDateTime(value: unknown) {
  if (value instanceof Date) {
    return formatDateParts(partsFromDatabaseDate(value));
  }

  const raw = String(value ?? '').trim();
  const match = raw.match(databaseDatePattern);
  if (!match) return raw;

  if (databaseDateHasTimezonePattern.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateParts(partsFromDatabaseDate(parsed));
    }
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function formatDatabaseDateTime(value: unknown) {
  const serialized = serializeDatabaseDateTime(value);
  const match = serialized.match(databaseDatePattern);
  if (!match) return serialized;

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
}

export function formatDatabaseDate(value: unknown) {
  const serialized = serializeDatabaseDateTime(value);
  const match = serialized.match(databaseDatePattern);
  if (!match) return serialized;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function formatDatabaseTime(value: unknown) {
  const serialized = serializeDatabaseDateTime(value);
  const match = serialized.match(databaseDatePattern);
  if (!match) return serialized;

  const [, , , , hour = '00', minute = '00', second = '00'] = match;
  return `${hour}:${minute}:${second}`;
}
