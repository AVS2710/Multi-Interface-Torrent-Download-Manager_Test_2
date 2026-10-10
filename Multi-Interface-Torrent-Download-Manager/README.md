# MultiTorrent

MultiTorrent is an Electron desktop BitTorrent client project with network-interface selection and configurable engine settings.

## Linux desktop build

Build the AppImage on Debian/Ubuntu or in a compatible development container. Native build dependencies are required by the libtorrent Node binding:

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libtorrent-rasterbar-dev
npm ci
npm run package:linux
```

The AppImage is written to `release/MultiTorrent-1.0.0-x64.AppImage` (the exact architecture suffix may vary). Run it with:

```bash
chmod +x release/MultiTorrent-*.AppImage
./release/MultiTorrent-*.AppImage
```

The application is configured to use Electron's sandboxed, CommonJS preload bundle and an isolated renderer. Do not add `--no-sandbox` to the packaged application's launch command.

## Development

```bash
npm ci
npm run build
npm start
```

Linux systems may require their standard Electron runtime libraries (GTK, NSS, ALSA, ATK, and related X11/Wayland libraries).

## Checks

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
xvfb-run -a npm run test:e2e
```

The Electron end-to-end tests launch the application and exercise the actual preload/IPC bridge. Physical per-peer interface verification is explicitly marked as skipped because the current libtorrent binding does not expose the required peer endpoint information.
