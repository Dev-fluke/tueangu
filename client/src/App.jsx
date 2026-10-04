import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Loader2, Trash2, Copy, CheckCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';

const API_BASE = '/api';
const socket = io(); // Connects to the same origin

export default function App() {
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'typing' | 'saving' | 'saved' | 'error'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const textareaRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastSavedContentRef = useRef('');

  // Initial load from SQLite database
  useEffect(() => {
    async function fetchNote() {
      try {
        const res = await fetch(`${API_BASE}/note`);
        const json = await res.json();
        if (json.success && json.data) {
          const loadedText = json.data.content || '';
          setContent(loadedText);
          lastSavedContentRef.current = loadedText;
          if (json.data.updated_at) {
            setLastSavedTime(new Date(json.data.updated_at));
          }
        }
      } catch (err) {
        console.error('Failed to load note:', err);
        setSaveStatus('error');
      } finally {
        setInitialLoading(false);
      }
    }

    fetchNote();
  }, []);

  // Listen for real-time updates from other users
  useEffect(() => {
    socket.on('note_update', (newText) => {
      setContent(newText);
      lastSavedContentRef.current = newText;

      // Show notification badge if the app is not in focus
      if (document.visibilityState === 'hidden') {
        document.title = '(🔴) มีข้อความใหม่ - ช่วยเตือนกู';
        
        // Use PWA Badging API if supported (shows red dot on app icon)
        if ('setAppBadge' in navigator) {
          navigator.setAppBadge(1).catch(console.error);
        }
      }
    });

    return () => {
      socket.off('note_update');
    };
  }, []);

  // Clear badge when user comes back to the app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        document.title = 'ช่วยเตือนกู';
        if ('clearAppBadge' in navigator) {
          navigator.clearAppBadge().catch(console.error);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Auto-focus the cursor in the body immediately on mount & after loading
  useEffect(() => {
    if (!initialLoading && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at the end of the text
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [initialLoading]);

  // Save function to API
  const performSave = useCallback(async (textToSave) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textToSave })
      });
      const data = await res.json();
      if (data.success) {
        lastSavedContentRef.current = textToSave;
        setSaveStatus('saved');
        setLastSavedTime(new Date());
      } else {
        const errorMsg = data.error || data.message;
        console.error('Save failed from server:', errorMsg);
        setSaveStatus('error');
        alert('บันทึกไม่สำเร็จ: ' + (typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg));
      }
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveStatus('error');
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  }, []);

  // Handle typing with Debounced Auto-save
  const handleChange = (e) => {
    const newText = e.target.value;
    setContent(newText);
    setSaveStatus('typing');

    // Broadcast real-time change instantly to others
    socket.emit('note_update', newText);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Auto-save after 700ms of inactivity
    debounceTimerRef.current = setTimeout(() => {
      performSave(newText);
    }, 700);
  };

  // Immediate save on blur or shortcut (Ctrl+S)
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      performSave(content);
    }
  };

  // Clear note handler
  const handleClear = async () => {
    try {
      setSaveStatus('saving');
      const res = await fetch(`${API_BASE}/note/clear`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setContent('');
        lastSavedContentRef.current = '';
        setSaveStatus('saved');
        setLastSavedTime(new Date());
        setShowClearConfirm(false);
        socket.emit('note_update', '');
        
        // Refocus textarea with cursor ready
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 50);
      } else {
        console.error('Clear failed from server:', data.error || data.message);
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Clear error:', err);
      setSaveStatus('error');
    }
  };

  // Copy content to clipboard
  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Format time for Thai display
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="w-full h-[100dvh] min-h-[100dvh] bg-white flex flex-col font-sans overflow-hidden select-none">
      {/* App Container - Full Screen Edge-to-Edge */}
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">

        {/* Header matching exact layout of sketch */}
        <header className="flex items-stretch border-b-2 sm:border-b-[3px] border-black bg-white shrink-0 min-h-[52px] sm:min-h-[60px] pt-[env(safe-area-inset-top)]">
          {/* Main Title Section */}
          <div className="flex-1 flex items-center justify-center px-4 py-2 relative">
            <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-black text-center">
              ช่วยเตือนกู
            </h1>

            {/* Subtle save status indicator inside header or corner */}
            <div className="absolute right-4 hidden sm:flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              {saveStatus === 'typing' && (
                <span className="flex items-center gap-1 text-amber-600 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  กำลังพิมพ์...
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  กำลังบันทึก...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  บันทึกแล้ว {lastSavedTime ? `(${formatTime(lastSavedTime)})` : ''}
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  บันทึกล้มเหลว
                </span>
              )}
            </div>
          </div>

          {/* Right Header Box: ล้าง Button with solid dividing border */}
          <div className="border-l-2 sm:border-l-[3px] border-black flex items-stretch">
            <button
              onClick={() => {
                if (content.trim().length > 0) {
                  setShowClearConfirm(true);
                } else {
                  handleClear();
                }
              }}
              title="ล้างข้อความทั้งหมด"
              className="px-6 sm:px-8 py-2 bg-white hover:bg-red-50/40 active:bg-red-50 text-red-400 hover:text-red-500 font-semibold text-lg sm:text-xl flex items-center justify-center transition-colors cursor-pointer group"
            >
              <span className="group-hover:scale-105 transition-transform flex items-center gap-1.5">
                ล้าง
              </span>
            </button>
          </div>
        </header>

        {/* Note Body Area with immediate cursor */}
        <main
          className="flex-1 flex flex-col relative bg-white cursor-text"
          onClick={() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
          }}
        >
          <textarea
            ref={textareaRef}
            autoFocus
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="w-full h-full p-4 sm:p-6 text-lg sm:text-xl leading-relaxed text-gray-900 bg-transparent resize-none border-none outline-none focus:ring-0 font-sans"
            spellCheck={false}
            disabled={initialLoading}
          />

          {/* Bottom Bar: Action bar & Stats */}
          <footer className="border-t border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-between text-xs sm:text-sm text-gray-500 bg-gray-50 select-none shrink-0">
            {/* Left stats: Characters, words, lines */}
            <div className="flex items-center gap-3">
              <span>{content.length.toLocaleString('th-TH')} ตัวอักษร</span>
              <span className="text-gray-300">|</span>
              <span>
                {content.trim() ? content.trim().split(/\s+/).length : 0} คำ
              </span>
              <span className="text-gray-300">|</span>
              <span>
                {content ? content.split('\n').length : 0} บรรทัด
              </span>
            </div>

            {/* Mobile save indicator & Copy button */}
            <div className="flex items-center gap-3">
              {/* Mobile-only status */}
              <div className="sm:hidden text-xs">
                {saveStatus === 'typing' && <span className="text-amber-600 font-medium">กำลังพิมพ์...</span>}
                {saveStatus === 'saving' && <span className="text-blue-600 font-medium">กำลังบันทึก...</span>}
                {saveStatus === 'saved' && <span className="text-emerald-600 font-medium">บันทึกแล้ว</span>}
                {saveStatus === 'error' && <span className="text-red-600 font-medium">ผิดพลาด</span>}
              </div>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                disabled={!content}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition-colors"
                title="คัดลอกข้อความทั้งหมด"
              >
                {copied ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">คัดลอกแล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอก</span>
                  </>
                )}
              </button>
            </div>
          </footer>
        </main>
      </div>

      {/* Confirmation Modal when clicking "ล้าง" with text */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 max-w-sm w-full rounded-sm">
            <h2 className="text-xl font-bold text-black mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              ยืนยันการล้างข้อความ?
            </h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              ข้อความทั้งหมดในหน้านี้จะถูกลบและบันทึกลงฐานข้อมูล คุณแน่ใจหรือไม่ว่าต้องการล้างทั้งหมด?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 border-2 border-transparent rounded cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleClear}
                className="px-5 py-2 font-bold text-white bg-black hover:bg-neutral-800 active:bg-neutral-900 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded cursor-pointer"
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
