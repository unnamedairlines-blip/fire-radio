const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    title: "Fire Radio Desktop Console",
    icon: path.join(__currentname, 'icon.ico'), // Optional: if you have an icon
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // This tells Electron to ignore the browser tab and load your local UI
  win.loadFile(path.join(__currentname, 'public/index.html'));

  // Removes the top menu bar (File, Edit, etc.) for a professional app look
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});