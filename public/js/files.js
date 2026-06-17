import { state, secureFetch, showToast, showCustomAlert, getSecureMediaUrl, getFileClass, formatBytes, escapeHtml } from './state.js';
import { startBackgroundFaceScan, loadProfileReferences } from './faces.js';
import { openImageLightbox, openMediaPlayer } from './media.js';

// DOM Elements
const folderSelectPC = document.getElementById('folderSelectPC');
const folderSelectMobile = document.getElementById('folderSelectMobile');
const folderSelectMobileFiles = document.getElementById('folderSelectMobileFiles');
const galleryContainer = document.getElementById('galleryContainer');
const mobileFilesContainer = document.getElementById('mobileFilesContainer');
const statsCounter = document.getElementById('statsCounter');

const fileSearchInput = document.getElementById('fileSearchInput');
const fileSortSelect = document.getElementById('fileSortSelect');
const mobileFileSearchInput = document.getElementById('mobileFileSearchInput');
const mobileFileSortSelect = document.getElementById('mobileFileSortSelect');

const pcFileInput = document.getElementById('pcFileInput');
const pcFolderInput = document.getElementById('pcFolderInput');
const pcFolderSelectLink = document.getElementById('pcFolderSelectLink');
const pcDropArea = document.getElementById('pcDropArea');

const fileInput = document.getElementById('fileInput');
const newFolderBtnMobile = document.getElementById('newFolderBtnMobile');
const dropArea = document.getElementById('dropArea');
const clearBtn = document.getElementById('clearBtn');
const uploadForm = document.getElementById('uploadForm');
const previewContainer = document.getElementById('previewContainer');
const successStatus = document.getElementById('successStatus');
const mobileActions = document.getElementById('mobileActions');
const progressArea = document.getElementById('progressArea');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressText = document.getElementById('progressText');

const gallerySelectionBar = document.getElementById('gallerySelectionBar');
const selectionCountText = document.getElementById('selectionCountText');

export function fetchFaceCache(folderName, callback) {
  secureFetch(`/api/face-cache?folder=${encodeURIComponent(folderName)}`)
    .then(res => res.json())
    .then(cacheData => {
      for (const fileName in cacheData) {
        state.faceDescriptorCache[fileName] = cacheData[fileName];
      }
      if (callback) callback();
    })
    .catch(err => {
      console.error('Error fetching face cache:', err);
      if (callback) callback();
    });
}

export function fetchFolders(selectToActive = null) {
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
        state.activeFolderPC = currentSelected;
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
        state.activeFolderMobileFiles = currentSelected;
      }
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Error fetching folders:', err);
    });
}

export function fetchFiles() {
  const currentFolder = state.activeFolderPC;
  fetchFaceCache(currentFolder, () => {
    secureFetch(`/api/files?folder=${encodeURIComponent(currentFolder)}`)
      .then(res => res.json())
      .then(files => {
        if (state.activeFolderPC !== currentFolder) return;
        state.currentFileList = files;
        applySearchAndSort();
        updateStatistics(files);
        startBackgroundFaceScan();
      })
      .catch(err => {
        if (err.message === 'Unauthorized') return;
        console.error('Error fetching files:', err);
      });
  });
}

export function fetchMobileFiles() {
  secureFetch(`/api/files?folder=${encodeURIComponent(state.activeFolderMobileFiles)}`)
    .then(res => res.json())
    .then(files => {
      state.currentMobileFileList = files;
      applyMobileSearchAndSort();
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Mobil dosya çekme hatası:', err);
    });
}

function updateStatistics(files) {
  let totalSize = 0;
  files.forEach(f => totalSize += f.size);
  if (statsCounter) {
    statsCounter.textContent = `${files.length} Dosya (${formatBytes(totalSize)})`;
  }
}

export function applySearchAndSort() {
  const query = fileSearchInput ? fileSearchInput.value.toLowerCase().trim() : '';
  const sortVal = fileSortSelect ? fileSortSelect.value : 'date-desc';

  let filtered = state.currentFileList.filter(file => {
    const cleanDisplayName = file.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
    return cleanDisplayName.toLowerCase().includes(query);
  });

  if (state.activePersonFilter) {
    filtered = filtered.filter(file => {
      return state.activePersonFilter.files.some(f => f.fileName === file.name);
    });
  }

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

export function renderGallery(files) {
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

  state.imagePlaylist = files.filter(f => getFileClass(f.name) === 'file-image');

  files.forEach(file => {
    const fileClass = getFileClass(file.name);
    
    const fileItem = document.createElement('div');
    fileItem.className = `file-item ${fileClass}`;
    fileItem.dataset.filename = file.name;

    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.className = 'file-select-checkbox';
    checkboxWrapper.addEventListener('click', (e) => e.stopPropagation());

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'file-check-input';
    chk.dataset.filename = file.name;
    chk.checked = state.selectedFiles.includes(file.name);
    chk.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!state.selectedFiles.includes(file.name)) state.selectedFiles.push(file.name);
      } else {
        state.selectedFiles = state.selectedFiles.filter(name => name !== file.name);
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

    const parts = file.name.split('/');
    const cleanParts = parts.map((part, idx) => {
      if (idx === parts.length - 1) {
        return part.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
      }
      return part;
    });
    const cleanDisplayName = cleanParts.join('/');
    const nameEl = document.createElement('span');
    nameEl.className = 'file-name';
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

function openTextViewer(folder, filename) {
  secureFetch(`/api/files/content?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showCustomAlert('Önizleme Hatası', data.error);
        return;
      }
      openMediaPlayer('', filename, false);
      const textWrapper = document.createElement('div');
      textWrapper.style.padding = '20px';
      textWrapper.style.maxHeight = '300px';
      textWrapper.style.overflowY = 'auto';
      textWrapper.style.background = 'rgba(0,0,0,0.3)';
      textWrapper.style.borderRadius = '8px';
      textWrapper.style.color = '#fff';
      textWrapper.style.fontFamily = 'monospace';
      textWrapper.style.whiteSpace = 'pre-wrap';
      textWrapper.textContent = data.content;
      
      const audioWrapper = document.getElementById('audioWrapper');
      if (audioWrapper) {
        audioWrapper.style.display = 'block';
        audioWrapper.innerHTML = '';
        audioWrapper.appendChild(textWrapper);
      }
    })
    .catch(err => console.error(err));
}

function extractZip(folder, filename) {
  secureFetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, filename })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      showCustomAlert('Hata', data.error);
    } else {
      showToast('Ayıklandı', data.message, 'success');
      fetchFiles();
    }
  })
  .catch(err => console.error(err));
}

export function deleteFile(folder, filename) {
  if (confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) {
    secureFetch(`/api/files/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      fetchFiles();
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Silme hatası:', err);
    });
  }
}

export function createNewFolder(promptMessage) {
  const folderModal = document.getElementById('folderModal');
  const folderModalTitle = document.getElementById('folderModalTitle');
  const folderModalInput = document.getElementById('folderModalInput');
  if (!folderModal) return;

  folderModalTitle.textContent = promptMessage;
  folderModalInput.value = '';
  folderModal.classList.add('active');
  folderModal.classList.remove('hidden');
  setTimeout(() => folderModalInput.focus(), 50);

  const saveBtn = document.getElementById('saveFolderModalBtn');
  const cancelBtn = document.getElementById('closeFolderModalBtn');

  const cleanListeners = () => {
    saveBtn.removeEventListener('click', handleSave);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  const handleSave = () => {
    const folderName = folderModalInput.value.trim();
    cleanListeners();
    folderModal.classList.remove('active');
    folderModal.classList.add('hidden');

    if (!folderName) return;
    const cleanName = folderName.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim();
    if (!cleanName) {
      showCustomAlert('Geçersiz Ad', 'Geçersiz klasör adı!');
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
        showCustomAlert('Hata', data.error);
      } else {
        fetchFolders(cleanName);
        if (!state.isMobile) {
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
  };

  const handleCancel = () => {
    cleanListeners();
    folderModal.classList.remove('active');
    folderModal.classList.add('hidden');
  };

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleCancel);
}

export function applyMobileSearchAndSort() {
  const query = mobileFileSearchInput ? mobileFileSearchInput.value.toLowerCase().trim() : '';
  const sortVal = mobileFileSortSelect ? mobileFileSortSelect.value : 'date-desc';

  let filtered = state.currentMobileFileList.filter(file => {
    const cleanDisplayName = file.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
    return cleanDisplayName.toLowerCase().includes(query);
  });

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

    return `
      <div class="mobile-file-item" onclick="window.handleMobileFileClick('${secureUrl}', '${file.name}', ${isImg}, ${isVid}, ${isAud}, ${isText}, '${file.folder}')">
        <div style="display:flex;align-items:center;gap:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <div class="mobile-file-icon">${fileIcon}</div>
          <div style="display:flex;flex-direction:column;overflow:hidden;">
            <span class="mobile-file-name" style="text-overflow:ellipsis;overflow:hidden;">${escapeHtml(cleanDisplayName)}</span>
            <span class="mobile-file-size" style="font-size:11px;color:var(--text-muted);">${formatBytes(file.size)}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <a class="btn-icon" href="${secureUrl}" download="${file.name}" style="background:rgba(255,255,255,0.05);color:var(--text-main);padding:6px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;" onclick="event.stopPropagation()">
            📥
          </a>
          <button class="btn-icon" style="background:rgba(239,68,68,0.1);color:#ef4444;padding:6px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;" onclick="event.stopPropagation(); window.handleMobileFileDelete('${file.folder}', '${file.name}')">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.handleMobileFileClick = (url, name, isImg, isVid, isAud, isText, folder) => {
  if (isImg) openImageLightbox(url, name);
  else if (isVid || isAud) openMediaPlayer(url, name, isVid);
  else if (isText) openTextViewer(folder, name);
};

window.handleMobileFileDelete = (folder, filename) => {
  if (confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) {
    secureFetch(`/api/files/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      fetchMobileFiles();
    })
    .catch(err => console.error(err));
  }
};

function updateSelectionBar() {
  if (!gallerySelectionBar) return;
  const count = state.selectedFiles.length;
  const batchActionsBar = document.getElementById('batchActionsBar');
  const batchActionsCount = document.getElementById('batchActionsCount');
  if (count > 0) {
    gallerySelectionBar.classList.remove('hidden');
    selectionCountText.textContent = `${count} dosya seçildi`;
    if (batchActionsBar && batchActionsCount) {
      batchActionsBar.classList.add('active');
      batchActionsCount.textContent = `${count} dosya seçildi`;
    }
  } else {
    gallerySelectionBar.classList.add('hidden');
    if (batchActionsBar) {
      batchActionsBar.classList.remove('active');
    }
  }
}

function clearSelection() {
  state.selectedFiles = [];
  document.querySelectorAll('.file-check-input').forEach(chk => chk.checked = false);
  updateSelectionBar();
}

// Upload PC Files
export function uploadPCFiles(files) {
  if (files.length === 0) return;
  
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    // Keep relative path for folder uploads
    const relativePath = files[i].webkitRelativePath || '';
    formData.append('files', files[i], relativePath || files[i].name);
  }

  const progressModal = document.getElementById('uploadProgressModal');
  const progressInnerBar = document.getElementById('uploadProgressInnerBar');
  const progressCounter = document.getElementById('uploadProgressCounter');
  const progressDesc = document.getElementById('uploadProgressDesc');

  if (progressModal) {
    progressModal.classList.remove('hidden');
    progressModal.classList.add('active');
    if (progressInnerBar) progressInnerBar.style.width = '0%';
    if (progressCounter) progressCounter.textContent = `0 / ${files.length}`;
    if (progressDesc) progressDesc.textContent = 'Dosyalar yükleniyor...';
  }

  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      if (progressInnerBar) progressInnerBar.style.width = `${percent}%`;
      if (progressCounter) progressCounter.textContent = `${Math.round((e.loaded / e.total) * files.length)} / ${files.length}`;
      if (progressDesc) progressDesc.textContent = `%${percent} Yüklendi...`;
    }
  });

  xhr.addEventListener('load', () => {
    if (progressModal) {
      progressModal.classList.remove('active');
      progressModal.classList.add('hidden');
    }

    if (xhr.status === 200) {
      showToast('Aktarım Başarılı', `${files.length} dosya yüklendi.`, 'success');
      fetchFiles();
    } else {
      if (xhr.status === 401) {
        const pinModal = document.getElementById('pinModal');
        if (pinModal) {
          pinModal.classList.remove('hidden');
          pinModal.classList.add('active');
        }
      } else {
        showCustomAlert('Yükleme Hatası', 'Dosya yüklenirken hata oluştu.');
      }
    }
  });

  xhr.addEventListener('error', () => {
    if (progressModal) {
      progressModal.classList.remove('active');
      progressModal.classList.add('hidden');
    }
    showCustomAlert('Bağlantı Hatası', 'Sunucu ile bağlantı kurulamadı.');
  });

  xhr.open('POST', '/api/upload', true);
  
  const pin = sessionStorage.getItem('airdrop_pin') || '';
  xhr.setRequestHeader('X-Folder', encodeURIComponent(state.activeFolderPC));
  if (pin) xhr.setRequestHeader('X-PIN', pin);

  xhr.send(formData);
}

export function getFilesFromDataTransfer(dataTransfer) {
  return new Promise((resolve) => {
    const files = [];
    const items = dataTransfer.items;
    
    if (!items) {
      resolve(dataTransfer.files);
      return;
    }

    let pending = 0;
    
    const traverse = (item, path = '') => {
      if (item.isFile) {
        pending++;
        item.file(file => {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: path ? `${path}/${file.name}` : file.name,
            writable: true
          });
          files.push(file);
          pending--;
          if (pending === 0) resolve(files);
        });
      } else if (item.isDirectory) {
        pending++;
        const dirReader = item.createReader();
        dirReader.readEntries(entries => {
          entries.forEach(entry => traverse(entry, path ? `${path}/${item.name}` : item.name));
          pending--;
          if (pending === 0) resolve(files);
        });
      }
    };

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) {
        traverse(entry);
      } else {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (pending === 0) resolve(files);
  });
}

export function renameFolder() {
  const folder = state.activeFolderPC;
  if (folder === 'Genel') {
    showCustomAlert('Hata', 'Genel klasörü yeniden adlandırılamaz.');
    return;
  }
  const folderModal = document.getElementById('folderModal');
  const folderModalTitle = document.getElementById('folderModalTitle');
  const folderModalInput = document.getElementById('folderModalInput');
  if (!folderModal) return;

  folderModalTitle.textContent = `Klasörü Yeniden Adlandır (${folder}):`;
  folderModalInput.value = folder;
  folderModal.classList.add('active');
  folderModal.classList.remove('hidden');
  setTimeout(() => folderModalInput.focus(), 50);

  const saveBtn = document.getElementById('saveFolderModalBtn');
  const cancelBtn = document.getElementById('closeFolderModalBtn');

  const cleanListeners = () => {
    saveBtn.removeEventListener('click', handleSave);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  const handleSave = () => {
    const newName = folderModalInput.value.trim();
    cleanListeners();
    folderModal.classList.remove('active');
    folderModal.classList.add('hidden');

    if (!newName || newName === folder) return;
    const cleanName = newName.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim();
    if (!cleanName) {
      showCustomAlert('Geçersiz Ad', 'Geçersiz klasör adı!');
      return;
    }

    secureFetch(`/api/folders/${encodeURIComponent(folder)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: cleanName })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showCustomAlert('Hata', data.error);
      } else {
        fetchFolders(cleanName);
        state.activeFolderPC = cleanName;
        fetchFiles();
        showToast('Başarılı', 'Klasör yeniden adlandırıldı.', 'success');
      }
    })
    .catch(err => console.error('Rename folder error:', err));
  };

  const handleCancel = () => {
    cleanListeners();
    folderModal.classList.remove('active');
    folderModal.classList.add('hidden');
  };

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleCancel);
}

export function deleteFolder() {
  const folder = state.activeFolderPC;
  if (folder === 'Genel') {
    showCustomAlert('Hata', 'Genel klasörü silinemez.');
    return;
  }
  if (confirm(`[${folder}] klasörünü ve içindeki tüm dosyaları silmek istediğinizden emin misiniz?`)) {
    secureFetch(`/api/folders/${encodeURIComponent(folder)}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showCustomAlert('Hata', data.error);
      } else {
        fetchFolders('Genel');
        state.activeFolderPC = 'Genel';
        fetchFiles();
        showToast('Başarılı', 'Klasör silindi.', 'success');
      }
    })
    .catch(err => console.error('Delete folder error:', err));
  }
}

export function mapFolder() {
  const folder = state.activeFolderPC;
  
  const mapFolderModal = document.getElementById('mapFolderModal');
  const mapFolderInput = document.getElementById('mapFolderInput');
  const browseMapFolderBtn = document.getElementById('browseMapFolderBtn');
  const closeMapFolderModalBtn = document.getElementById('closeMapFolderModalBtn');
  const clearMapFolderModalBtn = document.getElementById('clearMapFolderModalBtn');
  const saveMapFolderModalBtn = document.getElementById('saveMapFolderModalBtn');

  if (!mapFolderModal) return;

  secureFetch(`/api/folders/map?folder=${encodeURIComponent(folder)}`)
    .then(res => res.json())
    .then(data => {
      const currentMapping = data.localPath || '';
      if (mapFolderInput) mapFolderInput.value = currentMapping;
      
      mapFolderModal.classList.add('active');
      mapFolderModal.classList.remove('hidden');

      const closeMapModal = () => {
        mapFolderModal.classList.remove('active');
        mapFolderModal.classList.add('hidden');
        browseMapFolderBtn.removeEventListener('click', handleBrowse);
        saveMapFolderModalBtn.removeEventListener('click', handleSave);
        clearMapFolderModalBtn.removeEventListener('click', handleClear);
        closeMapFolderModalBtn.removeEventListener('click', closeMapModal);
      };

      const handleBrowse = () => {
        secureFetch('/api/utils/select-folder')
          .then(res => res.json())
          .then(pickerData => {
            if (pickerData.cancelled) return;
            if (pickerData.path && mapFolderInput) {
              mapFolderInput.value = pickerData.path;
            }
          });
      };

      const handleSave = () => {
        const localPath = mapFolderInput.value.trim();
        if (!localPath) {
          showCustomAlert('Hata', 'Lütfen geçerli bir klasör yolu girin veya seçin.');
          return;
        }
        secureFetch('/api/folders/map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder, localPath })
        })
        .then(res => res.json())
        .then(mapResult => {
          if (mapResult.error) {
            showCustomAlert('Hata', mapResult.error);
          } else {
            showToast('Eşleme Başarılı', mapResult.message, 'success');
            closeMapModal();
          }
        });
      };

      const handleClear = () => {
        secureFetch('/api/folders/map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder, localPath: '' })
        })
        .then(res => res.json())
        .then(mapResult => {
          showToast('Eşleme Kaldırıldı', mapResult.message, 'success');
          closeMapModal();
        });
      };

      browseMapFolderBtn.addEventListener('click', handleBrowse);
      saveMapFolderModalBtn.addEventListener('click', handleSave);
      clearMapFolderModalBtn.addEventListener('click', handleClear);
      closeMapFolderModalBtn.addEventListener('click', closeMapModal);
    })
    .catch(err => console.error('Map folder error:', err));
}

export function initBatchActions() {
  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const moveSelectedBtn = document.getElementById('moveSelectedBtn');

  const batchMoveBtn = document.getElementById('batchMoveBtn');
  const batchZipBtn = document.getElementById('batchZipBtn');
  const batchDeleteBtn = document.getElementById('batchDeleteBtn');
  const batchClearBtn = document.getElementById('batchClearBtn');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      state.selectedFiles = state.currentFileList.map(f => f.name);
      document.querySelectorAll('.file-check-input').forEach(chk => chk.checked = true);
      updateSelectionBar();
    });
  }

  const performClear = () => {
    state.selectedFiles = [];
    document.querySelectorAll('.file-check-input').forEach(chk => chk.checked = false);
    updateSelectionBar();
  };

  if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', performClear);
  if (batchClearBtn) batchClearBtn.addEventListener('click', performClear);

  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', () => {
      if (state.selectedFiles.length === 0) return;
      if (confirm(`Seçilen ${state.selectedFiles.length} dosyayı silmek istediğinizden emin misiniz?`)) {
        secureFetch('/api/files/delete-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: state.activeFolderPC, filenames: state.selectedFiles })
        })
        .then(res => res.json())
        .then(data => {
          showToast('Silindi', `${data.deletedCount} dosya başarıyla silindi.`, 'success');
          performClear();
          fetchFiles();
        })
        .catch(err => console.error('Batch delete error:', err));
      }
    });
  }

  if (batchZipBtn) {
    batchZipBtn.addEventListener('click', () => {
      if (state.selectedFiles.length === 0) return;
      showToast('Hazırlanıyor', 'ZIP dosyası oluşturuluyor, lütfen bekleyin...', 'info');
      
      secureFetch('/api/zip-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: state.activeFolderPC, filenames: state.selectedFiles })
      })
      .then(res => {
        if (!res.ok) throw new Error('ZIP download failed');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.activeFolderPC}_secilenler.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('İndirildi', 'ZIP dosyası başarıyla indirildi.', 'success');
        performClear();
      })
      .catch(err => console.error('Batch zip error:', err));
    });
  }

  const triggerMoveModal = () => {
    if (state.selectedFiles.length === 0) return;
    const moveModal = document.getElementById('moveModal');
    const moveModalInput = document.getElementById('moveModalInput');
    const zipAndMoveCheckbox = document.getElementById('zipAndMoveCheckbox');
    const closeMoveModalBtn = document.getElementById('closeMoveModalBtn');
    const saveMoveModalBtn = document.getElementById('saveMoveModalBtn');
    const browseMoveFolderBtn = document.getElementById('browseMoveFolderBtn');

    if (!moveModal) return;

    moveModal.classList.add('active');
    moveModal.classList.remove('hidden');
    if (moveModalInput) moveModalInput.value = '';
    if (zipAndMoveCheckbox) zipAndMoveCheckbox.checked = false;

    const qpDesktop = document.getElementById('qpDesktop');
    const qpDocuments = document.getElementById('qpDocuments');
    const qpDownloads = document.getElementById('qpDownloads');
    const qpPictures = document.getElementById('qpPictures');

    let paths = {};
    fetch('/api/utils/user-paths')
      .then(res => res.json())
      .then(data => {
        paths = data;
      })
      .catch(err => console.error(err));

    const setQuickPath = (key) => {
      if (paths[key] && moveModalInput) {
        moveModalInput.value = paths[key];
      }
    };

    const handleDesktop = () => setQuickPath('desktop');
    const handleDocs = () => setQuickPath('documents');
    const handleDownloads = () => setQuickPath('downloads');
    const handlePics = () => setQuickPath('pictures');

    const handleBrowse = () => {
      secureFetch('/api/utils/select-folder')
        .then(res => res.json())
        .then(pickerData => {
          if (pickerData.cancelled) return;
          if (pickerData.path && moveModalInput) {
            moveModalInput.value = pickerData.path;
          }
        });
    };

    const handleSave = () => {
      const targetPath = moveModalInput.value.trim();
      if (!targetPath) {
        showCustomAlert('Hata', 'Lütfen geçerli bir hedef yol belirtin.');
        return;
      }
      const zipAndMove = zipAndMoveCheckbox ? zipAndMoveCheckbox.checked : false;

      saveMoveModalBtn.disabled = true;
      saveMoveModalBtn.textContent = 'Taşınıyor...';

      secureFetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: state.activeFolderPC,
          filenames: state.selectedFiles,
          targetPath,
          zipAndMove
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          showCustomAlert('Hata', data.error);
        } else {
          showToast('Başarılı', data.message || 'Dosyalar başarıyla taşındı.', 'success');
          closeModal();
          performClear();
          fetchFiles();
        }
      })
      .catch(err => {
        console.error(err);
        showCustomAlert('Hata', 'Dosyalar taşınamadı.');
      })
      .finally(() => {
        saveMoveModalBtn.disabled = false;
        saveMoveModalBtn.textContent = 'Dosyaları Taşı';
      });
    };

    const closeModal = () => {
      moveModal.classList.remove('active');
      moveModal.classList.add('hidden');
      if (qpDesktop) qpDesktop.removeEventListener('click', handleDesktop);
      if (qpDocuments) qpDocuments.removeEventListener('click', handleDocs);
      if (qpDownloads) qpDownloads.removeEventListener('click', handleDownloads);
      if (qpPictures) qpPictures.removeEventListener('click', handlePics);
      if (browseMoveFolderBtn) browseMoveFolderBtn.removeEventListener('click', handleBrowse);
      saveMoveModalBtn.removeEventListener('click', handleSave);
      closeMoveModalBtn.removeEventListener('click', closeModal);
    };

    if (qpDesktop) qpDesktop.addEventListener('click', handleDesktop);
    if (qpDocuments) qpDocuments.addEventListener('click', handleDocs);
    if (qpDownloads) qpDownloads.addEventListener('click', handleDownloads);
    if (qpPictures) qpPictures.addEventListener('click', handlePics);
    if (browseMoveFolderBtn) browseMoveFolderBtn.addEventListener('click', handleBrowse);
    saveMoveModalBtn.addEventListener('click', handleSave);
    closeMoveModalBtn.addEventListener('click', closeModal);
  };

  if (moveSelectedBtn) moveSelectedBtn.addEventListener('click', triggerMoveModal);
  if (batchMoveBtn) batchMoveBtn.addEventListener('click', triggerMoveModal);
}
