const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const {
  getSessionUploadsDir,
  getFolderDirectory,
  getSession,
  saveSessions
} = require('./config');
const { broadcastEvent } = require('./sessionRoutes');

// Get list of folders
router.get('/', (req, res) => {
  const pin = req.sessionPin;
  const sessionDir = getSessionUploadsDir(pin);

  if (!fs.existsSync(sessionDir)) {
    return res.json(['Genel']);
  }

  fs.readdir(sessionDir, { withFileTypes: true }, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read downloads directory' });
    }
    const folders = files
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    if (!folders.includes('Genel')) {
      folders.unshift('Genel');
    }
    res.json(folders);
  });
});

// Create new folder
router.post('/', (req, res) => {
  const { name } = req.body;
  const pin = req.sessionPin;
  if (!name) {
    return res.status(400).json({ error: 'Folder name is required' });
  }
  const cleanName = path.basename(name).trim();
  if (cleanName === '' || cleanName.startsWith('.')) {
    return res.status(400).json({ error: 'Invalid folder name' });
  }

  const sessionDir = getSessionUploadsDir(pin);
  const targetDir = path.join(sessionDir, cleanName);
  if (fs.existsSync(targetDir)) {
    return res.json({ message: 'Folder already exists', name: cleanName });
  }

  fs.mkdir(targetDir, { recursive: true }, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not create folder' });
    }
    broadcastEvent(pin, { type: 'folder_created', name: cleanName });
    res.json({ message: 'Folder created successfully', name: cleanName });
  });
});

// Delete folder
router.delete('/:name', (req, res) => {
  const { name } = req.params;
  const pin = req.sessionPin;
  const cleanName = path.basename(name);
  if (cleanName === 'Genel') {
    return res.status(400).json({ error: 'Genel klasörü silinemez.' });
  }
  
  const sessionDir = getSessionUploadsDir(pin);
  const targetDir = path.join(sessionDir, cleanName);
  if (fs.existsSync(targetDir)) {
    fs.rm(targetDir, { recursive: true, force: true }, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Klasör silinemedi: ' + err.message });
      }
      broadcastEvent(pin, { type: 'folder_deleted', name: cleanName });
      res.json({ message: 'Klasör başarıyla silindi.' });
    });
  } else {
    res.status(404).json({ error: 'Klasör bulunamadı.' });
  }
});

// Rename folder
router.put('/:name', (req, res) => {
  const { name } = req.params;
  const { newName } = req.body;
  const pin = req.sessionPin;
  if (!newName) {
    return res.status(400).json({ error: 'Yeni klasör adı gereklidir.' });
  }

  const cleanOldName = path.basename(name);
  const cleanNewName = path.basename(newName).trim();

  if (cleanOldName === 'Genel' || cleanNewName === 'Genel') {
    return res.status(400).json({ error: 'Genel klasörü yeniden adlandırılamaz.' });
  }
  if (cleanNewName === '' || cleanNewName.startsWith('.')) {
    return res.status(400).json({ error: 'Geçersiz yeni klasör adı.' });
  }

  const sessionDir = getSessionUploadsDir(pin);
  const oldDir = path.join(sessionDir, cleanOldName);
  const newDir = path.join(sessionDir, cleanNewName);

  if (!fs.existsSync(oldDir)) {
    return res.status(404).json({ error: 'Klasör bulunamadı.' });
  }
  if (fs.existsSync(newDir)) {
    return res.status(400).json({ error: 'Bu isimde bir klasör zaten mevcut.' });
  }

  fs.rename(oldDir, newDir, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Yeniden adlandırma başarısız: ' + err.message });
    }
    broadcastEvent(pin, { type: 'folder_renamed', oldName: cleanOldName, newName: cleanNewName });
    res.json({ message: 'Klasör başarıyla yeniden adlandırıldı.', name: cleanNewName });
  });
});

// Map folder to local physical directory on host computer
router.post('/map', (req, res) => {
  const pin = req.sessionPin;
  const { folder, localPath } = req.body;
  if (!folder) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const session = getSession(pin);
  if (!session) {
    return res.status(404).json({ error: 'Oturum bulunamadı!' });
  }

  const safeFolder = path.basename(folder);

  if (!localPath) {
    if (session.folderMappings) {
      delete session.folderMappings[safeFolder];
    }
    return res.json({ success: true, message: 'Klasör yerel eşlemesi kaldırıldı.' });
  }

  const resolvedPath = path.resolve(localPath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(400).json({ error: 'Belirtilen yerel klasör yolu bilgisayarda bulunamadı!' });
  }

  if (!session.folderMappings) {
    session.folderMappings = {};
  }
  session.folderMappings[safeFolder] = resolvedPath;
  console.log(`[🔗] Klasör Eşlendi: [ PIN: ${pin}, Klasör: ${safeFolder} -> ${resolvedPath} ]`);
  saveSessions();
  res.json({ success: true, message: `[${safeFolder}] klasörü başarıyla yerel dizine eşlendi.` });
});

// Get current mapped local path of a folder
router.get('/map', (req, res) => {
  const pin = req.sessionPin;
  const { folder } = req.query;
  if (!folder) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const session = getSession(pin);
  if (!session) {
    return res.status(404).json({ error: 'Oturum bulunamadı!' });
  }

  const safeFolder = path.basename(folder);
  const localPath = (session.folderMappings && session.folderMappings[safeFolder]) || '';
  res.json({ localPath });
});

module.exports = router;
