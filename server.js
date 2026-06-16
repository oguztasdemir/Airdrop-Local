const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');
const AdmZip = require('adm-zip');

const app = express();
const PORT = 3000;

// Setup base uploads directory
const uploadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Session store
let sessions = {};

// Helper to resolve session-specific directories
function getSessionUploadsDir(pin) {
  return path.join(uploadsDir, `session_${pin}`);
}

function createSessionDirs(pin) {
  const sessionDir = getSessionUploadsDir(pin);
  const defaultFolder = path.join(sessionDir, 'Genel');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  if (!fs.existsSync(defaultFolder)) {
    fs.mkdirSync(defaultFolder, { recursive: true });
  }
}

// Security PIN validation middleware
function pinAuth(req, res, next) {
  // Allow index.html, static files, session creation and status
  if (req.path === '/api/sessions/create' || req.path === '/api/status') {
    return next();
  }

  const isApi = req.path.startsWith('/api/');
  const isDownload = req.path.startsWith('/downloads/');

  if (!isApi && !isDownload) {
    return next(); // Serve frontend pages directly
  }

  if (isDownload) {
    // Extract session PIN from the path: /downloads/session_[PIN]/...
    const match = req.path.match(/^\/downloads\/session_([a-zA-Z0-9]+)\//);
    const pinFromPath = match ? match[1] : null;
    const pinParam = req.headers['x-pin'] || req.query.pin;
    if (pinFromPath && pinParam === pinFromPath && sessions[pinFromPath]) {
      return next();
    } else {
      return res.status(401).json({ error: 'Unauthorized. Invalid PIN for this file.' });
    }
  }

  // API endpoints
  const pin = req.headers['x-pin'] || req.query.pin;
  if (!pin || !sessions[pin]) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or expired Session PIN.' });
  }

  req.sessionPin = pin;
  next();
}

// Configure multer storage using dynamic session paths
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const pin = req.headers['x-pin'] || req.query.pin;
    const folderHeader = req.headers['x-folder'] || 'Genel';
    const folderName = path.basename(decodeURIComponent(folderHeader));
    const targetDir = path.join(uploadsDir, `session_${pin}`, folderName);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const time = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${time}_${cleanOriginalName}`);
  }
});

const upload = multer({ storage: storage });

function getSession(pin) {
  if (!pin) return null;
  return sessions[pin] || null;
}

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

function broadcastDeviceList(pin) {
  const session = getSession(pin);
  if (!session) return;
  const devices = session.sseClients.map(c => ({ id: c.id, device: c.device }));
  broadcastEvent(pin, { type: 'device_list_update', devices });
}

// JSON parser
app.use(express.json());

// PIN Auth middleware
app.use(pinAuth);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(uploadsDir));

// Helper to get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
          return iface.address;
        }
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Session creation endpoint
app.post('/api/sessions/create', (req, res) => {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit PIN
  } while (sessions[pin]);

  sessions[pin] = {
    sseClients: [],
    clipboardItems: [],
    chatMessages: [],
    createdAt: new Date()
  };

  createSessionDirs(pin);
  console.log(`[+] Yeni Oturum Oluşturuldu: [ PIN: ${pin} ]`);
  res.json({ pin });
});

// Server-Sent Events subscription for real-time updates
app.get('/api/events', (req, res) => {
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

// Get server status & local IP
app.get('/api/status', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    ip: localIp,
    port: PORT,
    uploadUrl: `http://${localIp}:${PORT}`
  });
});

// Get list of folders
app.get('/api/folders', (req, res) => {
  const pin = req.sessionPin;
  const sessionDir = getSessionUploadsDir(pin);

  fs.readdir(sessionDir, { withFileTypes: true }, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read downloads directory' });
    }
    const folders = files
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Ensure 'Genel' is always included
    if (!folders.includes('Genel')) {
      folders.unshift('Genel');
    }
    res.json(folders);
  });
});

// Create new folder
app.post('/api/folders', (req, res) => {
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
app.delete('/api/folders/:name', (req, res) => {
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
app.put('/api/folders/:name', (req, res) => {
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

// Get list of uploaded files in a specific folder
app.get('/api/files', (req, res) => {
  const pin = req.sessionPin;
  const targetFolder = req.query.folder || 'Genel';
  const safeFolder = path.basename(targetFolder);
  
  const sessionDir = getSessionUploadsDir(pin);
  const targetDir = path.join(sessionDir, safeFolder);

  if (!fs.existsSync(targetDir)) {
    return res.json([]);
  }

  fs.readdir(targetDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to scan files' });
    }

    const fileDetails = files
      .map(file => {
        const filePath = path.join(targetDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          folder: safeFolder,
          url: `/downloads/session_${pin}/${encodeURIComponent(safeFolder)}/${encodeURIComponent(file)}`,
          size: stats.size,
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json(fileDetails);
  });
});

// Upload endpoint
app.post('/api/upload', upload.any(), (req, res) => {
  const pin = req.sessionPin;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  const folder = req.headers['x-folder'] || 'Genel';
  const safeFolder = path.basename(decodeURIComponent(folder));

  console.log(`[Oturum: ${pin}] ${req.files.length} dosya [${safeFolder}] klasörüne yüklendi.`);
  
  broadcastEvent(pin, { 
    type: 'upload', 
    folder: safeFolder,
    files: req.files.map(f => f.filename) 
  });

  res.json({
    message: 'Upload complete',
    folder: safeFolder,
    files: req.files.map(f => f.filename)
  });
});

// Delete endpoint
app.delete('/api/files/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const pin = req.sessionPin;
  const safeFolder = path.basename(folder);
  const safeFilename = path.basename(filename);
  
  const sessionDir = getSessionUploadsDir(pin);
  const filePath = path.join(sessionDir, safeFolder, safeFilename);

  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not delete file' });
      }
      
      broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: safeFilename });
      res.json({ message: 'File deleted successfully' });
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Zip download endpoint
app.get('/api/zip/:folder', (req, res) => {
  const pin = req.sessionPin;
  const targetFolder = req.params.folder || 'Genel';
  const safeFolder = path.basename(targetFolder);
  
  const sessionDir = getSessionUploadsDir(pin);
  const targetDir = path.join(sessionDir, safeFolder);

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'Klasör bulunamadı' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFolder)}.zip"`);

  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);
  archive.directory(targetDir, false);
  archive.finalize();
});

// Get clipboard items
app.get('/api/clipboard', (req, res) => {
  const pin = req.sessionPin;
  const session = getSession(pin);
  res.json(session ? session.clipboardItems : []);
});

// Add item to clipboard
app.post('/api/clipboard', (req, res) => {
  const pin = req.sessionPin;
  const session = getSession(pin);
  if (!session) return res.status(404).end();

  const { text, device } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  const item = {
    id: Date.now().toString(),
    text,
    device: device || 'Bilinmeyen Cihaz',
    createdAt: new Date()
  };
  session.clipboardItems.unshift(item);
  if (session.clipboardItems.length > 50) {
    session.clipboardItems = session.clipboardItems.slice(0, 50);
  }
  broadcastEvent(pin, { type: 'clipboard_update', items: session.clipboardItems });
  res.json(item);
});

// Delete item from clipboard
app.delete('/api/clipboard/:id', (req, res) => {
  const pin = req.sessionPin;
  const session = getSession(pin);
  if (!session) return res.status(404).end();

  const { id } = req.params;
  session.clipboardItems = session.clipboardItems.filter(item => item.id !== id);
  broadcastEvent(pin, { type: 'clipboard_update', items: session.clipboardItems });
  res.json({ message: 'Item deleted successfully' });
});

// Safe file moving helper
function safeMove(src, dest, callback) {
  fs.rename(src, dest, (err) => {
    if (err) {
      fs.copyFile(src, dest, (copyErr) => {
        if (copyErr) return callback(copyErr);
        fs.unlink(src, (unlinkErr) => {
          if (unlinkErr) return callback(unlinkErr);
          callback(null);
        });
      });
    } else {
      callback(null);
    }
  });
}

// User home directory folders resolver
app.get('/api/user-paths', (req, res) => {
  const home = os.homedir();
  res.json({
    desktop: path.join(home, 'Desktop'),
    documents: path.join(home, 'Documents'),
    downloads: path.join(home, 'Downloads'),
    pictures: path.join(home, 'Pictures')
  });
});

// Move files endpoint
app.post('/api/move', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filenames, targetPath, zipAndMove } = req.body;
  if (!folder || !filenames || !Array.isArray(filenames) || !targetPath) {
    return res.status(400).json({ error: 'Folder, filenames array, and targetPath are required' });
  }

  const safeFolder = path.basename(folder);
  const sessionDir = getSessionUploadsDir(pin);
  const sourceDir = path.join(sessionDir, safeFolder);
  const targetDir = path.resolve(targetPath);

  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      return res.status(500).json({ error: 'Hedef dizin oluşturulamadı: ' + err.message });
    }
  }

  if (filenames.length === 0) {
    return res.json({ message: 'Taşınacak dosya yok' });
  }

  if (zipAndMove) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const zipFilename = `${safeFolder}_${timestamp}.zip`;
    const destZipPath = path.join(targetDir, zipFilename);

    const output = fs.createWriteStream(destZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      filenames.forEach(filename => {
        const safeFilename = path.basename(filename);
        const srcPath = path.join(sourceDir, safeFilename);
        if (fs.existsSync(srcPath)) {
          fs.unlink(srcPath, (err) => {
            if (err) console.error(`Kaynak dosya silinemedi: ${filename}`, err);
          });
        }
      });
      broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: 'batch' });
      return res.json({ message: `Dosyalar başarıyla sıkıştırılarak ${zipFilename} adıyla taşındı.` });
    });

    archive.on('error', (err) => {
      return res.status(500).json({ error: 'Sıkıştırma başarısız oldu: ' + err.message });
    });

    archive.pipe(output);

    filenames.forEach(filename => {
      const safeFilename = path.basename(filename);
      const srcPath = path.join(sourceDir, safeFilename);
      if (fs.existsSync(srcPath)) {
        archive.file(srcPath, { name: safeFilename });
      }
    });

    archive.finalize();

  } else {
    let completed = 0;
    let errors = [];

    filenames.forEach(filename => {
      const safeFilename = path.basename(filename);
      const srcPath = path.join(sourceDir, safeFilename);
      const destPath = path.join(targetDir, safeFilename);

      if (fs.existsSync(srcPath)) {
        safeMove(srcPath, destPath, (err) => {
          completed++;
          if (err) {
            errors.push({ filename, error: err.message });
          }
          if (completed === filenames.length) {
            broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: 'batch' });
            if (errors.length > 0) {
              return res.status(207).json({ message: 'Bazı dosyalar taşınamadı', errors });
            }
            return res.json({ message: 'Tüm dosyalar başarıyla taşındı' });
          }
        });
      } else {
        completed++;
        errors.push({ filename, error: 'Dosya bulunamadı' });
        if (completed === filenames.length) {
          broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: 'batch' });
          return res.status(207).json({ message: 'Bazı dosyalar taşınamadı', errors });
        }
      }
    });
  }
});

// Extract ZIP file on server
app.post('/api/extract', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filename } = req.body;
  if (!folder || !filename) {
    return res.status(400).json({ error: 'Folder and filename are required' });
  }

  const safeFolder = path.basename(folder);
  const safeFilename = path.basename(filename);
  
  const sessionDir = getSessionUploadsDir(pin);
  const zipPath = path.join(sessionDir, safeFolder, safeFilename);

  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: 'ZIP dosyası bulunamadı.' });
  }

  const cleanBaseName = safeFilename.replace(/\.zip$/i, '');
  const extractDir = path.join(sessionDir, safeFolder, `${cleanBaseName}_ayiklanan`);

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);
    broadcastEvent(pin, { type: 'upload', folder: safeFolder, files: ['extracted'] });
    res.json({ message: `Arşiv başarıyla '${cleanBaseName}_ayiklanan' klasörüne çıkarıldı.` });
  } catch (err) {
    res.status(500).json({ error: 'ZIP ayıklama hatası: ' + err.message });
  }
});

// Read file text content safely
app.get('/api/files/content', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filename } = req.query;
  if (!folder || !filename) {
    return res.status(400).json({ error: 'Folder and filename are required' });
  }

  const safeFolder = path.basename(folder);
  const safeFilename = path.basename(filename);
  
  const sessionDir = getSessionUploadsDir(pin);
  const filePath = path.join(sessionDir, safeFolder, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Dosya bulunamadı.' });
  }

  const stats = fs.statSync(filePath);
  if (stats.size > 1024 * 1024) {
    return res.status(400).json({ error: 'Dosya boyutu 1MB\'tan büyük olduğu için önizlenemez.' });
  }

  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Dosya okunamadı: ' + err.message });
    }
    res.json({ content: data });
  });
});

// Get chat messages
app.get('/api/chat', (req, res) => {
  const pin = req.sessionPin;
  const session = getSession(pin);
  res.json(session ? session.chatMessages : []);
});

// Post chat message
app.post('/api/chat', (req, res) => {
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
  res.json(message);
});

// Garbage Collector: Clear sessions inactive for > 24 hours
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  Object.keys(sessions).forEach(pin => {
    const session = sessions[pin];
    if (session.sseClients.length === 0 && (now - session.createdAt) > maxAge) {
      console.log(`[*] Temizlik: ${pin} nolu inaktif oturum temizleniyor.`);
      const sessionDir = getSessionUploadsDir(pin);
      if (fs.existsSync(sessionDir)) {
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (e) {
          console.error(`Oturum dizini silinemedi: ${sessionDir}`, e);
        }
      }
      delete sessions[pin];
    }
  });
}, 60 * 60 * 1000); // Clean every hour

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`--------------------------------------------------`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Local Network URL: http://${localIp}:${PORT}`);
  console.log(`--------------------------------------------------`);
});
