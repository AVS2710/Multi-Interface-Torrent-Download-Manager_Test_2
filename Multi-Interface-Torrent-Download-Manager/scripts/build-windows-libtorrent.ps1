$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'This script can only build the Windows native libtorrent binding on Windows.'
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bindingRoot = Join-Path $projectRoot 'node_modules\@porla\libtorrent'
$bindingFile = Join-Path $bindingRoot 'prebuilds\win32-x64\node-napi.node'
$loaderFile = Join-Path $bindingRoot 'index.js'
$sourceCommit = '4446e923b9ed020953a65269875ea0611364a52a'
$runnerTemp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$nativeRoot = Join-Path $runnerTemp ("multitorrent-porla-libtorrent-" + $sourceCommit)

# This script is intentionally idempotent: package:win invokes it too, and
# should reuse a native binary already compiled earlier in the same workflow.
if (Test-Path $bindingFile) {
    & node -e "const lt=require('@porla/libtorrent'); if(typeof lt.Session!=='function'||typeof lt.AddTorrentParams!=='function') process.exit(1); const s=new lt.Session(); s.post_torrent_updates(); s.dispose(); console.log('Windows libtorrent compatibility adapter already loads.');"
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'Using the already-built Windows libtorrent binding.'
        exit 0
    }
}

$vcpkgRoot = $env:VCPKG_INSTALLATION_ROOT
if (-not $vcpkgRoot) { $vcpkgRoot = 'C:\vcpkg' }
$vcpkgExe = Join-Path $vcpkgRoot 'vcpkg.exe'
if (-not (Test-Path $vcpkgExe)) {
    throw ("vcpkg was not found at " + $vcpkgExe + ". Install vcpkg and set VCPKG_INSTALLATION_ROOT before building.")
}
$toolchain = Join-Path $vcpkgRoot 'scripts\buildsystems\vcpkg.cmake'
if (-not (Test-Path $toolchain)) { throw ("vcpkg toolchain file is missing: " + $toolchain) }

Write-Host 'Installing static Boost and OpenSSL build dependencies through vcpkg.'
$vcpkgPackages = @(
    'boost-system:x64-windows-static',
    'boost-chrono:x64-windows-static',
    'boost-random:x64-windows-static',
    'boost-date-time:x64-windows-static',
    'boost-filesystem:x64-windows-static',
    'boost-asio:x64-windows-static',
    'openssl:x64-windows-static'
)
& $vcpkgExe install @vcpkgPackages
if ($LASTEXITCODE -ne 0) { throw 'vcpkg failed to install the native libtorrent build dependencies.' }

if (Test-Path $nativeRoot) { Remove-Item -LiteralPath $nativeRoot -Recurse -Force }
Write-Host ("Fetching pinned N-API libtorrent binding source at " + $sourceCommit + ".")
& git clone 'https://github.com/avengerweb/porla-test.git' $nativeRoot
if ($LASTEXITCODE -ne 0) { throw 'Could not clone the N-API libtorrent binding source.' }
& git -C $nativeRoot checkout --detach $sourceCommit
if ($LASTEXITCODE -ne 0) { throw 'Could not check out the pinned native binding source.' }
& git -C $nativeRoot submodule update --init --recursive --depth 1
if ($LASTEXITCODE -ne 0) { throw 'Could not fetch the pinned libtorrent source submodule.' }

Push-Location $nativeRoot
try {
    & npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Could not install native binding build tools.' }

    # This older source checkout pins cmake-js 6 and its old node-abi table,
    # which does not know recent Electron major versions. Upgrade the transient
    # build tool only; do not change the upstream checkout or its lockfile.
    & npm install --no-save --package-lock=false 'cmake-js@latest'
    if ($LASTEXITCODE -ne 0) { throw 'Could not install a current cmake-js toolchain.' }

    $cmakeJs = Join-Path $nativeRoot 'node_modules\.bin\cmake-js.cmd'
    if (-not (Test-Path $cmakeJs)) { throw ("cmake-js was not installed at " + $cmakeJs) }
    # Resolve Electron from the application project: this script is currently
    # running inside the separate upstream binding checkout, which has no Electron
    # dependency of its own.
    $env:MULTITORRENT_ELECTRON_PACKAGE = Join-Path $projectRoot 'node_modules\electron\package.json'
    if (-not (Test-Path $env:MULTITORRENT_ELECTRON_PACKAGE)) {
        throw ("Electron package.json was not found at " + $env:MULTITORRENT_ELECTRON_PACKAGE)
    }
    $electronVersion = (& node -p "require(process.env.MULTITORRENT_ELECTRON_PACKAGE).version").Trim()
    if ($LASTEXITCODE -ne 0 -or -not $electronVersion) {
        throw 'Could not determine the application Electron version for the native binding build.'
    }
    Write-Host ("Building N-API binding for Electron " + $electronVersion + " (Windows x64).")

    $cmakeArgs = @(
        '-r', 'electron',
        '-v', $electronVersion,
        '-a', 'x64',
        '--CDCMAKE_BUILD_TYPE=Release',
        ('--CDCMAKE_TOOLCHAIN_FILE=' + $toolchain),
        '--CDBUILD_SHARED_LIBS=OFF',
        '--CDBoost_USE_STATIC_LIBS=ON',
        '--CDCMAKE_FIND_PACKAGE_PREFER_CONFIG=ON',
        '--CDCMAKE_POLICY_DEFAULT_CMP0167=NEW',
        '--CDOPENSSL_USE_STATIC_LIBS=TRUE',
        'build'
    )
    & $cmakeJs @cmakeArgs
    if ($LASTEXITCODE -ne 0) { throw 'cmake-js failed to compile the Windows libtorrent binding.' }
}
finally {
    Pop-Location
}

$builtBinding = Join-Path $nativeRoot 'prebuilds\win32-x64\node-napi.node'
if (-not (Test-Path $builtBinding)) {
    throw ("Native build completed without producing the expected binding: " + $builtBinding)
}

$targetDir = Split-Path -Parent $bindingFile
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item -LiteralPath $builtBinding -Destination $bindingFile -Force

# Adapt the legacy native exports to the capitalized/EventEmitter API the
# desktop app uses. The N-API addon itself exposes lowercase class names and
# delivers libtorrent alerts through pop_alerts(), not EventEmitter callbacks.
$loader = @'
'use strict';
const path = require('node:path');
const { EventEmitter } = require('node:events');
const native = require(path.join(__dirname, 'prebuilds', process.platform + '-' + process.arch, 'node-napi.node'));

class Session extends EventEmitter {
  constructor(...args) {
    super();
    this._nativeSession = new native.session(...args);
    this._alertTimer = setInterval(() => this._drainAlerts(), 100);
    this._alertTimer.unref?.();
  }

  _drainAlerts() {
    let alerts;
    try {
      alerts = this._nativeSession.pop_alerts();
    } catch (error) {
      this.emit('adapter_error', error);
      return;
    }
    if (!Array.isArray(alerts)) return;
    for (const alert of alerts) {
      const rawName = typeof alert?.what === 'string' ? alert.what : '';
      if (!rawName) continue;
      const eventName = rawName.replace(/_alert$/, '');
      this.emit(eventName, alert);
      if (eventName !== rawName) this.emit(rawName, alert);
    }
  }

  add_torrent(...args) { return this._nativeSession.add_torrent(...args); }
  async_add_torrent(...args) { return this._nativeSession.async_add_torrent(...args); }
  get_torrents(...args) { return this._nativeSession.get_torrents(...args); }
  post_torrent_updates(...args) { return this._nativeSession.post_torrent_updates(...args); }
  apply_settings(...args) { return this._nativeSession.apply_settings(...args); }
  remove_torrent(...args) { return this._nativeSession.remove_torrent(...args); }
  pause(...args) { return this._nativeSession.pause(...args); }
  resume(...args) { return this._nativeSession.resume(...args); }

  dispose() {
    clearInterval(this._alertTimer);
    try { this._nativeSession.pause(); } catch { /* process teardown */ }
    this.removeAllListeners();
  }
}

module.exports = {
  ...native,
  Session,
  AddTorrentParams: native.add_torrent_params,
  TorrentInfo: native.torrent_info,
  TorrentHandle: native.torrent_handle,
  TorrentStatus: native.torrent_status,
  parse_magnet_uri: native.parse_magnet_uri,
};
'@
[System.IO.File]::WriteAllText($loaderFile, $loader, [System.Text.UTF8Encoding]::new($false))

Write-Host 'Verifying the compiled libtorrent binding.'
& node -e "const lt=require('@porla/libtorrent'); if(typeof lt.Session!=='function'||typeof lt.TorrentInfo!=='function'||typeof lt.AddTorrentParams!=='function'||typeof lt.parse_magnet_uri!=='function') throw new Error('Required native exports are missing'); const session=new lt.Session(); session.post_torrent_updates(); session.dispose(); console.log('Windows libtorrent compatibility adapter loaded and session initialized.');"
if ($LASTEXITCODE -ne 0) { throw 'The compiled Windows libtorrent adapter failed to load or initialize.' }
