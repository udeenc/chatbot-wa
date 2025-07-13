const { GoogleSpreadsheet } = require("google-spreadsheet");
const dummyDoc = new GoogleSpreadsheet("dummy_id");

console.log(
  "🔍 useServiceAccountAuth exists?",
  typeof dummyDoc.useServiceAccountAuth
);

const creds = require("./credentials.json");

const SHEET_ID = "1Fbuh7QHBouEUicdfiYwuaV6yXjpZU7AiTjFHgavUETg";
const SHEET_TAB_INDEX = 0;

async function writeToSheet({ tanggal, kategori, jumlah, keterangan }) {
  try {
    const doc = new GoogleSpreadsheet(SHEET_ID);

    await doc.useServiceAccountAuth(creds);

    await doc.loadInfo();

    console.log("📄 Jumlah sheet:", doc.sheetCount);
    console.log(
      "📄 Nama-nama sheet:",
      doc.sheetsByIndex.map((s) => s.title)
    );

    const sheet = doc.sheetsByIndex[SHEET_TAB_INDEX];
    if (!sheet) {
      throw new Error(`Sheet '${SHEET_TAB_INDEX}' tidak ditemukan`);
    }

    await sheet.addRow({
      Tanggal: tanggal,
      Kategori: kategori,
      Jumlah: jumlah,
      Keterangan: keterangan,
    });

    console.log(`✅ Disimpan ke Sheet: ${kategori} - Rp${jumlah}`);
  } catch (err) {
    console.error("❌ Gagal menulis ke Google Sheets:", err.message);
  }
}

async function rekapMingguan() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[SHEET_TAB_INDEX];
  const rows = await sheet.getRows();

  if (rows.length === 0) return "❌ Tidak ada data.";

  let pengeluaran = 0;
  let pemasukanLain = 0;
  let gajiTerakhir = null;
  const perKategori = {};
  const hasilRinci = [];

  // Mulai dari transaksi terakhir ke atas
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const jumlah = parseInt(row.Jumlah);
    const kategori = row.Kategori;
    const keterangan = row.Keterangan || "";

    if (!jumlah || !kategori) continue;

    const kategoriLower = kategori.toLowerCase();

    // Jika ini gaji, simpan dan STOP
    if (kategoriLower === "gaji") {
      gajiTerakhir = jumlah;
      break;
    }

    // Deteksi pemasukan non-gaji
    const isPemasukanLain = ["tf", "transfer", "masuk"].includes(kategoriLower);

    if (isPemasukanLain) {
      pemasukanLain += jumlah;
    } else {
      pengeluaran += jumlah;
    }

    // Rekap per kategori
    const delta = isPemasukanLain ? jumlah : -jumlah;
    perKategori[kategori] = (perKategori[kategori] || 0) + delta;

    hasilRinci.unshift(
      `• ${kategori} ${keterangan ? "- " + keterangan : ""}: ${
        delta > 0 ? "+" : "-"
      }Rp${Math.abs(jumlah).toLocaleString()}`
    );
  }

  if (gajiTerakhir === null) {
    return "⚠️ Tidak ditemukan catatan gaji sebelumnya.";
  }

  const sisa = gajiTerakhir + pemasukanLain - pengeluaran;

  let hasil = `📊 Rekap Sejak Gaji Terakhir:\n`;
  hasil += `Gaji: Rp${gajiTerakhir.toLocaleString()}\n`;
  if (pemasukanLain > 0)
    hasil += `Pemasukan lain: +Rp${pemasukanLain.toLocaleString()}\n`;
  hasil += `Pengeluaran: -Rp${pengeluaran.toLocaleString()}\n`;
  hasil += `💰 Sisa uang: Rp${sisa.toLocaleString()}\n\n`;

  hasil += `📂 Per Kategori:\n`;
  for (const [kategori, jumlah] of Object.entries(perKategori)) {
    const prefix = jumlah < 0 ? "-" : "+";
    hasil += `• ${kategori}: ${prefix}Rp${Math.abs(jumlah).toLocaleString()}\n`;
  }

  hasil += `\n📄 Rincian:\n${hasilRinci.join("\n")}`;

  return hasil;
}

async function hapusData(pesan) {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[SHEET_TAB_INDEX];
  const rows = await sheet.getRows();

  if (rows.length === 0) return "❌ Tidak ada data yang bisa dihapus.";

  const lastRow = rows[rows.length - 1];
  const info = `🗑️ Dihapus: ${lastRow.Kategori} - Rp${lastRow.Jumlah} (${lastRow.Tanggal})`;

  await lastRow.delete();

  return info;
}

module.exports = { writeToSheet, rekapMingguan, hapusData };
