# AirDrop Local - API Dokümantasyonu 🔌

Bu doküman, AirDrop Local uygulamasının arka uç (backend) tarafında sunduğu tüm RESTful API uç noktalarını (endpoints) ve veri yapılarını listeler.

---

## 🔑 Kimlik Doğrulama API'si (`/api/auth`)

### 1. Kullanıcı Kayıt
* **Rota:** `POST /api/auth/register`
* **Gövde (JSON):**
  ```json
  {
    "username": "ahmet",
    "email": "ahmet@example.com",
    "password": "guvenlisifre"
  }
  ```
* **Yanıt (201):** `{"message": "Kullanıcı başarıyla kaydedildi."}`

### 2. Kullanıcı Giriş
* **Rota:** `POST /api/auth/login`
* **Gövde (JSON):**
  ```json
  {
    "usernameOrEmail": "ahmet",
    "password": "guvenlisifre"
  }
  ```
* **Yanıt (200):** `{"message": "Giriş başarılı.", "username": "ahmet"}`

### 3. Misafir Girişi
* **Rota:** `POST /api/auth/guest`
* **Yanıt (200):** `{"message": "Giriş başarılı.", "username": "Misafir_ABCD"}`

### 4. Şifre Sıfırlama Kodu Gönderimi
* **Rota:** `POST /api/auth/forgot-password`
* **Gövde (JSON):** `{"email": "ahmet@example.com"}`
* **Yanıt (200):** `{"message": "Doğrulama kodu e-postanıza gönderildi."}` *(Not: SMTP kurulmamışsa kod sunucu terminaline yazdırılır)*

### 5. Kod ile Şifre Sıfırlama
* **Rota:** `POST /api/auth/reset-password`
* **Gövde (JSON):**
  ```json
  {
    "email": "ahmet@example.com",
    "code": "123456",
    "newPassword": "yeni_guvenlisifre"
  }
  ```
* **Yanıt (200):** `{"message": "Şifreniz başarıyla sıfırlandı."}`

### 6. Ayarlardan Şifre Değiştirme
* **Rota:** `POST /api/auth/user/change-password`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):**
  ```json
  {
    "oldPassword": "eski_sifre",
    "newPassword": "yeni_sifre"
  }
  ```
* **Yanıt (200):** `{"message": "Şifre başarıyla güncellendi."}`

---

## 🧬 Yüz Tanıma & Profil API'si (`/api/auth/user/profile-face`)

### 1. Profil Yüz Görseli Yükleme
* **Rota:** `POST /api/auth/user/profile-face`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Veri:** `Multipart/Form-Data` (`image` dosyası)
* **Yanıt (200):** `{"message": "Profil yüz resmi başarıyla güncellendi.", "profileFaceUrl": "..."}`

### 2. Profil Yüz Görseli Silme
* **Rota:** `DELETE /api/auth/user/profile-face`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Yanıt (200):** `{"message": "Profil yüz resmi silindi."}`

---

## 📁 Klasör ve Dizin Eşleme API'si (`/api/folders`)

### 1. Klasör Oluşturma
* **Rota:** `POST /api/folders/create`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):** `{"folderName": "Yeni Klasör"}`

### 2. Klasör Silme
* **Rota:** `POST /api/folders/delete`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):** `{"folderName": "Yeni Klasör"}`

### 3. Klasör Yeniden Adlandırma
* **Rota:** `POST /api/folders/rename`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):** `{"oldName": "Eski Ad", "newName": "Yeni Ad"}`

### 4. Yerel Windows Dizinine Eşleme
* **Rota:** `POST /api/folders/map`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):** `{"folderName": "Projeler", "physicalPath": "C:\\Kullanicilar\\Desktop\\Projeler"}`

---

## 📦 Dosya ve ZIP API'si (`/api`)

### 1. Dosya Yükleme
* **Rota:** `POST /api/upload`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Veri:** `Multipart/Form-Data` (Çoklu `files` seçimi, isteğe bağlı hedef `folderName` ve `device` adı)

### 2. Dosya Listeleme
* **Rota:** `GET /api/files`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Sorgu Parametreleri:** `folder` (Varsayılan: "Genel")

### 3. Toplu Dosya Silme
* **Rota:** `POST /api/files/delete-batch`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):** `{"folder": "Genel", "filenames": ["resim1.jpg", "belge.pdf"]}`

### 4. Toplu Klasöre Taşıma
* **Rota:** `POST /api/move`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):** `{"sourceFolder": "Genel", "targetFolder": "Arşiv", "filenames": ["resim1.jpg"]}`

### 5. Klasörü ZIP Olarak İndirme
* **Rota:** `GET /api/zip/:folder`
* **Yanıt:** `.zip` ikili dosya akışı *(Not: `.face_cache.json` otomatik elenir)*

### 6. Seçilen Dosyaları Toplu ZIP İndirme
* **Rota:** `POST /api/zip-batch`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):** `{"folder": "Genel", "filenames": ["1.jpg", "2.png"]}`
* **Yanıt:** `.zip` ikili dosya akışı

### 7. Yüz Tanıma Önbelleği (Cache) Okuma/Yazma
* **Rota:** `GET /api/face-cache` & `POST /api/face-cache`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Sorgu/Gövde:** `folder` parametresi ile eşleşen `.face_cache.json` verisini kaydeder veya döndürür.

---

## 💬 Canlı Sohbet & Pano API'si (`/api/chat` & `/api/chat/clipboard`)

### 1. Sohbet Geçmişi Al
* **Rota:** `GET /api/chat/history`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`

### 2. Ortak Panoya Metin Ekle
* **Rota:** `POST /api/chat/clipboard`
* **Üstbilgi (Headers):** `X-PIN: [session_pin]`
* **Gövde (JSON):** `{"content": "Kopyalanan Link Veya Metin", "device": "Oğuz PC"}`

---

## 🖥️ Canlı İletişim SSE Akışı (`/api/sessions/sse`)

Sunucu ile istemciler arasındaki anlık veri akışı Server-Sent Events (SSE) teknolojisiyle tek yönlü kalıcı bir TCP tüneli üzerinden gerçekleşir:

* **Bağlantı:** `GET /api/sessions/sse?pin=[session_pin]&device=[device_name]`
* **Gönderilen Canlı Olaylar (Events):**
  * `device_list_update`: Odaya bağlanan/ayrılan cihaz listesi değiştiğinde tetiklenir.
  * `chat_message`: Yeni bir sohbet mesajı gönderildiğinde arayüzü günceller.
  * `clipboard_update`: Ortak panoya yeni bir veri eklendiğinde panoyu günceller.
  * `folder_update`: Klasör listesi değiştiğinde dosya gezginini tazeler.
  * `file_update`: Yeni dosya yüklendiğinde veya silindiğinde listeyi günceller.
