const { app, BrowserWindow, session, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let registeredAccelerator = null;

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

function registerGlobalPtt(accelerator) {
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator);
    registeredAccelerator = null;
  }

  if (!accelerator) return false;

  const candidates = accelerator === ';' ? [';', 'Semicolon'] : [accelerator];
  const onGlobalPtt = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (BrowserWindow.getFocusedWindow() === mainWindow) return;
    mainWindow.webContents.send('global-ptt-toggle');
  };

  const registered = candidates.some(candidate => {
    const ok = globalShortcut.register(candidate, onGlobalPtt);
    if (ok) registeredAccelerator = candidate;
    return ok;
  });

  return registered;
}

// Set permissions for media devices in Electron
app.commandLine.appendSwitch('enable-features', 'AudioServiceSandbox');

app.whenReady().then(createWindow);

ipcMain.handle('register-global-ptt', (_event, accelerator) => {
  return { ok: registerGlobalPtt(accelerator) };
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});
