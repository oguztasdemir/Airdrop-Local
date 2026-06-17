const path = require('path');
const fs = require('fs');
const os = require('os');
const nodemailer = require('nodemailer');

const PORT = parseInt(process.env.PORT) || 3000;
const uploadsDir = path.resolve(__dirname, '..', 'downloads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const usersFilePath = path.resolve(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  if (!fs.existsSync(usersFilePath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
}

let resetCodes = {};

const smtpConfig = {
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
};

function sendResetEmail(email, code, callback) {
  if (!smtpConfig.host || !smtpConfig.auth.user) {
    console.log(`\n==================================================`);
    console.log(`[TEST MODE] E-posta sıfırlama kodu (${email}): ${code}`);
    console.log(`==================================================\n`);
    return callback(null, { testMode: true });
  }

  const transporter = nodemailer.createTransport(smtpConfig);
  const mailOptions = {
    from: `"AirDrop Local" <${smtpConfig.auth.user}>`,
    to: email,
    subject: 'AirDrop Local Şifre Sıfırlama Kodu',
    text: `Merhaba,\n\nŞifrenizi sıfırlamak için kullanacağınız 6 haneli doğrulama kodu: ${code}\n\nBu kod 10 dakika süreyle geçerlidir.`,
    html: `<h3>Merhaba,</h3><p>Şifrenizi sıfırlamak için kullanacağınız 6 haneli doğrulama kodu:</p><h2 style="color:#6366f1; letter-spacing: 4px;">${code}</h2><p>Bu kod 10 dakika süreyle geçerlidir.</p>`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('E-posta gönderme hatası:', error);
      return callback(error);
    }
    callback(null, info);
  });
}

const sessionsFilePath = path.resolve(__dirname, '..', 'data', 'sessions.json');

function loadSessions() {
  if (!fs.existsSync(sessionsFilePath)) {
    return {};
  }
  try {
    const data = JSON.parse(fs.readFileSync(sessionsFilePath, 'utf-8'));
    Object.keys(data).forEach(pin => {
      data[pin].sseClients = [];
    });
    return data;
  } catch (e) {
    return {};
  }
}

const sessions = loadSessions();
let nextSessionPin = 1;
Object.keys(sessions).forEach(pin => {
  const num = parseInt(pin, 10);
  if (!isNaN(num) && num >= nextSessionPin) {
    nextSessionPin = num + 1;
  }
});

function saveSessions() {
  try {
    const data = {};
    Object.keys(sessions).forEach(pin => {
      data[pin] = {
        account: sessions[pin].account,
        name: sessions[pin].name,
        clipboardItems: sessions[pin].clipboardItems || [],
        chatMessages: sessions[pin].chatMessages || [],
        createdAt: sessions[pin].createdAt,
        folderMappings: sessions[pin].folderMappings || {}
      };
    });
    fs.writeFileSync(sessionsFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Sessions could not be saved:', e);
  }
}

function getSession(pin) {
  if (!pin) return null;
  return sessions[pin] || null;
}

function getSessionUploadsDir(pin) {
  const session = getSession(pin);
  const account = session ? session.account : 'default';
  return path.join(uploadsDir, `account_${account}`, `session_${pin}`);
}

function getFolderDirectory(pin, folderName) {
  const session = getSession(pin);
  if (session && session.folderMappings && session.folderMappings[folderName]) {
    return session.folderMappings[folderName];
  }
  const account = session ? session.account : 'default';
  return path.join(uploadsDir, `account_${account}`, `session_${pin}`, folderName);
}

function createSessionDirs(pin) {
  const session = getSession(pin);
  if (!session) return;
  const account = session.account;
  const accountDir = path.join(uploadsDir, `account_${account}`);
  const sessionDir = path.join(accountDir, `session_${pin}`);
  const defaultFolder = path.join(sessionDir, 'Genel');
  if (!fs.existsSync(accountDir)) {
    fs.mkdirSync(accountDir, { recursive: true });
  }
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  if (!fs.existsSync(defaultFolder)) {
    fs.mkdirSync(defaultFolder, { recursive: true });
  }
}

function getSafeFilePath(baseDir, relativePath) {
  const resolvedPath = path.resolve(baseDir, relativePath);
  if (resolvedPath.startsWith(path.resolve(baseDir))) {
    return resolvedPath;
  }
  return null;
}

function readFilesRecursively(dir, baseDir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file.startsWith('.')) return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(readFilesRecursively(filePath, baseDir));
    } else {
      const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
      results.push({
        filePath,
        relativePath,
        stat
      });
    }
  });
  return results;
}

function removeEmptyParentDirs(filePath, baseDir) {
  let dir = path.dirname(filePath);
  while (dir !== baseDir && dir.startsWith(baseDir)) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      dir = path.dirname(dir);
    } else {
      break;
    }
  }
}

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

module.exports = {
  PORT,
  uploadsDir,
  loadUsers,
  saveUsers,
  resetCodes,
  sendResetEmail,
  sessions,
  get nextSessionPin() { return nextSessionPin; },
  set nextSessionPin(val) { nextSessionPin = val; },
  saveSessions,
  getSession,
  getSessionUploadsDir,
  getFolderDirectory,
  createSessionDirs,
  getSafeFilePath,
  readFilesRecursively,
  removeEmptyParentDirs,
  getLocalIpAddress
};
