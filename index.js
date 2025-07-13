const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const P = require("pino");
const { writeToSheet, rekapMingguan, hapusData } = require("./sheets");

async function startSock() {
  console.log("⏳ Memulai bot...");

  const { state, saveCreds } = await useMultiFileAuthState("auth");
  console.log("✅ Auth berhasil dimuat");

  const sock = makeWASocket({
    logger: P({ level: "debug" }),
    printQRInTerminal: true,
    auth: state,
  });

  console.log("📲 Menunggu QR code...");

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    const pesan = msg.message?.conversation;
    const pengirim = msg.key.remoteJid;

    const allowedGroupId = "120363419575844968@g.us";

    if (pengirim !== allowedGroupId) return;

    if (!pesan) return;

    if (pesan.toLowerCase().includes("rekap")) {
      const hasil = await rekapMingguan();
      await sock.sendMessage(pengirim, { text: hasil });
      return;
    }

    if (pesan.toLowerCase().startsWith("hapus")) {
      const hasil = await hapusData(pesan);
      await sock.sendMessage(pengirim, { text: hasil });
      return;
    }

    console.log(`📥 Dari ${pengirim}: ${pesan}`);

    const parsed = parsePengeluaran(pesan);
    if (parsed) {
      await writeToSheet(parsed);
      await sock.sendMessage(pengirim, {
        text: `✅ Dicatat: ${parsed.kategori} - Rp${parsed.jumlah}`,
      });
    } else {
      await sock.sendMessage(pengirim, {
        text: '⚠️ Format tidak dikenali. Contoh: "Makan 20000"',
      });
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("❌ Terputus. Reconnect?", shouldReconnect);
      if (shouldReconnect) startSock();
    } else if (connection === "open") {
      console.log("✅ Bot siap digunakan!");
    }
  });
}

function parsePengeluaran(teks) {
  const match = teks.match(/(\w+)[\s\-:]*(\d+[kK]?)/);
  if (!match) return null;

  const kategori = match[1];
  const jumlah = parseInt(match[2].toLowerCase().replace("k", "000"));

  return {
    tanggal: new Date().toISOString().split("T")[0],
    kategori,
    jumlah,
    keterangan: teks,
  };
}

startSock();
