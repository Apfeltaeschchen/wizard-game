// =====================================================================
// GRIMOIRE ONLINE - KOSMETIK-KATALOG, LOOTBOX-DROPS & LEVEL-PROGRESSION
// Etappe 6: Magische Schatztruhen & Overwatch-2-Style Progression
// =====================================================================

const RARITY_CONFIG = {
  common: { name: 'Gewöhnlich', color: '#e2e8f0', dustValue: 15, dustCost: 60 },
  rare: { name: 'Selten', color: '#38bdf8', dustValue: 40, dustCost: 160 },
  epic: { name: 'Episch', color: '#c084fc', dustValue: 120, dustCost: 480 },
  legendary: { name: 'Legendär', color: '#fbbf24', dustValue: 400, dustCost: 1200 }
};

const CHEST_TIERS = {
  wooden: {
    name: 'Holztruhe des Lehrlings',
    icon: '🪵',
    itemCount: 2,
    rarityChances: { common: 0.80, rare: 0.18, epic: 0.02, legendary: 0.00 }
  },
  silver: {
    name: 'Silberne Magiertruhe',
    icon: '🥈',
    itemCount: 3,
    rarityChances: { common: 0.50, rare: 0.40, epic: 0.09, legendary: 0.01 }
  },
  gold: {
    name: 'Goldene Erzmagier-Truhe',
    icon: '👑',
    itemCount: 4,
    rarityChances: { common: 0.20, rare: 0.45, epic: 0.25, legendary: 0.10 }
  }
};

const COSMETICS_CATALOG = {
  avatar_icons: [
    // Standard-Avatar: Initialen-Medaillon mit großem Anfangsbuchstaben
    { id: 'default', name: 'Initialen-Medaillon', rarity: 'common', isDefault: true, lore: 'Dein persönliches Magier-Siegel mit deinem großen Anfangsbuchstaben.' },

    // Freischaltbare Artworks (via image-generator)
    { id: 'icon_pyromancer', name: 'Flammen-Erzmagier', rarity: 'epic', image: '/images/avatars/icon_pyromancer.png', lore: 'Gebieter über die sengende Glut der Zitadelle.' },
    { id: 'icon_moon_witch', name: 'Mondhexe', rarity: 'epic', image: '/images/avatars/icon_moon_witch.png', lore: 'Hüterin der silbernen Mondsichel und der Gezeitengeheimnisse.' },
    { id: 'icon_jester', name: 'Scharlatan', rarity: 'rare', image: '/images/avatars/icon_jester.png', lore: 'Keiner weiß, wer hinter der lächelnden Porzellanmaske steckt.' },
    { id: 'icon_dragon', name: 'Lindwurm', rarity: 'legendary', image: '/images/avatars/icon_dragon.png', lore: 'Ein Furcht einflößendes Relikt aus dem Zeitalter des Feuers.' },
    { id: 'icon_forest_nymph', name: 'Waldnymphe', rarity: 'rare', image: '/images/avatars/icon_forest_nymph.png', lore: 'Geboren aus uraltem Moos und leuchtendem Feenstaub.' },
    { id: 'icon_necromancer', name: 'Nekromant', rarity: 'rare', image: '/images/avatars/icon_necromancer.png', lore: 'Spricht im Flüsterton mit den Seelen verblichener Kartenspieler.' },
    { id: 'icon_vampire', name: 'Vampir-Graf', rarity: 'epic', image: '/images/avatars/icon_vampire.png', lore: 'Ein edler Aristokrat aus den finsteren Gewölben der Nacht.' },
    { id: 'icon_seer', name: 'Astralseherin', rarity: 'legendary', image: '/images/avatars/icon_seer.png', lore: 'Sieht jeden Stich voraus, noch bevor das Deck gemischt wird.' },

    // Weihnachts-Spezial (Winter Solstice & Christmas)
    { id: 'icon_santa_archmage', name: 'Weihnachtsmann der Zitadelle', rarity: 'legendary', event: 'christmas', image: '/images/avatars/icon_santa_archmage.png', lore: 'Purpurrote Samtkapuze, funkelnder Sternenbart und uralte Julmagie.' },
    { id: 'icon_rudolph_stag', name: 'Rudolph der Sternenhirsch', rarity: 'epic', event: 'christmas', image: '/images/avatars/icon_rudolph_stag.png', lore: 'Ein erhabener Silberhirsch mit leuchtend rubinrotem Sternen-Amulett.' },
    { id: 'icon_gingerbread_golem', name: 'Lebkuchen-Golem', rarity: 'rare', event: 'christmas', image: '/images/avatars/icon_gingerbread_golem.png', lore: 'Mit Zuckerguss-Runen verzaubert, verbreitet er warmen Zimtduft.' },
    { id: 'icon_frost_snowman', name: 'Arktischer Schneemagier', rarity: 'rare', event: 'christmas', image: '/images/avatars/icon_frost_snowman.png', lore: 'Belebt durch arktische Winde mit magischem Zylinder und Eisfokus.' },
    { id: 'icon_nutcracker_general', name: 'Nussknacker-General', rarity: 'epic', event: 'christmas', image: '/images/avatars/icon_nutcracker_general.png', lore: 'Prächtige Parade-Uniform mit funkelndem Goldsäbel und schneidigem Blick.' },
    { id: 'icon_yule_elf', name: 'Wichtel-Meister', rarity: 'rare', event: 'christmas', image: '/images/avatars/icon_yule_elf.png', lore: 'Fliegende Hände und feine Zauberwerkzeuge fertigen arkanes Spielzeug.' },
    { id: 'icon_krampus_demon', name: 'Krampus der Schattenwälder', rarity: 'legendary', event: 'christmas', image: '/images/avatars/icon_krampus_demon.png', lore: 'Straft nachlässige Magier mit eisernen Ketten und züngelnden Schatten.' },
    { id: 'icon_winter_queen', name: 'Eiskönigin von Niflheim', rarity: 'legendary', event: 'christmas', image: '/images/avatars/icon_winter_queen.png', lore: 'Gekrönt von reinstem Gletscherquarz, gebietet sie über ewigen Frost.' },
    { id: 'icon_frost_golem', name: 'Frost-Koloss', rarity: 'epic', event: 'christmas', image: '/images/avatars/icon_frost_golem.png', lore: 'Ein wandelnder Eisgletscher mit azurblauen Runenadern.' },
    { id: 'icon_candle_fairy', name: 'Kerzenlicht-Fee', rarity: 'rare', event: 'christmas', image: '/images/avatars/icon_candle_fairy.png', lore: 'Sanft schwebende Lichtgestalt mit wärmenden goldenen Flammenflügeln.' },
    { id: 'icon_peppermint_sorcerer', name: 'Pfefferminz-Hexer', rarity: 'common', event: 'christmas', image: '/images/avatars/icon_peppermint_sorcerer.png', lore: 'Rot-weiß gestreifte Seidengewänder mit erfrischendem Minzzauber.' },
    { id: 'icon_yule_goat', name: 'Julbock der Ahnen', rarity: 'common', event: 'christmas', image: '/images/avatars/icon_yule_goat.png', lore: 'Traditioneller Strohbock mit feuerroten Bändern und Schutzrunen.' }
  ],

  card_backs: [
    // Standard-Deck (Gewöhnlich, vollwertig und edel)
    { id: 'default', name: 'Novizen-Pergament', rarity: 'common', isDefault: true, lore: 'Handbeschöpftes Lederpergament mit arkanen Schutzrunen und Lehrlingszirkel.' },
    
    // Selten (Rare)
    { id: 'parchment', name: 'Uraltes Alchemisten-Leder', rarity: 'rare', lore: 'Dunkelbraunes Leder mit alchemistischem Kreis und glänzendem Wachssiegel.' },
    { id: 'forest', name: 'Hain der Waldnymphen', rarity: 'rare', lore: 'Lebendiges Elfenholz, umschlungen von leuchtendem Feenstaub und Smaragd-Lilien.' },
    { id: 'spider_queen', name: 'Spinnenkönigin', rarity: 'rare', lore: 'Tiefvioletter Samt mit filigranem silbernem Spinnennetz und Amethystspinne.' },

    // Episch (Epic)
    { id: 'shadow', name: 'Schattenflamme', rarity: 'epic', lore: 'Dunkler Obsidian, durchzuckt von violetten Höllenflammen und Dämonenrunen.' },
    { id: 'astral', name: 'Astral-Kosmos', rarity: 'epic', lore: 'Ein mitternachtsblaues Sternenrad mit glimmenden Konstellationen und Astrolabium.' },
    { id: 'pumpkin_king', name: 'Kürbiskönig', rarity: 'epic', lore: 'Furchterregender Schnitzkürbis mit feurig glühendem Dämonengrinsen und Herbstlaub.' },
    { id: 'gravestone_runes', name: 'Grabstein-Runen', rarity: 'epic', lore: 'Verwitterter gotischer Schiefer mit uralten Moos-Totenkopfgravuren und Seelenleuchten.' },

    // Legendär (Legendary)
    { id: 'dragon', name: 'Drachenschuppe', rarity: 'legendary', lore: 'Echte rote Lindwurmschuppen-Panzerung mit feuerfesten Goldbeschlägen und Schlitzauge.' },
    { id: 'citadel_ancient', name: 'Arkane Zitadelle (30 Jahre Jubiläums-Gold)', rarity: 'legendary', lore: 'Das berühmte kobaltblaue Meisterstück der Hohen Zitadelle mit echten Goldfiligran-Bordüren und Arkan-Kompass.' },

    // Weihnachts-Spezial (Winter Solstice & Christmas)
    { id: 'star_of_bethlehem', name: 'Stern von Bethlehem', rarity: 'legendary', event: 'christmas', lore: 'Achtzackiger Barockgoldstern auf nachtblauem Damast mit Akanthus-Ecken.' },
    { id: 'snowflake_mandala', name: 'Eiskristall-Mandala', rarity: 'rare', event: 'christmas', lore: 'Filigranes sechseckiges Schneeflocken-Mandala in Eiscyan und reinem Silber.' },
    { id: 'christmas_tree_tapestry', name: 'Weihnachtsbaum-Gobelin', rarity: 'rare', event: 'christmas', lore: 'Tannengrüner Nadelteppich mit goldenem Stern und funkelndem Kerzenschein.' },
    { id: 'reindeer_crest', name: 'Wappen des Sternenhirsches', rarity: 'epic', event: 'christmas', lore: 'Silbergeweih-Wappen auf rubinrotem Samt mit Eichenlaub-Bordüre.' },
    { id: 'gingerbread_heart', name: 'Lebkuchenherz der Zitadelle', rarity: 'common', event: 'christmas', lore: 'Würziger Honigkuchen mit weißem Spritzglasur-Medaillon und Arkan-Schleife.' },
    { id: 'nutcracker_regiment', name: 'Nussknacker-Regiment', rarity: 'epic', event: 'christmas', lore: 'Kaiserliche Paradesäbel, scharlachrote Epauletten und Königskrone.' },
    { id: 'aurora_borealis_deck', name: 'Tanz der Nordlichter', rarity: 'epic', event: 'christmas', lore: 'Ein schimmerndes Farbenspiel aus Smaragdgrün und Purpur über Arktiseis.' },
    { id: 'candlelight_vigil', name: 'Adventskerzen-Wache', rarity: 'rare', event: 'christmas', lore: 'Vier brennende Wachskerzen im goldenen Sternenkreis auf Pergament.' },
    { id: 'frost_filigree', name: 'Raureif-Filigran', rarity: 'rare', event: 'christmas', lore: 'Gotische Silberranken und zarte Eiskristalle auf Schiefergrund.' },
    { id: 'yule_log_fire', name: 'Julklotz-Feuer', rarity: 'epic', event: 'christmas', lore: 'Glutheißes Eichenholz mit prasselnden goldenen Sonnenwend-Funken.' },
    { id: 'winter_solstice_gold', name: 'Wintersonnenwende (Gold)', rarity: 'legendary', event: 'christmas', lore: '3D-Sonnenrad aus purem Barockgold mit funkelnden Frostkristall-Inlays.' }
  ],

  table_skins: [
    { id: 'emerald_felt', name: 'Klassischer Zitadellen-Filz', rarity: 'common', isDefault: true, icon: '🟢', lore: 'Traditioneller, weicher smaragdgrüner Kartentischfilz.' },
    { id: 'tavern_wood', name: 'Rustikales Tavernen-Holz', rarity: 'rare', icon: '🪵', lore: 'Schwere Eichenbohlen mit gemütlichem Kaminfeuer-Schatten.' },
    { id: 'amethyst_crypt', name: 'Amethyst-Krypta', rarity: 'rare', icon: '🔮', lore: 'Dunkelviolette Runenplatten mit sanft pulsierendem Glanz.' },
    { id: 'volcano_keep', name: 'Vulkan-Festung', rarity: 'epic', icon: '🌋', lore: 'Pechschwarzer Basaltstein mit glühenden Magma-Adern.' },
    { id: 'astral_observatory', name: 'Sternen-Observatorium', rarity: 'legendary', icon: '🌌', lore: 'Ein kreisförmiges Observatorium unter freiem Himmelszelt.' },
    // Halloween Spezial
    { id: 'haunted_crypt', name: 'Spukhaus-Gruft', rarity: 'epic', icon: '🪦', lore: 'Ein gespenstischer Steintisch, umhüllt von kaltem Geisternebel und Spinnweben.' },

    // Weihnachts-Spezial (Winter Solstice & Christmas)
    { id: 'velvet_red_gold', name: 'Königlicher Festtags-Samt', rarity: 'epic', event: 'christmas', icon: '🍷', lore: 'Prächtiger rubinroter Samtfilz mit geschwungenen Goldverzierungen.' },
    { id: 'frosty_blue_ice', name: 'Ewiges Gletschereis', rarity: 'rare', event: 'christmas', icon: '🧊', lore: 'Gefrorene, spiegelglatte Cyan-Tafel mit feinen Raureifkanten.' },
    { id: 'pine_green_wood', name: 'Immergrüne Tannendielen', rarity: 'rare', event: 'christmas', icon: '🌲', lore: 'Dunkelgrün lasierte Nadelholzbohlen mit Tannenzapfen-Gravur.' },
    { id: 'yule_hearthstone', name: 'Kaminfeuer-Herdstein', rarity: 'rare', event: 'christmas', icon: '🔥', lore: 'Warmer Schieferstein mit behaglichen Kaminglut-Reflexen.' },
    { id: 'gingerbread_table', name: 'Lebkuchen-Tafel', rarity: 'common', event: 'christmas', icon: '🍪', lore: 'Honigbraune Pfefferkuchenplatte mit zarten weißen Zuckergusslinien.' },
    { id: 'midnight_winter_snow', name: 'Mitternachtsschnee', rarity: 'epic', event: 'christmas', icon: '❄️', lore: 'Tiefes Mitternachtsblau mit funkelnden Eisstern-Intarsien.' },
    { id: 'candy_cane_felt', name: 'Zuckerstangen-Filz', rarity: 'common', event: 'christmas', icon: '🦯', lore: 'Kräftig roter Filz mit rot-weiß spiralisierter Randkante.' },
    { id: 'aurora_lake', name: 'Spiegelnder Polar-See', rarity: 'epic', event: 'christmas', icon: '🌌', lore: 'Dunkles Spiegeleis mit smaragd-violetten Nordlicht-Reflexen.' },
    { id: 'nutcracker_suite', name: 'Prunksaal des Nussknackers', rarity: 'legendary', event: 'christmas', icon: '👑', lore: 'Königliches Mahagoni-Parkett mit goldenen Sternrauten.' },
    { id: 'starlit_observatory_winter', name: 'Winterliches Observatorium', rarity: 'legendary', event: 'christmas', icon: '⭐', lore: 'Blauschwarzer Marmor mit schneebedecktem Zodiak-Zirkel.' },
    { id: 'frozen_runestone', name: 'Arktischer Runenstein', rarity: 'epic', event: 'christmas', icon: '🪨', lore: 'Verwitterter Basalt mit azurblau leuchtenden Frost-Glyphen.' }
  ],

  avatar_frames: [
    { id: 'none', name: 'Schlichter Goldring', rarity: 'common', isDefault: true, icon: '⭕', lore: 'Ein dezenter polierter Messingrand.' },
    { id: 'iron_thorn', name: 'Eiserne Dornenleiste', rarity: 'common', icon: '⛓️', lore: 'Geschmiedetes Schwarzmetall mit spitzen Kanten.' },
    { id: 'silver_leaf', name: 'Silberne Lorbeerblätter', rarity: 'rare', icon: '🍃', lore: 'Ein zarter Kranz aus filigranem Elfen-Silber.' },
    { id: 'golden_runes', name: 'Leuchtende Runen-Aura', rarity: 'rare', icon: '🔆', lore: 'Kreisende arkane Symbole in warmem Sonnenlicht.' },
    { id: 'dragon_fire', name: 'Pulsierende Drachenflammen', rarity: 'epic', icon: '🔥', lore: 'Ein feuriger Kranz aus züngelnden Flammenzungen.' },
    { id: 'void_crystal', name: 'Schwebende Astralkristalle', rarity: 'legendary', icon: '💎', lore: 'Schwebende Prismen aus reinem violettem Äther.' },
    // Halloween & MVP Spezial
    { id: 'pumpkin_lantern', name: 'Kürbis-Laternen-Kranz', rarity: 'epic', icon: '🎃', lore: 'Flackernde Schnitzkürbisse und Herbstlaub umrahmen das Avatar-Medaillon.' },
    { id: 'bat_swarm', name: 'Fledermaus-Schwarm', rarity: 'rare', icon: '🦇', lore: 'Schwebende Fledermäuse und dichter violetter Spuknebel.' },
    { id: 'ghost_specter', name: 'Geisterhafte Erscheinung', rarity: 'epic', icon: '👻', lore: 'Transparente, spektrale Seelenfratzen aus der Unterwelt.' },
    { id: 'mvp_glow', name: 'Krone des Meistermagiers', rarity: 'legendary', icon: '👑', lore: 'Eine strahlende goldene Aura, die dem gekrönten MVP der Zitadelle gebührt.' },

    // Weihnachts-Spezial (Winter Solstice & Christmas)
    { id: 'holly_wreath', name: 'Stechpalmen-Kranz', rarity: 'rare', event: 'christmas', icon: '🌿', lore: 'Smaragdgrüne Blätter mit leuchtend roten Winterbeeren.' },
    { id: 'icicles', name: 'Gletscher-Eiszapfen', rarity: 'rare', event: 'christmas', icon: '🧊', lore: 'Kristallklare herabhängende Eiszapfen mit Frostschimmer.' },
    { id: 'golden_tinsel', name: 'Goldenes Lametta', rarity: 'epic', event: 'christmas', icon: '✨', lore: 'Feine geschwungene Goldgirlanden mit funkelnden Lichtreflexen.' },
    { id: 'candy_cane', name: 'Zuckerstangen-Reif', rarity: 'common', event: 'christmas', icon: '🦯', lore: 'Rot-weiß spiralisierter Reif mit süßem Glanz.' },
    { id: 'gingerbread_border', name: 'Lebkuchen-Kruste', rarity: 'common', event: 'christmas', icon: '🍪', lore: 'Gebackener Pfefferkuchenrand mit filigranem Zuckergussmuster.' },
    { id: 'frostfire', name: 'Frostfeuer-Aura', rarity: 'epic', event: 'christmas', icon: '🔥', lore: 'Cyanblaue züngelnde Flammen umhüllt von klirrenden Eissplittern.' },
    { id: 'christmas_lights', name: 'Lichterketten-Glanz', rarity: 'rare', event: 'christmas', icon: '💡', lore: 'Farbige Zauberlämpchen in sanftem, warmem Glühen.' },
    { id: 'snowflake_crystal', name: 'Eisblumen-Kristall', rarity: 'epic', event: 'christmas', icon: '❄️', lore: 'Sechseckige Eiskristallspitzen mit arktischem Schimmer.' },
    { id: 'nutcracker_gold', name: 'Nussknacker-Ehrenring', rarity: 'epic', event: 'christmas', icon: '🎖️', lore: 'Rubinrotes Ordensband mit doppelter Goldkordel.' },
    { id: 'starlit_halo', name: 'Sternenglanz-Heiligenschein', rarity: 'legendary', event: 'christmas', icon: '🌟', lore: 'Prächtiger goldener Strahlenkranz mit funkelnden Sternenstaub-Partikeln.' },
    { id: 'jingle_bells', name: 'Silberne Festglöckchen', rarity: 'rare', event: 'christmas', icon: '🔔', lore: 'Polierter Silberrand mit zierlichen Glöckchen und roter Seidenschleife.' }
  ],

  lobby_backgrounds: [
    { id: 'citadel_halls', name: 'Hallen der Zitadelle', rarity: 'common', isDefault: true, icon: '🏰', lore: 'Klassische, ehrwürdige Steinhallen der Zauberer-Zitadelle.' },
    { id: 'haunted_graveyard', name: 'Verfluchter Friedhof im Vollmond', rarity: 'epic', icon: '🎃', lore: 'Verwitterte Grabsteine, kriechender Nebel und grinsende Kürbislaternen.' },
    { id: 'witch_hut', name: 'Hexenhütte im Schwarzwald', rarity: 'rare', icon: '🕷️', lore: 'Ein brodelnder Hexenkessel, umflattert von Fledermäusen im dichten Dickicht.' },
    { id: 'tavern_fireplace', name: 'Kaminfeuer-Taverne', rarity: 'rare', icon: '🍺', lore: 'Rustikales Holz, behagliche Wärme und das Knistern von Eichenbalken.' },
    { id: 'astral_observatory', name: 'Sternen-Observatorium', rarity: 'epic', icon: '🌌', lore: 'Ein endloser Blick in kreisende Galaxien und glühende Sternbilder.' },
    { id: 'magma_forge', name: 'Magmaschmiede der Zwerge', rarity: 'epic', icon: '🌋', lore: 'Glühender Basaltstein und fliegende Funken aus den Tiefen des Berges.' },
    { id: 'celestial_sanctum', name: 'Himmlisches Sanktum', rarity: 'legendary', icon: '☀️', lore: 'Erhabener goldener Marmor, durchflutet von göttlichen Sonnenstrahlen.' },

    // Weihnachts-Spezial (Winter Solstice & Christmas)
    { id: 'snowy_castle', name: 'Verschneite Felsenburg', rarity: 'rare', event: 'christmas', icon: '🏰', image: '/images/backgrounds/bg_snowy_castle.png', lore: 'Zinnen und Türme der Hohen Zitadelle im dichten Schneefall.' },
    { id: 'cozy_hearth', name: 'Behaglicher Kaminabend', rarity: 'common', event: 'christmas', icon: '🔥', image: '/images/backgrounds/bg_cozy_hearth.png', lore: 'Rustikaler Kamin mit prasselndem Holzfeuer und Tannenzweigen.' },
    { id: 'winter_pine_forest', name: 'Winterlicher Tannenzauber', rarity: 'rare', event: 'christmas', icon: '🌲', image: '/images/backgrounds/bg_winter_pine_forest.png', lore: 'Tief verschneite Tannen unter klarem Polarhimmel mit Sternenstaub.' },
    { id: 'aurora_borealis', name: 'Polarlichter der Arktis', rarity: 'epic', event: 'christmas', icon: '🌌', image: '/images/backgrounds/bg_aurora_borealis.png', lore: 'Smaragd- und purpurfarbene Aurora-Schleier über gefrorenen Gipfeln.' },
    { id: 'santas_workshop', name: 'Wichtel-Werkstatt', rarity: 'rare', event: 'christmas', icon: '🎁', image: '/images/backgrounds/bg_santas_workshop.png', lore: 'Warme Werkstatthalle voller Holzspielzeug, Zahnräder und Bänder.' },
    { id: 'starlit_bethlehem', name: 'Stern von Bethlehem', rarity: 'epic', event: 'christmas', icon: '⭐', image: '/images/backgrounds/bg_starlit_bethlehem.png', lore: 'Strahlender Weihnachtsstern am mitternachtsblauen Himmelszelt.' },
    { id: 'icy_cavern', name: 'Gefrorene Tropfsteinhöhle', rarity: 'rare', event: 'christmas', icon: '❄️', image: '/images/backgrounds/bg_icy_cavern.png', lore: 'Tiefblaue Eishöhle mit riesigen transparenten Eiszapfen.' },
    { id: 'christmas_market', name: 'Magischer Weihnachtsmarkt', rarity: 'epic', event: 'christmas', icon: '🏮', image: '/images/backgrounds/bg_christmas_market.png', lore: 'Stimmungsvolle Marktstände mit Lichtern und dampfenden Kesseln.' },
    { id: 'toy_factory', name: 'Arkanes Spielzeug-Atelier', rarity: 'rare', event: 'christmas', icon: '🧸', image: '/images/backgrounds/bg_toy_factory.png', lore: 'Magische Werkbänke mit verzauberten Nussknackern und Glaskugeln.' },
    { id: 'glacier_peak', name: 'Gletschergipfel der Stille', rarity: 'legendary', event: 'christmas', icon: '🏔️', image: '/images/backgrounds/bg_glacier_peak.png', lore: 'Monumentaler schneebedeckter Berg unter funkelndem Sternenzelt.' },
    { id: 'yule_banquet_hall', name: 'Festliche Festtagstafel', rarity: 'legendary', event: 'christmas', icon: '🍷', image: '/images/backgrounds/bg_yule_banquet_hall.png', lore: 'Gotischer Rittersaal mit reich gedeckter Tafel und Kronleuchtern.' },
    { id: 'gingerbread_village', name: 'Lebkuchen-Dorf', rarity: 'rare', event: 'christmas', icon: '🍪', image: '/images/backgrounds/bg_gingerbread_village.png', lore: 'Winterliches Miniaturdorf mit Pfefferkuchenhäuschen und Zuckerrodeln.' }
  ],

  titles: [
    // Gewöhnlich (Common)
    { id: 'Zauberlehrling', name: 'Zauberlehrling', rarity: 'common', isDefault: true },
    { id: 'Kartenflüsterer', name: 'Kartenflüsterer', rarity: 'common' },
    { id: 'Novize der Akademie', name: 'Novize der Akademie', rarity: 'common' },
    { id: 'Wanderer der Nebel', name: 'Wanderer der Nebel', rarity: 'common' },
    { id: 'Der Suchende', name: 'Der Suchende', rarity: 'common' },
    { id: 'Geselle der Zitadelle', name: 'Geselle der Zitadelle', rarity: 'common' },
    { id: 'Schüler der Runen', name: 'Schüler der Runen', rarity: 'common' },
    { id: 'Kartenleger', name: 'Kartenleger', rarity: 'common' },
    { id: 'Der Geduldige', name: 'Der Geduldige', rarity: 'common' },
    { id: 'Tavernengast', name: 'Tavernengast', rarity: 'common' },

    // Selten (Rare)
    { id: 'Seher der Sterne', name: 'Seher der Sterne', rarity: 'rare' },
    { id: 'Schattenmeister', name: 'Schattenmeister', rarity: 'rare' },
    { id: 'Hüter der Flamme', name: 'Hüter der Flamme', rarity: 'rare' },
    { id: 'Gezeitenrufer', name: 'Gezeitenrufer', rarity: 'rare' },
    { id: 'Frostgeborener', name: 'Frostgeborener', rarity: 'rare' },
    { id: 'Meister der Vorhersage', name: 'Meister der Vorhersage', rarity: 'rare' },
    { id: 'Der Scharfsinnige', name: 'Der Scharfsinnige', rarity: 'rare' },
    { id: 'König der Bettler', name: 'König der Bettler', rarity: 'rare' },
    { id: 'Wolfsseele', name: 'Wolfsseele', rarity: 'rare' },
    { id: 'Freund der Feen', name: 'Freund der Feen', rarity: 'rare' },
    { id: 'Sturmbringer', name: 'Sturmbringer', rarity: 'rare' },
    { id: 'Der Unberechenbare', name: 'Der Unberechenbare', rarity: 'rare' },
    { id: 'Archivar des Rates', name: 'Archivar des Rates', rarity: 'rare' },
    { id: 'Hofmagier', name: 'Hofmagier', rarity: 'rare' },
    { id: 'Nachtmahr der Zitadelle', name: 'Nachtmahr der Zitadelle', rarity: 'rare' },
    { id: 'Geisterbeschwörer', name: 'Geisterbeschwörer', rarity: 'rare' },

    // Episch (Epic)
    { id: 'Drachenbändiger', name: 'Drachenbändiger', rarity: 'epic' },
    { id: 'Vampir-Bannmeister', name: 'Vampir-Bannmeister', rarity: 'epic' },
    { id: 'Schicksalsweber', name: 'Schicksalsweber', rarity: 'epic' },
    { id: 'Das Orakel von Avalon', name: 'Das Orakel von Avalon', rarity: 'epic' },
    { id: 'Meister der Renonce', name: 'Meister der Renonce', rarity: 'epic' },
    { id: 'Der Dreifach-Gekrönte', name: 'Der Dreifach-Gekrönte', rarity: 'epic' },
    { id: 'Phönixgeborener', name: 'Phönixgeborener', rarity: 'epic' },
    { id: 'Schattenfürst', name: 'Schattenfürst', rarity: 'epic' },
    { id: 'Großinquisitor', name: 'Großinquisitor', rarity: 'epic' },
    { id: 'Herrscher der Gezeiten', name: 'Herrscher der Gezeiten', rarity: 'epic' },
    { id: 'Die Weiße Hexe', name: 'Die Weiße Hexe', rarity: 'epic' },
    { id: 'Vollstrecker der Prophezeiung', name: 'Vollstrecker der Prophezeiung', rarity: 'epic' },
    { id: 'Kürbiskönig von Halloween', name: 'Kürbiskönig von Halloween', rarity: 'epic' },
    { id: 'Graf der Finsternis', name: 'Graf der Finsternis', rarity: 'epic' },

    // Legendär (Legendary)
    { id: 'Oberster Erzmagier', name: 'Oberster Erzmagier', rarity: 'legendary' },
    { id: 'Unantastbar', name: 'Unantastbar', rarity: 'legendary' },
    { id: 'Herrscher des Chaos', name: 'Herrscher des Chaos', rarity: 'legendary' },
    { id: 'Legende der Zitadelle', name: 'Legende der Zitadelle', rarity: 'legendary' },
    { id: 'Beherrscher der Zeit', name: 'Beherrscher der Zeit', rarity: 'legendary' },
    { id: 'Der Ewig-Wachende', name: 'Der Ewig-Wachende', rarity: 'legendary' },
    { id: 'Sonnengott von Solaria', name: 'Sonnengott von Solaria', rarity: 'legendary' },
    { id: 'Avatar des Schicksals', name: 'Avatar des Schicksals', rarity: 'legendary' },
    { id: 'Der Kopflose Reiter', name: 'Der Kopflose Reiter', rarity: 'legendary' },
    { id: 'MVP der Zitadelle', name: 'MVP der Zitadelle', rarity: 'legendary' },

    // Weihnachts-Spezial (Winter Solstice & Christmas)
    { id: 'Weihnachtsmagier', name: 'Weihnachtsmagier', rarity: 'legendary', event: 'christmas' },
    { id: 'Geist der Weihnacht', name: 'Geist der Weihnacht', rarity: 'legendary', event: 'christmas' },
    { id: 'Hüter der Wintersonnenwende', name: 'Hüter der Wintersonnenwende', rarity: 'legendary', event: 'christmas' },
    { id: 'Herrscher des Frosts', name: 'Herrscher des Frosts', rarity: 'epic', event: 'christmas' },
    { id: 'Krampus-Bändiger', name: 'Krampus-Bändiger', rarity: 'epic', event: 'christmas' },
    { id: 'Stern von Bethlehem', name: 'Stern von Bethlehem', rarity: 'epic', event: 'christmas' },
    { id: 'Meister der Wichtel', name: 'Meister der Wichtel', rarity: 'rare', event: 'christmas' },
    { id: 'Nussknacker-General', name: 'Nussknacker-General', rarity: 'rare', event: 'christmas' },
    { id: 'Schneesturmbringer', name: 'Schneesturmbringer', rarity: 'rare', event: 'christmas' },
    { id: 'Lebkuchen-Bäcker', name: 'Lebkuchen-Bäcker', rarity: 'common', event: 'christmas' },
    { id: 'Kerzenwächter', name: 'Kerzenwächter', rarity: 'common', event: 'christmas' },
    { id: 'Frosttänzer', name: 'Frosttänzer', rarity: 'rare', event: 'christmas' }
  ]
};

// Hilfs-Maps für schnellen O(1) Lookup
const CATALOG_BY_TYPE_AND_ID = {};
for (const [type, items] of Object.entries(COSMETICS_CATALOG)) {
  CATALOG_BY_TYPE_AND_ID[type] = {};
  for (const item of items) {
    CATALOG_BY_TYPE_AND_ID[type][item.id] = item;
  }
}

// Flat-Pool aller ziehbaren Items (ohne Default-Items) nach Seltenheit gruppiert
const DROPPABLE_ITEMS_BY_RARITY = { common: [], rare: [], epic: [], legendary: [] };
for (const [type, items] of Object.entries(COSMETICS_CATALOG)) {
  for (const item of items) {
    if (!item.isDefault) {
      DROPPABLE_ITEMS_BY_RARITY[item.rarity].push({
        type,
        id: item.id,
        name: item.name,
        rarity: item.rarity,
        icon: item.icon || (type === 'avatar_icons' ? '👤' : '✨'),
        image: item.image || null,
        lore: item.lore || ''
      });
    }
  }
}

// Würfelt eine Seltenheit basierend auf Truhen-Wahrscheinlichkeiten
function rollRarity(rarityChances, forceMinRarity = null) {
  if (forceMinRarity === 'legendary') return 'legendary';
  if (forceMinRarity === 'epic') {
    const r = Math.random();
    return r < 0.70 ? 'epic' : 'legendary';
  }

  const rand = Math.random();
  let cumulative = 0;
  for (const [rarity, chance] of Object.entries(rarityChances)) {
    cumulative += chance;
    if (rand <= cumulative) return rarity;
  }
  return 'common';
}

// Öffnet eine Truhe und erzeugt Drops inkl. Pity-Duplicate-Staub
function rollChestRewards(chestType, ownedItems = []) {
  const config = CHEST_TIERS[chestType] || CHEST_TIERS.wooden;
  const count = config.itemCount;
  const rewards = [];
  let totalDustGained = 0;

  const ownedSet = (ownedItems instanceof Set) ? ownedItems : new Set(ownedItems);

  for (let i = 0; i < count; i++) {
    // Bei der goldenen Truhe ist das letzte Item garantiert Episch oder Legendär
    const forceRarity = (chestType === 'gold' && i === count - 1) ? 'epic' : null;
    const rarity = rollRarity(config.rarityChances, forceRarity);
    const pool = DROPPABLE_ITEMS_BY_RARITY[rarity];

    if (!pool || pool.length === 0) continue;

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const key = `${chosen.type}:${chosen.id}`;
    const isDuplicate = ownedSet.has(key) || ownedSet.has(chosen.id);
    const rarityMeta = RARITY_CONFIG[chosen.rarity] || RARITY_CONFIG.common;
    const dustRefund = isDuplicate ? rarityMeta.dustValue : 0;

    if (isDuplicate) {
      totalDustGained += dustRefund;
    } else {
      ownedSet.add(key);
      ownedSet.add(chosen.id);
    }

    rewards.push({
      type: chosen.type,
      id: chosen.id,
      name: chosen.name,
      rarity: chosen.rarity,
      rarityColor: rarityMeta.color,
      icon: chosen.icon,
      image: chosen.image,
      lore: chosen.lore,
      isDuplicate,
      dustRefund
    });
  }

  return {
    chestType,
    chestName: config.name,
    rewards,
    totalDustGained
  };
}

// XP-Berechnung nach einem Spiel (Overwatch-Style)
function calculateMatchXP(matchStats = {}) {
  const {
    roundsPlayed = 1,
    rank = 3,
    bidsHit = 0,
    isRanked = false,
    isWinner = false,
    isStreak = false
  } = matchStats;

  let xp = 100; // Teilnahme-Basis
  xp += Math.min(200, roundsPlayed * 10); // Runden-Bonus
  if (isWinner || rank === 1) xp += 150;
  else if (rank === 2) xp += 75;
  else if (rank === 3) xp += 40;

  xp += Math.min(150, bidsHit * 10); // Präzisions-Bonus
  if (isRanked) xp += 50; // Ranked Bonus
  if (isStreak) xp += 50; // Streak Bonus

  return xp;
}

// Level-Up & Truhen-Berechnung
const XP_PER_LEVEL = 1000;

function calculateLevelProgress(currentLevel = 1, currentXP = 0, gainedXP = 0) {
  let totalXP = currentXP + gainedXP;
  let newLevel = currentLevel;
  const chestsAwarded = { wooden: 0, silver: 0, gold: 0 };
  let leveledUp = false;

  while (totalXP >= XP_PER_LEVEL) {
    totalXP -= XP_PER_LEVEL;
    newLevel += 1;
    leveledUp = true;

    if (newLevel % 10 === 0) {
      chestsAwarded.gold += 1;
    } else if (newLevel % 5 === 0) {
      chestsAwarded.silver += 1;
    } else {
      chestsAwarded.wooden += 1;
    }
  }

  return {
    oldLevel: currentLevel,
    newLevel,
    leveledUp,
    currentXP: totalXP,
    xpRequired: XP_PER_LEVEL,
    gainedXP,
    chestsAwarded
  };
}

const WEEKLY_MILESTONES = [
  { id: 'weekly_games_3', name: '3 Partien abschließen', target: 3, type: 'matches', reward: { type: 'chest', chestType: 'wooden', amount: 1 } },
  { id: 'weekly_wins_1', name: '1 Sieg erringen', target: 1, type: 'wins', reward: { type: 'dust', amount: 50 } },
  { id: 'weekly_bids_10', name: '10 exakte Vorhersagen treffen', target: 10, type: 'bids', reward: { type: 'chest', chestType: 'silver', amount: 1 } },
  { id: 'weekly_games_10', name: '10 Partien meisterhaft bestreiten', target: 10, type: 'matches', reward: { type: 'chest', chestType: 'gold', amount: 1 } }
];

function getCurrentWeeklyPeriodId() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const firstJan = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil((((d - firstJan) / 86400000) + firstJan.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

module.exports = {
  RARITY_CONFIG,
  CHEST_TIERS,
  COSMETICS_CATALOG,
  CATALOG_BY_TYPE_AND_ID,
  DROPPABLE_ITEMS_BY_RARITY,
  WEEKLY_MILESTONES,
  getCurrentWeeklyPeriodId,
  rollRarity,
  rollChestRewards,
  calculateMatchXP,
  calculateLevelProgress,
  XP_PER_LEVEL
};
