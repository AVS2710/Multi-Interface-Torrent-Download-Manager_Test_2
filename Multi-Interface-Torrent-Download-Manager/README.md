# MultiTorrent

MultiTorrent is an Electron desktop BitTorrent client with network-interface selection, downloads, and persistent settings. The Linux build is distributed as an AppImage.

## Linux desktop app

Every successful build of the `main` or `fix/**` branch runs the Linux workflow. To download the packaged app:

1. Open the repository's **Actions** tab.
2. Open the latest successful **Linux AppImage** workflow run.
3. Download the `MultiTorrent-Linux-AppImage` artifact and extract the ZIP.
4. Make the AppImage executable if needed and launch it:

```bash
chmod +x MultiTorrent-*.AppImage
./MultiTorrent-*.AppImage
```

The AppImage is a desktop app; a terminal is not required for normal use after downloading it. It stores the database and preferences in Electron's user-data directory and uses the selected download folder for torrent data.

## Build locally

Native dependencies are required to compile the libtorrent and SQLite modules. On Debian/Ubuntu, install the build and runtime libraries first:

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libtorrent-rasterbar-dev libsqlite3-dev xvfb libnspr4 libnss3 libatk-bridge2.0-0 libgtk-3-0 libxkbcommon0 libasound2 libatspi2.0-0
npm ci
npm rebuild sqlite3 --build-from-source
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
npm start
```

To build the Linux AppImage, run `npm run package:linux`. To run the real Electron E2E tests in a headless Linux session, use `xvfb-run -a npm run test:e2e`.

## Features and current limitations

- Add magnet links, local `.torrent` files, and direct HTTP(S) torrent-file URLs.
- Choose a download directory and view torrent state as reported by libtorrent.
- Pause, resume, and remove active torrent handles.
- Inspect detected network interfaces and select which interfaces libtorrent should use.
- Save DHT, global upload/download limits, download directory, and theme preferences.
- Open magnet links and torrent files through the operating system when the app is installed as a protocol/file handler.

The installed `@porla/libtorrent` binding does not currently expose all torrent metadata or upload-rate fields, so unsupported data is displayed as unavailable rather than guessed. The UI also does not claim to verify physical peer-by-peer routing; that requires engine telemetry not exposed by this binding. Per-interface rate limits are not exposed by the current binding, while global limits are applied to the libtorrent session.

## Tests

The Playwright E2E tests launch Electron, verify that the sandboxed preload bridge actually works, invoke main-process IPC, and add a locally generated torrent without relying on a public torrent swarm. The GitHub Actions workflow also builds the AppImage and starts the packaged artifact in a virtual display.
