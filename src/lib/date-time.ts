const databaseDatePattern =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function partsFromDatabaseDate(value: Date) {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
    hour: value.getUTCHours(),
    minute: value.getUTCMinutes(),
    second: value.getUTCSeconds(),
  };
}

export function serializeDatabaseDateTime(value: unknown) {
  if (value instanceof Date) {
    const parts = partsFromDatabaseDate(value);
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  }

  const raw = String(value ?? '').trim();
  const match = raw.match(databaseDatePattern);
  if (!match) return raw;

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
