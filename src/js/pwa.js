"use strict";

/* Registers the service worker (sw.js) that lets Prism run offline and be
   installed. Service workers only run over http(s), not from file://. */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* the game still works online */
    });
  });
}

/* Settings page: an Install button where the browser offers one, and the
   steps for iOS, which has no install prompt. */
(function () {
  const row = document.getElementById("installRow");
  if (!row) return;
  const button = document.getElementById("install");
  const status = document.getElementById("appStatus");
  const standalone =
    matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;
  if (standalone) {
    status.textContent = "Prism is installed and works offline.";
    return;
  }
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) document.getElementById("installIos").hidden = false;

  let prompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    prompt = e;
    row.hidden = false;
  });
  button.addEventListener("click", async () => {
    if (!prompt) return;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    prompt = null;
    row.hidden = true;
    if (choice && choice.outcome === "accepted")
      status.textContent =
        "Installed. Prism now opens like an app and works offline.";
  });
  window.addEventListener("appinstalled", () => {
    row.hidden = true;
    status.textContent =
      "Installed. Prism now opens like an app and works offline.";
  });
})();

/* Updates. Each deploy stamps the pages with their version and writes
   version.json with the newest one. An open app checks that file when it
   comes back to the foreground and every 30 minutes; if it is out of date
   a banner offers to reload. It never reloads on its own, so a level in
   progress is never lost without asking. Settings shows the version and
   has a Check for updates button. Offline, checks quietly do nothing. */
window.PrismUpdate = (function () {
  const meta = document.querySelector('meta[name="prism-version"]');
  const current = {
    version: meta ? meta.content : "dev",
    date: meta ? meta.dataset.date : "",
  };
  let latest = null;
  let dismissed = null;
  const online = /^https?:$/.test(location.protocol);

  async function check() {
    if (!online) return null;
    try {
      const res = await fetch("version.json", { cache: "no-store" });
      if (!res.ok) return null;
      latest = await res.json();
      if (latest.version !== current.version) showBanner();
      return latest;
    } catch (e) {
      return null;
    }
  }

  /* Re-download every file through the service worker, then reload. */
  function apply() {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return location.reload();
    const done = () => location.reload();
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data === "refreshed") done();
    });
    setTimeout(done, 8000);
    sw.postMessage("refresh");
  }

  function showBanner() {
    if (!latest || dismissed === latest.version) return;
    if (document.getElementById("updateBanner")) return;
    const bar = document.createElement("div");
    bar.id = "updateBanner";
    bar.className = "update-banner";
    bar.setAttribute("role", "status");
    bar.innerHTML =
      "<span>A new version of Prism is ready.</span>" +
      '<button type="button" class="reload">Reload</button>' +
      '<button type="button" class="close" aria-label="Later">×</button>';
    bar.querySelector(".reload").addEventListener("click", (e) => {
      e.target.textContent = "Updating…";
      e.target.disabled = true;
      apply();
    });
    bar.querySelector(".close").addEventListener("click", () => {
      dismissed = latest.version;
      bar.remove();
    });
    document.body.appendChild(bar);
  }

  if (online) {
    window.addEventListener("load", () => setTimeout(check, 3000));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) check();
    });
    setInterval(check, 30 * 60 * 1000);
  }

  return { current, check, apply, latest: () => latest };
})();

/* Settings page: the version and a Check for updates button. */
(function () {
  const info = document.getElementById("versionInfo");
  if (!info) return;
  const U = window.PrismUpdate;
  const label = (v) => {
    if (!v || v.version === "dev") return "Development copy";
    const d = v.date
      ? new Date(v.date + "T00:00:00Z").toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
      : "";
    return `Version ${v.version}` + (d ? ` · ${d}` : "");
  };
  info.textContent = label(U.current);
  const button = document.getElementById("checkUpdate");
  const msg = document.getElementById("updateMsg");
  button.addEventListener("click", async () => {
    if (button.dataset.ready) {
      button.textContent = "Updating…";
      button.disabled = true;
      return U.apply();
    }
    button.disabled = true;
    msg.hidden = false;
    msg.className = "msg";
    msg.textContent = "Checking…";
    const v = await U.check();
    button.disabled = false;
    if (!v) {
      msg.className = "msg bad";
      msg.textContent = "Couldn't check: you seem to be offline.";
    } else if (v.version === U.current.version) {
      msg.className = "msg ok";
      msg.textContent = "You have the latest version.";
    } else {
      msg.className = "msg ok";
      msg.textContent = `${label(v)} is available.`;
      button.textContent = "Reload to update";
      button.dataset.ready = "1";
    }
  });
})();
