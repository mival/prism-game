"use strict";

/* Settings page: theme, moving progress to another device (link, QR code,
   save code, file), restoring, and resetting. */
(function () {
  const L = window.PrismLogic;
  const P = window.PrismProgress;
  const $ = (id) => document.getElementById(id);

  /* ------------------------------ theme ------------------------------ */

  const themeInputs = [...document.querySelectorAll('input[name="theme"]')];
  const current = document.documentElement.dataset.theme || "auto";
  themeInputs.forEach((i) => {
    i.checked = i.value === current;
    i.addEventListener("change", () => {
      if (i.value === "auto") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = i.value;
      try {
        localStorage.setItem("prism.theme", i.value);
      } catch (e) {
        /* theme just won't persist */
      }
      syncThemeColor();
    });
  });
  function syncThemeColor() {
    const c = getComputedStyle(document.documentElement)
      .getPropertyValue("--theme-color")
      .trim();
    document.querySelector('meta[name="theme-color"]').content = c;
  }
  syncThemeColor();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", syncThemeColor);

  /* ------------------------------ progress ------------------------------ */

  const code = () => P.encode(P.readLocal());
  /* The link opens the game, which restores the code from the address. */
  const link = () =>
    new URL("./#restore-" + code().replace(/-/g, ""), location.href).href;

  function renderSummary() {
    const p = P.readLocal();
    const solved = p.done.filter((id) => L.LEVELS.some((l) => l.id === id));
    const wins = p.endless.easy + p.endless.medium + p.endless.hard;
    $("summary").innerHTML =
      `You've solved <b>${solved.length} of ${L.LEVELS.length}</b> levels` +
      (wins
        ? ` and <b>${wins}</b> Endless level${wins === 1 ? "" : "s"}.`
        : ".");
    $("saveCode").textContent = code();
    if (!$("qr").hidden) renderQr();
  }

  function renderQr() {
    const qr = window.qrcode(0, "M");
    qr.addData(link());
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    const pad = 2;
    $("qrBox").innerHTML =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${n + pad * 2} ${n + pad * 2}" shape-rendering="crispEdges">` +
      `<rect x="${-pad}" y="${-pad}" width="${n + pad * 2}" height="${n + pad * 2}" fill="#ffffff"/>` +
      `<path d="${d}" fill="#000000"/></svg>`;
  }

  function flash(button, text) {
    const old = button.textContent;
    button.textContent = text;
    setTimeout(() => (button.textContent = old), 1500);
  }
  function copy(text, button) {
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(
        () => flash(button, "Copied"),
        () => flash(button, "Couldn't copy"),
      );
    else flash(button, "Couldn't copy");
  }

  $("showQr").addEventListener("click", () => {
    const show = $("qr").hidden;
    $("qr").hidden = !show;
    $("showQr").setAttribute("aria-expanded", String(show));
    $("showQr").textContent = show ? "Hide QR code" : "Show QR code";
    if (show) renderQr();
  });
  $("copyLink").addEventListener("click", () => copy(link(), $("copyLink")));
  if (navigator.share) {
    $("shareLink").hidden = false;
    $("shareLink").addEventListener("click", () =>
      navigator.share({ title: "Prism progress", url: link() }).catch(() => {}),
    );
  }
  $("copyCode").addEventListener("click", () => copy(code(), $("copyCode")));
  $("download").addEventListener("click", () => {
    const text =
      "Prism save code\n\n" +
      code() +
      "\n\nTo continue on another device, open Prism, go to Settings > Restore,\n" +
      "and load this file or type the code. Or open this link:\n" +
      link() +
      "\n";
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `prism-save-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ------------------------------ restore ------------------------------ */

  function message(el, text, ok) {
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle("ok", ok);
    el.classList.toggle("bad", !ok);
  }

  function restore(text) {
    const p = text && P.decode(text);
    if (!p)
      return message(
        $("restoreMsg"),
        "That isn't a valid save code. Check it for typos; dashes and spaces don't matter.",
        false,
      );
    message($("restoreMsg"), P.describeRestore(P.mergeLocal(p)), true);
    renderSummary();
  }

  $("restoreForm").addEventListener("submit", (e) => {
    e.preventDefault();
    restore($("restoreInput").value);
  });
  $("restoreFile").addEventListener("change", () => {
    const file = $("restoreFile").files && $("restoreFile").files[0];
    if (!file) return;
    file.text().then(
      (text) => {
        const found = P.findCode(text);
        if (found) restore(found);
        else
          message(
            $("restoreMsg"),
            "That file doesn't contain a save code.",
            false,
          );
        $("restoreFile").value = "";
      },
      () => message($("restoreMsg"), "That file couldn't be read.", false),
    );
  });

  /* ------------------------------ reset ------------------------------ */

  $("reset").addEventListener("click", () => {
    $("resetStart").hidden = true;
    $("resetConfirm").hidden = false;
    $("resetMsg").hidden = true;
    $("resetNo").focus();
  });
  $("resetNo").addEventListener("click", () => {
    $("resetConfirm").hidden = true;
    $("resetStart").hidden = false;
  });
  $("resetYes").addEventListener("click", () => {
    P.resetLocal();
    $("resetConfirm").hidden = true;
    $("resetStart").hidden = false;
    message(
      $("resetMsg"),
      "Progress reset. Every level is unsolved again.",
      true,
    );
    renderSummary();
  });

  renderSummary();
})();
