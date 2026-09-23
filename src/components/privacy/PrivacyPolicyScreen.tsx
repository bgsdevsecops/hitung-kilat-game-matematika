import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Mail,
  FileText,
  Baby,
  Download,
  Trash2,
  Database,
  ExternalLink,
  Award,
  Scale,
} from 'lucide-react';
import { soundManager } from '../../utils/sound';

export interface PrivacyPolicyScreenProps {
  onBack: () => void;
  onNavigateToTerms?: () => void;
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
  onBack,
  onNavigateToTerms,
}) => {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
      }
    } catch {
      // Ignore in environments where scrollTo is unsupported (e.g. test jsdom)
    }
    const previousTitle = document.title;
    document.title = 'Kebijakan Privasi - Hitung Kilat';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const handleBack = () => {
    soundManager.playClick();
    onBack();
  };

  const handleGoTerms = () => {
    soundManager.playClick();
    if (onNavigateToTerms) {
      onNavigateToTerms();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/terms-of-service';
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center py-6 px-4 sm:px-6 lg:px-8">
      {/* Top Navigation Bar */}
      <header className="w-full max-w-4xl flex items-center justify-between gap-4 mb-8 bg-indigo-950/80 border border-indigo-800/50 rounded-2xl p-4 backdrop-blur-md shadow-xl sticky top-4 z-40">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm sm:text-base shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Kembali ke Permainan"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          <span>Kembali ke Permainan</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <button
            onClick={handleGoTerms}
            aria-label="Buka Ketentuan Layanan"
            title="Buka Ketentuan Layanan"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-200 hover:text-white transition-colors"
          >
            <Scale className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span className="hidden sm:inline">Ketentuan Layanan</span>
          </button>
          <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">Kebijakan Privasi Resmi</span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="w-full max-w-4xl space-y-6">
        {/* Document Header Card */}
        <section className="bg-indigo-950/80 border border-indigo-800/50 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-indigo-950 shadow-lg border-b-4 border-amber-600">
              <ShieldCheck className="w-8 h-8" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400">
                Kebijakan Privasi & Perlindungan Data
              </h1>
              <p className="text-sm text-indigo-300 mt-1">
                Hitung Kilat - Web Math Speed Game
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-indigo-200/80 pt-4 border-t border-indigo-800/60">
            <span>Terakhir Diperbarui: <strong>23 September 2026</strong></span>
            <span>Versi: <strong>2.4.0 (Production Release)</strong></span>
            <span>Domain: <strong>https://hitung-kilat.k8s.web.id</strong></span>
          </div>
        </section>

        {/* Section 1: Identitas Layanan & Kontak Pengembang */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Mail className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>1. Identitas Layanan & Pengembang (Service Identity & Developer Contact)</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Aplikasi <strong>Hitung Kilat - Web Math Speed Game</strong> dikembangkan dan dikelola oleh{' '}
            <strong className="text-white">Hitung Kilat Team</strong> sebagai sarana edukasi matematika mental
            interaktif berbasis web. Kami berkomitmen penuh untuk melindungi privasi, integritas, dan keamanan data setiap pengguna.
          </p>
          <div className="bg-indigo-900/40 border border-indigo-800/80 rounded-xl p-4 space-y-2 text-sm text-slate-200">
            <div>
              <span className="text-indigo-300 font-medium">Aplikasi: </span>
              Hitung Kilat - Web Math Speed Game (<a href="https://hitung-kilat.k8s.web.id" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200 inline-flex items-center gap-1">https://hitung-kilat.k8s.web.id <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></a>)
            </div>
            <div>
              <span className="text-indigo-300 font-medium">Pengembang & Penanggung Jawab Privasi: </span>
              Hitung Kilat Team
            </div>
            <div>
              <span className="text-indigo-300 font-medium">Kontak Email Resmi: </span>
              <a
                href="mailto:webmaster@k8s.web.id"
                className="text-amber-300 font-semibold underline hover:text-amber-200"
              >
                webmaster@k8s.web.id
              </a>
            </div>
          </div>
        </section>

        {/* Section 2: Data yang Dikumpulkan */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <FileText className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>2. Data yang Dikumpulkan (Data Collection)</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Hitung Kilat menerapkan prinsip minimalisasi data (<em>data minimization</em>). Kami hanya memproses data yang benar-benar esensial untuk berjalannya fungsi permainan:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-slate-300 pl-2">
            <li>
              <strong className="text-white">Otentikasi Akun Google (Google OAuth2):</strong> ID Pengguna Google (UID), Nama Profil, dan Alamat Email (hanya saat Anda memilih masuk dengan akun Google untuk sinkronisasi cloud).
            </li>
            <li>
              <strong className="text-white">Progres & Statistik Permainan:</strong> Skor level, perolehan bintang (1-3 bintang), akurasi jawaban, waktu penyelesaian, streak harian, dan riwayat tantangan harian.
            </li>
            <li>
              <strong className="text-white">Pengaturan & Preferensi:</strong> Preferensi efek suara (mute), pseudonym leaderboard, bendera wilayah, dan pengaturan batas usia.
            </li>
          </ul>
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 text-xs sm:text-sm text-emerald-200">
            <strong>Catatan Penting:</strong> Kami <em>tidak pernah</em> mengumpulkan nomor telepon, alamat rumah fisik, data kartu kredit/keuangan, atau data pelacakan lokasi geografis GPS.
          </div>
        </section>

        {/* Section 3: Tujuan Penggunaan Data */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Award className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>3. Tujuan Penggunaan Data (Data Usage Purpose)</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Data yang diproses digunakan semata-mata untuk tujuan fungsional permainan:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-slate-300 pl-2">
            <li>
              <strong className="text-white">Sinkronisasi Cloud Antar-Perangkat (Cloud Sync):</strong> Memastikan level kampanye, bintang, dan pencapaian Anda tersimpan secara konsisten saat berpindah perangkat.
            </li>
            <li>
              <strong className="text-white">Evaluasi & Pembelajaran Adaptif (Mastery & Taxonomy):</strong> Menghitung akurasi sub-keterampilan matematika untuk menyajikan latihan yang tepat sesuai kebutuhan belajar pemain.
            </li>
            <li>
              <strong className="text-white">Papan Peringkat Publik (Leaderboard):</strong> Menampilkan peringkat skor tertinggi dengan nama samaran (pseudonym) bagi pemain dewasa yang menyetujuinya.
            </li>
          </ol>
        </section>

        {/* Section 4: Kepatuhan Google API & Ketentuan Limited Use */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Lock className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>4. Kepatuhan Kebijakan Pengguna Google API</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Aplikasi Hitung Kilat mematuhi sepenuhnya ketentuan kebijakan pengguna Google, termasuk klausul Penggunaan Terbatas:
          </p>

          <div className="bg-indigo-900/50 border-l-4 border-amber-400 p-4 rounded-r-xl space-y-3">
            <p className="text-sm sm:text-base font-semibold text-amber-200 leading-relaxed">
              Aplikasi Hitung Kilat mematuhi Kebijakan Data Pengguna Layanan Google, termasuk ketentuan Penggunaan Terbatas. Data pengguna yang diperoleh dari Google OAuth2 tidak pernah dialihkan ke pihak ketiga, tidak pernah digunakan untuk periklanan, dan tidak pernah digunakan untuk pelatihan model kecerdasan buatan tanpa persetujuan eksplisit.
            </p>
            <p className="text-xs sm:text-sm text-indigo-200/90 italic">
              &quot;Hitung Kilat&apos;s use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.&quot;
            </p>
          </div>

          <div className="space-y-2 text-sm text-slate-300">
            <p className="font-semibold text-white">Prinsip Penggunaan Terbatas yang Diterapkan:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Hanya digunakan untuk otentikasi identitas akun dan penyimpanan data progres pemain yang diminta pengguna.</li>
              <li>Data tidak pernah dijual, disewakan, atau ditransfer ke pihak ketiga atau broker data iklan manapun.</li>
              <li>Data profil Google tidak pernah dipakai untuk menampilkan iklan bertarget atau profil pemasaran komersial.</li>
              <li>Data tidak pernah digunakan untuk melatih generalized artificial intelligence (AI) atau model pembelajaran mesin (ML).</li>
              <li>Akses oleh manusia dibatasi secara ketat dan hanya terjadi atas permintaan bantuan teknis atau audit keamanan yang disetujui.</li>
            </ul>
          </div>
        </section>

        {/* Section 5: Perlindungan Anak & Privasi Usia (COPPA / GDPR-K) */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Baby className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>5. Perlindungan Anak & Privasi Usia (COPPA / GDPR-K)</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Kami sangat memperhatikan keselamatan dan privasi anak-anak sesuai dengan standar Children&apos;s Online Privacy Protection Act (COPPA) dan GDPR-K:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-900/30 border border-indigo-800/60 rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-amber-300 text-sm sm:text-base">Mode Tamu (Guest Mode) Penuh</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pemain dan anak-anak dapat menikmati seluruh mode permainan matematika secara gratis tanpa perlu melakukan registrasi akun atau memberikan informasi identitas pribadi apapun.
              </p>
            </div>
            <div className="bg-indigo-900/30 border border-indigo-800/60 rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-amber-300 text-sm sm:text-base">Proteksi Usia Di Bawah 13 Tahun</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pemain yang terverifikasi berusia di bawah 13 tahun (<em>under 13</em>) secara otomatis dilindungi: profil mereka tidak akan pernah dipublikasikan di papan peringkat publik dan tidak dapat mengunggah identitas pribadi.
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            Papan peringkat publik hanya menggunakan nama samaran (<em>pseudonym</em>) yang dimoderasi secara otomatis untuk mencegah konten tidak pantas. Nama asli akun Google tidak pernah diekspos ke publik.
          </p>
        </section>

        {/* Section 6: Keamanan & Lokasi Penyimpanan Data */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Database className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>6. Keamanan & Lokasi Penyimpanan Data (Security & Storage)</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Data pengguna disimpan pada infrastruktur cloud Google Cloud Firestore yang memiliki sertifikasi kepatuhan keamanan ISO/IEC 27001 dan SOC 2:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-slate-300 pl-2">
            <li>
              <strong className="text-white">Enkripsi Data saat Transit:</strong> Seluruh komunikasi antara browser pengguna dan server diamankan melalui protokol HTTPS dengan TLS 1.3.
            </li>
            <li>
              <strong className="text-white">Enkripsi Data at Rest:</strong> Seluruh dokumen database dienkripsi menggunakan enkripsi standar industri AES-256.
            </li>
            <li>
              <strong className="text-white">Kontrol Akses Terisolasi:</strong> Firestore Security Rules membatasi akses baca dan tulis hanya kepada pemilik akun yang terotentikasi sesuai UID masing-masing.
            </li>
          </ul>
        </section>

        {/* Section 7: Hak Pengguna & Penghapusan Data */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Trash2 className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>7. Hak Pengguna & Penghapusan Data (User Rights & Data Deletion)</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Sebagai subjek data, Anda memiliki kendali penuh atas data pribadi dan progres permainan Anda:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-900/30 border border-indigo-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base">
                <Download className="w-4 h-4" aria-hidden="true" />
                <h3>Ekspor Data Mandiri</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Anda dapat mengunduh seluruh data profil, progres 72 level kampanye, dan riwayat tantangan harian dalam format JSON melalui tombol <strong>Ekspor Data (Unduh JSON)</strong> di menu Pengaturan.
              </p>
            </div>

            <div className="bg-indigo-900/30 border border-indigo-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm sm:text-base">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <h3>Penghapusan Akun Mandiri 2-Langkah</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Anda dapat menghapus dokumen akun dan data Cloud Sync secara permanen kapan saja melalui fitur <strong>Hapus Akun & Data (2-Langkah)</strong> di menu Pengaturan.
              </p>
            </div>
          </div>

          <div className="bg-indigo-900/40 border border-indigo-800/80 rounded-xl p-4 text-xs sm:text-sm text-slate-300">
            <strong>Permohonan Manual Penghapusan Data:</strong> Jika Anda tidak dapat mengakses akun Anda atau ingin mengajukan permohonan penghapusan manual, silakan kirim email ke{' '}
            <a href="mailto:webmaster@k8s.web.id" className="text-amber-300 font-semibold underline hover:text-amber-200">
              webmaster@k8s.web.id
            </a>
            . Kami akan memverifikasi dan menghapus seluruh catatan data Anda dalam waktu maksimal 3 (tiga) hari kerja.
          </div>
        </section>

        {/* Bottom Back Button Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-12 border-t border-indigo-800/60">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs text-indigo-300 text-center sm:text-left">
            <span>
              Pertanyaan seputar privasi? Hubungi{' '}
              <a href="mailto:webmaster@k8s.web.id" className="text-amber-300 underline font-medium hover:text-amber-200">
                webmaster@k8s.web.id
              </a>
            </span>
            <span className="hidden sm:inline">&bull;</span>
            <button
              onClick={handleGoTerms}
              className="text-amber-300 underline font-semibold hover:text-amber-200"
            >
              Ketentuan Layanan
            </button>
          </div>

          <button
            onClick={handleBack}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:from-indigo-800 active:to-indigo-900 text-white font-bold text-base shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            <span>Kembali ke Permainan</span>
          </button>
        </div>
      </main>
    </div>
  );
};
