# 📰 Halk Habercisi – Vatandaş Muhabir Ağı

Halk Habercisi, vatandaşların olay yerinden doğrudan fotoğraf veya video çekerek haber göndermesini ve konum paylaşmasını sağlayan, ayrıca güncel haber akışını görüntüleyebilecekleri bir mobil uygulamadır.  
Admin paneli üzerinden yöneticiler bu raporları inceleyebilir, onaylayabilir veya reddedebilir.

---

## 🚀 Özellikler

### 👤 Kullanıcı Tarafı
- 📱 **Telefon Numarası ile Giriş / Kayıt** – Firebase Authentication ile
- 🗝 **Beni Hatırla** – Tekrar girişte bilgileri hatırlayıp otomatik giriş yapma
- 📷 **Konulu Rapor Gönderme** – Kamera veya galeriden medya yükleyerek açıklama ve konum ekleme
- 📰 **Haber Akışı** – API üzerinden güncel haberlerin listelenmesi

### 🔑 Admin Tarafı
- 🔐 **Admin Girişi** – Uygulama içinden yönetici moduna geçiş
- ✅ **Rapor Onay / Red** – Gönderilen raporları inceleyip durumunu değiştirme

---

## 🛠 Kullanılan Teknolojiler

- **React Native (Expo)** – Mobil uygulama geliştirme
- **React Navigation** – Sekme ve sayfa geçişleri
- **Firebase Authentication** – Telefon numarası ile kullanıcı girişi
- **Firebase Firestore** – Rapor veritabanı
- **Firebase Storage** – Medya dosyalarının saklanması
- **react-native-maps** – Harita ve pin gösterimi
- **expo-location** – Konum alma
- **expo-image-picker** – Fotoğraf/video yükleme
- **AsyncStorage** – "Beni Hatırla" özelliği için kullanıcı bilgilerini saklama

---

## 📂 Proje Yapısı

halk-habercisi/
│
├── assets/ # Uygulama görselleri ve ikonlar
├── components/ # Tekrar kullanılabilir React Native bileşenleri
├── screens/ # Ekranlar
│ ├── AuthScreen.js # Telefon numarası ile giriş/kayıt ekranı
│ ├── HomeScreen.js # Haber akışı ekranı
│ ├── ReportScreen.js # Rapor gönderme ekranı
│ ├── AdminScreen.js # Admin kontrol ekranı
│
├── App.js # Uygulama ana dosyası
├── app.json # Expo yapılandırması
├── firebaseConfig.js # Firebase ayarları
├── package.json # Bağımlılıklar
└── README.md # Proje dökümanı
