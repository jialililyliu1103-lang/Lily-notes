"use client";

import React, { useState } from 'react';

export default function Home() {
  const [notes, setNotes] = useState<{ id: number; content: string }[]>([]);
  const [newNote, setNewNote] = useState("");

  // 核心功能：点击按钮，给选中的文字加粗
  const insertBold = () => {
    const textarea = document.getElementById('note-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    // 如果没选中字，就插入“加粗文字”四个字
    const formattedText = `**${selectedText || '加粗文字'}**`;

    const newValue = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
    setNewNote(newValue);
    
    // 让输入框重新获得焦点
    setTimeout(() => textarea.focus(), 10);
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes([{ id: Date.now(), content: newNote }, ...notes]);
    setNewNote("");
  };

  return (
    <div className="max-w-md mx-auto p-4 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-6 text-pink-500">Lily's Notes ✨</h1>
      
      {/* 加粗按钮栏 */}
      <div className="mb-2">
        <button 
          onClick={insertBold}
          className="px-4 py-1 bg-white border border-gray-300 rounded shadow-sm font-bold hover:bg-gray-100 text-gray-700"
        >
          B (加粗)
        </button>
      </div>

      <textarea
        id="note-input"
        className="w-full h-32 p-3 border rounded-xl mb-4 shadow-inner outline-none text-gray-700"
        placeholder="输入内容，选中文字点上面的 B..."
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
      />
      
      <button 
        onClick={addNote}
        className="w-full bg-pink-400 text-white py-3 rounded-xl font-bold hover:bg-pink-500 mb-8"
      >
        保存笔记
      </button>

      <div className="space-y-4">
        {notes.map(note => (
          <div key={note.id} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            {/* 这里显示笔记，由于我们要支持加粗显示，简单起见我们先看原始代码 */}
            <p className="whitespace-pre-wrap text-gray-700">
              {note.content.split('**').map((part, i) => 
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
