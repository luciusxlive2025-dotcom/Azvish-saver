/* ==========================================================================
   MEDIA VAULT — ADMIN PANEL LOGIC
   by CRYONEX DEVELOPER
   ========================================================================== */

// ---------------------------------------------------------------------------
// 1. FIREBASE SDK IMPORTS (No Storage Needed)
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// 2. PASTE YOUR FIREBASE & CLOUDINARY CONFIG HERE
// ---------------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCh2T1zkd5zGiLJFI1ywcvIvwZSDSpVPHM",
    authDomain: "azvish-saver.firebaseapp.com",
    projectId: "azvish-saver",
    storageBucket: "azvish-saver.firebasestorage.app",
    messagingSenderId: "150312931059",
    appId: "1:150312931059:web:01efa209196340f7e33186"
  };

// 🔴 यहाँ अपनी Cloudinary की डिटेल्स डालें 🔴
const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";
const CLOUDINARY_UPLOAD_PRESET = "YOUR_UPLOAD_PRESET";

// ---------------------------------------------------------------------------
// 2B. ADMIN ALLOWLIST
// ---------------------------------------------------------------------------
const ADMIN_EMAILS = [
  "luciusxlive2025@gmail.com"
];

// ---------------------------------------------------------------------------
// 3. INIT
// ---------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PUBLIC_CACHE_KEY = "luciusVault_mediaCache";

// Theme engine (shared visual identity)
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

let mediaCache = [];
let pendingDeleteItem = null;

// ---------------------------------------------------------------------------
// DOM REFS
// ---------------------------------------------------------------------------
const loginScreen = document.getElementById("loginScreen");
const adminApp = document.getElementById("adminApp");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSuccess = document.getElementById("loginSuccess");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const adminEmailLabel = document.getElementById("adminEmailLabel");
const logoutBtn = document.getElementById("logoutBtn");

const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");
const themeGrid = document.getElementById("themeGrid");
const activeThemeLabel = document.getElementById("activeThemeLabel");

const statTotalFiles = document.getElementById("statTotalFiles");
const statStorageUsed = document.getElementById("statStorageUsed");
const statThumbs = document.getElementById("statThumbs");
const statAV = document.getElementById("statAV");

const uploadForm = document.getElementById("uploadForm");
const uploadTitle = document.getElementById("uploadTitle");
const uploadCategory = document.getElementById("uploadCategory");
const uploadFile = document.getElementById("uploadFile");
const uploadBtn = document.getElementById("uploadBtn");
const uploadError = document.getElementById("uploadError");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");

const adminSearch = document.getElementById("adminSearch");
const mediaTableBody = document.getElementById("mediaTableBody");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editId = document.getElementById("editId");
const editTitle = document.getElementById("editTitle");
const editCategory = document.getElementById("editCategory");
const editError = document.getElementById("editError");
const closeEditModal = document.getElementById("closeEditModal");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const deleteModal = document.getElementById("deleteModal");
const deleteFileName = document.getElementById("deleteFileName");
const closeDeleteModal = document.getElementById("closeDeleteModal");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const footerYear = document.getElementById("footerYear");
if (footerYear) footerYear.textContent = new Date().getFullYear();

// ===========================================================================
// PASSWORD VISIBILITY TOGGLE
// ===========================================================================
document.querySelectorAll(".toggle-visibility").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.input);
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
});

// ===========================================================================
// AUTHENTICATION + ADMIN ALLOWLIST GATE
// ===========================================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const isAdmin = ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((user.email || "").toLowerCase());

    if (!isAdmin) {
      loginError.textContent = "This account is not authorized for admin access.";
      loginError.classList.remove("hidden");
      await signOut(auth);
      return;
    }

    loginScreen.classList.add("hidden");
    adminApp.classList.remove("hidden");
    adminEmailLabel.textContent = user.email || "";
    loadDashboard();
  } else {
    adminApp.classList.add("hidden");
    loginScreen.classList.remove("hidden");
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

forgotPasswordBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  loginError.classList.add("hidden");
  loginSuccess.classList.add("hidden");

  if (!email) {
    loginError.textContent = "Enter your admin email above first, then tap 'Forgot password?'.";
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
    "auth/user-not-found": "No admin account found with that email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again."
  };
  return map[code] || "Sign-in failed. Please check your credentials and try again.";
}

function setBtnLoading(btn, isLoading, label) {
  btn.disabled = isLoading;
  btn.querySelector(".btn-text").textContent = label;
}

// ===========================================================================
// THEME ENGINE
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
            title="${t.name}"
            aria-label="${t.name} theme"
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
document.addEventListener("click", (e) => {
  if (!e.target.closest(".navbar-actions")) {
    settingsMenu.classList.add("hidden");
    settingsBtn.setAttribute("aria-expanded", "false");
  }
});

// ===========================================================================
// DASHBOARD DATA LOAD
// ===========================================================================
async function loadDashboard() {
  mediaTableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Loading media library…</td></tr>`;
  try {
    const mediaRef = collection(db, "media");
    const q = query(mediaRef, orderBy("uploadDate", "desc"));
    const snap = await getDocs(q);
    mediaCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Failed to load media library:", err);
    mediaCache = [];
  }
  renderStats();
  renderTable(mediaCache);
  attachStatTilt();
}

function invalidatePublicCache() {
  localStorage.removeItem(PUBLIC_CACHE_KEY);
}

// ===========================================================================
// STATS
// ===========================================================================
function renderStats() {
  const totalBytes = mediaCache.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
  const thumbs = mediaCache.filter((i) => i.category === "Thumbnail").length;
  const av = mediaCache.filter((i) => i.category === "Audio" || i.category === "Video").length;

  statTotalFiles.textContent = mediaCache.length;
  statStorageUsed.textContent = formatBytes(totalBytes);
  statThumbs.textContent = thumbs;
  statAV.textContent = av;
}

function attachStatTilt() {
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty("--rx", `${(px - 0.5) * 14}deg`);
      card.style.setProperty("--ry", `${(0.5 - py) * 14}deg`);
    });
    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--rx", `0deg`);
      card.style.setProperty("--ry", `0deg`);
    });
  });
}

// ===========================================================================
// TABLE RENDER + ADMIN SEARCH
// ===========================================================================
function renderTable(items) {
  if (!items.length) {
    mediaTableBody.innerHTML = `<tr><td colspan="6" class="table-empty">No media uploaded yet. Use the form above to add your first asset.</td></tr>`;
    return;
  }

  mediaTableBody.innerHTML = items.map((item) => `
    <tr data-id="${item.id}">
      <td>${buildPreviewCell(item)}</td>
      <td class="title-cell">${escapeHtml(item.title || "Untitled")}</td>
      <td><span class="category-badge badge-${item.category}" style="position:static;">${escapeHtml(item.category)}</span></td>
      <td>${formatBytes(item.size)}</td>
      <td>${formatDate(item.uploadDate)}</td>
      <td>
        <div class="table-actions">
          <button class="action-icon-btn edit" data-action="edit" aria-label="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"></path></svg>
          </button>
          <button class="action-icon-btn delete" data-action="delete" aria-label="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function buildPreviewCell(item) {
  if (item.category === "Thumbnail") {
    return `<img src="${escapeAttr(item.fileUrl)}" class="media-table-thumb" alt="">`;
  }
  if (item.category === "Audio") {
    return `<div class="media-table-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--neon-blue);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`;
  }
  return `<div class="media-table-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--neon-red);"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg></div>`;
}

adminSearch.addEventListener("input", (e) => {
  const term = e.target.value.trim().toLowerCase();
  const filtered = term ? mediaCache.filter((i) => (i.title || "").toLowerCase().includes(term)) : mediaCache;
  renderTable(filtered);
});

mediaTableBody.addEventListener("click", (e) => {
  const row = e.target.closest("tr");
  if (!row) return;
  const id = row.dataset.id;
  const item = mediaCache.find((m) => m.id === id);
  if (!item) return;

  if (e.target.closest('[data-action="edit"]')) openEditModal(item);
  if (e.target.closest('[data-action="delete"]')) openDeleteModal(item);
});

// ===========================================================================
// UPLOAD — Direct to Cloudinary via XMLHttpRequest for Live Progress
// ===========================================================================
uploadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  uploadError.classList.add("hidden");

  const file = uploadFile.files[0];
  const title = uploadTitle.value.trim();
  const category = uploadCategory.value;

  if (!file) {
    showUploadError("Please choose a file to upload.");
    return;
  }
  startUpload(file, title, category);
});

function startUpload(file, title, category) {
  uploadBtn.disabled = true;
  progressWrap.classList.remove("hidden");
  progressFill.style.width = "0%";
  progressLabel.textContent = "0%";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  
  // Cloudinary API Endpoint (using 'auto' supports images, audio, and video)
  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const xhr = new XMLHttpRequest();
  
  xhr.open("POST", cloudinaryUrl, true);

  // Live Progress Bar Logic
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = `${pct}%`;
      progressLabel.textContent = `${pct}%`;
    }
  };

  // Upload Complete Logic
  xhr.onload = async () => {
    if (xhr.status === 200) {
      const response = JSON.parse(xhr.responseText);
      const fileUrl = response.secure_url;
      
      try {
        await addDoc(collection(db, "media"), {
          title: title || file.name,
          category,
          fileUrl, // Now saving Cloudinary URL to Firestore
          fileName: file.name,
          size: file.size,
          uploadDate: serverTimestamp()
        });
        invalidatePublicCache();
        uploadForm.reset();
        await loadDashboard();
      } catch (err) {
        console.error("Failed to save media record:", err);
        showUploadError("File uploaded, but saving its details failed. Please refresh and check the library.");
      } finally {
        resetUploadUI();
      }
    } else {
      console.error("Cloudinary Upload failed:", xhr.responseText);
      showUploadError("Upload failed! Please check your Cloudinary settings.");
      resetUploadUI();
    }
  };

  xhr.onerror = () => {
    showUploadError("Network error during upload. Please try again.");
    resetUploadUI();
  };

  xhr.send(formData);
}

function resetUploadUI() {
  uploadBtn.disabled = false;
  setTimeout(() => progressWrap.classList.add("hidden"), 600);
}

function showUploadError(msg) {
  uploadError.textContent = msg;
  uploadError.classList.remove("hidden");
}

// ===========================================================================
// EDIT (title / category only)
// ===========================================================================
function openEditModal(item) {
  editId.value = item.id;
  editTitle.value = item.title || "";
  editCategory.value = item.category;
  editError.classList.add("hidden");
  editModal.classList.remove("hidden");
}

closeEditModal.addEventListener("click", () => editModal.classList.add("hidden"));
cancelEditBtn.addEventListener("click", () => editModal.classList.add("hidden"));
editModal.addEventListener("click", (e) => { if (e.target === editModal) editModal.classList.add("hidden"); });

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = editId.value;
  const newTitle = editTitle.value.trim();
  const newCategory = editCategory.value;

  if (!newTitle) {
    editError.textContent = "Title cannot be empty.";
    editError.classList.remove("hidden");
    return;
  }

  try {
    await updateDoc(doc(db, "media", id), { title: newTitle, category: newCategory });
    invalidatePublicCache();
    editModal.classList.add("hidden");
    await loadDashboard();
  } catch (err) {
    console.error("Failed to update media:", err);
    editError.textContent = "Could not save changes. Please try again.";
    editError.classList.remove("hidden");
  }
});

// ===========================================================================
// DELETE (Only Firestore doc, Cloudinary file remains as backup)
// ===========================================================================
function openDeleteModal(item) {
  pendingDeleteItem = item;
  deleteFileName.textContent = item.title || item.fileName || "this file";
  deleteModal.classList.remove("hidden");
}

closeDeleteModal.addEventListener("click", () => deleteModal.classList.add("hidden"));
cancelDeleteBtn.addEventListener("click", () => deleteModal.classList.add("hidden"));
deleteModal.addEventListener("click", (e) => { if (e.target === deleteModal) deleteModal.classList.add("hidden"); });

confirmDeleteBtn.addEventListener("click", async () => {
  if (!pendingDeleteItem) return;
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting...";

  try {
    await deleteDoc(doc(db, "media", pendingDeleteItem.id));
    invalidatePublicCache();
    deleteModal.classList.add("hidden");
    pendingDeleteItem = null;
    await loadDashboard();
  } catch (err) {
    console.error("Delete failed:", err);
    alert("Failed to delete this asset. Please try again.");
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Delete Permanently";
  }
});

// ===========================================================================
// HELPERS
// ===========================================================================
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "0 B";
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
  if (isNaN(date.getTime())) return "Just now";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }
