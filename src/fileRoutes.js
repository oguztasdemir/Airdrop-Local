const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const {
  uploadsDir,
  getFolderDirectory,
  getSafeFilePath,
  readFilesRecursively,
  removeEmptyParentDirs,
  getSessionUploadsDir,
  loadUsers,
  getLocalIpAddress
} = require('./config');
const { broadcastEvent } = require('./sessionRoutes');

// Multer Disk Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const pin = req.headers['x-pin'] || req.query.pin;
    const folderHeader = req.headers['x-folder'] || 'Genel';
    const folderName = path.basename(decodeURIComponent(folderHeader));
    
    let relativeDir = '';
    const originalName = file.originalname || '';
    if (originalName.includes('/') || originalName.includes('\\')) {
      const normalizedPath = originalName.replace(/\\/g, '/');
      const lastSlashIdx = normalizedPath.lastIndexOf('/');
      relativeDir = normalizedPath.substring(0, lastSlashIdx);
    }
    
    const baseFolderDir = getFolderDirectory(pin, folderName);
    const targetDir = path.join(baseFolderDir, relativeDir);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const time = new Date().toISOString().replace(/[:.]/g, '-');
    let baseName = file.originalname || 'file';
    if (baseName.includes('/') || baseName.includes('\\')) {
      const normalizedPath = baseName.replace(/\\/g, '/');
      baseName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
    }
    const cleanOriginalName = baseName.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${time}_${cleanOriginalName}`);
  }
});
const upload = multer({ storage: storage });

// Helpers
function getFolderSize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (let i = 0; i < files.length; i++) {
      const filePath = path.join(dirPath, files[i]);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getFolderSize(filePath);
      } else {
        size += stats.size;
      }
    }
  } catch (e) {}
  return size;
}

function cleanFaceCache(pin, folder, filenames) {
  const targetDir = getFolderDirectory(pin, folder);
  const cachePath = path.join(targetDir, '.face_cache.json');
  if (fs.existsSync(cachePath)) {
    fs.readFile(cachePath, 'utf-8', (err, data) => {
      if (err) return;
      try {
        const cache = JSON.parse(data);
        let updated = false;
        filenames.forEach(filename => {
          if (cache[filename]) {
            delete cache[filename];
            updated = true;
          }
        });
        if (updated) {
          fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8', () => {});
        }
      } catch (e) {}
    });
  }
}

const { exec } = require('child_process');
function getDiskSpace(cb) {
  const currentDrive = path.resolve(__dirname, '..').substring(0, 1).toUpperCase();
  
  if (process.platform === 'win32') {
    exec(`powershell -Command "Get-Volume -DriveLetter ${currentDrive} | ConvertTo-Json"`, (err, stdout) => {
      if (err) {
        exec(`wmic logicaldisk where "DeviceID='${currentDrive}:'" get FreeSpace,Size /value`, (wmicErr, wmicStdout) => {
          if (wmicErr) {
            return cb(null, { free: 0, total: 0 });
          }
          const lines = wmicStdout.split('\n');
          let free = 0;
          let total = 0;
          lines.forEach(line => {
            if (line.startsWith('FreeSpace=')) {
              free = parseInt(line.split('=')[1].trim(), 10);
            }
            if (line.startsWith('Size=')) {
              total = parseInt(line.split('=')[1].trim(), 10);
            }
          });
          cb(null, { free, total });
        });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        cb(null, {
          free: data.SizeRemaining || 0,
          total: data.Size || 0
        });
      } catch (e) {
        cb(null, { free: 0, total: 0 });
      }
    });
  } else {
    exec('df -B1 .', (err, stdout) => {
      if (err) return cb(null, { free: 0, total: 0 });
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].replace(/\s+/g, ' ').split(' ');
        const total = parseInt(parts[1], 10) || 0;
        const free = parseInt(parts[3], 10) || 0;
        cb(null, { free, total });
      } else {
        cb(null, { free: 0, total: 0 });
      }
    });
  }
}

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

// Routes

// Get list of uploaded files in a specific folder
router.get('/', (req, res) => {
  const pin = req.sessionPin;
  const targetFolder = req.query.folder || 'Genel';
  const safeFolder = path.basename(targetFolder);
  const targetDir = getFolderDirectory(pin, safeFolder);

  if (!fs.existsSync(targetDir)) {
    return res.json([]);
  }

  try {
    const allFiles = readFilesRecursively(targetDir, targetDir);
    const fileDetails = allFiles.map(item => {
      const encodedUrl = `/api/serve-file?folder=${encodeURIComponent(safeFolder)}&filename=${encodeURIComponent(item.relativePath)}`;
      return {
        name: item.relativePath,
        folder: safeFolder,
        url: encodedUrl,
        size: item.stat.size,
        createdAt: item.stat.mtime
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

    res.json(fileDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to scan files' });
  }
});

// Upload endpoint
router.post('/upload', upload.any(), (req, res) => {
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
router.delete('/files/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const pin = req.sessionPin;
  const safeFolder = path.basename(folder);
  
  const baseDir = getFolderDirectory(pin, safeFolder);
  const filePath = getSafeFilePath(baseDir, filename);

  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not delete file' });
      }
      
      removeEmptyParentDirs(filePath, baseDir);
      cleanFaceCache(pin, safeFolder, [filename]);
      broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: filename });
      res.json({ message: 'File deleted successfully' });
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Zip download endpoint
router.get('/zip/:folder', (req, res) => {
  const pin = req.sessionPin;
  const targetFolder = req.params.folder || 'Genel';
  const safeFolder = path.basename(targetFolder);
  
  const targetDir = getFolderDirectory(pin, safeFolder);

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'Klasör bulunamadı' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFolder)}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);
  archive.directory(targetDir, false, (entry) => {
    if (entry.name === '.face_cache.json' || entry.name.endsWith('/.face_cache.json') || entry.name.endsWith('\\.face_cache.json')) {
      return false;
    }
    return entry;
  });
  archive.finalize();
});

// Move files endpoint
router.post('/move', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filenames, targetPath, zipAndMove } = req.body;
  if (!folder || !filenames || !Array.isArray(filenames) || !targetPath) {
    return res.status(400).json({ error: 'Folder, filenames array, and targetPath are required' });
  }

  const safeFolder = path.basename(folder);
  const sourceDir = getFolderDirectory(pin, safeFolder);
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
      cleanFaceCache(pin, safeFolder, filenames);
      broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: 'batch' });
      return res.json({ message: `Dosyalar başarıyla sıkıştırılarak ${zipFilename} adıyla taşındı.` });
    });

    archive.on('error', (err) => {
      return res.status(500).json({ error: 'Sıkıştırma başarısız oldu: ' + err.message });
    });

    archive.pipe(output);

    filenames.forEach(filename => {
      const safeFilename = path.basename(filename);
      if (safeFilename === '.face_cache.json') return;
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
      if (safeFilename === '.face_cache.json') {
        completed++;
        if (completed === filenames.length) {
          cleanFaceCache(pin, safeFolder, filenames);
          broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: 'batch' });
          if (errors.length > 0) {
            return res.status(207).json({ message: 'Bazı dosyalar taşınamadı', errors });
          }
          return res.json({ message: 'Tüm dosyalar başarıyla taşındı' });
        }
        return;
      }
      const srcPath = path.join(sourceDir, safeFilename);
      const destPath = path.join(targetDir, safeFilename);

      if (fs.existsSync(srcPath)) {
        safeMove(srcPath, destPath, (err) => {
          completed++;
          if (err) {
            errors.push({ filename, error: err.message });
          }
          if (completed === filenames.length) {
            cleanFaceCache(pin, safeFolder, filenames);
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
          cleanFaceCache(pin, safeFolder, filenames);
          broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: 'batch' });
          return res.status(207).json({ message: 'Bazı dosyalar taşınamadı', errors });
        }
      }
    });
  }
});

// Extract ZIP file
router.post('/extract', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filename } = req.body;
  if (!folder || !filename) {
    return res.status(400).json({ error: 'Folder and filename are required' });
  }

  const safeFolder = path.basename(folder);
  const baseDir = getFolderDirectory(pin, safeFolder);
  const zipPath = getSafeFilePath(baseDir, filename);

  if (!zipPath || !fs.existsSync(zipPath)) {
    return res.status(404).json({ error: 'ZIP dosyası bulunamadı.' });
  }

  const baseFilename = path.basename(filename);
  const cleanBaseName = baseFilename.replace(/\.zip$/i, '');
  const extractDir = path.join(path.dirname(zipPath), `${cleanBaseName}_ayiklanan`);

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
router.get('/files/content', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filename } = req.query;
  if (!folder || !filename) {
    return res.status(400).json({ error: 'Folder and filename are required' });
  }

  const safeFolder = path.basename(folder);
  const baseDir = getFolderDirectory(pin, safeFolder);
  const filePath = getSafeFilePath(baseDir, filename);

  if (!filePath || !fs.existsSync(filePath)) {
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

// Serve file content safely
router.get('/serve-file', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filename } = req.query;
  if (!folder || !filename) {
    return res.status(400).end();
  }

  const safeFolder = path.basename(folder);
  const targetDir = getFolderDirectory(pin, safeFolder);
  const filePath = getSafeFilePath(targetDir, filename);

  if (filePath && fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).end();
  }
});

// Get user storage stats
router.get('/user/storage-stats', (req, res) => {
  const { account, pin } = req.query;
  if (!account) {
    return res.status(400).json({ error: 'Account is required' });
  }
  const cleanAccount = path.basename(account).trim();
  const accountDir = path.join(uploadsDir, `account_${cleanAccount}`);
  const sessionDir = pin ? path.join(accountDir, `session_${pin}`) : null;

  const totalUsage = getFolderSize(accountDir);
  const roomUsage = sessionDir ? getFolderSize(sessionDir) : 0;

  const users = loadUsers();
  const userObj = users[cleanAccount.toLowerCase()] || { email: 'Misafir Girişi' };

  getDiskSpace((err, diskInfo) => {
    res.json({
      email: userObj.email,
      totalUsage,
      roomUsage,
      diskFree: diskInfo.free,
      diskTotal: diskInfo.total
    });
  });
});

// Batch delete files endpoint
router.post('/files/delete-batch', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filenames } = req.body;
  if (!folder || !filenames || !Array.isArray(filenames)) {
    return res.status(400).json({ error: 'Folder and filenames array are required' });
  }

  const safeFolder = path.basename(folder);
  const baseDir = getFolderDirectory(pin, safeFolder);
  
  let deletedCount = 0;
  let errors = [];

  filenames.forEach(filename => {
    const filePath = getSafeFilePath(baseDir, filename);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        removeEmptyParentDirs(filePath, baseDir);
        deletedCount++;
      } catch (err) {
        errors.push({ filename, error: err.message });
      }
    } else {
      errors.push({ filename, error: 'File not found' });
    }
  });

  cleanFaceCache(pin, safeFolder, filenames);
  broadcastEvent(pin, { type: 'delete', folder: safeFolder, filename: 'batch' });
  res.json({ success: true, deletedCount, errors });
});

// Batch zip files endpoint
router.post('/zip-batch', (req, res) => {
  const pin = req.sessionPin;
  const { folder, filenames } = req.body;
  if (!folder || !filenames || !Array.isArray(filenames)) {
    return res.status(400).json({ error: 'Folder and filenames array are required' });
  }

  const safeFolder = path.basename(folder);
  const sourceDir = getFolderDirectory(pin, safeFolder);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFolder)}_secilenler.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  filenames.forEach(filename => {
    const safeFilename = path.basename(filename);
    if (safeFilename === '.face_cache.json') return;
    const srcPath = path.join(sourceDir, safeFilename);
    if (fs.existsSync(srcPath)) {
      archive.file(srcPath, { name: safeFilename });
    }
  });

  archive.finalize();
});

// Get face recognition cache for a specific folder
router.get('/face-cache', (req, res) => {
  const pin = req.sessionPin;
  const targetFolder = req.query.folder || 'Genel';
  const safeFolder = path.basename(targetFolder);
  const targetDir = getFolderDirectory(pin, safeFolder);
  const cachePath = path.join(targetDir, '.face_cache.json');

  if (fs.existsSync(cachePath)) {
    fs.readFile(cachePath, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to read face cache' });
      }
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.json({});
      }
    });
  } else {
    res.json({});
  }
});

// Save face recognition cache for a specific folder
router.post('/face-cache', (req, res) => {
  const pin = req.sessionPin;
  const { folder, cache } = req.body;
  if (!folder || !cache) {
    return res.status(400).json({ error: 'Folder and cache data are required' });
  }

  const safeFolder = path.basename(folder);
  const targetDir = getFolderDirectory(pin, safeFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const cachePath = path.join(targetDir, '.face_cache.json');
  fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save face cache' });
    }
    res.json({ success: true });
  });
});

module.exports = router;
