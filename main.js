const { app, BrowserWindow, session, globalShortcut, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
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
  const iconPath = path.join(__dirname, 'public', 'app-icon.png');
  const windowOptions = {
    width: 1100,
    height: 850,
    title: "Nexus Radio",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };

  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function codeToVirtualKeys(code, accelerator) {
  if (!code) return [];
  if (/^Key[A-Z]$/.test(code)) return [code.charCodeAt(3)];
  if (/^Digit[0-9]$/.test(code)) return [code.charCodeAt(5)];
  if (/^Numpad[0-9]$/.test(code)) return [0x60 + Number(code.slice(6))];

  const map = {
    Space: 0x20,
    Semicolon: 0xBA,
    Period: 0xBE,
    NumpadDecimal: [0x6E, 0x2E],
    Delete: 0x2E,
    Comma: 0xBC,
    Minus: 0xBD,
    Equal: 0xBB,
    Slash: 0xBF,
    NumpadDivide: 0x6F,
    NumpadMultiply: 0x6A,
    NumpadSubtract: 0x6D,
    NumpadAdd: 0x6B,
    Backquote: 0xC0,
    BracketLeft: 0xDB,
    Backslash: 0xDC,
    BracketRight: 0xDD,
    Quote: 0xDE
  };

  const mapped = map[code];
  const mappedValues = Array.isArray(mapped) ? mapped : [mapped];

  if (accelerator === '.') mappedValues.push(0xBE, 0x6E, 0x2E);
  if (accelerator === 'Delete') mappedValues.push(0x2E, 0x6E);

  return unique(mappedValues);
}

function registerGlobalPtt(key) {
  stopGlobalPttWatcher();

  const keyCode = typeof key === 'string' ? key : key && key.code;
  const accelerator = typeof key === 'string' ? key : key && key.accelerator;
  const virtualKeys = codeToVirtualKeys(keyCode, accelerator);
  if (!virtualKeys.length) return false;

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class KeyboardState {
  [DllImport("user32.dll")]
  public static extern short GetAsyncKeyState(int vKey);
}
"@
$vks = @(${virtualKeys.join(',')})
$down = $false
while ($true) {
  $isDown = $false
  foreach ($vk in $vks) {
    if (([KeyboardState]::GetAsyncKeyState($vk) -band 0x8000) -ne 0) {
      $isDown = $true
      break
    }
  }
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
