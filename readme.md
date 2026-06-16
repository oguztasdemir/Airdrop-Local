# AirDrop Local - Kablosuz Dosya Paylaşım & İletişim Merkezi 🚀

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-blue.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-3.x-blue.svg?style=flat-square&logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square)](#)

AirDrop Local, yerel ağınızda (Wi-Fi) bilgisayarınız ve mobil cihazlarınız (iPhone/Android) arasında kablosuz olarak dosya, medya ve veri transferi yapabilmenizi sağlayan **Çoklu Oturum (Multi-Session / Multi-Tenant Sandbox)** destekli, ultra-premium tasarımlı yerel bir bulut paylaşım merkezidir.

Gelecekte harici bir web sunucusuna (domain) taşınmaya tamamen uygun şekilde tasarlanan mimarisi sayesinde, her yeni tarayıcı sekmesi kendi bağımsız oturumunu ve şifresini (PIN) oluşturur.

---

## 🌟 Öne Çıkan Özellikler

### 1. Çoklu Oturum ve Sandbox İzolasyonu 🔒
* **Benzersiz 6 Haneli PIN:** Sunucu her yeni tarayıcı isteği için benzersiz bir oturum PIN'i oluşturur (örn: `682190`).
* **Yalıtılmış Dosya Depolama:** Yüklenen dosyalar `downloads/session_[PIN]/` dizini altında saklanır. Oturumlar birbirinin dosyasına kesinlikle erişemez.
* ** SSE (Server-Sent Events) Güvenliği:** Bildirimler, canlı sohbet mesajları ve bağlı cihaz listeleri sadece ilgili oturuma bağlı cihazlar arasında senkronize edilir.

### 2. Tarayıcı İçi Gelişmiş Medya Oynatıcı 🎵🎥
* Ses (`.mp3`, `.wav`, `.m4a`) veya video (`.mp4`, `.mov`) dosyalarını indirmek yerine doğrudan tarayıcı içindeki özel oynatıcı üzerinden çalıştırabilirsiniz.

### 3. Fotoğraf Galerisi Slayt Gösterisi (Slideshow Mode) 🖼️
* Fotoğrafları tam ekran (Lightbox) açarak klavyenizin sol/sağ ok tuşlarıyla veya ekran butonlarıyla görseller arasında akıcı şekilde geçiş yapabilirsiniz.

### 4. Ses Kaydedici Widget'ı 🎙️
* Mobil tarayıcınızın mikrofonu üzerinden ses kaydı alabilir, ses dalgası animasyonu eşliğinde önizleyebilir ve doğrudan bilgisayarınızın aktif klasörüne yükleyebilirsiniz.

### 5. Cihazlar Arası Canlı Sohbet 💬
* Aynı oturuma bağlı cihazlar arasında gerçek zamanlı ve yalıtılmış anlık mesajlaşma paneli.

### 6. Sunucu Tarafında ZIP Ayıklama 📦
* Sunucuya yüklenen `.zip` arşiv dosyalarını tek tıkla doğrudan sunucu üzerinde ayıklayabilir ve dosya kalabalığını önleyebilirsiniz.

### 7. Ortak Pano (Shared Clipboard) 📋
* Cihazlar arasında metinleri veya web linklerini kopyalayıp anında paylaşabilirsiniz.

### 8. Otomatik Temizlik Görevi (Garbage Collector) 🧹
* Son 24 saattir aktif bağlantısı bulunmayan inaktif oturumları ve bunlara ait dosyaları diskten otomatik olarak silen arka plan temizlik mekanizması.

---

## 📂 Klasör Yapısı

Projemiz, standart ve profesyonel bir yazılım mimarisi hiyerarşisine sahiptir:

```text
Airdrop/
├── main.py            # Uygulamayı başlatan ana Python betiği (Tek başlangıç noktası)
├── server.js          # Express.js backend sunucusu, SSE ve oturum yönetimi
├── package.json       # Node.js bağımlılık tanımları
├── package-lock.json  # Node.js bağımlılık kilitleme dosyası
├── readme.md          # GitHub / Proje açıklama kılavuzu
├── public/            # Ön yüz (Frontend) HTML, CSS ve JavaScript dosyaları
│   ├── index.html     # Ana arayüz şablonu
│   ├── style.css      # Premium Glassmorphism CSS tasarımları
│   └── app.js         # Ön yüz uygulaması, MediaRecorder ve SSE bağlantıları
└── downloads/         # Yüklenen dosyaların yalıtılmış şekilde depolandığı dizin
    ├── session_123456/# 123456 nolu oturuma ait sandbox dizini
    └── session_654321/# 654321 nolu oturuma ait sandbox dizini
```

---

## 🛠️ Gereksinimler

* Bilgisayarınızda **Node.js** (Sürüm 16.x veya üzeri) yüklü olmalıdır. ([nodejs.org](https://nodejs.org/) üzerinden ücretsiz indirebilirsiniz.)
* Python 3.x sürümü.

---

## 🚀 Kurulum ve Çalıştırma

1. Proje ana klasöründe bir terminal veya komut satırı açın.
2. Uygulamayı ve otomatik bağımlılık kontrollerini başlatmak için aşağıdaki komutu çalıştırın:
   ```bash
   python main.py
   ```
3. `main.py` otomatik olarak gerekli Node.js paketlerini (`express`, `multer`, `archiver`, `adm-zip`) tespit eder, eksik olanları arka planda kurar ve sunucuyu ayağa kaldırır.
4. Sunucu hazır olduğunda tarayıcınızda otomatik olarak bilgisayar arayüzü açılacaktır.
5. Telefonunuzla veya başka bir cihazla bağlanmak için ekrandaki QR kodu taratmanız yeterlidir.

---

## 🔒 Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. Detaylar için lisans dosyalarını inceleyebilirsiniz.
