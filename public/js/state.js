// Global State
export const state = {
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768,
  deviceId: localStorage.getItem('airdrop_device_id') || (() => {
    const id = Math.random().toString(36).substring(2, 9);
    localStorage.setItem('airdrop_device_id', id);
    return id;
  })(),
  deviceName: localStorage.getItem('airdrop_device_name') || '',
  qrCodeInstance: null,
  serverUploadUrl: '',
  eventSource: null,
  activeFolderPC: 'Genel',
  activeFolderMobileFiles: 'Genel',
  currentFileList: [],
  currentMobileFileList: [],
  imagePlaylist: [],
  currentImageIndex: -1,
  selectedFiles: [],
  userPaths: {},
  faceDescriptorCache: {},
  activePersonFilter: null,
  allFaceClusters: [],
  isBgScanning: false,
  modelsLoaded: false,
  isScanning: false,
  referenceDescriptor: null
};

// Initialize deviceName fallback
if (!state.deviceName) {
  state.deviceName = state.isMobile 
    ? (navigator.userAgent.match(/(iPhone|iPad|iPod|Android)/i) ? navigator.userAgent.match(/(iPhone|iPad|iPod|Android)/i)[0] : 'Mobil Cihaz')
    : 'Bilgisayar';
}

// Helpers
export function getUrlPin() {
  const params = new URLSearchParams(window.location.search);
  return params.get('pin');
}

export function secureFetch(url, options = {}) {
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

function showPinModal() {
  const pinModal = document.getElementById('pinModal');
  const pinModalInput = document.getElementById('pinModalInput');
  if (pinModal) {
    pinModal.classList.remove('hidden');
    pinModal.classList.add('active');
    if (pinModalInput) pinModalInput.focus();
  }
}

export function showCustomAlert(title, message) {
  const alertModal = document.getElementById('customAlertModal');
  const alertTitle = document.getElementById('customAlertTitle');
  const alertMessage = document.getElementById('customAlertMessage');
  if (alertTitle) alertTitle.textContent = title;
  if (alertMessage) alertMessage.textContent = message;
  if (alertModal) {
    alertModal.classList.remove('hidden');
    alertModal.classList.add('active');
  }
}

export function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '🔔';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'info') icon = 'ℹ️';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  // Trigger animations
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function escapeHtml(string) {
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

export function getSecureMediaUrl(relativeUrl) {
  const pin = sessionStorage.getItem('airdrop_pin') || getUrlPin() || '';
  if (!pin) return relativeUrl;
  const separator = relativeUrl.includes('?') ? '&' : '?';
  return `${relativeUrl}${separator}pin=${pin}`;
}

export function getFileClass(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'file-image';
  if (['pdf'].includes(ext)) return 'file-pdf';
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return 'file-zip';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) return 'file-doc';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'file-audio';
  if (['mp4', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) return 'file-video';
  return 'file-other';
}
