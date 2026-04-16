const SUPABASE_ESM = [
  "https://esm.sh/@supabase/supabase-js@2.49.4",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm",
];

const LIB_URL =
  "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";

const ITEM_IMAGE_BUCKET = "item-images";
const ITEM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const setupBanner = document.getElementById("setup-banner");
const setupBannerTitle = document.getElementById("setup-banner-title");
const setupBannerBody = document.getElementById("setup-banner-body");
const authGate = document.getElementById("auth-gate");
const appBlock = document.getElementById("app-block");
const magicForm = document.getElementById("magic-form");
const magicEmail = document.getElementById("magic-email");
const magicSubmit = document.getElementById("magic-submit");
const magicMsg = document.getElementById("magic-msg");
const signedInEmail = document.getElementById("signed-in-email");
const btnSignOut = document.getElementById("btn-sign-out");
const btnRefreshScans = document.getElementById("btn-refresh-scans");
const scanTableBody = document.getElementById("scan-table-body");
const historyStatus = document.getElementById("history-status");
const locationSearchInput = document.getElementById("location-search-input");
const btnSearchLocation = document.getElementById("btn-search-location");
const addLocationForm = document.getElementById("add-location-form");
const addLocationInput = document.getElementById("add-location-input");
const addLocationSubmit = document.getElementById("add-location-submit");
const addLocationStatus = document.getElementById("add-location-status");

const dialog = document.getElementById("qr-dialog");
const readerEl = document.getElementById("qr-reader");
const btnScan = document.getElementById("btn-scan-qr");
const btnCancel = document.getElementById("qr-cancel");
const errEl = document.getElementById("qr-dialog-error");
const resultBox = document.getElementById("qr-result");
const lookupSaveNote = document.getElementById("lookup-save-note");
const locationResultFound = document.getElementById("location-result-found");
const locationNameEl = document.getElementById("location-name");
const locationCreatedEl = document.getElementById("location-created");
const locationIdEl = document.getElementById("location-id");
const locationResultMiss = document.getElementById("location-result-miss");
const btnCopy = document.getElementById("qr-copy");
const locationItems = document.getElementById("location-items");
const locationItemsList = document.getElementById("location-items-list");
const addItemForm = document.getElementById("add-item-form");
const addItemName = document.getElementById("add-item-name");
const addItemImage = document.getElementById("add-item-image");
const addItemSubmit = document.getElementById("add-item-submit");
const locationItemsStatus = document.getElementById("location-items-status");

let supabase = null;
let scanner = null;
let scanning = false;
let lastLookupCopyText = "";
let currentLookupLocationId = null;

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
}

function showAuthGate() {
  setupBanner?.setAttribute("hidden", "");
  authGate?.removeAttribute("hidden");
  appBlock?.setAttribute("hidden", "");
}

function showApp(session) {
  setupBanner?.setAttribute("hidden", "");
  authGate?.setAttribute("hidden", "");
  appBlock?.removeAttribute("hidden");
  if (signedInEmail && session?.user?.email) {
    signedInEmail.textContent = session.user.email;
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
    tdWhen.className = "scan-table-date";
    tdWhen.textContent = new Date(row.created_at).toLocaleString();
    const tdText = document.createElement("td");
    tdText.className = "scan-table-content";
    tdText.textContent = row.content;
    tr.append(tdWhen, tdText);
    scanTableBody.appendChild(tr);
  }
}

function applySession(session) {
  if (!session) {
    showAuthGate();
    return;
  }
  showApp(session);
  void refreshScans();
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
  if (!supabase) return;
  await supabase.auth.signOut();
  magicMsg.textContent = "";
  scanTableBody?.replaceChildren();
  if (historyStatus) historyStatus.textContent = "";
  currentLookupLocationId = null;
  if (locationItems) locationItems.hidden = true;
  if (locationItemsList) locationItemsList.replaceChildren();
  addItemForm?.reset();
  if (locationItemsStatus) {
    locationItemsStatus.textContent = "";
    locationItemsStatus.classList.remove("is-error");
  }
  addLocationForm?.reset();
  setAddLocationStatus("");
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

function setAddLocationStatus(msg, type = "info") {
  if (!addLocationStatus) return;
  addLocationStatus.textContent = msg;
  addLocationStatus.classList.remove("is-error", "is-success");
  if (type === "error") addLocationStatus.classList.add("is-error");
  if (type === "success") addLocationStatus.classList.add("is-success");
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

function formatLocationForCopy(location) {
  return [
    `Name: ${location.name}`,
    `Added: ${new Date(location.created_at).toLocaleString()}`,
    `ID: ${location.id}`,
  ].join("\n");
}

function showLookupResult(location, code, saved) {
  if (!resultBox) return;
  lastLookupCopyText = "";

  currentLookupLocationId = null;
  if (locationItems) locationItems.hidden = true;
  if (locationItemsList) locationItemsList.replaceChildren();
  if (locationItemsStatus) {
    locationItemsStatus.textContent = "";
    locationItemsStatus.classList.remove("is-error");
  }

  if (lookupSaveNote) {
    if (saved.ok) {
      lookupSaveNote.hidden = true;
      lookupSaveNote.textContent = "";
    } else {
      lookupSaveNote.hidden = false;
      lookupSaveNote.textContent = `Not saved to history: ${saved.message}`;
    }
  }

  if (location && locationResultFound && locationNameEl && locationCreatedEl && locationIdEl) {
    locationResultFound.hidden = false;
    locationNameEl.textContent = location.name;
    locationCreatedEl.textContent = new Date(location.created_at).toLocaleString();
    locationIdEl.textContent = location.id;
    if (locationResultMiss) {
      locationResultMiss.hidden = true;
      locationResultMiss.textContent = "";
    }
    lastLookupCopyText = formatLocationForCopy(location);
    currentLookupLocationId = location.id;
    if (locationItems) locationItems.hidden = false;
    void loadItemsForLocation(location.id);
  } else if (locationResultFound && locationResultMiss) {
    locationResultFound.hidden = true;
    locationResultMiss.hidden = false;
    locationResultMiss.textContent = `No storage location named “${code}”. The scanned or typed text must match a location name exactly.`;
    lastLookupCopyText = code;
  }

  resultBox.hidden = false;
}

async function loadItemsForLocation(locationId) {
  if (!supabase || !locationItemsList || !locationId) return;
  if (locationItemsStatus) {
    locationItemsStatus.textContent = "Loading items…";
    locationItemsStatus.classList.remove("is-error");
  }

  const { data, error } = await supabase
    .from("items")
    .select("id, name, image_url, created_at")
    .eq("storage_location_id", locationId)
    .order("created_at", { ascending: false });

  if (error) {
    if (locationItemsStatus) {
      locationItemsStatus.textContent = error.message;
      locationItemsStatus.classList.add("is-error");
    }
    return;
  }

  if (locationItemsStatus) {
    locationItemsStatus.textContent = "";
    locationItemsStatus.classList.remove("is-error");
  }

  locationItemsList.replaceChildren();
  if (data.length === 0) {
    const li = document.createElement("li");
    li.className = "item-list-empty";
    li.textContent = "No items yet.";
    locationItemsList.appendChild(li);
    return;
  }

  for (const row of data) {
    const li = document.createElement("li");
    li.className = "item-row";
    const wrap = document.createElement("div");
    wrap.className = "item-thumb-wrap";
    if (row.image_url) {
      const img = document.createElement("img");
      img.className = "item-thumb";
      img.src = row.image_url;
      img.alt = "";
      wrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "item-thumb-placeholder";
      ph.textContent = "—";
      wrap.appendChild(ph);
    }
    const meta = document.createElement("div");
    meta.className = "item-meta";
    const nameEl = document.createElement("span");
    nameEl.className = "item-name";
    nameEl.textContent = row.name;
    const dateEl = document.createElement("span");
    dateEl.className = "item-date";
    dateEl.textContent = new Date(row.created_at).toLocaleString();
    meta.append(nameEl, dateEl);
    li.append(wrap, meta);
    locationItemsList.appendChild(li);
  }
}

function fileExtensionForUpload(file) {
  const fromName = file.name?.split(".").pop();
  if (fromName && /^[a-z0-9]+$/i.test(fromName)) return fromName.toLowerCase();
  const t = file.type?.split("/")[1];
  if (t && /^[a-z0-9]+$/i.test(t)) return t.toLowerCase();
  return "jpg";
}

async function runLocationLookup(rawCode) {
  if (!supabase || !resultBox) return;
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
    currentLookupLocationId = null;
    if (locationItems) locationItems.hidden = true;
    if (locationItemsList) locationItemsList.replaceChildren();
    if (lookupSaveNote) {
      lookupSaveNote.hidden = false;
      lookupSaveNote.textContent = saved.ok
        ? error.message
        : `Lookup failed: ${error.message}. ${saved.message}`;
    }
    if (locationResultFound) locationResultFound.hidden = true;
    if (locationResultMiss) {
      locationResultMiss.hidden = false;
      locationResultMiss.textContent = `Could not look up location: ${error.message}`;
    }
    lastLookupCopyText = code;
    resultBox.hidden = false;
    return;
  }

  const location = data?.[0] ?? null;
  showLookupResult(location, code, saved);
}

async function openScanner() {
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

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

btnSearchLocation?.addEventListener("click", () => {
  if (!locationSearchInput) return;
  void runLocationLookup(locationSearchInput.value);
});

locationSearchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    void runLocationLookup(locationSearchInput.value);
  }
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
      `Could not check existing locations: ${existingErr.message}`,
      "error"
    );
    if (addLocationSubmit) addLocationSubmit.disabled = false;
    return;
  }

  const existingLocation = existing?.[0] ?? null;
  if (existingLocation) {
    setAddLocationStatus("That location already exists. Loaded it below.", "success");
    if (locationSearchInput) locationSearchInput.value = existingLocation.name;
    showLookupResult(existingLocation, existingLocation.name, { ok: true });
    addLocationInput.select();
    if (addLocationSubmit) addLocationSubmit.disabled = false;
    return;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("storage_locations")
    .insert({ name })
    .select("id, name, created_at")
    .single();

  if (insertErr || !inserted) {
    setAddLocationStatus(insertErr?.message ?? "Could not create location.", "error");
    if (addLocationSubmit) addLocationSubmit.disabled = false;
    return;
  }

  setAddLocationStatus("Location added. You can add items below.", "success");
  addLocationForm.reset();
  if (locationSearchInput) locationSearchInput.value = inserted.name;
  showLookupResult(inserted, inserted.name, { ok: true });
  addLocationInput.focus();
  if (addLocationSubmit) addLocationSubmit.disabled = false;
});

addItemForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase || !currentLookupLocationId || !addItemName) return;
  const name = addItemName.value.trim();
  if (!name) return;

  const file = addItemImage?.files?.[0] ?? null;
  if (file && file.size > ITEM_IMAGE_MAX_BYTES) {
    if (locationItemsStatus) {
      locationItemsStatus.textContent = "Image must be 5 MB or smaller.";
      locationItemsStatus.classList.add("is-error");
    }
    return;
  }

  if (addItemSubmit) addItemSubmit.disabled = true;
  if (locationItemsStatus) {
    locationItemsStatus.textContent = "Saving…";
    locationItemsStatus.classList.remove("is-error");
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("items")
    .insert({
      storage_location_id: currentLookupLocationId,
      name,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    if (locationItemsStatus) {
      locationItemsStatus.textContent = insertErr?.message ?? "Could not add item.";
      locationItemsStatus.classList.add("is-error");
    }
    if (addItemSubmit) addItemSubmit.disabled = false;
    return;
  }

  let pendingWarning = null;
  if (file && file.size > 0) {
    const ext = fileExtensionForUpload(file);
    const path = `${inserted.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(ITEM_IMAGE_BUCKET)
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: true,
      });
    if (!upErr) {
      const { data: pub } = supabase.storage
        .from(ITEM_IMAGE_BUCKET)
        .getPublicUrl(path);
      const imageUrl = pub?.publicUrl ?? null;
      if (imageUrl) {
        const { error: updErr } = await supabase
          .from("items")
          .update({ image_url: imageUrl })
          .eq("id", inserted.id);
        if (updErr) {
          pendingWarning = `Item saved; image URL not stored: ${updErr.message}`;
        }
      }
    } else {
      pendingWarning = `Item saved; upload failed: ${upErr.message}`;
    }
  }

  addItemForm.reset();
  if (addItemSubmit) addItemSubmit.disabled = false;
  await loadItemsForLocation(currentLookupLocationId);
  if (pendingWarning && locationItemsStatus) {
    locationItemsStatus.textContent = pendingWarning;
    locationItemsStatus.classList.add("is-error");
  }
});

btnCopy?.addEventListener("click", async () => {
  const text = lastLookupCopyText;
  if (!text) return;
  const prev = btnCopy.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btnCopy.textContent = "Copied";
    setTimeout(() => {
      btnCopy.textContent = prev;
    }, 1500);
  } catch {
    btnCopy.textContent = "Copy failed";
    setTimeout(() => {
      btnCopy.textContent = prev;
    }, 1500);
  }
});

void initSupabase().catch((e) => {
  showAuthGate();
  if (magicMsg) {
    magicMsg.textContent =
      e instanceof Error ? e.message : "App failed to start. Try refreshing.";
  }
});
