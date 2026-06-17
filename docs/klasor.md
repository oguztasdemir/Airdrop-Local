# AirDrop Local - Proje Klasör ve Dosya Yapısı

Bu dosya, gelecekteki analiz süreçlerini kısaltmak ve token tüketimini minimize etmek amacıyla projedeki tüm dosyaların işlevlerini ve ilişkilerini özetler.

---

## 📁 Ana Dizin / Dizin Yapısı

### 🚀 Başlatıcı ve Yapılandırma
* **[main.py](file:///c:/Users/User/Desktop/Airdrop/main.py):** Python tabanlı başlatıcı script. Sistemde Node.js yüklü olup olmadığını denetler, `node_modules` eksikse `npm install` komutunu çalıştırır, Node.js sunucusunu (`src/server.js`) arka planda başlatır, yerel ağ IP adresini tarayarak mobil bağlantı URL'sini belirler, tarayıcıda uygulamayı otomatik açar ve `Ctrl+C` ile kapatıldığında Node.js sürecini güvenli şekilde sonlandırır.

---

## 📁 Arka Uç (Backend) - `src/` Dizin Yapısı

* **[src/server.js](file:///c:/Users/User/Desktop/Airdrop/src/server.js):** Sunucunun ana giriş noktası. Express.js sunucusunu başlatır, statik dosya sunumunu yapılandırır, `X-PIN` oturum doğrulama middleware'ini (`pinAuth`) tanımlar, alt rotaları (routes) bağlar ve 24 saattir inaktif olan oturumları temizleyen bir çöp toplayıcı (Garbage Collector) barındırır.
* **[src/config.js](file:///c:/Users/User/Desktop/Airdrop/src/config.js):** Sunucu yapılandırması ve paylaşılan yardımcı metotlar. Port bilgisi, SMTP (E-posta) ayarları, e-posta gönderim fonksiyonları, kullanıcı ve oda oturum bilgileri (JSON tabanlı okuma/yazma) ve fiziksel dosya sistemi yardımcılarını (`uploadsDir`, `getSessionUploadsDir`, `getFolderDirectory`, `getSafeFilePath`) barındırır.
* **[src/authRoutes.js](file:///c:/Users/User/Desktop/Airdrop/src/authRoutes.js):** `/api/auth` altındaki kimlik doğrulama API'leri. Kayıt, giriş, misafir girişi, şifre sıfırlama kodu gönderimi/sıfırlama, ayarlardan şifre değiştirme (`/user/change-password`) ve profil yüz tanıma referans görseli yükleme/kaydetme/silme uç noktalarını yönetir.
* **[src/sessionRoutes.js](file:///c:/Users/User/Desktop/Airdrop/src/sessionRoutes.js):** `/api/sessions` altındaki oda/oturum yönetimi rotaları. Oturum doğrulama, oda oluşturma/silme/yeniden adlandırma ve SSE (Server-Sent Events) bağlantısı ile canlı cihaz listesi ile anlık olay güncellemelerini (`device_list_update`, `chat_message` vb.) yönetir.
* **[src/folderRoutes.js](file:///c:/Users/User/Desktop/Airdrop/src/folderRoutes.js):** `/api/folders` altındaki oda içi klasör yönetimi rotaları. Klasör listeleme, oluşturma, silme, yeniden adlandırma ve klasörü yerel bilgisayardaki fiziksel bir dizine eşleme (`/map`) uç noktalarını yönetir.
* **[src/fileRoutes.js](file:///c:/Users/User/Desktop/Airdrop/src/fileRoutes.js):** `/api/` altındaki dosya ve önbellek yönetimi rotaları. Dosya yükleme (Multer), listeleme, tekli silme, toplu silme (`/files/delete-batch`), tekli/toplu ZIP indirme (`/zip/:folder`, `/zip-batch`), dosya taşıma (`/move`), ZIP ayıklama, metin önizleme, depolama istatistikleri ve klasöre özel yüz arama önbelleği (`/face-cache`) kaydetme/okuma uç noktalarını yönetir.
  * *Önemli İşlev:* Silme veya taşıma işlemlerinde `.face_cache.json` dosyasındaki ilgili kayıtlar temizlener; ZIP oluşturulurken bu gizli dosya filtrelenerek dışarıda tutulur.
* **[src/chatRoutes.js](file:///c:/Users/User/Desktop/Airdrop/src/chatRoutes.js):** Sohbet ve pano rotaları. Canlı sohbet mesaj geçmişi ve ortak panoya metin ekleme/silme API'lerini yönetir.

---

## 📁 Ön Uç (Frontend) - `public/` Dizin Yapısı

* **[public/index.html](file:///c:/Users/User/Desktop/Airdrop/public/index.html):** Tek sayfa uygulamanın (SPA) ana şablonu. Glassmorphism tasarımına sahip modern arayüz; sol menü (Dosyalarım, Yüz Tanıma, Sohbet, Cihazı Bağla, Hesabım & Ayarlar), ana çalışma alanları, resim slayt lightbox'ı, medya oynatıcı, ses kaydedici, dosya yükleme dropzone alanları ve özel modal pencerelerini (PIN, cihaz adı, klasör, taşıma, eşleme, uyarı) barındırır.
* **[public/style.css](file:///c:/Users/User/Desktop/Airdrop/public/style.css):** Projenin tüm görsel stilini, animasyonlarını, koyu/açık tema değişkenlerini ve indigo/yeşil/mor/turuncu gibi accent renk şemalarını yöneten CSS dosyası.
* **[public/app.js](file:///c:/Users/User/Desktop/Airdrop/public/app.js):** Ön ucun ana giriş modülü (ES Module). Arayüzdeki tab (sekme) geçişlerini koordine eder, SSE akışını bağlayarak canlı olayları dinler, tema/vurgu rengi ayarlarını yönetir ve modüler dinleyicileri başlatır.

### 📁 Modüller (`public/js/`)
* **[public/js/state.js](file:///c:/Users/User/Desktop/Airdrop/public/js/state.js):** Uygulamanın global durumunu (`state`) tutar. Fetch isteklerinde otomatik PIN ekleyen `secureFetch`, bildirimler için `showToast`/`showCustomAlert`, dosya boyutu biçimlendiren `formatBytes` gibi ortak yardımcı fonksiyonları barındırır.
* **[public/js/auth.js](file:///c:/Users/User/Desktop/Airdrop/public/js/auth.js):** Kimlik doğrulama denetleyicisi. PIN modalı, cihaz adı modalı, giriş/kayıt sekmeleri, şifre sıfırlama akışı, ayarlardan şifre güncelleme mantığı ve kullanıcı depolama detaylarını yükleyen `loadSettingsData` fonksiyonunu barındırır.
* **[public/js/clipboard.js](file:///c:/Users/User/Desktop/Airdrop/public/js/clipboard.js):** Canlı sohbet mesajlaşmasını, ortak panoya metin eklemeyi, kopyalamayı ve silmeyi yönetir.
* **[public/js/media.js](file:///c:/Users/User/Desktop/Airdrop/public/js/media.js):** Görsel slayt lightbox'ı (klavye yön tuşları dahil), ses/video oynatıcı ve tarayıcı tabanlı ses kaydedici (mikrofon erişimi, WebM kaydı ve yükleme) mantığını yönetir.
* **[public/js/faces.js](file:///c:/Users/User/Desktop/Airdrop/public/js/faces.js):** FaceAPI entegrasyonu. Yüz tanıma modellerini yükler, seçilen yüz descriptor'ını referans alarak görsel arar, profil yüz resmi yükler, arka planda görselleri tarayıp yüz grupları (kişiler) oluşturur (`clusterFaces`) ve sunucu yüz cache API'sini yönetir.
  * *Önemli İşlev:* Bir yüze tıklandığında veya tarama başladığında otomatik olarak Dosyalarım sekmesine geçiş yaparak eşleşen dosyaları gerçek zamanlı filtreler.
* **[public/js/files.js](file:///c:/Users/User/Desktop/Airdrop/public/js/files.js):** Klasör ve dosya sistemi mantığı. Klasör oluşturma, silme, yeniden adlandırma, yerel dizine eşleme modalını (`mapFolderModal`) yönetme, drag-and-drop ile dosya yükleme, tekli/toplu silme, toplu ZIP indirme ve seçilenleri bilgisayardaki bir klasöre taşıma modalını (`moveModal` ve hızlı yollar) koordine eder.

---

## 📂 Veri Depolama Dizin Yapısı (`data/`)

* **[data/users.json](file:///c:/Users/User/Desktop/Airdrop/data/users.json):** Kullanıcı hesap verileri ve şifre hash'lerinin saklandığı JSON DB.
* **[data/sessions.json](file:///c:/Users/User/Desktop/Airdrop/data/sessions.json):** Aktif oturum ve oda verilerinin saklandığı JSON DB.

---

## 🛠️ Konfigürasyon, Docker ve Dokümantasyon Dosyaları

* **[.env.example](file:///c:/Users/User/Desktop/Airdrop/.env.example):** Sunucu portu ve e-posta (SMTP) ayarlarının yapılandırılması için kullanılan ortam değişkenleri taslağı.
* **[Dockerfile](file:///c:/Users/User/Desktop/Airdrop/Dockerfile):** Uygulamayı izole bir Node.js konteyneri olarak paketlemek için Docker tanımlama dosyası.
* **[docker-compose.yml](file:///c:/Users/User/Desktop/Airdrop/docker-compose.yml):** downloads klasörü ve veritabanı JSON dosyaları için kalıcı veri disklerini (volume) bağlayan, tek tıkla (`docker-compose up`) çalıştırmayı sağlayan Docker Compose dosyası.
* **[.dockerignore](file:///c:/Users/User/Desktop/Airdrop/.dockerignore):** Konteyner içine kopyalanması gerekmeyen gereksiz ve hassas dosyaları filtreleyen Docker dışlama listesi.
* **[docs/api.md](file:///c:/Users/User/Desktop/Airdrop/docs/api.md):** Backend tarafındaki tüm HTTP REST uç noktalarını ve Server-Sent Events (SSE) olay tiplerini içeren ayrıntılı API kılavuzu.
* **[docs/yardim.md](file:///c:/Users/User/Desktop/Airdrop/docs/yardim.md):** Uygulamadaki tüm butonların ne işe yaradığını, nasıl kullanıldığını ve geliştirici referans notunu barındıran kullanım kılavuzu.
* **[docs/klasor.md](file:///c:/Users/User/Desktop/Airdrop/docs/klasor.md):** Proje klasör yapısını ve dosya işlevlerini özetleyen kılavuz (Bu dosya).



