import React, { useEffect } from 'react';
import {
  ArrowLeft,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Mail,
  FileText,
  Baby,
  Trophy,
  Trash2,
  ExternalLink,
  Award,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { soundManager } from '../../utils/sound';

export interface TermsOfServiceScreenProps {
  onBack: () => void;
  onNavigateToPrivacy?: () => void;
}

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({
  onBack,
  onNavigateToPrivacy,
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
    document.title = 'Ketentuan Layanan - Hitung Kilat';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const handleBack = () => {
    soundManager.playClick();
    onBack();
  };

  const handleGoPrivacy = () => {
    soundManager.playClick();
    if (onNavigateToPrivacy) {
      onNavigateToPrivacy();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/privacy-policy';
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
            onClick={handleGoPrivacy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-200 hover:text-white transition-colors"
            title="Buka Kebijakan Privasi"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <span className="hidden sm:inline">Kebijakan Privasi</span>
          </button>
          <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
            <Scale className="w-5 h-5 text-amber-400 flex-shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">Ketentuan Layanan Resmi</span>
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
              <Scale className="w-8 h-8" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400">
                Ketentuan Layanan (Terms of Service)
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

        {/* Section 1: Pengantar & Identitas Pengembang */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Mail className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>1. Identitas Layanan & Pengembang</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Selamat datang di <strong>Hitung Kilat - Web Math Speed Game</strong>. Aplikasi web ini dirancang dan dikelola oleh{' '}
            <strong className="text-white">BGS DevSecOps Team / Sahir Web ID</strong> sebagai media edukasi interaktif untuk melatih
            kecepatan berhitung mental, ketangkasan kognitif, dan penguasaan matematika dasar hingga lanjutan.
          </p>
          <div className="bg-indigo-900/40 border border-indigo-800/80 rounded-xl p-4 space-y-2 text-sm text-slate-200">
            <div>
              <span className="text-indigo-300 font-medium">Domain Resmi: </span>
              <a href="https://hitung-kilat.k8s.web.id" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline hover:text-amber-200 inline-flex items-center gap-1">
                https://hitung-kilat.k8s.web.id <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
            <div>
              <span className="text-indigo-300 font-medium">Pengembang Resmi: </span>
              BGS DevSecOps Team / Sahir Web ID
            </div>
            <div>
              <span className="text-indigo-300 font-medium">Kontak Email Resmi: </span>
              <a href="mailto:webmaster@k8s.web.id" className="text-amber-300 underline hover:text-amber-200 font-semibold">
                webmaster@k8s.web.id
              </a>
            </div>
          </div>
        </section>

        {/* Section 2: Penerimaan Ketentuan */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <FileText className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>2. Penerimaan Ketentuan (Acceptance of Terms)</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Dengan mengakses, membuka, atau memainkan permainan di situs web ini, Anda menyatakan telah membaca, memahami, dan
            menyetujui untuk terikat oleh seluruh Ketentuan Layanan ini serta{' '}
            <button onClick={handleGoPrivacy} className="text-amber-300 underline font-semibold hover:text-amber-200 inline-flex items-center gap-0.5">
              Kebijakan Privasi
            </button>{' '}
            kami. Apabila Anda tidak menyetujui salah satu ketentuan ini, Anda dipersilakan untuk tidak menggunakan atau berhenti memainkan permainan ini.
          </p>
        </section>

        {/* Section 3: Sifat Layanan Edukasi, Tanpa Biaya, Tanpa Iklan */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Award className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>3. Sifat Layanan Edukatif: 100% Gratis & Tanpa Iklan Komersial</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Hitung Kilat didedikasikan secara tulus sebagai sarana pembelajaran bagi siswa, pendidik, dan masyarakat luas:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-slate-300 pl-2">
            <li><strong>Gratis Penuh:</strong> Tidak ada biaya pendaftaran, biaya langganan, atau pembelian dalam aplikasi (<em>no in-app purchases</em>).</li>
            <li><strong>Bebas Iklan Komersial:</strong> Aplikasi tidak menyertakan jaringan iklan pelacak pihak ketiga (<em>no ad networks</em>) demi menjaga fokus dan keselamatan belajar.</li>
            <li><strong>Akses Terbuka:</strong> Seluruh 72 Level Campaign, 6 Pertarungan Boss, Mode Latihan Adaptif, dan Mistake Training dapat dimainkan tanpa paywall.</li>
          </ul>
        </section>

        {/* Section 4: Akun Pengguna & Google OAuth2 */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <ShieldCheck className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>4. Akun Pengguna & Penggunaan Google OAuth2</h2>
          </div>
          <div className="space-y-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            <p>
              Aplikasi menyediakan dua model partisipasi permainan:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-indigo-900/30 border border-indigo-800/60 rounded-xl p-4">
                <h3 className="font-bold text-amber-300 text-sm mb-1">Mode Tamu (Guest Mode)</h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Tidak memerlukan login atau akun apa pun. Data skor, bintang, dan riwayat belajar disimpan sepenuhnya di browser lokal Anda (Local Storage).
                </p>
              </div>
              <div className="bg-indigo-900/30 border border-indigo-800/60 rounded-xl p-4">
                <h3 className="font-bold text-amber-300 text-sm mb-1">Akun Google (Google OAuth2)</h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Opsional. Digunakan semata-mata untuk mencadangkan (<em>sync</em>) capaian level dan bintang Anda di cloud agar tidak hilang saat berganti perangkat.
                </p>
              </div>
            </div>
            <p className="text-xs text-indigo-300/90 italic">
              * Sesuai Kebijakan Data Pengguna Layanan API Google (Google API Services User Data Policy), data profil Google Anda tidak pernah dijual, dipindahtangankan, atau digunakan untuk profiling periklanan.
            </p>
          </div>
        </section>

        {/* Section 5: Perlindungan Anak (COPPA / GDPR-K) */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Baby className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>5. Kebijakan Pengguna di Bawah Umur (COPPA & GDPR-K Compliance)</h2>
          </div>
          <div className="space-y-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            <p>
              Hitung Kilat dirancang ramah keluarga dan aman untuk anak-anak:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-sm sm:text-base">
              <li>Pintu Verifikasi Usia (<em>Age Gate</em>) diterapkan sebelum fitur publik atau sinkronisasi akun dapat diaktifkan.</li>
              <li>Pengguna berusia di bawah 13 tahun secara otomatis diisolasi ke dalam <strong>Safe Local Mode</strong>.</li>
              <li>Aplikasi tidak pernah mengumpulkan nama asli anak, alamat fisik, nomor telepon, kontak sekolah, atau foto profil anak.</li>
              <li>Anak di bawah 13 tahun tidak dipublikasikan ke papan peringkat kompetitif global demi melindungi privasi anak secara mutlak.</li>
            </ul>
          </div>
        </section>

        {/* Section 6: Aturan Fair Play & Larangan */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <ShieldAlert className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>6. Integritas Permainan & Larangan Pengguna (Fair Play)</h2>
          </div>
          <div className="space-y-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            <p>
              Untuk menjaga ekosistem kompetisi yang jujur dan menyenangkan bagi seluruh pemain (Sprint 60 Detik, Survival Kilat, Tantangan Harian), pengguna dilarang:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-sm sm:text-base">
              <li><strong>Kecurangan Teknis:</strong> Menggunakan skrip otomatis, bot kalkulator, tools inject websocket/HTTP, atau manipulasi jam/timer perangkat (<em>clock tampering</em>).</li>
              <li><strong>Pseudonym yang Melanggar:</strong> Menggunakan nama samaran (pseudonym) yang mengandung unsur pelecehan, pornografi, ujaran kebencian, diskriminasi SARA, atau meniru identitas orang lain. Pseudonym tunduk pada moderasi filter otomatis.</li>
              <li><strong>Eksploitasi Sistem:</strong> Mencoba merusak, membebani (DoS/DDoS), atau mengganggu infrastruktur server game.</li>
            </ul>
            <p className="text-xs text-amber-300/90 font-medium">
              Pelanggaran terhadap aturan ini dapat mengakibatkan pembatalan skor pada papan peringkat atau penonaktifan akun secara permanen.
            </p>
          </div>
        </section>

        {/* Section 7: Hak Penghapusan Data (User Rights & Data Deletion) */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <Trash2 className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>7. Hak Pengguna & Penghapusan Akun Mandiri</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Anda memiliki kedaulatan penuh atas data Anda:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm sm:text-base text-slate-300">
            <li><strong>Ekspor Data (Portabilitas):</strong> Anda dapat mengunduh seluruh arsip data kemajuan matematika Anda dalam format JSON tanpa PII kapan pun melalui menu Pengaturan.</li>
            <li><strong>Penghapusan Instan Mandiri:</strong> Anda dapat menghapus seluruh data cloud dan lokal Anda secara permanen melalui tombol <em>Hapus Akun & Data</em> di menu Pengaturan dengan mengetikkan konfirmasi "HAPUS".</li>
            <li>Permintaan bantuan penghapusan juga dapat diajukan langsung melalui email ke <a href="mailto:webmaster@k8s.web.id" className="text-amber-300 underline font-semibold">webmaster@k8s.web.id</a>.</li>
          </ul>
        </section>

        {/* Section 8: Batasan Tanggung Jawab (Disclaimer) */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>8. Batasan Tanggung Jawab (Disclaimer of Warranties)</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Aplikasi Hitung Kilat disediakan "sebagaimana adanya" (<em>as-is</em>) dan "sebagaimana tersedia" (<em>as-available</em>). Pengembang berupaya sebaik mungkin menjaga ketersediaan layanan dan akurasi generator matematika, namun tidak bertanggung jawab atas kerugian tidak langsung atau gangguan teknis di luar kendali kami.
          </p>
        </section>

        {/* Section 9: Perubahan Ketentuan */}
        <section className="bg-indigo-950/70 border border-indigo-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-indigo-300 font-bold text-lg border-b border-indigo-800/60 pb-3">
            <HelpCircle className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2>9. Pembaruan & Perubahan Ketentuan</h2>
          </div>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Ketentuan Layanan ini dapat diperbarui sewaktu-waktu seiring penambahan fitur baru atau penyesuaian hukum yang berlaku. Setiap perubahan akan dicantumkan secara terbuka di halaman ini dengan memperbarui tanggal "Terakhir Diperbarui".
          </p>
        </section>

        {/* Bottom CTA / Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-indigo-950/80 border border-indigo-800/50 rounded-3xl backdrop-blur-md shadow-xl">
          <div>
            <h3 className="font-bold text-white text-base">Siap Berlatih Berhitung Cepat?</h3>
            <p className="text-xs sm:text-sm text-indigo-300">
              Latih ketajaman otak matematika Anda melalui 72 level tantangan seru.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleBack}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-indigo-950 font-black text-sm sm:text-base shadow-lg transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              Mulai Bermain
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-indigo-300/60 py-6 space-y-2">
          <div>
            Hitung Kilat V2 &copy; 2026 BGS DevSecOps Team / Sahir Web ID. Hak Cipta Dilindungi Undang-Undang.
          </div>
          <div className="flex items-center justify-center gap-4 text-indigo-300/80">
            <button onClick={handleGoPrivacy} className="underline hover:text-amber-300">
              Kebijakan Privasi
            </button>
            <span>&bull;</span>
            <a href="mailto:webmaster@k8s.web.id" className="underline hover:text-amber-300">
              Kontak Pengembang: webmaster@k8s.web.id
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
};
