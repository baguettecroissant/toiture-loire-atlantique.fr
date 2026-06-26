import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { generateCommuneContent } from '../src/lib/contentEngine.ts';

const communesPath = join(process.cwd(), 'src', 'data', 'communes.json');
const communes = JSON.parse(readFileSync(communesPath, 'utf-8'));

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .split(/\s+/);
  
  const filtered = words.filter(w => w.length >= 4); // Only keep words of 4+ characters
  return new Set(filtered);
}

function JaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

interface PageContent {
  intro: string;
  cards: string[];
  energyProfile: string;
  realEstate: string;
  aides: string[];
  regulations: string[];
}

function getPageText(local: any): string {
  const texts = [
    local.title,
    local.introParagraph,
    ...local.cards.map((c: any) => `${c.title} ${c.text}`),
    local.energyProfileText || '',
    local.realEstateInsight || '',
    local.aides?.maprime || '',
    local.aides?.cee || '',
    local.aides?.tva || '',
    local.aides?.anah || '',
    local.aides?.total || '',
    local.regulations?.plu || '',
    local.regulations?.risqueIncendie || '',
    local.regulations?.mistral || '',
    local.regulations?.abf || '',
    local.introText || '',
    local.conseilLocal || ''
  ];
  return texts.join(' ');
}

function checkDuplicateParagraphs(localA: any, localB: any): string[] {
  const getParas = (local: any) => [
    local.introParagraph,
    ...local.cards.map((c: any) => c.text),
    local.energyProfileText || '',
    local.realEstateInsight || '',
    local.aides?.maprime || '',
    local.aides?.cee || '',
    local.aides?.tva || '',
    local.aides?.anah || '',
    local.aides?.total || '',
    local.regulations?.plu || '',
    local.regulations?.risqueIncendie || '',
    local.regulations?.mistral || '',
    local.regulations?.abf || ''
  ].map(p => p.trim()).filter(p => p.length > 50);

  const parasA = getParas(localA);
  const parasB = getParas(localB);
  
  const duplicates: string[] = [];
  for (const pA of parasA) {
    if (parasB.includes(pA)) {
      duplicates.push(pA);
    }
  }
  return duplicates;
}

function analyzePageType(pageType: 'refection' | 'demoussage' | 'artisan') {
  console.log(`\n=== Analyzing uniqueness for page type: ${pageType} ===`);
  
  const tokensMap = new Map<string, Set<string>>();
  const localMap = new Map<string, any>();
  
  for (const c of communes) {
    const local = generateCommuneContent(c, pageType);
    const fullText = getPageText(local);
    tokensMap.set(c.slug, tokenize(fullText));
    localMap.set(c.slug, local);
  }

  let totalSim = 0;
  let count = 0;
  let maxSim = 0;
  let maxPair = { a: '', b: '' };
  const highSimilarityPairs: { a: string, b: string, sim: number }[] = [];
  const duplicateParagraphPairs: { a: string, b: string, paras: string[] }[] = [];

  for (let i = 0; i < communes.length; i++) {
    for (let j = i + 1; j < communes.length; j++) {
      const slugA = communes[i].slug;
      const slugB = communes[j].slug;
      const setA = tokensMap.get(slugA)!;
      const setB = tokensMap.get(slugB)!;
      
      const sim = JaccardSimilarity(setA, setB);
      totalSim += sim;
      count++;

      if (sim > maxSim) {
        maxSim = sim;
        maxPair = { a: communes[i].nom, b: communes[j].nom };
      }

      if (sim > 0.35) {
        highSimilarityPairs.push({ a: communes[i].nom, b: communes[j].nom, sim });
      }

      // Check exact paragraph duplicates
      const dupParas = checkDuplicateParagraphs(localMap.get(slugA)!, localMap.get(slugB)!);
      if (dupParas.length > 0) {
        duplicateParagraphPairs.push({ a: communes[i].nom, b: communes[j].nom, paras: dupParas });
      }
    }
  }

  const avgSim = totalSim / count;
  console.log(`Average Jaccard Similarity: ${(avgSim * 100).toFixed(2)}%`);
  console.log(`Maximum Jaccard Similarity: ${(maxSim * 100).toFixed(2)}% (between ${maxPair.a} and ${maxPair.b})`);
  console.log(`Pairs with > 35% Jaccard Similarity: ${highSimilarityPairs.length}`);
  if (highSimilarityPairs.length > 0) {
    console.log('Top high similarity pairs:');
    highSimilarityPairs.slice(0, 10).forEach(p => {
      console.log(`  - ${p.a} & ${p.b}: ${(p.sim * 100).toFixed(2)}%`);
    });
  }
  
  console.log(`Pairs with exact duplicate paragraphs: ${duplicateParagraphPairs.length}`);
  if (duplicateParagraphPairs.length > 0) {
    console.log('Sample duplicate paragraphs pairs:');
    duplicateParagraphPairs.slice(0, 5).forEach(p => {
      console.log(`  - ${p.a} & ${p.b} share ${p.paras.length} identical paragraphs.`);
    });
  }
  
  return { avgSim, maxSim, highSimCount: highSimilarityPairs.length, dupParasCount: duplicateParagraphPairs.length };
}

console.log(`Loaded ${communes.length} communes.`);
const refectionStats = analyzePageType('refection');
const demoussageStats = analyzePageType('demoussage');
const artisanStats = analyzePageType('artisan');

console.log('\n=== Summary ===');
console.log(`Refection: Avg Sim = ${(refectionStats.avgSim * 100).toFixed(2)}%, Max Sim = ${(refectionStats.maxSim * 100).toFixed(2)}%, High Sim Pairs = ${refectionStats.highSimCount}, Dup Paras Pairs = ${refectionStats.dupParasCount}`);
console.log(`Demoussage: Avg Sim = ${(demoussageStats.avgSim * 100).toFixed(2)}%, Max Sim = ${(demoussageStats.maxSim * 100).toFixed(2)}%, High Sim Pairs = ${demoussageStats.highSimCount}, Dup Paras Pairs = ${demoussageStats.dupParasCount}`);
console.log(`Artisan: Avg Sim = ${(artisanStats.avgSim * 100).toFixed(2)}%, Max Sim = ${(artisanStats.maxSim * 100).toFixed(2)}%, High Sim Pairs = ${artisanStats.highSimCount}, Dup Paras Pairs = ${artisanStats.dupParasCount}`);

if (refectionStats.maxSim > 0.50 || demoussageStats.maxSim > 0.50 || artisanStats.maxSim > 0.50 || refectionStats.dupParasCount > 0 || demoussageStats.dupParasCount > 0 || artisanStats.dupParasCount > 0) {
  console.log('\n❌ WARNING: Content uniqueness standards NOT met. Too many duplicates or high similarity.');
} else {
  console.log('\n✅ SUCCESS: Content uniqueness standards met!');
}
