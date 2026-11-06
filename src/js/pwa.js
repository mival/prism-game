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
