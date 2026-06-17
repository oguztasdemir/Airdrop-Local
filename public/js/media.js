import { state, secureFetch, showToast, showCustomAlert, getSecureMediaUrl } from './state.js';
import { fetchFiles, fetchMobileFiles } from './files.js';

// DOM Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const closeLightbox = document.querySelector('.close-lightbox');
const prevLightboxBtn = document.getElementById('prevLightboxBtn');
const nextLightboxBtn = document.getElementById('nextLightboxBtn');

const mediaPlayerModal = document.getElementById('mediaPlayerModal');
const closeMediaPlayerBtn = document.getElementById('closeMediaPlayerBtn');
const mediaPlayerTitle = document.getElementById('mediaPlayerTitle');
const playerVideo = document.getElementById('playerVideo');
const playerAudio = document.getElementById('playerAudio');
const audioWrapper = document.getElementById('audioWrapper');
const mediaPlayerCaption = document.getElementById('mediaPlayerCaption');

const startRecordBtn = document.getElementById('startRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const recordDuration = document.getElementById('recordDuration');
const recordingWaveform = document.getElementById('recordingWaveform');
const voicePreviewArea = document.getElementById('voicePreviewArea');
const voiceAudioPreview = document.getElementById('voiceAudioPreview');
const uploadRecordBtn = document.getElementById('uploadRecordBtn');

// Voice Recorder State
let mediaRecorder = null;
let audioChunks = [];
let recordTimer = null;
let recordSeconds = 0;

// Media Player Logic
export function openMediaPlayer(url, name, isVideo) {
  if (!mediaPlayerModal) return;
  mediaPlayerModal.classList.add('active');
  mediaPlayerModal.classList.remove('hidden');
  
  const secureUrl = getSecureMediaUrl(url);
  const cleanName = name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
  if (mediaPlayerCaption) mediaPlayerCaption.textContent = cleanName;

  // Reset player elements
  if (playerVideo) {
    playerVideo.src = '';
    playerVideo.style.display = 'none';
  }
  if (playerAudio) {
    playerAudio.src = '';
  }
  if (audioWrapper) {
    audioWrapper.style.display = 'none';
  }

  if (isVideo && playerVideo) {
    playerVideo.src = secureUrl;
    playerVideo.style.display = 'block';
    playerVideo.play();
  } else if (playerAudio && audioWrapper) {
    playerAudio.src = secureUrl;
    audioWrapper.style.display = 'block';
    playerAudio.play();
  }
}

export function closeMediaPlayer() {
  if (!mediaPlayerModal) return;
  mediaPlayerModal.classList.remove('active');
  mediaPlayerModal.classList.add('hidden');
  if (playerVideo) {
    playerVideo.pause();
    playerVideo.src = '';
  }
  if (playerAudio) {
    playerAudio.pause();
    playerAudio.src = '';
  }
}

// Lightbox Slideshow Logic
export function openImageLightbox(url, name) {
  if (!lightbox) return;
  lightbox.classList.add('active');
  if (lightboxImg) lightboxImg.src = getSecureMediaUrl(url);
  const cleanName = name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
  if (lightboxCaption) lightboxCaption.textContent = cleanName;

  state.currentImageIndex = state.imagePlaylist.findIndex(f => f.url === url);
  updateSlideshowButtons();
}

export function updateSlideshowButtons() {
  if (!prevLightboxBtn || !nextLightboxBtn) return;
  if (state.imagePlaylist.length <= 1) {
    prevLightboxBtn.style.display = 'none';
    nextLightboxBtn.style.display = 'none';
  } else {
    prevLightboxBtn.style.display = 'flex';
    nextLightboxBtn.style.display = 'flex';
  }
}

export function navigateSlideshow(direction) {
  if (state.imagePlaylist.length <= 1) return;
  
  state.currentImageIndex += direction;
  if (state.currentImageIndex < 0) {
    state.currentImageIndex = state.imagePlaylist.length - 1;
  } else if (state.currentImageIndex >= state.imagePlaylist.length) {
    state.currentImageIndex = 0;
  }

  const nextImg = state.imagePlaylist[state.currentImageIndex];
  if (lightboxImg) lightboxImg.src = getSecureMediaUrl(nextImg.url);
  const cleanName = nextImg.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_/, '');
  if (lightboxCaption) lightboxCaption.textContent = cleanName;
}

// Voice Recorder Functions
export function startRecording() {
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
        if (voiceAudioPreview) voiceAudioPreview.src = audioUrl;
        if (voicePreviewArea) voicePreviewArea.classList.remove('hidden');

        // Clean up stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      
      // UI Updates
      if (startRecordBtn) startRecordBtn.classList.add('hidden');
      if (stopRecordBtn) stopRecordBtn.classList.remove('hidden');
      if (recordDuration) recordDuration.classList.remove('hidden');
      if (recordingWaveform) recordingWaveform.classList.remove('hidden');
      if (voicePreviewArea) voicePreviewArea.classList.add('hidden');

      // Start duration timer
      recordSeconds = 0;
      if (recordDuration) recordDuration.textContent = '00:00';
      recordTimer = setInterval(() => {
        recordSeconds++;
        const mins = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
        const secs = String(recordSeconds % 60).padStart(2, '0');
        if (recordDuration) recordDuration.textContent = `${mins}:${secs}`;
      }, 1000);

      showToast('Kayıt Başladı', 'Ses kaydı yapılıyor...', 'info');
    })
    .catch(err => {
      console.error('Mikrofon erişim hatası:', err);
      showCustomAlert('Mikrofon Hatası', 'Mikrofon erişimi engellendi veya bulunamadı.');
    });
}

export function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    clearInterval(recordTimer);
    
    if (startRecordBtn) startRecordBtn.classList.remove('hidden');
    if (stopRecordBtn) stopRecordBtn.classList.add('hidden');
    if (recordingWaveform) recordingWaveform.classList.add('hidden');
    showToast('Kayıt Durduruldu', 'Ses kaydı önizlemeye hazır.', 'success');
  }
}

export function uploadVoiceRecording() {
  if (audioChunks.length === 0) return;

  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const formData = new FormData();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  formData.append('files', audioBlob, `Ses_Kaydi_${timestamp}.webm`);

  const folderSelectMobile = document.getElementById('folderSelectMobile');
  const targetFolder = folderSelectMobile ? folderSelectMobile.value : 'Genel';
  
  if (uploadRecordBtn) {
    uploadRecordBtn.disabled = true;
    uploadRecordBtn.textContent = 'Yükleniyor...';
  }

  const pin = sessionStorage.getItem('airdrop_pin') || '';
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
      const pinModal = document.getElementById('pinModal');
      const pinModalInput = document.getElementById('pinModalInput');
      if (pinModal) {
        pinModal.classList.remove('hidden');
        pinModal.classList.add('active');
        if (pinModalInput) pinModalInput.focus();
      }
      throw new Error('Unauthorized');
    }
    return res.json();
  })
  .then(() => {
    showToast('Yüklendi', 'Ses kaydı başarıyla aktarıldı!', 'success');
    if (voicePreviewArea) voicePreviewArea.classList.add('hidden');
    if (recordDuration) recordDuration.classList.add('hidden');
    if (uploadRecordBtn) {
      uploadRecordBtn.disabled = false;
      uploadRecordBtn.textContent = 'Ses Kaydını Yükle';
    }
    
    if (state.isMobile) {
      fetchMobileFiles();
    } else {
      fetchFiles();
    }
  })
  .catch(err => {
    if (uploadRecordBtn) {
      uploadRecordBtn.disabled = false;
      uploadRecordBtn.textContent = 'Ses Kaydını Yükle';
    }
    if (err.message === 'Unauthorized') return;
    console.error('Ses kaydı yükleme hatası:', err);
    showToast('Hata', 'Ses kaydı yüklenemedi.', 'danger');
  });
}

// Initialize listeners
export function initMediaListeners() {
  if (startRecordBtn) {
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    uploadRecordBtn.addEventListener('click', uploadVoiceRecording);
  }

  if (closeMediaPlayerBtn) {
    closeMediaPlayerBtn.addEventListener('click', closeMediaPlayer);
  }
  if (mediaPlayerModal) {
    mediaPlayerModal.addEventListener('click', (e) => {
      if (e.target === mediaPlayerModal) {
        closeMediaPlayer();
      }
    });
  }

  if (prevLightboxBtn) {
    prevLightboxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateSlideshow(-1);
    });
  }
  if (nextLightboxBtn) {
    nextLightboxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateSlideshow(1);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (lightbox && lightbox.classList.contains('active')) {
      if (e.key === 'ArrowLeft') {
        navigateSlideshow(-1);
      } else if (e.key === 'ArrowRight') {
        navigateSlideshow(1);
      } else if (e.key === 'Escape') {
        lightbox.classList.remove('active');
      }
    }
  });

  if (closeLightbox) {
    closeLightbox.addEventListener('click', () => {
      lightbox.classList.remove('active');
    });
  }
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target !== lightboxImg && e.target !== lightboxCaption && e.target !== prevLightboxBtn && e.target !== nextLightboxBtn) {
        lightbox.classList.remove('active');
      }
    });
  }
}
