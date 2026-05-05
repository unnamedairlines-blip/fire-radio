const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    title: "Fire Radio Desktop",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Fixed the variable name to __dirname
  win.loadFile(path.join(__dirname, 'public/index.html'));

  // Professional look: hide the default top menu
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});