/**
 * Book Generator — Uses generation from DB directly (no recalculation)
 */

import type { TreeNode, TreeFamily } from './tree-layout';

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

// helpers
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

function romanNumeral(n: number) {
  return ROMAN[n] || `${n+1}`;
}

function genTitle(gen: number) {
  return gen === 1
    ? `ĐỜI THỨ I — THỦY TỔ`
    : `ĐỜI THỨ ${romanNumeral(gen)}`;
}

function formatYears(b?: number, d?: number, living?: boolean) {
  if (!b) return '—';
  if (d) return `${b} – ${d}`;
  if (living) return `${b} – nay`;
  return `${b}`;
}

// MAIN
export function generateBookData(
  people: TreeNode[],
  families: TreeFamily[],
  familyName = 'Lê'
): BookData {

  const personMap = new Map(people.map(p => [p.handle, p]));
  const familyMap = new Map(f => families.map(f => [f.handle, f]));

  const bookPersons: BookPerson[] = [];

  for (const p of people) {
    if (!p.isPatrilineal) continue;

    // parents
    let fatherName, motherName;

    for (const pfId of p.parentFamilies) {
      const fam = familyMap.get(pfId);
      if (!fam) continue;

      if (fam.fatherHandle) {
        const f = personMap.get(fam.fatherHandle);
        if (f) fatherName = f.displayName;
      }
      if (fam.motherHandle) {
        const m = personMap.get(fam.motherHandle);
        if (m) motherName = m.displayName;
      }
    }

    // spouse + children
    let spouseName, spouseYears, spouseNote;
    const children: BookPerson['children'] = [];

    for (const famId of p.families) {
      const fam = familyMap.get(famId);
      if (!fam) continue;

      const spouseHandle =
        fam.fatherHandle === p.handle
          ? fam.motherHandle
          : fam.fatherHandle;

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
    let childIndex;
    if (p.parentFamilies.length > 0) {
      const fam = familyMap.get(p.parentFamilies[0]);
      if (fam) {
        const idx = fam.children.indexOf(p.handle);
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
      generation: p.generation,
      fatherName,
      motherName,
      spouseName,
      spouseYears,
      spouseNote,
      children,
      childIndex
    });
  }

  // chapters by generation
  const gens = [...new Set(bookPersons.map(p => p.generation))].sort((a,b)=>a-b);
  const chapters: BookChapter[] = gens.map(g => ({
    generation: g,
    title: genTitle(g),
    romanNumeral: romanNumeral(g),
    members: bookPersons
      .filter(p => p.generation === g)
      .sort((a,b)=>(a.childIndex ?? 99)-(b.childIndex ?? 99))
  }));

  return {
    familyName,
    exportDate: new Date().toLocaleDateString('vi-VN'),
    totalGenerations: gens.length,
    totalMembers: people.length,
    totalPatrilineal: people.filter(p=>p.isPatrilineal).length,
    chapters,
    nameIndex: people.map(p=>({
      name: p.displayName,
      generation: p.generation,
      isPatrilineal: p.isPatrilineal
    }))
  };
}