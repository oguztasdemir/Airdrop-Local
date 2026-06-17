import { state, secureFetch, showCustomAlert, getUrlPin, escapeHtml, formatBytes } from './state.js';

// DOM Elements
const pinModal = document.getElementById('pinModal');
const pinModalInput = document.getElementById('pinModalInput');
const pinErrorText = document.getElementById('pinErrorText');
const savePinModalBtn = document.getElementById('savePinModalBtn');

const mobileDeviceNameModal = document.getElementById('mobileDeviceNameModal');
const mobileDeviceNameInput = document.getElementById('mobileDeviceNameInput');
const saveMobileDeviceNameBtn = document.getElementById('saveMobileDeviceNameBtn');

const accountModal = document.getElementById('accountModal');
const sessionSelectionSection = document.getElementById('sessionSelectionSection');
const sessionModalListContainer = document.getElementById('sessionModalListContainer');
const backToAccountsBtn = document.getElementById('backToAccountsBtn');
const createNewSessionModalBtn = document.getElementById('createNewSessionModalBtn');

const authSection = document.getElementById('authSection');
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const authLoginForm = document.getElementById('authLoginForm');
const authRegisterForm = document.getElementById('authRegisterForm');
const authLoginIdentifier = document.getElementById('authLoginIdentifier');
const authLoginPassword = document.getElementById('authLoginPassword');
const authLoginSubmitBtn = document.getElementById('authLoginSubmitBtn');
const authGuestBtn = document.getElementById('authGuestBtn');

const authRegisterUsername = document.getElementById('authRegisterUsername');
const authRegisterEmail = document.getElementById('authRegisterEmail');
const authRegisterPassword = document.getElementById('authRegisterPassword');
const authRegisterSubmitBtn = document.getElementById('authRegisterSubmitBtn');

const authForgotPasswordLink = document.getElementById('authForgotPasswordLink');
const authForgotSection = document.getElementById('authForgotSection');
const authForgotEmail = document.getElementById('authForgotEmail');
const authForgotSubmitBtn = document.getElementById('authForgotSubmitBtn');
const authForgotBackBtn = document.getElementById('authForgotBackBtn');

const authResetSection = document.getElementById('authResetSection');
const authResetDesc = document.getElementById('authResetDesc');
const authResetCode = document.getElementById('authResetCode');
const authResetNewPassword = document.getElementById('authResetNewPassword');
const authResetSubmitBtn = document.getElementById('authResetSubmitBtn');
const authResetBackBtn = document.getElementById('authResetBackBtn');

const roomModal = document.getElementById('roomModal');
const roomModalTitle = document.getElementById('roomModalTitle');
const roomModalDesc = document.getElementById('roomModalDesc');
const roomModalInput = document.getElementById('roomModalInput');
const closeRoomModalBtn = document.getElementById('closeRoomModalBtn');
const saveRoomModalBtn = document.getElementById('saveRoomModalBtn');
let roomModalCallback = null;

let selectedAccountForSession = '';

export function showPinModal() {
  if (pinModal) {
    pinModal.classList.remove('hidden');
    pinModal.classList.add('active');
    if (pinModalInput) pinModalInput.focus();
  }
}

export function hidePinModal() {
  if (pinModal) {
    pinModal.classList.remove('active');
    pinModal.classList.add('hidden');
  }
  if (pinErrorText) pinErrorText.classList.add('hidden');
}

export function showDeviceNameModal(callback) {
  if (mobileDeviceNameModal) {
    mobileDeviceNameModal.classList.remove('hidden');
    mobileDeviceNameModal.classList.add('active');
    mobileDeviceNameInput.value = '';
    mobileDeviceNameInput.focus();
    
    const saveHandler = () => {
      const val = mobileDeviceNameInput.value.trim();
      if (!val) return;
      localStorage.setItem('airdrop_device_name', val);
      state.deviceName = val;
      mobileDeviceNameModal.classList.remove('active');
      mobileDeviceNameModal.classList.add('hidden');
      saveMobileDeviceNameBtn.removeEventListener('click', saveHandler);
      callback();
    };
    
    saveMobileDeviceNameBtn.addEventListener('click', saveHandler);
  }
}

export function showAccountModal(startOnSessions = false) {
  if (accountModal) {
    accountModal.classList.remove('hidden');
    accountModal.classList.add('active');
    
    authSection.classList.remove('hidden');
    authForgotSection.classList.add('hidden');
    authResetSection.classList.add('hidden');
    sessionSelectionSection.classList.add('hidden');

    authLoginIdentifier.value = '';
    authLoginPassword.value = '';
    authRegisterUsername.value = '';
    authRegisterEmail.value = '';
    authRegisterPassword.value = '';
    authForgotEmail.value = '';
    authResetCode.value = '';
    authResetNewPassword.value = '';

    const savedAccount = sessionStorage.getItem('airdrop_account') || localStorage.getItem('airdrop_account');
    if (startOnSessions && savedAccount) {
      selectedAccountForSession = savedAccount;
      authSection.classList.add('hidden');
      sessionSelectionSection.classList.remove('hidden');
      fetchSessionsForModal(savedAccount);
    }
  }
}

export function hideAccountModal() {
  if (accountModal) {
    accountModal.classList.remove('active');
    accountModal.classList.add('hidden');
  }
}

function fetchSessionsForModal(username) {
  sessionModalListContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 10px; font-size: 13px;">Oturumlar yükleniyor...</div>`;
  
  fetch(`/api/sessions?account=${encodeURIComponent(username)}`)
    .then(res => res.json())
    .then(sessionsList => {
      if (sessionsList.length === 0) {
        sessionModalListContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;">Aktif oturum bulunamadı. Yeni bir oturum açın!</div>`;
        return;
      }
      
      sessionModalListContainer.innerHTML = sessionsList.map(s => {
        const pin = typeof s === 'object' ? s.pin : s;
        const name = typeof s === 'object' ? s.name : `Oturum #${pin}`;
        return `
          <div class="session-modal-item-wrapper" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px; width: 100%;">
            <button class="session-modal-item" style="flex-grow: 1; text-align: left; padding: 12px 16px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); cursor: pointer; font-weight: 600; font-size: 14px; color: var(--text-main); display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;" data-pin="${pin}">
              <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 200px;">📂 ${escapeHtml(name)} <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">#${pin}</span></span>
              <span style="font-size: 12px; color: var(--accent-color); font-weight: 500; white-space: nowrap; margin-left: 8px;">Bağlan →</span>
            </button>
            <button class="btn-rename-session" data-pin="${pin}" data-name="${escapeHtml(name)}" style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: var(--accent-color); padding: 12px 14px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s; font-size: 13px;" title="Odayı Yeniden Adlandır">✏️</button>
            <button class="btn-delete-session" data-pin="${pin}" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; padding: 12px 14px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s; font-size: 13px;" title="Odayı Sil">🗑️</button>
          </div>
        `;
      }).join('');

      sessionModalListContainer.querySelectorAll('.session-modal-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
          item.style.borderColor = 'var(--accent-color)';
          item.style.background = 'rgba(99, 102, 241, 0.05)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.borderColor = 'var(--glass-border)';
          item.style.background = 'rgba(255,255,255,0.02)';
        });
        item.addEventListener('click', () => {
          connectToSession(item.dataset.pin);
        });
      });

      sessionModalListContainer.querySelectorAll('.btn-rename-session').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const pin = btn.dataset.pin;
          const currentName = btn.dataset.name;
          openRoomModal('Odayı Yeniden Adlandır', 'Yeni oda adını girin:', currentName, 'Oda adı...', (newName) => {
            if (newName && newName.trim()) {
              secureFetch(`/api/sessions/rename/${pin}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() })
              })
              .then(res => res.json())
              .then(() => {
                fetchSessionsForModal(username);
              })
              .catch(err => console.error('Oda yeniden adlandırma hatası:', err));
            }
          });
        });
      });

      sessionModalListContainer.querySelectorAll('.btn-delete-session').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const pin = btn.dataset.pin;
          if (confirm(`Bu odayı ve içindeki tüm dosyaları silmek istediğinizden emin misiniz?`)) {
            secureFetch(`/api/sessions/${pin}`, {
              method: 'DELETE'
            })
            .then(res => res.json())
            .then(() => {
              if (sessionStorage.getItem('airdrop_pin') === pin) {
                sessionStorage.removeItem('airdrop_pin');
                localStorage.removeItem('airdrop_pin');
              }
              fetchSessionsForModal(username);
            })
            .catch(err => console.error('Oda silme hatası:', err));
          }
        });
      });
    })
    .catch(err => {
      console.error('Oturum listesi yüklenemedi:', err);
      sessionModalListContainer.innerHTML = `<div style="text-align: center; color: var(--danger-color); padding: 10px; font-size: 13px;">Oturumlar yüklenemedi.</div>`;
    });
}

function connectToSession(pin) {
  sessionStorage.setItem('airdrop_pin', pin);
  localStorage.setItem('airdrop_pin', pin);
  if (selectedAccountForSession) {
    sessionStorage.setItem('airdrop_account', selectedAccountForSession);
    localStorage.setItem('airdrop_account', selectedAccountForSession);
  }
  hideAccountModal();
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?pin=' + pin;
  window.location.href = newUrl;
}

export function openRoomModal(title, desc, defaultValue, placeholder, callback) {
  if (roomModal) {
    roomModalTitle.textContent = title;
    roomModalDesc.textContent = desc;
    roomModalInput.value = defaultValue || '';
    roomModalInput.placeholder = placeholder || '';
    roomModal.classList.remove('hidden');
    roomModal.classList.add('active');
    setTimeout(() => roomModalInput.focus(), 50);
    roomModalCallback = callback;
  }
}

export function closeRoomModal() {
  if (roomModal) {
    roomModal.classList.remove('active');
    roomModal.classList.add('hidden');
    roomModalCallback = null;
  }
}

// Event Listeners for Auth
export function initAuthListeners(startAppCallback) {
  document.querySelectorAll('#changeAccountBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      sessionStorage.removeItem('airdrop_pin');
      sessionStorage.removeItem('airdrop_account');
      sessionStorage.removeItem('airdrop_session_name');
      localStorage.removeItem('airdrop_pin');
      localStorage.removeItem('airdrop_account');
      localStorage.removeItem('airdrop_session_name');
      showAccountModal(false);
    });
  });

  savePinModalBtn.addEventListener('click', () => {
    const pin = pinModalInput.value.trim();
    if (!pin) return;

    fetch(`/api/sessions/validate/${pin}`)
      .then(res => {
        if (res.status === 401) {
          pinErrorText.classList.remove('hidden');
          pinModalInput.value = '';
          pinModalInput.focus();
        } else {
          return res.json();
        }
      })
      .then(data => {
        if (data) {
          sessionStorage.setItem('airdrop_pin', pin);
          sessionStorage.setItem('airdrop_account', data.account);
          hidePinModal();
          
          const nextStep = () => {
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?pin=' + pin;
            window.location.href = newUrl;
          };

          if (!localStorage.getItem('airdrop_device_name')) {
            showDeviceNameModal(nextStep);
          } else {
            nextStep();
          }
        }
      })
      .catch(err => {
        console.error('Doğrulama hatası:', err);
      });
  });

  pinModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') savePinModalBtn.click();
  });

  mobileDeviceNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveMobileDeviceNameBtn.click();
  });

  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabLoginBtn.style.borderBottomColor = 'var(--accent-color)';
    tabLoginBtn.style.color = 'var(--text-main)';
    tabRegisterBtn.classList.remove('active');
    tabRegisterBtn.style.borderBottomColor = 'transparent';
    tabRegisterBtn.style.color = 'var(--text-muted)';
    authLoginForm.classList.remove('hidden');
    authRegisterForm.classList.add('hidden');
  });

  tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabRegisterBtn.style.borderBottomColor = 'var(--accent-color)';
    tabRegisterBtn.style.color = 'var(--text-main)';
    tabLoginBtn.classList.remove('active');
    tabLoginBtn.style.borderBottomColor = 'transparent';
    tabLoginBtn.style.color = 'var(--text-muted)';
    authRegisterForm.classList.remove('hidden');
    authLoginForm.classList.add('hidden');
  });

  authForgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    authSection.classList.add('hidden');
    authForgotSection.classList.remove('hidden');
    authForgotEmail.focus();
  });

  authForgotBackBtn.addEventListener('click', () => {
    authForgotSection.classList.add('hidden');
    authSection.classList.remove('hidden');
  });

  authResetBackBtn.addEventListener('click', () => {
    authResetSection.classList.add('hidden');
    authSection.classList.remove('hidden');
  });

  authLoginSubmitBtn.addEventListener('click', () => {
    const loginIdentifier = authLoginIdentifier.value.trim();
    const password = authLoginPassword.value;
    if (!loginIdentifier || !password) {
      showCustomAlert('Giriş Hatası', 'Kullanıcı adı/e-posta ve şifre gereklidir.');
      return;
    }

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginIdentifier, password })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'Giriş başarısız.'); });
      }
      return res.json();
    })
    .then(data => {
      sessionStorage.setItem('airdrop_account', data.username);
      localStorage.setItem('airdrop_account', data.username);
      selectedAccountForSession = data.username;
      
      authSection.classList.add('hidden');
      sessionSelectionSection.classList.remove('hidden');
      fetchSessionsForModal(data.username);
    })
    .catch(err => {
      showCustomAlert('Giriş Başarısız', err.message);
    });
  });

  authGuestBtn.addEventListener('click', () => {
    fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => {
      if (!res.ok) throw new Error('Misafir girişi sunucu tarafından reddedildi.');
      return res.json();
    })
    .then(data => {
      sessionStorage.setItem('airdrop_account', data.username);
      localStorage.setItem('airdrop_account', data.username);
      selectedAccountForSession = data.username;
      
      return fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.username, name: '' })
      })
      .then(res => {
        if (!res.ok) throw new Error('Misafir odası oluşturulamadı.');
        return res.json();
      })
      .then(sessData => {
        connectToSession(sessData.pin);
      });
    })
    .catch(err => {
      console.error('Misafir girişi hatası:', err);
      showCustomAlert('Hata', 'Misafir girişi başarısız.');
    });
  });

  authRegisterSubmitBtn.addEventListener('click', () => {
    const username = authRegisterUsername.value.trim();
    const email = authRegisterEmail.value.trim();
    const password = authRegisterPassword.value;

    if (!username || !email || !password) {
      showCustomAlert('Kayıt Hatası', 'Tüm alanları doldurmak zorunludur.');
      return;
    }

    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'Kayıt başarısız.'); });
      }
      return res.json();
    })
    .then(data => {
      showCustomAlert('Kayıt Başarılı', 'Kayıt başarılı! Giriş Yap ekranından şifrenizle giriş yapabilirsiniz.');
      tabLoginBtn.click();
      authLoginIdentifier.value = data.username;
      authLoginPassword.focus();
    })
    .catch(err => {
      showCustomAlert('Kayıt Başarısız', err.message);
    });
  });

  authForgotSubmitBtn.addEventListener('click', () => {
    const email = authForgotEmail.value.trim();
    if (!email) {
      showCustomAlert('Şifre Sıfırlama', 'E-posta adresi gereklidir.');
      return;
    }

    fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'İşlem başarısız.'); });
      }
      return res.json();
    })
    .then(data => {
      showCustomAlert('E-posta Gönderildi', data.message);
      authForgotSection.classList.add('hidden');
      authResetSection.classList.remove('hidden');
      authResetDesc.textContent = `${email} adresine gelen 6 haneli doğrulama kodunu ve yeni şifrenizi girin.`;
      authResetCode.value = '';
      authResetNewPassword.value = '';
      authResetCode.focus();
    })
    .catch(err => {
      showCustomAlert('İşlem Başarısız', err.message);
    });
  });

  authResetSubmitBtn.addEventListener('click', () => {
    const email = authForgotEmail.value.trim();
    const code = authResetCode.value.trim();
    const newPassword = authResetNewPassword.value;

    if (!code || !newPassword) {
      showCustomAlert('Şifre Sıfırlama', 'Kod ve yeni şifre alanları zorunludur.');
      return;
    }

    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'Şifre sıfırlama başarısız.'); });
      }
      return res.json();
    })
    .then(data => {
      showCustomAlert('Şifre Güncellendi', data.message);
      authResetSection.classList.add('hidden');
      authSection.classList.remove('hidden');
      tabLoginBtn.click();
      authLoginIdentifier.value = email;
      authLoginPassword.focus();
    })
    .catch(err => {
      showCustomAlert('Şifre Güncelleme Hatası', err.message);
    });
  });

  authLoginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authLoginSubmitBtn.click();
  });
  
  authRegisterPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authRegisterSubmitBtn.click();
  });

  authForgotEmail.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authForgotSubmitBtn.click();
  });

  authResetNewPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authResetSubmitBtn.click();
  });

  backToAccountsBtn.addEventListener('click', () => {
    sessionStorage.removeItem('airdrop_account');
    sessionStorage.removeItem('airdrop_pin');
    sessionStorage.removeItem('airdrop_session_name');
    localStorage.removeItem('airdrop_account');
    localStorage.removeItem('airdrop_pin');
    localStorage.removeItem('airdrop_session_name');
    showAccountModal(false);
  });

  createNewSessionModalBtn.addEventListener('click', () => {
    const username = selectedAccountForSession || sessionStorage.getItem('airdrop_account') || localStorage.getItem('airdrop_account');
    if (!username) return;

    openRoomModal('Yeni Oda Oluştur', 'Yeni oda adını girin (İsteğe bağlı):', '', 'Oda adı...', (roomName) => {
      fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, name: roomName ? roomName.trim() : '' })
      })
      .then(res => res.json())
      .then(data => {
        connectToSession(data.pin);
      })
      .catch(err => {
        console.error('Yeni oturum oluşturulamadı:', err);
        showCustomAlert('Oda Oluşturulamadı', 'Yeni oturum oluşturulamadı.');
      });
    });
  });

  if (closeRoomModalBtn) closeRoomModalBtn.addEventListener('click', closeRoomModal);
  if (saveRoomModalBtn) {
    saveRoomModalBtn.addEventListener('click', () => {
      if (roomModalCallback) {
        roomModalCallback(roomModalInput.value.trim());
      }
      closeRoomModal();
    });
  }
  if (roomModalInput) {
    roomModalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveRoomModalBtn.click();
      } else if (e.key === 'Escape') {
        closeRoomModal();
      }
    });
  }

  // Settings: Change Password logic
  const settingsCurrentPassword = document.getElementById('settingsCurrentPassword');
  const settingsNewPassword = document.getElementById('settingsNewPassword');
  const settingsConfirmPassword = document.getElementById('settingsConfirmPassword');
  const settingsChangePasswordBtn = document.getElementById('settingsChangePasswordBtn');

  if (settingsChangePasswordBtn) {
    settingsChangePasswordBtn.addEventListener('click', () => {
      const username = sessionStorage.getItem('airdrop_account') || localStorage.getItem('airdrop_account');
      if (!username || username.startsWith('Misafir_')) {
        showCustomAlert('Hata', 'Misafir kullanıcılar için şifre değiştirilemez.');
        return;
      }

      const currentPassword = settingsCurrentPassword.value;
      const newPassword = settingsNewPassword.value;
      const confirmPassword = settingsConfirmPassword.value;

      if (!currentPassword || !newPassword || !confirmPassword) {
        showCustomAlert('Şifre Değiştirme', 'Lütfen tüm alanları doldurun.');
        return;
      }

      if (newPassword !== confirmPassword) {
        showCustomAlert('Şifre Değiştirme', 'Yeni şifreler eşleşmiyor!');
        return;
      }

      fetch('/api/auth/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, currentPassword, newPassword })
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => { throw new Error(err.error || 'Şifre güncellenemedi.'); });
        }
        return res.json();
      })
      .then(data => {
        showCustomAlert('Başarılı', data.message || 'Şifreniz başarıyla değiştirildi.');
        settingsCurrentPassword.value = '';
        settingsNewPassword.value = '';
        settingsConfirmPassword.value = '';
      })
      .catch(err => {
        showCustomAlert('Hata', err.message);
      });
    });
  }
}

export function loadSettingsData() {
  const username = sessionStorage.getItem('airdrop_account') || localStorage.getItem('airdrop_account');
  const pin = sessionStorage.getItem('airdrop_pin') || localStorage.getItem('airdrop_pin');
  
  const settingsUsernameText = document.getElementById('settingsUsernameText');
  const settingsEmailText = document.getElementById('settingsEmailText');
  const settingsPasswordCard = document.getElementById('settingsPasswordCard');
  
  if (settingsUsernameText) {
    settingsUsernameText.textContent = username || '-';
  }

  if (username && username.startsWith('Misafir_')) {
    if (settingsEmailText) settingsEmailText.textContent = 'Misafir Girişi';
    if (settingsPasswordCard) settingsPasswordCard.classList.add('hidden');
    
    // Set default storage usage displays for guest
    const settingsStorageProgressBar = document.getElementById('settingsStorageProgressBar');
    const settingsRoomStorageText = document.getElementById('settingsRoomStorageText');
    const settingsTotalStorageText = document.getElementById('settingsTotalStorageText');
    const pcDiskFreeCounter = document.getElementById('pcDiskFreeCounter');
    
    if (settingsStorageProgressBar) settingsStorageProgressBar.style.width = '0%';
    if (settingsRoomStorageText) settingsRoomStorageText.textContent = '0 Bytes';
    if (settingsTotalStorageText) settingsTotalStorageText.textContent = '0 Bytes';
  } else if (username) {
    if (settingsPasswordCard) settingsPasswordCard.classList.remove('hidden');
    
    // Fetch storage stats from backend
    fetch(`/api/serve-file?folder=dummy&filename=dummy`) // dummy call to verify session via middleware before fetching stats
      .then(() => {
        return fetch(`/api/user/storage-stats?account=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin || '')}`);
      })
      .then(res => {
        if (!res.ok) throw new Error('Could not fetch storage stats');
        return res.json();
      })
      .then(data => {
        if (settingsEmailText) settingsEmailText.textContent = data.email || 'Email yok';
        
        const settingsStorageProgressBar = document.getElementById('settingsStorageProgressBar');
        const settingsRoomStorageText = document.getElementById('settingsRoomStorageText');
        const settingsTotalStorageText = document.getElementById('settingsTotalStorageText');
        
        if (settingsRoomStorageText) settingsRoomStorageText.textContent = formatBytes(data.roomUsage || 0);
        if (settingsTotalStorageText) settingsTotalStorageText.textContent = formatBytes(data.totalUsage || 0);
        
        // Calculate storage bar percentage (assume a 2GB default or calculate relative to total usage limit if any, or disk total)
        // Let's use disk free / total or percentage of usage:
        const totalLimit = 5 * 1024 * 1024 * 1024; // 5 GB limit example
        const percent = Math.min(100, Math.round(((data.totalUsage || 0) / totalLimit) * 100));
        if (settingsStorageProgressBar) settingsStorageProgressBar.style.width = `${percent}%`;
        
        // Also update disk free counter if available
        const pcDiskFreeCounter = document.getElementById('pcDiskFreeCounter');
        if (pcDiskFreeCounter && data.diskFree) {
          pcDiskFreeCounter.textContent = `Boş Alan: ${formatBytes(data.diskFree)}`;
        }
      })
      .catch(err => {
        console.error('Storage stats error:', err);
      });
  }
}
