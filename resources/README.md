# resources/

Static files bundled into the packaged app.

- `icons/` — app icons (tracked).
- `cloudflared`, `cloudflared.exe` — **not tracked.** Fetched at build time by
  [`scripts/fetch-cloudflared.js`](../scripts/fetch-cloudflared.js), which pins a
  cloudflared release and verifies its SHA-256. `build/beforePack.js` runs it for
  the platform being packaged; `npm run fetch:cloudflared` fetches for the
  current OS on demand. electron-builder copies them to `<resourcesPath>/` (see
  `electron-builder.yml`), where `src/main/cloudflaredResolver.ts` finds them at
  runtime so the user never installs cloudflared themselves.

To bump the bundled cloudflared version: edit `VERSION` in
`scripts/fetch-cloudflared.js`, delete `resources/cloudflared*`, run
`node scripts/fetch-cloudflared.js --all`, and paste in the hashes it prints.
