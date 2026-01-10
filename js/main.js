// ============================================================
// 1. INISIALISASI MAP & BASEMAP
// ============================================================
var map = L.map('map').setView([-6.931899954351185, 106.92898164923656], 10);

var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
}).addTo(map);

var esriSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles © Esri',
});

// ============================================================
// 2. LAYER GROUPS
// ============================================================
var markersLayer = L.layerGroup().addTo(map);
var polylineLayer = L.layerGroup().addTo(map);
var polygonLayer = L.layerGroup().addTo(map);
var floodPointsLayer = L.layerGroup().addTo(map);
var bufferLayer = L.layerGroup().addTo(map);
var weatherLayer = L.layerGroup().addTo(map);
var geoAiLayer = L.layerGroup().addTo(map);
var geoAiHeatmapLayer = L.layerGroup();
var adminLayer = L.layerGroup().addTo(map);
var riskAnalysisLayer = L.layerGroup().addTo(map);

// ============================================================
// 3. KONFIGURASI GLOBAL & UTILS
// ============================================================
const latCisolok = -6.94634;
const lngCisolok = 106.448544;
let sungaiGeoJson = null;

// [PENTING] Variabel Global
let globalFloodData = [];
let currentSearchData = null;

// ============================================================
// 4. FITUR GEO-AI & CUACA (Fungsi Helper)
// ============================================================

function getWeatherFromAPI(lat, lng, elementId) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,rain&timezone=Asia%2FJakarta`;

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const current = data.current;
      const rain = current.rain;
      const temp = current.temperature_2m;

      let statusHujan = 'Cerah/Berawan ☁️';
      let colorText = '#27ae60';

      if (rain > 0.5) {
        statusHujan = 'Hujan Ringan 🌦️';
        colorText = '#d35400';
      }
      if (rain > 5.0) {
        statusHujan = 'HUJAN DERAS ⛈️';
        colorText = '#c0392b';
      }

      const el = document.getElementById(`weather-${elementId}`);
      if (el) {
        el.innerHTML = `
          <div style="font-size:11px; margin-bottom:4px; border-bottom:1px solid #ddd; padding-bottom:4px;">
            <b>📡 Data Real-time (Open-Meteo):</b>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px;">
             <span>🌡️ ${temp}°C</span>
             <span>💧 ${rain} mm</span>
          </div>
          <div style="margin-top:5px; color:${colorText}; font-weight:bold; font-size:12px;">
            ${statusHujan}
          </div>
        `;
      }
    })
    .catch((err) => {
      console.error('API Error:', err);
      const el = document.getElementById(`weather-${elementId}`);
      if (el) el.innerHTML = "<small style='color:red;'>Gagal memuat data cuaca</small>";
    });
}

function updateGeoAIPrediction(rainAmount) {
  geoAiLayer.clearLayers();
  if (!sungaiGeoJson) return;

  let radiusLuapan = 0;
  let colorPrediksi = '#8e44ad';

  if (rainAmount < 0.5) radiusLuapan = 0.05;
  else if (rainAmount >= 0.5 && rainAmount < 2.0) radiusLuapan = 0.3;
  else radiusLuapan = 0.6;

  var buffered = turf.buffer(sungaiGeoJson, radiusLuapan, { units: 'kilometers' });
  L.geoJSON(buffered, {
    style: function () {
      return { color: colorPrediksi, weight: 1, fillColor: colorPrediksi, fillOpacity: 0.2, dashArray: '10, 10' };
    },
  })
    .bindPopup(`[GeoAI] Prediksi Luapan: ${radiusLuapan * 1000} meter`)
    .addTo(geoAiLayer);
}

// ============================================================
// 5, 6, 7. LOAD DATA (MAP, GADM, RISK POINTS)
// ============================================================

fetch('map (3).geojson?t=' + new Date().getTime())
  .then((r) => r.json())
  .then((data) => {
    L.geoJSON(data, {
      onEachFeature: function (feature, layer) {
        const props = feature.properties;
        const name = props.name || 'Lokasi Tanpa Nama';
        const image = props.image || 'https://via.placeholder.com/300x150';
        const status = props.status || 'Normal';

        const popupContent = `<div style="width: 200px;"><b>${name}</b><br><img src="${image}" style="width:100%; margin-top:5px;"><br>Status: ${status}</div>`;
        layer.bindPopup(popupContent);
        layer.bindTooltip(name, { direction: 'top', offset: [0, -35] });

        if (feature.geometry.type === 'Point') {
          if (name.toLowerCase().includes('banjir')) layer.addTo(floodPointsLayer);
          else layer.addTo(markersLayer);
        }
        if (feature.geometry.type === 'LineString') {
          if (name.toLowerCase().includes('sungai')) {
            layer.setStyle({ color: '#3498db', weight: 3 });
            sungaiGeoJson = feature;
          } else {
            layer.setStyle({ color: 'green', weight: 4 });
          }
          layer.addTo(polylineLayer);
        }
        if (feature.geometry.type === 'Polygon') {
          layer.setStyle({ color: '#e74c3c', fillOpacity: 0.3 });
          layer.addTo(polygonLayer);
        }
      },
    });
  })
  .catch((e) => console.error('Map Error:', e));

fetch('gadm41_IDN_3 (1).json')
  .then((r) => r.json())
  .then((data) => {
    L.geoJSON(data, {
      style: function () {
        return { color: '#000', weight: 1.5, fillColor: 'blue', fillOpacity: 0, dashArray: '4, 4' };
      },
      onEachFeature: function (f, l) {
        if (f.properties) l.bindPopup(`<b>Kecamatan:</b> ${f.properties.NAME_3}`).bindTooltip(f.properties.NAME_3, { sticky: true, direction: 'center' });
      },
    }).addTo(adminLayer);
  })
  .catch((e) => console.error('GADM Error:', e));

fetch('banjir_risk_point.json?t=' + new Date().getTime())
  .then((r) => r.json())
  .then((data) => {
    globalFloodData = data.features;
    var heatMapPoints = [];

    L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        var status = feature.properties.status || '';
        var colorCode = '#2ecc71';
        var animClass = '';
        var intensity = 0.2;
        if (status.includes('Merah')) {
          colorCode = '#e74c3c';
          animClass = 'animasi-alert';
          intensity = 1.0;
        } else if (status.includes('Kuning')) {
          colorCode = '#f39c12';
          animClass = 'animasi-alert';
          intensity = 0.6;
        }

        heatMapPoints.push([latlng.lat, latlng.lng, intensity]);

        return L.circleMarker(latlng, { radius: 10, fillColor: colorCode, color: colorCode, weight: 2, opacity: 1, fillOpacity: 0.8, className: animClass });
      },
      onEachFeature: function (feature, layer) {
        var p = feature.properties;
        var coords = feature.geometry.coordinates;
        layer._customId = p.kecamatan.toLowerCase();

        var imageSrc = p.gambar && p.gambar !== '' ? p.gambar : 'https://via.placeholder.com/300x150?text=No+Image';
        var kontenPopup = `
          <div style="font-family: Arial, sans-serif; min-width: 260px;">
            <div style="width: 100%; height: 150px; overflow: hidden; border-radius: 8px; margin-bottom: 10px; background: #eee;">
               <img src="${imageSrc}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <h3 style="margin: 0; color: #2c3e50; font-size: 16px;">${p.kecamatan}</h3>
            <span style="background:${p.status.includes('Merah') ? '#e74c3c' : p.status.includes('Kuning') ? '#f39c12' : '#2ecc71'}; color:white; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold;">${p.status}</span>
            <div id="weather-${p.kecamatan.replace(/\s/g, '')}" style="margin: 10px 0; padding: 10px; background: #f0f8ff; border-radius: 6px;">⏳ Cuaca...</div>
            <div style="font-size: 12px; color: #444;"><strong>Penyebab:</strong> ${p.penyebab}</div>
          </div>`;

        layer.bindPopup(kontenPopup);
        layer.bindTooltip(p.kecamatan, { direction: 'top', offset: [0, -10] });
        layer.on('popupopen', function () {
          getWeatherFromAPI(coords[1], coords[0], p.kecamatan.replace(/\s/g, ''));
        });
      },
    }).addTo(riskAnalysisLayer);

    if (heatMapPoints.length > 0) {
      var heat = L.heatLayer(heatMapPoints, { radius: 35, blur: 20, maxZoom: 12, gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' } });
      geoAiHeatmapLayer.addLayer(heat);
    }
  })
  .catch((e) => console.error('Risk Data Error:', e));

// ============================================================
// 8. LOGIKA PENCARIAN (SIDEBAR)
// ============================================================

function searchLocation() {
  var input = document.getElementById('search-input').value.toLowerCase();
  var resultBox = document.getElementById('search-result');
  var foundData = globalFloodData.find((item) => item.properties.kecamatan.toLowerCase().includes(input));

  if (foundData) {
    currentSearchData = foundData;
    var p = foundData.properties;
    var coords = foundData.geometry.coordinates;

    map.flyTo([coords[1], coords[0]], 14, { animate: true, duration: 1.5 });

    document.getElementById('res-nama').innerText = p.kecamatan;
    document.getElementById('res-lat').innerText = coords[1].toFixed(5);
    document.getElementById('res-lng').innerText = coords[0].toFixed(5);
    document.getElementById('res-desc').innerText = p.lokasi_spesifik;

    var imgUrl = p.gambar && p.gambar !== '' ? p.gambar : 'https://via.placeholder.com/300x150?text=No+Image';
    document.getElementById('res-img').src = imgUrl;

    var statusBadge = document.getElementById('res-status');
    statusBadge.innerText = p.status;
    if (p.status.includes('Merah')) statusBadge.style.background = '#e74c3c';
    else if (p.status.includes('Kuning')) statusBadge.style.background = '#f39c12';
    else statusBadge.style.background = '#2ecc71';

    // Widget Cuaca Sidebar
    var weatherBox = document.getElementById('res-weather');
    weatherBox.innerHTML = '⏳ Mengambil data cuaca...';
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords[1]}&longitude=${coords[0]}&current=temperature_2m,rain&timezone=Asia%2FJakarta`)
      .then((r) => r.json())
      .then((data) => {
        let h = 'Cerah ☁️',
          c = 'green';
        if (data.current.rain > 0.5) {
          h = 'Hujan 🌦️';
          c = 'orange';
        }
        if (data.current.rain > 5.0) {
          h = 'HUJAN DERAS ⛈️';
          c = 'red';
        }
        weatherBox.innerHTML = `<div style="font-weight:bold;">Cuaca: ${h}</div><div>🌡️ ${data.current.temperature_2m}°C | 💧 ${data.current.rain}mm</div>`;
      })
      .catch(() => (weatherBox.innerHTML = '❌ Gagal load cuaca'));

    resultBox.style.display = 'block';

    // Reset AI Box
    document.getElementById('ai-response').style.display = 'none';
    document.getElementById('btn-ask-ai').disabled = false;
    document.getElementById('btn-ask-ai').innerText = '✨ Analisis Risiko Sekarang';

    riskAnalysisLayer.eachLayer((l) => {
      if (l._customId && l._customId.includes(input)) l.openPopup();
    });
  } else {
    alert('Lokasi tidak ditemukan! Pastikan nama kecamatan benar.');
  }
}

function resetSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-result').style.display = 'none';
  map.setView([-6.931899954351185, 106.92898164923656], 10);
  map.closePopup();
  currentSearchData = null;
}

document.getElementById('search-input').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') searchLocation();
});

// ============================================================
// 11. FITUR CHATBOT AI (FLOATING WIDGET) - FIXED
// ============================================================

function toggleChat() {
  const box = document.getElementById('chatbot-box');
  if (box.style.display === 'none' || box.style.display === '') {
    box.style.display = 'flex';
    setTimeout(() => document.getElementById('chat-input').focus(), 100);
  } else {
    box.style.display = 'none';
  }
}

function handleChatEnter(e) {
  if (e.key === 'Enter') sendChatMessage();
}

async function sendChatMessage() {
  const inputField = document.getElementById('chat-input');
  const messageArea = document.getElementById('chat-messages');
  const userText = inputField.value.trim();

  // Pastikan API Key ini benar. (Gunakan yang lama jika yang baru ini error)
  const apiKey = 'AIzaSyAWcmpMCpb4kjicPtz9J8VjpcUH6fOYxs0';

  if (!userText) return;

  // 1. Tampilkan Pesan User
  messageArea.innerHTML += `<div class="message user-msg">${userText}</div>`;
  inputField.value = '';
  messageArea.scrollTop = messageArea.scrollHeight;

  // 2. Tampilkan Loading
  const loadingId = 'loading-' + Date.now();
  messageArea.innerHTML += `<div id="${loadingId}" class="message bot-msg" style="color:#888;">⏳ Sedang mengetik...</div>`;
  messageArea.scrollTop = messageArea.scrollHeight;

  const prompt = `Jawab pertanyaan ini singkat saja (Bahasa Indonesia): "${userText}"`;

  try {
    // Kita gunakan model 'gemini-pro' (versi 1.0) yang pasti jalan
    // Kita gunakan versi 'v1' (bukan beta) dan model 'gemini-1.5-flash' (standar baru)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
      const err = await response.json();
      // Menampilkan pesan error spesifik jika gagal
      throw new Error(err.error?.message || response.statusText);
    }
    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) throw new Error('AI tidak merespon');

    const botReply = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

    document.getElementById(loadingId).remove();
    messageArea.innerHTML += `<div class="message bot-msg">${botReply}</div>`;
  } catch (err) {
    document.getElementById(loadingId).remove();
    console.error('ERROR CHATBOT:', err);
    messageArea.innerHTML += `<div class="message bot-msg" style="color:red; font-size:12px;">Error: ${err.message}</div>`;
  }

  messageArea.scrollTop = messageArea.scrollHeight;
}

// ============================================================
// 12. LAYER CONTROL
// ============================================================
var baseMaps = { 'Peta Jalan (OSM)': osm, 'Satelit (ESRI)': esriSatelite };
var overlayMaps = {
  '<span style="font-weight:bold; color:red;">🔴 Analisis Zonasi Rawan</span>': riskAnalysisLayer,
  '<span style="font-weight:bold;">Analisis Zona Buffer</span>': bufferLayer,
  '<span style="color:blue;">Info Curah Hujan (Live)</span>': weatherLayer,
  '<span style="color:purple; font-weight:bold;">[GeoAI] Prediksi Luapan</span>': geoAiLayer,
  'Batas Administrasi': adminLayer,
  '<span style="color: #e74c3c; font-weight: bold;">🔥 GeoAI: Heatmap</span>': geoAiHeatmapLayer,
};
L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);
