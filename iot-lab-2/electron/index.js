// index.js (renderer)
const { ipcRenderer } = require('electron');
const send = (cmd, options={}) => ipcRenderer.invoke('pi-move', cmd, options);

// keep your UI helpers & state...

async function refreshSensors() {
  try {
    const resp = await send('sensors');
    if (resp && resp.ok) updatePanel(resp);
  } catch {}
}

// Bind arrows as buttons (mouse + touch). Hold = move, release = stop.
function bindArrowControls() {
  const bindHoldAction = (elId, onPress, onRelease) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const start = async (ev) => { ev.preventDefault(); pressArrow(elId); await onPress(); await refreshSensors(); };
    const end   = async (ev) => { ev.preventDefault(); releaseArrows(); await onRelease(); await refreshSensors(); };
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end, { passive: false });
    window.addEventListener('touchcancel', end, { passive: false });
  };

  bindHoldAction('upArrow',
    () => { lastDirection='forward';  lastSpeed=40; return send('forward',  { speed: 40, angle: 0 }); },
    () => { lastDirection='stopped';  lastSpeed=0;  return send('stop'); }
  );
  bindHoldAction('downArrow',
    () => { lastDirection='backward'; lastSpeed=30; return send('backward', { speed: 30, angle: 0 }); },
    () => { lastDirection='stopped';  lastSpeed=0;  return send('stop'); }
  );
  bindHoldAction('leftArrow',
    () => { lastDirection='left';     lastSpeed=35; return send('left',     { speed: 35 }); },
    () => { lastDirection='stopped';  lastSpeed=0;  return send('stop'); }
  );
  bindHoldAction('rightArrow',
    () => { lastDirection='right';    lastSpeed=35; return send('right',    { speed: 35 }); },
    () => { lastDirection='stopped';  lastSpeed=0;  return send('stop'); }
  );
}

// Submit box: after any submit, also refresh sensors
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
    await refreshSensors();  // <— update distance & cliff after submit/enter
  } catch (e) {
    const info = document.getElementById('bluetooth');
    if (info) info.textContent = `Error: ${e.message || e}`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  ['upArrow','downArrow','leftArrow','rightArrow'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.cursor = 'pointer';
  });
  bindArrowControls();

  const submitBtn = document.querySelector('button.btn.btn-success');
  if (submitBtn) submitBtn.addEventListener('click', update_data);

  const input = document.getElementById('message');
  if (input) input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); update_data(); }
  });
});
