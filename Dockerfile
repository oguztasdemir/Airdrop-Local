# Node.js LTS sürümünü temel alan hafif imajı kullanıyoruz
FROM node:20-alpine

# Çalışma dizinini belirliyoruz
WORKDIR /app

# Bağımlılık tanımlarını kopyalıyoruz
COPY package*.json ./

# NPM paketlerini kuruyoruz
RUN npm ci --only=production

# Tüm proje dosyalarını çalışma dizinine kopyalıyoruz
COPY . .

# downloads klasörünün varlığından emin oluyoruz
RUN mkdir -p downloads data public/models

# Uygulama portunu dışarı açıyoruz
EXPOSE 3000

# Sunucuyu başlatıyoruz
CMD ["npm", "start"]
