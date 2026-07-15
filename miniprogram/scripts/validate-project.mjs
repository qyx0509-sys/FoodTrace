import { access, readFile } from 'node:fs/promises';

const requiredJsonFiles = [
  'project.config.example.json',
  'miniprogram/app.json',
  'miniprogram/sitemap.json',
  'miniprogram/pages/login/index.json',
  'miniprogram/pages/home/index.json',
  'miniprogram/pages/store-search/index.json',
  'miniprogram/pages/store-detail/index.json',
  'miniprogram/pages/check-in-editor/index.json',
  'miniprogram/pages/records/index.json',
  'miniprogram/pages/record-detail/index.json',
  'miniprogram/pages/daily-journal/index.json',
  'miniprogram/pages/profile/index.json',
];

const requiredComponents = [
  'components/empty-state/index',
  'components/food-card/index',
  'components/journal-poster/index',
  'components/primary-button/index',
  'components/quick-action-card/index',
  'components/status-summary-card/index',
];

let appConfig;

for (const path of requiredJsonFiles) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const parsed = JSON.parse(source);
  if (path === 'miniprogram/app.json') {
    appConfig = parsed;
  }
}

if (appConfig === undefined || !Array.isArray(appConfig.pages)) {
  throw new Error('miniprogram/app.json must declare a pages array.');
}

const pageExtensions = ['.json', '.ts', '.wxml', '.wxss'];
for (const pagePath of appConfig.pages) {
  if (typeof pagePath !== 'string' || pagePath.length === 0) {
    throw new Error('Every miniprogram page path must be a non-empty string.');
  }
  for (const extension of pageExtensions) {
    await access(new URL(`../miniprogram/${pagePath}${extension}`, import.meta.url));
  }

  const pageScript = await readFile(
    new URL(`../miniprogram/${pagePath}.ts`, import.meta.url),
    'utf8',
  );
  const pageTemplate = await readFile(
    new URL(`../miniprogram/${pagePath}.wxml`, import.meta.url),
    'utf8',
  );
  const eventBindings = pageTemplate.matchAll(
    /\b(?:bind|catch)(?::|[a-z-])*="([A-Za-z_$][\w$]*)"/g,
  );
  for (const binding of eventBindings) {
    const handler = binding[1];
    if (handler !== undefined && !new RegExp(`\\b${handler}\\s*\\(`).test(pageScript)) {
      throw new Error(`${pagePath}.wxml binds missing handler ${handler}.`);
    }
  }

  for (const source of [pageScript, pageTemplate]) {
    const routeReferences = source.matchAll(/\/pages\/[a-z0-9-]+\/index/g);
    for (const reference of routeReferences) {
      const route = reference[0].slice(1);
      if (!appConfig.pages.includes(route)) {
        throw new Error(`${pagePath} references unregistered route ${route}.`);
      }
    }
  }
}

for (const componentPath of requiredComponents) {
  for (const extension of pageExtensions) {
    await access(new URL(`../miniprogram/${componentPath}${extension}`, import.meta.url));
  }
}

process.stdout.write(
  `Validated ${requiredJsonFiles.length} miniprogram JSON files, ${appConfig.pages.length} page bundles, and ${requiredComponents.length} component bundles.\n`,
);
