import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { get, head, put } from '@vercel/blob';

const localRoot = resolve(process.cwd(), '.data', 'uploads');

function localPath(pathname: string) {
  const target = resolve(localRoot, pathname);
  if (target !== localRoot && !target.startsWith(`${localRoot}${sep}`)) {
    throw new Error('Caminho de documento inválido.');
  }
  return target;
}

export function isBlobStorageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN
    || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );
}

export function safeDocumentName(value: string) {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (safe || 'documento').slice(-180);
}

export async function writeLocalDocument(pathname: string, bytes: Uint8Array) {
  const target = localPath(pathname);
  await mkdir(resolve(target, '..'), { recursive: true });
  await writeFile(target, bytes);
}

export async function writeGeneratedDocument(pathname: string, bytes: Uint8Array, contentType: string) {
  if (!isBlobStorageConfigured()) return writeLocalDocument(pathname, bytes);
  await put(pathname, Buffer.from(bytes), { access: 'private', contentType, addRandomSuffix: false });
}

export async function documentMetadata(pathname: string) {
  if (!isBlobStorageConfigured()) return null;
  const blob = await head(pathname);
  return { pathname: blob.pathname, mimeType: blob.contentType, size: blob.size };
}

export async function readDocument(pathname: string) {
  if (!isBlobStorageConfigured()) {
    return { body: new Uint8Array(await readFile(localPath(pathname))), headers: new Headers() };
  }
  const result = await get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  return { body: result.stream, headers: result.headers };
}
