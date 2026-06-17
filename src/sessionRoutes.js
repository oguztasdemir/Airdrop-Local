const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const {
  sessions,
  saveSessions,
  createSessionDirs,
  getSession,
  getSessionUploadsDir
} = require('./config');

function broadcastEvent(pin, eventData) {
  const session = getSession(pin);
  if (!session) return;
  session.sseClients.forEach(client => {
    try {
      client.res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    } catch (err) {
      // client connection might be closed
    }
  });
}

function broadcastGlobalSessionsUpdate() {
  const sessionList = Object.keys(sessions).map(pin => ({
    pin,
    name: sessions[pin].name || `Oturum #${pin}`
  }));
  Object.keys(sessions).forEach(pin => {
    broadcastEvent(pin, { type: 'global_sessions_update', sessions: sessionList });
  });
}

function broadcastDeviceList(pin) {
  const session = getSession(pin);
  if (!session) return;
  const devices = session.sseClients.map(c => ({ id: c.id, device: c.device }));
  broadcastEvent(pin, { type: 'device_list_update', devices });
}

// Session creation endpoint under an account
router.post('/create', (req, res) => {
  const { username, name } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username/Account is required' });
  }
  const cleanUsername = path.basename(username).trim();

  // Find next Pin dynamically
  let nextPin = 1;
  Object.keys(sessions).forEach(pin => {
    const num = parseInt(pin, 10);
    if (!isNaN(num) && num >= nextPin) {
      nextPin = num + 1;
    }
  });
  const pin = nextPin.toString();

  sessions[pin] = {
    account: cleanUsername,
    name: name && name.trim() ? name.trim() : `Oturum #${pin}`,
    sseClients: [],
    clipboardItems: [],
    chatMessages: [],
    createdAt: new Date()
  };

  createSessionDirs(pin);
  console.log(`[+] Yeni Oturum Oluşturuldu: [ PIN: ${pin}, Hesap: ${cleanUsername}, Ad: ${sessions[pin].name} ]`);
  
  saveSessions();
  broadcastGlobalSessionsUpdate();
  res.json({ pin });
});

// Get list of active session PINs and names, optionally filtered by account
router.get('/', (req, res) => {
  const { account } = req.query;
  if (account) {
    const cleanAccount = path.basename(account).trim();
    const filtered = Object.keys(sessions)
      .filter(pin => sessions[pin].account === cleanAccount)
      .map(pin => ({ pin, name: sessions[pin].name || `Oturum #${pin}` }));
    return res.json(filtered);
  }
  const allSessions = Object.keys(sessions).map(pin => ({ pin, name: sessions[pin].name || `Oturum #${pin}` }));
  res.json(allSessions);
});

// Rename session endpoint
router.put('/rename/:pin', (req, res) => {
  const { pin } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Session name is required' });
  }
  if (!sessions[pin]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  sessions[pin].name = name.trim();
  console.log(`[✏️] Oturum Yeniden Adlandırıldı: [ PIN: ${pin}, Yeni Ad: ${sessions[pin].name} ]`);
  saveSessions();
  broadcastGlobalSessionsUpdate();
  res.json({ success: true, name: sessions[pin].name });
});

// Delete session endpoint
router.delete('/:pin', (req, res) => {
  const { pin } = req.params;
  if (!sessions[pin]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Close SSE clients
  const session = sessions[pin];
  session.sseClients.forEach(client => {
    try {
      client.res.end();
    } catch (err) {}
  });

  // Delete files
  const sessionDir = getSessionUploadsDir(pin);
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Oturum dizini silinemedi: ${sessionDir}`, e);
    }
  }

  delete sessions[pin];
  console.log(`[🗑️] Oturum Silindi: [ PIN: ${pin} ]`);
  saveSessions();
  broadcastGlobalSessionsUpdate();
  res.json({ success: true });
});

// Validate session PIN
router.get('/validate/:pin', (req, res) => {
  const { pin } = req.params;
  if (sessions[pin]) {
    res.json({ valid: true, account: sessions[pin].account, name: sessions[pin].name || `Oturum #${pin}` });
  } else {
    res.status(401).json({ valid: false });
  }
});

// Server-Sent Events subscription for real-time updates
router.get('/events', (req, res) => {
  const pin = req.query.pin;
  const session = getSession(pin);
  if (!session) {
    res.status(401).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const device = req.query.device || 'Bilinmeyen Cihaz';
  const id = req.query.id || Math.random().toString(36).substring(2, 9);

  const clientObj = { res, id, device };
  session.sseClients.push(clientObj);

  // Broadcast the updated device list immediately
  broadcastDeviceList(pin);

  const pingInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(pingInterval);
    const targetSession = getSession(pin);
    if (targetSession) {
      targetSession.sseClients = targetSession.sseClients.filter(client => client.res !== res);
      broadcastDeviceList(pin);
    }
  });
});

module.exports = {
  router,
  broadcastEvent,
  broadcastGlobalSessionsUpdate,
  broadcastDeviceList
};
