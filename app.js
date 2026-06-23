/* ==========================================================================
   MEDIA VAULT — USER PANEL LOGIC
   by LUCIUS DEVELOPER
   ========================================================================== */

// ---------------------------------------------------------------------------
// 1. FIREBASE SDK IMPORTS (Modular v10 — loaded directly from CDN, no build step)
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// 2. PASTE YOUR FIREBASE CONFIG HERE
//    Get this object from: Firebase Console > Project Settings > General > Your Apps
// ---------------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCh2T1zkd5zGiLJFI1ywcvIvwZSDSpVPHM",
    authDomain: "azvish-saver.firebaseapp.com",
    projectId: "azvish-saver",
    storageBucket: "azvish-saver.firebasestorage.app",
    messagingSenderId: "150312931059",
    appId: "1:150312931059:web:01efa209196340f7e33186"
  };

// ---------------------------------------------------------------------------
// 3. INIT
// ---------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// 4. CACHING CONFIG — keeps the app inside the Firebase Spark (free) plan
//    by avoiding a Firestore read on every single page load.
// ---------------------------------------------------------------------------
const CACHE_KEY = "luciusVault_mediaCache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// 5. THEME ENGINE — 10 total themes, shared key with admin.js
// ---------------------------------------------------------------------------
const THEME_KEY = "luciusVault_theme";
const THEMES = [
  { id: "dark",    name: "Dark Luxury",    swatch: ["#B026FF", "#00D9FF"] },
  { id: "light",   name: "Light Elegance", swatch: ["#8A2BE2", "#0099CC"] },
  { id: "midnight",name: "Midnight Blue",  swatch: ["#5B8DEF", "#00B4FF"] },
  { id: "crimson", name: "Crimson Noir",   swatch: ["#FF3B5C", "#FF8C42"] },
  { id: "emerald", name: "Emerald Matrix", swatch: ["#00FF85", "#39FF14"] },
  { id: "gold",    name: "Royal Gold",     swatch: ["#FFD700", "#1E3A8A"] },
  { id: "vapor",   name: "Sunset Vapor",   swatch: ["#FF6AD5", "#00F5FF"] },
  { id: "frost",   name: "Ocean Frost",    swatch: ["#5EEAD4", "#38BDF8"] },
  { id: "mono",    name: "Graphite Mono",  swatch: ["#C7C7CC", "#9A9AA2"] },
  { id: "holo3d",  name: "Holo 3D",        swatch: ["#00FFE0", "#FF2D87"] }
];

// In-memory state
let allMedia = [];
let activeFilter = "all";
let activeSearch = "";

// ---------------------------------------------------------------------------
// DOM REFS
// ---------------------------------------------------------------------------
const authScreen = document.getElementById("authScreen");
const mainApp = document.getElementById("mainApp");

const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const loginPanel = document.getElementById("loginPanel");
const signupPanel = document.getElementById("signupPanel");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSuccess = document.getElementById("loginSuccess");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

const signupForm = document.getElementById("signupForm");
const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupError = document.getElementById("signupError");
const signupSubmitBtn = document.getElementById("signupSubmitBtn");

const userEmailChip = document.getElementById("userEmailChip");
const logoutBtn = document.getElementById("logoutBtn");

const skeletonGrid = document.getElementById("skeletonGrid");
const mediaGrid = document.getElementById("mediaGrid");
const emptyState = document.getElementById("emptyState");
const emptyStateText = document.getElementById("emptyStateText");
const filterTabs = document.getElementById("filterTabs");
const searchInput = document.getElementById("searchInput");

const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");
const themeGrid = document.getElementById("themeGrid");
const activeThemeLabel = document.getElementById("activeThemeLabel");

const appBanner = document.getElementById("appBanner");
const closeBanner = document.getElementById("closeBanner");

const detailsModal = document.getElementById("detailsModal");
const detailsContent = document.getElementById("detailsContent");
const closeDetailsModal = document.getElementById("closeDetailsModal");

const footerYear = document.getElementById("footerYear");
if (footerYear) footerYear.textContent = new Date().getFullYear();

// ===========================================================================
// AUTH TAB SWITCHING (Login <-> Sign Up)
// ===========================================================================
function switchAuthTab(target) {
  [tabLogin, tabSignup].forEach((t) => {
    const isActive = t.dataset.target === target;
    t.classList.toggle("active", isActive);
    t.setAttribute("aria-selected", String(isActive));
  });
  loginPanel.classList.toggle("active", target === "loginPanel");
  signupPanel.classList.toggle("active", target === "signupPanel");
}
tabLogin.addEventListener("click", () => switchAuthTab("loginPanel"));
tabSignup.addEventListener("click", () => switchAuthTab("signupPanel"));

// ===========================================================================
// PASSWORD VISIBILITY TOGGLE
// ===========================================================================
document.querySelectorAll(".toggle-visibility").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.input);
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    btn.classList.toggle("active", isPassword);
  });
});

// ===========================================================================
// AUTHENTICATION
// ===========================================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    authScreen.classList.add("hidden");
    mainApp.classList.remove("hidden");
    userEmailChip.textContent = user.displayName || user.email || "";
    loadMedia();
  } else {
    mainApp.classList.add("hidden");
    authScreen.classList.remove("hidden");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  loginSuccess.classList.add("hidden");
  setBtnLoading(loginSubmitBtn, true, "Signing In...");

  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
  } catch (err) {
    loginError.textContent = friendlyAuthError(err.code);
    loginError.classList.remove("hidden");
  } finally {
    setBtnLoading(loginSubmitBtn, false, "Sign In");
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.classList.add("hidden");
  setBtnLoading(signupSubmitBtn, true, "Creating Account...");

  try {
    const cred = await createUserWithEmailAndPassword(auth, signupEmail.value.trim(), signupPassword.value);
    if (signupName.value.trim()) {
      await updateProfile(cred.user, { displayName: signupName.value.trim() });
    }
  } catch (err) {
    signupError.textContent = friendlyAuthError(err.code);
    signupError.classList.remove("hidden");
  } finally {
    setBtnLoading(signupSubmitBtn, false, "Create Account");
  }
});

forgotPasswordBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  loginError.classList.add("hidden");
  loginSuccess.classList.add("hidden");

  if (!email) {
    loginError.textContent = "Enter your email above first, then tap 'Forgot password?'.";
    loginError.classList.remove("hidden");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    loginSuccess.textContent = "Password reset email sent. Please check your inbox.";
    loginSuccess.classList.remove("hidden");
  } catch (err) {
    loginError.textContent = friendlyAuthError(err.code);
    loginError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", () => {
  signOut(auth);
  settingsMenu.classList.add("hidden");
});

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again."
  };
  return map[code] || "Something went wrong. Please check your details and try again.";
}

function setBtnLoading(btn, isLoading, label) {
  btn.disabled = isLoading;
  btn.querySelector(".btn-text").textContent = label;
}

// ===========================================================================
// SKELETON LOADER
// ===========================================================================
function renderSkeletons(count = 8) {
  skeletonGrid.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton-card";
    sk.innerHTML = `
      <div class="skeleton-thumb"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    `;
    skeletonGrid.appendChild(sk);
  }
}
renderSkeletons();

// ===========================================================================
// DATA LOADING — cache-first strategy
// ===========================================================================
async function loadMedia() {
  skeletonGrid.classList.remove("hidden");
  mediaGrid.classList.add("hidden");

  const cached = readCache();
  if (cached) {
    allMedia = cached;
    finishLoading();
    return;
  }

  try {
    const mediaRef = collection(db, "media");
    const q = query(mediaRef, orderBy("uploadDate", "desc"));
    const snap = await getDocs(q);
    allMedia = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    writeCache(allMedia);
  } catch (err) {
    console.error("Failed to load media from Firestore:", err);
    allMedia = [];
  }
  finishLoading();
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp || Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch { /* fail silently */ }
}

function finishLoading() {
  skeletonGrid.classList.add("hidden");
  mediaGrid.classList.remove("hidden");
  applyFiltersAndRender();
}

// ===========================================================================
// FILTERING
// ===========================================================================
function applyFiltersAndRender() {
  let filtered = allMedia;
  if (activeFilter !== "all") filtered = filtered.filter((item) => item.category === activeFilter);
  if (activeSearch.trim() !== "") {
    const term = activeSearch.trim().toLowerCase();
    filtered = filtered.filter((item) => (item.title || "").toLowerCase().includes(term));
  }
  renderGrid(filtered);
}

filterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-tab");
  if (!btn) return;
  filterTabs.querySelectorAll(".filter-tab").forEach((t) => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });
  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");
  activeFilter = btn.dataset.filter;
  applyFiltersAndRender();
});

let searchDebounce;
searchInput.addEventListener("input", (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    activeSearch = e.target.value;
    applyFiltersAndRender();
  }, 150);
});

// ===========================================================================
// RENDERING
// ===========================================================================
function renderGrid(items) {
  mediaGrid.innerHTML = "";

  if (!items.length) {
    emptyState.classList.remove("hidden");
    emptyStateText.textContent = allMedia.length === 0
      ? "The vault is currently empty. Check back soon!"
      : "There's nothing in the vault that matches your filters yet.";
    return;
  }
  emptyState.classList.add("hidden");

  items.forEach((item, idx) => mediaGrid.appendChild(buildCard(item, idx)));
  attachTiltHandlers(mediaGrid.querySelectorAll(".media-card"));
}

function buildCard(item, idx) {
  const card = document.createElement("div");
  card.className = "media-card";
  card.style.animationDelay = `${Math.min(idx * 0.04, 0.4)}s`;
  card.dataset.id = item.id;

  card.innerHTML = `
    <div class="media-thumb">
      <span class="category-badge badge-${item.category}">${escapeHtml(item.category)}</span>
      ${buildThumbInner(item)}
      <div class="card-glare"></div>
      <div class="card-menu">
        <button class="dots-btn" aria-label="Open menu" aria-haspopup="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
        </button>
        <div class="dropdown-menu">
          <button class="dropdown-item action-download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download
          </button>
          <button class="dropdown-item action-details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Details
          </button>
        </div>
      </div>
    </div>
    <div class="media-body">
      <p class="media-title">${escapeHtml(item.title || "Untitled")}</p>
      <div class="media-meta">
        <span>${formatBytes(item.size)}</span>
        <span>&middot;</span>
        <span>${formatDate(item.uploadDate)}</span>
      </div>
    </div>
  `;
  return card;
}

function buildThumbInner(item) {
  if (item.category === "Thumbnail") {
    return `<img src="${escapeAttr(item.fileUrl)}" alt="${escapeAttr(item.title || "Thumbnail preview")}" loading="lazy">`;
  }
  if (item.category === "Audio") {
    let bars = "";
    for (let i = 0; i < 18; i++) {
      const delay = (Math.random() * 1.2).toFixed(2);
      const height = 10 + Math.round(Math.random() * 10);
      bars += `<span style="animation-delay:${delay}s; height:${height}px;"></span>`;
    }
    return `<div class="waveform">${bars}</div>`;
  }
  return `<div class="play-overlay"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg></div>`;
}

// ===========================================================================
// 3D TILT EFFECT — drives the "Holo 3D" theme (harmless under other themes)
// ===========================================================================
function attachTiltHandlers(cards) {
  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (px - 0.5) * 18;   // rotateY range
      const ry = (0.5 - py) * 18;   // rotateX range
      card.style.setProperty("--rx", `${rx}deg`);
      card.style.setProperty("--ry", `${ry}deg`);
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
    });
    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--rx", `0deg`);
      card.style.setProperty("--ry", `0deg`);
    });
  });
}

// ===========================================================================
// 3-DOT DROPDOWN MENU
// ===========================================================================
mediaGrid.addEventListener("click", (e) => {
  const dotsBtn = e.target.closest(".dots-btn");
  if (dotsBtn) {
    const menu = dotsBtn.nextElementSibling;
    const isOpen = menu.classList.contains("show");
    closeAllDropdowns();
    if (!isOpen) menu.classList.add("show");
    return;
  }

  const downloadBtn = e.target.closest(".action-download");
  if (downloadBtn) {
    const card = e.target.closest(".media-card");
    const item = allMedia.find((m) => m.id === card.dataset.id);
    if (item) downloadAsset(item);
    closeAllDropdowns();
    return;
  }

  const detailsBtn = e.target.closest(".action-details");
  if (detailsBtn) {
    const card = e.target.closest(".media-card");
    const item = allMedia.find((m) => m.id === card.dataset.id);
    if (item) openDetails(item);
    closeAllDropdowns();
    return;
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".card-menu")) closeAllDropdowns();
  if (!e.target.closest(".navbar-actions")) {
    settingsMenu.classList.add("hidden");
    settingsBtn.setAttribute("aria-expanded", "false");
  }
});

function closeAllDropdowns() {
  document.querySelectorAll(".dropdown-menu.show").forEach((m) => m.classList.remove("show"));
}

// ===========================================================================
// DOWNLOAD
// ===========================================================================
async function downloadAsset(item) {
  try {
    const res = await fetch(item.fileUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.fileName || item.title || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn("Direct download blocked, opening in a new tab instead:", err);
    window.open(item.fileUrl, "_blank", "noopener");
  }
}

// ===========================================================================
// DETAILS MODAL
// ===========================================================================
function openDetails(item) {
  let preview = "";
  if (item.category === "Thumbnail") {
    preview = `<div class="detail-preview"><img src="${escapeAttr(item.fileUrl)}" alt="${escapeAttr(item.title)}"></div>`;
  } else if (item.category === "Video") {
    preview = `<div class="detail-preview"><video src="${escapeAttr(item.fileUrl)}" controls preload="metadata"></video></div>`;
  } else if (item.category === "Audio") {
    preview = `<div class="detail-preview" style="padding:14px; background:var(--bg-input);"><audio src="${escapeAttr(item.fileUrl)}" controls style="width:100%;"></audio></div>`;
  }

  detailsContent.innerHTML = `
    ${preview}
    <div class="detail-row"><span>Title</span><span>${escapeHtml(item.title || "Untitled")}</span></div>
    <div class="detail-row"><span>Category</span><span>${escapeHtml(item.category)}</span></div>
    <div class="detail-row"><span>File name</span><span>${escapeHtml(item.fileName || "—")}</span></div>
    <div class="detail-row"><span>Size</span><span>${formatBytes(item.size)}</span></div>
    <div class="detail-row"><span>Uploaded</span><span>${formatDate(item.uploadDate)}</span></div>
    <div class="detail-actions">
      <button class="btn btn-primary btn-block" id="modalDownloadBtn">Download Asset</button>
    </div>
  `;
  document.getElementById("modalDownloadBtn").addEventListener("click", () => downloadAsset(item));
  detailsModal.classList.remove("hidden");
}

closeDetailsModal.addEventListener("click", () => detailsModal.classList.add("hidden"));
detailsModal.addEventListener("click", (e) => { if (e.target === detailsModal) detailsModal.classList.add("hidden"); });

// ===========================================================================
// SETTINGS MENU + THEME ENGINE (10 themes)
// ===========================================================================
function applyTheme(themeId) {
  document.documentElement.setAttribute("data-theme", themeId);
  localStorage.setItem(THEME_KEY, themeId);
  renderThemeGrid(themeId);
}

function renderThemeGrid(activeId) {
  themeGrid.innerHTML = THEMES.map((t) => `
    <button class="theme-swatch ${t.id === activeId ? "active" : ""}"
            data-theme-id="${t.id}"
            title="${escapeAttr(t.name)}"
            aria-label="${escapeAttr(t.name)} theme"
            style="background: linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]});">
    </button>
  `).join("");
  const active = THEMES.find((t) => t.id === activeId);
  activeThemeLabel.textContent = active ? active.name : "";
}

themeGrid.addEventListener("click", (e) => {
  const swatch = e.target.closest(".theme-swatch");
  if (!swatch) return;
  applyTheme(swatch.dataset.themeId);
});

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
})();

settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = settingsMenu.classList.contains("hidden");
  settingsMenu.classList.toggle("hidden");
  settingsBtn.setAttribute("aria-expanded", String(willOpen));
});

// ===========================================================================
// APP DOWNLOAD BANNER
// ===========================================================================
const BANNER_KEY = "luciusVault_bannerClosed";
if (sessionStorage.getItem(BANNER_KEY) === "1") appBanner.classList.add("hidden");
closeBanner.addEventListener("click", () => {
  appBanner.classList.add("hidden");
  sessionStorage.setItem(BANNER_KEY, "1");
});

// ===========================================================================
// HELPERS
// ===========================================================================
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "—";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function formatDate(value) {
  if (!value) return "—";
  let date;
  if (typeof value === "object" && typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }
