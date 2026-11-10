/* How much of one page is literally the same prose as another.
 *
 * Jaccard similarity over 5-word shingles of the visible text. Five words is
 * the length at which a match stops being "both pages are about couriers" and
 * starts being "this sentence was copied".
 *
 * Why this exists: the competitor's 325 city pages score ~0.71 against each
 * other, which is what thin templated content measures like. Two families
 * here hit the same number once and were rewritten until they did not. Any
 * new page family gets measured the same way before it ships.
 *
 *   node tools/dupcheck.mjs                 the standing checks
 *   node tools/dupcheck.mjs a/ b/ c/        pairwise, for anything
 *
 * Rough reading: under 0.40 is fine, 0.40–0.55 is worth a look, over 0.60 is
 * the same page twice.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = 5;

/* Visible prose only. Script, style and the JSON-LD block are stripped first —
   the schema repeats the FAQ answers verbatim, so leaving it in would score
   every page as half-duplicate of itself. Navigation is stripped too: the
   header and footer are identical by design on all 360 pages and would swamp
   the signal they are meant to measure. */
function words(file) {
  let h = fs.readFileSync(file, 'utf8');
  h = h.replace(/<script[\s\S]*?<\/script>/gi, ' ')
       .replace(/<style[\s\S]*?<\/style>/gi, ' ')
       .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
       .replace(/<header[\s\S]*?<\/header>/gi, ' ')
       .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
       .replace(/<!--[\s\S]*?-->/g, ' ')
       .replace(/<[^>]+>/g, ' ')
       .replace(/&[a-z]+;|&#\d+;/gi, ' ');
  return h.split(/\s+/).filter(Boolean);
}

function shingles(file) {
  const w = words(file);
  const s = new Set();
  for (let i = 0; i + N <= w.length; i++) s.add(w.slice(i, i + N).join(' '));
  return s;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const page = p => path.join(ROOT, p.replace(/\/$/, ''), 'index.html');

function report(label, pairs) {
  console.log('\n' + label);
  let worst = 0;
  for (const [a, b] of pairs) {
    const fa = page(a), fb = page(b);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) { console.log(`  ?  ${a} / ${b} — חסר`); continue; }
    const j = jaccard(shingles(fa), shingles(fb));
    worst = Math.max(worst, j);
    const flag = j > 0.60 ? '✗' : j > 0.45 ? '!' : '✓';
    console.log(`  ${flag}  ${j.toFixed(3)}   ${a}  ↔  ${b}`);
  }
  return worst;
}

const args = process.argv.slice(2);

if (args.length >= 2) {
  const pairs = [];
  for (let i = 0; i < args.length; i++)
    for (let j = i + 1; j < args.length; j++) pairs.push([args[i], args[j]]);
  report('השוואה', pairs);
  process.exit(0);
}

console.log('חפיפת טקסט בין דפים — Jaccard על רצפים של 5 מילים');

let worst = 0;

/* The one this file was written for: the paid landing page and the organic
   hub both cover process serving, and two pages saying the same thing is
   cannibalisation however differently they are designed. */
worst = Math.max(worst, report('דף נחיתה מול דף ההסבר', [
  ['legal', 'מסירה-משפטית'],
]));

worst = Math.max(worst, report('דפי מסירה משפטית לפי עיר', [
  ['מסירה-משפטית-בתל-אביב', 'מסירה-משפטית-בחיפה'],
  ['מסירה-משפטית-בחיפה', 'מסירה-משפטית-בבאר-שבע'],
  ['מסירה-משפטית-בתל-אביב', 'מסירה-משפטית-בנתניה'],
]));

worst = Math.max(worst, report('דפי מסלול', [
  ['משלוח-מתל-אביב-לחיפה', 'משלוח-מתל-אביב-לירושלים'],
  ['משלוח-מחיפה-לאשדוד', 'משלוח-מנתניה-לרחובות'],
]));

worst = Math.max(worst, report('דפי עיר', [
  ['משלוחים-בתל-אביב', 'משלוחים-בחיפה'],
  ['משלוחים-ברעננה', 'משלוחים-בכפר-סבא'],
]));

console.log(`\nהגבוה ביותר: ${worst.toFixed(3)}`);
process.exit(worst > 0.60 ? 1 : 0);
