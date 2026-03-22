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
const magicForm = document.getElementById("magic-form");
const magicEmail = document.getElementById("magic-email");
const magicSubmit = document.getElementById("magic-submit");
const magicMsg = document.getElementById("magic-msg");
const signedInEmail = document.getElementById("signed-in-email");
const btnSignOut = document.getElementById("btn-sign-out");
const btnRefreshScans = document.getElementById("btn-refresh-scans");
const scanTableBody = document.getElementById("scan-table-body");
const historyStatus = document.getElementById("history-status");

const dialog = document.getElementById("qr-dialog");
const readerEl = document.getElementById("qr-reader");
const btnScan = document.getElementById("btn-scan-qr");
const btnCancel = document.getElementById("qr-cancel");
const errEl = document.getElementById("qr-dialog-error");
const resultBox = document.getElementById("qr-result");
const resultText = document.getElementById("qr-result-text");
const btnCopy = document.getElementById("qr-copy");

let supabase = null;
let scanner = null;
let scanning = false;

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
      ? "No scans yet."
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
      if (resultText && resultBox) {
        const saved = await saveScan(decodedText);
        if (saved.ok) {
          resultText.textContent = decodedText;
          resultBox.hidden = false;
          await refreshScans();
        } else {
          resultText.textContent = `${decodedText}\n\n— Not saved: ${saved.message}`;
          resultBox.hidden = false;
        }
      }
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

btnCopy?.addEventListener("click", async () => {
  const text = resultText?.textContent ?? "";
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
