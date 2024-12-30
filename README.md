# Word Guess Game - Frontend

Bu proje, Word Guess oyununun frontend kısmıdır. React ve Vite kullanılarak geliştirilmiştir.

## Özellikler

- Gerçek zamanlı çok oyunculu oyun
- Takım bazlı oyun sistemi
- Kelime tahmin etme ve puan sistemi
- Hazırlık süresi ve tur süresi
- Responsive tasarım

## Teknolojiler

- React
- Vite
- Socket.IO Client
- Chakra UI
- React Router

## Kurulum

1. Repository'yi klonlayın:
```bash
git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
cd REPO_NAME
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Development sunucusunu başlatın:
```bash
npm run dev
```

## Environment Variables

`.env.development` ve `.env.production` dosyalarında aşağıdaki değişkenleri ayarlayın:

```env
VITE_SERVER_URL=your_backend_url
```

## Build

Production build için:
```bash
npm run build
```

## Deploy

Bu proje Netlify'da host edilmektedir. Main branch'e yapılan her push otomatik olarak deploy edilir.

## Lisans

MIT 