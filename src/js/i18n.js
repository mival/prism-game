"use strict";

/* Languages: English (the source, written in the pages) and Czech.

   The language is "auto" (the browser's preference: Czech or Slovak picks
   Czech, anything else English) unless chosen in Settings (prism.lang).
   This file loads in each page's <head>, so <html lang> is set before the
   page draws.

   - Strings built in JavaScript go through t(key, vars); each key has an
     English and a Czech entry (a string with {placeholders}, or a function
     for plurals).
   - Static text in the HTML stays English in the page. In Czech, apply()
     swaps every text node and aria-label / title / placeholder / alt whose
     English text is in STATIC_CS. Text with inline markup is translated
     fragment by fragment, which is why some entries are sentence parts.
   - Level names and hints come from src/js/levels-cs.js. */
(function (root) {
  const KEY = "prism.lang";
  function choice() {
    try {
      const v = localStorage.getItem(KEY);
      return v === "en" || v === "cs" ? v : "auto";
    } catch (e) {
      return "auto";
    }
  }
  function detect() {
    const langs = navigator.languages || [navigator.language || "en"];
    return /^(cs|sk)\b/i.test(langs[0] || "") ? "cs" : "en";
  }
  const lang = choice() === "auto" ? detect() : choice();
  document.documentElement.lang = lang;

  /* Czech plural: 1, 2–4, everything else (0, 5+). */
  const cz = (n, one, few, many) =>
    n === 1 ? one : n >= 2 && n <= 4 ? few : many;
  const en = (n, one, other) => (n === 1 ? one : other);

  const STRINGS = {
    en: {
      levelWord: "LEVEL ",
      endless: "ENDLESS",
      daily: "DAILY",
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
      prevLevel: "Previous level",
      nextLevel: "Next level",
      backToLevels: "Back to the levels",
      newLevel: "New level",
      nextLevelBtn: "Next level →",
      newLevelBtn: "New level →",
      done: ({ n, total }) => `${n}/${total} done`,
      lit: ({ n, total }) => `${n} / ${total} lit`,
      board: ({ n, total }) => `Puzzle board, ${n} of ${total} receivers lit`,
      complete: "Level complete.",
      completeLast: "Level complete. That was the last one.",
      holding: "All receivers lit. Keep it like this to finish the level.",
      burning: "Every receiver is lit, but light is hitting a dark sensor.",
      stuck: "Stuck? The hint button places one piece in its correct spot.",
      moves: ({ n }) => `${n} ${en(n, "move", "moves")}`,
      newBest: "new best!",
      noHints: "no hints",
      hints: ({ n }) => `${n} ${en(n, "hint", "hints")}`,
      tileLabel: ({ n, name, diff }) => `Level ${n}, ${name}, ${diff}`,
      tileSolved: ", solved",
      tileWith: ({ hints }) => ` with ${hints}`,
      solvedCount: ({ n }) => `${n} solved`,
      left: ({ name, n }) => `${name}, ${n} left`,
      filterName: ({ color }) => `${color} filter`,
      mirror: "Mirror",
      splitter: "Splitter",
      prism: "Prism",
      filter: "Filter",
      white: "white",
      red: "red",
      green: "green",
      blue: "blue",
      yellow: "yellow",
      magenta: "magenta",
      cyan: "cyan",
      turnLeft: "Turn left (Shift+R)",
      turnRight: "Turn right (R)",
      flip: "Flip (F)",
      takeBack: "Back to the tray (Delete)",
      buildDaily: "Building today's level…",
      buildCode: "Building that level…",
      buildEasy: "Building an easy level…",
      buildMedium: "Building a medium level…",
      buildHard: "Building a hard level…",
      typicalEasy: "This takes a moment.",
      typicalMedium: "This usually takes a second or two.",
      typicalHard: "Hard levels usually take a few seconds.",
      rebuilding: "Rebuilding the level from its code.",
      tried: ({ n }) => `${n} ${en(n, "layout", "layouts")} tried`,
      play: "Play",
      playAgain: "Play again",
      dailySolved: ({ streak }) =>
        `Solved today${streak > 1 ? ` · ${streak}-day streak` : ""}. A new one comes tomorrow.`,
      dailyStreak: ({ streak }) =>
        `${streak}-day streak. Solve today's to keep it going.`,
      dailyFresh: "Everyone gets the same level today.",
      copied: "Copied",
      copyLink: "Copy link",
      couldntCopy: "Couldn't copy",
      restoreDamaged: "That restore link is damaged.",
      restoreOkTail: " Settings has the save code for later.",
      restoreBadTail: " Ask for a new one, or type the save code in Settings.",
      hasThese: ({ list }) => `This one has ${list}.`,
      lightAll: "Light every receiver.",
      notEvery: " Not every piece is needed.",
      and: " and ",
      mPortals: "portals",
      mSensors: "dark sensors",
      mDoors: "glass doors",
      mFixed: "a fixed piece",
      mLasers: "two lasers",
      // Settings
      summary: ({ solved, total, clean, wins }) =>
        `You've solved <b>${solved} of ${total}</b> levels` +
        (clean ? `, <b>${clean}</b> of them without hints` : "") +
        (wins
          ? `${clean ? "," : ""} and <b>${wins}</b> Endless level${wins === 1 ? "" : "s"}`
          : "") +
        ".",
      badCode:
        "That isn't a valid save code. Check it for typos; dashes and spaces don't matter.",
      noCodeInFile: "That file doesn't contain a save code.",
      fileUnreadable: "That file couldn't be read.",
      resetDone: "Progress reset. Every level is unsolved again.",
      restored: ({ solved, added, wins }) =>
        `Restored ${solved} solved level${solved === 1 ? "" : "s"}` +
        (added < solved ? ` (${added} new here)` : "") +
        (wins ? ` and ${wins} Endless win${wins === 1 ? "" : "s"}` : "") +
        ".",
      saveFile: ({ code, link }) =>
        "Prism save code\n\n" +
        code +
        "\n\nTo continue on another device, open Prism, go to Settings > Restore,\n" +
        "and load this file or type the code. Or open this link:\n" +
        link +
        "\n",
      // App and updates
      installed: "Prism is installed and works offline.",
      installedNow: "Installed. Prism now opens like an app and works offline.",
      newVersion: "A new version of Prism is ready.",
      reload: "Reload",
      later: "Later",
      updating: "Updating…",
      devCopy: "Development copy",
      version: ({ v }) => `Version ${v}`,
      checking: "Checking…",
      offlineCheck: "Couldn't check: you seem to be offline.",
      latest: "You have the latest version.",
      available: ({ label }) => `${label} is available.`,
      reloadToUpdate: "Reload to update",
    },
    cs: {
      levelWord: "ÚROVEŇ ",
      endless: "NEKONEČNO",
      daily: "DNEŠNÍ",
      easy: "Lehká",
      medium: "Střední",
      hard: "Těžká",
      prevLevel: "Předchozí úroveň",
      nextLevel: "Další úroveň",
      backToLevels: "Zpět na úrovně",
      newLevel: "Nová úroveň",
      nextLevelBtn: "Další úroveň →",
      newLevelBtn: "Nová úroveň →",
      done: ({ n, total }) => `${n}/${total} hotovo`,
      lit: ({ n, total }) => `svítí ${n} / ${total}`,
      board: ({ n, total }) =>
        `Hrací plocha, rozsvíceno ${n} z ${total} přijímačů`,
      complete: "Úroveň hotová.",
      completeLast: "Úroveň hotová. Byla to ta poslední.",
      holding: "Všechny přijímače svítí. Nech to tak a úroveň se dokončí.",
      burning: "Všechny přijímače svítí, ale světlo dopadá na temný senzor.",
      stuck:
        "Nevíš si rady? Tlačítko nápovědy položí jeden dílek na správné místo.",
      moves: ({ n }) => `${n} ${cz(n, "tah", "tahy", "tahů")}`,
      newBest: "nový rekord!",
      noHints: "bez nápověd",
      hints: ({ n }) => `${n} ${cz(n, "nápověda", "nápovědy", "nápověd")}`,
      tileLabel: ({ n, name, diff }) => `Úroveň ${n}, ${name}, ${diff}`,
      tileSolved: ", vyřešeno",
      tileWith: ({ hints }) => `, ${hints}`,
      solvedCount: ({ n }) => `vyřešeno ${n}`,
      left: ({ name, n }) => `${name}, zbývá ${n}`,
      filterName: ({ color }) => `${color} filtr`,
      mirror: "Zrcadlo",
      splitter: "Dělič",
      prism: "Hranol",
      filter: "Filtr",
      white: "bílý",
      red: "červený",
      green: "zelený",
      blue: "modrý",
      yellow: "žlutý",
      magenta: "purpurový",
      cyan: "azurový",
      turnLeft: "Otočit doleva (Shift+R)",
      turnRight: "Otočit doprava (R)",
      flip: "Překlopit (F)",
      takeBack: "Vrátit do zásobníku (Delete)",
      buildDaily: "Stavím dnešní úroveň…",
      buildCode: "Stavím úroveň z kódu…",
      buildEasy: "Stavím lehkou úroveň…",
      buildMedium: "Stavím střední úroveň…",
      buildHard: "Stavím těžkou úroveň…",
      typicalEasy: "Bude to hned.",
      typicalMedium: "Obvykle to trvá sekundu nebo dvě.",
      typicalHard: "Těžké úrovně obvykle trvají pár sekund.",
      rebuilding: "Skládám úroveň podle jejího kódu.",
      tried: ({ n }) => `vyzkoušeno rozvržení: ${n}`,
      play: "Hrát",
      playAgain: "Hrát znovu",
      dailySolved: ({ streak }) =>
        `Dnes vyřešeno${streak > 1 ? ` · série ${streak} ${cz(streak, "den", "dny", "dní")}` : ""}. Další úroveň bude zítra.`,
      dailyStreak: ({ streak }) =>
        `Série ${streak} ${cz(streak, "den", "dny", "dní")}. Vyřeš i dnešní, ať pokračuje.`,
      dailyFresh: "Dnes mají všichni stejnou úroveň.",
      copied: "Zkopírováno",
      copyLink: "Kopírovat odkaz",
      couldntCopy: "Nepodařilo se zkopírovat",
      restoreDamaged: "Tento odkaz pro obnovení je poškozený.",
      restoreOkTail: " Kód pro uložení najdeš v Nastavení.",
      restoreBadTail: " Požádej o nový, nebo zadej kód v Nastavení.",
      hasThese: ({ list }) => `Tady najdeš ${list}.`,
      lightAll: "Rozsviť všechny přijímače.",
      notEvery: " Ne každý dílek je potřeba.",
      and: " a ",
      mPortals: "portály",
      mSensors: "temné senzory",
      mDoors: "skleněné dveře",
      mFixed: "pevný dílek",
      mLasers: "dva lasery",
      summary: ({ solved, total, clean, wins }) =>
        `Vyřešené úrovně: <b>${solved} z ${total}</b>` +
        (clean ? `, z toho bez nápověd: <b>${clean}</b>` : "") +
        (wins ? `. Výhry v Nekonečnu: <b>${wins}</b>` : "") +
        ".",
      badCode:
        "To není platný kód. Zkontroluj překlepy; na pomlčkách a mezerách nezáleží.",
      noCodeInFile: "Ten soubor neobsahuje kód pro uložení.",
      fileUnreadable: "Soubor se nepodařilo přečíst.",
      resetDone: "Postup smazán. Všechny úrovně jsou znovu nevyřešené.",
      restored: ({ solved, added, wins }) =>
        `Obnovené vyřešené úrovně: ${solved}` +
        (added < solved ? ` (nové na tomto zařízení: ${added})` : "") +
        (wins ? `, výhry v Nekonečnu: ${wins}` : "") +
        ".",
      saveFile: ({ code, link }) =>
        "Prism – kód pro uložení\n\n" +
        code +
        "\n\nNa jiném zařízení otevři Prism, jdi do Nastavení > Obnovit\n" +
        "a nahraj tento soubor nebo opiš kód. Nebo otevři tento odkaz:\n" +
        link +
        "\n",
      installed: "Prism je nainstalovaný a funguje bez internetu.",
      installedNow:
        "Nainstalováno. Prism se teď otevírá jako aplikace a funguje bez internetu.",
      newVersion: "Je připravena nová verze Prismu.",
      reload: "Načíst znovu",
      later: "Později",
      updating: "Aktualizuji…",
      devCopy: "Vývojová kopie",
      version: ({ v }) => `Verze ${v}`,
      checking: "Kontroluji…",
      offlineCheck: "Nepodařilo se ověřit: zřejmě jsi offline.",
      latest: "Máš nejnovější verzi.",
      available: ({ label }) => `${label} je k dispozici.`,
      reloadToUpdate: "Načíst znovu a aktualizovat",
    },
  };

  function t(key, vars = {}) {
    const s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
    return typeof s === "function" ? s(vars) : s;
  }

  /* "a, b and c" in the current language. */
  function list(items) {
    if (items.length < 2) return items.join("");
    return items.slice(0, -1).join(", ") + t("and") + items[items.length - 1];
  }

  /* ------------------------------ levels ------------------------------ */

  const levelText = (lv) => {
    const cs = lang === "cs" && root.PrismLevelsCs && root.PrismLevelsCs[lv.id];
    return cs ? { name: cs[0], hint: cs[1] } : { name: lv.name, hint: lv.hint };
  };

  /* Endless names are "Adjective Noun" from the generator's lists; in
     Czech the adjective agrees with the noun's gender. */
  const ADJ_EN = [
    "Amber",
    "Quiet",
    "Hollow",
    "Bright",
    "Silver",
    "Folded",
    "Distant",
    "Narrow",
    "Velvet",
    "Restless",
    "Sunken",
    "Paper",
    "Cold",
    "Second",
    "Lucky",
    "Tilted",
  ];
  const NOUN_EN = [
    "Lens",
    "Relay",
    "Corner",
    "Halo",
    "Lantern",
    "Signal",
    "Mirror",
    "Spectrum",
    "Window",
    "Beacon",
    "Passage",
    "Flare",
    "Arc",
    "Gate",
    "Ember",
    "Glint",
  ];
  // Stems of hard adjectives: + ý (masculine), á (feminine), é (neuter).
  const ADJ_CS = [
    "jantarov",
    "tich",
    "dut",
    "jasn",
    "stříbrn",
    "složen",
    "vzdálen",
    "úzk",
    "sametov",
    "neklidn",
    "potopen",
    "papírov",
    "studen",
    "druh",
    "šťastn",
    "nakloněn",
  ];
  const NOUN_CS = [
    ["čočka", "f"],
    ["relé", "n"],
    ["kout", "m"],
    ["halo", "n"],
    ["lucerna", "f"],
    ["signál", "m"],
    ["zrcadlo", "n"],
    ["spektrum", "n"],
    ["okno", "n"],
    ["maják", "m"],
    ["průchod", "m"],
    ["záblesk", "m"],
    ["oblouk", "m"],
    ["brána", "f"],
    ["žár", "m"],
    ["třpyt", "m"],
  ];
  const ENDING = { m: "ý", f: "á", n: "é" };
  function endlessName(name) {
    if (lang !== "cs") return name;
    const [a, n] = name.split(" ");
    const i = ADJ_EN.indexOf(a),
      j = NOUN_EN.indexOf(n);
    if (i < 0 || j < 0) return name;
    const [noun, g] = NOUN_CS[j];
    const adj = ADJ_CS[i] + ENDING[g];
    return adj[0].toUpperCase() + adj.slice(1) + " " + noun;
  }

  /* ------------------------------ static text ------------------------------ */

  const STATIC_CS = {
    // Game page
    Levels: "Úrovně",
    "Next level →": "Další úroveň →",
    "Arrow keys move around the board. Enter places the selected tray piece or turns a placed one. R and Shift+R turn, F flips a prism, Delete takes a piece back to the tray.":
      "Šipkami se pohybuješ po ploše. Enter položí vybraný dílek ze zásobníku nebo otočí položený. R a Shift+R otáčí, F překlopí hranol, Delete vrátí dílek do zásobníku.",
    "Building a level…": "Stavím úroveň…",
    Cancel: "Zrušit",
    "Today's level": "Dnešní úroveň",
    Play: "Hrát",
    Endless: "Nekonečno",
    "New levels, made on the spot. Each one has a code you can share.":
      "Nové úrovně vytvořené na místě. Každá má kód, který můžeš poslat dál.",
    Easy: "Lehká",
    Medium: "Střední",
    Hard: "Těžká",
    "Level code": "Kód úrovně",
    "That code doesn't make a level. Codes are E, M or H, then a dash and a number, like M-48213.":
      "Z tohoto kódu úroveň nevznikne. Kód je E, M nebo H, pomlčka a číslo, třeba M-48213.",
    "This level:": "Tato úroveň:",
    "Copy link": "Kopírovat odkaz",
    "Hint: place one piece correctly": "Nápověda: polož jeden dílek správně",
    "Reset level": "Začít znovu",
    "How to play": "Jak hrát",
    Settings: "Nastavení",
    "Previous level": "Předchozí úroveň",
    "Next level": "Další úroveň",
    Undo: "Zpět",
    "Undo (Ctrl+Z)": "Zpět (Ctrl+Z)",
    Redo: "Znovu",
    "Redo (Ctrl+Shift+Z)": "Znovu (Ctrl+Shift+Z)",
    "Puzzle board": "Hrací plocha",
    "Piece actions": "Akce s dílkem",
    Pieces: "Dílky",
    Close: "Zavřít",
    // Shared
    "← Back to the game": "← Zpět do hry",
    // Help page
    "Prism · How to play": "Prism · Jak hrát",
    "PRISM · HOW TO PLAY": "PRISM · JAK HRÁT",
    "Bend the light into every receiver": "Dostaň světlo do každého přijímače",
    "Each level has one or more lasers and receivers. Place and turn pieces so every receiver gets light of exactly the color it shows, while no dark sensor gets any light at all.":
      "Každá úroveň má jeden nebo více laserů a přijímačů. Pokládej a otáčej dílky tak, aby každý přijímač dostal světlo přesně té barvy, kterou ukazuje, a na žádný temný senzor nedopadlo vůbec žádné světlo.",
    Controls: "Ovládání",
    "Place.": "Pokládání.",
    "Tap a piece in the tray, then tap an empty tile. You can also drag it straight onto the board.":
      "Ťukni na dílek v zásobníku a pak na prázdné pole. Dílek můžeš také přetáhnout rovnou na plochu.",
    "Turn.": "Otáčení.",
    "Tap a placed piece. Mirrors and splitters turn in 22.5° steps, so light can bend by 45° or 90°.":
      "Ťukni na položený dílek. Zrcadla a děliče se otáčí po 22,5°, takže světlo se může ohnout o 45° nebo 90°.",
    "Move or take back.": "Přesun a vrácení.",
    "Drag a placed piece to another tile, or drop it on the tray.":
      "Přetáhni položený dílek na jiné pole, nebo ho pusť na zásobník.",
    "Mouse.": "Myš.",
    "Point at a placed piece for buttons to turn it either way, flip a prism, or take it back to the tray.":
      "Najeď na položený dílek a objeví se tlačítka pro otočení oběma směry, překlopení hranolu a vrácení do zásobníku.",
    "Keyboard.": "Klávesnice.",
    "Tab to the board and move with the arrow keys. Enter places the piece selected in the tray or turns the one under the cursor; R and Shift+R turn, F flips a prism, Delete takes a piece back.":
      "Tabulátorem přejdi na plochu a pohybuj se šipkami. Enter položí dílek vybraný v zásobníku nebo otočí ten pod kurzorem; R a Shift+R otáčí, F překlopí hranol, Delete dílek vrátí.",
    "Undo.": "Zpět.",
    "The curved arrows next to the level list undo and redo any move, including a hint. With a keyboard: Ctrl+Z and Ctrl+Shift+Z.":
      "Zahnuté šipky vedle seznamu úrovní vrátí a znovu provedou jakýkoli tah, i nápovědu. Na klávesnici: Ctrl+Z a Ctrl+Shift+Z.",
    "Your best.": "Tvůj rekord.",
    "Finishing a level shows your moves and time; the level list keeps your best of each.":
      "Po dokončení úrovně uvidíš počet tahů a čas; seznam úrovní si pamatuje tvůj nejlepší výsledek v obojím.",
    "Not every piece is needed.": "Ne každý dílek je potřeba.",
    "From level 3 on, the tray also holds decoys.":
      "Od 3. úrovně jsou v zásobníku i dílky navíc, které nejsou potřeba.",
    "Hint.": "Nápověda.",
    "The bulb button places one piece in its correct spot and locks it, marked with a star. If you haven't moved for 30 seconds, the bulb glows. The level list shows the fewest hints you've needed for each level, so you can come back and solve it without any.":
      "Tlačítko s žárovkou položí jeden dílek na správné místo a zamkne ho; poznáš ho podle hvězdičky. Když 30 sekund nic neuděláš, žárovka se rozzáří. Seznam úrovní ukazuje u každé úrovně nejmenší počet použitých nápověd, takže se můžeš vrátit a vyřešit ji bez nich.",
    "Levels.": "Úrovně.",
    "Use the arrows to step through levels, or":
      "Šipkami procházíš úrovně jednu po druhé, tlačítkem",
    "to jump to any of them. Progress is saved in this browser.":
      "skočíš na kteroukoli z nich. Postup se ukládá v tomto prohlížeči.",
    "Today's level.": "Dnešní úroveň.",
    "At the top of the level list: one new level every day, the same for everyone. Solve it on consecutive days to build a streak.":
      "Nahoře v seznamu úrovní: každý den jedna nová úroveň, pro všechny stejná. Když ji řešíš den po dni, roste ti série.",
    "Endless.": "Nekonečno.",
    "At the bottom of the level list, pick Easy, Medium or Hard for new levels made on the spot. Each one has a code, such as M-48213, and a link you can copy, so a friend can play the same level.":
      "Dole v seznamu úrovní vyber Lehká, Střední nebo Těžká a dostaneš nové úrovně vytvořené na místě. Každá má kód, třeba M-48213, a odkaz, který můžeš zkopírovat, aby kamarád mohl hrát stejnou úroveň.",
    "Sound.": "Zvuk.",
    "Each color has its own note, so you can hear receivers light up and a finished board sounds like a chord. Turn sound off or change the volume in Settings.":
      "Každá barva má svůj tón, takže uslyšíš, jak se přijímače rozsvěcují, a hotová úroveň zní jako akord. Zvuk vypneš nebo zeslabíš v Nastavení.",
    "Another device.": "Jiné zařízení.",
    "Progress is saved in this browser. To continue elsewhere, open Settings (the gear button) and scan the QR code with the other device, or copy the link. There is also a save code you can type or download as a file. Restoring adds to what is already there; it never removes anything.":
      "Postup se ukládá v tomto prohlížeči. Chceš-li pokračovat jinde, otevři Nastavení (ozubené kolečko) a naskenuj QR kód druhým zařízením, nebo zkopíruj odkaz. K dispozici je i kód, který můžeš opsat nebo stáhnout jako soubor. Obnovení jen přidává k tomu, co už na zařízení je; nic nemaže.",
    "Install and play offline": "Instalace a hraní bez internetu",
    "Offline.": "Bez internetu.",
    "After you have opened Prism once, it works without internet, including Endless levels.":
      "Jakmile Prism jednou otevřeš, funguje i bez internetu, včetně Nekonečna.",
    "Install.": "Instalace.",
    "In Chrome, Edge or on Android, open Settings and press":
      "V Chromu, Edge nebo na Androidu otevři Nastavení a v části Aplikace stiskni",
    "Install app": "Instalovat aplikaci",
    "under App. Prism then opens from your home screen or app list like any other app.":
      ". Prism se pak otevírá z plochy nebo ze seznamu aplikací jako každá jiná aplikace.",
    "Updates.": "Aktualizace.",
    "When a new version is out, a banner offers to reload. Settings shows the version you have and can check for updates.":
      "Když vyjde nová verze, objeví se lišta s nabídkou načíst ji. Nastavení ukazuje, jakou verzi máš, a umí zkontrolovat aktualizace.",
    "iPhone and iPad.": "iPhone a iPad.",
    "In Safari, tap": "V Safari klepni na",
    Share: "Sdílet",
    ", then": ", pak na",
    "Add to Home Screen": "Přidat na plochu",
    ". The Home Screen app keeps its own progress, separate from Safari: copy your save code in Settings first, then restore it in the app.":
      ". Aplikace na ploše má vlastní postup, oddělený od Safari: nejdřív si v Nastavení zkopíruj kód a pak ho v aplikaci obnov.",
    "Reading the light": "Jak číst světlo",
    "Direction arrows": "Šipky směru",
    "Arrows run along each beam in the direction the light travels. Light sent straight back, by a mirror square to the beam, splits into two lanes with arrows pointing opposite ways.":
      "Šipky na paprsku ukazují, kterým směrem světlo letí. Světlo poslané zrcadlem přímo zpět se rozdělí do dvou pruhů se šipkami opačným směrem.",
    "Finishing a level": "Dokončení úrovně",
    "When every receiver is lit, rings around them fill up. Keep the board as it is for a moment and the level counts as finished. Any change starts the wait again.":
      "Když svítí všechny přijímače, kroužky kolem nich se začnou plnit. Nech plochu chvíli být a úroveň se započítá. Každá změna čekání spustí znovu.",
    "Colors add up": "Barvy se sčítají",
    "Light arriving at the same receiver mixes: red and blue make magenta, red and green make yellow, green and blue make cyan, and all three make white. A receiver lights only for its own color.":
      "Světlo, které dorazí do stejného přijímače, se mísí: červená a modrá dají purpurovou, červená a zelená žlutou, zelená a modrá azurovou a všechny tři bílou. Přijímač se rozsvítí jen svou barvou.",
    Board: "Hrací plocha",
    "Laser and wall": "Laser a zeď",
    "A laser sends a beam in a straight line. Most lasers send white light; some send a single color. Walls and the board's edge stop light.":
      "Laser vysílá paprsek v přímce. Většina laserů svítí bíle, některé jen jednou barvou. Zdi a okraj plochy světlo zastaví.",
    Receiver: "Přijímač",
    "The ring shows the color it needs. Wrong-colored light leaves a small dot of that color in the middle; the right color lights the whole receiver.":
      "Kroužek ukazuje barvu, kterou potřebuje. Světlo špatné barvy po sobě nechá uprostřed malou tečku; správná barva rozsvítí celý přijímač.",
    "Glass door": "Skleněné dveře",
    "A wall made of colored glass. It lets only its own color through, so white light leaves it red, green or blue, and other colors stop at it.":
      "Stěna z barevného skla. Propustí jen svou barvu, takže bílé světlo z ní vyjde červené, zelené nebo modré a ostatní barvy se o ni zastaví.",
    "Dark sensor": "Temný senzor",
    new: "nové",
    "Must stay dark. If any light reaches it, it flashes and the level can't be finished. Watch out for the second beam from a splitter.":
      "Musí zůstat ve tmě. Když na něj dopadne jakékoli světlo, zabliká a úroveň nejde dokončit. Pozor na druhý paprsek z děliče.",
    Portal: "Portál",
    "Portals come in pairs of the same color. Light entering one leaves the other, keeping its direction and color.":
      "Portály jsou v párech stejné barvy. Světlo, které vstoupí do jednoho, vyjde druhým se stejným směrem i barvou.",
    Mirror: "Zrcadlo",
    "Reflects light. Each tap turns it 22.5°, which changes the beam's direction by 45°. Square to the beam, it sends the light straight back.":
      "Odráží světlo. Každé ťuknutí ho otočí o 22,5°, což změní směr paprsku o 45°. Kolmo k paprsku pošle světlo přímo zpět.",
    Splitter: "Dělič",
    "Half-silvered glass. It lets the light through and also reflects a copy like a mirror would, so one beam becomes two.":
      "Polopropustné zrcadlo. Světlo propustí a zároveň odrazí jeho kopii jako zrcadlo, takže z jednoho paprsku jsou dva.",
    Prism: "Hranol",
    "Splits white light: green goes straight on, red and blue bend 45° to either side. Tap it to flip which side red and blue go.":
      "Rozloží bílé světlo: zelená jde rovně, červená a modrá se ohnou o 45° každá na jinou stranu. Ťuknutím prohodíš, kam jde červená a kam modrá.",
    Filter: "Filtr",
    "Colored glass you can place. It passes only the colors it shows: a yellow filter turns white light yellow and blocks blue.":
      "Barevné sklíčko, které můžeš položit. Propustí jen barvy, které ukazuje: žlutý filtr udělá z bílého světla žluté a modrou zastaví.",
    "Fixed piece": "Pevný dílek",
    "Comes with the level and has bolts in its corners. You can tap it to turn it, but you can't move it or take it away.":
      "Patří k úrovni a má v rozích šrouby. Ťuknutím ho otočíš, ale přesunout ani odebrat ho nejde.",
    "Animation: light reflected straight back drawn as two lanes":
      "Animace: světlo odražené přímo zpět ve dvou pruzích",
    "Animation: rings around receivers filling up":
      "Animace: plnící se kroužky kolem přijímačů",
    "Animation: red and blue light together lighting a magenta receiver":
      "Animace: červené a modré světlo společně rozsvítí purpurový přijímač",
    "Animation: a laser beam stopping at a wall":
      "Animace: laserový paprsek se zastaví o zeď",
    "Animation: a receiver lighting only for its own color":
      "Animace: přijímač se rozsvítí jen svou barvou",
    "Animation: a red glass door passing only red light":
      "Animace: červené skleněné dveře propustí jen červené světlo",
    "Animation: a dark sensor lighting up when the beam hits it":
      "Animace: temný senzor se rozsvítí, když na něj dopadne paprsek",
    "Animation: a beam entering one portal and leaving its twin":
      "Animace: paprsek vstoupí do portálu a vyjde jeho dvojčetem",
    "Animation: a mirror turning through its positions":
      "Animace: zrcadlo se otáčí svými polohami",
    "Animation: a splitter sending light two ways":
      "Animace: dělič posílá světlo dvěma směry",
    "Animation: a prism splitting white light and flipping":
      "Animace: hranol rozkládá bílé světlo a překlápí se",
    "Animation: a filter changing the beam's color":
      "Animace: filtr mění barvu paprsku",
    "Animation: a fixed mirror turning in place":
      "Animace: pevné zrcadlo se otáčí na místě",
    // Settings page
    "Prism · Settings": "Prism · Nastavení",
    "PRISM · SETTINGS": "PRISM · NASTAVENÍ",
    Language: "Jazyk",
    "Auto uses your browser's language.":
      "Automaticky podle jazyka prohlížeče.",
    Theme: "Vzhled",
    Auto: "Automaticky",
    Light: "Světlý",
    Dark: "Tmavý",
    "Auto follows your device's light or dark setting.":
      "Automaticky podle světlého nebo tmavého režimu zařízení.",
    Sound: "Zvuk",
    "Sound effects": "Zvukové efekty",
    Volume: "Hlasitost",
    "Each color has its own note: red, green and blue light play C, E and G, so a finished board sounds like a chord.":
      "Každá barva má svůj tón: červené, zelené a modré světlo hrají C, E a G, takže hotová úroveň zní jako akord.",
    "Play a sample": "Přehrát ukázku",
    "Continue on another device": "Pokračovat na jiném zařízení",
    "Progress is saved in this browser.":
      "Postup se ukládá v tomto prohlížeči.",
    "Open the link on the other device, or scan the QR code with its camera. The game opens there with your progress added; nothing it already has is removed.":
      "Otevři odkaz na druhém zařízení, nebo naskenuj QR kód jeho fotoaparátem. Hra se tam otevře s přidaným postupem; nic, co už tam je, se nesmaže.",
    "Show QR code": "Zobrazit QR kód",
    "Hide QR code": "Skrýt QR kód",
    "Share…": "Sdílet…",
    "Scan with the other device's camera.":
      "Naskenuj fotoaparátem druhého zařízení.",
    "Save code and file": "Kód a soubor",
    "The same progress as a code you can type on the other device, under Settings > Restore. Dashes and spaces don't matter.":
      "Stejný postup jako kód, který můžeš opsat na druhém zařízení v Nastavení > Obnovit. Na pomlčkách a mezerách nezáleží.",
    "Copy code": "Kopírovat kód",
    "Download file": "Stáhnout soubor",
    Restore: "Obnovit",
    "Type a save code or load a save file from another device.":
      "Zadej kód nebo nahraj soubor z jiného zařízení.",
    "Save code": "Kód pro uložení",
    "Load a file": "Nahrát soubor",
    App: "Aplikace",
    "Prism works offline once it has been opened here, and can be installed like an app.":
      "Jakmile Prism tady jednou otevřeš, funguje i bez internetu a dá se nainstalovat jako aplikace.",
    "On iPhone or iPad: tap": "Na iPhonu nebo iPadu: klepni na",
    ". The Home Screen app keeps its own progress, so copy your save code above first and restore it there.":
      ". Aplikace na ploše má vlastní postup, takže si nejdřív zkopíruj kód výše a pak ho tam obnov.",
    "Check for updates": "Zkontrolovat aktualizace",
    Reset: "Smazat",
    "Remove all solved levels and Endless wins from this browser.":
      "Smaže z tohoto prohlížeče všechny vyřešené úrovně a výhry v Nekonečnu.",
    "Reset progress…": "Smazat postup…",
    "This can't be undone": "Nejde to vzít zpět,",
    "unless you saved a code first.": "pokud nemáš uložený kód.",
    "QR code with a link to your progress": "QR kód s odkazem na tvůj postup",
  };

  /* Swaps static English text for Czech, keeping surrounding whitespace. */
  function apply(rootEl) {
    if (lang !== "cs") return;
    const norm = (s) => s.replace(/\s+/g, " ").trim();
    const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const node of nodes) {
      const key = norm(node.nodeValue);
      const cs = STATIC_CS[key];
      if (!cs) continue;
      const lead = /^\s*/.exec(node.nodeValue)[0];
      const trail = /\s*$/.exec(node.nodeValue)[0];
      node.nodeValue = (lead ? " " : "") + cs + (trail ? " " : "");
    }
    for (const el of rootEl.querySelectorAll(
      "[aria-label],[title],[placeholder],[alt]",
    ))
      for (const a of ["aria-label", "title", "placeholder", "alt"]) {
        const v = el.getAttribute(a);
        if (v && STATIC_CS[norm(v)]) el.setAttribute(a, STATIC_CS[norm(v)]);
      }
    // Only page titles like "Prism · Settings": "Prism" alone is the game's
    // name, not the piece.
    if (document.title.includes(" · ") && STATIC_CS[document.title])
      document.title = STATIC_CS[document.title];
  }
  if (lang === "cs") {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", () => apply(document.body));
    else apply(document.body);
  }

  function setChoice(v) {
    try {
      if (v === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, v);
    } catch (e) {
      /* won't persist */
    }
  }

  root.PrismI18n = {
    lang,
    locale: lang === "cs" ? "cs-CZ" : "en-GB",
    choice,
    setChoice,
    t,
    list,
    levelText,
    endlessName,
    apply,
    STATIC_CS,
  };
})(window);
