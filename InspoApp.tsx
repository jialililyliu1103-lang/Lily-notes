"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  formatNoteForEdit,
  isExcerptStyle,
  loadNotes,
  matchesSearch,
  parseNoteInput,
  saveNotes,
  type Note,
} from "@/lib/notes";

const ALL_TAG = "全部";
const LONG_PRESS_MS = 480;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function InspoApp() {
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>(ALL_TAG);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [inputExpanded, setInputExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sheetNote, setSheetNote] = useState<Note | null>(null);
  const [editing, setEditing] = useState<Note | null>(null);
  const [editText, setEditText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const storageReady = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      const data = loadNotes();
      storageReady.current = true;
      setNotes(data);
      setMounted(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, []);

  useEffect(() => {
    if (!storageReady.current) return;
    saveNotes(notes);
  }, [notes]);

  // --- 新增：处理文本格式化的逻辑 ---
  const handleFormat = (type: 'bold' | 'highlight', isEditMode: boolean = false) => {
    const targetRef = isEditMode ? null : areaRef.current;
    // 如果是编辑模式，我们需要稍微复杂的逻辑处理 textarea，这里简单处理主输入框
    const textarea = targetRef || (document.activeElement as HTMLTextAreaElement);
    if (!textarea || (textarea.tagName !== 'TEXTAREA')) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let before = text.substring(0, start);
    let after = text.substring(end);
    let replacement = "";

    if (type === 'bold') {
      replacement = `**${selectedText || "加粗文字"}**`;
    } else {
      replacement = `==${selectedText || "标注文字"}==`;
    }

    if (isEditMode) {
      setEditText(before + replacement + after);
    } else {
      setDraft(before + replacement + after);
    }
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + 2 + (selectedText.length || 4));
    }, 10);
  };

  // --- 新增：智能解析文本显示（支持加粗和高亮） ---
  const renderFormattedText = (content: string) => {
    // 先处理高亮 ==text== -> <mark>
    // 再处理加粗 **text** -> <strong>
    const parts = content.split(/(==.*?==|\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('==') && part.endsWith('==')) {
        return <mark key={i} className="bg-yellow-200 px-0.5 rounded text-ink">{part.slice(2, -2)}</mark>;
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-ink">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const tags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => set.add(n.tag));
    return [ALL_TAG, ...Array.from(set).sort((a, b) => a.localeCompare(b, "zh"))];
  }, [notes]);

  const normalizedSearch = searchQuery.trim();
  const isSearching = normalizedSearch.length > 0;

  const filtered = useMemo(() => {
    if (isSearching) return notes.filter((n) => matchesSearch(n, normalizedSearch));
    if (selectedTag === ALL_TAG) return notes;
    return notes.filter((n) => n.tag === selectedTag);
  }, [isSearching, normalizedSearch, notes, selectedTag]);

  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => b.createdAt - a.createdAt),
    [filtered],
  );

  const listKey = useMemo(() => {
    return isSearching ? `search:${normalizedSearch}` : `tag:${selectedTag}`;
  }, [isSearching, normalizedSearch, selectedTag]);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const { tag, body } = parseNoteInput(draft);
      if (!body) return;
      const note: Note = {
        id: newId(),
        tag,
        body,
        createdAt: Date.now(),
      };
      setNotes((prev) => [note, ...prev]);
      setDraft("");
      setInputExpanded(false);
      areaRef.current?.blur();
    },
    [draft],
  );

  const openSheet = useCallback((n: Note) => {
    setSheetNote(n);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const onPointerDownCard = useCallback(
    (n: Note) => {
      clearLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        openSheet(n);
      }, LONG_PRESS_MS);
    },
    [clearLongPress, openSheet],
  );

  const onPointerUpCard = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setSheetNote(null);
    setEditing(null);
  }, []);

  const startEdit = useCallback((n: Note) => {
    setSheetNote(null);
    setEditing(n);
    setEditText(formatNoteForEdit(n));
  }, []);

  const saveEdit = useCallback(() => {
    if (!editing) return;
    const { tag, body } = parseNoteInput(editText);
    if (!body) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === editing.id ? { ...n, tag, body, createdAt: n.createdAt } : n,
      ),
    );
    setEditing(null);
    setEditText("");
  }, [editing, editText]);

  const toggleReadMore = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col">
        <div className="h-14 border-b border-ink/8 bg-paper/95" />
        <div className="flex-1 p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-ink/5 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/95 backdrop-blur-md pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="px-3 pt-1 pb-2">
          <div className="rounded-2xl border border-ink/12 bg-paper/70 backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-ink/35">
                <path d="M10.5 18C14.6421 18 18 14.6421 18 10.5C18 6.35786 14.6421 3 10.5 3C6.35786 3 3 6.35786 3 10.5C3 14.6421 6.35786 18 10.5 18Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                id="search"
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedTag !== ALL_TAG) setSelectedTag(ALL_TAG);
                }}
                onFocus={() => {
                  setInputExpanded(false);
                  areaRef.current?.blur();
                }}
                placeholder="搜索正文或 #标签…"
                inputMode="search"
                autoComplete="off"
                className="w-full bg-transparent text-[16px] leading-relaxed text-ink placeholder:text-ink/35 outline-none"
              />
              {normalizedSearch ? (
                <button type="button" onClick={() => { setSearchQuery(""); setSelectedTag(ALL_TAG); searchInputRef.current?.focus(); }} className="shrink-0 rounded-full px-2.5 py-1 text-[12px] text-ink/55 active:bg-ink/5">清除</button>
              ) : null}
            </div>
          </div>
          {isSearching ? <div className="pt-1 pl-1 text-[11px] text-ink/40">找到 {sortedFiltered.length} 条相关感悟</div> : null}
        </div>

        <form ref={formRef} onSubmit={submit} className="px-3 pb-2 pt-0">
          <div className={`rounded-2xl border border-ink/12 bg-white/80 shadow-sm transition-shadow focus-within:border-ink/25 focus-within:shadow-md ${inputExpanded ? "ring-1 ring-ink/10" : ""}`}>
            {/* 格式化工具栏 */}
            {inputExpanded && (
              <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-b border-ink/5">
                <button type="button" onClick={() => handleFormat('bold')} className="w-8 h-8 rounded-lg border border-ink/10 bg-white flex items-center justify-center font-bold text-sm active:bg-ink/5 shadow-sm">B</button>
                <button type="button" onClick={() => handleFormat('highlight')} className="px-2 h-8 rounded-lg border border-ink/10 bg-yellow-50 flex items-center justify-center text-[11px] active:bg-yellow-100 shadow-sm">✨ 标注</button>
              </div>
            )}
            
            <textarea
              ref={areaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setInputExpanded(true)}
              onBlur={() => { if (!draft.trim()) setInputExpanded(false); }}
              placeholder="以 #标签 开头，例如：#感悟 人生如逆旅…"
              rows={inputExpanded ? 5 : 2}
              className="w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink/40 outline-none"
            />
            <div className="flex items-center justify-end gap-2 border-t border-ink/8 px-2 py-1.5">
              <span className="mr-auto text-[11px] text-ink/45 pl-1">支持加粗与标注</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setInputExpanded((v) => !v)} className="rounded-full px-2.5 py-1 text-xs text-ink/55 active:bg-ink/5">
                {inputExpanded ? "收起" : "展开"}
              </button>
              <button type="submit" disabled={!parseNoteInput(draft).body} className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-paper disabled:opacity-35 active:opacity-90">记录</button>
            </div>
          </div>
        </form>

        <nav className="flex gap-2 overflow-x-auto px-3 pb-2.5 scrollbar-none" aria-label="分类标签">
          {tags.map((t) => {
            const active = t === selectedTag;
            return (
              <button key={t} type="button" onClick={() => { if (t === ALL_TAG) { setSelectedTag(ALL_TAG); setSearchQuery(""); } else { setSelectedTag(t); setSearchQuery(`#${t}`); } }} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${active ? "bg-ink text-paper" : "bg-ink/6 text-ink/80 active:bg-ink/12"}`}>
                {t === ALL_TAG ? t : `#${t}`}
              </button>
            );
          })}
        </nav>
      </header>

      <LayoutGroup id="notes">
        <motion.main key={selectedTag} layout initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} className="flex-1 px-3 pt-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {sortedFiltered.length === 0 ? (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16 text-center text-[14px] text-ink/45">
                {isSearching ? "没有找到匹配结果" : selectedTag === ALL_TAG ? "写下第一条灵感吧" : `「${selectedTag}」下还没有内容`}
              </motion.p>
            ) : (
              <motion.ul key={listKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: "easeOut" }} className="flex flex-col gap-3 pb-28">
                {sortedFiltered.map((n) => {
                  const long = isExcerptStyle(n.body);
                  const expanded = expandedIds.has(n.id);
                  return (
                    <motion.li key={n.id} layout initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 420, damping: 28 }}>
                      <article
                        role="button" tabIndex={0}
                        onPointerDown={() => onPointerDownCard(n)}
                        onPointerUp={onPointerUpCard}
                        onPointerLeave={onPointerUpCard}
                        onPointerCancel={onPointerUpCard}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openSheet(n); }}
                        className="select-none rounded-2xl border border-ink/10 bg-white/90 px-3.5 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] active:bg-white"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">#{n.tag}</span>
                          <span className="text-[10px] text-ink/35">{new Date(n.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className={`whitespace-pre-wrap leading-[1.65] text-ink/92 ${long && !expanded ? "line-clamp-3 text-[15px]" : n.body.length < 30 ? "text-[17px] font-medium tracking-wide" : "text-[15px]"}`}>
                          {renderFormattedText(n.body)}
                        </div>
                        {long && (
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleReadMore(n.id); }} className="mt-2 text-[13px] text-ink/55 underline decoration-ink/25 underline-offset-2">
                            {expanded ? "收起" : "阅读更多"}
                          </button>
                        )}
                      </article>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.main>
      </LayoutGroup>

      {/* 编辑弹窗 */}
      <AnimatePresence>
        {editing ? (
          <motion.div key="edit" className="fixed inset-0 z-50 flex flex-col bg-paper p-4 pt-[max(env(safe-area-inset-top),1rem)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-3 flex items-center justify-between">
              <button type="button" className="text-[15px] text-ink/55" onClick={() => { setEditing(null); setEditText(""); }}>取消</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleFormat('bold', true)} className="w-8 h-8 rounded border border-ink/10 flex items-center justify-center font-bold">B</button>
                <button type="button" onClick={() => handleFormat('highlight', true)} className="px-2 h-8 rounded border border-ink/10 bg-yellow-50 flex items-center justify-center text-xs">✨ 标注</button>
              </div>
              <button type="button" className="text-[15px] font-semibold text-ink" onClick={saveEdit} disabled={!parseNoteInput(editText).body}>保存</button>
            </div>
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[50vh] flex-1 w-full resize-none rounded-2xl border border-ink/12 bg-white/80 p-3 text-[15px] leading-relaxed text-ink outline-none" autoFocus />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 底部菜单 */}
      <AnimatePresence>
        {sheetNote ? (
          <motion.div key="sheet" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheetNote(null)}>
            <motion.div initial={{ y: 48, opacity: 0.9 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-2xl bg-paper px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 shadow-2xl border-t border-ink/10">
              <p className="mb-3 text-center text-[12px] text-ink/45">#{sheetNote.tag}</p>
              <div className="flex flex-col gap-2">
                <button type="button" className="rounded-xl bg-ink/6 py-3 text-[15px] font-medium active:bg-ink/12" onClick={() => startEdit(sheetNote)}>编辑</button>
                <button type="button" className="rounded-xl bg-red-500/10 py-3 text-[15px] font-medium text-red-700 active:bg-red-500/15" onClick={() => deleteNote(sheetNote.id)}>删除</button>
                <button type="button" className="rounded-xl py-3 text-[15px] text-ink/55" onClick={() => setSheetNote(null)}>取消</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
