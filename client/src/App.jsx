import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Loader2, Trash2, Copy, CheckCheck, RefreshCw, AlertCircle, ImagePlus, X, Camera, Bell, ListTodo } from 'lucide-react';
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
  
  // Image states
  const [images, setImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Reminder states
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showReminderListModal, setShowReminderListModal] = useState(false);
  const [remindersList, setRemindersList] = useState([]);
  const [reminderText, setReminderText] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastSavedContentRef = useRef('');

  // Initial load from SQLite database
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Note
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
        
        // Fetch Images
        const imgRes = await fetch(`${API_BASE}/images`);
        const imgJson = await imgRes.json();
        if (imgJson.success && imgJson.data) {
          setImages(imgJson.data);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setSaveStatus('error');
      } finally {
        setInitialLoading(false);
      }
    }

    fetchData();
  }, []);

  // Service Worker and Web Push
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('Service Worker Registered!');
      }).catch(err => console.error('SW registration failed', err));

      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SPEAK') {
          const utterance = new SpeechSynthesisUtterance(event.data.text);
          utterance.lang = 'th-TH';
          // Add a gentle beep before speaking (optional, using Web Audio API or just speech)
          const beep = new SpeechSynthesisUtterance('แจ้งเตือน,');
          beep.lang = 'th-TH';
          window.speechSynthesis.speak(beep);
          window.speechSynthesis.speak(utterance);
        }
      });
    }
  }, []);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  };

  const handleSetReminder = async () => {
    if (!reminderText || !reminderTime) return alert('กรุณากรอกข้อความและเวลา');
    
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return alert('กรุณาอนุญาตการแจ้งเตือนเพื่อใช้งานฟีเจอร์นี้นะครับ');
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      
      if (!subscription) {
        const response = await fetch(`${API_BASE}/vapidPublicKey`);
        const { publicKey } = await response.json();
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        await fetch(`${API_BASE}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
      }

      const [hours, minutes] = reminderTime.split(':');
      const triggerDate = new Date();
      triggerDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      
      if (triggerDate < new Date()) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }

      await fetch(`${API_BASE}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reminderText, triggerTime: triggerDate.toISOString() })
      });

      alert(`ตั้งปลุกสำเร็จ! จะแจ้งเตือนคุณเวลา ${reminderTime} น.`);
      setShowReminderModal(false);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการตั้งปลุก');
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await fetch(`${API_BASE}/reminders`);
      const json = await res.json();
      if (json.success) setRemindersList(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showReminderListModal) {
      fetchReminders();
    }
  }, [showReminderListModal]);

  const handleDeleteReminder = async (id) => {
    if (!confirm('คุณต้องการลบการตั้งปลุกนี้ใช่หรือไม่?')) return;
    try {
      await fetch(`${API_BASE}/reminders/${id}`, { method: 'DELETE' });
      setRemindersList(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถลบการตั้งปลุกได้');
    }
  };

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

    socket.on('images_updated', async () => {
      try {
        const imgRes = await fetch(`${API_BASE}/images`);
        const imgJson = await imgRes.json();
        if (imgJson.success && imgJson.data) {
          setImages(imgJson.data);
        }
      } catch (err) {
        console.error('Failed to sync images:', err);
      }
    });

    return () => {
      socket.off('note_update');
      socket.off('images_updated');
    };
  }, []);

  const handleImageUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้นครับ');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = async () => {
          // บีบอัดรูปภาพ (ลดขนาด) โดยให้กว้างสูงสุด 1200px
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // แปลงเป็น JPEG แบบบีบอัด (คุณภาพ 75%)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
          
          // Generate random ID
          const id = Math.random().toString(36).substring(2, 15);
          
          try {
            const res = await fetch(`${API_BASE}/images`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, data: compressedBase64 })
            });
            const json = await res.json();
            if (json.success) {
              const imgRes = await fetch(`${API_BASE}/images`);
              const imgJson = await imgRes.json();
              if (imgJson.success && imgJson.data) {
                setImages(imgJson.data);
              }
            } else {
              alert('อัปโหลดรูปภาพไม่สำเร็จ');
            }
          } catch (e) {
            console.error('Upload API Error:', e);
            alert('เกิดข้อผิดพลาดในการส่งรูปลงฐานข้อมูล');
          } finally {
            setIsUploading(false);
          }
        };
        img.onerror = () => {
          alert('ไฟล์รูปภาพอาจเสียหาย');
          setIsUploading(false);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image processing error:', err);
      setIsUploading(false);
      alert('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    }
  };

  const handleDeleteImage = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/images/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setImages(prev => prev.filter(img => img.id !== id));
      }
    } catch (err) {
      console.error('Image delete error:', err);
      alert('ลบรูปภาพไม่สำเร็จ');
    }
  };

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

  // Handle native zoom via viewport meta tag for Lightbox
  useEffect(() => {
    let metaViewport = document.querySelector('meta[name=viewport]');
    if (!metaViewport) {
      metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      document.head.appendChild(metaViewport);
    }
    
    if (selectedImage) {
      // Allow zoom when lightbox is open
      metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover';
    } else {
      // Disallow zoom normally
      metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }
  }, [selectedImage]);

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
          className={`flex-1 flex flex-col relative bg-white cursor-text transition-colors ${isDragging ? 'bg-blue-50/50 ring-inset ring-4 ring-blue-400' : ''}`}
          onClick={(e) => {
            // Only focus if clicked directly on main area, not on images or buttons
            if (e.target.tagName === 'MAIN' && textareaRef.current) {
              textareaRef.current.focus();
            }
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleImageUpload(file);
          }}
        >
          {isUploading && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-100 overflow-hidden z-10">
              <div className="w-1/3 h-full bg-blue-500 animate-[bounce_1s_infinite_linear]"></div>
            </div>
          )}

          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="w-full flex gap-3 overflow-x-auto p-4 sm:p-6 pb-0 scrollbar-hide">
              {images.map(img => (
                <div key={img.id} className="relative group shrink-0">
                  <img 
                    src={img.data} 
                    alt="note attachment" 
                    className="h-32 w-auto object-cover rounded border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(img);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            autoFocus
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              const file = e.clipboardData?.files[0];
              if (file) {
                e.preventDefault();
                handleImageUpload(file);
              }
            }}
            className="flex-1 min-h-0 w-full p-4 sm:p-6 text-lg sm:text-xl leading-relaxed text-gray-900 bg-transparent resize-none border-none outline-none focus:ring-0 font-sans"
            spellCheck={false}
            disabled={initialLoading}
          />
        </main>

        {/* Bottom Bar: Action bar */}
        <footer className="border-t border-gray-200 px-3 sm:px-4 py-2 sm:py-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-between text-xs sm:text-sm text-gray-500 bg-gray-50 select-none shrink-0 z-10">
          
          {/* Left side: Upload & Camera Buttons */}
          <div className="flex items-center gap-3">
              {/* Upload Image Button */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleImageUpload(file);
                  e.target.value = ''; // reset
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 text-gray-700 transition-colors shadow-sm"
                title="อัปโหลดรูปภาพ"
              >
                <ImagePlus className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                <span className="font-medium text-sm sm:text-base text-gray-800">แทรกรูป</span>
              </button>

              {/* Camera Button */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={cameraInputRef}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleImageUpload(file);
                  e.target.value = ''; // reset
                }}
              />
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 text-gray-700 transition-colors shadow-sm"
                title="ถ่ายรูป"
              >
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                <span className="font-medium text-sm sm:text-base text-gray-800">ถ่ายรูป</span>
              </button>

              {/* Alarm Button */}
              <button
                onClick={() => {
                  let text = '';
                  if (window.getSelection) {
                    text = window.getSelection().toString().trim();
                  }
                  if (!text && textareaRef.current) {
                    text = textareaRef.current.value.substring(
                      textareaRef.current.selectionStart, 
                      textareaRef.current.selectionEnd
                    ).trim();
                  }
                  setReminderText(text || content.substring(0, 50)); // Default to first 50 chars if no selection
                  
                  // Default time to next hour
                  const d = new Date();
                  d.setHours(d.getHours() + 1);
                  d.setMinutes(0);
                  setReminderTime(d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
                  
                  setShowReminderModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 text-gray-700 transition-colors shadow-sm ml-auto"
                title="ตั้งปลุก"
              >
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                <span className="font-medium text-sm sm:text-base text-gray-800 hidden sm:inline">ตั้งปลุก</span>
              </button>

              {/* Alarm List Button */}
              <button
                onClick={() => setShowReminderListModal(true)}
                className="flex items-center justify-center p-1.5 sm:p-2 rounded-lg bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 text-gray-700 transition-colors shadow-sm"
                title="รายการตั้งปลุก"
              >
                <ListTodo className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              </button>
            </div>

            {/* Right side: Save indicator (Mobile only) */}
            <div className="flex items-center gap-3 sm:hidden">
              <div className="text-xs">
                {saveStatus === 'typing' && <span className="text-amber-600 font-medium">กำลังพิมพ์...</span>}
                {saveStatus === 'saving' && <span className="text-blue-600 font-medium">กำลังบันทึก...</span>}
                {saveStatus === 'saved' && <span className="text-emerald-600 font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> บันทึกแล้ว</span>}
                {saveStatus === 'error' && <span className="text-red-600 font-medium">ผิดพลาด</span>}
              </div>
            </div>
          </footer>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white p-2 z-[110] bg-black/50 hover:bg-black/70 rounded-full transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            <X className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
          
          <img 
            src={selectedImage.data} 
            alt="enlarged attachment" 
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <button 
            className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white p-3 sm:p-4 z-[110] bg-red-600/80 hover:bg-red-600 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรูปภาพนี้?')) {
                handleDeleteImage(selectedImage.id);
                setSelectedImage(null);
              }
            }}
            title="ลบรูปภาพ"
          >
            <Trash2 className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 max-w-sm w-full rounded-sm">
            <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              ตั้งเวลาปลุกเตือนความจำ
            </h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">ข้อความที่จะให้แจ้งเตือน</label>
              <textarea 
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                className="w-full border-2 border-gray-300 rounded p-2 text-gray-900 focus:border-black focus:ring-0 outline-none resize-none"
                rows="2"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลา (ชม:นาที)</label>
              <input 
                type="time" 
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full border-2 border-gray-300 rounded p-2 text-gray-900 focus:border-black focus:ring-0 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReminderModal(false)}
                className="px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 border-2 border-transparent rounded cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSetReminder}
                className="px-5 py-2 font-bold text-white bg-black hover:bg-neutral-800 active:bg-neutral-900 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> บันทึกเวลา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder List Modal */}
      {showReminderListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 max-w-sm w-full rounded-sm max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2 shrink-0">
              <ListTodo className="w-5 h-5 text-gray-800" />
              รายการตั้งปลุก
            </h2>
            
            <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2 scrollbar-hide">
              {remindersList.length === 0 ? (
                <p className="text-gray-500 text-center py-8">ไม่มีการตั้งปลุกล่วงหน้า</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {remindersList.map(r => {
                    const time = new Date(r.trigger_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={r.id} className="border border-gray-200 rounded p-3 flex justify-between items-start shadow-sm bg-gray-50">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="font-bold text-amber-600 mb-1">{time} น.</div>
                          <div className="text-gray-800 text-sm truncate">{r.text}</div>
                        </div>
                        <button 
                          onClick={() => handleDeleteReminder(r.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded shrink-0 transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-2 border-t shrink-0">
              <button
                onClick={() => setShowReminderListModal(false)}
                className="px-5 py-2 font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border-2 border-gray-300 rounded cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

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
