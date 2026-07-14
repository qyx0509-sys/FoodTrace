import { readFile } from 'node:fs/promises';

const requiredJsonFiles = [
  'project.config.example.json',
  'miniprogram/app.json',
  'miniprogram/sitemap.json',
  'miniprogram/pages/home/index.json',
];

for (const path of requiredJsonFiles) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  JSON.parse(source);
}

process.stdout.write(`Validated ${requiredJsonFiles.length} miniprogram JSON files.\n`);
