const SUPABASE_ESM = [
  "https://esm.sh/@supabase/supabase-js@2.49.4",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm",
];

const LIB_URL =
  "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const setupBanner = document.getElementById("setup-banner");
const setupBannerTitle = document.getElementById("setup-banner-title");
const setupBannerBody = document.getElementById("setup-banner-body");
const authGate = document.getElementById("auth-gate");
const appBlock = document.getElementById("app-block");
const appTabBar = document.getElementById("app-tabbar");
const magicForm = document.getElementById("magic-form");
const magicEmail = document.getElementById("magic-email");
const magicSubmit = document.getElementById("magic-submit");
const magicMsg = document.getElementById("magic-msg");
const signedInEmail = document.getElementById("signed-in-email");
const btnSignOut = document.getElementById("btn-sign-out");
const btnRefreshScans = document.getElementById("btn-refresh-scans");
const scanTableBody = document.getElementById("scan-table-body");
const historyStatus = document.getElementById("history-status");
const scannerStatus = document.getElementById("scanner-status");
const btnOpenAddLocation = document.getElementById("btn-open-add-location");
const addLocationDialog = document.getElementById("add-location-dialog");
const addLocationForm = document.getElementById("add-location-form");
const addLocationInput = document.getElementById("add-location-input");
const addLocationSubmit = document.getElementById("add-location-submit");
const addLocationCancel = document.getElementById("add-location-cancel");
const addLocationStatus = document.getElementById("add-location-status");
const locationViewerStatus = document.getElementById("location-viewer-status");
const locationViewerList = document.getElementById("location-viewer-list");

const tabButtons = document.querySelectorAll("[data-tab-button]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");

const dialog = document.getElementById("qr-dialog");
const readerEl = document.getElementById("qr-reader");
const btnScan = document.getElementById("btn-scan-qr");
const btnCancel = document.getElementById("qr-cancel");
const errEl = document.getElementById("qr-dialog-error");
const locationViewerDialog = document.getElementById("location-viewer-dialog");
const locationViewerDialogTitle = document.getElementById(
  "location-viewer-dialog-title"
);
const locationViewerDialogMeta = document.getElementById(
  "location-viewer-dialog-meta"
);
const locationViewerDialogItems = document.getElementById(
  "location-viewer-dialog-items"
);
const locationViewerDialogStatus = document.getElementById(
  "location-viewer-dialog-status"
);
const btnOpenAddItem = document.getElementById("btn-open-add-item");
const addItemDialog = document.getElementById("add-item-dialog");
const addItemForm = document.getElementById("add-item-form");
const addItemInput = document.getElementById("add-item-input");
const addItemSubmit = document.getElementById("add-item-submit");
const addItemCancel = document.getElementById("add-item-cancel");
const addItemStatus = document.getElementById("add-item-status");
const btnLocationViewerClose = document.getElementById("location-viewer-close");
const photoViewerDialog = document.getElementById("photo-viewer-dialog");
const photoViewerCaption = document.getElementById("photo-viewer-caption");
const photoViewerImage = document.getElementById("photo-viewer-image");
const btnPhotoViewerClose = document.getElementById("photo-viewer-close");
const itemDeleteDialog = document.getElementById("item-delete-dialog");
const itemDeleteDialogMessage = document.getElementById("item-delete-dialog-message");
const btnItemDeleteCancel = document.getElementById("item-delete-cancel");
const btnItemDeleteConfirm = document.getElementById("item-delete-confirm");
const itemPhotoInput = document.getElementById("item-photo-input");

let supabase = null;
let scanner = null;
let scanning = false;
let activeViewerLocation = null;
let pendingPhotoTarget = null;
let pendingDeleteTarget = null;
const LOCAL_BYPASS_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const IS_LOCALHOST = LOCAL_BYPASS_HOSTS.has(window.location.hostname);

function toSafeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function updateItemPhoto(item, file) {
  if (!supabase || !activeViewerLocation) {
    throw new Error("Photo upload unavailable right now.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : ".jpg";
  const filePath = `${activeViewerLocation.id}/${item.id}-${Date.now()}-${toSafeFileName(
    item.name
  )}${ext}`;

  const bucket = supabase.storage.from("item-images");
  const { error: uploadError } = await bucket.upload(filePath, file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = bucket.getPublicUrl(filePath);
  const { error: updateError } = await supabase
    .from("items")
    .update({ image_url: publicUrl })
    .eq("id", item.id);
  if (updateError) throw updateError;
}

async function deleteItem(itemId) {
  if (!supabase) throw new Error("Delete unavailable right now.");
  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) throw error;
}

/**
 * Inserts a row into `items` for the given storage location.
 * @param {string} locationId
 * @param {string} name
 * @returns {Promise<{ id: string; name: string; image_url: string | null; created_at: string }>}
 */
async function createItemForLocation(locationId, name) {
  if (!supabase) throw new Error("Add item unavailable right now.");
  const { data, error } = await supabase
    .from("items")
    .insert({ storage_location_id: locationId, name })
    .select("id, name, image_url, created_at")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Could not create item.");
  return data;
}

function openItemDeleteModal(item) {
  if (!itemDeleteDialog || !itemDeleteDialogMessage) return;
  pendingDeleteTarget = item;
  itemDeleteDialogMessage.textContent = `Are you sure you want to delete "${item.name}"?`;
  itemDeleteDialog.showModal();
}

function validateSupabaseConfig(url, key) {
  if (!url || !key) return { ok: false, reason: "empty" };
  if (url.includes("azurestaticapps.net")) {
    return {
      ok: false,
      reason: "wrong-host",
      detail:
        "This value is your Azure Static Web App address. In Supabase open Project Settings → API and copy the Project URL (it ends with .supabase.co).",
    };
  }
  if (!url.includes("supabase.co")) {
    return {
      ok: false,
      reason: "wrong-host",
      detail:
        "Project URL should be https://YOUR-REF.supabase.co from Supabase → Project Settings → API (unless you use a custom Supabase API domain).",
    };
  }
  if (key.length < 120 || !key.startsWith("eyJ")) {
    return {
      ok: false,
      reason: "bad-key",
      detail:
        "Anon key looks wrong — copy the full anon public key from Supabase (long text starting with eyJ).",
    };
  }
  return { ok: true };
}

function showSetupMissing(detail) {
  if (detail?.detail && setupBannerTitle && setupBannerBody) {
    setupBannerTitle.textContent = "Supabase settings look incorrect.";
    setupBannerBody.textContent = detail.detail;
  } else if (setupBannerTitle && setupBannerBody) {
    setupBannerTitle.textContent = "Supabase not configured.";
    setupBannerBody.innerHTML =
      'Edit <code>js/supabase-config.js</code> with your <strong>Supabase</strong> project URL (<code>…supabase.co</code>) and anon key — not your Azure site URL. Then redeploy.';
  }
  setupBanner?.removeAttribute("hidden");
  authGate?.setAttribute("hidden", "");
  appBlock?.setAttribute("hidden", "");
  appTabBar?.setAttribute("hidden", "");
}

function showAuthGate() {
  setupBanner?.setAttribute("hidden", "");
  authGate?.removeAttribute("hidden");
  appBlock?.setAttribute("hidden", "");
  appTabBar?.setAttribute("hidden", "");
}

function showApp(session) {
  setupBanner?.setAttribute("hidden", "");
  authGate?.setAttribute("hidden", "");
  appBlock?.removeAttribute("hidden");
  appTabBar?.removeAttribute("hidden");
  setActiveTab("scanner");
  if (signedInEmail) {
    signedInEmail.textContent = session?.user?.email ?? "";
  }
}

function setActiveTab(tabId) {
  for (const panel of tabPanels) {
    panel.hidden = panel.dataset.tabPanel !== tabId;
  }
  for (const button of tabButtons) {
    const isActive = button.dataset.tabButton === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  }
}

async function finishUrlAuth(client) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("code")) return;
  try {
    const { error } = await client.auth.exchangeCodeForSession(
      window.location.href
    );
    if (!error) {
      window.history.replaceState({}, document.title, url.pathname + url.hash);
    }
  } catch {
    /* stale or invalid ?code= in URL */
  }
}

async function loadCreateClient() {
  let lastErr;
  for (const href of SUPABASE_ESM) {
    try {
      const m = await import(href);
      if (typeof m.createClient === "function") return m.createClient;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Could not load Supabase client from CDN.");
}

async function refreshScans() {
  if (!supabase || !scanTableBody || !historyStatus) return;
  historyStatus.textContent = "Loading…";
  const { data, error } = await supabase
    .from("qr_scans")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    historyStatus.textContent = error.message;
    return;
  }

  historyStatus.textContent =
    data.length === 0
      ? "No lookups yet."
      : `${data.length} entr${data.length === 1 ? "y" : "ies"}`;

  scanTableBody.replaceChildren();
  for (const row of data) {
    const tr = document.createElement("tr");
    const tdWhen = document.createElement("td");
    tdWhen.textContent = new Date(row.created_at).toLocaleString();
    const tdText = document.createElement("td");
    tdText.textContent = row.content;
    tr.append(tdWhen, tdText);
    scanTableBody.appendChild(tr);
  }
}

function applySession(session) {
  if (!session && IS_LOCALHOST) {
    // Localhost is treated as a trusted development environment.
    showApp({ user: { email: "Local development mode" } });
    if (btnSignOut) btnSignOut.hidden = true;
    void refreshScans();
    void refreshLocationViewer();
    return;
  }

  if (!session) {
    if (btnSignOut) btnSignOut.hidden = false;
    showAuthGate();
    return;
  }
  if (btnSignOut) btnSignOut.hidden = false;
  showApp(session);
  void refreshScans();
  void refreshLocationViewer();
}

async function initSupabase() {
  let supabaseUrl;
  let supabaseAnonKey;
  try {
    const cfg = await import("./supabase-config.js");
    supabaseUrl = cfg.supabaseUrl;
    supabaseAnonKey = cfg.supabaseAnonKey;
  } catch {
    if (setupBannerTitle && setupBannerBody) {
      setupBannerTitle.textContent = "Could not load config";
      setupBannerBody.textContent =
        "The browser could not load js/supabase-config.js. Ensure it is deployed and the path is correct.";
    }
    setupBanner?.removeAttribute("hidden");
    authGate?.setAttribute("hidden", "");
    appBlock?.setAttribute("hidden", "");
    appTabBar?.setAttribute("hidden", "");
    return;
  }

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    showSetupMissing();
    return;
  }

  const normalizedUrl = supabaseUrl.trim().replace(/\/+$/, "");
  const normalizedKey = supabaseAnonKey.trim();

  const check = validateSupabaseConfig(normalizedUrl, normalizedKey);
  if (!check.ok && check.reason !== "empty") {
    showSetupMissing({ detail: check.detail });
    return;
  }
  if (!check.ok) {
    showSetupMissing();
    return;
  }

  let createClient;
  try {
    createClient = await loadCreateClient();
  } catch (e) {
    showAuthGate();
    if (magicMsg) {
      magicMsg.textContent =
        e instanceof Error
          ? `${e.message} Try another network or disable extensions that block scripts.`
          : "Could not load Supabase. Check your network or ad blocker.";
    }
    return;
  }

  try {
    supabase = createClient(normalizedUrl, normalizedKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    await finishUrlAuth(supabase);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    applySession(session);

    supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next);
    });
  } catch (e) {
    showAuthGate();
    if (magicMsg) {
      magicMsg.textContent =
        e instanceof Error ? e.message : "Something went wrong starting Supabase.";
    }
  }
}

magicForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase || !magicEmail || !magicMsg || !magicSubmit) return;
  const email = magicEmail.value.trim();
  magicMsg.textContent = "";
  magicSubmit.disabled = true;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });
  magicSubmit.disabled = false;
  magicMsg.textContent = error
    ? error.message
    : "Check your email — open the link on this device to finish signing in.";
});

btnSignOut?.addEventListener("click", async () => {
  if (IS_LOCALHOST) return;
  if (!supabase) return;
  await supabase.auth.signOut();
  magicMsg.textContent = "";
  scanTableBody?.replaceChildren();
  if (historyStatus) historyStatus.textContent = "";
  if (locationViewerList) locationViewerList.replaceChildren();
  if (locationViewerStatus) locationViewerStatus.textContent = "";
  if (scannerStatus) scannerStatus.textContent = "";
  addLocationForm?.reset();
  setAddLocationStatus("");
  addLocationDialog?.close();
  addItemForm?.reset();
  setAddItemStatus("");
  addItemDialog?.close();
  locationViewerDialog?.close();
});

btnRefreshScans?.addEventListener("click", () => {
  void refreshScans();
});

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-qr-lib="1"]`);
    if (existing) {
      if (window.Html5Qrcode) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.qrLib = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load QR scanner library"));
    document.head.appendChild(s);
  });
}

async function getHtml5Qrcode() {
  await loadScript(LIB_URL);
  const Ctor = window.Html5Qrcode;
  if (!Ctor) throw new Error("QR scanner library unavailable");
  return Ctor;
}

function setError(msg) {
  if (!errEl) return;
  if (msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  } else {
    errEl.textContent = "";
    errEl.hidden = true;
  }
}

function setAddLocationStatus(msg) {
  if (!addLocationStatus) return;
  addLocationStatus.textContent = msg;
}

function setAddItemStatus(msg) {
  if (!addItemStatus) return;
  addItemStatus.textContent = msg;
}

/** Opens the add-item dialog for the current location modal (requires `activeViewerLocation`). */
function openAddItemModal() {
  if (!activeViewerLocation || !addItemDialog || !addItemForm) return;
  setAddItemStatus("");
  addItemForm.reset();
  addItemDialog.showModal();
  queueMicrotask(() => addItemInput?.focus());
}

function setScannerStatus(msg) {
  if (!scannerStatus) return;
  scannerStatus.textContent = msg;
}

async function stopScanner() {
  if (!scanner || !scanning) {
    scanner = null;
    scanning = false;
    return;
  }
  try {
    await scanner.stop();
  } catch {
    /* already stopped */
  }
  try {
    scanner.clear();
  } catch {
    /* ok */
  }
  scanner = null;
  scanning = false;
}

async function saveScan(content) {
  if (!supabase) return { ok: false, message: "Not signed in" };
  const { error } = await supabase.from("qr_scans").insert({ content });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

async function fetchLocations() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("storage_locations")
    .select("id, name, created_at")
    .order("name", { ascending: true })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

async function fetchItemsForLocation(locationId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("items")
    .select("id, name, image_url, created_at")
    .eq("storage_location_id", locationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function openLocationViewerModal(location) {
  if (
    !locationViewerDialog ||
    !locationViewerDialogTitle ||
    !locationViewerDialogMeta ||
    !locationViewerDialogItems ||
    !locationViewerDialogStatus
  ) {
    return;
  }

  locationViewerDialogTitle.textContent = location.name;
  locationViewerDialogMeta.textContent = `Added ${new Date(
    location.created_at
  ).toLocaleString()}`;
  activeViewerLocation = location;
  locationViewerDialogStatus.textContent = "Loading items...";
  locationViewerDialogItems.replaceChildren();
  if (!locationViewerDialog.open) locationViewerDialog.showModal();

  try {
    const items = await fetchItemsForLocation(location.id);
    locationViewerDialogStatus.textContent = "";
    if (items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No items yet.";
      locationViewerDialogItems.appendChild(li);
      return;
    }

    for (const item of items) {
      const li = document.createElement("li");
      li.className = "viewer-item-row";
      const details = document.createElement("div");
      const nameEl = document.createElement("strong");
      nameEl.textContent = item.name;
      const dateEl = document.createElement("p");
      dateEl.textContent = new Date(item.created_at).toLocaleString();
      details.append(nameEl, dateEl);
      li.append(details);

      const actions = document.createElement("div");
      actions.className = "viewer-item-actions";

      if (item.image_url) {
        const imageButton = document.createElement("button");
        imageButton.type = "button";
        imageButton.className = "viewer-item-photo";
        imageButton.textContent = "Photo";
        imageButton.addEventListener("click", () => {
          openPhotoViewerModal(item.image_url, item.name);
        });
        actions.append(imageButton);
      }

      const changePhotoButton = document.createElement("button");
      changePhotoButton.type = "button";
      changePhotoButton.className = "viewer-item-photo";
      changePhotoButton.textContent = item.image_url ? "Change Photo" : "Add Photo";
      changePhotoButton.addEventListener("click", () => {
        if (!itemPhotoInput) return;
        pendingPhotoTarget = item;
        itemPhotoInput.value = "";
        itemPhotoInput.click();
      });
      actions.append(changePhotoButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "viewer-item-delete";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        openItemDeleteModal(item);
      });
      actions.append(deleteButton);
      li.append(actions);

      locationViewerDialogItems.appendChild(li);
    }
  } catch (error) {
    locationViewerDialogStatus.textContent =
      error instanceof Error ? error.message : "Could not load items.";
  }
}

function openPhotoViewerModal(imageUrl, itemName) {
  if (!photoViewerDialog || !photoViewerImage || !photoViewerCaption) return;
  photoViewerCaption.textContent = itemName;
  photoViewerImage.src = imageUrl;
  photoViewerImage.alt = `Photo for ${itemName}`;
  photoViewerDialog.showModal();
}

function renderLocationViewerList(locations) {
  if (!locationViewerList) return;
  locationViewerList.replaceChildren();

  if (locations.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No locations yet. Tap + to add one.";
    locationViewerList.appendChild(li);
    return;
  }

  for (const location of locations) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "location-viewer-row";
    const nameEl = document.createElement("strong");
    nameEl.textContent = location.name;
    const dateEl = document.createElement("span");
    dateEl.textContent = new Date(location.created_at).toLocaleDateString();
    button.append(nameEl, dateEl);
    button.addEventListener("click", () => {
      void openLocationViewerModal(location);
    });
    li.appendChild(button);
    locationViewerList.appendChild(li);
  }
}

async function refreshLocationViewer() {
  if (!locationViewerStatus) return;
  locationViewerStatus.textContent = "Loading locations...";
  try {
    const locations = await fetchLocations();
    renderLocationViewerList(locations);
    locationViewerStatus.textContent =
      locations.length === 0
        ? "No locations yet. Use + to add one."
        : `${locations.length} location${locations.length === 1 ? "" : "s"}.`;
  } catch (error) {
    locationViewerStatus.textContent =
      error instanceof Error ? error.message : "Could not load locations.";
  }
}

async function runLocationLookup(rawCode) {
  if (!supabase) return;
  const code = rawCode.trim();
  if (!code) return;

  const { data, error } = await supabase
    .from("storage_locations")
    .select("id, name, created_at")
    .eq("name", code)
    .limit(1);

  const saved = await saveScan(code);
  await refreshScans();

  if (error) {
    setScannerStatus(
      saved.ok
        ? `Lookup failed: ${error.message}`
        : `Lookup failed: ${error.message}. ${saved.message}`
    );
    return;
  }

  const location = data?.[0] ?? null;
  if (!location) {
    setScannerStatus(`No storage location named "${code}".`);
    return;
  }

  setScannerStatus(
    saved.ok
      ? `Opened ${location.name}.`
      : `Opened ${location.name}. Not saved to history: ${saved.message}`
  );
  setActiveTab("viewer");
  await openLocationViewerModal(location);
}

async function openScanner() {
  if (!supabase) return;
  if (!IS_LOCALHOST) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
  }

  setError("");
  if (!dialog || !readerEl) return;

  dialog.showModal();

  try {
    const Html5Qrcode = await getHtml5Qrcode();
    readerEl.innerHTML = "";
    scanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 220, height: 220 } };

    const onDecode = async (decodedText) => {
      await stopScanner();
      dialog.close();
      await runLocationLookup(decodedText);
    };

    const onFrameError = () => {};

    try {
      await scanner.start(
        { facingMode: "environment" },
        config,
        onDecode,
        onFrameError
      );
    } catch {
      try {
        await scanner.stop();
      } catch {
        /* not running */
      }
      try {
        scanner.clear();
      } catch {
        /* ok */
      }
      readerEl.innerHTML = "";
      scanner = new Html5Qrcode("qr-reader");
      await scanner.start(
        { facingMode: "user" },
        config,
        onDecode,
        onFrameError
      );
    }
    scanning = true;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Camera or scanner failed to start.";
    setError(msg);
    try {
      if (window.Html5Qrcode && readerEl) {
        readerEl.innerHTML = "";
      }
    } catch {
      /* ignore */
    }
    scanner = null;
    scanning = false;
  }
}

btnScan?.addEventListener("click", () => {
  void openScanner();
});

btnCancel?.addEventListener("click", async () => {
  await stopScanner();
  dialog?.close();
});

dialog?.addEventListener("close", () => {
  void stopScanner();
  if (readerEl) readerEl.innerHTML = "";
});

appTabBar?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab-button]");
  if (!btn || !appTabBar.contains(btn)) return;
  const tabId = btn.dataset.tabButton;
  if (tabId) setActiveTab(tabId);
});

function openAddLocationModal() {
  setAddLocationStatus("");
  addLocationForm?.reset();
  addLocationDialog?.showModal();
  queueMicrotask(() => addLocationInput?.focus());
}

btnOpenAddLocation?.addEventListener("click", () => {
  openAddLocationModal();
});

btnOpenAddItem?.addEventListener("click", () => {
  openAddItemModal();
});

addItemCancel?.addEventListener("click", () => {
  addItemDialog?.close();
});

addItemDialog?.addEventListener("close", () => {
  addItemForm?.reset();
  if (addItemSubmit) addItemSubmit.disabled = false;
});

addItemForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase || !addItemInput || !activeViewerLocation) {
    setAddItemStatus("Open a location first.");
    return;
  }

  const name = addItemInput.value.trim();
  if (!name) return;

  const location = activeViewerLocation;
  if (addItemSubmit) addItemSubmit.disabled = true;
  setAddItemStatus("Adding item…");

  try {
    await createItemForLocation(location.id, name);
    addItemForm.reset();
    addItemDialog?.close();
    await openLocationViewerModal(location);
    if (locationViewerDialogStatus) {
      locationViewerDialogStatus.textContent = "Item added.";
    }
  } catch (error) {
    setAddItemStatus(
      error instanceof Error ? error.message : "Could not add item."
    );
    if (addItemSubmit) addItemSubmit.disabled = false;
  }
});

addLocationCancel?.addEventListener("click", () => {
  addLocationDialog?.close();
});

addLocationDialog?.addEventListener("close", () => {
  addLocationForm?.reset();
  if (addLocationSubmit) addLocationSubmit.disabled = false;
});

addLocationForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase || !addLocationInput) return;

  const name = addLocationInput.value.trim();
  if (!name) return;

  if (addLocationSubmit) addLocationSubmit.disabled = true;
  setAddLocationStatus("Creating location…");

  const { data: existing, error: existingErr } = await supabase
    .from("storage_locations")
    .select("id, name, created_at")
    .ilike("name", name)
    .limit(1);

  if (existingErr) {
    setAddLocationStatus(
      `Could not check existing locations: ${existingErr.message}`
    );
    if (addLocationSubmit) addLocationSubmit.disabled = false;
    return;
  }

  const existingLocation = existing?.[0] ?? null;
  if (existingLocation) {
    setAddLocationStatus("That location already exists.");
    addLocationDialog?.close();
    await refreshLocationViewer();
    setActiveTab("viewer");
    await openLocationViewerModal(existingLocation);
    if (addLocationSubmit) addLocationSubmit.disabled = false;
    return;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("storage_locations")
    .insert({ name })
    .select("id, name, created_at")
    .single();

  if (insertErr || !inserted) {
    setAddLocationStatus(insertErr?.message ?? "Could not create location.");
    if (addLocationSubmit) addLocationSubmit.disabled = false;
    return;
  }

  setAddLocationStatus("Location added.");
  addLocationForm.reset();
  addLocationDialog?.close();
  await refreshLocationViewer();
  setActiveTab("viewer");
  await openLocationViewerModal(inserted);
  if (addLocationSubmit) addLocationSubmit.disabled = false;
});

btnLocationViewerClose?.addEventListener("click", () => {
  locationViewerDialog?.close();
});

locationViewerDialog?.addEventListener("close", () => {
  photoViewerDialog?.close();
  itemDeleteDialog?.close();
  addItemForm?.reset();
  setAddItemStatus("");
  addItemDialog?.close();
  activeViewerLocation = null;
  pendingPhotoTarget = null;
  pendingDeleteTarget = null;
  if (locationViewerDialogItems) locationViewerDialogItems.replaceChildren();
  if (locationViewerDialogStatus) locationViewerDialogStatus.textContent = "";
});

btnPhotoViewerClose?.addEventListener("click", () => {
  photoViewerDialog?.close();
});

photoViewerDialog?.addEventListener("close", () => {
  if (photoViewerImage) {
    photoViewerImage.removeAttribute("src");
    photoViewerImage.alt = "";
  }
  if (photoViewerCaption) photoViewerCaption.textContent = "";
});

itemPhotoInput?.addEventListener("change", async () => {
  const file = itemPhotoInput.files?.[0] ?? null;
  const item = pendingPhotoTarget;
  pendingPhotoTarget = null;
  itemPhotoInput.value = "";
  if (!file || !item || !activeViewerLocation || !locationViewerDialogStatus) return;

  locationViewerDialogStatus.textContent = `Uploading photo for ${item.name}...`;
  try {
    await updateItemPhoto(item, file);
    locationViewerDialogStatus.textContent = "Photo updated.";
    await openLocationViewerModal(activeViewerLocation);
  } catch (error) {
    locationViewerDialogStatus.textContent =
      error instanceof Error ? error.message : "Could not upload photo.";
  }
});

btnItemDeleteCancel?.addEventListener("click", () => {
  itemDeleteDialog?.close();
});

itemDeleteDialog?.addEventListener("close", () => {
  pendingDeleteTarget = null;
  if (btnItemDeleteConfirm) btnItemDeleteConfirm.disabled = false;
  if (itemDeleteDialogMessage) itemDeleteDialogMessage.textContent = "";
});

btnItemDeleteConfirm?.addEventListener("click", async () => {
  if (!pendingDeleteTarget || !activeViewerLocation || !locationViewerDialogStatus) return;
  btnItemDeleteConfirm.disabled = true;
  const item = pendingDeleteTarget;
  locationViewerDialogStatus.textContent = `Deleting ${item.name}...`;
  try {
    await deleteItem(item.id);
    itemDeleteDialog?.close();
    locationViewerDialogStatus.textContent = "Item deleted.";
    await openLocationViewerModal(activeViewerLocation);
  } catch (error) {
    locationViewerDialogStatus.textContent =
      error instanceof Error ? error.message : "Could not delete item.";
    if (btnItemDeleteConfirm) btnItemDeleteConfirm.disabled = false;
  }
});

void initSupabase().catch((e) => {
  showAuthGate();
  if (magicMsg) {
    magicMsg.textContent =
      e instanceof Error ? e.message : "App failed to start. Try refreshing.";
  }
});
