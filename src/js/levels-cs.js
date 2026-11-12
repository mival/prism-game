"use strict";

/* Czech names and hints for the campaign levels, by level id. Used by
   src/js/i18n.js when the game is in Czech. */
(function (root) {
  const LEVELS_CS = {
    "first-light": [
      "První světlo",
      "Polož zrcadlo tam, kde stočí paprsek dolů do přijímače. Ťuknutím na položený dílek ho otočíš.",
    ],
    spectrum: [
      "Spektrum",
      "Hranol rozloží bílé světlo na červenou, zelenou a modrou. Každý přijímač se rozsvítí jen svou barvou.",
    ],
    "glass-doors": [
      "Skleněné dveře",
      "Barevné sklo propustí jen svou barvu. Dělič pošle paprsek dvěma směry naráz. Odteď nebude potřeba každý dílek ze zásobníku.",
    ],
    recombine: [
      "Znovu spolu",
      "Filtry jsou sklíčka, která můžeš položit. Propustí jen barvy, které ukazují.",
    ],
    echo: [
      "Ozvěna",
      "Zrcadlo kolmo k paprsku pošle světlo přímo zpět. Sleduj šipky: vracející se světlo může najít novou cestu.",
    ],
    "three-ways": [
      "Tři cesty",
      "Tři přijímače, jeden paprsek. Každý dělič odkloní část světla stranou a zbytek pustí dál.",
    ],
    detour: [
      "Objížďka",
      "Zrcadlo o krok méně než kolmo ohne světlo o 45°. Najdi cestu mezerou v přepážce.",
    ],
    "two-lasers": [
      "Dva lasery",
      "Dva lasery, jeden přijímač. Dělič světlo i propouští, takže paprsky mohou sdílet cestu.",
    ],
    "mirror-image": [
      "Zrcadlový obraz",
      "Ťuknutím na hranol prohodíš, na kterou stranu odchází červená a modrá.",
    ],
    crossroads: [
      "Křižovatka",
      "Červená a zelená dají žlutou. Přiveď oba lasery do stejného přijímače.",
    ],
    daybreak: [
      "Svítání",
      "Červená, zelená a modrá dohromady dají bílou. Pošli každou svými skleněnými dveřmi.",
    ],
    wormhole: [
      "Červí díra",
      "Světlo, které vstoupí do portálu, vyjde jeho dvojčetem, druhým kruhem stejné barvy, a letí dál stejným směrem.",
    ],
    "lights-out": [
      "Zhasnuto",
      "Osmiúhelníky jsou temné senzory. Rozsviť přijímač tak, aby na žádný senzor nedopadlo světlo.",
    ],
    "fixed-point": [
      "Pevný bod",
      "Dílky se šrouby v rozích jsou pevné: ťuknutím je otočíš, ale přesunout ani odebrat je nejde.",
    ],
    "stained-glass": [
      "Vitráž",
      "Každé skleněné dveře rozhodnou, která barva pokračuje. Sleduj světlo a zjisti, ke kterému přijímači dojde.",
    ],
    "far-side": [
      "Odvrácená strana",
      "Ne každá barva musí projít portálem. Sleduj, kam která jde za hranolem.",
    ],
    relay: [
      "Štafeta",
      "Dva páry portálů. Barva kruhu prozradí, ze kterého dvojčete světlo vyjde.",
    ],
    tunnels: [
      "Tunely",
      "Dva páry portálů. Jeden přijímač je blíž, než se zdá.",
    ],
    "warp-drive": [
      "Warp pohon",
      "Dva páry portálů a hranol. Červená i modrá si najdou každá svou cestu ven.",
    ],
    ricochet: [
      "Odraz",
      "Jeden dělič a dva přijímače. Světlo, které projde rovně, je jen polovina práce.",
    ],
    lantern: [
      "Lucerna",
      "Dvě zrcadla a jeden temný senzor. Jdi kolem něj, ne skrz.",
    ],
    pinhole: [
      "Dírková komora",
      "Pár portálů a dvě zrcadla. Nejdřív zjisti, kde světlo vyjde.",
    ],
    "glass-house": [
      "Skleník",
      "Zelené a červené dveře. Rozděl bílý paprsek a nech každé dveře vybrat svou barvu.",
    ],
    magenta: [
      "Purpur",
      "Barvy se sčítají. Červená a modrá v jednom přijímači dají purpurovou.",
    ],
    rainbow: [
      "Duha",
      "Část bílého světla nech bílou a zbytek rozlož na barvy.",
    ],
    minefield: [
      "Minové pole",
      "I druhý paprsek z děliče musí někam dopadnout. Žádný senzor nesmí svítit.",
    ],
    sieve: [
      "Síto",
      "Filtry barvy odebírají. Rozděl paprsek a každé části nech jen to, co potřebuje její přijímač.",
    ],
    afterglow: [
      "Dosvit",
      "Oba přijímače chtějí bílé světlo. Dělič vytvoří dva bílé paprsky a tři senzory čekají na každé zbloudilé světlo.",
    ],
    "double-prism": [
      "Dvojitý hranol",
      "Hranol ohýbá i jedinou barvu: červená a modrá se stočí o 45°, zelená jde rovně.",
    ],
    labyrinth: [
      "Labyrint",
      "Jeden paprsek, jeden přijímač, čtyři zrcadla a tři senzory. Jediná cesta je ta dlouhá.",
    ],
    "hall-of-mirrors": [
      "Zrcadlový sál",
      "Dvě pevná zrcadla a dvě tvoje. Cestu lemují senzory.",
    ],
    "filter-bank": [
      "Sada filtrů",
      "Oba přijímače chtějí modrou. Filtry barvy berou, dělič vytvoří druhý paprsek.",
    ],
    eclipse: [
      "Zatmění",
      "Pět temných senzorů a tři zrcadla. Každá zatáčka se jim musí vyhnout.",
    ],
    periscope: [
      "Periskop",
      "Jeden pár portálů a dva bílé přijímače. Rozděl světlo tam, odkud obě poloviny ještě dojdou domů.",
    ],
    mirage: [
      "Fata morgána",
      "Dva páry portálů, tři zrcadla, jeden přijímač. Světlo vyjde z portálu tam, kde to nečekáš.",
    ],
    gatekeeper: [
      "Strážce brány",
      "Dvoje skleněné dveře a dva děliče. Každé dveře rozhodnou, která barva projde.",
    ],
    aurora: [
      "Polární záře",
      "Hranol a dvě zrcadla. Dva přijímače, dvě barvy a dva senzory, kterým se musíš vyhnout.",
    ],
    "dual-core": [
      "Dvě jádra",
      "Bílý laser a červený. Zelený přijímač rozsvítí jen ten bílý.",
    ],
    gearbox: [
      "Převodovka",
      "Nejdřív otoč pevným děličem, pak uvidíš, kam patří hranol.",
    ],
    "twin-beams": [
      "Dvojčata",
      "Dva lasery, každý se svou barvou. Některé přijímače chtějí obě.",
    ],
    clockwork: [
      "Hodinový strojek",
      "Jedno pevné zrcadlo, pár portálů, hranol a dělič musí spolupracovat.",
    ],
    supernova: [
      "Supernova",
      "Všechno, co už umíš, v jedné úrovni. Pozor na senzory.",
    ],
    lighthouse: [
      "Maják",
      "Dva pevné dílky k otočení a dvě zrcadla k položení. Nejdřív otoč ty pevné a sleduj, kam jde světlo.",
    ],
    crossfire: [
      "Křížová palba",
      "Tři lasery: červený, zelený a modrý. Azurový přijímač potřebuje, aby se dva z nich potkaly.",
    ],
    kaleidoscope: [
      "Kaleidoskop",
      "Purpurová, zelená a modrá. Dělič propustí každou barvu, hranol je roztřídí.",
    ],
    "color-wheel": [
      "Barevný kruh",
      "Jeden přijímač hlídají modré skleněné dveře. Rozděl bílý paprsek dřív, než ho rozložíš na barvy.",
    ],
    interference: [
      "Interference",
      "Každý laser má svou barvu a červené přijímače jsou dva. Jeden dělič nestačí.",
    ],
    "big-bang": [
      "Velký třesk",
      "Všechno najednou: pevné zrcadlo, pár portálů, dělič a hranol. Začni pevným zrcadlem.",
    ],
    tricolor: [
      "Trikolóra",
      "Červený, zelený a modrý laser, ale zelenou nechce žádný přijímač. Odkliď ji z cesty.",
    ],
    switchback: [
      "Serpentina",
      "Dva červené přijímače a modrý laser, který nesmí pokazit ani jeden z nich.",
    ],
    wavelength: [
      "Vlnová délka",
      "Modrá, zelená a žlutá. Žlutá je červená a zelená, které dorazí spolu.",
    ],
    "binary-star": [
      "Dvojhvězda",
      "Dva lasery a tři přijímače. Jeden z nich je snazší, než vypadá.",
    ],
    refraction: [
      "Lom světla",
      "Dva hranoly a dvě zrcadla. Každý přijímač chce jedinou barvu.",
    ],
    overdrive: [
      "Plný výkon",
      "Pevný dělič napájí všechno. Žlutý přijímač potřebuje, aby se potkala červená a zelená.",
    ],
    "event-horizon": [
      "Horizont událostí",
      "Pár portálů, dělič a hranol. Dva přijímače chtějí zelenou a jsou daleko od sebe.",
    ],
    finale: [
      "Finále",
      "Pevné zrcadlo, pár portálů, skleněné dveře, dělič a hranol, všechno v jedné úrovni.",
    ],
    "spectral-lock": [
      "Spektrální zámek",
      "Červený, zelený a modrý laser. Dva přijímače chtějí zelenou a jeden dělič umí udělat dva zelené paprsky.",
    ],
    "night-shift": [
      "Noční směna",
      "Pevné zrcadlo je na začátku otočené špatně. Oba přijímače chtějí bílou.",
    ],
    zenith: [
      "Zenit",
      "Pevný hranol a zelené skleněné dveře. Otoč hranol tak, aby každá barva došla ke svému přijímači.",
    ],
    quasar: [
      "Kvasar",
      "Pevný dělič, pár portálů a hranol, se třemi přijímači a třemi senzory.",
    ],
  };
  root.PrismLevelsCs = LEVELS_CS;
})(typeof window !== "undefined" ? window : globalThis);
