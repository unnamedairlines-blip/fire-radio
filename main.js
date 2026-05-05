const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 600,
    title: "Fire Radio",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // This loads your local UI
  win.loadFile('index.html');
  
  // Remove the top menu bar for a "radio" feel
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});