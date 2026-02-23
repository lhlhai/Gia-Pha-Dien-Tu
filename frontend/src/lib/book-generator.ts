/**
 * Book Generator — Transforms genealogy tree data into a structured book format.
 * FIXED: Root detection based on parentFamilies instead of families.children
 */

import type { TreeNode, TreeFamily } from './tree-layout';

// ═══ Book Data Types ═══

export interface BookPerson {
  handle: string;
  name: string;
  gender: number;
  birthYear?: number;
  deathYear?: number;
  isLiving: boolean;
  isPatrilineal: boolean;
  generation: number;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  spouseYears?: string;
  spouseNote?: string;
  children: { name: string; years: string; note?: string }[];
  childIndex?: number;
}

export interface BookChapter {
  generation: number;
  title: string;
  romanNumeral: string;
  members: BookPerson[];
}

export interface BookData {
  familyName: string;
  exportDate: string;
  totalGenerations: number;
  totalMembers: number;
  totalPatrilineal: number;
  chapters: BookChapter[];
  nameIndex: { name: string; generation: number; isPatrilineal: boolean }[];
}

// ═══ Helpers ═══

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];

function romanNumeral(n: number): string {
  return ROMAN[n] || `${n + 1}`;
}

function genTitle(gen: number): string {
  const roman = romanNumeral(gen);
  return gen === 0 ? `ĐỜI THỨ ${roman} — THỦY TỔ` : `ĐỜI THỨ ${roman}`;
}

function formatYears(b?: number, d?: number, living?: boolean): string {
  if (!b) return '—';
  if (d) return `${b} – ${d}`;
  if (living) return `${b} – nay`;
  return `${b}`;
}

// ═══ Main Generator ═══

export function generateBookData(
  people: TreeNode[],
  families: TreeFamily[],
  familyName: string = 'Lê'
): BookData {

  const personMap = new Map(people.map(p => [p.handle, p]));
  const familyMap = new Map(families.map(f => [f.handle, f]));

  // ── STEP 1: FIND ROOTS BY parentFamilies ──
  const roots = people.filter(
    p => !p.parentFamilies || p.parentFamilies.length === 0
  );

  const generations = new Map<string, number>();

  function setGen(handle: string, gen: number) {
    if (generations.has(handle)) return;
    generations.set(handle, gen);

    const person = personMap.get(handle);
    if (!person) return;

    // traverse families where person is parent
    for (const famId of person.families) {
      const fam = familyMap.get(famId);
      if (!fam) continue;

      // spouse same generation
      if (fam.fatherHandle && fam.fatherHandle !== handle)
        generations.set(fam.fatherHandle, gen);

      if (fam.motherHandle && fam.motherHandle !== handle)
        generations.set(fam.motherHandle, gen);

      // children next generation
      for (const ch of fam.children) {
        setGen(ch, gen + 1);
      }
    }
  }

  // assign from roots
  for (const r of roots) {
    setGen(r.handle, 0);
  }

  // fallback
  for (const p of people) {
    if (!generations.has(p.handle)) generations.set(p.handle, 0);
  }

  // ── STEP 2: BUILD BOOK PERSONS ──
  const bookPersons: BookPerson[] = [];

  for (const p of people) {
    if (!p.isPatrilineal) continue;

    const gen = generations.get(p.handle) ?? 0;

    // parents
    let fatherName: string | undefined;
    let motherName: string | undefined;

    for (const pfId of p.parentFamilies) {
      const pf = familyMap.get(pfId);
      if (!pf) continue;

      if (pf.fatherHandle) {
        const f = personMap.get(pf.fatherHandle);
        if (f) fatherName = f.displayName;
      }
      if (pf.motherHandle) {
        const m = personMap.get(pf.motherHandle);
        if (m) motherName = m.displayName;
      }
    }

    // spouse + children
    let spouseName: string | undefined;
    let spouseYears: string | undefined;
    let spouseNote: string | undefined;
    const children: BookPerson['children'] = [];

    for (const famId of p.families) {
      const fam = familyMap.get(famId);
      if (!fam) continue;

      const spouseHandle =
        fam.fatherHandle === p.handle ? fam.motherHandle : fam.fatherHandle;

      if (spouseHandle) {
        const s = personMap.get(spouseHandle);
        if (s) {
          spouseName = s.displayName;
          spouseYears = formatYears(s.birthYear, s.deathYear, s.isLiving);
          if (!s.isPatrilineal) spouseNote = 'Ngoại tộc';
        }
      }

      for (const ch of fam.children) {
        const c = personMap.get(ch);
        if (c) {
          children.push({
            name: c.displayName,
            years: formatYears(c.birthYear, c.deathYear, c.isLiving),
            note: !c.isPatrilineal ? 'Ngoại tộc' : undefined
          });
        }
      }
    }

    // child index
    let childIndex: number | undefined;
    if (p.parentFamilies.length > 0) {
      const pf = familyMap.get(p.parentFamilies[0]);
      if (pf) {
        const idx = pf.children.indexOf(p.handle);
        if (idx >= 0) childIndex = idx + 1;
      }
    }

    bookPersons.push({
      handle: p.handle,
      name: p.displayName,
      gender: p.gender,
      birthYear: p.birthYear,
      deathYear: p.deathYear,
      isLiving: p.isLiving,
      isPatrilineal: p.isPatrilineal,
      generation: gen,
      fatherName,
      motherName,
      spouseName,
      spouseYears,
      spouseNote,
      children,
      childIndex
    });
  }

  // ── STEP 3: BUILD CHAPTERS ──
  const maxGen = Math.max(...Array.from(generations.values()));
  const chapters: BookChapter[] = [];

  for (let g = 0; g <= maxGen; g++) {
    const members = bookPersons
      .filter(p => p.generation === g)
      .sort((a,b) => (a.childIndex ?? 99) - (b.childIndex ?? 99));

    if (members.length === 0) continue;

    chapters.push({
      generation: g,
      title: genTitle(g),
      romanNumeral: romanNumeral(g),
      members
    });
  }

  // ── STEP 4: NAME INDEX ──
  const nameIndex = people
    .map(p => ({
      name: p.displayName,
      generation: generations.get(p.handle) ?? 0,
      isPatrilineal: p.isPatrilineal
    }))
    .sort((a,b) => a.name.localeCompare(b.name,'vi'));

  return {
    familyName,
    exportDate: new Date().toLocaleDateString('vi-VN',{
      year:'numeric', month:'long', day:'numeric'
    }),
    totalGenerations: maxGen + 1,
    totalMembers: people.length,
    totalPatrilineal: people.filter(p => p.isPatrilineal).length,
    chapters,
    nameIndex
  };
}