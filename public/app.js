import { state, getUrlPin, secureFetch, showToast, showCustomAlert, getSecureMediaUrl } from './js/state.js';
import { initAuthListeners, showPinModal, showDeviceNameModal, showAccountModal, hideAccountModal, loadSettingsData } from './js/auth.js';
import { initClipboardListeners, fetchClipboard, renderClipboard } from './js/clipboard.js';
import { initMediaListeners } from './js/media.js';
import { initFaceListeners, loadProfileReferences } from './js/faces.js';
import { fetchFolders, fetchFiles, fetchMobileFiles, uploadPCFiles, getFilesFromDataTransfer, renameFolder, deleteFolder, mapFolder, initBatchActions } from './js/files.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM selectors
  const statusBadge = document.getElementById('statusBadge');
  const statusText = statusBadge.querySelector('.status-text');
  const desktopView = document.getElementById('desktopView');
  const mobileView = document.getElementById('mobileView');
  const ipAddressText = document.getElementById('ipAddressText');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const folderSelectPC = document.getElementById('folderSelectPC');
  const newFolderBtnPC = document.getElementById('newFolderBtnPC');
  const renameFolderBtnPC = document.getElementById('renameFolderBtnPC');
  const deleteFolderBtnPC = document.getElementById('deleteFolderBtnPC');
  const pcDropArea = document.getElementById('pcDropArea');
  const pcFileInput = document.getElementById('pcFileInput');
  const pcFolderInput = document.getElementById('pcFolderInput');
  const pcFolderSelectLink = document.getElementById('pcFolderSelectLink');
  const devicesList = document.getElementById('devicesList');

  // Initialize all modular listeners
  initAuthListeners(startApp);
  initClipboardListeners();
  initMediaListeners();
  initFaceListeners();
  initBatchActions();

  // Setup Views based on Device Type
  if (state.isMobile) {
    desktopView.classList.remove('active');
    mobileView.classList.add('active');
    setupMobileTabs();
  } else {
    desktopView.classList.add('active');
    mobileView.classList.remove('active');
  }

  // Setup Theme & Accent
  setupThemeAndAccent();

  // Boot Application
  initializeSession();

  function initializeSession() {
    const pin = getUrlPin() || localStorage.getItem('airdrop_pin');

    // Restore account from storage
    if (!sessionStorage.getItem('airdrop_account') && localStorage.getItem('airdrop_account')) {
      sessionStorage.setItem('airdrop_account', localStorage.getItem('airdrop_account'));
    }
    if (!sessionStorage.getItem('airdrop_pin') && localStorage.getItem('airdrop_pin')) {
      sessionStorage.setItem('airdrop_pin', localStorage.getItem('airdrop_pin'));
    }

    if (state.isMobile) {
      if (!pin) {
        showPinModal();
      } else {
        fetch(`/api/sessions/validate/${pin}`)
          .then(res => {
            if (res.status === 401) {
              sessionStorage.removeItem('airdrop_pin');
              localStorage.removeItem('airdrop_pin');
              showPinModal();
            } else {
              return res.json();
            }
          })
          .then(data => {
            if (data) {
              sessionStorage.setItem('airdrop_pin', pin);
              localStorage.setItem('airdrop_pin', pin);
              sessionStorage.setItem('airdrop_session_name', data.name || `Oturum #${pin}`);
              localStorage.setItem('airdrop_session_name', data.name || `Oturum #${pin}`);
              sessionStorage.setItem('airdrop_account', data.account);
              localStorage.setItem('airdrop_account', data.account);
              
              const currentUrlParams = new URLSearchParams(window.location.search);
              if (!currentUrlParams.has('pin')) {
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?pin=' + pin;
                window.history.replaceState({ path: newUrl }, '', newUrl);
              }
              
              if (!localStorage.getItem('airdrop_device_name')) {
                showDeviceNameModal(startApp);
              } else {
                startApp();
              }
            }
          })
          .catch(() => {
            sessionStorage.setItem('airdrop_pin', pin);
            localStorage.setItem('airdrop_pin', pin);
            if (!localStorage.getItem('airdrop_device_name')) {
              showDeviceNameModal(startApp);
            } else {
              startApp();
            }
          });
      }
    } else {
      if (pin) {
        fetch(`/api/sessions/validate/${pin}`)
          .then(res => {
            if (res.status === 200) return res.json();
            throw new Error('Invalid PIN');
          })
          .then(data => {
            sessionStorage.setItem('airdrop_account', data.account);
            localStorage.setItem('airdrop_account', data.account);
            sessionStorage.setItem('airdrop_pin', pin);
            localStorage.setItem('airdrop_pin', pin);
            sessionStorage.setItem('airdrop_session_name', data.name || `Oturum #${pin}`);
            localStorage.setItem('airdrop_session_name', data.name || `Oturum #${pin}`);
            
            updateUserHeaders(data.account);
            
            const currentUrlParams = new URLSearchParams(window.location.search);
            if (!currentUrlParams.has('pin')) {
              const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?pin=' + pin;
              window.history.replaceState({ path: newUrl }, '', newUrl);
            }
            startApp();
          })
          .catch(() => {
            sessionStorage.removeItem('airdrop_pin');
            localStorage.removeItem('airdrop_pin');
            sessionStorage.removeItem('airdrop_account');
            localStorage.removeItem('airdrop_account');
            showAccountModal(false);
          });
      } else {
        const account = localStorage.getItem('airdrop_account');
        showAccountModal(!!account);
      }
    }
  }

  function startApp() {
    if (state.isMobile) {
      setupMobileUploader();
    } else {
      setupDesktopDashboard();
    }

    const pin = sessionStorage.getItem('airdrop_pin');
    const sessionName = sessionStorage.getItem('airdrop_session_name') || `Oturum #${pin}`;
    document.querySelectorAll('#activeSessionHeaderBadge').forEach(badge => {
      badge.textContent = `🔑 Oda: ${sessionName} (PIN: ${pin})`;
    });

    updateStatus();
    fetchFolders();
    fetchClipboard();
    loadProfileReferences();
    loadSettingsData();

    if (!state.isMobile) {
      const goToSessionsBtn = document.getElementById('goToSessionsBtnPC');
      if (goToSessionsBtn) {
        goToSessionsBtn.addEventListener('click', () => {
          sessionStorage.removeItem('airdrop_pin');
          localStorage.removeItem('airdrop_pin');
          window.location.href = window.location.protocol + "//" + window.location.host + window.location.pathname;
        });
      }
    }
  }

  function updateUserHeaders(accountName) {
    document.querySelectorAll('#userHeaderBadge').forEach(badge => {
      badge.classList.remove('hidden');
      const nameSpan = badge.querySelector('#userHeaderName');
      if (nameSpan) nameSpan.textContent = `👤 Kullanıcı: ${accountName}`;
    });
  }

  function updateStatus() {
    secureFetch('/api/status')
      .then(res => res.json())
      .then(data => {
        const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
        state.serverUploadUrl = pin ? `${data.uploadUrl}?pin=${pin}` : data.uploadUrl;
        statusText.textContent = `Aktif: ${data.ip}:${data.port}`;
        
        if (!state.isMobile && !state.qrCodeInstance && document.getElementById('qrcode')) {
          state.qrCodeInstance = new QRCode(document.getElementById('qrcode'), {
            text: state.serverUploadUrl,
            width: 180,
            height: 180,
            colorDark: '#0a0b10',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
          ipAddressText.textContent = state.serverUploadUrl;
        }
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        statusText.textContent = 'Bağlantı kesildi';
        statusBadge.querySelector('.pulse-dot').style.backgroundColor = '#ef4444';
        statusBadge.querySelector('.pulse-dot').style.boxShadow = '0 0 8px #ef4444';
        console.error('Status fetch error:', err);
      });
  }

  function setupDesktopDashboard() {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        menuItems.forEach(m => m.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        
        item.classList.add('active');
        const targetTab = item.dataset.tab;
        const panel = document.getElementById(targetTab);
        if (panel) panel.classList.add('active');
        if (targetTab === 'settingsTab') {
          loadProfileReferences();
          loadSettingsData();
        }
      });
    });

    fetchFiles();
    connectToSSE();

    if (refreshBtn) refreshBtn.addEventListener('click', fetchFiles);
    if (downloadZipBtn) {
      downloadZipBtn.addEventListener('click', () => {
        window.location.href = getSecureMediaUrl(`/api/zip/${encodeURIComponent(state.activeFolderPC)}`);
      });
    }

    if (folderSelectPC) {
      folderSelectPC.addEventListener('change', (e) => {
        state.activeFolderPC = e.target.value;
        fetchFiles();
      });
    }

    if (newFolderBtnPC) {
      newFolderBtnPC.addEventListener('click', () => {
        const folderModal = document.getElementById('folderModal');
        const folderModalTitle = document.getElementById('folderModalTitle');
        const folderModalInput = document.getElementById('folderModalInput');
        if (folderModal) {
          folderModalTitle.textContent = 'Yeni klasör oluştur:';
          folderModalInput.value = '';
          folderModal.classList.add('active');
          folderModal.classList.remove('hidden');
          setTimeout(() => folderModalInput.focus(), 50);
        }
      });
    }

    if (renameFolderBtnPC) {
      renameFolderBtnPC.addEventListener('click', renameFolder);
    }

    if (deleteFolderBtnPC) {
      deleteFolderBtnPC.addEventListener('click', deleteFolder);
    }

    if (mapFolderBtnPC) {
      mapFolderBtnPC.addEventListener('click', mapFolder);
    }

    // PC Drag and Drop
    if (pcDropArea) {
      pcDropArea.addEventListener('click', (e) => {
        if (e.target === pcFolderSelectLink) return;
        pcFileInput.click();
      });
      pcFileInput.addEventListener('change', () => uploadPCFiles(pcFileInput.files));

      if (pcFolderSelectLink && pcFolderInput) {
        pcFolderSelectLink.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          pcFolderInput.click();
        });
        pcFolderInput.addEventListener('change', () => uploadPCFiles(pcFolderInput.files));
      }

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

      pcDropArea.addEventListener('drop', async (e) => {
        const files = await getFilesFromDataTransfer(e.dataTransfer);
        uploadPCFiles(files);
      });
    }

    // Copy URL
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(state.serverUploadUrl)
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
    }
  }

  function setupMobileUploader() {
    if (fileInput) {
      fileInput.addEventListener('change', () => {
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

        // Trigger upload
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
              showCustomAlert('Aktarım Hatası', 'Aktarım sırasında hata oluştu.');
            }
            uploadForm.reset();
            previewContainer.innerHTML = '';
            previewContainer.classList.add('hidden');
            mobileActions.classList.add('hidden');
          }
        });

        xhr.open('POST', '/api/upload', true);
        const pin = sessionStorage.getItem('airdrop_pin') || '';
        xhr.setRequestHeader('X-Folder', encodeURIComponent(targetFolder));
        if (pin) xhr.setRequestHeader('X-PIN', pin);
        xhr.send(formData);
      });
    }

    if (newFolderBtnMobile) {
      newFolderBtnMobile.addEventListener('click', () => {
        const folderModal = document.getElementById('folderModal');
        const folderModalTitle = document.getElementById('folderModalTitle');
        const folderModalInput = document.getElementById('folderModalInput');
        if (folderModal) {
          folderModalTitle.textContent = 'Yeni klasör oluştur:';
          folderModalInput.value = '';
          folderModal.classList.add('active');
          folderModal.classList.remove('hidden');
          setTimeout(() => folderModalInput.focus(), 50);
        }
      });
    }

    if (dropArea) {
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
        // Trigger manual change
        const event = new Event('change');
        fileInput.dispatchEvent(event);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        uploadForm.reset();
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
        mobileActions.classList.add('hidden');
        progressArea.classList.add('hidden');
        progressBar.style.width = '0%';
      });
    }

    connectToSSE();
  }

  function setupMobileTabs() {
    const tabButtons = document.querySelectorAll('.mobile-nav-item');
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
        }
      });
    });

    if (folderSelectMobileFiles) {
      folderSelectMobileFiles.addEventListener('change', (e) => {
        state.activeFolderMobileFiles = e.target.value;
        fetchMobileFiles();
      });
    }
  }

  function connectToSSE() {
    const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
    if (!pin) return;

    if (state.eventSource) {
      state.eventSource.close();
    }

    state.eventSource = new EventSource(`/api/sessions/events?pin=${pin}&device=${encodeURIComponent(state.deviceName)}&id=${state.deviceId}`);

    state.eventSource.onopen = () => {
      console.log('[+] Real-time event stream connected.');
    };

    state.eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'global_sessions_update') {
          // Trigger global session update if handler exists
        } else if (data.type === 'device_list_update') {
          renderDevicesList(data.devices);
        } else if (data.type === 'chat_message') {
          renderClipboard(data.messages); // Update chat UI using messages array if required
          fetchClipboard(); // fallback sync
        } else if (data.type === 'clipboard_update') {
          renderClipboard(data.items);
        } else if (data.type === 'upload' || data.type === 'delete' || data.type === 'folder_created' || data.type === 'folder_deleted' || data.type === 'folder_renamed') {
          fetchFolders();
          if (state.isMobile) {
            fetchMobileFiles();
          } else {
            fetchFiles();
          }
        }
      } catch (err) {}
    };

    state.eventSource.onerror = (err) => {
      console.warn('SSE connection lost. Reconnecting in 5s...', err);
      state.eventSource.close();
      setTimeout(connectToSSE, 5000);
    };
  }

  function renderDevicesList(devices) {
    if (!devicesList) return;
    const otherDevices = devices.filter(d => d.id !== state.deviceId);

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
});
