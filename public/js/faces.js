import { state, secureFetch, showToast, showCustomAlert, getSecureMediaUrl, getFileClass } from './state.js';
import { applySearchAndSort } from './files.js';

// DOM Elements
const faceFinderPanel = document.getElementById('faceFinderPanel');
const toggleFaceFinderBtn = document.getElementById('toggleFaceFinderBtn');
const closeFaceFinderBtn = document.getElementById('closeFaceFinderBtn');
const faceRefDropzone = document.getElementById('faceRefDropzone');
const faceRefInput = document.getElementById('faceRefInput');
const faceRefPreview = document.getElementById('faceRefPreview');
const faceInteractiveContainer = document.getElementById('faceInteractiveContainer');
const faceSelectionHelpText = document.getElementById('faceSelectionHelpText');
const faceMatchThreshold = document.getElementById('faceMatchThreshold');
const thresholdValueText = document.getElementById('thresholdValueText');
const startFaceScanBtn = document.getElementById('startFaceScanBtn');
const clearFaceScanBtn = document.getElementById('clearFaceScanBtn');
const faceScanProgressArea = document.getElementById('faceScanProgressArea');
const faceScanProgressText = document.getElementById('faceScanProgressText');
const faceScanProgressBar = document.getElementById('faceScanProgressBar');
const faceScanProgressPercent = document.getElementById('faceScanProgressPercent');

const profileRefDropzone = document.getElementById('profileRefDropzone');
const profileRefInput = document.getElementById('profileRefInput');
const profileRefPreview = document.getElementById('profileRefPreview');
const profileInteractiveContainer = document.getElementById('profileInteractiveContainer');
const profileSelectionHelpText = document.getElementById('profileSelectionHelpText');
const profileReferencesGrid = document.getElementById('profileReferencesGrid');
const findMeBtn = document.getElementById('findMeBtn');

// Load Face API models
export async function loadFaceModels() {
  if (state.modelsLoaded) return;
  updateFaceScanStatus('Yüz tanıma modelleri yükleniyor...', 10);
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    updateFaceScanStatus('Yüz tanıma modelleri yükleniyor... (1/4)', 30);
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    updateFaceScanStatus('Yüz tanıma modelleri yükleniyor... (2/4)', 60);
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    updateFaceScanStatus('Yüz tanıma modelleri yükleniyor... (3/4)', 80);
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    
    state.modelsLoaded = true;
    updateFaceScanStatus('Modeller başarıyla yüklendi. Görsel taramaya hazır.', 100);
    setTimeout(() => {
      if (!state.isScanning && faceScanProgressArea) {
        faceScanProgressArea.classList.add('hidden');
      }
    }, 2000);
  } catch (err) {
    console.error('Yüz tanıma modelleri yüklenemedi:', err);
    updateFaceScanStatus('Hata: Modeller yüklenemedi. Dosya eksik veya hatalı.', 0);
  }
}

export function updateFaceScanStatus(text, percent) {
  if (faceScanProgressText) faceScanProgressText.textContent = text;
  if (faceScanProgressBar) faceScanProgressBar.style.width = `${percent}%`;
  if (faceScanProgressPercent) faceScanProgressPercent.textContent = `${percent}%`;
}

function getRenderedImageCoords(img) {
  const w = img.clientWidth;
  const h = img.clientHeight;
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  const ratio = Math.min(w / naturalW, h / naturalH);
  const renderW = naturalW * ratio;
  const renderH = naturalH * ratio;
  const offsetX = (w - renderW) / 2;
  const offsetY = (h - renderH) / 2;
  return { ratio, offsetX, offsetY, width: renderW, height: renderH };
}

function renderInteractiveMarkers(img, container, detections, onSelectCallback) {
  container.querySelectorAll('.face-marker-overlay').forEach(m => m.remove());
  if (detections.length === 0) {
    updateFaceScanStatus('Fotoğrafta herhangi bir yüz bulunamadı!', 0);
    return;
  }
  const renderCoords = getRenderedImageCoords(img);
  detections.forEach((det) => {
    const left = det.detection.box.x * renderCoords.ratio + renderCoords.offsetX;
    const top = det.detection.box.y * renderCoords.ratio + renderCoords.offsetY;
    const boxW = det.detection.box.width * renderCoords.ratio;
    const boxH = det.detection.box.height * renderCoords.ratio;
    
    const marker = document.createElement('div');
    marker.className = 'face-marker-overlay';
    marker.style.left = `${left}px`;
    marker.style.top = `${top}px`;
    marker.style.width = `${boxW}px`;
    marker.style.height = `${boxH}px`;
    
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.face-marker-overlay').forEach(m => m.classList.remove('selected'));
      marker.classList.add('selected');
      onSelectCallback(det.descriptor);
    });
    container.appendChild(marker);
  });
}

export async function handleFaceRefSelect(file) {
  if (!file || !file.type.startsWith('image/')) {
    showCustomAlert('Geçersiz Dosya', 'Lütfen geçerli bir resim dosyası seçin!');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    if (faceRefPreview) faceRefPreview.src = e.target.result;
    if (faceInteractiveContainer) faceInteractiveContainer.classList.remove('hidden');
    if (faceSelectionHelpText) faceSelectionHelpText.classList.remove('hidden');
    if (faceRefDropzone) faceRefDropzone.classList.add('hidden');
    
    if (!state.modelsLoaded) {
      if (faceScanProgressArea) faceScanProgressArea.classList.remove('hidden');
      await loadFaceModels();
    }
    if (faceScanProgressArea) faceScanProgressArea.classList.remove('hidden');
    updateFaceScanStatus('Görsel analiz ediliyor...', 20);
    
    const img = new Image();
    img.src = e.target.result;
    img.onload = async () => {
      try {
        let detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })).withFaceLandmarks().withFaceDescriptors();
        if (detections.length === 0) {
          detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })).withFaceLandmarks().withFaceDescriptors();
        }
        updateFaceScanStatus('Kişi seçimini yapmak için fotoğraftaki yüzün üzerine tıklayın!', 100);
        renderInteractiveMarkers(faceRefPreview, faceInteractiveContainer, detections, (selectedDescriptor) => {
          state.referenceDescriptor = selectedDescriptor;
          if (startFaceScanBtn) startFaceScanBtn.removeAttribute('disabled');
          updateFaceScanStatus('Aramaya hazır!', 100);
        });
      } catch (err) {
        console.error(err);
        updateFaceScanStatus('Analiz hatası.', 0);
      }
    };
  };
  reader.readAsDataURL(file);
}

export async function loadProfileReferences() {
  const username = sessionStorage.getItem('airdrop_account') || localStorage.getItem('airdrop_account');
  if (!username || username.startsWith('Misafir_')) {
    if (profileReferencesGrid) {
      profileReferencesGrid.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 10px; width: 100%;">Misafir hesapları için profil aktif değil.</div>`;
    }
    return [];
  }
  try {
    const res = await fetch(`/api/profile/descriptors?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json();
      renderProfileReferences(data);
      return data;
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

function renderProfileReferences(list) {
  if (!profileReferencesGrid) return;
  if (list.length === 0) {
    profileReferencesGrid.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 8px; width: 100%;">Henüz yüz referansı eklenmedi.</div>`;
    return;
  }
  profileReferencesGrid.innerHTML = list.map((item, idx) => `
    <div class="profile-reference-item" style="background-image: url('${item.imageUrl}');">
      <button class="delete-ref-btn" data-index="${idx}" title="Sil">×</button>
    </div>
  `).join('');

  profileReferencesGrid.querySelectorAll('.delete-ref-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      const username = sessionStorage.getItem('airdrop_account') || localStorage.getItem('airdrop_account');
      if (confirm('Bu profil referansını silmek istediğinizden emin misiniz?')) {
        const res = await fetch('/api/profile/descriptors/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, index })
        });
        if (res.ok) {
          loadProfileReferences();
        }
      }
    });
  });
}

export async function handleProfileRefSelect(file) {
  if (!file || !file.type.startsWith('image/')) {
    showCustomAlert('Hata', 'Geçersiz resim dosyası.');
    return;
  }
  const username = sessionStorage.getItem('airdrop_account') || localStorage.getItem('airdrop_account');
  if (!username || username.startsWith('Misafir_')) {
    showCustomAlert('Hata', 'Misafir hesabı kullanıyorsunuz.');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    if (profileRefPreview) profileRefPreview.src = e.target.result;
    if (profileInteractiveContainer) profileInteractiveContainer.classList.remove('hidden');
    if (profileSelectionHelpText) profileSelectionHelpText.classList.remove('hidden');
    if (profileRefDropzone) profileRefDropzone.classList.add('hidden');

    if (!state.modelsLoaded) {
      await loadFaceModels();
    }
    const img = new Image();
    img.src = e.target.result;
    img.onload = async () => {
      try {
        let detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })).withFaceLandmarks().withFaceDescriptors();
        if (detections.length === 0) {
          detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })).withFaceLandmarks().withFaceDescriptors();
        }
        renderInteractiveMarkers(profileRefPreview, profileInteractiveContainer, detections, async (selectedDescriptor) => {
          const formData = new FormData();
          formData.append('image', file);
          const uploadRes = await fetch('/api/profile/upload-ref', {
            method: 'POST',
            headers: { 'X-Username': username },
            body: formData
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            const saveRes = await fetch('/api/profile/descriptors', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username,
                descriptor: Array.from(selectedDescriptor),
                imageUrl: uploadData.url
              })
            });
            if (saveRes.ok) {
              showCustomAlert('Başarılı', 'Yüz profilinize eklendi!');
              if (profileInteractiveContainer) profileInteractiveContainer.classList.add('hidden');
              if (profileSelectionHelpText) profileSelectionHelpText.classList.add('hidden');
              if (profileRefDropzone) profileRefDropzone.classList.remove('hidden');
              if (profileRefInput) profileRefInput.value = '';
              loadProfileReferences();
            }
          }
        });
      } catch (err) {
        console.error(err);
      }
    };
  };
  reader.readAsDataURL(file);
}

export function saveFaceCacheToServer(folderName) {
  const folderCache = {};
  const imagesInFolder = state.currentFileList.filter(f => getFileClass(f.name) === 'file-image');
  imagesInFolder.forEach(file => {
    if (state.faceDescriptorCache[file.name]) {
      folderCache[file.name] = state.faceDescriptorCache[file.name];
    }
  });

  secureFetch('/api/face-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder: folderName,
      cache: folderCache
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      console.log(`[+] Face cache saved for folder: ${folderName}`);
    }
  })
  .catch(err => {
    console.error('Failed to save face cache to server:', err);
  });
}

function loadImageAsync(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

export async function scanGalleryWithProfileRefs(profileRefs) {
  if (state.isScanning) return;
  
  // Switch to filesTab so user can see scanning badges in real time
  const filesTabBtn = document.querySelector('.sidebar-menu .menu-item[data-tab="filesTab"]');
  if (filesTabBtn) filesTabBtn.click();

  state.isScanning = true;
  if (findMeBtn) findMeBtn.setAttribute('disabled', 'true');
  if (faceScanProgressArea) faceScanProgressArea.classList.remove('hidden');

  const threshold = parseFloat(faceMatchThreshold.value);
  const imagesToScan = state.currentFileList.filter(f => getFileClass(f.name) === 'file-image');
  const total = imagesToScan.length;

  if (total === 0) {
    updateFaceScanStatus('Aktif klasörde taranacak görsel bulunmuyor.', 0);
    state.isScanning = false;
    if (findMeBtn) findMeBtn.removeAttribute('disabled');
    return;
  }

  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.add('face-scanning-active');
  });

  let matchesCount = 0;
  let hasNewDetections = false;

  for (let i = 0; i < total; i++) {
    const file = imagesToScan[i];
    const percent = Math.round(((i + 1) / total) * 100);
    updateFaceScanStatus(`Taranıyor: ${i + 1}/${total} görsel... (${matchesCount} eşleşme)`, percent);

    const fileItemEl = document.querySelector(`.file-item[data-filename="${file.name}"]`);
    if (!fileItemEl) continue;

    try {
      let detections;
      if (state.faceDescriptorCache[file.name]) {
        detections = state.faceDescriptorCache[file.name];
      } else {
        const secureUrl = getSecureMediaUrl(file.url);
        const img = await loadImageAsync(secureUrl);
        detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })).withFaceLandmarks().withFaceDescriptors();
        if (detections.length === 0) {
          detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })).withFaceLandmarks().withFaceDescriptors();
        }
        state.faceDescriptorCache[file.name] = detections;
        hasNewDetections = true;
      }

      let isMatch = false;
      let bestDist = 1.0;

      for (const det of detections) {
        for (const refItem of profileRefs) {
          const refDesc = new Float32Array(refItem.descriptor);
          const dist = faceapi.euclideanDistance(refDesc, det.descriptor);
          if (dist <= threshold) {
            isMatch = true;
            if (dist < bestDist) bestDist = dist;
          }
        }
      }

      if (isMatch) {
        matchesCount++;
        updateFaceScanStatus(`Taranıyor: ${i + 1}/${total} görsel... (${matchesCount} eşleşme)`, percent);
        const confidence = Math.max(0, Math.min(100, Math.round((1 - bestDist) * 100)));
        fileItemEl.classList.remove('face-match-fail');
        fileItemEl.classList.add('face-match-success');
        
        const oldBadge = fileItemEl.querySelector('.face-match-badge');
        if (oldBadge) oldBadge.remove();
        
        const badge = document.createElement('div');
        badge.className = 'face-match-badge';
        badge.textContent = `%${confidence} Eşleşme`;
        fileItemEl.querySelector('.file-preview').appendChild(badge);
      } else {
        fileItemEl.classList.remove('face-match-success');
        fileItemEl.classList.add('face-match-fail');
      }
    } catch (err) {
      fileItemEl.classList.add('face-match-fail');
    }
  }

  updateFaceScanStatus(`Tarama tamamlandı! ${matchesCount} eşleşen görsel bulundu.`, 100);
  state.isScanning = false;
  if (findMeBtn) findMeBtn.removeAttribute('disabled');

  if (hasNewDetections) {
    saveFaceCacheToServer(state.activeFolderPC);
  }
}

export async function scanGalleryFaces() {
  if (!state.referenceDescriptor || state.isScanning) return;

  // Switch to filesTab so user can see scanning badges in real time
  const filesTabBtn = document.querySelector('.sidebar-menu .menu-item[data-tab="filesTab"]');
  if (filesTabBtn) filesTabBtn.click();

  state.isScanning = true;
  if (startFaceScanBtn) startFaceScanBtn.setAttribute('disabled', 'true');
  if (clearFaceScanBtn) clearFaceScanBtn.setAttribute('disabled', 'true');
  if (faceScanProgressArea) faceScanProgressArea.classList.remove('hidden');

  const threshold = parseFloat(faceMatchThreshold.value);
  const imagesToScan = state.currentFileList.filter(f => getFileClass(f.name) === 'file-image');
  const total = imagesToScan.length;

  if (total === 0) {
    updateFaceScanStatus('Aktif klasörde taranacak görsel bulunmuyor.', 0);
    state.isScanning = false;
    if (startFaceScanBtn) startFaceScanBtn.removeAttribute('disabled');
    if (clearFaceScanBtn) clearFaceScanBtn.removeAttribute('disabled');
    return;
  }

  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.add('face-scanning-active');
  });

  let matchesCount = 0;
  let hasNewDetections = false;

  for (let i = 0; i < total; i++) {
    const file = imagesToScan[i];
    const percent = Math.round(((i + 1) / total) * 100);
    updateFaceScanStatus(`Taranıyor: ${i + 1}/${total} görsel... (${matchesCount} eşleşme bulundu)`, percent);

    const fileItemEl = document.querySelector(`.file-item[data-filename="${file.name}"]`);
    if (!fileItemEl) continue;

    try {
      let detections;
      if (state.faceDescriptorCache[file.name]) {
        detections = state.faceDescriptorCache[file.name];
      } else {
        const secureUrl = getSecureMediaUrl(file.url);
        const img = await loadImageAsync(secureUrl);
        detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })).withFaceLandmarks().withFaceDescriptors();
        
        if (detections.length === 0) {
          detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })).withFaceLandmarks().withFaceDescriptors();
        }
        state.faceDescriptorCache[file.name] = detections;
        hasNewDetections = true;
      }
      
      let isMatch = false;
      let bestDist = 1.0;

      for (const det of detections) {
        const dist = faceapi.euclideanDistance(state.referenceDescriptor, det.descriptor);
        if (dist <= threshold) {
          isMatch = true;
          if (dist < bestDist) bestDist = dist;
        }
      }

      if (isMatch) {
        matchesCount++;
        updateFaceScanStatus(`Taranıyor: ${i + 1}/${total} görsel... (${matchesCount} eşleşme bulundu)`, percent);
        
        const confidence = Math.max(0, Math.min(100, Math.round((1 - bestDist) * 100)));
        fileItemEl.classList.remove('face-match-fail');
        fileItemEl.classList.add('face-match-success');
        
        const oldBadge = fileItemEl.querySelector('.face-match-badge');
        if (oldBadge) oldBadge.remove();
        
        const badge = document.createElement('div');
        badge.className = 'face-match-badge';
        badge.textContent = `%${confidence} Eşleşme`;
        fileItemEl.querySelector('.file-preview').appendChild(badge);
      } else {
        fileItemEl.classList.remove('face-match-success');
        fileItemEl.classList.add('face-match-fail');
      }
    } catch (err) {
      console.warn(`Görsel tarama hatası (${file.name}):`, err);
      fileItemEl.classList.add('face-match-fail');
    }
  }

  updateFaceScanStatus(`Tarama tamamlandı! ${matchesCount} eşleşen görsel bulundu.`, 100);
  state.isScanning = false;
  if (startFaceScanBtn) startFaceScanBtn.removeAttribute('disabled');
  if (clearFaceScanBtn) clearFaceScanBtn.removeAttribute('disabled');

  if (hasNewDetections) {
    saveFaceCacheToServer(state.activeFolderPC);
  }
}

export function resetFaceScan() {
  state.referenceDescriptor = null;
  if (faceRefInput) faceRefInput.value = '';
  if (faceRefPreview) faceRefPreview.src = '';
  if (faceInteractiveContainer) {
    faceInteractiveContainer.classList.add('hidden');
    faceInteractiveContainer.querySelectorAll('.face-marker-overlay').forEach(m => m.remove());
  }
  if (faceSelectionHelpText) faceSelectionHelpText.classList.add('hidden');
  if (faceRefDropzone) faceRefDropzone.classList.remove('hidden');

  if (startFaceScanBtn) startFaceScanBtn.setAttribute('disabled', 'true');
  if (faceScanProgressArea) faceScanProgressArea.classList.add('hidden');
  
  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.remove('face-scanning-active', 'face-match-success', 'face-match-fail');
    const badge = item.querySelector('.face-match-badge');
    if (badge) badge.remove();
  });
}

// Background Clustering
export async function detectAndCacheFaces(file) {
  if (state.faceDescriptorCache[file.name]) return state.faceDescriptorCache[file.name];
  try {
    const secureUrl = getSecureMediaUrl(file.url);
    const img = await loadImageAsync(secureUrl);
    let rawDetections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })).withFaceLandmarks().withFaceDescriptors();
    
    if (rawDetections.length === 0) {
      rawDetections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })).withFaceLandmarks().withFaceDescriptors();
    }

    const detections = rawDetections.map(det => {
      let faceThumbnail = '';
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        const box = det.detection.box;
        const padX = box.width * 0.15;
        const padY = box.height * 0.15;
        
        ctx.drawImage(
          img,
          Math.max(0, box.x - padX),
          Math.max(0, box.y - padY),
          Math.min(img.width, box.width + padX * 2),
          Math.min(img.height, box.height + padY * 2),
          0, 0, 80, 80
        );
        faceThumbnail = canvas.toDataURL('image/jpeg', 0.8);
      } catch (e) {
        console.error('Face thumbnail extraction failed', e);
      }

      return {
        descriptor: Array.from(det.descriptor),
        box: { x: det.detection.box.x, y: det.detection.box.y, width: det.detection.box.width, height: det.detection.box.height },
        faceThumbnail
      };
    });

    state.faceDescriptorCache[file.name] = detections;
    return detections;
  } catch (err) {
    console.warn('Face detection error for file:', file.name, err);
    state.faceDescriptorCache[file.name] = [];
    return [];
  }
}

export async function startBackgroundFaceScan() {
  if (state.isBgScanning) return;
  
  if (!state.modelsLoaded) {
    await loadFaceModels();
  }
  
  state.isBgScanning = true;
  const imagesToScan = state.currentFileList.filter(f => getFileClass(f.name) === 'file-image');
  
  let hasNewDetections = false;
  for (const file of imagesToScan) {
    if (!state.faceDescriptorCache[file.name]) {
      await detectAndCacheFaces(file);
      hasNewDetections = true;
    }
  }
  
  state.isBgScanning = false;
  
  const clusters = clusterFaces();
  state.allFaceClusters = clusters;
  renderPeople(clusters);

  if (hasNewDetections) {
    saveFaceCacheToServer(state.activeFolderPC);
  }
}

function clusterFaces() {
  const clusters = [];
  const threshold = 0.55;

  for (const fileName in state.faceDescriptorCache) {
    const file = state.currentFileList.find(f => f.name === fileName);
    if (!file) continue;

    const detections = state.faceDescriptorCache[fileName];
    for (const det of detections) {
      let matchedCluster = null;
      let bestDist = 1.0;

      for (const cluster of clusters) {
        const dist = faceapi.euclideanDistance(new Float32Array(cluster.representativeDescriptor), new Float32Array(det.descriptor));
        if (dist <= threshold && dist < bestDist) {
          bestDist = dist;
          matchedCluster = cluster;
        }
      }

      if (matchedCluster) {
        matchedCluster.files.push({ fileName, fileUrl: file.url, box: det.box });
      } else {
        const newClusterId = clusters.length + 1;
        clusters.push({
          id: newClusterId,
          representativeDescriptor: det.descriptor,
          name: `Kişi ${newClusterId}`,
          thumbnail: det.faceThumbnail,
          files: [{ fileName, fileUrl: file.url, box: det.box }]
        });
      }
    }
  }

  clusters.sort((a, b) => b.files.length - a.files.length);
  return clusters;
}

export function renderPeople(clusters) {
  const peopleGroupingArea = document.getElementById('peopleGroupingArea');
  const peopleList = document.getElementById('peopleList');
  const clearPeopleFilterBtn = document.getElementById('clearPeopleFilterBtn');
  
  if (!peopleGroupingArea || !peopleList) return;
  
  const imagesCount = state.currentFileList.filter(f => getFileClass(f.name) === 'file-image').length;
  
  if (clusters.length === 0) {
    peopleGroupingArea.classList.remove('hidden');
    peopleList.innerHTML = `
      <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; width: 100%; text-align: center; background: rgba(255, 255, 255, 0.01); border-radius: var(--radius-sm); border: 1px dashed rgba(255,255,255,0.05); margin: 10px 0;">
        <div style="font-size: 32px; margin-bottom: 12px; filter: grayscale(0.2);">👤</div>
        <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: var(--text-main);">Herhangi bir yüz tespit edilemedi</h4>
        <p style="margin: 0; font-size: 11px; color: var(--text-muted);">Klasördeki görseller taranırken eşleşen bir yüz bulunamadı.</p>
        <span style="display: inline-block; margin-top: 10px; font-size: 11px; padding: 4px 10px; background: rgba(99,102,241,0.1); color: var(--accent-color); border-radius: 20px; font-weight: 500;">
          Oturumda toplam ${imagesCount} adet görsel var
        </span>
      </div>
    `;
    return;
  }
  
  peopleGroupingArea.classList.remove('hidden');
  peopleList.innerHTML = '';
  
  clusters.forEach(cluster => {
    const bubble = document.createElement('div');
    bubble.className = 'person-bubble';
    if (state.activePersonFilter && state.activePersonFilter.id === cluster.id) {
      bubble.classList.add('active');
    }
    
    const avatarHtml = cluster.thumbnail 
      ? `<img class="person-avatar" src="${cluster.thumbnail}">`
      : `<div class="person-avatar" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);">👤</div>`;
      
    bubble.innerHTML = `
      ${avatarHtml}
      <span class="person-name">${cluster.name}</span>
      <span class="person-count">(${cluster.files.length} Görsel)</span>
    `;
    
    bubble.addEventListener('click', () => {
      if (state.activePersonFilter && state.activePersonFilter.id === cluster.id) {
        state.activePersonFilter = null;
        if (clearPeopleFilterBtn) clearPeopleFilterBtn.classList.add('hidden');
      } else {
        state.activePersonFilter = cluster;
        if (clearPeopleFilterBtn) clearPeopleFilterBtn.classList.remove('hidden');
        
        const filesTabBtn = document.querySelector('.sidebar-menu .menu-item[data-tab="filesTab"]');
        if (filesTabBtn) filesTabBtn.click();
      }
      
      renderPeople(state.allFaceClusters);
      applySearchAndSort();
    });
    
    peopleList.appendChild(bubble);
  });
}

export function initFaceListeners() {
  if (toggleFaceFinderBtn) {
    toggleFaceFinderBtn.addEventListener('click', () => {
      const facesTabBtn = document.querySelector('.sidebar-menu .menu-item[data-tab="facesTab"]');
      if (facesTabBtn) {
        facesTabBtn.click();
        loadFaceModels();
      }
    });
  }

  if (faceMatchThreshold) {
    faceMatchThreshold.addEventListener('input', (e) => {
      thresholdValueText.textContent = parseFloat(e.target.value).toFixed(2);
    });
  }

  if (faceRefDropzone) {
    faceRefDropzone.addEventListener('click', () => faceRefInput.click());
    faceRefDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      faceRefDropzone.classList.add('dragover');
    });
    faceRefDropzone.addEventListener('dragleave', () => faceRefDropzone.classList.remove('dragover'));
    faceRefDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      faceRefDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFaceRefSelect(e.dataTransfer.files[0]);
      }
    });
  }

  if (faceRefInput) {
    faceRefInput.addEventListener('change', () => {
      if (faceRefInput.files.length > 0) {
        handleFaceRefSelect(faceRefInput.files[0]);
      }
    });
  }

  document.addEventListener('paste', (e) => {
    if (faceFinderPanel && !faceFinderPanel.classList.contains('hidden')) {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === 0) {
          const file = items[i].getAsFile();
          handleFaceRefSelect(file);
          e.preventDefault();
          break;
        }
      }
    }
  });

  if (profileRefDropzone) {
    profileRefDropzone.addEventListener('click', () => profileRefInput.click());
    profileRefDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      profileRefDropzone.classList.add('dragover');
    });
    profileRefDropzone.addEventListener('dragleave', () => profileRefDropzone.classList.remove('dragover'));
    profileRefDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      profileRefDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleProfileRefSelect(e.dataTransfer.files[0]);
      }
    });
  }

  if (profileRefInput) {
    profileRefInput.addEventListener('change', () => {
      if (profileRefInput.files.length > 0) {
        handleProfileRefSelect(profileRefInput.files[0]);
      }
    });
  }

  if (findMeBtn) {
    findMeBtn.addEventListener('click', async () => {
      const profileRefs = await loadProfileReferences();
      if (profileRefs.length === 0) {
        showCustomAlert('Hata', 'Profilinizde kayıtlı yüz referansı bulunmuyor. Önce Ayarlar sekmesinden yüz profilinizi oluşturun!');
        return;
      }
      scanGalleryWithProfileRefs(profileRefs);
    });
  }

  if (startFaceScanBtn) {
    startFaceScanBtn.addEventListener('click', scanGalleryFaces);
  }

  if (clearFaceScanBtn) {
    clearFaceScanBtn.addEventListener('click', resetFaceScan);
  }

  const clearPeopleFilterBtn = document.getElementById('clearPeopleFilterBtn');
  if (clearPeopleFilterBtn) {
    clearPeopleFilterBtn.addEventListener('click', () => {
      state.activePersonFilter = null;
      clearPeopleFilterBtn.classList.add('hidden');
      renderPeople(state.allFaceClusters);
      applySearchAndSort();
    });
  }
}
