#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const communesPath = join(__dirname, '..', 'src', 'data', 'communes.json');

if (!existsSync(communesPath)) {
  console.error('communes.json not found. Run fetch-cities.mjs first.');
  process.exit(1);
}

const communes = JSON.parse(readFileSync(communesPath, 'utf-8'));

// Seeded random helper
function hash(slug, seed = 0) {
  let h = seed * 31 + 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0);
}

function pick(slug, seed, arr) {
  return arr[hash(slug, seed) % arr.length];
}

function pickN(slug, seed, arr, n) {
  const indices = [];
  const used = new Set();
  let s = seed;
  while (indices.length < n && indices.length < arr.length) {
    const idx = hash(slug, s) % arr.length;
    if (!used.has(idx)) { indices.push(idx); used.add(idx); }
    s++;
  }
  return indices.map(i => arr[i]);
}

// ──────────────────────────────────────────────────────────────
// MICRO-RÉGIONS LOIRE-ATLANTIQUE (44)
// ──────────────────────────────────────────────────────────────
const MICRO_REGIONS = {
  'nantes-metropole': {
    label: 'Métropole Nantaise',
    description: 'aire urbaine de Nantes et communes limitrophes',
    climate: 'climat océanique tempéré humide avec crachins bretons réguliers et humidité stagnante',
    roofRisk: 'formation rapide de mousses tenaces sur les ardoises et usure prématurée des étanchéités de noues et zincs de toitures',
    maintenanceCycle: 5,
    communes: ['nantes', 'saint-herblain', 'reze', 'saint-sebastien-sur-loire', 'orvault', 'vertou', 'coueron', 'la-chapelle-sur-erdre', 'carquefou', 'bouguenais', 'sainte-luce-sur-loire', 'indre', 'sautron', 'les-sorinieres', 'thouare-sur-loire', 'basse-goulaine', 'saint-jean-de-boiseau', 'la-montagne', 'bouaye', 'le-pellerin', 'saint-aignan-grandlieu']
  },
  'littoral-presquile': {
    label: 'Littoral & Presqu\'île de Guérande',
    description: 'façade côtière atlantique et presqu\'île guérandaise',
    climate: 'vents violents d\'ouest soufflant de l\'océan, embruns salins hautement corrosifs et tempêtes hivernales régulières',
    roofRisk: 'arrachement d\'ardoises mal fixées, corrosion accélérée de la zinguerie par le sel et infiltrations d\'eau de pluie battante sous toiture',
    maintenanceCycle: 4,
    communes: ['saint-nazaire', 'pornic', 'guerande', 'la-baule-escoublac', 'pornichet', 'saint-brevin-les-pins', 'trignac', 'donges', 'montoir-de-bretagne', 'saint-joachim', 'herbignac', 'missillac', 'le-pouliguen', 'le-croisic', 'batz-sur-mer', 'la-turballe', 'piriac-sur-mer', 'saint-michel-chef-chef', 'la-plaine-sur-mer', 'prefailles', 'les-moutiers-en-retz', 'villeneuve-en-retz']
  },
  'pays-de-retz-sud': {
    label: 'Pays de Retz & Vignoble Nantais',
    description: 'territoires agricoles, plaines maraîchères et vignobles au sud de la Loire',
    climate: 'influences océaniques tempérées par des vents réguliers de terre et des averses de pluie intermittentes',
    roofRisk: 'propagation de lichens noirs sur les tuiles canal, mauvaise ventilation sous toit provoquant de la condensation et stagnation d\'humidité',
    maintenanceCycle: 6,
    communes: ['machecoul-saint-meme', 'saint-philbert-de-grand-lieu', 'vallet', 'clisson', 'lege', 'montbert', 'geneston', 'le-bignon', 'pont-saint-martin', 'port-saint-pere', 'sainte-pazanne', 'chateau-thebaud', 'aigrefeuille-sur-maine', 'saint-hilaire-de-clisson', 'gorges', 'remouille', 'vieillevigne']
  },
  'nord-loire-briere': {
    label: 'Nord-Loire & Massif de la Brière',
    description: 'arrière-pays du nord de la Loire, bocages et parc naturel de Brière',
    climate: 'climat bocager humide avec hivers froids et brumes stagnantes sur les marais et forêts',
    roofRisk: 'accumulation de feuilles mortes dans les chéneaux, développement important de mousse de sous-bois et porosité accrue des fibro-ciments anciens',
    maintenanceCycle: 5,
    communes: ['chateaubriant', 'ancenis-saint-gereon', 'pontchateau', 'savenay', 'blain', 'nort-sur-erdre', 'campbon', 'dreffeac', 'crossac', 'saint-gildas-des-bois', 'plesse', 'nozai', 'chateauneuf', 'derval', 'guemene-penfao']
  }
};

function getMicroRegion(slug) {
  for (const [key, region] of Object.entries(MICRO_REGIONS)) {
    if (region.communes.includes(slug)) return key;
  }
  // Fallback: classify by coordinates
  const c = communes.find(c => c.slug === slug);
  if (!c) return 'nantes-metropole';
  const lat = c.latitude || 47.21;
  const lon = c.longitude || -1.55;
  
  if (lon < -2.0) return 'littoral-presquile';
  if (lat < 47.15) return 'pays-de-retz-sud';
  if (lat > 47.4) return 'nord-loire-briere';
  return 'nantes-metropole';
}

// ──────────────────────────────────────────────────────────────
// LANDMARKS PAR COMMUNE
// ──────────────────────────────────────────────────────────────
const LANDMARKS_DB = {
  'nantes': ['les Machines de l\'île et l\'éléphant géant', 'le Passage Pommeraye et le Château des Ducs'],
  'saint-nazaire': ['le pont géant de Saint-Nazaire et l\'estuaire de la Loire', 'la base sous-marine historique'],
  'reze': ['les façades colorées du village de pêcheurs de Trentemoult', 'la Maison Radieuse construite par Le Corbusier'],
  'saint-herblain': ['la grande salle du Zénith de Nantes Métropole', 'le parc de la Gournerie'],
  'guerande': ['les remparts médiévaux intacts et les célèbres marais salants', 'la collégiale Saint-Aubin'],
  'pornic': ['le château de Pornic surplombant le vieux port', 'la côte de Jade et ses pêcheries sur pilotis'],
  'la-baule-escoublac': ['la baie légendaire de La Baule et ses villas sous les pins', 'la longue plage de sable fin'],
  'clisson': ['le château fort de Clisson et ses décors d\'inspiration italienne', 'la Sèvre Nantaise'],
  'saint-philbert-de-grand-lieu': ['l\'abbatiale carolingienne Saint-Philibert', 'les rives sauvages du lac de Grand-Lieu']
};

function getLandmarks(slug, region) {
  if (LANDMARKS_DB[slug]) return LANDMARKS_DB[slug];
  const fallbacks = {
    'nantes-metropole': ['les berges de la Loire et de l\'Erdre', 'le centre historique de la métropole nantaise'],
    'littoral-presquile': ['les plages sauvages de l\'Atlantique', 'les paysages maritimes de la presqu\'île de Guérande'],
    'pays-de-retz-sud': ['les vignes du Muscadet', 'les paysages du Pays de Retz historique'],
    'nord-loire-briere': ['le Parc Naturel Régional de Brière et ses chaumières', 'les bocages du Nord de la Loire']
  };
  return fallbacks[region] || ['les magnifiques panoramas de Loire-Atlantique', 'le patrimoine architectural ligérien'];
}

function getAltitude(slug) {
  const altitudes = {
    'nantes': 20, 'saint-nazaire': 12, 'saint-herblain': 25, 'reze': 15,
    'saint-sebastien-sur-loire': 15, 'orvault': 45, 'vertou': 30, 'coueron': 15,
    'la-chapelle-sur-erdre': 35, 'carquefou': 40, 'chateaubriant': 75, 'pornic': 18,
    'guerande': 28, 'la-baule-escoublac': 10, 'clisson': 40
  };
  if (altitudes[slug]) return altitudes[slug];
  
  // Fallback based on name or region
  const region = getMicroRegion(slug);
  const defaults = {
    'nantes-metropole': 30, 'littoral-presquile': 15,
    'pays-de-retz-sud': 35, 'nord-loire-briere': 60
  };
  return defaults[region] || 30;
}

function getIntercommunalite(slug, region) {
  const metropoleList = ['nantes', 'saint-herblain', 'reze', 'saint-sebastien-sur-loire', 'orvault', 'vertou', 'coueron', 'la-chapelle-sur-erdre', 'carquefou', 'bouguenais', 'sainte-luce-sur-loire', 'indre', 'sautron', 'les-sorinieres', 'thouare-sur-loire', 'basse-goulaine', 'saint-jean-de-boiseau', 'la-montagne', 'bouaye', 'le-pellerin', 'saint-aignan-grandlieu'];
  if (metropoleList.includes(slug)) return "Nantes Métropole";
  
  if (['saint-nazaire', 'trignac', 'donges', 'montoir-de-bretagne', 'pornichet', 'saint-joachim'].includes(slug)) {
    return "CARENE (Agglomération de Saint-Nazaire)";
  }
  if (['guerande', 'la-baule-escoublac', 'herbignac', 'le-pouliguen', 'le-croisic', 'batz-sur-mer', 'la-turballe', 'piriac-sur-mer'].includes(slug)) {
    return "Cap Atlantique (Communauté de la Presqu'île de Guérande)";
  }
  if (['pornic', 'saint-michel-chef-chef', 'la-plaine-sur-mer', 'prefailles'].includes(slug)) {
    return "Pornic Agglo Pays de Retz";
  }
  if (['clisson', 'vallet', 'gorges', 'saint-hilaire-de-clisson'].includes(slug)) {
    return "Clisson Sèvre et Maine Agglo";
  }
  if (['chateaubriant', 'derval', 'nozai'].includes(slug)) {
    return "Communauté de communes Châteaubriant-Derval";
  }
  
  return "Département de Loire-Atlantique";
}

// ──────────────────────────────────────────────────────────────
// HABITAT DESCRIPTIONS
// ──────────────────────────────────────────────────────────────
const HABITAT_BY_REGION = {
  'nantes-metropole': [
    "immeubles anciens du centre-ville nantais aux toitures en zinc à joint debout et ardoises d'Angers",
    "maisons nantaises traditionnelles à étage dotées de couvertures en ardoise naturelle posées au crochet",
    "pavillons résidentiels de banlieue avec charpentes industrielles en sapin et tuiles mécaniques plates",
    "copropriétés aux toitures-terrasses complexes soumises aux variations climatiques de l'estuaire"
  ],
  'littoral-presquile': [
    "villas balnéaires construites sous les pins aux toitures complexes exposées à la force du vent d'ouest",
    "maisons compactes de pêcheurs côtières coiffées d'ardoises épaisses clouées résistantes aux tempêtes",
    "pavillons littoraux avec toitures en ardoises naturelles et zinguerie anticorrosion renforcée",
    "bâtisses traditionnelles en pierre de pays avec couvertures ardoise bretonne ou tuiles canal"
  ],
  'pays-de-retz-sud': [
    "maisons régionales aux toitures de tuiles canal ocre rouge typiques du Vignoble Nantais",
    "pavillons maraîchers de plain-pied à toiture en tuiles romanes légères à faible pente",
    "fermes restaurées conservant leurs charpentes en chêne massif et toits en tuiles romanes canal scellées",
    "villas contemporaines aux toitures à deux pans recouvertes de tuiles mécaniques double emboîtement"
  ],
  'nord-loire-briere': [
    "longères de caractère en pierre de schiste couvertes d'ardoises naturelles d'Angers clouées sur voliges",
    "chaumières traditionnelles de Brière au toit de chaume de roseau ou ardoises de pays",
    "pavillons des lotissements bocagers aux charpentes fermettes recouvertes d'ardoises de fibro-ciment",
    "maisons de bourg mitoyennes dotées de couvertures ardoise naturelle vieillissante et noues en zinc"
  ]
};

function getHabitatType(slug, region) {
  if (slug === 'nantes') return "immeubles du centre historique nantais aux toits de zinc et ardoises d'Angers, immeubles de la reconstruction à toitures plates, et maisons bourgeoises de l'Erdre";
  if (slug === 'saint-nazaire') return "habitations reconstruites de l'après-guerre avec toitures en ardoise synthétique ou naturelle, et villas de la côte de Jade exposées aux embruns maritimes";
  if (slug === 'reze') return "maisons de ville traditionnelles couvertes en ardoise, pavillons colorés du village de Trentemoult à toitures tuile ou ardoise, et résidences contemporaines";
  if (slug === 'guerande') return "maisons de la cité médiévale aux toitures d'ardoises d'Angers réglementées par les ABF, et longères en pierre des marais salants";
  
  const habitats = HABITAT_BY_REGION[region] || HABITAT_BY_REGION['nantes-metropole'];
  return pick(slug, 12, habitats);
}

// ──────────────────────────────────────────────────────────────
// ROOF CHARACTERISTICS
// ──────────────────────────────────────────────────────────────
function getRoofCharacteristics(slug, region) {
  const chars = {
    'nantes-metropole': { tuileDominante: 'Ardoise naturelle d\'Angers 32x22 ou zinc patiné', fixation: 'Crochets en acier inoxydable 316L et voliges en sapin traité', ventilation: 'Chatières de ventilation haute/basse conformes DTU 40.11', ecran: 'Écran de sous-toiture HPV (Haute Perméabilité à la Vapeur)' },
    'littoral-presquile': { tuileDominante: 'Ardoise naturelle de fort calibre (type Espagne A1-T1-S1)', fixation: 'Crochets inox renforcés cloués sur liteaux pour résister au vent d\'ouest', ventilation: 'Closoir de faîtage ventilé à sec résistant aux embruns salins', ecran: 'Écran pare-pluie HPV renforcé étanche à l\'eau et au vent (R2)' },
    'pays-de-retz-sud': { tuileDominante: 'Tuile romane canal ocre rouge ou tuile tige de botte', fixation: 'Fixation par crochets galvanisés ou scellement mortier chaux', ventilation: 'Tuiles faîtières ventilées et closoirs mécaniques de faîtage', ecran: 'Écran de sous-toiture HPV avec lame d\'air ventilée' },
    'nord-loire-briere': { tuileDominante: 'Ardoise naturelle posée au crochet ou ardoise fibro-ciment', fixation: 'Crochets inox ou clous en cuivre sur liteaux bois traités', ventilation: 'Chatières de toiture régulières (1 par 20m²)', ecran: 'Écran pare-pluie souple HPV résistant à la déchirure' }
  };
  return chars[region] || chars['nantes-metropole'];
}

// ──────────────────────────────────────────────────────────────
// TEMPLATES D'INTRO (12 distinct options to avoid structure duplicates)
// ──────────────────────────────────────────────────────────────
function getLocalIntroText(commune, region) {
  const { nom, slug, population, codePostal } = commune;
  const habitat = getHabitatType(slug, region);
  const regionData = MICRO_REGIONS[region];
  const landmarks = getLandmarks(slug, region);
  const altitude = getAltitude(slug);
  const pop = population.toLocaleString('fr-FR');

  const templates = [
    () => `Située ${altitude < 25 ? 'à proximité directe de l\'océan' : `à ${altitude}m d'altitude dans l'arrière-pays`}, la commune de ${nom} (${pop} habitants) abrite un parc de logements caractérisé par ${habitat}. ${regionData.climate.charAt(0).toUpperCase() + regionData.climate.slice(1)} : ici, les toitures subissent un ${regionData.roofRisk}. Tout près de ${landmarks[0]}, les couvreurs ardoisiers du 44 adaptent leurs techniques de couverture et de zinguerie pour garantir une étanchéité absolue à votre toit.`,
    
    () => `Le secteur de ${nom} en Loire-Atlantique est particulièrement exposé aux aléas du climat breton : ${regionData.climate}. Les ${pop} habitants de la commune logent principalement dans des bâtisses de type ${habitat}, ce qui exige des travaux de couverture soignés. Proche de ${landmarks[0]}, chaque réfection de toiture doit impérativement anticiper le risque de ${regionData.roofRisk} en choisissant des fixations et métaux inoxydables.`,
    
    () => `${nom} (${codePostal}), charmante ville de ${pop} habitants, présente un bâti caractéristique du ${regionData.label}. Le patrimoine immobilier, composé majoritairement de ${habitat}, nécessite un entretien régulier. Face à un climat marqué par ${regionData.climate}, les charpentiers-couvreurs de Loire-Atlantique appliquent des règles de l'art strictes pour parer à ${regionData.roofRisk}.`,
    
    () => `Les toits de ${nom} partagent des contraintes de résistance fortes liées à leur appartenance à la zone géographique de ${regionData.description}. Avec ${pop} habitants et à proximité de ${landmarks[0]}, le parc de logements composé de ${habitat} fait régulièrement face à ${regionData.climate}. Les artisans locaux y interviennent pour stopper l'impact destructeur de ${regionData.roofRisk}.`,
    
    () => `Assurer la pérennité de son toit à ${nom} requiert une vigilance toute particulière en raison de ${regionData.climate}. Les habitations de cette ville de ${pop} habitants — composées de ${habitat} — réclament une inspection ou un entretien de la couverture tous les ${regionData.maintenanceCycle} ans. Localisés près de ${landmarks[0]}, les couvreurs du 44 interviennent rapidement pour éliminer les problèmes de ${regionData.roofRisk}.`,
    
    () => `Établie au cœur du secteur de ${regionData.description}, la commune de ${nom} abrite ${pop} résidents dont les habitations faites de ${habitat} font face à ${regionData.climate}. Le fléau majeur des couvertures locales reste ${regionData.roofRisk}. Les couvreurs qualifiés certifiés RGE intervenant sur ${nom} règlent ces désordres en installant des écrans de sous-toiture et des zingueries résistantes aux précipitations de l'estuaire.`,
    
    () => `À ${nom} (${codePostal}), la rénovation de toiture doit associer respect architectural et étanchéité. Cette localité de ${pop} habitants, située dans ${regionData.description}, regroupe des habitations constituées de ${habitat}. ${regionData.climate.charAt(0).toUpperCase() + regionData.climate.slice(1)} accélère le phénomène de ${regionData.roofRisk}, justifiant l'intervention rapide d'un couvreur zingueur professionnel du 44.`,
    
    () => `Le climat côtier et ligérien met à rude épreuve les couvertures de ${nom}. Les tempêtes hivernales apportent des vents de mer chargés de sel, tandis que les pluies et le crachin alimentent l'humidité. Le bâti de cette ville de ${pop} habitants — caractérisé par ${habitat} — exige des fixations et liteautages parfaits. Proche de ${landmarks[0]}, les entreprises de toiture du secteur adaptent leurs chantiers à ${regionData.description}.`,
    
    () => `Face à la météo changeante de la Loire-Atlantique, les habitations de ${nom} (${codePostal}) réclament des toitures étanches et isolées. ${nom} réunit ${pop} résidents installés principalement dans ${habitat}. Les contraintes engendrées par ${regionData.climate} forcent les artisans couvreurs du 44 à se prémunir contre ${regionData.roofRisk}. Les matériaux utilisés près de ${landmarks[0]} privilégient l'ardoise naturelle d'Angers ou le zinc de qualité.`,
    
    () => `Dans le secteur de ${landmarks[0]} à ${nom}, refaire son toit est une opération hautement technique. Comptant ${pop} habitants et un parc immobilier composé de ${habitat}, cette localité du 44 subit de plein fouet ${regionData.climate}. Pour endiguer ${regionData.roofRisk}, les couvreurs locaux adaptent la ventilation sous-toiture et les évacuations d'eaux pluviales selon le DTU 40.11.`,
    
    () => `Avec une altitude de ${altitude}m, la ville de ${nom} subit les influences directes du climat atlantique. Le bâti résidentiel, constitué de ${habitat}, abrite les ${pop} habitants de la commune. L'exposition à ${regionData.climate} accélère l'apparition de ${regionData.roofRisk}. Un entretien préventif régulier évite des frais de réfection lourds, particulièrement dans le secteur historique autour de ${landmarks[0]}.`,
    
    () => `Pour les propriétaires de maisons à ${nom} (${codePostal}), l'étanchéité à l'eau et à l'air de la couverture est la priorité numéro un. Le climat local, marqué par ${regionData.climate}, fragilise le bâti composé de ${habitat}. Près de ${landmarks[0]}, les couvreurs-zingueurs du 44 réalisent des travaux d'isolation thermique (sarking) et d'imperméabilisation pour éliminer les risques liés à ${regionData.roofRisk}.`
  ];

  return templates[hash(slug, 22) % templates.length]();
}

// ──────────────────────────────────────────────────────────────
// CONSEIL LOCAL (15 items)
// ──────────────────────────────────────────────────────────────
function getLocalAdvice(commune, region) {
  const { nom, slug, codePostal } = commune;
  const regionData = MICRO_REGIONS[region];
  const altitude = getAltitude(slug);

  const advices = [
    `Après un coup de vent d'ouest ou une tempête sur ${nom}, inspectez visuellement l'alignement de vos ardoises depuis le sol. Si des éléments ont glissé ou si des crochets sont détendus, faites intervenir d'urgence un couvreur du 44 pour réparer la couverture avant que l'humidité ne pénètre la charpente.`,
    `Dans le secteur de ${nom} (${regionData.label}), un nettoyage doux de votre toiture suivi d'une application d'hydrofuge imperméabilisant tous les ${regionData.maintenanceCycle} ans protège vos ardoises naturelles ou tuiles contre la prolifération accélérée de mousse de mer.`,
    `Pour isoler votre toiture par l'extérieur (technique de sarking) à ${nom} et accéder aux subventions nationales ou de Nantes Métropole, faites obligatoirement appel à une entreprise certifiée RGE disposant d'une garantie décennale toiture enregistrée en Loire-Atlantique.`,
    `Les vents violents et les tempêtes littorales peuvent déloger les ardoises de rives ou de faîtage à ${nom}. Faites vérifier la solidité de vos fixations de zinguerie (solins, bandes de rive) pour prévenir toute infiltration d'eau de pluie soufflée par le vent d'ouest.`,
    `Avant de modifier l'aspect visuel ou le matériau de votre couverture (passer d'ardoises synthétiques à des ardoises naturelles, ou de tuiles à des ardoises) à ${nom} (${codePostal}), déposez une déclaration préalable en mairie. Le PLU local protège l'harmonie architecturale bretonne et ligérienne.`,
    `Si votre maison à ${nom} se situe dans le périmètre d'un site protégé (comme près des remparts de Guérande ou du château de Pornic), la réfection de votre toiture requiert l'aval des Architectes des Bâtiments de France (ABF), qui imposent de l'ardoise naturelle d'Angers de premier choix.`,
    `Demandez toujours à votre couvreur intervenant à ${nom} son attestation de garantie décennale couverture à jour. C'est l'unique garantie légale qui vous couvre pendant 10 ans contre tout vice de pose ou d'étanchéité des solins et faîtages.`,
    `L'accumulation de aiguilles de pin ou de feuilles mortes bloque l'évacuation des gouttières à ${nom}. Nettoyez vos cheneaux avant l'automne pluvieux pour éviter les débordements d'eaux de pluie sous les ardoises de bas de toit.`,
    `En cas de fuite de toiture ou d'ardoises brisées par une tempête à ${nom}, contactez votre assureur sous 5 jours ouvrés en fournissant des photos et un devis de bâchage d'urgence établi par un couvreur local.`,
    region === 'littoral-presquile'
      ? `En zone littorale à ${nom}, l'utilisation de crochets en acier inoxydable de qualité marine (inox 316) est obligatoire pour éviter le cisaillement des fixations d'ardoises sous l'effet de la corrosion saline.`
      : `Le crachin et le brouillard réguliers à ${nom} favorisent la stagnation d'eau. Prévoyez une ventilation sous toiture renforcée à l'aide de chatières réglementaires et de closoirs ventilés pour protéger votre charpente en sapin.`,
    `Pour raccorder vos cheminées et lucarnes à ${nom}, préférez le zinc patiné ou le plomb au plomb laqué ou plastifié, car les vents salins et le rayonnement UV atlantique altèrent rapidement les polymères synthétiques.`,
    `Les eaux pluviales en Loire-Atlantique peuvent être chargées de sable saharien ou d'humidité saline. Poser des gouttières en zinc naturel ou en alu laqué à ${nom} vous assure une évacuation sans corrosion pendant plus de 35 ans.`,
    `Sur les toits ardoise à forte pente typiques du nord de la Loire à ${nom}, vérifiez régulièrement l'étanchéité des noues encastrées en zinc qui canalisent d'importants volumes d'eau de pluie.`,
    `Pour les bâtisses anciennes de pays dans le secteur de ${nom}, utilisez impérativement des isolants perméables à la vapeur d'eau (comme la fibre de bois ou le liège) afin de laisser respirer la structure de charpente historique.`,
    `Programmez vos gros travaux de réfection de toiture à ${nom} entre avril et octobre. Les entreprises locales évitent les chantiers de découverture complète durant l'hiver en raison des pluies abondantes et du vent d'ouest.`
  ];

  return advices[hash(slug, 28) % advices.length];
}

// ──────────────────────────────────────────────────────────────
// FAQ (16 items pool)
// ──────────────────────────────────────────────────────────────
function getLocalFAQ(commune, region) {
  const { nom, slug, codePostal } = commune;
  const regionData = MICRO_REGIONS[region];
  const altitude = getAltitude(slug);

  const universalPool = [
    {
      q: `Quel est le prix moyen au m² pour une réfection de toiture à ${nom} ?`,
      a: `Le tarif moyen pour refaire une toiture à ${nom} s'établit entre 120€ et 190€ le m² TTC pour de l'ardoise naturelle d'Angers posée au crochet inox (pose et matériaux compris). Pour des ardoises synthétiques (fibro-ciment), comptez de 70€ à 110€ le m² TTC. Les travaux de toiture zinc en joint debout oscillent quant à eux entre 140€ et 210€ le m² TTC.`
    },
    {
      q: `Faut-il choisir de l'ardoise naturelle ou synthétique à ${nom} ?`,
      a: `L'ardoise naturelle d'Angers (ou espagnole de haute qualité) est le choix le plus durable à ${nom} avec une durée de vie dépassant 80 ans et une excellente résistance à l'humidité atlantique. L'ardoise fibro-ciment (synthétique) est plus économique mais sa durée de vie est limitée à 30-40 ans, et elle nécessite un traitement anti-mousse plus fréquent.`
    },
    {
      q: `Quelle est la fréquence de nettoyage recommandée pour un toit en Loire-Atlantique ?`,
      a: `Compte tenu du climat océanique très humide à ${nom}, un traitement préventif anti-mousse et algicide est recommandé tous les ${regionData.maintenanceCycle} ans. Cela évite que les mousses et lichens ne s'installent dans les pores des ardoises ou des tuiles, provoquant des fissures et des infiltrations.`
    },
    {
      q: `Puis-je bénéficier d'aides locales ou d'État pour ma toiture à ${nom} ?`,
      a: `Oui, pour l'isolation thermique de votre toiture (combles ou sarking) à ${nom} (${codePostal}), vous pouvez prétendre à MaPrimeRénov', aux Certificats d'Économie d'Énergie (CEE) de Loire-Atlantique, et à une TVA réduite à 5,5%. Les travaux doivent impérativement être confiés à un artisan certifié RGE.`
    },
    {
      q: `Doit-on déposer une déclaration de travaux en mairie de ${nom} ?`,
      a: `Oui. Tout changement de matériau, de coloris ou de type de fenêtre de toit (Velux) lors d'une réfection à ${nom} exige le dépôt d'une déclaration préalable de travaux (DP) auprès du service urbanisme de votre mairie.`
    },
    {
      q: `Comment vérifier la décennale d'un artisan couvreur à ${nom} ?`,
      a: `Exigez l'attestation nominative d'assurance décennale avant la signature du devis à ${nom}. Vérifiez que les mentions 'Couverture' et 'Charpente' sont bien couvertes pour le département 44 et que le contrat est en cours de validité à la date d'ouverture du chantier.`
    }
  ];

  const littoralPool = [
    {
      q: `Quelles fixations d'ardoise sont exigées sur le littoral à ${nom} ?`,
      a: `Sur la côte à ${nom}, l'exposition saline et le vent d'ouest imposent l'usage exclusif de crochets en acier inoxydable 316 (qualité marine). Les crochets ordinaires rouillent en quelques années sous l'effet des embruns salins, provoquant le glissement progressif des ardoises.`
    },
    {
      q: `Comment protéger ma toiture face aux tempêtes à ${nom} ?`,
      a: `Pour faire face aux tempêtes atlantiques à ${nom}, les couvreurs renforcent la fixation de la couverture (clouage partiel des ardoises en plus de la pose sur crochets) et installent un écran de sous-toiture HPV haute résistance mécanique classé R2 ou R3.`
    },
    {
      q: `Peut-on poser du zinc au bord de la mer à ${nom} ?`,
      a: `Oui, le zinc naturel ou pré-patiné résiste admirablement bien aux atmosphères salines de la côte à ${nom}. Sa malléabilité permet d'assurer des étanchéités parfaites sur les toits complexes et balcons, pour une durée de vie supérieure à 50 ans sans entretien lourd.`
    },
    {
      q: `Que faire en cas de toiture endommagée après une tempête côtière à ${nom} ?`,
      a: `Contactez un couvreur local à ${nom} pour réaliser un bâchage d'urgence afin de mettre la charpente hors d'eau. Prenez des photos et transmettez les devis de réparation et de sécurisation à votre assurance habitation sous 5 jours.`
    }
  ];

  const inlandPool = [
    {
      q: `Pourquoi la tuile canal est-elle courante au sud de la Loire à ${nom} ?`,
      a: `Le sud de la Loire-Atlantique, proche de la Vendée, subit l'influence architecturale du bassin ligérien et du Poitou. La tuile canal (tige de botte) est le matériau historique à ${nom}, offrant une esthétique chaleureuse et une excellente évacuation de l'eau sur les toits à faible pente.`
    },
    {
      q: `Quel isolant privilégier contre l'humidité à ${nom} ?`,
      a: `Pour les maisons du Vignoble ou du Pays de Retz à ${nom}, la laine de roche ou la fibre de bois sont d'excellents choix. Contrairement à certains isolants minces synthétiques, ils laissent circuler la vapeur et résistent parfaitement à l'humidité stagnante océanique.`
    },
    {
      q: `Comment nettoyer la mousse noire persistante sur mon toit à ${nom} ?`,
      a: `Pour le traitement des lichens noirs très présents dans le sud de la Loire à ${nom}, un brossage manuel suivi d'une pulvérisation d'un traitement algicide professionnel et d'un hydrofuge de surface est nécessaire. L'utilisation du nettoyeur haute pression doit rester exceptionnelle et à basse pression.`
    },
    {
      q: `Quelles sont les aides spécifiques de Nantes Métropole pour la rénovation de toiture à ${nom} ?`,
      a: `Les résidents des communes de Nantes Métropole comme ${nom} peuvent bénéficier de bonifications locales sur l'isolation thermique extérieure et les audits énergétiques via les dispositifs de la métropole qui complètent les subventions nationales.`
    }
  ];

  let pool = [...universalPool];
  if (region === 'littoral-presquile') {
    pool.push(...littoralPool);
  } else {
    pool.push(...inlandPool);
  }

  // Deterministically select 4 or 5 FAQs from the pool to create complete variance
  const count = (hash(slug, 35) % 2) + 4; // 4 or 5 FAQs
  return pickN(slug, 15, pool, count);
}

// ──────────────────────────────────────────────────────────────
// MARKET DATA
// ──────────────────────────────────────────────────────────────
function getMarketData(commune, region) {
  const { slug, population } = commune;
  const h = hash(slug, 8);

  let rgeCount = 2;
  if (population > 300000) rgeCount = 68;
  else if (population > 50000) rgeCount = 28;
  else if (population > 20000) rgeCount = 14;
  else if (population > 10000) rgeCount = 8;
  else if (population > 5000) rgeCount = 4;
  rgeCount += (h % 3);
  rgeCount = Math.max(1, rgeCount);

  const priceMultiplier = {
    'nantes-metropole': 1.12, 'littoral-presquile': 1.15,
    'pays-de-retz-sud': 0.96, 'nord-loire-briere': 0.98
  };
  const mult = priceMultiplier[region] || 1.00;

  const basePriceRef = Math.round((120 + (h % 40)) * mult); // 120 - 190 standard
  const basePriceDem = Math.round((14 + (h % 10)) * mult); // 12 - 30 standard

  return {
    couvreursRGE: rgeCount,
    prixM2Refection: basePriceRef,
    prixM2Demoussage: basePriceDem,
    delaiMoyenJours: 5 + (h % 8) // 5 to 12 days
  };
}

// ──────────────────────────────────────────────────────────────
// MAIN: ENRICHIR TOUTES LES COMMUNES
// ──────────────────────────────────────────────────────────────
console.log('Enriching communes data for Loire-Atlantique with high variance seeds...');

const enriched = communes.map(commune => {
  const region = getMicroRegion(commune.slug);
  const regionData = MICRO_REGIONS[region];
  const intercommunalite = getIntercommunalite(commune.slug, region);
  const intro = getLocalIntroText(commune, region);
  const advice = getLocalAdvice(commune, region);
  const faq = getLocalFAQ(commune, region);
  const market = getMarketData(commune, region);
  const landmarks = getLandmarks(commune.slug, region);
  const altitude = getAltitude(commune.slug);
  const roofChars = getRoofCharacteristics(commune.slug, region);

  return {
    ...commune,
    intercommunalite,
    microRegion: region,
    microRegionLabel: regionData.label,
    altitude,
    landmarks,
    roofCharacteristics: roofChars,
    introText: intro,
    conseilLocal: advice,
    faq: faq,
    marketData: market
  };
});

writeFileSync(communesPath, JSON.stringify(enriched, null, 2), 'utf-8');

// Verification stats
const introTexts = enriched.map(c => c.introText);
const uniqueIntros = new Set(introTexts);
const faqSets = enriched.map(c => c.faq.map(f => f.q).join('|'));
const uniqueFaqs = new Set(faqSets);
const uniqueConseils = new Set(enriched.map(c => c.conseilLocal));

console.log(`Enriched ${enriched.length} Loire-Atlantique communes.`);
console.log(`   Unique intros: ${uniqueIntros.size} / ${enriched.length}`);
console.log(`   Unique FAQs: ${uniqueFaqs.size} / ${enriched.length}`);
console.log(`   Unique Conseils: ${uniqueConseils.size} / ${enriched.length}`);

console.log('\nSample Nantes intro:\n', enriched.find(c => c.slug === 'nantes').introText);
console.log('\nSample Saint-Nazaire intro:\n', enriched.find(c => c.slug === 'saint-nazaire').introText);
console.log('\nSample Clisson intro:\n', enriched.find(c => c.slug === 'clisson').introText);
