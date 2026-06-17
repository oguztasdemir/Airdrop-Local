const express = require('express');
const router = express.Router();
const {
  getSession,
  saveSessions
} = require('./config');
const { broadcastEvent } = require('./sessionRoutes');

// Get chat messages
router.get('/chat', (req, res) => {
  const pin = req.sessionPin;
  const session = getSession(pin);
  res.json(session ? session.chatMessages : []);
});

// Post chat message
router.post('/chat', (req, res) => {
  const pin = req.sessionPin;
  const session = getSession(pin);
  if (!session) return res.status(404).end();

  const { text, device } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const message = {
    id: Date.now().toString(),
    text,
    device: device || 'Bilinmeyen Cihaz',
    createdAt: new Date()
  };

  session.chatMessages.push(message);
  if (session.chatMessages.length > 100) {
    session.chatMessages.shift();
  }

  broadcastEvent(pin, { type: 'chat_message', message, messages: session.chatMessages });
  saveSessions();
  res.json(message);
});

// Get clipboard items
router.get('/clipboard', (req, res) => {
  const pin = req.sessionPin;
  const session = getSession(pin);
  res.json(session ? session.clipboardItems : []);
});

// Post clipboard item
router.post('/clipboard', (req, res) => {
  const pin = req.sessionPin;
  const session = getSession(pin);
  if (!session) return res.status(404).end();

  const { text, device } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const item = {
    id: Date.now().toString(),
    text: text.trim(),
    device: device || 'Bilinmeyen Cihaz',
    createdAt: new Date()
  };

  session.clipboardItems.push(item);
  if (session.clipboardItems.length > 50) {
    session.clipboardItems.shift();
  }

  broadcastEvent(pin, { type: 'clipboard_update', items: session.clipboardItems });
  saveSessions();
  res.json(item);
});

// Delete clipboard item
router.delete('/clipboard/:id', (req, res) => {
  const pin = req.sessionPin;
  const { id } = req.params;
  const session = getSession(pin);
  if (!session) return res.status(404).end();

  session.clipboardItems = session.clipboardItems.filter(item => item.id !== id);
  broadcastEvent(pin, { type: 'clipboard_update', items: session.clipboardItems });
  saveSessions();
  res.json({ success: true });
});

module.exports = router;
