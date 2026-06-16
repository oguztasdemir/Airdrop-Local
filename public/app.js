document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusBadge = document.getElementById('statusBadge');
  const statusText = statusBadge.querySelector('.status-text');
  
  const desktopView = document.getElementById('desktopView');
  const mobileView = document.getElementById('mobileView');
  
  // Desktop specific elements
  const ipAddressText = document.getElementById('ipAddressText');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const galleryContainer = document.getElementById('galleryContainer');
  const folderSelectPC = document.getElementById('folderSelectPC');
  const newFolderBtnPC = document.getElementById('newFolderBtnPC');
  const renameFolderBtnPC = document.getElementById('renameFolderBtnPC');
  const deleteFolderBtnPC = document.getElementById('deleteFolderBtnPC');
  const statsCounter = document.getElementById('statsCounter');
  const pcDropArea = document.getElementById('pcDropArea');
  const pcFileInput = document.getElementById('pcFileInput');
  const devicesList = document.getElementById('devicesList');
  const clipboardInput = document.getElementById('clipboardInput');
  const sendClipboardBtn = document.getElementById('sendClipboardBtn');
  const clipboardList = document.getElementById('clipboardList');
  
  // Selection and Move elements
  const gallerySelectionBar = document.getElementById('gallerySelectionBar');
  const selectionCountText = document.getElementById('selectionCountText');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const moveSelectedBtn = document.getElementById('moveSelectedBtn');
  
  const moveModal = document.getElementById('moveModal');
  const moveModalInput = document.getElementById('moveModalInput');
  const closeMoveModalBtn = document.getElementById('closeMoveModalBtn');
  const saveMoveModalBtn = document.getElementById('saveMoveModalBtn');
  
  const qpDesktop = document.getElementById('qpDesktop');
  const qpDocuments = document.getElementById('qpDocuments');
  const qpDownloads = document.getElementById('qpDownloads');
  const qpPictures = document.getElementById('qpPictures');

  // Search & Sorting controls
  const fileSearchInput = document.getElementById('fileSearchInput');
  const fileSortSelect = document.getElementById('fileSortSelect');
  const mobileFileSearchInput = document.getElementById('mobileFileSearchInput');
  const mobileFileSortSelect = document.getElementById('mobileFileSortSelect');
  
  // Mobile specific elements
  const uploadForm = document.getElementById('uploadForm');
  const fileInput = document.getElementById('fileInput');
  const dropArea = document.getElementById('dropArea');
  const previewContainer = document.getElementById('previewContainer');
  const mobileActions = document.getElementById('mobileActions');
  const clearBtn = document.getElementById('clearBtn');
  const progressArea = document.getElementById('progressArea');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressText = document.getElementById('progressText');
  const successStatus = document.getElementById('successStatus');
  const folderSelectMobile = document.getElementById('folderSelectMobile');
  const newFolderBtnMobile = document.getElementById('newFolderBtnMobile');
  
  // Mobile Files Tab & Clipboard elements
  const folderSelectMobileFiles = document.getElementById('folderSelectMobileFiles');
  const mobileFilesContainer = document.getElementById('mobileFilesContainer');
  const mobileClipboardInput = document.getElementById('mobileClipboardInput');
  const mobileSendClipboardBtn = document.getElementById('mobileSendClipboardBtn');
  const mobileClipboardList = document.getElementById('mobileClipboardList');
  
  // Lightbox elements
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const closeLightbox = document.querySelector('.close-lightbox');
  const prevLightboxBtn = document.getElementById('prevLightboxBtn');
  const nextLightboxBtn = document.getElementById('nextLightboxBtn');

  // Custom Folder Modal elements
  const folderModal = document.getElementById('folderModal');
  const folderModalTitle = document.getElementById('folderModalTitle');
  const folderModalInput = document.getElementById('folderModalInput');
  const closeFolderModalBtn = document.getElementById('closeFolderModalBtn');
  const saveFolderModalBtn = document.getElementById('saveFolderModalBtn');
  let folderModalCallback = null;

  // Security PIN elements
  const pinModal = document.getElementById('pinModal');
  const pinModalInput = document.getElementById('pinModalInput');
  const pinErrorText = document.getElementById('pinErrorText');
  const savePinModalBtn = document.getElementById('savePinModalBtn');

  // Custom Media Player elements
  const mediaPlayerModal = document.getElementById('mediaPlayerModal');
  const closeMediaPlayerBtn = document.getElementById('closeMediaPlayerBtn');
  const mediaPlayerTitle = document.getElementById('mediaPlayerTitle');
  const playerVideo = document.getElementById('playerVideo');
  const playerAudio = document.getElementById('playerAudio');
  const audioWrapper = document.getElementById('audioWrapper');
  const mediaPlayerCaption = document.getElementById('mediaPlayerCaption');

  // State
  let qrCodeInstance = null;
  let serverUploadUrl = '';
  let eventSource = null;
  let activeFolderPC = 'Genel';
  let activeFolderMobileFiles = 'Genel';
  
  let currentFileList = []; // In-memory cache of files for PC search/sort
  let currentMobileFileList = []; // In-memory cache of files for mobile search/sort
  let imagePlaylist = []; // Playlist of images for slideshow
  let currentImageIndex = -1;

  // Selection & OS paths state
  let selectedFiles = [];
  let userPaths = {};

  // Generate unique client identifier
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  let deviceId = localStorage.getItem('airdrop_device_id');
  if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2, 9);
    localStorage.setItem('airdrop_device_id', deviceId);
  }
  const deviceName = isMobile ? (navigator.userAgent.match(/(iPhone|iPad|iPod|Android)/i) ? navigator.userAgent.match(/(iPhone|iPad|iPod|Android)/i)[0] : 'Mobil Cihaz') : 'Bilgisayar';

  // Extract PIN from URL if present
  function getUrlPin() {
    const params = new URLSearchParams(window.location.search);
    return params.get('pin');
  }

  // Secure fetch helper to inject PIN header and intercept 401s
  function secureFetch(url, options = {}) {
    options.headers = options.headers || {};
    const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
    if (pin) {
      options.headers['X-PIN'] = pin;
    }
    return fetch(url, options)
      .then(res => {
        if (res.status === 401) {
          showPinModal();
          throw new Error('Unauthorized');
        }
        return res;
      });
  }

  // --- PIN security screen ---
  function showPinModal() {
    pinModal.classList.remove('hidden');
    pinModal.classList.add('active');
    pinModalInput.focus();
  }

  function hidePinModal() {
    pinModal.classList.remove('active');
    pinModal.classList.add('hidden');
    pinErrorText.classList.add('hidden');
  }

  // Save PIN and authenticate
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
          sessionStorage.setItem('airdrop_pin', pin);
          hidePinModal();
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?pin=' + pin;
          window.location.href = newUrl; // Full reload to load correctly
        }
      })
      .catch(err => {
        console.error('Doğrulama hatası:', err);
      });
  });

  pinModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') savePinModalBtn.click();
  });

  function initializeSession() {
    const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin();
    if (!pin) {
      if (isMobile) {
        // Mobile manual entry: do not auto-create session. Show manual entry modal!
        showPinModal();
      } else {
        // PC/Desktop: automatically create a new session
        fetch('/api/sessions/create', { method: 'POST' })
          .then(res => {
            if (!res.ok) throw new Error('Oturum oluşturulamadı');
            return res.json();
          })
          .then(data => {
            sessionStorage.setItem('airdrop_pin', data.pin);
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?pin=' + data.pin;
            window.history.replaceState({ path: newUrl }, '', newUrl);
            startApp();
          })
          .catch(err => {
            console.error('Session creation failed:', err);
            showPinModal();
          });
      }
    } else {
      sessionStorage.setItem('airdrop_pin', pin);
      const currentUrlParams = new URLSearchParams(window.location.search);
      if (!currentUrlParams.has('pin')) {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?pin=' + pin;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }
      // Check if session is valid on server using validate endpoint
      fetch(`/api/sessions/validate/${pin}`)
        .then(res => {
          if (res.status === 401) {
            sessionStorage.removeItem('airdrop_pin');
            // Session expired on server, re-initialize
            initializeSession();
          } else {
            startApp();
          }
        })
        .catch(() => {
          startApp(); // Offline or other issue, try to proceed
        });
    }
  }

  function startApp() {
    if (isMobile) {
      setupMobileUploader();
    } else {
      setupDesktopDashboard();
    }

    const pin = sessionStorage.getItem('airdrop_pin');
    const headerBadge = document.getElementById('activeSessionHeaderBadge');
    if (headerBadge) {
      headerBadge.textContent = `🔑 Oturum PIN: ${pin}`;
    }

    updateStatus();
    fetchFolders();
    fetchClipboard();
    fetchUserPaths();
    fetchChatMessages();

    if (!isMobile) {
      fetchActiveSessions();
      
      const newSessionBtn = document.getElementById('newSessionBtnPC');
      if (newSessionBtn) {
        newSessionBtn.addEventListener('click', () => {
          fetch('/api/sessions/create', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
              switchSession(data.pin);
            })
            .catch(err => console.error('Yeni oturum oluşturma hatası:', err));
        });
      }
    }
  }

  function renderActiveSessions(sessionsList) {
    const sessionsListPC = document.getElementById('sessionsListPC');
    if (!sessionsListPC) return;
    const currentPin = sessionStorage.getItem('airdrop_pin');
    
    if (sessionsList.length === 0) {
      sessionsListPC.innerHTML = `<div style="text-align:center;font-size:12px;color:var(--text-muted);padding:10px;">Aktif oturum yok</div>`;
      return;
    }
    
    sessionsListPC.innerHTML = sessionsList.map(p => {
      const isActive = p === currentPin;
      return `
        <div class="session-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:var(--radius-sm);background:${isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)'};border:1px solid ${isActive ? 'var(--accent-color)' : 'var(--glass-border)'};cursor:pointer;transition:all 0.2s;margin-bottom: 4px;" data-pin="${p}">
          <span style="font-size:13px;font-weight:600;color:var(--text-main);">Oturum #${p}</span>
          <span style="font-size:11px;font-weight:500;color:${isActive ? 'var(--accent-color)' : 'var(--text-muted)'};">${isActive ? 'Aktif' : 'Katıl'}</span>
        </div>
      `;
    }).join('');

    sessionsListPC.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        const p = item.dataset.pin;
        if (p === currentPin) return;
        switchSession(p);
      });
    });
  }

  function fetchActiveSessions() {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(sessionsList => {
        renderActiveSessions(sessionsList);
      })
      .catch(err => console.error('Oturum listesi yüklenemedi:', err));
  }

  function switchSession(p) {
    sessionStorage.setItem('airdrop_pin', p);
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?pin=' + p;
    window.location.href = newUrl; // Full reload to reset all states safely
  }

  // Check connection status & trigger PIN validation if external
  function updateStatus() {
    secureFetch('/api/status')
      .then(res => res.json())
      .then(data => {
        const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
        serverUploadUrl = pin ? `${data.uploadUrl}?pin=${pin}` : data.uploadUrl;
        statusText.textContent = `Aktif: ${data.ip}:${data.port}`;
        
        if (!isMobile && !qrCodeInstance && document.getElementById('qrcode')) {
          qrCodeInstance = new QRCode(document.getElementById('qrcode'), {
            text: serverUploadUrl,
            width: 180,
            height: 180,
            colorDark: '#0a0b10',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
          ipAddressText.textContent = serverUploadUrl;
        }
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return; // Handled by interceptor
        statusText.textContent = 'Bağlantı kesildi';
        statusBadge.querySelector('.pulse-dot').style.backgroundColor = '#ef4444';
        statusBadge.querySelector('.pulse-dot').style.boxShadow = '0 0 8px #ef4444';
        console.error('Status fetch error:', err);
      });
  }

  // Helper to append PIN parameter to file source URLs for direct media tags
  function getSecureMediaUrl(relativeUrl) {
    const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
    return pin ? `${relativeUrl}?pin=${pin}` : relativeUrl;
  }

  // 1. Theme and Accent Management
  setupThemeAndAccent();

  // 2. Switch Views based on Device Type
  if (isMobile) {
    desktopView.classList.remove('active');
    mobileView.classList.add('active');
    setupMobileTabs();
  } else {
    desktopView.classList.add('active');
    mobileView.classList.remove('active');
  }

  // 3. Initialize Session
  initializeSession();

  // Custom folder creation modal helpers
  function openFolderModal(title, callback) {
    folderModalTitle.textContent = title;
    folderModalInput.value = '';
    folderModal.classList.add('active');
    folderModal.classList.remove('hidden');
    setTimeout(() => folderModalInput.focus(), 50);
    folderModalCallback = callback;
  }

  function closeFolderModal() {
    folderModal.classList.remove('active');
    folderModal.classList.add('hidden');
    folderModalCallback = null;
  }

  closeFolderModalBtn.addEventListener('click', closeFolderModal);
  
  folderModal.addEventListener('click', (e) => {
    if (e.target === folderModal) {
      closeFolderModal();
    }
  });

  saveFolderModalBtn.addEventListener('click', () => {
    if (folderModalCallback) {
      const val = folderModalInput.value.trim();
      folderModalCallback(val);
    }
    closeFolderModal();
  });

  folderModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveFolderModalBtn.click();
    } else if (e.key === 'Escape') {
      closeFolderModal();
    }
  });

  // OS Paths fetch
  function fetchUserPaths() {
    secureFetch('/api/user-paths')
      .then(res => res.json())
      .then(data => {
        userPaths = data;
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('User paths fetch error:', err);
      });
  }

  // Checkbox selection bar
  function updateSelectionBar() {
    if (!gallerySelectionBar) return;
    if (selectedFiles.length > 0) {
      gallerySelectionBar.classList.remove('hidden');
      selectionCountText.textContent = `${selectedFiles.length} dosya seçildi`;
    } else {
      gallerySelectionBar.classList.add('hidden');
    }
  }

  function clearSelection() {
    selectedFiles = [];
    document.querySelectorAll('.file-check-input').forEach(chk => chk.checked = false);
    updateSelectionBar();
  }

  function selectAllFiles() {
    selectedFiles = [];
    document.querySelectorAll('.file-check-input').forEach(chk => {
      chk.checked = true;
      if (!selectedFiles.includes(chk.dataset.filename)) {
        selectedFiles.push(chk.dataset.filename);
      }
    });
    updateSelectionBar();
  }

  // --- Theme & Accent Colors Logic ---
  function setupThemeAndAccent() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');
    let currentTheme = localStorage.getItem('theme') || 'dark';

    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeToggleUI();

    themeToggleBtn.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', currentTheme);
      localStorage.setItem('theme', currentTheme);
      updateThemeToggleUI();
    });

    function updateThemeToggleUI() {
      if (currentTheme === 'dark') {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      }
    }

    const accentDots = document.querySelectorAll('.accent-dot');
    let currentAccent = localStorage.getItem('accent') || 'indigo';
    document.body.setAttribute('data-accent', currentAccent);
    
    accentDots.forEach(dot => {
      if (dot.dataset.accent === currentAccent) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }

      dot.addEventListener('click', () => {
        accentDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        currentAccent = dot.dataset.accent;
        document.body.setAttribute('data-accent', currentAccent);
        localStorage.setItem('accent', currentAccent);
      });
    });
  }

  // --- Common Folder Management ---
  function fetchFolders(selectToActive = null) {
    secureFetch('/api/folders')
      .then(res => res.json())
      .then(folders => {
        if (folderSelectPC) {
          const currentSelected = selectToActive || folderSelectPC.value || 'Genel';
          folderSelectPC.innerHTML = '';
          folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            folderSelectPC.appendChild(option);
          });
          folderSelectPC.value = currentSelected;
          activeFolderPC = currentSelected;
        }

        if (folderSelectMobile) {
          const currentSelected = folderSelectMobile.value || 'Genel';
          folderSelectMobile.innerHTML = '';
          folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            folderSelectMobile.appendChild(option);
          });
          folderSelectMobile.value = currentSelected;
        }

        if (folderSelectMobileFiles) {
          const currentSelected = folderSelectMobileFiles.value || 'Genel';
          folderSelectMobileFiles.innerHTML = '';
          folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            folderSelectMobileFiles.appendChild(option);
          });
          folderSelectMobileFiles.value = currentSelected;
          activeFolderMobileFiles = currentSelected;
        }
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Error fetching folders:', err);
      });
  }

  function createNewFolder(promptMessage) {
    openFolderModal(promptMessage, (folderName) => {
      if (!folderName) return;
      
      const cleanName = folderName.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim();
      if (!cleanName) {
        alert('Geçersiz klasör adı!');
        return;
      }

      secureFetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert('Hata: ' + data.error);
        } else {
          fetchFolders(cleanName);
          if (!isMobile) {
            fetchFiles();
          } else {
            fetchMobileFiles();
          }
        }
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Error creating folder:', err);
      });
    });
  }

  function renameFolder() {
    if (activeFolderPC === 'Genel') {
      alert('Genel klasörü yeniden adlandırılamaz!');
      return;
    }

    openFolderModal(`[${activeFolderPC}] klasörünün yeni adı:`, (newName) => {
      if (!newName) return;
      const cleanName = newName.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim();
      if (!cleanName) {
        alert('Geçersiz yeni klasör adı!');
        return;
      }

      secureFetch(`/api/folders/${encodeURIComponent(activeFolderPC)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: cleanName })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert('Hata: ' + data.error);
        } else {
          fetchFolders(cleanName);
          fetchFiles();
        }
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Folder rename error:', err);
      });
    });
  }

  function deleteFolder() {
    if (activeFolderPC === 'Genel') {
      alert('Genel klasörü silinemez!');
      return;
    }

    if (confirm(`[${activeFolderPC}] klasörünü ve içerisindeki tüm dosyaları kalıcı olarak silmek istediğinizden emin misiniz?`)) {
      secureFetch(`/api/folders/${encodeURIComponent(activeFolderPC)}`, {
        method: 'DELETE'
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert('Hata: ' + data.error);
        } else {
          fetchFolders('Genel');
          fetchFiles();
        }
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Folder delete error:', err);
      });
    }
  }

  // --- Shared Clipboard Actions ---
  function fetchClipboard() {
    secureFetch('/api/clipboard')
      .then(res => res.json())
      .then(items => {
        renderClipboard(items);
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Pano çekme hatası:', err);
      });
  }

  function sendClipboardItem(textInputEl) {
    const text = textInputEl.value.trim();
    if (!text) return;

    secureFetch('/api/clipboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, device: deviceName })
    })
    .then(res => res.json())
    .then(() => {
      textInputEl.value = '';
      fetchClipboard();
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Pano gönderme hatası:', err);
    });
  }

  function deleteClipboardItem(id) {
    secureFetch(`/api/clipboard/${id}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      fetchClipboard();
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Pano silme hatası:', err);
    });
  }

  function renderClipboard(items) {
    const pcList = document.getElementById('clipboardList');
    const mobileList = document.getElementById('mobileClipboardList');

    const renderHTML = items.length === 0 
      ? `<div class="no-clipboard">Pano boş. Metin yazıp paylaşın!</div>`
      : items.map(item => {
          const isUrl = /^(https?:\/\/[^\s]+)$/i.test(item.text);
          const textDisplay = isUrl 
            ? `<a href="${item.text}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">${escapeHtml(item.text)}</a>`
            : escapeHtml(item.text);
            
          return `
            <div class="clipboard-item" data-id="${item.id}">
              <div class="clipboard-text">${textDisplay}</div>
              <div class="clipboard-meta">
                <span>${item.device} • ${new Date(item.createdAt).toLocaleTimeString()}</span>
                <div class="clipboard-actions">
                  <button class="btn-clip-action copy-clip" data-text="${escapeHtml(item.text)}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Kopyala
                  </button>
                  <button class="btn-clip-action delete-clip" data-id="${item.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Sil
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');

    if (pcList) pcList.innerHTML = renderHTML;
    if (mobileList) mobileList.innerHTML = renderHTML;

    document.querySelectorAll('.copy-clip').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.text).then(() => {
          const originalText = btn.innerHTML;
          btn.innerHTML = 'Kopyalandı!';
          setTimeout(() => btn.innerHTML = originalText, 1500);
        });
      });
    });

    document.querySelectorAll('.delete-clip').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteClipboardItem(btn.dataset.id);
      });
    });
  }

  // --- Desktop Dashboard Logic ---
  function setupDesktopDashboard() {
    fetchFiles();
    connectToSSE();

    refreshBtn.addEventListener('click', fetchFiles);

    downloadZipBtn.addEventListener('click', () => {
      window.location.href = getSecureMediaUrl(`/api/zip/${encodeURIComponent(activeFolderPC)}`);
    });

    // Folder select
    folderSelectPC.addEventListener('change', (e) => {
      activeFolderPC = e.target.value;
      fetchFiles();
    });

    // Create, rename and delete folder actions
    newFolderBtnPC.addEventListener('click', () => createNewFolder('Yeni klasör adı girin:'));
    renameFolderBtnPC.addEventListener('click', renameFolder);
    deleteFolderBtnPC.addEventListener('click', deleteFolder);

    // Clipboard posting
    sendClipboardBtn.addEventListener('click', () => sendClipboardItem(clipboardInput));
    clipboardInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendClipboardItem(clipboardInput);
      }
    });

    // PC Drag and Drop
    pcDropArea.addEventListener('click', () => pcFileInput.click());
    pcFileInput.addEventListener('change', () => uploadPCFiles(pcFileInput.files));

    ['dragenter', 'dragover'].forEach(eventName => {
      pcDropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        pcDropArea.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      pcDropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        pcDropArea.classList.remove('dragover');
      });
    });

    pcDropArea.addEventListener('drop', (e) => {
      uploadPCFiles(e.dataTransfer.files);
    });

    // Copy URL
    copyUrlBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(serverUploadUrl)
        .then(() => {
          const originalText = copyUrlBtn.textContent;
          copyUrlBtn.textContent = 'Kopyalandı!';
          copyUrlBtn.style.background = 'rgba(16, 185, 129, 0.15)';
          copyUrlBtn.style.color = '#10b981';
          setTimeout(() => {
            copyUrlBtn.textContent = originalText;
            copyUrlBtn.style.background = '';
            copyUrlBtn.style.color = '';
          }, 2000);
        })
        .catch(err => console.error('Kopyalama hatası:', err));
    });

    // Selection actions listeners
    selectAllBtn.addEventListener('click', selectAllFiles);
    clearSelectionBtn.addEventListener('click', clearSelection);
    moveSelectedBtn.addEventListener('click', openMoveModal);

    // Move Modal triggers
    closeMoveModalBtn.addEventListener('click', closeMoveModal);
    moveModal.addEventListener('click', (e) => {
      if (e.target === moveModal) closeMoveModal();
    });

    qpDesktop.addEventListener('click', () => moveModalInput.value = userPaths.desktop || '');
    qpDocuments.addEventListener('click', () => moveModalInput.value = userPaths.documents || '');
    qpDownloads.addEventListener('click', () => moveModalInput.value = userPaths.downloads || '');
    qpPictures.addEventListener('click', () => moveModalInput.value = userPaths.pictures || '');

    saveMoveModalBtn.addEventListener('click', () => {
      const targetPath = moveModalInput.value.trim();
      if (!targetPath) {
        alert('Lütfen geçerli bir klasör yolu girin!');
        return;
      }
      
      const zipAndMoveCheckbox = document.getElementById('zipAndMoveCheckbox');
      const zipAndMove = zipAndMoveCheckbox ? zipAndMoveCheckbox.checked : false;

      localStorage.setItem('last_move_path', targetPath);
      saveMoveModalBtn.disabled = true;
      saveMoveModalBtn.textContent = 'Taşınıyor...';

      secureFetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: activeFolderPC,
          filenames: selectedFiles,
          targetPath: targetPath,
          zipAndMove: zipAndMove
        })
      })
      .then(res => res.json())
      .then(data => {
        saveMoveModalBtn.disabled = false;
        saveMoveModalBtn.textContent = 'Dosyaları Taşı';
        
        if (data.error) {
          alert('Hata: ' + data.error);
        } else {
          alert(data.message);
          clearSelection();
          closeMoveModal();
          fetchFiles();
        }
      })
      .catch(err => {
        saveMoveModalBtn.disabled = false;
        saveMoveModalBtn.textContent = 'Dosyaları Taşı';
        if (err.message === 'Unauthorized') return;
        console.error('Taşıma hatası:', err);
        alert('Dosyalar taşınamadı.');
      });
    });

    // Search and Sort inputs listeners
    fileSearchInput.addEventListener('input', applySearchAndSort);
    fileSortSelect.addEventListener('change', applySearchAndSort);

    function openMoveModal() {
      moveModalInput.value = localStorage.getItem('last_move_path') || userPaths.desktop || '';
      const zipAndMoveCheckbox = document.getElementById('zipAndMoveCheckbox');
      if (zipAndMoveCheckbox) zipAndMoveCheckbox.checked = false;
      moveModal.classList.add('active');
      moveModal.classList.remove('hidden');
      setTimeout(() => moveModalInput.focus(), 50);
    }

    function closeMoveModal() {
      moveModal.classList.remove('active');
      moveModal.classList.add('hidden');
    }
  }

  // Client-side search and sorting algorithm
  function applySearchAndSort() {
    const query = fileSearchInput.value.toLowerCase().trim();
    const sortVal = fileSortSelect.value;

    let filtered = currentFileList.filter(file => {
      const cleanDisplayName = file.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
      return cleanDisplayName.toLowerCase().includes(query);
    });

    // Sorting
    filtered.sort((a, b) => {
      const nameA = a.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '').toLowerCase();
      const nameB = b.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '').toLowerCase();

      switch (sortVal) {
        case 'name-asc':
          return nameA.localeCompare(nameB);
        case 'name-desc':
          return nameB.localeCompare(nameA);
        case 'size-desc':
          return b.size - a.size;
        case 'size-asc':
          return a.size - b.size;
        case 'date-asc':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'date-desc':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    renderGallery(filtered);
  }

  function uploadPCFiles(files) {
    if (files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    pcDropArea.style.opacity = '0.5';
    pcDropArea.style.pointerEvents = 'none';

    const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
    const headers = {
      'X-Folder': encodeURIComponent(activeFolderPC)
    };
    if (pin) headers['X-PIN'] = pin;

    fetch('/api/upload', {
      method: 'POST',
      headers: headers,
      body: formData
    })
    .then(res => {
      if (res.status === 401) {
        showPinModal();
        throw new Error('Unauthorized');
      }
      return res.json();
    })
    .then(() => {
      pcDropArea.style.opacity = '1';
      pcDropArea.style.pointerEvents = 'auto';
      pcFileInput.value = '';
      fetchFiles();
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Yükleme hatası:', err);
      alert('Yükleme başarısız.');
      pcDropArea.style.opacity = '1';
      pcDropArea.style.pointerEvents = 'auto';
    });
  }

  function connectToSSE() {
    if (eventSource) {
      eventSource.close();
    }

    const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
    const sseUrl = `/api/events?device=${encodeURIComponent(deviceName)}&id=${deviceId}${pin ? '&pin=' + pin : ''}`;
    
    eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'device_list_update') {
          renderDevicesList(data.devices);
        } else if (data.type === 'global_sessions_update') {
          renderActiveSessions(data.sessions);
        } else if (data.type === 'clipboard_update') {
          renderClipboard(data.items);
          showToast('Pano Güncellendi', 'Ortak pano içeriği güncellendi.', 'info');
        } else if (data.type === 'chat_message') {
          renderChatMessages(data.messages);
          if (data.message.device !== deviceName) {
            showToast(`Sohbet - ${data.message.device}`, data.message.text, 'chat');
          }
        } else if (data.type === 'folder_created' || data.type === 'folder_deleted' || data.type === 'folder_renamed') {
          fetchFolders();
          if (data.type === 'folder_deleted' && activeFolderPC === data.name) {
            activeFolderPC = 'Genel';
          }
          if (data.type === 'folder_renamed' && activeFolderPC === data.oldName) {
            activeFolderPC = data.newName;
          }
          if (data.type === 'folder_created') {
            showToast('Yeni Klasör', `[${data.name}] klasörü oluşturuldu.`, 'success');
          }
          fetchFiles();
        } else if (data.type === 'upload') {
          showToast('Yeni Dosya', 'Klasöre yeni dosya yüklendi.', 'success');
          fetchFolders();
          if (!isMobile) {
            fetchFiles();
          } else {
            fetchMobileFiles();
          }
        } else if (data.type === 'delete') {
          showToast('Dosya Silindi', 'Klasörden bir dosya silindi.', 'info');
          fetchFolders();
          if (!isMobile) {
            fetchFiles();
          } else {
            fetchMobileFiles();
          }
        } else {
          fetchFolders();
          if (!isMobile) {
            fetchFiles();
          } else {
            fetchMobileFiles();
          }
        }
      } catch (err) {
        // Ping
      }
    };

    eventSource.onerror = (err) => {
      console.warn('SSE bağlantısı koptu. 5 saniye içinde yeniden bağlanılıyor...', err);
      eventSource.close();
      setTimeout(connectToSSE, 5000);
    };
  }

  function renderDevicesList(devices) {
    if (!devicesList) return;
    const otherDevices = devices.filter(d => d.id !== deviceId);

    if (otherDevices.length === 0) {
      devicesList.innerHTML = `<div class="no-devices">Sadece siz bağlısınız</div>`;
      return;
    }

    devicesList.innerHTML = otherDevices.map(d => {
      const isMobileDevice = /iphone|ipad|ipod|android/i.test(d.device);
      const icon = isMobileDevice 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
      
      return `
        <div class="device-item">
          <div class="device-icon">${icon}</div>
          <div class="device-info-text">
            <span class="device-name">${escapeHtml(d.device)}</span>
            <span class="device-status">Aktif</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function fetchFiles() {
    secureFetch(`/api/files?folder=${encodeURIComponent(activeFolderPC)}`)
      .then(res => res.json())
      .then(files => {
        currentFileList = files; // Cache list
        applySearchAndSort();    // Sort & Render
        updateStatistics(files);
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Error fetching files:', err);
      });
  }

  function updateStatistics(files) {
    let totalSize = 0;
    files.forEach(f => totalSize += f.size);
    statsCounter.textContent = `${files.length} Dosya (${formatBytes(totalSize)})`;
  }

  function getFileClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'file-image';
    if (['pdf'].includes(ext)) return 'file-pdf';
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return 'file-zip';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) return 'file-doc';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'file-audio';
    if (['mp4', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) return 'file-video';
    return 'file-other';
  }

  function renderGallery(files) {
    if (!galleryContainer) return;

    if (files.length === 0) {
      galleryContainer.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <p>Dosya bulunamadı.</p>
          <span>Arama kriterlerinizi değiştirmeyi deneyin veya yeni dosya yükleyin.</span>
        </div>
      `;
      galleryContainer.classList.add('empty');
      return;
    }

    galleryContainer.classList.remove('empty');
    galleryContainer.innerHTML = '';

    // Rebuild images playlist for slideshow
    imagePlaylist = files.filter(f => getFileClass(f.name) === 'file-image');

    files.forEach(file => {
      const fileClass = getFileClass(file.name);
      
      const fileItem = document.createElement('div');
      fileItem.className = `file-item ${fileClass}`;
      fileItem.dataset.filename = file.name;

      // Selection Checkbox
      const checkboxWrapper = document.createElement('div');
      checkboxWrapper.className = 'file-select-checkbox';
      checkboxWrapper.addEventListener('click', (e) => e.stopPropagation());

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'file-check-input';
      chk.dataset.filename = file.name;
      chk.checked = selectedFiles.includes(file.name);
      chk.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!selectedFiles.includes(file.name)) selectedFiles.push(file.name);
        } else {
          selectedFiles = selectedFiles.filter(name => name !== file.name);
        }
        updateSelectionBar();
      });
      checkboxWrapper.appendChild(chk);
      fileItem.appendChild(checkboxWrapper);

      const isImage = fileClass === 'file-image';
      const isVideo = fileClass === 'file-video';
      const isAudio = fileClass === 'file-audio';
      const ext = file.name.split('.').pop().toLowerCase();
      const isTextFile = ['txt', 'md', 'js', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'sh', 'bat'].includes(ext);
      
      const previewEl = document.createElement('div');
      previewEl.className = 'file-preview';
      
      const secureUrl = getSecureMediaUrl(file.url);

      if (isImage) {
        previewEl.style.backgroundImage = `url('${secureUrl}')`;
        previewEl.addEventListener('click', () => openImageLightbox(file.url, file.name));
      } else if (isVideo || isAudio) {
        let mediaIcon = isVideo 
          ? `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`
          : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
        
        previewEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;">
            ${mediaIcon}
          </div>
        `;
        previewEl.addEventListener('click', () => openMediaPlayer(file.url, file.name, isVideo));
      } else if (isTextFile) {
        let fileIcon = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`;
        previewEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;">
            ${fileIcon}
          </div>
        `;
        previewEl.addEventListener('click', () => openTextViewer(file.folder, file.name));
      } else {
        let fileIcon = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
        if (fileClass === 'file-pdf') {
          fileIcon = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h3M9 18h6"/></svg>`;
        } else if (fileClass === 'file-zip') {
          fileIcon = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12h4M10 15h4M10 18h4"/></svg>`;
        }
        
        previewEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;">
            ${fileIcon}
          </div>
        `;
      }

      const actionsEl = document.createElement('div');
      actionsEl.className = 'file-actions';

      if (fileClass === 'file-zip') {
        const extractBtn = document.createElement('button');
        extractBtn.className = 'btn-icon';
        extractBtn.style.background = 'var(--accent-color)';
        extractBtn.title = 'Ayıkla';
        extractBtn.innerHTML = `📦`;
        extractBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          extractZip(file.folder, file.name);
        });
        actionsEl.appendChild(extractBtn);
      }

      const downloadBtn = document.createElement('a');
      downloadBtn.href = secureUrl;
      downloadBtn.download = file.name;
      downloadBtn.className = 'btn-icon download';
      downloadBtn.title = 'İndir';
      downloadBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      downloadBtn.addEventListener('click', (e) => e.stopPropagation());

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon delete';
      deleteBtn.title = 'Sil';
      deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFile(file.folder, file.name);
      });

      actionsEl.appendChild(downloadBtn);
      actionsEl.appendChild(deleteBtn);

      const infoEl = document.createElement('div');
      infoEl.className = 'file-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'file-name';
      const cleanDisplayName = file.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
      nameEl.textContent = cleanDisplayName;

      const sizeEl = document.createElement('span');
      sizeEl.className = 'file-size';
      sizeEl.textContent = formatBytes(file.size);

      infoEl.appendChild(nameEl);
      infoEl.appendChild(sizeEl);

      fileItem.appendChild(previewEl);
      fileItem.appendChild(actionsEl);
      fileItem.appendChild(infoEl);

      galleryContainer.appendChild(fileItem);
    });
  }

  function deleteFile(folder, filename) {
    if (confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) {
      secureFetch(`/api/files/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      })
      .then(res => res.json())
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Silme hatası:', err);
      });
    }
  }

  // --- Mobile Tab Management ---
  function setupMobileTabs() {
    const tabButtons = document.querySelectorAll('.mobile-tab-btn');
    const tabContents = document.querySelectorAll('.mobile-tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active-content'));

        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        document.getElementById(tabId).classList.add('active-content');

        if (tabId === 'mobile-files-tab') {
          fetchMobileFiles();
        } else if (tabId === 'mobile-clip-tab') {
          fetchClipboard();
        }
      });
    });

    folderSelectMobileFiles.addEventListener('change', (e) => {
      activeFolderMobileFiles = e.target.value;
      fetchMobileFiles();
    });

    mobileClipboardInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendClipboardItem(mobileClipboardInput);
      }
    });
    mobileSendClipboardBtn.addEventListener('click', () => sendClipboardItem(mobileClipboardInput));

    // Mobile search / sorting event listeners
    mobileFileSearchInput.addEventListener('input', applyMobileSearchAndSort);
    mobileFileSortSelect.addEventListener('change', applyMobileSearchAndSort);
  }

  function fetchMobileFiles() {
    secureFetch(`/api/files?folder=${encodeURIComponent(activeFolderMobileFiles)}`)
      .then(res => res.json())
      .then(files => {
        currentMobileFileList = files;
        applyMobileSearchAndSort();
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Mobil dosya çekme hatası:', err);
      });
  }

  function applyMobileSearchAndSort() {
    const query = mobileFileSearchInput.value.toLowerCase().trim();
    const sortVal = mobileFileSortSelect.value;

    let filtered = currentMobileFileList.filter(file => {
      const cleanDisplayName = file.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
      return cleanDisplayName.toLowerCase().includes(query);
    });

    // Sorting
    filtered.sort((a, b) => {
      const nameA = a.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '').toLowerCase();
      const nameB = b.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '').toLowerCase();

      switch (sortVal) {
        case 'name-asc':
          return nameA.localeCompare(nameB);
        case 'name-desc':
          return nameB.localeCompare(nameA);
        case 'size-desc':
          return b.size - a.size;
        case 'size-asc':
          return a.size - b.size;
        case 'date-asc':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'date-desc':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    renderMobileFiles(filtered);
  }

  function renderMobileFiles(files) {
    if (!mobileFilesContainer) return;

    if (files.length === 0) {
      mobileFilesContainer.innerHTML = `<div class="no-devices" style="margin-top: 40px;">Klasör boş.</div>`;
      return;
    }

    mobileFilesContainer.innerHTML = files.map(file => {
      const fileClass = getFileClass(file.name);
      const isImg = fileClass === 'file-image';
      const isVid = fileClass === 'file-video';
      const isAud = fileClass === 'file-audio';
      const ext = file.name.split('.').pop().toLowerCase();
      const isText = ['txt', 'md', 'js', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'sh', 'bat'].includes(ext);
      
      let fileIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      if (isImg) {
        fileIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
      } else if (fileClass === 'file-pdf') {
        fileIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #ef4444;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      } else if (isVid) {
        fileIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
      } else if (isAud) {
        fileIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #10b981;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
      } else if (isText) {
        fileIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`;
      }

      const cleanDisplayName = file.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
      const secureUrl = getSecureMediaUrl(file.url);

      // Media click action
      const clickAction = (isImg || isVid || isAud || isText)
        ? `onclick="document.getElementById('mobileFilesContainer').dispatchEvent(new CustomEvent('play-media', {detail: {url: '${file.url}', name: '${file.name}', isVideo: ${isVid}, isAudio: ${isAud}, isImg: ${isImg}, isText: ${isText}, folder: '${file.folder}'}}))"`
        : '';

      let extractActionHtml = '';
      if (fileClass === 'file-zip') {
        extractActionHtml = `
          <button class="btn-icon" style="background: var(--accent-color); margin-right: 6px;" title="Ayıkla" onclick="document.getElementById('mobileFilesContainer').dispatchEvent(new CustomEvent('extract-zip', {detail: {folder: '${file.folder}', filename: '${file.name}'}}))">
            📦
          </button>
        `;
      }

      return `
        <div class="mobile-file-row ${fileClass}" ${clickAction} style="cursor: pointer;">
          <div class="file-type-icon">${fileIcon}</div>
          <div class="mobile-file-info">
            <span class="mobile-file-name">${escapeHtml(cleanDisplayName)}</span>
            <span class="mobile-file-size">${formatBytes(file.size)}</span>
          </div>
          <div class="mobile-file-actions" onclick="event.stopPropagation()">
            ${extractActionHtml}
            <a href="${secureUrl}" download="${file.name}" class="btn-icon download" title="İndir">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // Mobile media player dispatcher listener
  if (mobileFilesContainer) {
    mobileFilesContainer.addEventListener('play-media', (e) => {
      const { url, name, isVideo, isAudio, isImg, isText, folder } = e.detail;
      if (isImg) {
        openImageLightbox(url, name);
      } else if (isText) {
        openTextViewer(folder, name);
      } else {
        openMediaPlayer(url, name, isVideo);
      }
    });

    mobileFilesContainer.addEventListener('extract-zip', (e) => {
      const { folder, filename } = e.detail;
      extractZip(folder, filename);
    });
  }

  // --- Toast Notification System ---
  function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;

    toast.innerHTML = `
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds (matched with CSS animation)
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  // --- Text Viewer Modal Logic ---
  const textViewerModal = document.getElementById('textViewerModal');
  const textViewerPre = document.getElementById('textViewerPre');
  const textViewerTitle = document.getElementById('textViewerTitle');
  const closeTextViewerBtn = document.getElementById('closeTextViewerBtn');
  const closeTextViewerFooterBtn = document.getElementById('closeTextViewerFooterBtn');

  function openTextViewer(folder, filename) {
    const cleanName = filename.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
    textViewerTitle.textContent = cleanName;
    textViewerPre.textContent = 'Yükleniyor...';
    
    textViewerModal.classList.add('active');
    textViewerModal.classList.remove('hidden');

    secureFetch(`/api/files/content?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}`)
      .then(res => {
        if (!res.ok) throw new Error('Dosya okunamadı.');
        return res.json();
      })
      .then(data => {
        textViewerPre.textContent = data.content;
      })
      .catch(err => {
        textViewerPre.textContent = 'Hata: Dosya içeriği yüklenemedi. (1MB limitini aşmış olabilir veya geçersiz kodlama)';
        console.error(err);
      });
  }

  function closeTextViewer() {
    textViewerModal.classList.remove('active');
    textViewerModal.classList.add('hidden');
    textViewerPre.textContent = '';
  }

  if (closeTextViewerBtn) closeTextViewerBtn.addEventListener('click', closeTextViewer);
  if (closeTextViewerFooterBtn) closeTextViewerFooterBtn.addEventListener('click', closeTextViewer);
  if (textViewerModal) {
    textViewerModal.addEventListener('click', (e) => {
      if (e.target === textViewerModal) closeTextViewer();
    });
  }

  // --- ZIP Extraction Logic ---
  function extractZip(folder, filename) {
    showToast('ZIP Ayıklanıyor', `${filename} ayıklanıyor...`, 'info');
    secureFetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, filename })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showToast('Hata', data.error, 'danger');
      } else {
        showToast('Başarılı', data.message, 'success');
        fetchFolders();
        if (!isMobile) {
          fetchFiles();
        } else {
          fetchMobileFiles();
        }
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Hata', 'Arşiv ayıklanamadı.', 'danger');
    });
  }

  // --- Live Chat Logic ---
  const chatInputPC = document.getElementById('chatInputPC');
  const sendChatBtnPC = document.getElementById('sendChatBtnPC');
  const chatMessagesPC = document.getElementById('chatMessagesPC');

  const chatInputMobile = document.getElementById('chatInputMobile');
  const sendChatBtnMobile = document.getElementById('sendChatBtnMobile');
  const chatMessagesMobile = document.getElementById('chatMessagesMobile');

  function fetchChatMessages() {
    secureFetch('/api/chat')
      .then(res => res.json())
      .then(messages => {
        renderChatMessages(messages);
      })
      .catch(err => console.error('Sohbet geçmişi yüklenemedi:', err));
  }

  function sendChatMessage(inputEl) {
    const text = inputEl.value.trim();
    if (!text) return;

    secureFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, device: deviceName })
    })
    .then(res => res.json())
    .then(() => {
      inputEl.value = '';
    })
    .catch(err => console.error('Mesaj gönderilemedi:', err));
  }

  function renderChatMessages(messages) {
    const renderMsg = (msg) => {
      const isOutgoing = msg.device === deviceName;
      const cleanTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="chat-msg ${isOutgoing ? 'outgoing' : 'incoming'}">
          <div class="chat-msg-device">${escapeHtml(msg.device)}</div>
          <div>${escapeHtml(msg.text)}</div>
          <div class="chat-msg-meta">${cleanTime}</div>
        </div>
      `;
    };

    const html = messages.length === 0 
      ? `<div class="no-chat-messages">Mesaj bulunmuyor...</div>`
      : messages.map(renderMsg).join('');

    if (chatMessagesPC) {
      chatMessagesPC.innerHTML = html;
      chatMessagesPC.scrollTop = chatMessagesPC.scrollHeight;
    }
    if (chatMessagesMobile) {
      chatMessagesMobile.innerHTML = html;
      chatMessagesMobile.scrollTop = chatMessagesMobile.scrollHeight;
    }
  }

  if (sendChatBtnPC && chatInputPC) {
    sendChatBtnPC.addEventListener('click', () => sendChatMessage(chatInputPC));
    chatInputPC.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage(chatInputPC);
    });
  }

  if (sendChatBtnMobile && chatInputMobile) {
    sendChatBtnMobile.addEventListener('click', () => sendChatMessage(chatInputMobile));
    chatInputMobile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage(chatInputMobile);
    });
  }

  // Load chat on startup
  fetchChatMessages();

  // --- Voice Recorder Logic ---
  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimer = null;
  let recordSeconds = 0;

  const startRecordBtn = document.getElementById('startRecordBtn');
  const stopRecordBtn = document.getElementById('stopRecordBtn');
  const recordDuration = document.getElementById('recordDuration');
  const recordingWaveform = document.getElementById('recordingWaveform');
  const voicePreviewArea = document.getElementById('voicePreviewArea');
  const voiceAudioPreview = document.getElementById('voiceAudioPreview');
  const uploadRecordBtn = document.getElementById('uploadRecordBtn');

  if (startRecordBtn) {
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    uploadRecordBtn.addEventListener('click', uploadVoiceRecording);
  }

  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          voiceAudioPreview.src = audioUrl;
          voicePreviewArea.classList.remove('hidden');

          // Clean up stream tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        
        // UI Updates
        startRecordBtn.classList.add('hidden');
        stopRecordBtn.classList.remove('hidden');
        recordDuration.classList.remove('hidden');
        recordingWaveform.classList.remove('hidden');
        voicePreviewArea.classList.add('hidden');

        // Start duration timer
        recordSeconds = 0;
        recordDuration.textContent = '00:00';
        recordTimer = setInterval(() => {
          recordSeconds++;
          const mins = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
          const secs = String(recordSeconds % 60).padStart(2, '0');
          recordDuration.textContent = `${mins}:${secs}`;
        }, 1000);

        showToast('Kayıt Başladı', 'Ses kaydı yapılıyor...', 'info');
      })
      .catch(err => {
        console.error('Mikrofon erişim hatası:', err);
        alert('Mikrofon erişimi engellendi veya bulunamadı.');
      });
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      clearInterval(recordTimer);
      
      startRecordBtn.classList.remove('hidden');
      stopRecordBtn.classList.add('hidden');
      recordingWaveform.classList.add('hidden');
      showToast('Kayıt Durduruldu', 'Ses kaydı önizlemeye hazır.', 'success');
    }
  }

  function uploadVoiceRecording() {
    if (audioChunks.length === 0) return;

    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    formData.append('files', audioBlob, `Ses_Kaydi_${timestamp}.webm`);

    const targetFolder = folderSelectMobile ? folderSelectMobile.value : 'Genel';
    
    uploadRecordBtn.disabled = true;
    uploadRecordBtn.textContent = 'Yükleniyor...';

    const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
    const headers = {
      'X-Folder': encodeURIComponent(targetFolder)
    };
    if (pin) headers['X-PIN'] = pin;

    fetch('/api/upload', {
      method: 'POST',
      headers: headers,
      body: formData
    })
    .then(res => {
      if (res.status === 401) {
        showPinModal();
        throw new Error('Unauthorized');
      }
      return res.json();
    })
    .then(() => {
      showToast('Yüklendi', 'Ses kaydı başarıyla aktarıldı!', 'success');
      voicePreviewArea.classList.add('hidden');
      recordDuration.classList.add('hidden');
      uploadRecordBtn.disabled = false;
      uploadRecordBtn.textContent = 'Ses Kaydını Yükle';
      
      if (isMobile) {
        fetchMobileFiles();
      } else {
        fetchFiles();
      }
    })
    .catch(err => {
      uploadRecordBtn.disabled = false;
      uploadRecordBtn.textContent = 'Ses Kaydını Yükle';
      if (err.message === 'Unauthorized') return;
      console.error('Ses kaydı yükleme hatası:', err);
      showToast('Hata', 'Ses kaydı yüklenemedi.', 'danger');
    });
  }

  // --- Mobile Upload Logic ---
  function setupMobileUploader() {
    fileInput.addEventListener('change', handleFileSelection);

    newFolderBtnMobile.addEventListener('click', () => {
      createNewFolder('Yeni klasör adı girin:');
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
      }, false);
    });

    dropArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      fileInput.files = files;
      handleFileSelection();
    });

    clearBtn.addEventListener('click', clearForm);

    uploadForm.addEventListener('submit', (e) => {
      e.preventDefault();
    });

    connectToSSE();
  }

  function handleFileSelection() {
    const files = fileInput.files;
    if (files.length === 0) return;

    previewContainer.innerHTML = '';
    previewContainer.classList.remove('hidden');
    successStatus.classList.add('hidden');

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item loading-item';
        
        const isImage = file.type.startsWith('image/');
        if (isImage) {
          previewItem.style.backgroundImage = `url('${e.target.result}')`;
        } else {
          previewItem.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;background:rgba(255,255,255,0.05)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
          `;
        }
        
        previewItem.id = `preview-item-${index}`;

        const loaderOverlay = document.createElement('div');
        loaderOverlay.className = 'loader-overlay';
        loaderOverlay.innerHTML = `<div class="mini-spinner"></div>`;
        previewItem.appendChild(loaderOverlay);
        previewContainer.appendChild(previewItem);
      };
      reader.readAsDataURL(file);
    });

    uploadFiles();
  }

  function clearForm() {
    uploadForm.reset();
    previewContainer.innerHTML = '';
    previewContainer.classList.add('hidden');
    mobileActions.classList.add('hidden');
    progressArea.classList.add('hidden');
    progressBar.style.width = '0%';
  }

  function uploadFiles() {
    const files = fileInput.files;
    if (files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const targetFolder = folderSelectMobile.value || 'Genel';

    dropArea.style.pointerEvents = 'none';
    dropArea.style.opacity = '0.5';
    progressArea.classList.remove('hidden');
    successStatus.classList.add('hidden');

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressText.textContent = `${files.length} dosya [${targetFolder}] klasörüne aktarılıyor...`;
      }
    });

    xhr.addEventListener('load', () => {
      dropArea.style.pointerEvents = 'auto';
      dropArea.style.opacity = '1';
      progressArea.classList.add('hidden');

      if (xhr.status === 200) {
        successStatus.classList.remove('hidden');
        
        document.querySelectorAll('.preview-item').forEach(item => {
          item.classList.remove('loading-item');
          const overlay = item.querySelector('.loader-overlay');
          if (overlay) overlay.remove();
          
          const checkBadge = document.createElement('div');
          checkBadge.className = 'check-badge';
          checkBadge.innerHTML = '✓';
          item.appendChild(checkBadge);
        });

        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        
        fileInput.value = '';
        mobileActions.classList.remove('hidden');
      } else {
        if (xhr.status === 401) {
          showPinModal();
        } else {
          alert('Aktarım sırasında hata oluştu.');
        }
        clearForm();
      }
    });

    xhr.addEventListener('error', () => {
      dropArea.style.pointerEvents = 'auto';
      dropArea.style.opacity = '1';
      progressArea.classList.add('hidden');
      alert('Ağ bağlantısı koptu.');
      clearForm();
    });

    xhr.open('POST', '/api/upload', true);
    
    const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
    xhr.setRequestHeader('X-Folder', encodeURIComponent(targetFolder));
    if (pin) xhr.setRequestHeader('X-PIN', pin);
    
    xhr.send(formData);
  }

  // --- Image Lightbox Modal & Slideshow Logic ---
  function openImageLightbox(url, name) {
    lightbox.classList.add('active');
    lightboxImg.src = getSecureMediaUrl(url);
    const cleanName = name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
    lightboxCaption.textContent = cleanName;

    // Find index in slideshow playlist
    currentImageIndex = imagePlaylist.findIndex(f => f.url === url);
    updateSlideshowButtons();
  }

  function updateSlideshowButtons() {
    if (imagePlaylist.length <= 1) {
      prevLightboxBtn.style.display = 'none';
      nextLightboxBtn.style.display = 'none';
    } else {
      prevLightboxBtn.style.display = 'flex';
      nextLightboxBtn.style.display = 'flex';
    }
  }

  function navigateSlideshow(direction) {
    if (imagePlaylist.length <= 1) return;
    
    currentImageIndex += direction;
    if (currentImageIndex < 0) {
      currentImageIndex = imagePlaylist.length - 1; // Wrap to end
    } else if (currentImageIndex >= imagePlaylist.length) {
      currentImageIndex = 0; // Wrap to start
    }

    const nextImg = imagePlaylist[currentImageIndex];
    lightboxImg.src = getSecureMediaUrl(nextImg.url);
    const cleanName = nextImg.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
    lightboxCaption.textContent = cleanName;
  }

  // Event listeners for slideshow
  prevLightboxBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateSlideshow(-1);
  });

  nextLightboxBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateSlideshow(1);
  });

  document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('active')) {
      if (e.key === 'ArrowLeft') {
        navigateSlideshow(-1);
      } else if (e.key === 'ArrowRight') {
        navigateSlideshow(1);
      } else if (e.key === 'Escape') {
        lightbox.classList.remove('active');
      }
    }
  });

  closeLightbox.addEventListener('click', () => {
    lightbox.classList.remove('active');
  });

  lightbox.addEventListener('click', (e) => {
    if (e.target !== lightboxImg && e.target !== lightboxCaption && e.target !== prevLightboxBtn && e.target !== nextLightboxBtn) {
      lightbox.classList.remove('active');
    }
  });

  // --- Custom Media Player Modal Logic ---
  function openMediaPlayer(url, name, isVideo) {
    mediaPlayerModal.classList.add('active');
    mediaPlayerModal.classList.remove('hidden');
    
    const secureUrl = getSecureMediaUrl(url);
    const cleanName = name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
    mediaPlayerCaption.textContent = cleanName;

    // Reset player elements
    playerVideo.src = '';
    playerAudio.src = '';
    playerVideo.style.display = 'none';
    audioWrapper.style.display = 'none';

    if (isVideo) {
      playerVideo.src = secureUrl;
      playerVideo.style.display = 'block';
      playerVideo.play();
    } else {
      playerAudio.src = secureUrl;
      audioWrapper.style.display = 'block';
      playerAudio.play();
    }
  }

  function closeMediaPlayer() {
    mediaPlayerModal.classList.remove('active');
    mediaPlayerModal.classList.add('hidden');
    // Stop playback
    playerVideo.pause();
    playerAudio.pause();
    playerVideo.src = '';
    playerAudio.src = '';
  }

  closeMediaPlayerBtn.addEventListener('click', closeMediaPlayer);
  mediaPlayerModal.addEventListener('click', (e) => {
    if (e.target === mediaPlayerModal) {
      closeMediaPlayer();
    }
  });

  // Helpers
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function escapeHtml(string) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      "/": '&#x2F;'
    };
    const reg = /[&<>"'/]/ig;
    return string.replace(reg, (match) => map[match]);
  }
});
