import { state, secureFetch, showToast, escapeHtml } from './state.js';

// DOM Elements
const chatInputPC = document.getElementById('chatInputPC');
const sendChatBtnPC = document.getElementById('sendChatBtnPC');
const chatMessagesPC = document.getElementById('chatMessagesPC');

const chatInputMobile = document.getElementById('chatInputMobile');
const sendChatBtnMobile = document.getElementById('sendChatBtnMobile');
const chatMessagesMobile = document.getElementById('chatMessagesMobile');

const clipboardInputPC = document.getElementById('clipboardInputPC');
const sendClipboardBtnPC = document.getElementById('sendClipboardBtnPC');
const clipboardListPC = document.getElementById('clipboardListPC');

const clipboardInputMobile = document.getElementById('clipboardInputMobile');
const sendClipboardBtnMobile = document.getElementById('sendClipboardBtnMobile');
const clipboardListMobile = document.getElementById('clipboardListMobile');

// Chat Message Logic
export function fetchChatMessages() {
  secureFetch('/api/chat')
    .then(res => res.json())
    .then(messages => {
      renderChat(messages);
    })
    .catch(err => console.error('Sohbet mesajları yüklenemedi:', err));
}

export function sendChatMessage(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;

  secureFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, device: state.deviceName })
  })
  .then(res => res.json())
  .then(() => {
    inputEl.value = '';
  })
  .catch(err => console.error('Mesaj gönderme hatası:', err));
}

export function renderChat(messages) {
  const renderItem = (msg) => {
    const cleanTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isMe = msg.device === state.deviceName;
    return `
      <div class="chat-message ${isMe ? 'chat-message-me' : 'chat-message-other'}">
        <div class="chat-message-bubble">
          <div class="chat-message-sender">👤 ${escapeHtml(msg.device)}</div>
          <div class="chat-message-text">${escapeHtml(msg.text)}</div>
          <div class="chat-message-time">${cleanTime}</div>
        </div>
      </div>
    `;
  };

  const html = messages.length === 0
    ? `<div class="no-chat-messages">Mesaj bulunmuyor...</div>`
    : messages.map(renderItem).join('');

  if (chatMessagesPC) {
    chatMessagesPC.innerHTML = html;
    chatMessagesPC.scrollTop = chatMessagesPC.scrollHeight;
  }
  if (chatMessagesMobile) {
    chatMessagesMobile.innerHTML = html;
    chatMessagesMobile.scrollTop = chatMessagesMobile.scrollHeight;
  }
}

// Clipboard Logic
export function fetchClipboard() {
  secureFetch('/api/clipboard')
    .then(res => res.json())
    .then(items => {
      renderClipboard(items);
    })
    .catch(err => console.error('Pano verileri yüklenemedi:', err));
}

export function addClipboardItem(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;

  secureFetch('/api/clipboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, device: state.deviceName })
  })
  .then(res => res.json())
  .then(() => {
    inputEl.value = '';
    showToast('Eklendi', 'Metin ortak panoya eklendi.', 'success');
  })
  .catch(err => console.error('Panoya ekleme hatası:', err));
}

export function deleteClipboardItem(id) {
  secureFetch(`/api/clipboard/${id}`, {
    method: 'DELETE'
  })
  .then(res => res.json())
  .then(() => {
    showToast('Silindi', 'Metin panodan kaldırıldı.', 'info');
  })
  .catch(err => console.error('Panodan silme hatası:', err));
}

export function copyTextToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      showToast('Kopyalandı', 'Metin cihaz panosuna kopyalandı.', 'success');
    })
    .catch(err => {
      console.error('Kopyalama başarısız:', err);
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showToast('Kopyalandı', 'Metin cihaz panosuna kopyalandı (fallback).', 'success');
      } catch (e) {
        showCustomAlert('Hata', 'Tarayıcınız panoya yazma izni vermedi.');
      }
      document.body.removeChild(textarea);
    });
}

export function renderClipboard(items) {
  const renderItem = (item) => {
    const cleanTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="clipboard-item" data-id="${item.id}">
        <div class="clipboard-text">${escapeHtml(item.text)}</div>
        <div class="clipboard-meta">
          <span>👤 ${escapeHtml(item.device)} • 🕒 ${cleanTime}</span>
          <div class="clipboard-actions">
            <button class="btn-clip-action copy-clip" data-text="${escapeHtml(item.text)}">📋 Kopyala</button>
            <button class="btn-clip-action delete-clip" data-id="${item.id}">🗑️ Sil</button>
          </div>
        </div>
      </div>
    `;
  };

  const html = items.length === 0
    ? `<div class="no-clipboard">Panoda öğe bulunmuyor...</div>`
    : items.map(renderItem).join('');

  if (clipboardListPC) clipboardListPC.innerHTML = html;
  if (clipboardListMobile) clipboardListMobile.innerHTML = html;

  // Re-attach event listeners on dynamic buttons
  document.querySelectorAll('.copy-clip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyTextToClipboard(btn.dataset.text);
    });
  });

  document.querySelectorAll('.delete-clip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Bu öğeyi panodan silmek istediğinizden emin misiniz?')) {
        deleteClipboardItem(btn.dataset.id);
      }
    });
  });
}

// Global actions exposed on window for legacy backward compatibility if any
window.copyClipText = (text) => {
  copyTextToClipboard(text);
};
window.deleteClipItem = (id) => {
  if (confirm('Bu öğeyi panodan silmek istediğinizden emin misiniz?')) {
    deleteClipboardItem(id);
  }
};

// Initialize listeners
export function initClipboardListeners() {
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

  if (sendClipboardBtnPC && clipboardInputPC) {
    sendClipboardBtnPC.addEventListener('click', () => addClipboardItem(clipboardInputPC));
    clipboardInputPC.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        addClipboardItem(clipboardInputPC);
      }
    });
  }

  if (sendClipboardBtnMobile && clipboardInputMobile) {
    sendClipboardBtnMobile.addEventListener('click', () => addClipboardItem(clipboardInputMobile));
  }
}
