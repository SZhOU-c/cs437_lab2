// index.js (renderer) — IPC to main.js which holds the TCP socket
const { ipcRenderer } = require('electron');

function send(cmd, options = {}) {
  return ipcRenderer.invoke('pi-move', cmd, options);
}

// --- UI helpers ---
function setArrowColor(id, color) {
  const el = document.getElementById(id);
  if (el) el.style.color = color;
}
function pressArrow(id) { setArrowColor(id, 'green'); }
function releaseArrows() {
  ['upArrow','downArrow','leftArrow','rightArrow'].forEach(id => setArrowColor(id, 'grey'));
}

// Track last commanded direction & speed (for UI only)
let lastDirection = 'stopped';
let lastSpeed = 0;

// Update telemetry panel: ONLY distance + cliff (plus direction/speed labels)
function updatePanel(tele = {}) {
  const qs = (id) => document.getElementById(id);
  if (qs('direction')) qs('direction').textContent = lastDirection;
  if (qs('speed'))     qs('speed').textContent     = String(lastSpeed);
  if (qs('distance') && tele.distance_cm != null) qs('distance').textContent = String(tele.distance_cm);
  if (qs('cliff') && typeof tele.cliff === 'string') qs('cliff').textContent = tele.cliff;
}

// Bind arrows as buttons (mouse + touch). Hold = move, release = stop.
function bindArrowControls() {
  const bindHoldAction = (elId, onPress, onRelease) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const start = (ev) => { ev.preventDefault(); pressArrow(elId); onPress(); };
    const end   = (ev) => { ev.preventDefault(); releaseArrows(); onRelease(); };
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end, { passive: false });
    window.addEventListener('touchcancel', end, { passive: false });
  };

  bindHoldAction('upArrow',
    async () => { lastDirection='forward';  lastSpeed=40; await send('forward',  { speed: 40, angle: 0 }); },
    async () => { lastDirection='stopped';  lastSpeed=0;  await send('stop'); }
  );
  bindHoldAction('downArrow',
    async () => { lastDirection='backward'; lastSpeed=30; await send('backward', { speed: 30, angle: 0 }); },
    async () => { lastDirection='stopped';  lastSpeed=0;  await send('stop'); }
  );
  bindHoldAction('leftArrow',
    async () => { lastDirection='left';     lastSpeed=35; await send('left',     { speed: 35 }); },
    async () => { lastDirection='stopped';  lastSpeed=0;  await send('stop'); }
  );
  bindHoldAction('rightArrow',
    async () => { lastDirection='right';    lastSpeed=35; await send('right',    { speed: 35 }); },
    async () => { lastDirection='stopped';  lastSpeed=0;  await send('stop'); }
  );
}

// Submit box:
// - Clicking "Submit" or pressing Enter triggers update_data()
// Supported commands: forward [speed], backward [speed], left, right, stop, sensors
async function update_data() {
  const box = document.getElementById('message');
  if (!box) return;
  const text = (box.value || '').trim().toLowerCase();
  if (!text) return;

  const parts = text.split(/\s+/);
  const cmd = parts[0];
  const spd = Number(parts[1]) || undefined;

  try {
    if (cmd === 'forward')   { lastDirection='forward';  lastSpeed=spd ?? 40; await send('forward',  { speed: lastSpeed, angle: 0 }); }
    else if (cmd === 'backward') { lastDirection='backward'; lastSpeed=spd ?? 30; await send('backward', { speed: lastSpeed, angle: 0 }); }
    else if (cmd === 'left') { lastDirection='left';     lastSpeed=35;        await send('left',     { speed: lastSpeed }); }
    else if (cmd === 'right'){ lastDirection='right';    lastSpeed=35;        await send('right',    { speed: lastSpeed }); }
    else if (cmd === 'stop') { lastDirection='stopped';  lastSpeed=0;         await send('stop'); }
    else if (cmd !== 'sensors') {
      const info = document.getElementById('bluetooth');
      if (info) info.textContent = `Unknown command: ${text}`;
    }
    // After any submit, read sensors once and refresh the labels (distance + cliff)
    const resp = await send('sensors');
    if (resp && resp.ok) updatePanel(resp);
  } catch (e) {
    const info = document.getElementById('bluetooth');
    if (info) info.textContent = `Error: ${e.message || e}`;
  }
}

// Wire up events after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // make arrow glyphs clickable like buttons (cursor)
  ['upArrow','downArrow','leftArrow','rightArrow'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.cursor = 'pointer';
  });

  bindArrowControls();

  // Submit button
  const submitBtn = document.querySelector('button.btn.btn-success');
  if (submitBtn) submitBtn.addEventListener('click', update_data);

  // Enter in the input triggers update_data()
  const input = document.getElementById('message');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        update_data();
      }
    });
  }
});
