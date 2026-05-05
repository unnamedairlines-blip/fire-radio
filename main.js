const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: "Fire Radio Desktop",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the local HTML file
  win.loadFile('public/index.html');

  // Optional: Uncomment the line below to open dev tools automatically for debugging
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});