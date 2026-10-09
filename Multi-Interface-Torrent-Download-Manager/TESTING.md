# Testing Architecture

## Unit Tests
- Uses `vitest`.
- Targets independent modules without native engine bindings (e.g. `networkManager.ts`).
- Executes natively as ESM.

## Integration Tests
- Uses `vitest` executing the native `@porla/libtorrent` engine.
- Avoids mocks for `lt.Session`, utilizing the actual native bindings to evaluate state machines, configuration mappings (`outgoing_interfaces` propagation), and database configurations (SQLite).

## E2E / Playwright Tests
- Written against the compiled Electron entry point (`dist/main/main/main.js`).
- Uses `_electron.launch` to test full IPC bounds (`preload` integration isolating `window.torrentApi`).
- **Limitation:** In headless CI sandbox configurations (specifically lacking valid `X11` server displays), Electron process crashes inherently on startup. Tests gracefully trap this and log `ENVIRONMENT BLOCKED`. Can be executed natively on full desktop Linux/Windows targets running physical UI servers.