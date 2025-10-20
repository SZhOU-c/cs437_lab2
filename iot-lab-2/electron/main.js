// Modules to control application life and create native browser window
const {app, BrowserWindow} = require('electron')
const net = require('net');
const path = require('path')

const PI_IP = "192.168.0.134";
const PI_PORT = 5555;

let socket = null;

function connectToPi() {
  socket = net.createConnection({ host: PI_IP, port: PI_PORT }, () => {
    console.log(`[TCP] Connected to Pi at ${PI_IP}:${PI_PORT}`);
  });

  socket.on("data", (buf) => {
    const text = buf.toString("utf8").trim();
    text.split("\n").forEach(line => {
      if (!line) return;
      try {
        const data = JSON.parse(line);
        console.log("[TCP RESP]", data);
      } catch (e) {
        console.log("[TCP RAW]", line);
      }
    });
  });

  socket.on("error", (err) => {
    console.error("[TCP ERROR]", err.message);
  });

  socket.on("close", () => {
    console.log("[TCP] Connection closed, retrying in 5s...");
    setTimeout(connectToPi, 5000);
  });
}

connectToPi();

const { ipcMain } = require('electron');

ipcMain.handle('pi-move', async (event, cmd, options = {}) => {
  if (!socket) return { ok: false, error: 'No socket connection' };
  const msg = JSON.stringify({ cmd, ...options }) + "\n";
  socket.write(msg);
  return { ok: true };
});


function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 1000,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  // if (process.platform !== 'darwin') app.quit()
  app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
