const { app, BrowserWindow, session, globalShortcut, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow = null;
let globalPttProcess = null;
let registeredKeyCode = null;

function allowMicrophoneAccess() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => permission === 'media');
}

function createWindow() {
  allowMicrophoneAccess();

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 850,
    title: "Fire Radio Dispatch Console",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
  mainWindow.setMenuBarVisibility(false);
}

function stopGlobalPttWatcher() {
  if (globalPttProcess) {
    globalPttProcess.kill();
    globalPttProcess = null;
  }
  registeredKeyCode = null;
}

function codeToVirtualKey(code) {
  if (!code) return null;
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5);
  if (/^Numpad[0-9]$/.test(code)) return 0x60 + Number(code.slice(6));

  const map = {
    Space: 0x20,
    Semicolon: 0xBA,
    Period: 0xBE,
    NumpadDecimal: 0x6E,
    Delete: 0x2E,
    Comma: 0xBC,
    Minus: 0xBD,
    Equal: 0xBB,
    Slash: 0xBF,
    Backquote: 0xC0,
    BracketLeft: 0xDB,
    Backslash: 0xDC,
    BracketRight: 0xDD,
    Quote: 0xDE
  };

  return map[code] || null;
}

function registerGlobalPtt(key) {
  stopGlobalPttWatcher();

  const keyCode = typeof key === 'string' ? key : key && key.code;
  const virtualKey = codeToVirtualKey(keyCode);
  if (!virtualKey) return false;

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class KeyboardState {
  [DllImport("user32.dll")]
  public static extern short GetAsyncKeyState(int vKey);
}
"@
$vk = ${virtualKey}
$down = $false
while ($true) {
  $isDown = ([KeyboardState]::GetAsyncKeyState($vk) -band 0x8000) -ne 0
  if ($isDown -ne $down) {
    $down = $isDown
    if ($down) { [Console]::Out.WriteLine("DOWN") } else { [Console]::Out.WriteLine("UP") }
    [Console]::Out.Flush()
  }
  Start-Sleep -Milliseconds 15
}
`;

  globalPttProcess = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore']
  });

  globalPttProcess.stdout.on('data', (chunk) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    String(chunk).split(/\r?\n/).forEach((line) => {
      if (line === 'DOWN') mainWindow.webContents.send('global-ptt-down');
      if (line === 'UP') mainWindow.webContents.send('global-ptt-up');
    });
  });

  globalPttProcess.on('exit', () => {
    if (registeredKeyCode === keyCode) {
      globalPttProcess = null;
      registeredKeyCode = null;
    }
  });

  registeredKeyCode = keyCode;
  return true;
}

// Set permissions for media devices in Electron
app.commandLine.appendSwitch('enable-features', 'AudioServiceSandbox');

app.whenReady().then(createWindow);

ipcMain.handle('register-global-ptt', (_event, key) => {
  return { ok: registerGlobalPtt(key) };
});

app.on('window-all-closed', () => {
  stopGlobalPttWatcher();
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});
