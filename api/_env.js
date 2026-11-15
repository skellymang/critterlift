// `vercel dev` does not always hand the values in .env.local to these server
// functions. When a key is missing while running locally, read the file
// ourselves. On the deployed site the keys come from Vercel's Environment
// Variables and this does nothing.
import fs from 'node:fs';
import path from 'node:path';

let loaded = false;
export function loadLocalEnv() {
  if (loaded || process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') return;
  loaded = true;
  const candidates = [path.join(process.cwd(), '.env.local'), path.join(process.cwd(), '.env')];
  for (const file of candidates) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
      if (value && !process.env[m[1]]) process.env[m[1]] = value;
    }
  }
}
