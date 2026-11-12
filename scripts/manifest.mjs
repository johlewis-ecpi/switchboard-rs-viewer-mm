import {readFile, realpath, stat, lstat} from 'node:fs/promises';
import path from 'node:path';
export const MAX_MANIFEST_BYTES = 64 * 1024;
export const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
export function validateManifest(value) {
  const allowed = ['apiVersion','id','name','version','extensions','entry'];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Manifest must be an object');
  if (Object.keys(value).some(key=>!allowed.includes(key))) throw Error('Unknown manifest field');
  if (value.apiVersion !== 1) throw Error('Only reader API version 1 is supported');
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$/.test(value.id)) throw Error('Use a portable reader ID of 1–120 characters');
  if (typeof value.name !== 'string' || !value.name.trim()) throw Error('Reader name is required');
  if (value.version !== undefined && typeof value.version !== 'string') throw Error('Version must be a string');
  if (!Array.isArray(value.extensions) || !value.extensions.length || value.extensions.some(ext=>typeof ext!=='string'||!/^[A-Za-z0-9_-]+$/.test(ext))) throw Error('Declare extensions without dots');
  if (new Set(value.extensions.map(ext=>ext.toLowerCase())).size !== value.extensions.length) throw Error('Extensions must be unique, ignoring case');
  if (typeof value.entry !== 'string' || !value.entry || path.isAbsolute(value.entry) || value.entry.split(/[\\/]/).some(part=>part==='..')) throw Error('Entry must be a relative path inside the package');
  return value;
}
export async function readManifest(directory) {
  const filename = path.join(directory,'reader.json');
  if ((await stat(filename)).size > MAX_MANIFEST_BYTES) throw Error('Manifest exceeds 64 KiB');
  return validateManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await readFile(filename))));
}
export async function validatePackage(directory) {
  if ((await lstat(directory)).isSymbolicLink()) throw Error('Reader directory must not be a symlink');
  const manifest = await readManifest(directory);
  const root = await realpath(directory);
  const entry = await realpath(path.join(root,manifest.entry));
  const relative = path.relative(root,entry);
  if (!relative || relative==='..' || relative.startsWith('..'+path.sep) || path.isAbsolute(relative)) throw Error('Entry must stay within the package');
  const metadata = await stat(entry);
  if (!metadata.isFile() || metadata.size > MAX_ENTRY_BYTES) throw Error('HTML entry must be a regular file of at most 16 MiB');
  const html = new TextDecoder('utf-8',{fatal:true}).decode(await readFile(entry));
  // Starter builds deliberately contain no imports or external asset references.
  if (/<(?:script|link|iframe)\b[^>]*(?:src|href)\s*=/i.test(html) || /\bimport\s*\(/.test(html) || /@import\b/i.test(html)) throw Error('Reader must be a self-contained HTML build');
  for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    if (!/^(data:|blob:)/i.test(match[1] ?? match[2] ?? match[3])) throw Error('Image assets must use data or blob URLs');
  }
  for (const marker of ['/* VIEWER_SCRIPTS */','/* VIEWER_STYLES */','/* SUPPORTED_EXTENSIONS */']) if(html.includes(marker)) throw Error('Unresolved build placeholder');
  return {manifest, html, entry, bytes:metadata.size};
}
