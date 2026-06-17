require('dotenv').config();
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const downloadModels = require('./download-models');

// Start download of face-api models asynchronously on startup
downloadModels().catch(err => {
  console.error('Yüz tanıma modelleri indirilemedi:', err.message);
});

const {
  PORT,
  uploadsDir,
  sessions,
  saveSessions,
  getSessionUploadsDir,
  getLocalIpAddress
} = require('./config');

const app = express();

// Middleware to extract X-PIN session identifier
function pinAuth(req, res, next) {
  const pin = req.headers['x-pin'] || req.query.pin;
  req.sessionPin = pin;
  next();
}

app.use(express.json());
app.use(pinAuth);

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, '..', 'public')));
app.use('/downloads', express.static(uploadsDir));

// Mount Routers
const authRoutes = require('./authRoutes');
const { router: sessionRoutes } = require('./sessionRoutes');
const folderRoutes = require('./folderRoutes');
const fileRoutes = require('./fileRoutes');
const chatRoutes = require('./chatRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api', fileRoutes); // routes start with /files etc.
app.use('/api', chatRoutes); // routes start with /chat, /clipboard

// Status & IP Endpoint
app.get('/api/status', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    ip: localIp,
    port: PORT,
    uploadUrl: `http://${localIp}:${PORT}`
  });
});

// PowerShell select folder utilities for Windows
const folderSelectHandler = (req, res) => {
  if (process.platform !== 'win32') {
    return res.status(400).json({ error: 'Klasör seçimi sadece Windows platformunda desteklenmektedir.' });
  }

  const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; \\$o = New-Object System.Windows.Forms.OpenFileDialog; \\$o.Filter = 'Klasör Seçin|*'; \\$o.CheckFileExists = \\$false; \\$o.CheckPathExists = \\$true; \\$o.FileName = 'Klasör Seçin'; \\$o.Title = 'Klasör Seçin'; if (\\$o.ShowDialog() -eq 'OK') { Write-Output ([System.IO.Path]::GetDirectoryName(\\$o.FileName)) } else { Write-Output 'CANCEL' }"`;

  exec(psCommand, (err, stdout, stderr) => {
    if (err) {
      console.error('Klasör seçici hatası:', err);
      return res.status(500).json({ error: 'Klasör seçici penceresi açılamadı.' });
    }
    const selectedPath = stdout.trim();
    if (selectedPath === 'CANCEL' || !selectedPath) {
      res.json({ cancelled: true, path: null });
    } else {
      res.json({ success: true, path: selectedPath });
    }
  });
};

app.get('/api/utils/select-folder', folderSelectHandler);
app.post('/api/utils/select-folder', folderSelectHandler);

app.get('/api/utils/user-paths', (req, res) => {
  const os = require('os');
  const homedir = os.homedir();
  res.json({
    desktop: path.join(homedir, 'Desktop'),
    documents: path.join(homedir, 'Documents'),
    downloads: path.join(homedir, 'Downloads'),
    pictures: path.join(homedir, 'Pictures')
  });
});

// Garbage Collector: Clear sessions inactive for > 24 hours
const { broadcastGlobalSessionsUpdate } = require('./sessionRoutes');
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
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
  saveSessions();
  broadcastGlobalSessionsUpdate();
}, 60 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`--------------------------------------------------`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Local Network URL: http://${localIp}:${PORT}`);
  console.log(`--------------------------------------------------`);
});
