import communes from '../data/communes.json';
import { getSmartNearbyCommunes } from './geoLinks';

export interface Commune {
  nom: string;
  slug: string;
  codeInsee: string;
  codePostal: string;
  population: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  intercommunalite?: string;
  microRegion?: string;
  microRegionLabel?: string;
  landmarks?: string[];
  roofCharacteristics?: {
    tuileDominante?: string;
    fixation?: string;
    ventilation?: string;
    ecran?: string;
  };
  introText?: string;
  conseilLocal?: string;
  faq?: { q: string; a: string }[];
  marketData?: {
    couvreursRGE: number;
    prixM2Refection: number;
    prixM2Demoussage: number;
    delaiMoyenJours: number;
  };
}

export function getDynamicPrices(commune: Commune) {
  const rPrice = commune.marketData?.prixM2Refection || 120;
  const dPrice = commune.marketData?.prixM2Demoussage || 20;
  
  return {
    refectionArdoiseAngers: { min: Math.round(rPrice * 0.95), max: Math.round(rPrice * 1.35) },
    refectionArdoiseSynth: { min: Math.round(rPrice * 0.60), max: Math.round(rPrice * 0.85) },
    refectionZinc: { min: Math.round(rPrice * 1.15), max: Math.round(rPrice * 1.55) },
    demoussageHydro: { min: Math.round(dPrice * 0.85), max: Math.round(dPrice * 1.35) },
    reparationFuite: { min: 350, max: 900 },
    faitageMl: { min: 45, max: 85 },
    zinguerieMl: { min: 55, max: 100 },
    isolationSarking: { min: 60, max: 120 },
    charpenteRetz: { min: 40, max: 90 }
  };
}

class SeededRandom {
  private state: number;

  constructor(seedStr: string) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    this.state = h >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export function parseSpintax(slug: string, key: string, template: string): string {
  const prng = new SeededRandom(slug + "-" + key);
  let text = template;
  
  const braceRegex = /\{([^{}]+)\}/;
  let match;
  while ((match = braceRegex.exec(text)) !== null) {
    const options = match[1].split('|');
    const chosenIndex = prng.nextInt(options.length);
    const chosen = options[chosenIndex];
    text = text.slice(0, match.index) + chosen + text.slice(match.index + match[0].length);
  }
  return text;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let text = template;
  for (const [key, val] of Object.entries(vars)) {
    text = text.split(`{${key}}`).join(val);
  }
  return text;
}

function shuffleArray<T>(arr: T[], seedStr: string): T[] {
  const prng = new SeededRandom(seedStr);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = prng.nextInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Classify commune density and geographic zones */
function classifyCommune(commune: Commune): {
  geoZone: 'littoral' | 'plaine' | 'metropole';
  density: 'metropole' | 'village';
  isLittoral: boolean;
} {
  const pop = commune.population || 3000;
  const reg = commune.microRegion || 'nantes-metropole';

  let geoZone: 'littoral' | 'plaine' | 'metropole' = 'plaine';
  if (reg === 'nantes-metropole') geoZone = 'metropole';
  else if (reg === 'littoral-presquile') geoZone = 'littoral';

  const density: 'metropole' | 'village' = pop > 15000 ? 'metropole' : 'village';
  const isLittoral = geoZone === 'littoral';

  return { geoZone, density, isLittoral };
}

/** Useful links per commune */
export function getExternalLinks(commune: Commune): { label: string; href: string; description: string; icon: string }[] {
  const links = [
    {
      label: "France Rénov' — Aides Publiques",
      href: "https://france-renov.gouv.fr/",
      description: "Estimez vos primes énergie pour vos chantiers d'isolation de toiture",
      icon: "🏛️"
    },
    {
      label: "Annuaire des Couvreurs RGE",
      href: "https://france-renov.gouv.fr/annuaire-rge",
      description: "Trouvez et vérifiez les qualifications RGE des couvreurs en Loire-Atlantique",
      icon: "🔍"
    },
    {
      label: "DTU 40.11 — Travaux d'Ardoises",
      href: "https://www.cstb.fr/",
      description: "Spécifications techniques réglementaires pour la pose d'ardoises",
      icon: "📋"
    },
    {
      label: "Météo Loire-Atlantique — Vent & Pluie",
      href: "https://meteofrance.com/previsions-meteo-france/loire-atlantique/44",
      description: "Suivez les alertes tempête et précipitations en Loire-Atlantique",
      icon: "🌧️"
    },
    {
      label: "ADIL de Loire-Atlantique (44) — Conseil Habitat",
      href: "https://www.adil44.org/",
      description: "Obtenez un accompagnement juridique gratuit sur vos travaux de toiture",
      icon: "⚖️"
    },
    {
      label: "Qualibat — Vérification Décennale",
      href: "https://www.qualibat.com/rechercher-une-entreprise/",
      description: "Contrôlez les labels de garantie et assurances de vos artisans RGE",
      icon: "🏅"
    }
  ];

  if (commune.codeInsee) {
    links.push({
      label: `Mairie de ${commune.nom} — Déclaration de travaux`,
      href: `https://www.service-public.fr/particuliers/vosdroits/N319`,
      description: `Formulaires officiels pour votre déclaration préalable de toiture à ${commune.nom}`,
      icon: "🏛️"
    });
  }

  return links;
}

/** Subventions info per city */
export function getAidesContent(commune: Commune): {
  maprime: string;
  cee: string;
  tva: string;
  anah: string;
  total: string;
} {
  const slug = commune.slug;
  const prng = new SeededRandom(slug + "-aides");

  const maprimeTemplates = [
    `MaPrimeRénov' accorde des aides substantielles à {VILLE} ({ZIP}) pour l'isolation thermique de votre toiture (jusqu'à 75€/m² selon vos ressources). Pour les toits exposés au vent océanique, l'isolation par l'extérieur (sarking) est vivement recommandée car elle élimine tous les ponts thermiques.`,
    `Pour les chantiers d'isolation de toiture à {VILLE} ({ZIP}), MaPrimeRénov' 2026 propose des subventions proportionnelles à vos revenus fiscaux. Ce dispositif national, cumulable avec les aides de Nantes Métropole ou du Département, finance l'étanchéité et l'isolation.`,
    `L'aide nationale MaPrimeRénov' subventionne l'isolation sous rampants ou par l'extérieur de votre maison à {VILLE} (${commune.codePostal}). En faisant appel à un artisan couvreur RGE du 44, vous réduisez considérablement le reste à charge.`,
    `Les subventions de l'ANAH via MaPrimeRénov' 2026 soutiennent financièrement les chantiers de performance énergétique à {VILLE}. En isolant vos combles rampants ou en optant pour le sarking, vous réduisez de façon pérenne votre consommation tout en valorisant votre patrimoine dans le {DEPARTEMENT_CODE}.`,
    `À {VILLE} ({ZIP}), MaPrimeRénov' aide les foyers à financer l'isolation thermique sous toiture. L'aide dépend des revenus du ménage et est cumulable avec d'autres primes locales pour diminuer le reste à charge sur vos travaux de couverture.`,
    `Si vous habitez à {VILLE}, le programme national MaPrimeRénov' permet de subventionner la pose d'isolants performants sur votre toit. Faire appel à un artisan qualifié RGE du {DEPARTEMENT_CODE} est impératif pour en bénéficier.`,
    `Les aides de l'État MaPrimeRénov' soutiennent activement la rénovation thermique des toitures en {DEPARTEMENT}. À {VILLE}, ces subventions ciblent l'isolation sous tuile ou ardoise pour éradiquer les passoires thermiques.`,
    `Profitez du dispositif national MaPrimeRénov' à {VILLE} pour prendre en charge jusqu'à la moitié du coût de votre isolation par l'extérieur (sarking), une technique très efficace contre le vent océanique de la région.`
  ];

  const ceeTemplates = [
    `Les primes CEE (Certificats d'Économie d'Énergie) versées par les fournisseurs d'énergie s'ajoutent à MaPrimeRénov' à {VILLE}. Elles permettent d'obtenir entre 12 et 25 €/m² pour l'isolation de vos combles ou de votre couverture ardoise, sans conditions de ressources.`,
    `Les subventions CEE en Loire-Atlantique sont mobilisables pour vos travaux de toiture à {VILLE}. Cumulables avec MaPrimeRénov', elles bonifient le financement de l'isolation thermique continue de votre habitation.`,
    `Grâce au système des Certificats d'Économie d'Énergie à {VILLE}, recevez une compensation financière calculée selon la surface de toiture isolée, déduite directement du devis par le couvreur certifié RGE.`,
    `Les primes CEE (Certificats d'Économie d'Énergie) sont attribuées pour l'isolation de votre toit ou de vos combles à {VILLE}. Ce dispositif financé par les fournisseurs d'énergie complète MaPrimeRénov' pour alléger votre facture globale.`,
    `Bénéficiez de la prime énergie (CEE) pour vos travaux d'isolation thermique à {VILLE} ({ZIP}). Cette aide financière dépend de la surface isolée et vous est versée directement sous forme de chèque ou déduite du devis de votre couvreur RGE.`,
    `La valorisation des Certificats d'Économie d'Énergie en {DEPARTEMENT} soutient la rénovation énergétique à {VILLE}. Les combles et toitures isolées thermiquement reçoivent une subvention calculée sur la résistance thermique installée.`,
    `Le mécanisme des CEE permet d'obtenir un remboursement partiel sur la pose de laine de roche ou de fibre de bois sous toiture à {VILLE}. C'est une aide sans conditions de ressources ouverte à tous les propriétaires.`,
    `Les Certificats d'Économie d'Énergie (CEE) constituent un levier financier important pour isoler les toits de {VILLE}. Associez cette prime aux aides de {INTERCO} pour maximiser votre budget.`
  ];

  const tvaTemplates = [
    `La TVA est réduite à 5,5% au lieu de 20% pour l'achat et la pose de matériaux d'isolation de toiture par un artisan RGE qualifié à {VILLE}. Cette baisse s'applique aussi aux travaux connexes comme la dépose des anciennes ardoises.`,
    `À {VILLE}, profitez d'un taux de TVA réduit à 5,5% sur toute la partie isolation thermique (fourniture et pose) de votre projet de toit. L'unique condition requise est de passer par un couvreur certifié de Loire-Atlantique.`,
    `Pour tout projet d'amélioration thermique du toit à {VILLE}, la facturation applique la TVA à taux réduit de 5,5% pour l'isolation et les travaux induits indissociables (liteautage, zinguerie, pose de nouvelles ardoises).`,
    `Les travaux d'isolation et d'amélioration énergétique du toit à {VILLE} bénéficient automatiquement de la TVA réduite à 5,5%. Cette mesure fiscale s'applique tant sur la main-d'œuvre que sur la fourniture d'isolants certifiés.`,
    `À {VILLE} ({ZIP}), la TVA à taux réduit de 5,5% est appliquée sur la facture de votre couvreur RGE pour l'isolation de toiture et les travaux induits comme le changement de liteaux ou la zinguerie nécessaire à la pose.`,
    `Bénéficiez d'une réduction directe de vos coûts de rénovation de toiture à {VILLE} grâce à la TVA à 5,5%. Ce taux préférentiel s'applique sur l'achat de matériaux isolants performants installés par un professionnel RGE du 44.`,
    `La législation fiscale prévoit une TVA réduite à 5,5% pour la rénovation de toiture énergétique à {VILLE}. Les réparations courantes non liées à l'isolation restent soumises au taux classique.`,
    `Pour votre projet de couverture à {VILLE}, la TVA de 5,5% remplace le taux classique de 20% sur toute la partie isolation thermique, réduisant significativement le montant final du devis proposé par l'artisan.`
  ];

  const anahTemplates = [
    `L'ANAH propose le programme MaPrimeRénov' Parcours Accompagné à {VILLE} pour financer jusqu'à 80% d'une rénovation d'ampleur comprenant l'isolation thermique de la toiture et le renforcement des structures pour les bâtisses anciennes.`,
    `Si votre logement à {VILLE} nécessite une rénovation complète (toit + isolation), les subventions de l'ANAH via le parcours d'accompagnement financent une majeure partie du devis sous condition de gain énergétique global.`,
    `Les propriétaires bailleurs ou occupants à {VILLE} peuvent solliciter les aides de l'ANAH pour restaurer des toitures vétustes d'avant-guerre, à condition d'installer des isolants à haute performance thermique.`,
    `Les subventions de l'ANAH à {VILLE} aident les propriétaires aux revenus modestes à restaurer leurs toitures dégradées. Le Parcours Accompagné permet de structurer un plan de travaux complet pour le toit et l'isolation.`,
    `L'ANAH intervient à {VILLE} ({ZIP}) pour soutenir les chantiers de rénovation globale. Si le projet inclut l'isolation thermique du toit et permet un gain énergétique de 35%, des aides très importantes sont mobilisables.`,
    `Sollicitez les aides de l'ANAH pour rénover la toiture de votre résidence principale à {VILLE}. Ces primes encouragent l'utilisation de matériaux écologiques et performants pour limiter l'impact carbone du bâtiment.`,
    `L'ANAH propose des aides spécifiques en {DEPARTEMENT} pour l'adaptation de l'habitat ancien à {VILLE}. Les toitures vétustes d'avant-guerre bénéficient d'un accompagnement technique et financier prioritaire.`,
    `À {VILLE}, le programme Habiter Mieux de l'ANAH finance le remplacement des anciennes couvertures en amiante-ciment par des ardoises naturelles de qualité supérieure avec isolation thermique renforcée.`
  ];

  const totalTemplates = [
    `En combinant MaPrimeRénov', la prime CEE de Loire-Atlantique, et la TVA réduite, les propriétaires à {VILLE} peuvent financer jusqu'à 65% du budget total d'isolation thermique de leur toiture.`,
    `Le cumul des subventions (CEE, prime nationale ANAH, TVA 5,5%) permet de diviser par deux le reste à charge réel sur vos travaux de réfection thermique de toit à {VILLE}.`,
    `Les dispositifs d'aide cumulables en Loire-Atlantique pour le secteur de {VILLE} diminuent de manière importante la facture finale de sarking ou d'isolation de vos combles.`,
    `Le cumul de ces dispositifs fiscaux et énergétiques à {VILLE} réduit drastiquement le coût total de votre projet d'isolation de toiture, rendant l'investissement rentable en moins de 6 ans.`,
    `En additionnant MaPrimeRénov', les primes CEE de la région de {VILLE} et la TVA réduite, vous pouvez économiser jusqu'à 70% du coût de votre chantier thermique de toiture.`,
    `Faites réaliser un audit par un professionnel certifié RGE du 44 à {VILLE} pour structurer au mieux vos demandes d'aides et maximiser vos subventions énergétiques.`,
    `Les aides d'État et régionales disponibles à {VILLE} ({ZIP}) constituent un soutien majeur pour rénover votre couverture tout en optimisant le confort de vie de votre logement.`,
    `En associant astucieusement ces aides énergétiques à {VILLE}, vous divisez par deux le reste à charge réel sur la rénovation complète de votre toiture ardoise ou zinc.`
  ];

  const interco = commune.intercommunalite || "Département de Loire-Atlantique";
  const vars: Record<string, string> = {
    VILLE: commune.nom,
    ZIP: commune.codePostal,
    DEPARTEMENT: "Loire-Atlantique",
    DEPARTEMENT_CODE: "44",
    INTERCO: interco,
    MICRO_REGION: commune.microRegionLabel || "Loire-Atlantique"
  };

  const maprimeTemplate = replaceVariables(maprimeTemplates[prng.nextInt(maprimeTemplates.length)], vars);
  const ceeTemplate = replaceVariables(ceeTemplates[prng.nextInt(ceeTemplates.length)], vars);
  const tvaTemplate = replaceVariables(tvaTemplates[prng.nextInt(tvaTemplates.length)], vars);
  const anahTemplate = replaceVariables(anahTemplates[prng.nextInt(anahTemplates.length)], vars);
  const totalTemplate = replaceVariables(totalTemplates[prng.nextInt(totalTemplates.length)], vars);

  return {
    maprime: parseSpintax(slug, 'maprime-sub', maprimeTemplate),
    cee: parseSpintax(slug, 'cee-sub', ceeTemplate),
    tva: parseSpintax(slug, 'tva-sub', tvaTemplate),
    anah: parseSpintax(slug, 'anah-sub', anahTemplate),
    total: parseSpintax(slug, 'total-sub', totalTemplate)
  };
}

/** Regulations content per city */
export function getRegulationsContent(commune: Commune): {
  plu: string;
  risqueIncendie: string;
  mistral: string;
  abf: string;
} {
  const { isLittoral } = classifyCommune(commune);
  const slug = commune.slug;
  const prng = new SeededRandom(slug + "-regulations");

  const pluTemplates = [
    `Le Plan Local d'Urbanisme (PLU) de {VILLE} encadre l'aspect extérieur des toitures. Les teintes sombres (ardoises naturelles d'Angers ou ardoise anthracite) et le zinc naturel sont fortement encouragés, tandis que les tuiles romanes ou canal rouges sont limitées à certains secteurs du sud du département.`,
    `Consultez la mairie de {VILLE} pour prendre connaissance des contraintes du PLU. L'architecture locale de Loire-Atlantique impose des matériaux de qualité (ardoise ou zinc au nord, tuile canal au sud de la Loire), excluant les coloris excentriques pour préserver l'identité de la commune.`,
    `Le règlement d'urbanisme (PLU) en vigueur à {VILLE} fixe les pentes de toiture (souvent supérieures à 45° dans le bâti ancien en ardoise) et exige la pose de gouttières conformes aux teintes et formes régionales (zinc ou alu).`,
    `Le Plan Local d'Urbanisme intercommunal à {VILLE} détermine le choix des coloris et des matériaux de toiture autorisés. Les ardoises naturelles de premier choix et le zinc à joint debout respectent parfaitement l'identité architecturale locale.`,
    `Avant d'engager vos travaux à {VILLE} ({ZIP}), vérifiez les règles de débord de toiture et de génoises inscrites dans le PLU. Dans les secteurs du sud de la Loire, la tuile canal à double emboîtement est couramment exigée par la mairie.`,
    `À {VILLE}, le règlement local d'urbanisme (PLU) interdit les couvertures de type bac acier ou tôle profilée sur les bâtiments d'habitation principale afin de préserver l'harmonie du paysage de {MICRO_REGION}.`,
    `Le service d'urbanisme de la mairie de {VILLE} exige une déclaration préalable (DP) pour tout changement de couleur ou d'épaisseur de vos ardoises, afin de garantir la conformité esthétique avec le bâti de Loire-Atlantique.`,
    `Le PLU de {VILLE} précise l'obligation de mettre en œuvre des gouttières en zinc ou en cuivre de profil havrais ou nantais. Les modèles en PVC de coloris vifs sont proscrits dans la plupart des quartiers.`
  ];

  const risqueIncendieTemplates = isLittoral
    ? [
        `Sur le littoral à {VILLE}, l'exposition saline constante et le vent d'ouest imposent des contraintes matérielles sévères. La zinguerie et les fixations doivent être conçues en acier inoxydable 316 (qualité marine) pour éviter la corrosion prématurée sous l'action des embruns maritimes.`,
        `À {VILLE}, à proximité immédiate de la côte, la toiture doit faire face aux tempêtes de vent salin. Les couvreurs préconisent des ardoises de fort calibre fixées au crochet inox de diamètre renforcé (2.7mm) pour empêcher tout arrachement.`,
        `L'atmosphère marine de la presqu'île à {VILLE} impose des normes strictes de résistance. Le choix d'ardoises naturelles d'Espagne de catégorie A1-T1-S1 garantit une toiture insensible à la corrosion et à l'humidité côtière.`,
        `À {VILLE} ({ZIP}), les résidus de sel portés par le vent marin se déposent en permanence sur la couverture. L'installation de rives renforcées et de closoirs en zinc résistant aux sel est essentielle pour prolonger l'étanchéité du toit.`,
        `La force des coups de mer et du vent d'ouest à {VILLE} nécessite l'utilisation d'un écran de sous-toiture HPV classé R3, caractérisé par une résistance mécanique élevée à la déchirure lors des rafales de tempête.`,
        `Les toits balnéaires à {VILLE} doivent être isolés avec des matériaux insensibles à l'humidité côtière. La laine de roche ou le verre cellulaire sont recommandés pour préserver l'intégrité de la charpente sous les vents marins.`,
        `Pour contrer l'humidité saline persistante sur la côte de {VILLE}, les artisans posent des bandes d'égout en zinc plombé et des voliges traitées fongicide en autoclave pour éviter le pourrissement des bois.`,
        `Le climat maritime direct de {VILLE} exige un contrôle biennal de la visserie inox et des fixations des chatières de ventilation pour éviter l'apparition de micro-infiltrations d'eau salée.`
      ]
    : [
        `À {VILLE}, les toitures doivent être équipées d'écrans de sous-toiture HPV pour limiter la pénétration d'humidité due aux fortes précipitations automnales et hivernales caractéristiques de l'estuaire de la Loire.`,
        `Pour faire face aux précipitations violentes et orages en plaine à {VILLE}, la pose d'un écran de sous-toiture étanche et respirant (HPV) sous les ardoises ou les tuiles prévient toute infiltration d'humidité accidentelle.`,
        `Les normes du bâtiment à {VILLE} préconisent l'installation systématique d'une membrane pare-pluie HPV pour étanchéiser le grenier contre la pluie battante et les infiltrations par les jointures de la couverture.`,
        `À {VILLE} ({ZIP}), le climat continental-océanique apporte des averses intenses. L'écran HPV protège l'isolant de toiture contre les entrées de pluie fine et la neige poudreuse tout en évacuant la vapeur intérieure.`,
        `Les structures de charpente en bois à {VILLE} subissent les variations d'humidité saisonnières. La pose d'une lame d'air continue sous les voliges permet de sécher rapidement la couverture après de fortes pluies.`,
        `La vallée de la Loire et les marais proches de {VILLE} maintiennent une humidité de l'air élevée. L'utilisation d'écrans de sous-toiture homologués évite la formation de condensation dans la laine minérale isolante.`,
        `Les chantiers de réfection à {VILLE} intègrent l'installation d'un pare-pluie HPV sous les ardoises ou tuiles pour sécuriser durablement le bâti contre les tempêtes d'automne et les orages d'été du 44.`,
        `Pour préserver la durabilité de votre toiture en plaine à {VILLE}, la membrane sous-toiture HPV doit présenter une résistance à la déchirure clou de classe R2 au minimum selon le DTU 40.11.`
      ];

  const mistralTemplates = isLittoral
    ? [
        `À {VILLE}, la résistance au vent est la priorité absolue. Lors de la réfection, les couvreurs effectuent un clouage partiel des ardoises en plus de la fixation par crochet, et appliquent des rives cimentées ou scellées mécaniquement pour faire face aux tempêtes de l'océan.`,
        `En zone littorale à {VILLE}, la pose d'un écran pare-pluie classé R2 ou R3 résistant à la déchirure sous l'effet de la pression du vent est obligatoire. Cela sécurise la charpente en cas de perte accidentelle d'ardoise pendant une tempête.`,
        `Les tempêtes régulières à {VILLE} imposent des fixations renforcées sur toutes les tuiles de rive et les faîtages. Les couvreurs du 44 installent des closoirs ventilés cloués individuellement sur le support en bois.`,
        `À {VILLE} ({ZIP}), l'exposition directe aux tempêtes atlantiques exige un plan de chevillage rigoureux. Les ardoises des 3 premiers rangs de rive sont fixées avec deux clous en cuivre et un crochet inox renforcé.`,
        `Les toitures plates en zinc des villas côtières à {VILLE} doivent utiliser la technique du joint debout avec des pattes de fixation en inox coulissantes pour permettre la dilatation thermique sous le soleil et le vent.`,
        `Pour limiter le soulèvement des ardoises lors des vents violents de secteur ouest à {VILLE}, les couvreurs réduisent le pureau de pose et augmentent le recouvrement entre les ardoises selon la pente du toit.`,
        `Les faîtages scellés au mortier bâtard traditionnel sur les toits anciens de {VILLE} sont consolidés par des fixations mécaniques pour éviter leur dislocation sous les assauts répétés des bourrasques de mer.`,
        `À {VILLE}, le vent océanique accélère le décollement des tuiles. Une fixation mécanique individuelle de chaque tuile de courant sur le liteautage est préconisée par les artisans RGE de Loire-Atlantique.`
      ]
    : [
        `À {VILLE}, les courants d'air de la vallée de l'Erdre ou des plaines de Loire-Atlantique nécessitent un chevillage ou vissage individuel des tuiles de rive et ardoises de bord de toit, conformément aux normes du DTU 40.11.`,
        `La plaine bocagère du 44 requiert un vissage individuel des tuiles et ardoises de rive à {VILLE}. Ce système prévient le soulèvement des couvertures lors des coups de vent d'orage en été.`,
        `Le DTU 40.11 impose des fixations solides pour les faîtages et rives à {VILLE}. L'utilisation de closoirs ventilés en zinc ou plomb évite le décollement mécanique des tuiles ou ardoises par fortes rafales.`,
        `À {VILLE} ({ZIP}), la force des vents de plaine durant l'hiver nécessite une pose d'ardoises renforcée au niveau des zones d'angle et des rives de toit, particulièrement pour les habitations isolées sur les hauteurs.`,
        `Les vents dominants d'ouest qui balaient les bocages de {VILLE} imposent un calage rigoureux de la couverture. Les crochets inox de 80mm à 100mm de longueur assurent un maintien optimal des ardoises naturelles.`,
        `Pour les toitures exposées en plaine à {VILLE}, les charpentiers-couvreurs du 44 installent des fixations mécaniques invisibles de type vis torx zinguées sur les voliges pour les tuiles de rive et les rives d'ardoise.`,
        `Le risque de décollement mécanique par dépression sous le vent de tempête à {VILLE} est minimisé par l'installation de tuiles faîtières à emboîtement vissées individuellement sur le tasseau de faîtage.`,
        `À {VILLE}, le vissage des éléments de finition (noues, chéneaux, rives) en zinc sur la charpente est la norme pour assurer la tenue de la couverture face aux fortes rafales de vent de plaine.`
      ];

  const abfTemplates = [
    `Si votre maison à {VILLE} est située à proximité d'un monument historique (comme les remparts de Guérande, le château de Pornic, ou le centre historique de Nantes), tout projet de toiture devra faire l'objet d'une validation des Architectes des Bâtiments de France (ABF) avec un délai d'instruction supplémentaire de 3 à 4 mois.`,
    `La proximité de monuments classés ou du centre médiéval de {VILLE} soumet les travaux de toiture à l'accord obligatoire de l'ABF. Celui-ci impose des ardoises naturelles d'Angers de couleur sombre et interdit le fibro-ciment ou le bac acier.`,
    `Les chantiers de toit dans les zones de protection du patrimoine à {VILLE} requièrent l'aval conforme de l'Architecte des Bâtiments de France. Préparez un dossier complet présentant les échantillons d'ardoises naturelles ou de zinc patiné pour validation.`,
    `À {VILLE} ({ZIP}), si votre habitation est visible depuis un bâtiment historique de renom ou se situe en zone protégée, l'ABF impose l'utilisation d'ardoises naturelles posées aux crochets inox noirs ou clouées à l'ancienne.`,
    `La mairie de {VILLE} transmet automatiquement les dossiers de toiture situés dans les zones patrimoniales à l'Architecte des Bâtiments de France. Un délai de 4 mois d'instruction administrative est requis avant le début du chantier.`,
    `Les Architectes des Bâtiments de France (ABF) à {VILLE} encadrent strictement les modèles de châssis de toit (Velux). Ils exigent des modèles encastrés avec traverse en acier noir pour s'intégrer harmonieusement aux ardoises.`,
    `Pour restaurer un toit dans les secteurs historiques de {VILLE}, l'ABF proscrit l'usage de tuiles béton ou d'ardoises synthétiques de couleur claire. Les matériaux nobles comme l'ardoise naturelle d'Angers et le zinc sont requis.`,
    `Les prescriptions esthétiques de l'ABF pour le patrimoine bâti de {VILLE} imposent souvent un faîtage traditionnel en zinc plissé ou en terre cuite sombre scellé au mortier, excluant les closoirs modernes en plastique.`
  ];

  const interco = commune.intercommunalite || "Département de Loire-Atlantique";
  const landmark1 = commune.landmarks?.[0] || `le centre-ville de ${commune.nom}`;
  const landmark2 = commune.landmarks?.[1] || `les quartiers résidentiels de ${commune.nom}`;

  const vars: Record<string, string> = {
    VILLE: commune.nom,
    ZIP: commune.codePostal,
    DEPARTEMENT: "Loire-Atlantique",
    DEPARTEMENT_CODE: "44",
    INTERCO: interco,
    MICRO_REGION: commune.microRegionLabel || "Loire-Atlantique",
    LANDMARK1: landmark1,
    LANDMARK2: landmark2
  };

  const pluTemplate = replaceVariables(pluTemplates[prng.nextInt(pluTemplates.length)], vars);
  const risqueIncendieTemplate = replaceVariables(risqueIncendieTemplates[prng.nextInt(risqueIncendieTemplates.length)], vars);
  const mistralTemplate = replaceVariables(mistralTemplates[prng.nextInt(mistralTemplates.length)], vars);
  const abfTemplate = replaceVariables(abfTemplates[prng.nextInt(abfTemplates.length)], vars);

  return {
    plu: parseSpintax(slug, 'plu-reg', pluTemplate),
    risqueIncendie: parseSpintax(slug, 'inc-reg', risqueIncendieTemplate),
    mistral: parseSpintax(slug, 'mis-reg', mistralTemplate),
    abf: parseSpintax(slug, 'abf-reg', abfTemplate)
  };
}

export function generateCommuneContent(commune: Commune, pageType: 'refection' | 'demoussage' | 'artisan') {
  const rPrice = commune.marketData?.prixM2Refection || 120;
  const dPrice = commune.marketData?.prixM2Demoussage || 20;
  const minRPrice = Math.round(rPrice * 0.95);
  const maxRPrice = Math.round(rPrice * 1.35);
  const minDPrice = Math.round(dPrice * 0.85);
  const maxDPrice = Math.round(dPrice * 1.25);
  const rge = commune.marketData?.couvreursRGE || 3;
  const delays = commune.marketData?.delaiMoyenJours || 10;
  const pop = commune.population || 3000;
  const slug = commune.slug;
  const alt = commune.altitude || 30;

  const { geoZone, density, isLittoral } = classifyCommune(commune);
  const prng = new SeededRandom(slug + "-" + pageType);

  // Neighbor communes
  const nearby = getSmartNearbyCommunes(slug, communes as any[], 4, 0);
  const proxC1 = nearby[0]?.nom || "Nantes";
  const proxC2 = nearby[1]?.nom || "Saint-Nazaire";
  const proxC3 = nearby[2]?.nom || "Saint-Herblain";
  const proxC4 = nearby[3]?.nom || "Rezé";

  // Landmarks
  const landmark1 = commune.landmarks?.[0] || `le centre-ville de ${commune.nom}`;
  const landmark2 = commune.landmarks?.[1] || `les quartiers résidentiels de ${commune.nom}`;
  const tuileDominante = commune.roofCharacteristics?.tuileDominante || "Ardoise naturelle d'Angers ou zinc joint debout";
  const fixation = commune.roofCharacteristics?.fixation || "Crochets inox qualité marine sur voliges";
  const microRegionLabel = commune.microRegionLabel || "Loire-Atlantique";
  const interco = commune.intercommunalite || "Département de Loire-Atlantique";

  const vars: Record<string, string> = {
    VILLE: commune.nom,
    ZIP: commune.codePostal,
    DEPARTEMENT: "Loire-Atlantique",
    DEPARTEMENT_CODE: "44",
    MIN_PRIX_REF: minRPrice.toString(),
    MAX_PRIX_REF: maxRPrice.toString(),
    MIN_PRIX_DEM: minDPrice.toString(),
    MAX_PRIX_DEM: maxDPrice.toString(),
    RGE_NB: rge.toString(),
    DELAIS: delays.toString(),
    POPULATION: pop.toLocaleString('fr-FR'),
    INTERCO: interco,
    PROX_C1: proxC1,
    PROX_C2: proxC2,
    PROX_C3: proxC3,
    PROX_C4: proxC4,
    ALTITUDE: alt.toString(),
    LANDMARK1: landmark1,
    LANDMARK2: landmark2,
    TUILE_DOMINANTE: tuileDominante,
    FIXATION: fixation,
    MICRO_REGION: microRegionLabel,
    INSEE: commune.codeInsee
  };

  // ============ TITLE TEMPLATES ============
  let titleTemplate = "";
  if (pageType === 'refection') {
    titleTemplate = "{Réfection de Toiture à {VILLE} ({ZIP}) — Spécialiste Ardoise & Zinc 44|Rénovation de Toiture à {VILLE} ({ZIP}) — Couvreur RGE Décennale Loire-Atlantique|Couverture & Rénovation Toiture à {VILLE} — Devis Gratuit Couvreur 44|Artisan Couvreur à {VILLE} ({ZIP}) — Réfection de Toits Ardoise, Zinc & Tuile|Travaux de Toiture à {VILLE} — Rénovation de Couverture & Isolation Sarking|Pose & Réfection de Couverture à {VILLE} (44) — Artisan Qualifié RGE|Rénover son Toit à {VILLE} ({ZIP}) — Devis Rénovation Toiture Gratuit|Spécialiste de la Rénovation de Toiture à {VILLE} — Garantie Décennale 10 Ans}";
  } else if (pageType === 'demoussage') {
    titleTemplate = "{Démoussage & Nettoyage de Toiture à {VILLE} ({ZIP}) — Traitement Anti-Mousse|Nettoyage de Toiture & Démoussage à {VILLE} (44) — Devis Gratuit|Entretien Toiture à {VILLE} — Démoussage + Hydrofuge par Couvreur Loire-Atlantique|Nettoyer son Toit à {VILLE} ({ZIP}) — Traitement Antimousse & Fongicide|Démoussage de Couverture à {VILLE} — Hydrofuge Effet Perlant Incolore 44|Entretien & Démoussage Toiture à {VILLE} — Artisan Nettoyage de Toit RGE|Soin de Toiture à {VILLE} ({ZIP}) — Diagnostic Humidité & Traitement Algicide|Nettoyage Professionnel de Toiture à {VILLE} — Retarder la Mousse de 10 Ans}";
  } else {
    titleTemplate = "{Artisan Couvreur RGE à {VILLE} ({ZIP}) — Devis Décennale Gratuit|Trouver un Couvreur Qualifié à {VILLE} (44) — Aides Énergie RGE|Couvreur de Confiance à {VILLE} — {RGE_NB} Couvreurs RGE Disponibles|Meilleur Couvreur RGE à {VILLE} ({ZIP}) — Comparatif & Devis Gratuits|Artisan de Couverture à {VILLE} — Travaux de Toits Ardoise, Tuile, Zinc|Entreprise de Couverture RGE à {VILLE} (44) — Devis Gratuit sous 48h|Couvreur Qualifié & Assuré Décennale à {VILLE} — Conseils RGE & Tarifs|Charpentier Couvreur RGE à {VILLE} ({ZIP}) — Isolation Thermique & Toit}";
  }

  // ============ INTRO PARAGRAPH TEMPLATES ============
  let introTemplate = "";
  if (pageType === 'refection') {
    const refectionIntros = isLittoral ? [
      "Vous recherchez un couvreur spécialisé en zone côtière à {VILLE} ({ZIP}) ? À {ALTITUDE} m d'altitude sur le littoral de la {MICRO_REGION}, les toitures doivent faire face à des conditions maritimes intenses : des vents forts soufflant de l'océan, des embruns salins hautement corrosifs et des tempêtes pluvieuses régulières. Nos couvreurs partenaires rénovent votre couverture (ardoise naturelle d'Angers ou d'Espagne de fort calibre, toiture zinc, étanchéité) entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, pose et dépose incluses, avec installation de fixations inox 316L résistant au sel.",
      "Besoin de refaire la toiture d'une villa balnéaire ou d'une maison côtière à {VILLE} ({ZIP}) ? Le climat marin du secteur {MICRO_REGION} met à rude épreuve les couvertures en ardoise. Les charpentes doivent supporter le vent et la pluie battante. Faites appel à des artisans couvreurs qualifiés de Loire-Atlantique pour restaurer votre couverture en ardoise naturelle ou zinc pour un coût moyen de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m² TTC.",
      "Pour vos travaux de couverture et de réfection à {VILLE} ({ZIP}), choisissez des couvreurs rompus aux contraintes littorales. Sur la côte atlantique, les risques d'arrachement d'ardoises et de corrosion de la zinguerie imposent une pose technique rigoureuse. Obtenez une rénovation thermique sarking performante et une étanchéité de qualité pour un budget de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m².",
      "Vous projetez de rénover la toiture de votre habitation côtière à {VILLE} ? Les vents marins de l'océan Atlantique et la corrosion due au sel exigent des techniques de fixation hautement résistantes. Nos couvreurs du 44 assurent le changement d'ardoises et la pose de sarking pour un tarif moyen de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m².",
      "À {VILLE} ({ZIP}), à seulement {ALTITUDE}m d'altitude, l'humidité côtière et le vent d'ouest attaquent les toitures traditionnelles. Confiez votre projet de couverture à un artisan certifié RGE du département 44. Devis gratuit et complet pour ardoise naturelle ou toiture zinc joint debout, de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€/m².",
      "Les habitations balnéaires à {VILLE} réclament une étanchéité renforcée face aux tempêtes d'ouest. Un couvreur expérimenté de Loire-Atlantique prend en charge la dépose, l'isolation thermique continue (sarking) et la couverture en ardoise naturelle de votre maison pour {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m².",
      "Rénover sa toiture en bord de mer à {VILLE} ({ZIP}) exige une zinguerie inox de qualité marine. Notre réseau d'artisans RGE intervient rapidement pour tous travaux de toiture ardoise ou zinc, pour un budget de réfection estimé entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m².",
      "Pour la rénovation de votre toit à {VILLE}, à proximité de {LANDMARK1}, sollicitez des couvreurs formés aux spécificités maritimes. Nos experts du 44 établissent un diagnostic d'isolation et assurent la pose d'une couverture haut de gamme à un prix oscillant de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m²."
    ] : geoZone === 'metropole' ? [
      "Votre toiture à {VILLE} ({ZIP}) a besoin d'une rénovation ? L'humidité persistante de la métropole nantaise et les précipitations régulières de l'estuaire fatiguent les ardoises et les toits en zinc de l'agglomération. Proche de {LANDMARK1}, les artisans couvreurs du 44 refont votre couverture et renforcent votre isolation de toit pour un budget moyen compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, avec garantie décennale de 10 ans.",
      "En quête d'un couvreur-charpentier à {VILLE} ({ZIP}) ? Les conditions météo de l'aire urbaine nantaise (humidité, brouillards et crachins bretons) nécessitent un toit parfaitement ventilé et isolé. Nos partenaires locaux rénovent les immeubles anciens du centre et pavillons de banlieue pour un tarif de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m² TTC avec des matériaux conformes (DTU 40.11).",
      "Rénover sa toiture à {VILLE} ({ZIP}) permet d'améliorer le DPE de sa maison face à l'humidité atlantique. Des couvreurs qualifiés RGE interviennent pour la pose d'ardoise naturelle d'Angers ou toitures zinc modernes. Le coût de réfection complète oscille entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC avec garantie décennale.",
      "À {VILLE}, proche de {LANDMARK2}, les toits en zinc et ardoises naturelles subissent les variations de température de l'agglomération. Confiez vos travaux de couverture et d'étanchéité à un artisan RGE local. Profitez d'une estimation gratuite de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ par m².",
      "Votre villa ou pavillon à {VILLE} ({ZIP}) souffre d'infiltrations au niveau des solins ou des gouttières ? Les couvreurs professionnels du secteur de Nantes Métropole rénovent votre couverture en ardoise au crochet pour un coût estimé de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m².",
      "Faites isoler et refaire le toit de votre maison individuelle à {VILLE} par un couvreur certifié RGE Qualibat. Ce chantier thermique vous ouvre droit aux primes de l'État tout en améliorant votre DPE. Budget de réfection : {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m².",
      "Le bâti ancien à {VILLE} requiert une attention particulière lors de la dépose des vieilles ardoises. Les compagnons couvreurs de Loire-Atlantique vous garantissent une pose soignée dans le respect des normes d'urbanisme locales. Tarif de couverture : {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€/m².",
      "Pour vos projets de couverture en ardoise d'Angers ou zinc à joint debout à {VILLE} ({ZIP}), comparez les offres de nos {RGE_NB} couvreurs RGE partenaires. Obtenez une rénovation globale étanche et garantie 10 ans pour {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m²."
    ] : [
      "Votre toiture à {VILLE} en Loire-Atlantique nécessite une intervention de réfection ? Dans le Pays de Retz ou le Vignoble Nantais, les maisons régionales et pavillons de {VILLE} ({ZIP}) exigent une couverture étanche résistante aux averses régulières et aux vents d'ouest. Les couvreurs du 44 rénovent votre toit à {VILLE} pour un budget moyen compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, normes d'étanchéité incluses.",
      "Pour votre projet de couverture à {VILLE} ({ZIP}), sollicitez des couvreurs de Loire-Atlantique qualifiés. Entre les risques de tempêtes en hiver et l'humidité constante de la plaine maraîchère, les ardoises ou tuiles doivent être fixées mécaniquement selon les DTU. Prévoyez un budget de réfection moyen de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m² pour une pose de qualité avec garantie 10 ans.",
      "Des travaux de réfection de toiture à réaliser à {VILLE} ({ZIP}) ? Assurez la protection de votre habitation avec un toit neuf en ardoise naturelle ou tuile canal. Nos couvreurs partenaires du 44 proposent des devis gratuits pour la rénovation complète de votre toit, avec un tarif compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m².",
      "À {VILLE}, dans le secteur rural du 44, les longères anciennes coiffées d'ardoises et les maisons en tuiles nécessitent des travaux de couverture adaptés. Nos couvreurs qualifiés rénovent votre toit pour un tarif compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m².",
      "Vous cherchez un artisan couvreur à {VILLE} ({ZIP}) pour réparer une fuite de toiture ou changer vos gouttières zinc ? Obtenez des devis de professionnels assurés en décennale. Prix moyen de réfection complète : {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ par m².",
      "Protégez votre patrimoine immobilier à {VILLE} en faisant poser une couverture neuve en ardoises naturelles de premier choix. Un couvreur certifié RGE intervient sous {DELAIS} jours pour votre diagnostic toiture. Budget moyen : {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m².",
      "Les intempéries régulières dans le Vignoble Nantais et le Pays de Retz à {VILLE} fatiguent les toits en tuiles romanes. Nos couvreurs locaux refont l'étanchéité des noues et faîtages pour un coût moyen de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m².",
      "Pour tout chantier de toiture ou d'isolation thermique par sarking à {VILLE} ({ZIP}), faites appel à une entreprise certifiée du {DEPARTEMENT}. Profitez de prix étudiés allant de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€/m² pour une pose traditionnelle."
    ];
    introTemplate = refectionIntros[prng.nextInt(refectionIntros.length)];
  } else if (pageType === 'demoussage') {
    const demoussageIntros = isLittoral ? [
      "Votre toiture à {VILLE} ({ZIP}) est recouverte de mousses ou de lichens maritimes ? Les embruns salins et l'humidité côtière permanente favorisent le développement rapide d'algues et de mousses sur les ardoises du littoral. Un démoussage minutieux suivi de l'application d'un traitement hydrofuge étanche est indispensable pour protéger votre toiture des vents d'ouest et des pluies violentes à {VILLE}. Budget moyen : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Faire démousser sa toiture sur la presqu'île à {VILLE} ({ZIP}) prévient la casse des ardoises. Les mousses gorgées d'eau de mer retiennent le sel qui ronge les fixations et rend les matériaux poreux. Nos partenaires réalisent un nettoyage basse pression doux suivi d'un traitement hydrofuge protecteur pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Pour la toiture de votre villa à {VILLE} ({ZIP}), planifiez un nettoyage antimousse professionnel. Éliminer les résidus biologiques avant l'hiver protège l'étanchéité de votre toit face aux tempêtes. Bénéficiez d'un diagnostic d'usure gratuit et d'un traitement hydrofuge longue durée pour un budget maîtrisé de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Les ardoises côtières de votre maison à {VILLE} verdissement rapidement à cause des vents humides chargés d'algues microscopiques. Demandez un traitement fongicide curatif et préventif à un applicateur agréé de Loire-Atlantique. Tarif : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€ le m².",
      "À {VILLE} ({ZIP}), le sel de l'océan fragilise le support de couverture. Le nettoyage haute pression à outrance est déconseillé. Nos partenaires réalisent un nettoyage doux basse pression et appliquent un hydrofuge à effet perlant pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Pour sauvegarder l'aspect mat de votre toit en ardoise naturelle d'Espagne à {VILLE}, planifiez un démoussage par pulvérisation d'algicide. Ce traitement détruit la mousse de mer en profondeur sans altérer la pierre. Coût : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Ne laissez pas les lichens noirs coloniser vos ardoises de presqu'île à {VILLE} ({ZIP}). Ils rendent le support poreux et gélif. Un spécialiste de la toiture du 44 élimine les résidus et pose un hydrofuge de surface protecteur pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Un toit propre à {VILLE} résiste beaucoup mieux aux tempêtes et aux vents salins. Nos entreprises partenaires proposent des forfaits de démoussage et d'imperméabilisation complets à un prix compétitif de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€ le m²."
    ] : [
      "Besoin d'un entretien de toiture professionnel à {VILLE} ({ZIP}) ? L'humidité océanique et les pluies régulières favorisent le développement de mousse et lichens sur les couvertures de {VILLE}. Nos couvreurs partenaires réalisent le nettoyage, l'application d'un algicide professionnel et l'imperméabilisation par hydrofuge de vos ardoises ou tuiles pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m² TTC.",
      "Pour préserver vos ardoises d'Angers à {VILLE} ({ZIP}) des agressions de l'humidité océanique, réalisez un traitement antimousse complet. Un nettoyage doux basse pression (sans chlore agressif) élimine les mousses tenaces. L'application finale d'un hydrofuge incolore offre une protection durable de 10 ans pour un budget de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€ le m².",
      "L'entretien régulier des couvertures à {VILLE} ({ZIP}) prévient l'infiltration d'eaux pluviales. Les toits de Loire-Atlantique en ardoise ou tuile subissent les assauts de la pluie et du vent. Comparez gratuitement les devis de nettoyage et démoussage de toiture (avec traitement hydrofuge autonettoyant compris) oscillant entre {MIN_PRIX_DEM}€ et {MAX_PRIX_DEM}€ le m².",
      "Votre toiture à {VILLE} est de couleur terne ou envahie par la végétation ? Le climat très pluvieux de Loire-Atlantique favorise l'encrassement des couvertures. Les artisans du 44 proposent un brossage manuel et traitement hydrofuge pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Évitez de changer prématurément vos ardoises ou vos tuiles à {VILLE} ({ZIP}) en planifiant un nettoyage antimousse curatif. L'application d'un hydrofuge siloxane protège le toit contre l'humidité constante pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Les mousses épaisses agissent comme des éponges et font stagner l'eau sur votre toit à {VILLE}. Pour éviter les infiltrations d'eau en hiver, demandez un traitement fongicide par pulvérisation à un professionnel local. Tarif : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€ le m².",
      "À {VILLE}, les arbres environnants accélèrent l'apparition de lichens et de mousses sur les tuiles canal. Nos couvreurs partenaires effectuent le vidage des chéneaux en zinc et le nettoyage du toit pour un prix de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Donnez une seconde jeunesse à votre maison à {VILLE} ({ZIP}) avec un démoussage toiture complet. L'application d'un algicide de qualité professionnelle protège la couverture des traces d'humidité pour un budget de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m²."
    ];
    introTemplate = demoussageIntros[prng.nextInt(demoussageIntros.length)];
  } else {
    const artisanIntros = [
      "Besoin d'un couvreur de confiance certifié RGE à {VILLE} ({ZIP}) ? Pour la pose d'ardoises naturelles d'Angers, la rénovation d'une toiture en zinc joint debout, la réparation de fuites, ou la pose d'une isolation sarking ouvrant droit aux aides de l'État, comparez gratuitement jusqu'à 3 offres de couvreurs assurés en décennale actifs dans le secteur de {VILLE} et ses environs ({PROX_C1}, {PROX_C2}).",
      "Trouvez un artisan couvreur qualifié dans le secteur de {VILLE} ({ZIP}) pour réaliser vos travaux de toiture en toute sérénité. Que ce soit pour colmater une fuite après tempête, changer les gouttières en zinc ou poser une isolation par l'extérieur, comparez les prix des meilleures entreprises certifiées RGE locales du 44 disposant d'assurances décennales vérifiées.",
      "Vous projetez des travaux de couverture à {VILLE} ({ZIP}) ? Notre réseau sélectionne les couvreurs qualifiés RGE et charpentiers professionnels de Loire-Atlantique pour votre chantier. Obtenez en quelques clics des devis comparatifs pour la pose de vos ardoises, l'entretien antimousse ou l'isolation de votre maison à {VILLE} ou communes voisines comme {PROX_C1}.",
      "À {VILLE}, comparez les offres de couvreurs certifiés RGE qualifiés pour vos travaux de couverture. Qu'il s'agisse de poser des ardoises naturelles espagnoles, d'installer des Velux ou de rénover un faîtage, obtenez des devis gratuits d'entreprises assurées en décennale actives autour de {VILLE}.",
      "Vous recherchez une entreprise de couverture réactive à {VILLE} ({ZIP}) pour réparer une urgence toiture après intempérie ? Nous vous mettons en relation avec des artisans couvreurs-zingueurs qualifiés du 44 assurant des interventions fiables et conformes au DTU.",
      "Pour vos projets d'isolation sous toiture ou de sarking à {VILLE}, faire appel à un couvreur RGE est obligatoire pour débloquer MaPrimeRénov'. Comparez les tarifs et avis des meilleurs artisans locaux disponibles à {VILLE} et alentours.",
      "Vous souhaitez rénover votre couverture en tuile canal ou ardoise à {VILLE} ({ZIP}) ? Notre plateforme sélectionne les couvreurs les plus sérieux de Loire-Atlantique pour vous proposer des prestations de qualité au prix le plus juste.",
      "Trouvez un couvreur-zingueur de confiance à {VILLE} pour la réfection de vos noues, gouttières ou rives en zinc. Comparez les devis détaillés d'artisans qualifiés disposant de garanties décennales enregistrées dans le département 44."
    ];
    introTemplate = artisanIntros[prng.nextInt(artisanIntros.length)];
  }

  // ============ DYNAMIC CARDS TAILORED PER PAGE TYPE ============
  let card1Text = "";
  let card1Title = "";
  let card2Text = "";
  let card2Title = "";
  let card3Text = "";
  let card3Title = "";

  if (pageType === 'refection') {
    card1Title = parseSpintax(slug, 'c1t-r', "{Climat Océanique & Étanchéité|Rigueur Climatique & Vent d'Ouest|Résistance au Vent & Pluie Atlantique|Climat Maritime & Pose Inox|Humidité Atlantique & Étanchéité Toiture|Ventilation sous Ardoise & Étanchéité|Contraintes Climatiques Océaniques|Ancrage des Ardoises & Vent d'Ouest}");
    const opts = [
      `À {VILLE}, le climat océanique de la {MICRO_REGION} expose les toitures à des vents forts soufflant de l'ouest et à des pluies régulières (plus de 180 jours par an en Loire-Atlantique). Les couvertures doivent posséder un système d'ancrage particulièrement robuste. Sur la côte, la corrosion des fixations sous l'action du sel marin est le principal facteur d'usure des toits. L'usage exclusif de crochets en inox 316L (qualité marine) sur un voligeage en sapin traité est obligatoire pour prévenir la rouille et le glissement d'ardoises naturelles, garantissant la tenue structurelle en cas de tempête hivernale.`,
      `Le secteur de la {MICRO_REGION} et son exposition maritime directe soumettent la toiture à {VILLE} ({ZIP}) à des contraintes de vent exceptionnelles. La pluie battante s'infiltre facilement sous les ardoises mal fixées. Pour contrer ces phénomènes, on pose des ardoises naturelles de premier choix fixées au crochet inox renforcé et on met en place un écran pare-pluie HPV de classe R2 résistant à la déchirure, qui assure une seconde barrière étanche tout en laissant respirer les combles.`,
      `Les tempêtes côtières à {VILLE} exigent une couverture parfaitement étanche et ventilée. Avec des pluies fréquentes et le sel marin, les métaux de toiture ordinaires se percent rapidement. Les couvreurs du 44 préconisent des gouttières et noues en zinc de fort calibre ou en aluminium laqué. Un contre-lattage soigné recrée la lame d'air nécessaire pour sécher rapidement le dessous de la couverture après chaque averse, allongeant la durée de vie du toit.`,
      `La réfection de toiture à {VILLE} doit impérativement anticiper le risque d'arrachement d'ardoise. L'ancrage au crochet inox de 2.7mm de diamètre cloué sur liteaux robustes est requis par le DTU 40.11 en Loire-Atlantique pour faire face aux fortes bourrasques.`,
      `L'humidité stagnante de la zone de {VILLE} ({ZIP}) favorise les infiltrations par capillarité. Pour éviter le pourrissement des chevrons, l'installation d'un écran de sous-toiture HPV (Haute Perméabilité à la Vapeur) hautement étanche est vivement recommandée par les artisans couvreurs du 44.`,
      `Sur les toitures de {VILLE}, le contraste thermique entre l'air marin chargé d'humidité et l'intérieur chauffé engendre de la condensation. Une lame d'air ventilée de 2cm minimum recréée par un contre-lattage est primordiale pour maintenir la charpente au sec.`,
      `La proximité océanique à {VILLE} impose des règles strictes sur la zinguerie. Les noues, solins et bandes d'égout en zinc naturel sont façonnés et soudés sur place pour épouser les formes complexes du toit et éviter toute fuite lors des pluies battantes.`,
      `Le vent dominant d'ouest qui souffle sur {VILLE} s'engouffre sous la toiture ardoise. Pour éviter les sinistres majeurs, les couvreurs locaux installent des closoirs ventilés à sec au faîtage et vissent mécaniquement chaque tuile ou ardoise de rive.`
    ];
    if (!isLittoral) {
      if (geoZone === 'metropole') {
        opts[0] = `À {VILLE} ({ZIP}), la métropole nantaise subit un climat humide avec des bruines régulières et une pollution urbaine modérée. Ces conditions favorisent le développement rapide d'un feutrage de mousse verte et de lichens noirs sur les ardoises. De plus, les toitures plates ou à faible pente en zinc des immeubles nantais réclament des techniques d'étanchéité irréprochables par joint debout pour éviter les infiltrations dans les appartements. La pose d'un écran pare-pluie HPV respirant est nécessaire pour réguler l'humidité sous rampant.`;
        opts[1] = `L'humidité stagnante de la métropole à {VILLE} met les bois de charpente et les ardoises à rude épreuve. L'eau stagnante au niveau des noues et des gouttières zinc est à l'origine de nombreuses fuites dans le centre. Afin d'éviter les sinistres lors des fortes pluies de l'estuaire, les artisans du 44 installent des évacuations de fort calibre et soignent les raccords de plomb de cheminée et Velux conformes au DTU 40.11.`;
        opts[2] = `Les toits de {VILLE} subissent les contraintes d'une zone urbanisée dense. Les mousses retiennent l'humidité et rendent les supports poreux. Pour stabiliser la toiture, nos couvreurs installent des closoirs ventilés à sec au faîtage et des grilles de protection contre les feuilles sur les gouttières zinc, garantissant une étanchéité parfaite de votre pavillon ou immeuble.`;
        opts[3] = `À {VILLE}, les infiltrations d'eau dans les toitures zinc de l'agglomération nantaise sont fréquentes en raison d'une mauvaise dilatation thermique. L'utilisation de pattes de fixation coulissantes en inox est obligatoire pour préserver l'étanchéité du zinc à long terme.`;
        opts[4] = `Les bruines d'estuaire et la pollution urbaine à {VILLE} ({ZIP}) provoquent l'encrassement prématuré des gouttières. Les couvreurs du 44 préconisent le remplacement des anciennes descentes par du zinc de fort calibre pour assurer une excellente évacuation des eaux pluviales.`;
        opts[5] = `Les combles aménagés des maisons nantaises à {VILLE} exigent une isolation thermique performante RE2026. L'isolation par l'extérieur (sarking) supprime les ponts thermiques au niveau des chevrons, protégeant l'habitation contre le froid humide en hiver.`;
        opts[6] = `Les couvertures en ardoise synthétique posées dans les années 90 à {VILLE} deviennent poreuses avec le temps. Leur réfection complète en ardoises naturelles espagnoles A1 ou d'Angers offre une résistance absolue à l'humidité de la métropole.`;
        opts[7] = `Pour faire face aux tempêtes de pluie dans la métropole à {VILLE}, les raccords d'étanchéité autour des lucarnes et des cheminées doivent être réalisés en plomb de forte épaisseur ou en zinc patiné soudé à l'étain par un artisan zingueur certifié.`
      } else {
        opts[0] = `Dans le secteur de {VILLE} en Pays de Retz ou Vignoble Nantais, les architectures traditionnelles utilisent à la fois des ardoises et des tuiles canal de teinte rouge vieilli selon l'influence locale. Les fortes averses et vents d'ouest exigent une fixation mécanique soignée de chaque tuile de rive et faîtière conformément au DTU. L'étanchéité des solins et des gouttières en zinc doit être vérifiée périodiquement pour éviter le pourrissement des chevrons.`;
        opts[1] = `Le climat du sud de la Loire à {VILLE} se caractérise par des pluies intermittentes et des orages d'été soudains. Les couvertures en tuiles romanes ou canal de {VILLE} ({ZIP}) exigent des fixations solides pour contrer les bourrasques. Les artisans couvreurs du 44 réalisent des scellements à la chaux ou fixent les éléments de couverture au crochet galvanisé pour assurer la pérennité du toit et une étanchéité parfaite.`;
        opts[2] = `Pour faire face aux contraintes du Vignoble Nantais à {VILLE}, la toiture doit concilier bonne évacuation de l'eau et résistance à l'humidité. Les artisans du 44 privilégient les tuiles canal ocre rouge de forte densité ou des ardoises naturelles espagnoles. La pose d'un écran pare-pluie HPV sous les liteaux est le meilleur moyen de sécuriser l'habitation contre les infiltrations accidentelles.`;
        opts[3] = `La transition architecturale au sud de la Loire à {VILLE} impose l'usage de la tuile canal sur les toits à faible pente. La fixation de chaque tuile de courant par un crochet galvanisé prévient le glissement lors des vents d'orage d'été.`;
        opts[4] = `Les charpentes historiques des longères à {VILLE} ({ZIP}) en bois de pays réclament une couverture légère en tuiles romanes ou ardoises de qualité. L'artisan couvreur veille à ne pas surcharger la structure tout en assurant une étanchéité parfaite.`;
        opts[5] = `Les averses régulières dans le Vignoble près de {VILLE} s'infiltrent sous les faîtages scellés au ciment rigide qui se fissure. Les couvreurs du 44 privilégient les closoirs souples ventilés cloués à sec, plus durables et résistants aux mouvements du bois.`;
        opts[6] = `À {VILLE}, le raccordement d'étanchéité des toitures en tuiles canal avec les gouttières en zinc exige la pose de bandes de doublis. Cela évite que l'eau pluviale poussée par le vent ne remonte sous les tuiles de bas de pente.`;
        opts[7] = `La plaine maraîchère autour de {VILLE} favorise la stagnation d'humidité au niveau des rives. L'utilisation d'écrans de sous-toiture HPV hautement perméables permet d'évacuer la vapeur intérieure tout en barrant la pluie fine.`
      }
    }
    card1Text = opts[prng.nextInt(opts.length)];

    card2Title = parseSpintax(slug, 'c2t-r', "{Réglementation PLU & Urbanisme|Règles d'Urbanisme & Mairie|Règles PLU & Patrimoine|Déclaration Préalable & PLU|Normes Urbanisme Loire-Atlantique|Contraintes PLU & Matériaux|Urbanisme & Architecte ABF|Règles de Rénovation de Toit}");
    const opts2 = [
      `Le Plan Local d'Urbanisme (PLU) de {VILLE} définit de manière précise les critères esthétiques pour les toitures. L'ardoise naturelle d'Angers de teinte noire ou gris ardoise is généralement exigée dans les zones patrimoniales de {VILLE}. Si votre bâtiment se situe dans le périmètre de protection d'un monument classé (comme {LANDMARK1}), l'accord de l'Architecte des Bâtiments de France (ABF) est requis. Les couvreurs du 44 vous guident dans ces démarches administratives de déclaration préalable.`,
      `La réglementation d'urbanisme à {VILLE} ({ZIP}) encadre la réfection de couverture. Le PLU communal impose de respecter le patrimoine régional (ardoises au crochet ou tuiles romanes selon le bassin). Si votre maison est visible depuis {LANDMARK1}, les teintes et la dimension des fenêtres de toit (Velux) sont réglementées par l'ABF. Une entreprise qualifiée RGE vous aidera à soumettre le dossier conforme en mairie.`,
      `Chaque projet de toiture à {VILLE} doit respecter les directives du PLU et les avis des ABF. À proximité de {LANDMARK1}, les toits en bac acier ou les isolants extérieurs trop visibles sont réglementés. Les couvreurs locaux proposent des solutions adaptées (zinc joint debout, faîtage terre cuite ou ardoise naturelle) pour valider rapidement votre déclaration préalable de travaux.`,
      `À {VILLE}, le PLU encadre la pente minimale de toiture (généralement 45° pour l'ardoise et 20° pour la tuile). Modifier cette pente ou le matériau lors d'une rénovation exige l'obtention d'une déclaration préalable de travaux en mairie de {VILLE}.`,
      `Si vous logez près de {LANDMARK2} à {VILLE} ({ZIP}), les coloris de zinguerie et de débords de toit sont réglementés par les services d'urbanisme. L'inox patiné et le zinc naturel sont à privilégier par rapport aux profilés en plastique de teintes vives.`,
      `Le PLU intercommunal de la région de {VILLE} impose des règles strictes sur la préservation du patrimoine bâti. L'usage d'ardoise synthétique contenant de l'amiante est strictement interdit en réfection, et le remplacement par de l'ardoise naturelle est encouragé.`,
      `Pour toute maison située dans le rayon de protection de {LANDMARK1} à {VILLE}, l'Architecte des Bâtiments de France exige des ardoises d'Angers de format traditionnel (32x22) posées aux crochets noirs invisibles pour conserver l'aspect historique.`,
      `Les fenêtres de toit (Velux) installées à {VILLE} dans les secteurs protégés doivent être encastrées dans la couverture avec raccordement zinc traditionnel. Les modèles débordants ordinaires sont systématiquement rejetés par l'ABF.`
    ];
    card2Text = opts2[prng.nextInt(opts2.length)];

    card3Title = parseSpintax(slug, 'c3t-r', "{Typologie du Bâti Local|Architecture & Bâti Régional|Bâti Traditionnel de Loire-Atlantique|Habitat Régional & Charpente|Logement de Pays & Couverture|Structures de Toit du 44|Matériaux Historiques Toiture|Typologie Habitat & Pente Toit}");
    const opts3 = [
      isLittoral
        ? `L'habitat à {VILLE} se compose de villas balnéaires aux architectures complexes, de maisons de pêcheurs traditionnelles et de pavillons côtiers récents. Les toits sont fortement inclinés pour chasser l'eau de pluie rapidement sous l'effet du vent. La présence de pins maritimes à {VILLE} entraîne l'accumulation d'aiguilles dans les cheneaux zinc. Les couvreurs locaux conseillent d'installer des grilles pare-feuilles robustes pour éviter que l'eau ne déborde sous la toiture lors des tempêtes hivernales.`
        : geoZone === 'metropole'
        ? `À {VILLE} ({POPULATION} habitants), le parc immobilier regroupe des immeubles de type nantais en centre-ville, couverts en zinc ou ardoise d'Angers, et des résidences pavillonnaires. Les chantiers urbains exigent une logistique spécifique (échafaudages de rue, bennes à gravats, autorisation de voirie). La charpente en sapin ou fermettes industrielles supporte souvent des ardoises fibro-ciment. Un diagnostic de présence de termites ou capricornes est préconisé avant toute réfection.`
        : `Dans le Vignoble ou le Pays de Retz près de {VILLE}, l'architecture traditionnelle est marquée par des toitures de tuiles canal à faible pente avec des génoises en terre cuite protégeant les murs de pierre. Les charpentes historiques en chêne de ces fermes restaurées nécessitent un savoir-faire spécifique pour la dépose et la pose afin de respecter la capacité de charge d'origine des structures anciennes.`,
      isLittoral
        ? `Les villas de la côte à {VILLE} ({ZIP}) exigent une isolation thermique continue de type sarking. Cette méthode d'isolation extérieure en fibre de bois haute densité prévient le gel des combles et résiste parfaitement à l'humidité côtière. Les charpentiers du 44 renforcent les chevrons de rive et posent des fixations en acier inoxydable de fort calibre pour résister au vent marin.`
        : geoZone === 'metropole'
        ? `Le bâti urbain de {VILLE} requiert des compétences pointues en zinguerie d'art. Les évacuations d'eaux pluviales en zinc, les tuyaux de descente et les raccords de lucarnes font partie du patrimoine nantais. Les charpentes de faubourgs en sapin ou fermettes supportent des couvertures étanches. Un couvreur certifié RGE du 44 assure l'isolation et la conformité RE2026.`
        : `Les fermettes en pierre du Pays de Retz à {VILLE} exigent des travaux respectueux du bâti ancien. Les toits en tuiles romanes ou canal reposent sur des liteaux en pin traité. L'artisan couvreur veille à conserver les débords et génoises traditionnelles en terre cuite qui caractérisent l'architecture rurale du sud de la Loire-Atlantique.`,
      isLittoral
        ? `À {VILLE}, restaurer les toits en ardoise exige de l'expérience en couverture de presqu'île. La pose d'ardoises naturelles espagnoles A1 ou d'Angers se fait au crochet inox de qualité marine sur un plancher de bois (voligeage) ventilé. La lame d'air sous ardoise évite la condensation causée par le contraste thermique entre l'air marin et l'intérieur chauffé.`
        : geoZone === 'metropole'
        ? `Les copropriétés et commerces de {VILLE} disposant de toitures plates ou terrasses font l'objet d'étanchéités multicouches en élastomère ou membranes synthétiques (EPDM). Ces complexes d'étanchéité résistent aux variations thermiques et assurent une protection absolue contre les infiltrations d'eau dans les appartements nantais.`
        : `Les toitures en tuiles canal à {VILLE} demandent une pose traditionnelle. Les couvreurs du 44 utilisent des tuiles de courant fixées par crochets ou scellées au mortier de chaux respirant. Cette technique évite le glissement des tuiles lors des fortes rafales de vent d'ouest et conserve le charme des bâtisses du Pays de Retz.`,
      isLittoral
        ? `Les maisons traditionnelles de pêcheurs à {VILLE} ({ZIP}) présentent des charpentes trapues en chêne de pays et des toits à double pan très pentus. Le faîtage en zinc plissé cloué assure une finition robuste capable de résister aux vents de mer.`
        : geoZone === 'metropole'
        ? `Les immeubles de la reconstruction à {VILLE} possèdent des charpentes métalliques ou en béton avec couverture légère en zinc. Les compagnons couvreurs y effectuent des chantiers de réfection par panneaux de zinc profilés de fort calibre.`
        : `Dans le secteur de {VILLE}, les granges et dépendances agricoles anciennes possèdent des structures de toiture d'origine. Les ardoises de pays clouées sur voliges de châtaignier y sont souvent remplacées par des tuiles romanes légères.`
    ];
    card3Text = opts3[prng.nextInt(opts3.length)];
  } else if (pageType === 'demoussage') {
    card1Title = parseSpintax(slug, 'c1t-d', "{Humidité Atlantique & Mousses|Développement de Mousses & Pluie|Humidité & Risque Mousses|Pénétration d'Eau & Lichens|Porosité des Ardoises & Lichens|Algues Marines & Démoussage|Stagnation d'Humidité & Lichens noirs|Détérioration du Support & Mousse}");
    const opts = [
      `Le climat océanique humide de Loire-Atlantique accélère la prolifération de mousses, mousses de mer et lichens sur les ardoises à {VILLE}. Ces végétaux agissent comme une éponge qui retient l'eau, rendant les ardoises ou les tuiles poreuses. Lors des gelées hivernales à {VILLE}, l'eau infiltrée gèle et fait éclater les matériaux. Un démoussage rigoureux suivi d'un traitement algicide et hydrofuge incolore étanche protège le toit pendant 10 ans. Budget moyen : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².`,
      `À {VILLE} ({ZIP}), les pluies régulières et l'absence de soleil hivernal favorisent les traces noires et le développement de lichens sur les toitures. Gorgés d'eau, ces organismes végétaux provoquent des micro-fissures sur la couverture. L'application d'un traitement hydrofuge à effet perlant imperméabilise le toit, bloque le développement des germes et retarde le retour des mousses. Budget moyen : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².`,
      `L'encrassement de votre couverture à {VILLE} fragilise l'étanchéité globale. La mousse s'incruste dans les pores de l'ardoise synthétique ou de la tuile. Pour protéger votre bien de l'humidité en Loire-Atlantique, un nettoyage doux à basse pression suivi d'un traitement fongicide curatif et d'une hydrofugation de surface est fortement recommandé pour prolonger la vie de votre toit.`,
      `Les lichens et les mousses incrustés sur les ardoises à {VILLE} s'alimentent de l'humidité de l'air marin. Leurs racines s'insinuent dans la roche et provoquent un effritement superficiel du schiste, augmentant sa sensibilité au gel.`,
      `À {VILLE} ({ZIP}), un toit non entretenu accumule une humidité permanente qui se transmet aux liteaux en bois sous-jacents. Un démoussage minutieux prévient le pourrissement prématuré de la charpente de votre pavillon.`,
      `Le verdissement rapide des toitures en tuiles canal à {VILLE} est accentué par les débris végétaux. Le nettoyage professionnel débarrasse les tuiles de la saleté et applique un fongicide rémanent qui détruit les germes de mousse.`,
      `Les toits en fibro-ciment posés à {VILLE} deviennent extrêmement poreux avec l'âge. Sans démoussage et hydrofugation colorée ou incolore régulière, ils absorbent l'eau de pluie et pèsent deux fois plus lourd sur la charpente.`,
      `L'application d'un traitement algicide curatif et préventif à {VILLE} élimine 100% des racines biologiques des mousses. L'hydrofuge perlant qui suit évacue l'eau de pluie par glissement, rendant la couverture autonettoyante.`
    ];
    card1Text = opts[prng.nextInt(opts.length)];

    card2Title = parseSpintax(slug, 'c2t-d', "{Règles Urbanisme & Entretien|Respect du Patrimoine & PLU|Esthétique Toiture & Mairie|Garantir l'Aspect Originel & PLU|Règles Esthétiques de Mairie|Normes d'Entretien du Bâti|Garder la Patine Incolore|Contraintes PLU sur Traitement}");
    const opts2 = [
      `L'entretien de toiture à {VILLE} doit respecter les directives du PLU concernant l'aspect extérieur. Bien que le nettoyage ne modifie pas la couverture, l'application d'un hydrofuge coloré nécessite une déclaration en mairie si la couleur d'origine est changée. Si vous résidez près de {LANDMARK1}, les Architectes des Bâtiments de France (ABF) exigent des traitements hydrofuges incolores préservant la patine et l'aspect mat de l'ardoise naturelle d'Angers.`,
      `À {VILLE} ({ZIP}), préserver l'aspect historique des toitures est une obligation réglementaire. Le démoussage prévient l'usure précoce sans dénaturer le bâti. Les professionnels RGE utilisent des traitements hydrofuges incolores respectant le patrimoine, indispensables si votre bien se situe dans les secteurs sauvegardés ou à proximité de {LANDMARK1}.`,
      `Pour nettoyer vos ardoises à {VILLE} en conformité avec les exigences de la commune, évitez les produits décapants bas de gamme au chlore qui blanchissent le support. L'ABF veille à l'harmonie des teintes sombres d'ardoise. Choisissez un traitement fongicide de qualité et un hydrofuge incolore qui conserve l'aspect brut du matériau tout en le rendant autonettoyant.`,
      `L'application d'un hydrofuge coloré (peinture de toiture) à {VILLE} est encadrée par la mairie. Seules les teintes gris ardoise foncé ou rouge brique traditionnel sont autorisées par le PLU local pour éviter toute pollution visuelle.`,
      `Pour les maisons de caractère à {VILLE} ({ZIP}) visibles depuis {LANDMARK2}, les produits chimiques acides sont proscrits par les règles environnementales de {INTERCO} afin de protéger la faune locale et les eaux de ruissellement.`,
      `Les Architectes des Bâtiments de France interdisent le décapage haute pression agressif sur les bâtiments anciens de {VILLE}. Ils préconisent des méthodes douces comme le brossage manuel et l'application d'antimousse biodégradable.`,
      `À {VILLE}, le PLU exige que les ardoises conservent leur éclat mat caractéristique. L'application d'un vernis brillant ou d'un hydrofuge de mauvaise qualité modifiant la texture de la couverture est rejetée par les services d'urbanisme.`,
      `Un entretien soigné par hydrofuge incolore siloxane à {VILLE} respecte les prescriptions esthétiques régionales du {DEPARTEMENT_CODE} tout en imperméabilisant les pores de l'ardoise d'Angers face aux embruns atlantiques.`
    ];
    card2Text = opts2[prng.nextInt(opts2.length)];

    card3Title = parseSpintax(slug, 'c3t-d', "{Architecture & Bâti Local|Matériaux & Bâti de Loire-Atlantique|Particularités du Bâti Local|Logement Régional & Nettoyage|Bâtisses de Pays & Mousses|Toiture Pavillonnaire & Entretien|Zinguerie & Pins Maritimes|Faubourgs Urbains & Traces Noires}");
    const opts3 = [
      isLittoral
        ? `Les villas et maisons côtières à {VILLE} ({ZIP}) équipées d'ardoises naturelles accumulent des mousses de mer épaisses nourries par les embruns humides. Un nettoyage doux est requis pour ne pas endommager les crochets inox 316. Les couvreurs du 44 appliquent un fongicide à action prolongée pour prévenir le verdissement rapide provoqué par l'humidité océanique directe.`
        : geoZone === 'metropole'
        ? `Les immeubles nantais et pavillons de {VILLE} sont exposés aux poussières urbaines et routières de la métropole, qui créent un dépôt acide favorisant l'implantation des mousses. Un traitement algicide curatif suivi d'une hydrofugation de surface protège les ardoises et prévient la stagnation de l'eau sur les toits plats zinc ou les noues.`
        : `Les maisons en pierre du Pays de Retz ou du Vignoble près de {VILLE} craignent les infiltrations d'eau au niveau des murs. Lors du nettoyage de la toiture en tuile romane, le couvreur s'assure du bon fonctionnement des gouttières et veille à ce que l'eau du lavage basse pression ne ruisselle pas sur les façades ou les joints anciens.`,
      isLittoral
        ? `Sur les toitures exposées aux tempêtes à {VILLE}, la mousse favorise la stagnation d'eau sous les ardoises, risquant de faire pourrir les liteaux en bois. Un nettoyage manuel par brossage doux suivi d'un traitement hydrofuge autonettoyant protège les ardoises contre les hivers pluvieux et limite le développement des algues.`
        : geoZone === 'metropole'
        ? `Les toitures en ardoise fibro-ciment des pavillons de {VILLE} deviennent très poreuses avec le temps. Le nettoyage doit exclure la haute pression à outrance pour ne pas arracher les fibres de ciment. Un traitement antimousse doux par pulvérisation préserve l'intégrité de la couverture et prolonge sa durée de vie.`
        : `L'entretien des tuiles canal à {VILLE} exige de la précaution. Ces tuiles anciennes, souvent scellées à la chaux, sont fragiles. Les couvreurs du 44 utilisent des échelles de toit adaptées pour répartir le poids et appliquent un antimousse par pulvérisation douce, préservant la stabilité des tuiles et des solins.`,
      isLittoral
        ? `Sur les villas côtières à {VILLE}, l'accumulation d'aiguilles de pin dans les gouttières aggrave les infiltrations. Un entretien complet comprend le nettoyage des chéneaux en zinc et la pose de grilles pare-feuilles en inox, en plus du traitement antimousse des ardoises de presqu'île.`
        : geoZone === 'metropole'
        ? `Les copropriétés et résidences de {VILLE} disposant de toitures en zinc joint debout ou toits terrasses réclament un entretien régulier des crapaudines et évacuations pluviales pour éviter tout engorgement. Pour les ardoises, l'hydrofuge retarde de plusieurs années l'apparition des lichens et traces blanches.`
        : `La toiture à forte pente de {VILLE} rend le nettoyage technique et dangereux. Les couvreurs professionnels utilisent des lignes de vie homologuées et des harnais de sécurité. Le traitement antimousse préserve le cachet historique des habitations en évitant le remplacement prématuré des tuiles canal.`,
      isLittoral
        ? `À {VILLE} ({ZIP}), les façades et les toits des villas font face au sable de mer. Le nettoyage basse pression élimine ce dépôt abrasif avant d'appliquer un algicide longue durée résistant au rinçage des tempêtes océaniques.`
        : geoZone === 'metropole'
        ? `Les copropriétés du centre historique de {VILLE} exigent une logistique de nettoyage urbaine. Nos partenaires installent des collecteurs de produits pour éviter la pollution des réseaux pluviaux de la métropole.`
        : `Les granges restaurées près de {VILLE} avec toits de tuiles canal accumulent des mousses de sous-bois. Un traitement anti-mousse professionnel préserve la solidité des tuiles scellées au mortier traditionnel.`
    ];
    card3Text = opts3[prng.nextInt(opts3.length)];
  } else {
    card1Title = parseSpintax(slug, 'c1t-a', "{Assurance Décennale Toiture|Garantie Décennale Couvreur|Sécurité 10 Ans Toiture|Décennale Obligatoire 44|Couverture Décennale Artisan|Garantie Constructeur Décennale|Assurance Responsabilité Décennale|Protection 10 Ans Couverture}");
    const opts = [
      `L'assurance décennale est une obligation légale pour tout couvreur intervenant sur le secteur de {VILLE} ({ZIP}). Ce contrat d'assurance professionnelle couvre les dommages compromettant la solidité de la toiture ou de la charpente pendant 10 ans. Demandez impérativement l'attestation nominative de l'assureur avant l'ouverture du chantier à {VILLE} pour sécuriser vos travaux.`,
      `En Loire-Atlantique, aucun travail de toiture à {VILLE} ne doit démarrer sans vérification de la garantie décennale du professionnel. Cette couverture protège les propriétaires contre tout vice de construction ou défaut d'étanchéité survenu après réception. Vérifiez que la police d'assurance mentionne précisément les activités de couverture, charpente et zinguerie pour l'année en cours.`,
      `La garantie décennale toiture sécurise votre investissement immobilier à {VILLE}. Elle garantit la prise en charge intégrale d'une réfection en cas de sinistre structurel ou d'infiltration majeure dans les dix ans. Avant de signer votre devis de toiture à {VILLE}, assurez-vous de la validité de l'assurance décennale pour le département 44.`,
      `À {VILLE}, les désordres liés à l'étanchéité du toit relèvent de la garantie décennale (loi Spinetta de 1978). Les travaux de zinguerie, de pose d'ardoise naturelle et de fenêtres de toit (Velux) y sont couverts pendant une durée légale de 10 ans.`,
      `Tout artisan couvreur intervenant à {VILLE} ({ZIP}) doit être couvert par une décennale valide en France. Exigez l'attestation originale mentionnant les coordonnées de l'assureur pour contrôler l'authenticité de la police.`,
      `Les sinistres de toiture causés par une tempête à {VILLE} ne relèvent pas de la décennale mais des assurances multirisques habitation, sauf si un vice de pose de l'artisan est à l'origine du sinistre structurel.`,
      `La garantie décennale toiture s'applique à {VILLE} pour les travaux de rénovation de couverture. Elle est transférée au nouvel acquéreur en cas de vente de la maison dans les dix ans suivant la réception du chantier.`,
      `Faites vérifier par un expert que le contrat décennale de l'entreprise à {VILLE} couvre l'activité spécifique de "sarking" ou d'isolation de toiture par l'extérieur si vous entreprenez une amélioration thermique.`
    ];
    card1Text = opts[prng.nextInt(opts.length)];

    card2Title = parseSpintax(slug, 'c2t-a', "{Label RGE & Aides Publiques|Artisans RGE & Subventions|Qualification RGE & Primes CEE|RGE Qualibat & MaPrimeRénov'|Couvreur RGE Loire-Atlantique|Labels Énergie & Subventions Toiture|Artisan RGE pour Isolation|Aides de l'État & Certification RGE}");
    const opts2 = [
      `La certification RGE (Reconnu Garant de l'Environnement) est indispensable pour débloquer les aides d'État à {VILLE} ({ZIP}). Qu'il s'agisse de MaPrimeRénov', de l'éco-PTZ ou des primes CEE spécifiques à la Loire-Atlantique, ces subventions ne sont accordées que si vos travaux d'isolation thermique (sarking ou combles perdus) sont réalisés par un couvreur certifié RGE actif dans votre commune.`,
      `Pour vos travaux de rénovation énergétique à {VILLE}, choisir un artisan labellisé RGE Qualibat ou Capeb est obligatoire. En plus de garantir un travail conforme aux normes d'économie d'énergie (RE2026), ce label vous permet de financer jusqu'à 65% du coût des isolants et pare-vapeur grâce aux dispositifs MaPrimeRénov' et aux aides locales.`,
      `Bénéficiez des aides publiques en Loire-Atlantique pour isoler votre toit à {VILLE}. Les primes de l'ANAH et les certificats d'économie d'énergie (CEE) nécessitent l'intervention d'une entreprise possédant la mention RGE Rénovation Globale ou Couverture. Comparez les devis détaillés mentionnant les performances de résistance thermique (R) requises (R ≥ 6 pour le sarking) pour obtenir vos financements.`,
      `À {VILLE}, le nombre de couvreurs qualifiés RGE est limité. Pensez à réserver votre artisan RGE du 44 plusieurs mois à l'avance pour planifier vos travaux d'isolation et soumettre vos dossiers MaPrimeRénov'.`,
      `La qualification RGE atteste que l'entreprise intervenant à {VILLE} ({ZIP}) respecte les règles techniques d'isolation thermique. C'est le gage d'un travail soigné réduisant efficacement vos factures de chauffage.`,
      `Les aides CEE de Loire-Atlantique pour l'isolation sous ardoise à {VILLE} exigent que l'isolant possède un coefficient de résistance thermique certifié (R ≥ 7 en combles perdus et R ≥ 6 en rampants).`,
      `Avant de signer avec un couvreur RGE à {VILLE}, contrôlez sa fiche sur l'annuaire officiel France Rénov' pour vous assurer que sa certification est toujours active pour l'année en cours dans le département 44.`,
      `Les syndics de copropriété à {VILLE} doivent impérativement exiger le label RGE des couvreurs-zingueurs pour obtenir les financements collectifs lors de la rénovation de toiture ou isolation des terrasses.`
    ];
    card2Text = opts2[prng.nextInt(opts2.length)];

    card3Title = parseSpintax(slug, 'c3t-a', "{Expertise Bâti Océanique (44)|Savoir-faire Couvreur 44|Compétences Toiture Littoral|Zinguerie d'Art & Compagnons|Savoir-faire Ardoise Naturelle|Compétence Charpente Traditionnelle|Artisans Certifiés du {DEPARTEMENT_CODE}|Maîtrise Toitures de Pays}");
    const opts3 = [
      isLittoral
        ? `Les toitures du littoral à {VILLE} ({ZIP}) exigent un savoir-faire hautement technique. Pour faire face aux tempêtes de vent d'ouest, au sel et à l'humidité marine, sélectionnez un artisan couvreur ayant des références solides dans la pose d'ardoise naturelle de fort calibre et de zingueries inox 316. Les entreprises locales maîtrisent les normes de sécurité spécifiques à la côte.`
        : geoZone === 'metropole'
        ? `Les toits de la métropole nantaise demandent des artisans familiers des problématiques urbaines (toitures zinc joint debout, échafaudages de rue, isolation thermique RE2026 contre les chaleurs estivales de la ville). Privilégiez des couvreurs disposant d'un ancrage local fort à {VILLE} ou dans les communes voisines pour garantir un service rapide.`
        : `La rénovation des toits du Vignoble ou du Pays de Retz près de {VILLE} requiert une expertise spécifique en couverture traditionnelle (ardoise naturelle ou tuile canal). L'artisan choisi doit comprendre la structure de charpente en bois ancienne pour ne pas la surcharger. Demandez des références de chantiers de rénovation de longères locales.`,
      isLittoral
        ? `Engager un couvreur à {VILLE} pour une villa ou une maison côtière impose de vérifier ses qualifications en pose d'ardoises au crochet inox renforcé. Les toits littoraux subissent des tempêtes violentes ; l'artisan doit savoir appliquer les règles de fixation renforcée pour garantir la sécurité et la durabilité du toit.`
        : geoZone === 'metropole'
        ? `À {VILLE}, comparez les offres de couvreurs qualifiés RGE. Les travaux d'isolation thermique par l'extérieur (sarking) ou de réfection de toiture-terrasse réclament des techniques modernes. Un couvreur local dans l'agglomération nantaise saura vous proposer les isolants les plus performants contre l'humidité hivernale et le déphasage estival.`
        : `Le savoir-faire pour les toitures en ardoise naturelle ou tuiles canal à {VILLE} est détenu par des artisans couvreurs traditionnels de Loire-Atlantique. Ils réalisent des zingueries sur-mesure de fort calibre et des débords de toit conformes aux règles de l'art locales.`,
      isLittoral
        ? `Pour vos travaux sur la côte à {VILLE}, planifiez l'intervention avec un couvreur local entre le printemps et l'automne. Les entreprises spécialisées littoral organisent leurs chantiers selon les fenêtres climatiques et disposent de matériels de levage adaptés aux contraintes de la côte atlantique.`
        : geoZone === 'metropole'
        ? `Trouver un couvreur réactif à {VILLE} nécessite de cibler des entreprises disposant d'assurances décennales adaptées aux différents types de supports (zinc, ardoise naturelle, étanchéité de toit plat). Privilégiez les professionnels certifiés RGE qualifiés pour l'isolation et la réfection de combles.`
        : `Dans le Vignoble Nantais près de {VILLE}, fuyez le démarchage à domicile abusif proposant des nettoyages de toiture miracles à prix cassés. Tournez-vous vers des couvreurs-charpentiers locaux, certifiés RGE et assurés, engagés dans la préservation du patrimoine en Loire-Atlantique.`,
      isLittoral
        ? `À {VILLE} ({ZIP}), les artisans couvreurs locaux maîtrisent le façonnage des noues ventilées en zinc plombé, indispensables pour évacuer les gros volumes d'eaux pluviales poussés par le vent d'ouest.`
        : geoZone === 'metropole'
        ? `Les toitures en zinc à joint debout des résidences de {VILLE} exigent un pliage parfait réalisé à la plieuse numérique par un couvreur-zingueur qualifié pour éviter tout risque de fuite par capillarité.`
        : `Les charpentiers professionnels du Pays de Retz près de {VILLE} taillent les lucarnes à deux pans et renforcent les entraits de charpente des longères pour accueillir le poids des ardoises naturelles espagnoles.`
    ];
    card3Text = opts3[prng.nextInt(opts3.length)];
  }

  // Icons matching pageType
  const card1Icon = pageType === 'refection' ? "🌧️" : pageType === 'demoussage' ? "🧼" : "🛡️";
  const card2Icon = pageType === 'refection' ? "🏛️" : pageType === 'demoussage' ? "🏛️" : "🏆";
  const card3Icon = pageType === 'refection' ? "🏡" : pageType === 'demoussage' ? "🏡" : "🏠";

  const cards = [
    { title: parseSpintax(slug, 'c1t', replaceVariables(card1Title, vars)), text: parseSpintax(slug, 'c1', replaceVariables(card1Text, vars)), icon: card1Icon },
    { title: parseSpintax(slug, 'c2t', replaceVariables(card2Title, vars)), text: parseSpintax(slug, 'c2', replaceVariables(card2Text, vars)), icon: card2Icon },
    { title: parseSpintax(slug, 'c3t', replaceVariables(card3Title, vars)), text: parseSpintax(slug, 'c3', replaceVariables(card3Text, vars)), icon: card3Icon }
  ];

  // ============ DYNAMIC ENERGY & REAL ESTATE BLOCKS ============
  const energyOpts = [
    `En Loire-Atlantique, l'isolation thermique sous toiture est l'opération la plus rentable pour réduire la consommation d'énergie. En effet, près de 30% de la chaleur s'échappe par un toit non ou mal isolé. À {VILLE}, installer une isolation par sarking en fibre de bois (R≥6) ou réaliser un soufflage de ouate de cellulose dans les combles perdus permet d'abaisser les factures de chauffage de 30 à 45% en hiver et de maintenir le frais lors des chaleurs estivales. Ces travaux sont éligibles à MaPrimeRénov' et aux primes CEE du 44.`,
    `Faire isoler sa toiture à {VILLE} ({ZIP}) protège votre habitation contre l'humidité et les variations climatiques océaniques. En isolant vos combles rampants par laine de bois ou laine de roche (R ≥ 6), vous réduisez de manière significative vos besoins en chauffage. Cette rénovation énergétique élimine les déperditions thermiques par le haut de la maison et améliore le confort thermique global, un atout précieux dans la région nantaise.`,
    `L'isolation de toiture à {VILLE} est un levier majeur d'économie d'énergie. En optant pour le sarking (isolation par l'extérieur), vous conservez la hauteur sous plafond de vos combles aménagés tout en supprimant la totalité des ponts thermiques. Réalisé par un couvreur RGE du 44, ce chantier vous donne droit aux subventions énergétiques nationales (MaPrimeRénov') et locales.`,
    `À {VILLE}, isoler ses combles est le premier geste d'économie d'énergie pour lutter contre l'humidité atlantique. Une résistance thermique certifiée R=7 minimum permet de réduire vos besoins en climatisation l'été et de diviser par deux les déperditions thermiques de votre toit.`,
    `Faire réaliser une isolation thermique de toiture par sarking à {VILLE} ({ZIP}) protège la charpente en bois contre les variations d'humidité et offre un déphasage thermique idéal lors des canicules estivales du département 44.`,
    `L'isolation de toiture par l'intérieur sous rampants à {VILLE} à l'aide de laine de verre ou de ouate de cellulose améliore instantanément l'étanchéité à l'air de votre maison et abaisse votre consommation de gaz ou d'électricité.`,
    `Les résidences pavillonnaires à {VILLE} avec toits d'ardoise synthétique bénéficient d'une isolation soufflée en laine de roche. C'est une solution rapide, économique et très efficace pour piéger la chaleur dans les pièces de vie.`,
    `Réaliser des travaux d'isolation thermique de couverture par un artisan couvreur RGE certifié à {VILLE} permet de cumuler les subventions locales du {DEPARTEMENT_CODE} et d'obtenir un prêt à taux zéro pour le reste à charge.`
  ];
  const energyTemplate = energyOpts[prng.nextInt(energyOpts.length)];

  const realEstateOpts = [
    `Une toiture neuve ou entretenue avec facture décennale à l'appui est un argument majeur lors de la vente d'une maison à {VILLE}. Elle garantit à l'acheteur l'absence de frais majeurs sur les 15 prochaines années et valorise le bien sur le marché immobilier de la métropole nantaise ou du littoral. Présenter un toit propre traité hydrofuge et une isolation thermique certifiée améliore la note du DPE, indispensable pour la mise en vente.`,
    `Sur le marché de l'immobilier à {VILLE} ({ZIP}), la toiture est un indicateur de vétusté scruté par tous les acquéreurs. Un toit propre, sans mousses et parfaitement isolé augmente la valeur verte de votre maison. Les factures de nettoyage hydrofuge ou de réfection complète par un artisan du 44 rassurent les acheteurs et justifient une plus-value lors des négociations de vente.`,
    `Valorisez votre patrimoine immobilier à {VILLE} grâce à une toiture impeccable. Un toit mal entretenu ou avec des ardoises poreuses décote immédiatement un pavillon individuel ou une maison de pays. En présentant un DPE amélioré grâce à une toiture isolée par l'extérieur et une étanchéité garantie par décennale, vous accélérez la vente de votre bien sur le marché de Loire-Atlantique.`,
    `Lors d'une transaction immobilière à {VILLE}, la présentation d'une attestation décennale toiture valide rassure l'acquéreur et évite toute négociation à la baisse du prix de vente de votre villa ou longère.`,
    `À {VILLE} ({ZIP}), le traitement hydrofuge de la toiture valorise l'aspect visuel de votre habitation. Une couverture propre sans traces d'humidité favorise le coup de cœur de l'acheteur et accélère la vente.`,
    `L'amélioration du DPE de votre maison à {VILLE} suite à une réfection de toiture avec isolation thermique par l'extérieur (sarking) augmente sa valeur sur le marché de la métropole et du littoral.`,
    `Une couverture ardoise neuve installée à {VILLE} par un couvreur qualifié du 44 constitue un investissement patrimonial très rentable, offrant une durée de vie de plus de 80 ans sans entretien lourd.`,
    `Les agents immobiliers du secteur de {VILLE} confirment qu'une toiture dégradée ou envahie par la mousse engendre une baisse immédiate de 10% sur l'estimation de la valeur vénale d'un pavillon familial.`
  ];
  const realEstateTemplate = realEstateOpts[prng.nextInt(realEstateOpts.length)];

  // ============ DYNAMIC HEADINGS & LAYOUT SHUFFLING ============
  const headingsOptions = {
    specificities: [
      `Spécificités techniques de la couverture à ${commune.nom}`,
      `Particularités et contraintes de toiture à ${commune.nom} (${commune.codePostal})`,
      `Techniques de couverture adaptées au climat de ${commune.nom}`,
      `Analyse technique des toitures à ${commune.nom}`,
      `Ce qu'il faut savoir sur la couverture à ${commune.nom}`,
      `Règles de l'art pour les toits de ${commune.nom}`,
      `Couverture ardoise, tuile & zinc à ${commune.nom}`,
      `Spécificités locales du bâti et toitures à ${commune.nom}`
    ],
    regulations: [
      `Réglementation Toiture à ${commune.nom} (44)`,
      `Normes de Couverture & Urbanisme à ${commune.nom}`,
      `Règles PLU et Sécurité de Toit à ${commune.nom}`,
      `Contraintes d'Urbanisme & PLU à ${commune.nom}`,
      `Directives Mairie & Patrimoine à ${commune.nom}`,
      `Normes administratives de toiture à ${commune.nom}`,
      `PLU et Architecte des Bâtiments de France à ${commune.nom}`,
      `Cadre réglementaire de couverture à ${commune.nom}`
    ],
    prices: [
      `Tarifs des Couvreurs à ${commune.nom} en 2026`,
      `Prix Moyen Toiture à ${commune.nom} (${commune.codePostal})`,
      `Grille Tarifaire Couverture & Toiture à ${commune.nom}`,
      `Quel budget pour un toit à ${commune.nom} ?`,
      `Estimations des prix toiture à ${commune.nom}`,
      `Coût des travaux de toiture à ${commune.nom}`,
      `Grille de tarifs couvreur à ${commune.nom} (44)`,
      `Prix au m² réfection et entretien à ${commune.nom}`
    ],
    aides: [
      `Aides & Subventions Toiture à ${commune.nom} (2026)`,
      `Subventions & Financement Toiture à ${commune.nom}`,
      `MaPrimeRénov' et aides à l'isolation de toit à ${commune.nom}`,
      `Comment financer son toit à ${commune.nom} ?`,
      `Dispositifs d'aides énergétiques à ${commune.nom}`,
      `Subventionner l'isolation de toiture à ${commune.nom}`,
      `Aides ANAH & CEE pour votre toiture à ${commune.nom}`,
      `Financement de la rénovation de toiture à ${commune.nom}`
    ],
    performance: [
      `Isolation & Valorisation Immobilière à ${commune.nom}`,
      `Performance Énergétique & Valeur de Votre Toit à ${commune.nom}`,
      `Économies d'Énergie et DPE de Votre Toiture à ${commune.nom}`,
      `Valoriser sa maison à ${commune.nom} par le toit`,
      `Atout DPE et valeur verte de la toiture à ${commune.nom}`,
      `Confort thermique et isolation de toit à ${commune.nom}`,
      `Économiser sur le chauffage à ${commune.nom} par la toiture`,
      `Impact énergétique et DPE de la couverture à ${commune.nom}`
    ],
    checklist: [
      `Checklist : 6 Points à Vérifier Avant de Signer`,
      `Contrôler son Couvreur à ${commune.nom} : 6 Critères`,
      `Points de Vigilance Avant d'Engager un Artisan à ${commune.nom}`,
      `Vérifier les assurances de son couvreur à ${commune.nom}`,
      `Comment choisir la bonne entreprise de toiture à ${commune.nom} ?`,
      `Critères de sélection d'un couvreur à ${commune.nom}`,
      `Reconnaître un artisan couvreur sérieux à ${commune.nom}`,
      `Sécuriser son devis toiture à ${commune.nom} : 6 étapes`
    ],
    market: [
      `Marché de la Couverture à ${commune.nom} — Données 2026`,
      `Indicateurs Couvreurs RGE à ${commune.nom} (44)`,
      `Statistiques locales Couverture et Délais à ${commune.nom}`,
      `Chiffres clés de la couverture à ${commune.nom}`,
      `Données du marché de la toiture à ${commune.nom}`,
      `Disponibilité couvreurs RGE et délais à ${commune.nom}`,
      `Statistiques couvreur RGE et devis à ${commune.nom}`,
      `Indicateurs chantiers toiture à ${commune.nom} (44)`
    ],
    methodology: [
      `Les étapes clés d'un entretien de toiture réussi à ${commune.nom}`,
      `Protocole de Nettoyage de Toiture à ${commune.nom}`,
      `Comment se Déroule le Démoussage de Votre Toit à ${commune.nom}`,
      `Méthode professionnelle de démoussage à ${commune.nom}`,
      `Les 4 phases d'un entretien de toiture à ${commune.nom}`,
      `Étapes de nettoyage et hydrofugation à ${commune.nom}`,
      `Comment nettoyer durablement son toit à ${commune.nom}`,
      `Protocole de soin et démoussage toiture à ${commune.nom}`
    ],
    impact: [
      `Pourquoi entretenir régulièrement sa toiture à ${commune.nom} ?`,
      `Intérêt d'un Démoussage Régulier à ${commune.nom} (${commune.codePostal})`,
      `Bénéfices du Nettoyage de Toit à ${commune.nom}`,
      `Protéger son toit contre l'humidité à ${commune.nom}`,
      `Pourquoi démousser évite de lourds travaux à ${commune.nom} ?`,
      `Intérêt technique d'un nettoyage hydrofuge à ${commune.nom}`,
      `Bénéfices durables du démoussage de toit à ${commune.nom}`,
      `Sauvegarder l'étanchéité du toit à ${commune.nom} par le démoussage`
    ]
  };

  const prngHeadings = new SeededRandom(slug + "-headings");
  const headings: Record<string, string> = {};
  for (const [key, options] of Object.entries(headingsOptions)) {
    const rawHeading = options[prngHeadings.nextInt(options.length)];
    headings[key] = parseSpintax(slug, `heading-${key}`, replaceVariables(rawHeading, vars));
  }

  let sectionOrder: string[] = [];
  if (pageType === 'refection') {
    sectionOrder = shuffleArray(['specificities', 'regulations', 'prices', 'aides', 'performance'], slug + "-refection-order");
  } else if (pageType === 'demoussage') {
    sectionOrder = shuffleArray(['methodology', 'specificities', 'prices', 'impact'], slug + "-demoussage-order");
  } else {
    sectionOrder = shuffleArray(['specificities', 'checklist', 'market'], slug + "-artisan-order");
  }

  // Parse & replace
  const finalTitle = parseSpintax(slug, 'title', replaceVariables(titleTemplate, vars));
  const finalIntro = parseSpintax(slug, 'intro', replaceVariables(introTemplate, vars));
  const finalEnergy = parseSpintax(slug, 'energy', replaceVariables(energyTemplate, vars));
  const finalRealEstate = parseSpintax(slug, 'realestate', replaceVariables(realEstateTemplate, vars));

  return {
    title: finalTitle,
    introParagraph: finalIntro,
    cards,
    sectionOrder,
    headings,
    energyProfileText: finalEnergy,
    realEstateInsight: finalRealEstate,
    climateContext: cards[0].text,
    abfRegulations: cards[1].text,
    housingTypologyInsight: cards[2].text,
    conseilLocal: commune.conseilLocal || "",
    introText: commune.introText || "",
    roofCharacteristics: commune.roofCharacteristics || null,
    faqItems: commune.faq || [],
    externalLinks: getExternalLinks(commune),
    aides: getAidesContent(commune),
    regulations: getRegulationsContent(commune),
    metadata: {
      geoZone,
      density,
      isLittoral,
      landmark1,
      landmark2,
      tuileDominante,
      microRegionLabel
    }
  };
}
