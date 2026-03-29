export const STORAGE_KEY = "inspo-notes-v1";

export type Note = {
  id: string;
  tag: string;
  body: string;
  createdAt: number;
};

export function parseNoteInput(raw: string): { tag: string; body: string } {
  const t = raw.trim();
  if (!t) return { tag: "随记", body: "" };
  const m = t.match(/^#([^\s#]+)\s*([\s\S]*)$/);
  if (m) {
    const tag = m[1];
    const body = m[2].trim();
    return { tag, body };
  }
  return { tag: "随记", body: t };
}

export function formatNoteForEdit(note: Note): string {
  if (note.tag === "随记") return note.body;
  return `#${note.tag} ${note.body}`;
}

export function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function isExcerptStyle(body: string): boolean {
  const lines = body.split(/\r?\n/).filter((l) => l.length > 0);
  if (body.length > 96) return true;
  if (lines.length >= 4) return true;
  if (body.length > 64 && lines.length >= 2) return true;
  return false;
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function matchesSearch(note: Note, queryRaw: string): boolean {
  const query = queryRaw.trim();
  if (!query) return true;

  const q = normalizeQuery(query);
  const noteBody = note.body.toLowerCase();
  const noteTag = note.tag.toLowerCase();

  // 允许多关键词：空格分隔，token 之间为 AND（更像“逐步缩小筛选”）
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => {
    const isHashtag = token.startsWith("#");
    if (isHashtag) {
      const term = token.slice(1).trim();
      if (!term) return false;
      // 对 "#标签"：只按标签字段精确匹配（避免混入“正文里碰巧出现该词”的条目）
      return noteTag === term;
    }
    // 对普通关键词：同时匹配正文/标签
    return noteBody.includes(token) || noteTag.includes(token);
  });
}
