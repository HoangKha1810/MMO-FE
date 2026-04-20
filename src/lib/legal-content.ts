import fs from 'node:fs/promises';
import path from 'node:path';

export async function readPolicySections(folder: 'csdv' | 'csht') {
  const dir = path.join(process.cwd(), 'content', 'policies', folder);
  const files = await fs.readdir(dir).catch(() => []);
  const sections = await Promise.all(
    files
      .filter((file) => file.endsWith('.txt'))
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map(async (file) => {
        const raw = await fs.readFile(path.join(dir, file), 'utf8');
        const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const title = lines[0] || file.replace(/_/g, ' ').replace('.txt', '');
        return {
          title,
          body: lines.slice(1).join('\n\n') || raw,
        };
      })
  );

  return sections;
}
