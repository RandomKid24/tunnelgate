#!/usr/bin/env node
/**
 * Downloads the pinned `cloudflared` binary for one or more platforms into
 * `resources/`, where electron-builder bundles it (see electron-builder.yml
 * `extraResources`) and `cloudflaredResolver.ts` looks for it at runtime.
 *
 * The whole point: a packaged TunnelGate ships with cloudflared inside it, so a
 * user never installs it separately.
 *
 * Usage:
 *   node scripts/fetch-cloudflared.js            # current OS + arch
 *   node scripts/fetch-cloudflared.js --all      # every target (for CI matrices)
 *   node scripts/fetch-cloudflared.js win32 x64  # explicit target
 *
 * Idempotent: skips the download when the installed file is already present and
 * its SHA-256 matches the pinned value.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');

// Pin the release so builds are reproducible and the checksums below stay valid.
// To bump: change VERSION, delete resources/cloudflared*, run with --all, and
// paste the new hashes the script prints on mismatch (both archive and binary).
const VERSION = '2026.8.3';

// `archive` = sha256 of the downloaded release asset (verifies the download).
// `bin`     = sha256 of the file we actually write to resources/ (for raw
//             assets this equals `archive`; for .tgz it's the unpacked binary).
const TARGETS = {
  'win32-x64': {
    asset: 'cloudflared-windows-amd64.exe',
    out: 'cloudflared.exe',
    extract: null,
    archive: '83e726ed18ea78c5ad5213c4c3a3a27051393950d2bc8ed4de69bec12d14eaae',
    bin: '83e726ed18ea78c5ad5213c4c3a3a27051393950d2bc8ed4de69bec12d14eaae',
  },
  'darwin-arm64': {
    asset: 'cloudflared-darwin-arm64.tgz',
    out: 'cloudflared',
    extract: 'tgz',
    archive: '40c9144d86df8937c5b43293a1f7d2d2107029aa74725023dd46b1b27154352f',
    bin: '50a04624531e7a98ddb65f1223905e32f84e7488ed3ee8dadcd3260aa8932603',
  },
  'darwin-x64': {
    asset: 'cloudflared-darwin-amd64.tgz',
    out: 'cloudflared',
    extract: 'tgz',
    archive: '61e1316266a00fd70ce40da011d612badc805367fb65293dd1925f938f704c99',
    bin: '936aa4ed783b0e191fac48e7140c34605b25d8d5c0495c3599c90e350ae6e4c4',
  },
  'linux-x64': {
    asset: 'cloudflared-linux-amd64',
    out: 'cloudflared',
    extract: null,
    archive: 'f29324fe934d1e100617484c78deef803c4dc2cd351d645bbde42e96b4fccc5e',
    bin: 'f29324fe934d1e100617484c78deef803c4dc2cd351d645bbde42e96b4fccc5e',
  },
  'linux-arm64': {
    asset: 'cloudflared-linux-arm64',
    out: 'cloudflared',
    extract: null,
    archive: '4bcfd35521a7cbc545ebfd5d57334a71ee180e2a64874981f374c81472118391',
    bin: '4bcfd35521a7cbc545ebfd5d57334a71ee180e2a64874981f374c81472118391',
  },
};

const RESOURCES_DIR = path.resolve(__dirname, '..', 'resources');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function download(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'tunnelgate-build' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft === 0) return reject(new Error('too many redirects'));
          res.resume();
          return resolve(download(res.headers.location, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

/** Extract the single `cloudflared` file from a gzip-compressed tar (no deps). */
function extractFromTgz(tgz) {
  const tar = zlib.gunzipSync(tgz);
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break; // end-of-archive
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const size = parseInt(header.toString('utf8', 124, 136).replace(/\0.*$/, '').trim(), 8) || 0;
    const body = tar.subarray(offset + 512, offset + 512 + size);
    if (path.basename(name) === 'cloudflared') return Buffer.from(body);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error('no `cloudflared` entry inside tarball');
}

async function fetchOne(key) {
  const t = TARGETS[key];
  if (!t) throw new Error(`unknown target "${key}" (have: ${Object.keys(TARGETS).join(', ')})`);

  const dest = path.join(RESOURCES_DIR, t.out);

  if (fs.existsSync(dest) && sha256(fs.readFileSync(dest)) === t.bin) {
    console.log(`[cloudflared] ${key}: up to date (${t.out})`);
    return;
  }

  const url = `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/${t.asset}`;
  console.log(`[cloudflared] ${key}: downloading ${t.asset} @ ${VERSION}`);
  const archive = await download(url);

  if (sha256(archive) !== t.archive) {
    throw new Error(
      `[cloudflared] ${key}: checksum mismatch for ${t.asset}\n` +
        `  expected ${t.archive}\n` +
        `  got      ${sha256(archive)}\n` +
        `If you bumped VERSION, update the hashes in scripts/fetch-cloudflared.js.`,
    );
  }

  const binary = t.extract === 'tgz' ? extractFromTgz(archive) : archive;

  if (sha256(binary) !== t.bin) {
    throw new Error(
      `[cloudflared] ${key}: unpacked binary hash mismatch\n` +
        `  expected ${t.bin}\n` +
        `  got      ${sha256(binary)}\n` +
        `If you bumped VERSION, set "bin" for ${key} to the value above.`,
    );
  }

  fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  fs.writeFileSync(dest, binary);
  if (!key.startsWith('win32')) fs.chmodSync(dest, 0o755);
  console.log(`[cloudflared] ${key}: wrote ${path.relative(process.cwd(), dest)} (${binary.length} bytes)`);
}

async function main() {
  const args = process.argv.slice(2);

  let keys;
  if (args.includes('--all')) {
    keys = Object.keys(TARGETS);
  } else if (args.length >= 2) {
    keys = [`${args[0]}-${args[1]}`];
  } else {
    keys = [`${process.platform}-${process.arch}`]; // e.g. darwin-arm64
  }

  for (const key of keys) {
    await fetchOne(key);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
