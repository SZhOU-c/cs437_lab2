// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');

// ── Configure your Pi's IP/port ───────────────────────────────────────────────
const PI_IP = '192.168.0.134';   // <-- set to your Pi's IP
const PI_PORT = 5555;            // must match server_tcp.py
// ──────────────────────────────────────────────────────────────────────────────

let win;
let socket = null;
let buffer = '';
const pending = [];   // FIFO of resolvers awaiting the next JSON line

function createWindow () {
  win = new BrowserWindow({
    width: 1100,
    height: 820,
    webPreferences: {
      // Keeping these for simplicity with your current renderer code.
      // If you want a safer setup later, switch to preload + contextIsolation.
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js') // ok if file doesn't exist
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

function connectToPi() {
  if (socket) {
    try { socket.destroy(); } catch {}
    socket = null;
  }

  const s = net.createConnection({ host: PI_IP, port: PI_PORT }, () => {
    console.log(`[TCP] Connected to ${PI_IP}:${PI_PORT}`);
  });

  s.setEncoding('utf8');

  s.on('data', (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;

      let payload = line;
      try { payload = JSON.parse(line); } catch {}
      console.log('[TCP RESP]', payload);

      const resolve = pending.shift();
      if (resolve) resolve(payload);
    }
  });

  s.on('error', (err) => {
    console.error('[TCP ERROR]', err.message);
  });

  s.on('close', () => {
    console.log('[TCP] Closed. Flushing pending and retrying in 5s…');
    while (pending.length) pending.shift()({ ok: false, error: 'socket_closed' });
    setTimeout(connectToPi, 5000);
  });

  socket = s;
}

function sendAndWait(obj) {
  return new Promise((resolve, reject) => {
    if (!socket) return resolve({ ok: false, error: 'no_socket' });
    try {
      pending.push(resolve);
      socket.write(JSON.stringify(obj) + '\n');
    } catch (e) {
      resolve({ ok: false, error: String(e.message || e) });
    }
  });
}

// IPC from renderer: invoke('pi-move', cmd, options)
ipcMain.handle('pi-move', async (_event, cmd, options = {}) => {
  // All commands (forward/backward/left/right/stop/sensors) go through here
  const msg = { cmd, ...options };
  return await sendAndWait(msg);
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  connectToPi();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // quit on all platforms (change if you want macOS-style behavior)
  if (socket) { try { socket.destroy(); } catch {} }
  app.quit();
});
