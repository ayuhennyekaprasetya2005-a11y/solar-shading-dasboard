
/*
  SOLAR SHADING MONITOR

  Mode awal: SIMULASI
  Untuk memakai sensor nyata:
  1. Ubah SIMULATION_MODE menjadi false.
  2. Ganti ESP32_DATA_URL dengan alamat ESP32.
  3. Pastikan ESP32 mengirim JSON sesuai format di bawah.

  Format JSON yang diharapkan:
  {
    "panelA": {
      "voltage": 18.2,
      "current": 4.8,
      "power": 87.36
    },
    "panelB": {
      "voltage": 17.4,
      "current": 2.1,
      "power": 36.54
    },
    "temperatureB": 38.5
  }
*/

const SIMULATION_MODE = true;
const ESP32_DATA_URL = "http://192.168.1.100/data";

const $ = (id) => document.getElementById(id);

const historyData = {
  labels: [],
  powerA: [],
  powerB: [],
  temperature: []
};

const powerCanvas = $("powerChart");
const tempCanvas = $("temperatureChart");

const powerCtx = powerCanvas.getContext("2d");
const tempCtx = tempCanvas.getContext("2d");

function format(value, digits = 2) {
  return Number.isFinite(Number(value))
    ? Number(value).toFixed(digits)
    : "—";
}

function setConnection(isOnline, message) {
  $("connectionText").textContent = message;

  const color = isOnline ? "var(--green)" : "var(--orange)";

  $("connectionStatus").style.color = color;
  $("connectionStatus").querySelector(".status-dot").style.background = color;

  $("modeLabel").textContent = SIMULATION_MODE
    ? "SIMULASI AKTIF"
    : isOnline
      ? "ESP32 TERHUBUNG"
      : "MENUNGGU ESP32";

  $("modeLabel").style.color = color;
}

function normalizePanel(panel) {
  const voltage = Number(panel?.voltage);
  const current = Number(panel?.current);

  const power = Number.isFinite(Number(panel?.power))
    ? Number(panel.power)
    : voltage * current;

  if (
    !Number.isFinite(voltage) ||
    !Number.isFinite(current) ||
    !Number.isFinite(power)
  ) {
    throw new Error("Data tegangan, arus, atau daya tidak lengkap.");
  }

  return { voltage, current, power };
}

// Data contoh, bukan hasil sensor nyata.
function makeSimulationData() {
  const voltageA = 18.0 + Math.random() * 0.5;
  const currentA = 4.2 + Math.random() * 0.35;

  const voltageB = 17.2 + Math.random() * 0.7;
  const currentB = 2.0 + Math.random() * 0.8;

  return {
    panelA: {
      voltage: voltageA,
      current: currentA,
      power: voltageA * currentA
    },
    panelB: {
      voltage: voltageB,
      current: currentB,
      power: voltageB * currentB
    },
    temperatureB: 35 + Math.random() * 8
  };
}

async function getData() {
  if (SIMULATION_MODE) {
    return makeSimulationData();
  }

  const response = await fetch(ESP32_DATA_URL, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`ESP32 merespons HTTP ${response.status}`);
  }

  return await response.json();
}

// Menggambar grafik tanpa library tambahan.
function drawLineChart(canvas, ctx, series, labels, digits = 0) {
  const rect = canvas.getBoundingClientRect();

  const width = Math.max(rect.width, 280);
  const height = Math.max(rect.height, 180);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = {
    left: 40,
    right: 12,
    top: 14,
    bottom: 27
  };

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = series.flatMap(s => s.values)
    .filter(Number.isFinite);

  if (values.length === 0) return;

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (max - min < 1) {
    max += 1;
    min = Math.max(0, min - 1);
  }

  const extra = (max - min) * 0.12;
  min = Math.max(0, min - extra);
  max += extra;

  ctx.font = "10px sans-serif";
  ctx.lineWidth = 1;

  // Garis kisi dan label sumbu Y.
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + plotH * i / 4;
    const value = max - (max - min) * i / 4;

    ctx.strokeStyle = "rgba(157,177,211,.14)";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = "#96a8c5";
    ctx.textAlign = "right";
    ctx.fillText(value.toFixed(digits), pad.left - 7, y + 3);
  }

  const count = Math.max(
    ...series.map(s => s.values.length),
    1
  );

  // Garis masing-masing seri.
  series.forEach(item => {
    if (item.values.length === 0) return;

    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2.3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();

    item.values.forEach((value, i) => {
      const x = pad.left +
        (count <= 1 ? plotW / 2 : i / (count - 1) * plotW);

      const y = pad.top +
        ((max - value) / (max - min)) * plotH;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    item.values.forEach((value, i) => {
      const x = pad.left +
        (count <= 1 ? plotW / 2 : i / (count - 1) * plotW);

      const y = pad.top +
        ((max - value) / (max - min)) * plotH;

      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // Label waktu pada sumbu X.
  const ticks = [
    0,
    Math.floor((count - 1) / 2),
    count - 1
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  ctx.fillStyle = "#96a8c5";
  ctx.textAlign = "center";

  ticks.forEach(index => {
    const x = pad.left +
      (count <= 1 ? plotW / 2 : index / (count - 1) * plotW);

    ctx.fillText(labels[index] || "", x, height - 8);
  });
}

function renderCharts() {
  drawLineChart(
    powerCanvas,
    powerCtx,
    [
      {
        values: historyData.powerA,
        color: "#42d392"
      },
      {
        values: historyData.powerB,
        color: "#ff9b57"
      }
    ],
    historyData.labels
  );

  drawLineChart(
    tempCanvas,
    tempCtx,
    [
      {
        values: historyData.temperature,
        color: "#ff9b57"
      }
    ],
    historyData.labels
  );
}

function renderDashboard(raw) {
  const a = normalizePanel(raw.panelA);
  const b = normalizePanel(raw.panelB);
  const temperature = Number(raw.temperatureB);

  if (!Number.isFinite(temperature)) {
    throw new Error("Data suhu belum tersedia.");
  }

  // Nilai Panel A.
  $("powerA").textContent = format(a.power, 1);
  $("voltageA").textContent = format(a.voltage, 2);
  $("currentA").textContent = format(a.current, 2);

  // Nilai Panel B.
  $("powerB").textContent = format(b.power, 1);
  $("voltageB").textContent = format(b.voltage, 2);
  $("currentB").textContent = format(b.current, 2);

  // Suhu panel uji.
  $("temperatureB").textContent = format(temperature, 1);

  // Persentase perubahan daya terhadap panel referensi.
  const drop = a.power > 0
    ? ((a.power - b.power) / a.power) * 100
    : 0;

  $("powerDrop").textContent = format(drop, 1);

  $("barPowerA").textContent = `${format(a.power, 1)} W`;
  $("barPowerB").textContent = `${format(b.power, 1)} W`;

  const largest = Math.max(a.power, b.power, 0.01);

  $("barA").style.width =
    `${Math.max(0, a.power / largest * 100)}%`;

  $("barB").style.width =
    `${Math.max(0, b.power / largest * 100)}%`;

  // Indikasi awal, bukan diagnosis pasti shading.
  const dropTag = $("dropTag");

  if (drop >= 20) {
    dropTag.textContent = "Selisih tinggi";
    dropTag.className = "tag tag-orange";

    $("diagnosis").textContent =
      "Daya panel uji jauh lebih rendah daripada referensi. " +
      "Periksa shading dan pastikan kondisi pengujian sebanding.";
  } else if (drop >= 8) {
    dropTag.textContent = "Perlu diperiksa";
    dropTag.className = "tag tag-orange";

    $("diagnosis").textContent =
      "Terdapat perbedaan daya. Periksa intensitas cahaya, " +
      "orientasi, koneksi, suhu, dan kemungkinan shading.";
  } else {
    dropTag.textContent = "Selisih kecil";
    dropTag.className = "tag tag-green";

    $("diagnosis").textContent =
      "Daya kedua panel relatif berdekatan. " +
      "Tetap perhatikan kondisi cahaya dan hasil pengukuran.";
  }

  // Indikator suhu sederhana, bukan batas keselamatan universal.
  if (temperature >= 50) {
    $("temperatureStatus").textContent =
      "Suhu tinggi — periksa panel dan sensor";
    $("temperatureStatus").style.color = "var(--orange)";
  } else {
    $("temperatureStatus").textContent =
      "Pemantauan suhu aktif";
    $("temperatureStatus").style.color = "var(--muted)";
  }

  const now = new Date();

  $("lastUpdate").textContent =
    now.toLocaleTimeString("id-ID");

  historyData.labels.push(
    now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  );

  historyData.powerA.push(a.power);
  historyData.powerB.push(b.power);
  historyData.temperature.push(temperature);

  // Simpan maksimal 20 titik data untuk grafik.
  const maxPoints = 20;

  Object.keys(historyData).forEach(key => {
    while (historyData[key].length > maxPoints) {
      historyData[key].shift();
    }
  });

  renderCharts();
}

async function refresh() {
  try {
    const data = await getData();
    renderDashboard(data);

    setConnection(
      true,
      SIMULATION_MODE ? "Mode simulasi" : "ESP32 terhubung"
    );
  } catch (error) {
    setConnection(false, "Koneksi bermasalah");

    $("diagnosis").textContent =
      `Data belum terbaca: ${error.message}. ` +
      "Periksa Wi-Fi, alamat ESP32, dan format JSON.";
  }
}

// Jalankan saat halaman dibuka, lalu perbarui setiap 2,5 detik.
refresh();
setInterval(refresh, 2500);

window.addEventListener("resize", renderCharts);
