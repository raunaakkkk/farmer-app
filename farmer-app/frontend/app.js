const PROD_API_BASE = window.FARMER_API_BASE || "";
const API_PORTS = [8000, 8010];
let currentApiPortIndex = 0;
function getApiBase() {
  if (PROD_API_BASE) return PROD_API_BASE.replace(/\/$/, "");
  return `http://127.0.0.1:${API_PORTS[currentApiPortIndex]}/api`;
}

async function apiFetch(path, options) {
  const url = `${getApiBase()}${path}`;
  try {
    return await fetch(url, options);
  } catch (e) {
    if (!PROD_API_BASE && currentApiPortIndex === 0) {
      currentApiPortIndex = 1;
      const fallbackUrl = `${getApiBase()}${path}`;
      return await fetch(fallbackUrl, options);
    }
    throw e;
  }
}
let currentLang = localStorage.getItem("lang") || "hi";
let allDiseases = [];
let latestCropResults = [];

const translations = {
  en: {
    appTitle: "Farmer Assistant",
    weather: "Weather",
    crops: "Crops",
    voice: "Voice",
    schemes: "Schemes",
    disease: "Disease",
    fetchingLocation: "Fetching location...",
    loadingWeather: "Loading weather...",
    getRecommendations: "Get Recommendations",
    sortBy: "Sort by:",
    bestYield: "Best Yield",
    bestPrice: "Best Price",
    waterEfficient: "Water Efficient",
    tapToSpeak: "Tap mic to speak",
    askNow: "Ask Now",
    eligibilityChecker: "Eligibility Checker",
    hasBankAccount: "Has bank account",
    checkEligibility: "Check Eligibility",
    uploadPrompt: "Tap or drop image here",
    detectDisease: "Detect Disease",
  },
  hi: {
    appTitle: "किसान सहायक",
    weather: "मौसम",
    crops: "फसल",
    voice: "आवाज",
    schemes: "योजनाएं",
    disease: "रोग",
    fetchingLocation: "स्थान प्राप्त किया जा रहा है...",
    loadingWeather: "मौसम लोड हो रहा है...",
    getRecommendations: "फसल सुझाव पाएं",
    sortBy: "क्रमबद्ध करें:",
    bestYield: "उच्च उपज",
    bestPrice: "बेहतर भाव",
    waterEfficient: "कम पानी वाली",
    tapToSpeak: "बोलने के लिए माइक दबाएं",
    askNow: "अभी पूछें",
    eligibilityChecker: "पात्रता जांच",
    hasBankAccount: "बैंक खाता है",
    checkEligibility: "पात्रता जांचें",
    uploadPrompt: "यहां फोटो टैप या ड्रॉप करें",
    detectDisease: "रोग पहचानें",
  },
  pa: {
    appTitle: "ਕਿਸਾਨ ਸਹਾਇਕ",
    weather: "ਮੌਸਮ",
    crops: "ਫਸਲਾਂ",
    voice: "ਆਵਾਜ਼",
    schemes: "ਯੋਜਨਾਵਾਂ",
    disease: "ਬਿਮਾਰੀ",
    fetchingLocation: "ਥਾਂ ਲਿਆ ਜਾ ਰਿਹਾ ਹੈ...",
    loadingWeather: "ਮੌਸਮ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...",
    getRecommendations: "ਸਿਫਾਰਸ਼ ਲਓ",
    sortBy: "ਕ੍ਰਮ:",
    bestYield: "ਵਧੀਆ ਪੈਦਾਵਾਰ",
    bestPrice: "ਵਧੀਆ ਕੀਮਤ",
    waterEfficient: "ਘੱਟ ਪਾਣੀ",
    tapToSpeak: "ਬੋਲਣ ਲਈ ਮਾਈਕ ਦਬਾਓ",
    askNow: "ਹੁਣ ਪੁੱਛੋ",
    eligibilityChecker: "ਯੋਗਤਾ ਜਾਂਚ",
    hasBankAccount: "ਬੈਂਕ ਖਾਤਾ ਹੈ",
    checkEligibility: "ਯੋਗਤਾ ਚੈਕ ਕਰੋ",
    uploadPrompt: "ਇੱਥੇ ਫੋਟੋ ਟੈਪ ਜਾਂ ਡ੍ਰਾਪ ਕਰੋ",
    detectDisease: "ਬਿਮਾਰੀ ਪਛਾਣੋ",
  },
};

const SOILS = ["Loamy", "Clay", "Sandy", "Black", "Alluvial", "Red/Laterite", "Clay/Clayey", "Black/Regur"];
const SEASONS = ["Rabi", "Kharif", "Zaid", "All", "Annual"];
const STATES = ["Punjab", "Haryana", "Uttar Pradesh", "Bihar", "West Bengal", "Madhya Pradesh", "Rajasthan", "Maharashtra", "Gujarat", "Andhra Pradesh", "Karnataka", "Telangana", "Tamil Nadu", "Odisha", "Kerala", "Assam"];

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || translations.en[key] || key;
}

function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.background = isError ? "#c1121f" : "#2d2d2d";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2800);
}

function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang);
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
}

function navigate(tab) {
  document.querySelectorAll(".tab-page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById(tab).classList.add("active");
  document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add("active");
}

function populateDropdowns() {
  const fill = (id, list, label) => {
    const el = document.getElementById(id);
    el.innerHTML = `<option value="">${label}</option>` + list.map((x) => `<option value="${x}">${x}</option>`).join("");
  };
  fill("soilType", SOILS, "Soil Type");
  fill("season", SEASONS, "Season");
  fill("state", STATES, "State");
  fill("stateEligibility", STATES, "State");
}

function updateTime() {
  const now = new Date();
  document.getElementById("timeDisplay").textContent = now.toLocaleString();
}

async function getWeather(lat, lon, mini = false) {
  const targetCurrent = mini ? document.getElementById("miniWeather") : document.getElementById("weatherCurrent");
  try {
    targetCurrent.innerHTML = `<p>${t("loadingWeather")}</p>`;
    const res = await apiFetch(`/weather?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Weather error");
    const cur = data.weather.current;
    const daily = data.weather.daily;
    targetCurrent.className = `card status-${data.status}`;
    targetCurrent.innerHTML = `
      <h3>${t("weather")}</h3>
      <p>Temp: ${cur.temperature_2m}°C | Humidity: ${cur.relative_humidity_2m}%</p>
      <p>Wind: ${cur.windspeed_10m} km/h | Rain: ${daily.precipitation_probability_max[0]}%</p>
    `;

    if (!mini) {
      const cards = document.getElementById("forecastCards");
      cards.innerHTML = daily.time.map((d, i) => `
        <div class="card">
          <strong>${d}</strong>
          <p>Max: ${daily.temperature_2m_max[i]}°C | Min: ${daily.temperature_2m_min[i]}°C</p>
          <p>Rain Prob: ${daily.precipitation_probability_max[i]}%</p>
        </div>
      `).join("");
      const advice = data.advice;
      document.getElementById("weatherAdvice").innerHTML = `
        <h3>${currentLang === "hi" ? "खेती सलाह" : "Farming Advice"}</h3>
        <p>${currentLang === "hi" ? advice.advice_hi : advice.advice_en}</p>
        <p><strong>Crop Action:</strong> ${advice.crop_action}</p>
        <p><strong>Irrigation:</strong> ${advice.irrigation_advice}</p>
      `;
    }
  } catch (err) {
    targetCurrent.innerHTML = `<p>${String(err)}</p>`;
    showToast(String(err), true);
  }
}

function detectLocationAndWeather() {
  if (!navigator.geolocation) {
    showToast("Geolocation not supported", true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      document.getElementById("locationDisplay").textContent = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
      getWeather(latitude, longitude, true);
      getWeather(latitude, longitude, false);
    },
    () => showToast("Location permission denied", true)
  );
}

function renderCropResults() {
  const list = document.getElementById("cropResults");
  const sortBy = document.getElementById("cropSort").value;
  const rows = [...latestCropResults];
  if (sortBy === "yield") rows.sort((a, b) => parseFloat((b.expected_yield_qtl || "0").split("-")[0]) - parseFloat((a.expected_yield_qtl || "0").split("-")[0]));
  if (sortBy === "price") rows.sort((a, b) => b.market_price_max - a.market_price_max);
  if (sortBy === "water") {
    const rank = { "Low": 1, "Medium": 2, "High": 3, "Very High": 4 };
    rows.sort((a, b) => (rank[a.water_need] || 9) - (rank[b.water_need] || 9));
  }
  list.innerHTML = rows.map((c) => `
    <div class="card">
      <h3>${c.name_hi} (${c.name_en})</h3>
      <p>Yield: ${c.expected_yield_qtl} qtl/acre</p>
      <p>Water: ${c.water_need} | Days: ${c.growing_days}</p>
      <p>Price: Rs ${c.market_price_min} - ${c.market_price_max} / qtl</p>
      <p>Fertilizer: ${c.fertilizer}</p>
    </div>
  `).join("") || `<div class="card">No crops found</div>`;
}

async function fetchSchemes() {
  const wrap = document.getElementById("schemesList");
  wrap.innerHTML = `<div class="card">Loading...</div>`;
  try {
    const res = await apiFetch(`/schemes`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Scheme fetch failed");
    wrap.innerHTML = data.results.map((s) => `
      <details class="card scheme-card">
        <summary>${currentLang === "hi" ? s.name_hi : s.name_en}</summary>
        <p>${currentLang === "hi" ? s.benefit_hi : s.benefit_en}</p>
        <p>${currentLang === "hi" ? s.eligibility_hi : s.eligibility_en}</p>
        <span class="badge">${s.amount} | ${s.frequency}</span>
        <p><a href="${s.official_url}" target="_blank" rel="noreferrer">आवेदन करें</a></p>
      </details>
    `).join("");
  } catch (err) {
    wrap.innerHTML = `<div class="card">${String(err)}</div>`;
  }
}

async function fetchDiseases() {
  try {
    const res = await apiFetch(`/diseases`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Disease fetch failed");
    allDiseases = data.results;
    renderDiseaseList(allDiseases);
  } catch (err) {
    showToast(String(err), true);
  }
}

function renderDiseaseList(rows) {
  document.getElementById("diseaseList").innerHTML = rows.map((d) => `
    <div class="card">
      <strong>${d.name_hi} (${d.name_en})</strong>
      <p>${currentLang === "hi" ? d.symptoms_hi : d.symptoms_en}</p>
      <span class="badge">${d.severity}</span>
    </div>
  `).join("");
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = currentLang === "hi" ? "hi-IN" : currentLang === "pa" ? "pa-IN" : "en-IN";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

async function sendVoiceQuery(text) {
  try {
    document.getElementById("voiceResponse").innerHTML = "Loading...";
    const res = await apiFetch(`/voice/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: currentLang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Voice query failed");
    document.getElementById("voiceResponse").innerHTML = `<p>${data.response_text}</p>`;
    speakText(data.audio_friendly_text || data.response_text);
  } catch (err) {
    showToast(String(err), true);
  }
}

function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById("voiceStatus").textContent = "Speech recognition not supported.";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = currentLang === "hi" ? "hi-IN" : currentLang === "pa" ? "pa-IN" : "en-IN";
  recognition.interimResults = false;

  document.getElementById("micBtn").addEventListener("click", () => {
    recognition.start();
    document.getElementById("voiceStatus").textContent = "Listening...";
  });
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    document.getElementById("transcriptText").textContent = transcript;
    sendVoiceQuery(transcript);
    document.getElementById("voiceStatus").textContent = t("tapToSpeak");
  };
  recognition.onerror = () => {
    document.getElementById("voiceStatus").textContent = t("tapToSpeak");
  };
}

function bindEvents() {
  document.querySelectorAll(".lang-btn").forEach((btn) => btn.addEventListener("click", () => switchLanguage(btn.dataset.lang)));
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.addEventListener("click", () => navigate(btn.dataset.tab)));
  document.querySelectorAll(".feature-tile").forEach((btn) => btn.addEventListener("click", () => navigate(btn.dataset.target)));

  document.getElementById("cropForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      soil_type: document.getElementById("soilType").value,
      season: document.getElementById("season").value,
      state: document.getElementById("state").value,
    };
    try {
      document.getElementById("cropResults").innerHTML = `<div class="card">Loading...</div>`;
      const res = await apiFetch(`/crops/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Crop recommendation failed");
      latestCropResults = data.results || [];
      renderCropResults();
      showToast("Recommendations loaded");
    } catch (err) {
      showToast(String(err), true);
    }
  });

  document.getElementById("cropSort").addEventListener("change", renderCropResults);
  document.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => sendVoiceQuery(chip.textContent)));
  document.getElementById("sendTypedQuery").addEventListener("click", () => {
    const v = document.getElementById("typedQuery").value.trim();
    if (v) sendVoiceQuery(v);
  });

  document.getElementById("eligibilityForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      land_hectares: parseFloat(document.getElementById("landInput").value),
      annual_income: parseFloat(document.getElementById("incomeInput").value),
      state: document.getElementById("stateEligibility").value,
      has_bank_account: document.getElementById("bankAccountInput").checked,
    };
    const target = document.getElementById("eligibilityResults");
    target.innerHTML = `<div class="card">Loading...</div>`;
    try {
      const res = await apiFetch(`/schemes/check-eligibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Eligibility check failed");
      target.innerHTML = data.eligible_schemes.map((s) => `
        <div class="card eligible">
          <strong>${currentLang === "hi" ? s.scheme_hi : s.scheme}</strong>
          <p>${currentLang === "hi" ? s.reason_hi : s.reason_en}</p>
        </div>
      `).join("") || `<div class="card">No matching schemes</div>`;
      showToast("Eligibility checked");
    } catch (err) {
      target.innerHTML = `<div class="card">${String(err)}</div>`;
      showToast(String(err), true);
    }
  });

  const imageInput = document.getElementById("diseaseImage");
  const uploadZone = document.getElementById("uploadZone");
  const preview = document.getElementById("diseasePreview");
  uploadZone.addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  });
  uploadZone.addEventListener("dragover", (e) => e.preventDefault());
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    imageInput.files = e.dataTransfer.files;
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  });

  document.getElementById("detectBtn").addEventListener("click", async () => {
    const file = imageInput.files?.[0];
    if (!file) return showToast("Please select image", true);
    const form = new FormData();
    form.append("image", file);
    preview.classList.add("scanning");
    const target = document.getElementById("diseaseResult");
    target.innerHTML = `<div class="card">Detecting...</div>`;
    try {
      const res = await apiFetch(`/diseases/detect`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Detection failed");
      target.innerHTML = `
        <div class="card">
          <h3>${data.disease_name_hi || ""} ${data.disease_name_en ? `(${data.disease_name_en})` : ""}</h3>
          <p>Confidence: ${data.confidence || 0}%</p>
          <progress max="100" value="${data.confidence || 0}"></progress>
          <p><strong>Symptoms:</strong> ${data.symptoms || data.symptoms_en || ""}</p>
          <p><strong>Organic:</strong> ${data.organic_treatment || ""}</p>
          <p><strong>Chemical:</strong> ${data.chemical_treatment || ""}</p>
          <p><strong>Prevention:</strong> ${data.prevention || ""}</p>
          <span class="badge">${data.severity || "unknown"}</span>
        </div>
      `;
      showToast("Disease analysis complete");
    } catch (err) {
      target.innerHTML = `<div class="card">${String(err)}</div>`;
      showToast(String(err), true);
    } finally {
      preview.classList.remove("scanning");
    }
  });

  document.getElementById("diseaseSearch").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allDiseases.filter((d) =>
      d.name_en.toLowerCase().includes(q) ||
      d.name_hi.toLowerCase().includes(q) ||
      d.crop_affected.toLowerCase().includes(q)
    );
    renderDiseaseList(filtered);
  });
}

function init() {
  switchLanguage(currentLang);
  populateDropdowns();
  bindEvents();
  initVoice();
  updateTime();
  setInterval(updateTime, 1000);
  detectLocationAndWeather();
  fetchSchemes();
  fetchDiseases();
}

document.addEventListener("DOMContentLoaded", init);
