# ZarPOS Retail Suite

Proje Adı: ZarSoft - SaaS Çok Kiracılı Ön Muhasebe ve Barkodlu POS Satış Sistemi

React, Tailwind CSS, Lucide ikonları ve Supabase altyapısı kullanarak "ZarSoft" adında modern, responsive, Türkçe dil desteğine sahip bir SaaS Ön Muhasebe ve Perakende POS Kasa uygulaması oluştur. 

### TASARIM VE RENK PALETİ (ÇOK ÖNEMLİ):
Arayüz profesyonel ve sade olmalıdır. Sidebar (Yan Menü), Navbar (Üst Menü) ve temel navigasyon alanlarının arka plan rengi kesinlikle `#2a2a2a` (koyu gri) olmalıdır. Ana içerik alanlarının (sayfa arka planı, kartlar vb.) arka planı ise temiz bir beyaz (`#ffffff` veya çok hafif kırık beyaz `#f9fafb`) olmalıdır. Metinler ve vurgular bu zıtlığa uygun, net okunabilir şekilde ayarlanmalıdır.

### ANA MODÜLLER VE SİSTEM MİMARİSİ:

1. Kimlik Doğrulama ve Rol Tabanlı Yetkilendirme (Auth & RBAC):
   - Supabase Auth entegrasyonu.
   - İlk Kurulum (Seed) Hesabı: Sistem ayağa kalktığında varsayılan olarak şu Süper Admin hesabı var olmalıdır:
     - E-posta: superadmin@zarpos.com
     - Şifre: superadmin2207*zarpos
   - Kullanıcı Rolleri: 'super_admin', 'firm_admin' (Şirket Yöneticisi), 'manager' (Müdür), 'accountant' (Muhasebeci), 'cashier' (Kasiyer).
   - Rol Yetkileri:
     - 'super_admin': Sistemdeki tüm altyapıyı yönetir. Yeni şirket/dükkan açılışı yapabilir ve bu şirketin sistemdeki ilk yöneticisini ('firm_admin') oluşturup atayabilir. Ayrıca, platformu yönetmek için "Yeni Süper Admin" hesapları da oluşturabilir.
     - 'firm_admin' (Şirket Yöneticisi): Atandığı şirketin mutlak yöneticisidir. Tüm ayarlara, muhasebeye, POS'a ve verilere tam erişimi vardır. Kendi dükkanı için sınırsız alt kullanıcı (kasiyer, müdür vb.) hesabı açabilir ve yönetebilir.
     - 'manager' (Müdür): Firma yöneticisine benzer şekilde işletme operasyonlarını ve personelleri yönetebilir.
     - 'accountant' (Muhasebeci): Faturalar, Giderler, Müşteri/Tedarikçi (Cari) kartları ve Raporlara erişir.
     - 'cashier' (Kasiyer): Sadece POS Kasa Satış ekranına, ürün/stok aramaya ve Z-Raporu ekranına kısıtlı erişimi vardır.
   - Multi-tenant (Çok Kiracılı) Veri Yapısı: Tüm veritabanı tabloları `company_id` ile izole edilmelidir (Süper admin işlemleri hariç).

2. Süper Admin Paneli (/super-admin):
   - Yeni Şirket/Dükkan Açılışı Modalı: Süper adminin platforma yeni bir işletme eklemesi ve o işletme için e-posta/şifre belirleyerek ilk 'firm_admin' (Şirket Yöneticisi) hesabını ataması.
   - Yeni Süper Admin Ekleme: Süper adminlerin sisteme başka süper admin yetkisine sahip hesaplar ekleyebileceği bir bölüm.
   - Şirket Yönetimi: Kayıtlı tüm firmaların listesi, aktif abonelik durumları (Deneme Süresi, Standart, Pro) ve hesap dondurma işlemleri.
   - Global Metrikler: Sistem geneli toplam işlem hacmi, şirket sayısı ve toplam kullanıcı analizleri.

3. Ana Dashboard (/dashboard):
   - Özet KPI Kartları: Toplam Kasa/Banka Bakiyesi, Aylık Gelir, Aylık Gider, Gecikmiş Tahsilatlar.
   - İnteraktif Nakit Akış Grafiği (Gelir vs Gider karşılaştırması).
   - Hızlı Aksiyon Butonları: "POS Satış Ekranı", "Yeni Fatura Kes", "Tahsilat Ekle", "Cari Ekle".

4. Barkodlu POS Satış Ekranı (/pos) - Perakende Kasa Modülü:
   - Barkod Okuyucu Entegrasyonu: USB/Kablosuz fiziksel barkod okuyucuları otomatik algılayan arama alanı ve mobil/tablet için kamera ile okutma desteği.
   - Görsel Ürün Izgarası: Görselli, fiyatlı, stok durumlu ve barkod etiketli hızlı ürün kartları.
   - Sepet Paneli: Anlık toplam hesaplama, ürün bazlı indirim ve sepet geneli indirim.
   - Ödeme Yöntemleri: Nakit (Anlık para üstü hesaplama araçlı), Kredi Kartı, Parçalı Ödeme ve Veresiye/Cariye Yaz (Müşteri arama ve borçlandırma).
   - Termal Fiş Yazdırma: 80mm ESC/POS formatında yazdırılabilir termal fiş önizleme pop-up'ı.
   - Kasa Vardiya Yönetimi (Z-Raporu): Gün başı kasa açılış, gün sonu sayımı ve kasa farkı raporlama.

5. Stok ve Barkod Yönetimi (/stok):
   - Ürün Listesi ve Kartı: Barkod, SKU, Ürün Adı, Alış/Satış Fiyatı, KDV Oranı ve Mevcut Stok.
   - Barkod Etiketi Yazdırma: Barkodu olmayan ürünler için sistemden barkod üretme ve etiket basma aracı.
   - Kritik Stok Uyarısı: Stok minimum seviyenin altına düştüğünde kırmızı rozet uyarısı.

6. Cari Yönetimi - Müşteri & Tedarikçiler (/cariler):
   - Müşteriler ve Tedarikçiler sekmeleri.
   - Vergi bilgileri, adres, toplam borç/alacak bakiyesi ve detaylı hareket geçmişi (Ekstre).

7. Fatura ve Satış Yönetimi (/faturalar):
   - Fatura Oluşturma Modalı: Müşteri seçimi, ürün kalemleri, KDV, tevkifat hesaplama ve yazdırılabilir/indirilebilir resmi fatura şablonu (Taslak, Gönderildi, Ödendi vb. durum etiketleri ile).

8. Gider ve Fiş Takibi (/giderler):
   - Kategorize Gider Girişi (Kira, Fatura, Maaş vb.).
   - Fiş/Fatura görseli yükleme ve önizleme alanı.

9. Ayarlar, Personel Yönetimi ve Otonom Yedekleme (/ayarlar):
   - Firma Profili: Logo, Vergi Bilgileri, Adres, IBAN.
   - Şirket Personel Yönetimi (Sadece firm_admin ve manager görebilir): Kendi şirketlerine özel yeni e-posta/şifre ile kullanıcı hesabı oluşturma ve rol atama (Müdür, Muhasebeci, Kasiyer).
   - Bilgisayara Veri Yedekleme (Manuel Backup): Tüm şirket verilerini (Cari, Stok, Fatura, Hareketler) yapılandırılmış `.json` dosyası olarak doğrudan bilgisayara indirme özelliği.
   - Otonom (Otomatik) Yedekleme Sistemi: Kullanıcının ayarlardan açıp kapatabileceği, "Gün sonu Z-Raporu alındığında" veya "Belirli saat aralıklarında" veritabanının yedeğini otomatik olarak `.json` dosyası şeklinde PC'ye indiren (auto-download) akıllı trigger mekanizması.
   - Veri Geri Yükleme (Restore): PC'deki yedek JSON dosyasını okuyup şirket veritabanını eksiksiz şekilde eski haline getirme.
   - Bildirimler: Başarılı/Başarısız işlemler için akıcı toast bildirimleri kullanılmalıdır.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d930e867-2550-4431-9b8f-501fd8074090).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
