const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 850,
    title: "Fire Radio Dispatch Console",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'public/index.html'));
  win.setMenuBarVisibility(false);
}

// Set permissions for media devices in Electron
app.commandLine.appendSwitch('enable-features', 'AudioServiceSandbox');

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});