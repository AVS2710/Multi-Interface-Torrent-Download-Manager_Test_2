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

## Windows installer

The Windows x64 installer is built on a native Windows runner. The libtorrent N-API binding is compiled from source for Windows with the Visual Studio C++ toolchain, CMake, Git, and vcpkg. vcpkg and the Visual Studio C++ workload are required when building locally.

```powershell
npm ci
npm run build:native:win
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run package:win
```

The native-build script uses the pinned [N-API binding source](https://github.com/avengerweb/porla-test/tree/4446e923b9ed020953a65269875ea0611364a52a) and its pinned libtorrent submodule. It compiles a Windows x64 addon and installs it into the local dependency tree; it does not change Linux builds.

The installer is written under `release/MultiTorrent-1.0.0-x64.exe` (the exact artifact suffix can vary). The installer is configured for a per-user installation and allows the install directory to be selected.

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
