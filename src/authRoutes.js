const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const {
  uploadsDir,
  loadUsers,
  saveUsers,
  resetCodes,
  sendResetEmail
} = require('./config');

// Profile Upload configuration
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const username = req.headers['x-username'] || 'default';
    const cleanUsername = path.basename(username).replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim();
    const targetDir = path.join(uploadsDir, 'profiles', cleanUsername);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const time = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `ref_${time}${ext}`);
  }
});
const uploadProfile = multer({ storage: profileStorage });

// Guest Login
router.post('/guest', (req, res) => {
  const guestId = Math.random().toString(36).substring(2, 6).toUpperCase();
  const guestUsername = `Misafir_${guestId}`;
  console.log(`[+] Misafir Girişi Yapıldı: ${guestUsername}`);
  res.json({ success: true, username: guestUsername });
});

// User Registration
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Tüm alanları doldurmak zorunludur.' });
  }

  const cleanUsername = username.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim();
  if (!cleanUsername) {
    return res.status(400).json({ error: 'Geçersiz kullanıcı adı.' });
  }

  const users = loadUsers();
  
  if (users[cleanUsername.toLowerCase()]) {
    return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
  }

  const emailExists = Object.values(users).some(u => u.email.toLowerCase() === email.toLowerCase());
  if (emailExists) {
    return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  users[cleanUsername.toLowerCase()] = {
    username: cleanUsername,
    email: email.toLowerCase(),
    passwordHash: passwordHash,
    createdAt: new Date()
  };

  saveUsers(users);

  console.log(`[+] Yeni Kullanıcı Kayıt Oldu: ${cleanUsername} (${email})`);
  res.json({ success: true, username: cleanUsername });
});

// User Login
router.post('/login', (req, res) => {
  const { loginIdentifier, password } = req.body;
  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı/e-posta ve şifre gereklidir.' });
  }

  const users = loadUsers();
  let foundUser = null;

  const lowerIdentifier = loginIdentifier.toLowerCase();
  if (users[lowerIdentifier]) {
    foundUser = users[lowerIdentifier];
  } else {
    foundUser = Object.values(users).find(u => u.email.toLowerCase() === lowerIdentifier);
  }

  if (!foundUser) {
    return res.status(401).json({ error: 'Hatalı kullanıcı adı, e-posta veya şifre.' });
  }

  const isMatch = bcrypt.compareSync(password, foundUser.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Hatalı kullanıcı adı, e-posta veya şifre.' });
  }

  res.json({ success: true, username: foundUser.username });
});

// Forgot Password - Send Code
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'E-posta adresi gereklidir.' });
  }

  const users = loadUsers();
  const lowerEmail = email.toLowerCase();
  const user = Object.values(users).find(u => u.email.toLowerCase() === lowerEmail);

  if (!user) {
    return res.status(404).json({ error: 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  resetCodes[lowerEmail] = {
    code: code,
    expires: Date.now() + 10 * 60 * 1000
  };

  sendResetEmail(user.email, code, (err, info) => {
    if (err) {
      return res.status(500).json({ error: 'Sıfırlama kodu gönderilemedi. Lütfen tekrar deneyin.' });
    }
    res.json({ success: true, message: 'Doğrulama kodu e-posta adresinize gönderildi.' });
  });
});

// Reset Password
router.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Tüm alanları doldurmak zorunludur.' });
  }

  const lowerEmail = email.toLowerCase();
  const record = resetCodes[lowerEmail];

  if (!record) {
    return res.status(400).json({ error: 'Doğrulama kodu bulunamadı veya süresi doldu.' });
  }

  if (record.code !== code.trim()) {
    return res.status(400).json({ error: 'Hatalı doğrulama kodu.' });
  }

  if (Date.now() > record.expires) {
    delete resetCodes[lowerEmail];
    return res.status(400).json({ error: 'Doğrulama kodunun süresi dolmuş.' });
  }

  const users = loadUsers();
  const userKey = Object.keys(users).find(k => users[k].email.toLowerCase() === lowerEmail);

  if (!userKey) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }

  const salt = bcrypt.genSaltSync(10);
  users[userKey].passwordHash = bcrypt.hashSync(newPassword, salt);
  saveUsers(users);

  delete resetCodes[lowerEmail];

  console.log(`[✏️] Şifre Yenilendi: ${users[userKey].username}`);
  res.json({ success: true, message: 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
});

// Get active user accounts
router.get('/accounts', (req, res) => {
  const users = loadUsers();
  const accounts = Object.values(users).map(u => u.username);
  res.json(accounts);
});

// Profile upload-ref
router.post('/profile/upload-ref', uploadProfile.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya yüklenemedi.' });
  }
  const username = req.headers['x-username'] || 'default';
  const cleanUsername = path.basename(username).replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim();
  const relativePath = `profiles/${cleanUsername}/${req.file.filename}`;
  res.json({ success: true, url: `/downloads/${relativePath}` });
});

// Profile descriptors POST
router.post('/profile/descriptors', (req, res) => {
  const { username, descriptor, imageUrl } = req.body;
  if (!username || !descriptor) {
    return res.status(400).json({ error: 'Kullanıcı adı ve yüz tanıma verisi gereklidir.' });
  }
  const users = loadUsers();
  const userKey = username.toLowerCase();
  if (!users[userKey]) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }
  if (!users[userKey].faceDescriptors) {
    users[userKey].faceDescriptors = [];
  }
  users[userKey].faceDescriptors.push({ descriptor, imageUrl });
  saveUsers(users);
  res.json({ success: true });
});

// Profile descriptors GET
router.get('/profile/descriptors', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'Kullanıcı adı gereklidir.' });
  }
  const users = loadUsers();
  const userKey = username.toLowerCase();
  if (!users[userKey]) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }
  res.json(users[userKey].faceDescriptors || []);
});

// Profile descriptors delete
router.post('/profile/descriptors/delete', (req, res) => {
  const { username, index } = req.body;
  if (!username || index === undefined) {
    return res.status(400).json({ error: 'Kullanıcı adı ve silinecek resim sırası gereklidir.' });
  }
  const users = loadUsers();
  const userKey = username.toLowerCase();
  if (!users[userKey] || !users[userKey].faceDescriptors) {
    return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  }
  const item = users[userKey].faceDescriptors[index];
  if (item && item.imageUrl) {
    const relativePart = item.imageUrl.replace('/downloads/', '');
    const filePath = path.join(uploadsDir, relativePart);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { console.error(e); }
    }
  }
  users[userKey].faceDescriptors.splice(index, 1);
  saveUsers(users);
  res.json({ success: true });
});

// User password change from settings panel
router.post('/user/change-password', (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Tüm alanlar gereklidir.' });
  }

  const cleanUsername = username.trim();
  const users = loadUsers();
  const userKey = cleanUsername.toLowerCase();
  const user = users[userKey];

  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }

  const isMatch = bcrypt.compareSync(currentPassword, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
  }

  const salt = bcrypt.genSaltSync(10);
  users[userKey].passwordHash = bcrypt.hashSync(newPassword, salt);
  saveUsers(users);

  console.log(`[✏️] Şifre Değiştirildi (Ayarlar): ${user.username}`);
  res.json({ success: true, message: 'Şifreniz başarıyla değiştirildi.' });
});

module.exports = router;
