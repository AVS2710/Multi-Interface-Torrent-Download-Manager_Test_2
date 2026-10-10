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
    & node -e "const lt=require('@porla/libtorrent'); if(typeof lt.Session!=='function') process.exit(1); new lt.Session(); console.log('Windows libtorrent binding already loads.');"
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

    $cmakeJs = Join-Path $nativeRoot 'node_modules\.bin\cmake-js.cmd'
    if (-not (Test-Path $cmakeJs)) { throw ("cmake-js was not installed at " + $cmakeJs) }
    $electronVersion = (& node -p "require('electron/package.json').version").Trim()
    Write-Host ("Building N-API binding for Electron " + $electronVersion + " (Windows x64).")

    $cmakeArgs = @(
        '-r', 'electron',
        '-v', $electronVersion,
        '-a', 'x64',
        '--CDCMAKE_BUILD_TYPE=Release',
        ('--CDCMAKE_TOOLCHAIN_FILE=' + $toolchain),
        '--CDBUILD_SHARED_LIBS=OFF',
        '--CDBoost_USE_STATIC_LIBS=ON',
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

# npm's published loader only has prebuild metadata for platforms shipped by
# the package. Point this Windows build at the N-API binary compiled above.
$loader = @'
'use strict';
const path = require('node:path');
module.exports = require(path.join(__dirname, 'prebuilds', process.platform + '-' + process.arch, 'node-napi.node'));
'@
Set-Content -LiteralPath $loaderFile -Value $loader -Encoding utf8

Write-Host 'Verifying the compiled libtorrent binding.'
& node -e "const lt=require('@porla/libtorrent'); if(typeof lt.Session!=='function'||typeof lt.TorrentInfo!=='function'||typeof lt.AddTorrentParams!=='function') throw new Error('Required native exports are missing'); const session=new lt.Session(); session.post_torrent_updates(); console.log('Windows libtorrent native binding loaded and session initialized.');"
if ($LASTEXITCODE -ne 0) { throw 'The compiled Windows native libtorrent binding failed to load or initialize.' }
