const IGNORE_SEGMENTS = [
  'node_modules',
  '.git',
  'unpackage',
  'target',
  '.pnpm-store',
  '_jar_extract',
  'data',
];

const IGNORE_PREFIXES = ['dist', '.idea', '.vscode'];

export function shouldIgnore(absPath) {
  const normalized = absPath.replace(/\\/g, '/').toLowerCase();
  for (const seg of IGNORE_SEGMENTS) {
    if (normalized.includes(`/${seg}/`) || normalized.endsWith(`/${seg}`)) {
      return true;
    }
  }
  const base = normalized.split('/').pop() ?? '';
  for (const p of IGNORE_PREFIXES) {
    if (base === p || base.startsWith(p)) {
      return true;
    }
  }
  if (base.endsWith('.log') || base.endsWith('.tmp')) {
    return true;
  }
  return false;
}