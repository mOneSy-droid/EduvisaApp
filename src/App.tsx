import React, { useState, useEffect, useRef } from 'react';
import AdminPanel from './components/AdminPanel';
import logoImg from './assets/images/eduvisa_logo_1782826587445.jpg';
import { 
  Home, 
  GraduationCap, 
  Bot, 
  FileText, 
  User, 
  Send, 
  Upload, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Camera, 
  Sparkles, 
  Phone, 
  DollarSign, 
  Award, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  LogOut,
  Bell,
  Menu,
  X,
  FileDown,
  RefreshCw,
  Bookmark
} from 'lucide-react';

// Design Token Colors
// Navy: #0B1C2C
// Gold: #D6B174
// Gold Hover: #B99056
// Soft BG: #F7F9FA
// Border: #E5E8EB
// Primary Text: #212630
// Muted Text: #6A727D

interface University {
  id: string;
  name: string;
  country: string;
  logo: string;
  budget: number;
  ielts: number;
  gpa: number;
  grantInfo: string;
  programs: string[];
  description: string;
}

interface Application {
  id: string;
  universityId: string;
  universityName: string;
  universityCountry?: string;
  program: string;
  status: '🟡 Ko\'rib chiqilyapti' | '🟢 Tasdiqlangan / Qabul qilingan' | '🔴 Rad etilgan';
  date: string;
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  contactEmail?: string;
  contactPhone?: string;
  history: { status: string; date: string; note: string }[];
  documents: { name: string; type: string; status: string; url?: string }[];
}

interface UserProfile {
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  budget: number | null;
  ielts_score: number | null;
  has_ielts: boolean | null;
  gpa: number | null;
  has_gpa: boolean | null;
  onboarding_completed: boolean;
  avatarUrl?: string;
  telegram_chat_id?: string;
  last_login_ip?: string;
  role?: 'student' | 'admin';
}

interface ChatMessage {
  role: 'user' | 'model';
  message: string;
  timestamp: string;
}

export default function App() {
  // Session State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('eduvisa_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'home' | 'universities' | 'ai' | 'applications' | 'profile'>('home');
  const [onboardingStep, setOnboardingStep] = useState<number>(0); // Chat onboarding steps
  const [onboardingAnswers, setOnboardingAnswers] = useState({
    budget: '',
    ielts: '',
    gpa: ''
  });

  // Data States
  const [allUniversities, setAllUniversities] = useState<University[]>([]);
  const [recommendedUniversities, setRecommendedUniversities] = useState<University[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<string[]>([
    "Tabriklaymiz! Yonsei University arizangiz muvaffaqiyatli qabul qilindi.",
    "Hujjatlaringiz (Pasport) muvaffaqiyatli tekshirildi.",
    "Tizimga yangi Germaniya grantlari qo'shildi! AI Consultant bilan gaplashib ko'ring."
  ]);

  // Modals & Temp States
  const [selectedUni, setSelectedUni] = useState<University | null>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyProgram, setApplyProgram] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadType, setUploadType] = useState<string>('Pasport');

  // Ariza (application) bilan birga to'ldiriladigan qo'shimcha ma'lumotlar va hujjatlar
  const [applyFatherName, setApplyFatherName] = useState<string>('');
  const [applyFatherPhone, setApplyFatherPhone] = useState<string>('');
  const [applyMotherName, setApplyMotherName] = useState<string>('');
  const [applyMotherPhone, setApplyMotherPhone] = useState<string>('');
  const [applyEmail, setApplyEmail] = useState<string>('');
  const [applyContactPhone, setApplyContactPhone] = useState<string>('');
  const [applyPassportFile, setApplyPassportFile] = useState<File | null>(null);
  const [applyPhoto3x4File, setApplyPhoto3x4File] = useState<File | null>(null);
  const [applyBirthCertFile, setApplyBirthCertFile] = useState<File | null>(null);
  const [applyIdCardFile, setApplyIdCardFile] = useState<File | null>(null);
  const [applyForeignPassportFile, setApplyForeignPassportFile] = useState<File | null>(null);
  const [isSubmittingApp, setIsSubmittingApp] = useState<boolean>(false);

  const resetApplyForm = () => {
    setApplyProgram('');
    setApplyFatherName('');
    setApplyFatherPhone('');
    setApplyMotherName('');
    setApplyMotherPhone('');
    setApplyEmail('');
    setApplyContactPhone('');
    setApplyPassportFile(null);
    setApplyPhoto3x4File(null);
    setApplyBirthCertFile(null);
    setApplyIdCardFile(null);
    setApplyForeignPassportFile(null);
  };
  
  // Search & Filter
  const [uniSearch, setUniSearch] = useState<string>('');
  const [uniFilterCountry, setUniFilterCountry] = useState<string>('Barchasi');
  const [uniFilterMatch, setUniFilterMatch] = useState<boolean>(false);

  // Countries view state - null means show all countries list
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Auth Inputs
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  
  const [regFirstName, setRegFirstName] = useState<string>('');
  const [regLastName, setRegLastName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  
  const [deepLinkCreated, setDeepLinkCreated] = useState<boolean>(false);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string>('');

  // Chat inputs
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Profile Edit
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editIelts, setEditIelts] = useState('');
  const [editGpa, setEditGpa] = useState('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Toast notification
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  // Fetch API wrapper helper
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    
    // For normal Content-Type-less bodies (e.g. FormData) don't enforce json headers
    if (options.body instanceof FormData) {
      delete (headers as any)['Content-Type'];
    }

    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Kutilmagan xatolik yuz berdi' }));
      throw new Error(errData.error || `Server xatoligi: ${res.status}`);
    }

    return res.json();
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Auth bootstrap
  useEffect(() => {
    if (token) {
      setLoading(true);
      apiFetch('/api/profile')
        .then(profile => {
          setUser(profile);
          // Set edit fields
          setEditFirstName(profile.firstName || '');
          setEditLastName(profile.lastName || '');
          setEditPhone(profile.phone || '');
          setEditBudget(profile.budget ? String(profile.budget) : '');
          setEditIelts(profile.ielts_score ? String(profile.ielts_score) : '');
          setEditGpa(profile.gpa ? String(profile.gpa) : '');

          if (profile.onboarding_completed && profile.role !== 'admin') {
            loadApplicationData();
          }
        })
        .catch(err => {
          console.error(err);
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // Load remaining PWA content
  const loadApplicationData = async () => {
    try {
      const [unis, recs, apps, docsList, favs, chats] = await Promise.all([
        apiFetch('/api/universities'),
        apiFetch('/api/universities/recommended'),
        apiFetch('/api/applications'),
        apiFetch('/api/documents'),
        apiFetch('/api/interests'),
        apiFetch('/api/ai/chat/history')
      ]);

      setAllUniversities(unis);
      setRecommendedUniversities(recs);
      setApplications(apps);
      setDocuments(docsList);
      setBookmarks(favs);
      setChatHistory(chats);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, chatLoading]);

  // Registration handler
  const handleRegisterInit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFirstName || !regLastName || !regPhone) {
      showToast('Barcha maydonlarni to\'ldiring', 'error');
      return;
    }

    try {
      setLoading(true);
      const data = await apiFetch('/api/auth/register-init', {
        method: 'POST',
        body: JSON.stringify({
          firstName: regFirstName,
          lastName: regLastName,
          phone: regPhone
        })
      });

      if (data.success) {
        setDeepLinkUrl(data.telegramUrl);
        setDeepLinkCreated(true);
        showToast('Hisobingiz tayyor! Telegram botga o\'ting.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Xatolik yuz berdi', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Shared post-login logic — runs after either password login or token-based auto-login succeeds
  const applyLoginSuccess = async (data: any) => {
    localStorage.setItem('eduvisa_token', data.token);
    setToken(data.token);
    setUser(data.user);

    if (data.user.role === 'admin') {
      showToast(`Xush kelibsiz, ${data.user.firstName}!`, 'success');
    } else if (data.user.onboarding_completed) {
      showToast(`Xush kelibsiz, ${data.user.firstName}!`, 'success');
      setActiveTab('home');
      // Reload all content
      const [unis, recs, apps, docsList, favs, chats] = await Promise.all([
        apiFetch('/api/universities'),
        apiFetch('/api/universities/recommended'),
        apiFetch('/api/applications'),
        apiFetch('/api/documents'),
        apiFetch('/api/interests'),
        apiFetch('/api/ai/chat/history')
      ]);
      setAllUniversities(unis);
      setRecommendedUniversities(recs);
      setApplications(apps);
      setDocuments(docsList);
      setBookmarks(favs);
      setChatHistory(chats);
    } else {
      setOnboardingStep(1);
      showToast('Iltimos, qisqa AI onboarding so\'rovnomasidan o\'ting', 'info');
    }
  };

  // Shared login logic — used both by the manual login form and by the
  // "avtomatik kirish" (auto-login) button on the Telegram registration screen.
  const performLogin = async (usernameRaw: string, passwordRaw: string) => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: usernameRaw.toLowerCase().trim(),
          password: passwordRaw.trim()
        })
      });

      if (data.success) {
        await applyLoginSuccess(data);
      }
    } catch (err: any) {
      showToast(err.message || 'Username yoki parol noto\'g\'ri', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Telegram bot xabaridagi "Hisobga avtomatik kirish" tugmasi bosilib, saytga
  // ?auto_login=TOKEN bilan qaytilganda shu funksiya token'ni login'ga almashtiradi.
  const performTokenLogin = async (loginToken: string) => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/auth/auto-login', {
        method: 'POST',
        body: JSON.stringify({ token: loginToken })
      });
      if (data.success) {
        await applyLoginSuccess(data);
      }
    } catch (err: any) {
      showToast(err.message || 'Havola muddati o\'tgan yoki noto\'g\'ri', 'error');
    } finally {
      setLoading(false);
      // URL'dan token'ni tozalaymiz, qayta yuklanganda qayta ishlatilmasin
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  };

  // Sahifa birinchi ochilganda URL'da ?auto_login=... bormi tekshiramiz
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginToken = params.get('auto_login');
    if (loginToken) {
      performTokenLogin(loginToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Manual login form submit handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      showToast('Username va parol kiritilishi shart', 'error');
      return;
    }
    await performLogin(loginUsername, loginPassword);
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('eduvisa_token');
    setToken(null);
    setUser(null);
    setApplications([]);
    setDocuments([]);
    setBookmarks([]);
    setChatHistory([]);
    setDeepLinkCreated(false);
    setLoginUsername('');
    setLoginPassword('');
    setActiveTab('home');
    showToast('Tizimdan muvaffaqiyatli chiqildi', 'info');
  };

  // Handle Onboarding Flow
  const handleOnboardingAnswer = async (answer: string) => {
    if (onboardingStep === 1) {
      setOnboardingAnswers(prev => ({ ...prev, budget: answer }));
      setOnboardingStep(2);
    } else if (onboardingStep === 2) {
      setOnboardingAnswers(prev => ({ ...prev, ielts: answer }));
      setOnboardingStep(3);
    } else if (onboardingStep === 3) {
      // Complete onboarding
      const finalAnswers = { ...onboardingAnswers, gpa: answer };
      setOnboardingAnswers(finalAnswers);
      
      const parsedBudget = finalAnswers.budget.toLowerCase().includes('bilmayman') ? null : parseFloat(finalAnswers.budget.replace(/[^0-9.]/g, ''));
      const parsedIelts = finalAnswers.ielts.toLowerCase().includes('yo') ? null : parseFloat(finalAnswers.ielts);
      const parsedGpa = finalAnswers.gpa.toLowerCase().includes('yo') ? null : parseFloat(finalAnswers.gpa);

      try {
        setLoading(true);
        const data = await apiFetch('/api/profile/onboarding', {
          method: 'POST',
          body: JSON.stringify({
            budget: parsedBudget,
            ielts_score: parsedIelts,
            has_ielts: parsedIelts !== null,
            gpa: parsedGpa,
            has_gpa: parsedGpa !== null
          })
        });

        setUser(data.user);
        showToast('Onboarding muvaffaqiyatli yakunlandi! Sizga mos grantlar tanlandi.', 'success');
        setActiveTab('home');
        loadApplicationData();
      } catch (err: any) {
        showToast(err.message || 'Onboarding saqlashda xatolik', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  // AI Chat Client handler
  const handleSendMessage = async (e?: React.FormEvent, presetMsg?: string) => {
    if (e) e.preventDefault();
    const textToSend = presetMsg || chatInput;
    if (!textToSend.trim()) return;

    // Add user message to state instantly
    const userMsg: ChatMessage = {
      role: 'user',
      message: textToSend,
      timestamp: new Date().toISOString()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const data = await apiFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: textToSend })
      });

      if (data.success) {
        setChatHistory(prev => [
          ...prev,
          {
            role: 'model',
            message: data.reply,
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (err: any) {
      showToast(err.message || 'AI javob bera olmadi', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  // Document upload simulator or real
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('Fayl o\'lchami 15MB dan oshmasligi kerak', 'error');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', uploadType);

    try {
      const data = await apiFetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        setDocuments(prev => [data.document, ...prev]);
        showToast(`${uploadType} muvaffaqiyatli yuklandi va tasdiqlandi!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Yuklashda xatolik yuz berdi', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Bookmark Toggle
  const toggleBookmark = async (uniId: string) => {
    try {
      const data = await apiFetch('/api/interests', {
        method: 'POST',
        body: JSON.stringify({ universityId: uniId })
      });
      if (data.success) {
        setBookmarks(data.interests);
        showToast(data.saved ? 'Universitet saqlanganlarga qo\'shildi' : 'Universitet olib tashlandi', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Bookmark xatoligi', 'error');
    }
  };

  // Application submission
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUni || !applyProgram) {
      showToast('Dasturni tanlang', 'error');
      return;
    }
    if (!applyFatherName.trim() || !applyFatherPhone.trim() || !applyMotherName.trim() || !applyMotherPhone.trim()) {
      showToast('Ota va ona ma\'lumotlarini to\'liq kiriting', 'error');
      return;
    }
    if (!applyEmail.trim() || !applyContactPhone.trim()) {
      showToast('Email va aloqa telefon raqamini kiriting', 'error');
      return;
    }
    if (!applyPassportFile || !applyPhoto3x4File || !applyBirthCertFile || !applyIdCardFile || !applyForeignPassportFile) {
      showToast('Barcha hujjatlarni (pasport, 3x4 rasm, metrika, ID karta, zagran pasport) yuklang', 'error');
      return;
    }

    try {
      setIsSubmittingApp(true);
      const formData = new FormData();
      formData.append('universityId', selectedUni.id);
      formData.append('program', applyProgram);
      formData.append('fatherName', applyFatherName);
      formData.append('fatherPhone', applyFatherPhone);
      formData.append('motherName', applyMotherName);
      formData.append('motherPhone', applyMotherPhone);
      formData.append('contactEmail', applyEmail);
      formData.append('contactPhone', applyContactPhone);
      if (applyPassportFile) formData.append('passport', applyPassportFile);
      if (applyPhoto3x4File) formData.append('photo3x4', applyPhoto3x4File);
      if (applyBirthCertFile) formData.append('birthCert', applyBirthCertFile);
      if (applyIdCardFile) formData.append('idCard', applyIdCardFile);
      if (applyForeignPassportFile) formData.append('foreignPassport', applyForeignPassportFile);

      const data = await apiFetch('/api/applications', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        setApplications(prev => [data.application, ...prev]);
        setIsApplying(false);
        setSelectedUni(null);
        resetApplyForm();
        showToast('Arizangiz muvaffaqiyatli topshirildi! Status ko\'rib chiqilyapti.', 'success');
        setActiveTab('applications');
      }
    } catch (err: any) {
      showToast(err.message || 'Ariza topshirishda xatolik', 'error');
    } finally {
      setIsSubmittingApp(false);
    }
  };

  // Save Profile Changes
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          phone: editPhone,
          budget: editBudget === '' ? null : Number(editBudget),
          ielts_score: editIelts === '' ? null : Number(editIelts),
          gpa: editGpa === '' ? null : Number(editGpa)
        })
      });

      if (data.success) {
        setUser(data.user);
        setProfileSuccessMsg('Profil muvaffaqiyatli saqlandi!');
        setTimeout(() => setProfileSuccessMsg(''), 4000);
        showToast('Profil ma\'lumotlari yangilandi', 'success');
        
        // Reload recommendations
        const recs = await apiFetch('/api/universities/recommended');
        setRecommendedUniversities(recs);
      }
    } catch (err: any) {
      showToast(err.message || 'Saqlashda xatolik', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Clear Chat History
  const clearChatHistory = async () => {
    try {
      await apiFetch('/api/ai/chat/clear', { method: 'POST' });
      setChatHistory([]);
      showToast('Suhbat tarixi tozalandi', 'info');
    } catch (err: any) {
      showToast('Xatolik yuz berdi', 'error');
    }
  };

  // Simulated Camera Capture for PWA
  const triggerCameraMock = () => {
    showToast('Kamera funksiyasi ishga tushirildi. Hujjat rasmini yuklang.', 'info');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      handleFileUpload(e);
    };
    input.click();
  };

  // Simulated push permission query
  const requestPushPermission = () => {
    showToast('Bildirishnomalar muvaffaqiyatli faollashtirildi! Kuniga 1-2 muhim yangilik yuboriladi.', 'success');
  };

  // Filter list of universities based on inputs
  const filteredUniversities = allUniversities.filter(uni => {
    const matchesSearch = uni.name.toLowerCase().includes(uniSearch.toLowerCase()) || 
                          uni.programs.some(p => p.toLowerCase().includes(uniSearch.toLowerCase())) ||
                          uni.country.toLowerCase().includes(uniSearch.toLowerCase());
    
    const matchesCountry = uniFilterCountry === 'Barchasi' || uni.country === uniFilterCountry;
    
    const matchesProfile = !uniFilterMatch || !user || (
      (user.budget === null || uni.budget <= user.budget) &&
      (user.ielts_score === null || !user.has_ielts || uni.ielts <= user.ielts_score)
    );

    return matchesSearch && matchesCountry && matchesProfile;
  });

  // Render Splash or Auth
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0B1C2C] flex items-center justify-center p-0 sm:p-4 md:p-8 overflow-y-auto">
        <div className="w-full max-w-5xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row border-0 sm:border border-[#E5E8EB] min-h-screen sm:min-h-[550px] bg-white">
          
          {/* Brand Panel — mobilda ixcham (faqat logo + qisqa sarlavha), desktopda to'liq */}
          <div className="md:w-1/2 bg-[#0B1C2C] px-5 py-6 md:p-12 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-2 md:mb-8">
                <img src={logoImg} alt="EDUVISA Logo" className="h-9 w-9 md:h-10 md:w-10 object-contain rounded-lg shrink-0" referrerPolicy="no-referrer" />
                <span className="text-[#D6B174] font-bold text-lg md:text-2xl font-display tracking-tight">EDUVISA</span>
                <span className="hidden sm:inline bg-[#D6B174]/10 text-[#D6B174] text-[9px] px-2 py-0.5 rounded-full border border-[#D6B174]/20 font-bold tracking-wider uppercase">PWA v2.0</span>
              </div>
              
              <h2 className="hidden md:block text-3xl md:text-4xl font-display font-semibold leading-tight mb-4 text-[#D6B174]">
                Xorijda Ta'lim Olmoqchimisiz?
              </h2>
              <p className="hidden md:block text-sm text-[#6A727D] leading-relaxed max-w-sm mb-6">
                Premium ta'lim konsaltingi endi sizning telefoningizda. Universitetlarni toping, o'zingizga mos grantlarni aniqlang va AI Konsultant yordamida tezkor ariza topshiring.
              </p>
              <p className="md:hidden text-[11px] text-[#6A727D] leading-relaxed">
                Xorijda ta'lim olish uchun premium konsalting — endi telefoningizda.
              </p>
            </div>

            <div className="hidden md:block relative z-10 mt-8">
              <div className="flex items-center space-x-3 bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="w-10 h-10 rounded-full bg-[#D6B174]/20 flex items-center justify-center text-[#D6B174] font-bold">
                  🤖
                </div>
                <div>
                  <p className="text-xs font-bold text-white">AI Onboarding Ko'makchisi</p>
                  <p className="text-[11px] text-[#6A727D]">GPA va IELTS balingizga mos grantlarni avtomatik hisoblaydi.</p>
                </div>
              </div>
            </div>

            {/* Abstract Design Shape */}
            <div className="hidden md:block absolute -right-16 -bottom-16 w-64 h-64 border-[32px] border-[#D6B174]/10 rounded-full"></div>
          </div>

          {/* Form Panel */}
          <div className="flex-1 md:w-1/2 px-5 py-7 md:p-12 flex flex-col justify-center bg-[#F7F9FA]">
            {authMode === 'login' ? (
              <div>
                <h3 className="text-2xl font-display font-bold text-[#0B1C2C] mb-1">Kirish</h3>
                <p className="text-xs text-[#6A727D] mb-6">Tizimga kirish uchun username va parolingizni kiriting</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Foydalanuvchi nomi (Username)</label>
                    <input 
                      type="text" 
                      placeholder="Foydalanuvchi nomingiz"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:border-[#D6B174] transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Parol</label>
                    <input 
                      type="password" 
                      placeholder="8 belgili parol"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:border-[#D6B174] transition-colors"
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-[#0B1C2C] text-[#D6B174] font-bold py-3.5 px-6 rounded-xl hover:bg-[#B99056] hover:text-[#031222] transition-colors shadow-lg"
                  >
                    Tizimga kirish
                  </button>
                </form>

                <p className="text-xs text-center text-[#6A727D] mt-6">
                  Hisobingiz yo'qmi?{' '}
                  <button onClick={() => setAuthMode('register')} className="text-[#D6B174] font-bold hover:underline">
                    Telegram orqali ro'yxatdan o'tish
                  </button>
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-2xl font-display font-bold text-[#0B1C2C] mb-1">Telegram orqali ro'yxatdan o'tish</h3>
                <p className="text-xs text-[#6A727D] mb-6">Xavfsiz va tezkor oqim. Ma'lumotlarni kiritganingizdan so'ng, sizga username va parol beradigan botga yo'naltirilasiz.</p>

                {!deepLinkCreated ? (
                  <form onSubmit={handleRegisterInit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Ismingiz</label>
                      <input 
                        type="text" 
                        placeholder="Ism"
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:border-[#D6B174] transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Familiyangiz</label>
                      <input 
                        type="text" 
                        placeholder="Familiya"
                        value={regLastName}
                        onChange={(e) => setRegLastName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:border-[#D6B174] transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Telefon raqamingiz</label>
                      <input 
                        type="tel" 
                        placeholder="+998901234567"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:border-[#D6B174] transition-colors"
                        required
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-[#0B1C2C] text-[#D6B174] font-bold py-3.5 px-6 rounded-xl hover:bg-[#B99056] hover:text-[#031222] transition-colors shadow-lg"
                    >
                      Bot havolasini yaratish
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="p-4 bg-white border border-[#E5E8EB] rounded-2xl text-left">
                      <p className="text-xs font-bold text-[#0B1C2C] mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-[#1E9E5A]" /> Havola muvaffaqiyatli yaratildi!
                      </p>
                      <p className="text-[11px] text-[#6A727D] leading-relaxed mb-4">
                        Pastdagi tugmani bosing va botda <strong>Start</strong> buyrug'ini yuboring — bot sizga username va parolni, shuningdek "Avtomatik kirish" tugmasini yuboradi. O'sha tugmani bossangiz, hisobingizga parolsiz kirib ketasiz.
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          if (deepLinkUrl) {
                            // <a target="_blank"> ba'zi mobil brauzer/PWA (standalone) muhitlarida
                            // yangi oynani ochmasligi mumkin. Shu sabab to'g'ridan-to'g'ri
                            // joriy oynada navigatsiya qilamiz — bu Telegram deep-link uchun
                            // eng ishonchli usul.
                            window.location.href = deepLinkUrl;
                          }
                        }}
                        className="inline-flex items-center justify-center space-x-2 w-full bg-[#D6B174] hover:bg-[#B99056] text-[#031222] py-3 rounded-xl font-bold text-xs"
                      >
                        <span>Telegram botni ochish</span>
                        <ExternalLink className="w-4 h-4" />
                      </button>

                      {deepLinkUrl && (
                        <p className="text-[10px] text-[#6A727D] mt-2 text-center">
                          Tugma ishlamasa,{' '}
                          <a href={deepLinkUrl} target="_blank" rel="noreferrer" className="text-[#D6B174] font-bold hover:underline">
                            shu havolani
                          </a>{' '}
                          qo'lda bosing.
                        </p>
                      )}
                    </div>

                    <button 
                      onClick={() => { setDeepLinkCreated(false); }}
                      className="text-xs text-[#6A727D] hover:underline block mx-auto mt-2"
                    >
                      Qayta tahrirlash
                    </button>
                  </div>
                )}

                <p className="text-xs text-center text-[#6A727D] mt-6">
                  Hisobingiz bormi?{' '}
                  <button onClick={() => setAuthMode('login')} className="text-[#D6B174] font-bold hover:underline">
                    Kirish sahifasiga qaytish
                  </button>
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Global Toast */}
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 px-5 py-3 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-2xl transition-all duration-300 transform translate-y-0 ${
            toast.type === 'success' ? 'bg-[#1E9E5A] text-white' :
            toast.type === 'error' ? 'bg-[#E40016] text-white' : 'bg-[#0B1C2C] text-[#D6B174]'
          }`}>
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  // Render AI Onboarding questionnaire (if user exists but not completed)
  if (user && !user.onboarding_completed && onboardingStep > 0) {
    return (
      <div className="min-h-screen bg-[#0B1C2C] flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E5E8EB] flex flex-col h-[600px]">
          
          {/* Header */}
          <div className="bg-[#0B1C2C] p-6 text-white border-b border-white/10 shrink-0 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#D6B174] flex items-center justify-center text-[#031222]">
                <Bot className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-display font-semibold text-lg text-[#D6B174]">EduVisa AI Profiling</h4>
                <p className="text-[10px] text-[#6A727D]">Onboarding so'rovnomasi</p>
              </div>
            </div>
            <div className="text-xs bg-white/10 px-3 py-1 rounded-full text-white/80">
              Qadam {onboardingStep} / 3
            </div>
          </div>

          {/* Chat-style Questions Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#F7F9FA]">
            {/* AI Welcome Message */}
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-[#0B1C2C] flex items-center justify-center text-white text-xs shrink-0 font-display">
                AI
              </div>
              <div className="bg-[#0B1C2C] text-white rounded-2xl rounded-tl-none p-4 text-xs leading-relaxed max-w-[85%] shadow-md">
                Salom, <strong>{user.firstName}</strong>! EduVisa oilasiga xush kelibsiz. Sizga eng mos universitetlarni va maksimal grantlarni topishda yordam berish uchun qisqa 3 ta savolga javob berishingizni iltimos qilaman.
              </div>
            </div>

            {/* Question 1: Budget */}
            {onboardingStep >= 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0B1C2C] flex items-center justify-center text-white text-xs shrink-0 font-display">
                    AI
                  </div>
                  <div className="bg-[#0B1C2C] text-white rounded-2xl rounded-tl-none p-4 text-xs leading-relaxed max-w-[85%] shadow-md">
                    <strong>Savol 1:</strong> Chet elda ta'lim olish uchun taxminiy yillik byudjetingiz qancha? (Ushbu mablag'ga kontrakt to'lovi kiradi). Keyinchalik buni o'zgartirishingiz mumkin.
                  </div>
                </div>

                {onboardingStep === 1 && (
                  <div className="pl-11 flex flex-wrap gap-2">
                    <button onClick={() => handleOnboardingAnswer('$1,500 (Faqat Bepul/Arzon)')} className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
                      $1,500 gacha (Bepul ta'lim)
                    </button>
                    <button onClick={() => handleOnboardingAnswer('$5,000')} className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
                      $5,000 gacha
                    </button>
                    <button onClick={() => handleOnboardingAnswer('$10,000')} className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
                      $10,000 gacha
                    </button>
                    <button onClick={() => handleOnboardingAnswer('$20,000')} className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
                      $20,000 gacha
                    </button>
                    <button onClick={() => handleOnboardingAnswer('Hali bilmayman')} className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all text-[#6A727D] shadow-sm">
                      Hali bilmayman
                    </button>
                  </div>
                )}

                {onboardingAnswers.budget && (
                  <div className="flex justify-end pr-2">
                    <div className="bg-[#D6B174] text-[#031222] rounded-2xl rounded-tr-none p-3 text-xs font-semibold shadow-sm">
                      Byudjet: {onboardingAnswers.budget}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Question 2: IELTS */}
            {onboardingStep >= 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0B1C2C] flex items-center justify-center text-white text-xs shrink-0 font-display">
                    AI
                  </div>
                  <div className="bg-[#0B1C2C] text-white rounded-2xl rounded-tl-none p-4 text-xs leading-relaxed max-w-[85%] shadow-md animate-slideIn">
                    <strong>Savol 2:</strong> IELTS yoki unga tenglashtirilgan ingliz tili sertifikatingiz bormi? Bo'lsa balingizni kiriting, bo'lmasa 'yo'q' deb javob bering.
                  </div>
                </div>

                {onboardingStep === 2 && (
                  <div className="pl-11 flex flex-wrap gap-2">
                    {['7.5', '7.0', '6.5', '6.0', '5.5', 'Yo\'q'].map((score) => (
                      <button 
                        key={score} 
                        onClick={() => handleOnboardingAnswer(score)} 
                        className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        {score === 'Yo\'q' ? 'Yo\'q (Sertifikat yo\'q)' : `IELTS ${score}`}
                      </button>
                    ))}
                  </div>
                )}

                {onboardingAnswers.ielts && (
                  <div className="flex justify-end pr-2">
                    <div className="bg-[#D6B174] text-[#031222] rounded-2xl rounded-tr-none p-3 text-xs font-semibold shadow-sm">
                      IELTS: {onboardingAnswers.ielts}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Question 3: GPA */}
            {onboardingStep >= 3 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0B1C2C] flex items-center justify-center text-white text-xs shrink-0 font-display">
                    AI
                  </div>
                  <div className="bg-[#0B1C2C] text-white rounded-2xl rounded-tl-none p-4 text-xs leading-relaxed max-w-[85%] shadow-md">
                    <strong>Savol 3:</strong> O'rtacha o'zlashtirish bahongiz (GPA / Baholar o'rtachasi) necha? (Masalan: 4.8 yoki 5 baholik tizimda 4.5). Bilmasangiz 'yo'q' deb tanlang.
                  </div>
                </div>

                {onboardingStep === 3 && (
                  <div className="pl-11 flex flex-wrap gap-2">
                    {['4.8+', '4.5+', '4.0+', '3.5+', 'Yo\'q'].map((gpaVal) => (
                      <button 
                        key={gpaVal} 
                        onClick={() => handleOnboardingAnswer(gpaVal.replace('+', ''))} 
                        className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        {gpaVal === 'Yo\'q' ? 'Bilmayman / Yo\'q' : `GPA ${gpaVal}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer loading or status indicator */}
          <div className="p-4 bg-[#F3F5F8] text-center border-t border-[#E5E8EB] text-[10px] text-[#6A727D] shrink-0">
            Malumotlar shifrlangan xavfsiz kanallar orqali yuboriladi
          </div>

        </div>
      </div>
    );
  }

  // MAIN PWA INTERFACE
  if (user && user.role === 'admin') {
    return <AdminPanel token={token!} onLogout={logout} apiFetch={apiFetch} />;
  }

  return (
    <div className="min-h-screen bg-[#F3F5F8] text-[#212630] font-sans flex flex-col lg:flex-row">
      
      {/* Sidebar - Desktop Navigation (>= 1024px) */}
      <aside className="hidden lg:flex w-72 bg-[#0B1C2C] text-white flex-col h-screen shrink-0 sticky top-0 border-r border-white/5">
        <div className="p-8">
          <div className="flex items-center space-x-3">
            <img src={logoImg} alt="EDUVISA Logo" className="h-10 w-10 object-contain rounded-lg shrink-0" referrerPolicy="no-referrer" />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[#D6B174] text-2xl font-bold tracking-tight font-display">EDUVISA</span>
                <span className="text-[9px] border border-[#D6B174]/30 text-[#D6B174] rounded px-1.5 py-0.5 uppercase tracking-widest font-bold">PWA</span>
              </div>
              <p className="text-[#6A727D] text-[9px] uppercase tracking-widest mt-0.5">Premium Consulting</p>
            </div>
          </div>
        </div>

        {/* User Mini Profile */}
        {user && (
          <div className="px-6 mb-6">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#D6B174]/20 border border-[#D6B174]/40 flex items-center justify-center text-[#D6B174] font-bold">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.firstName} {user.lastName}</p>
                <p className="text-[10px] text-[#6A727D] truncate">@{user.username}</p>
              </div>
              <button onClick={logout} className="text-[#6A727D] hover:text-[#E40016] transition-colors" title="Chiqish">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Sidebar Nav Buttons */}
        <nav className="flex-1 px-4 space-y-1">
          <button 
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'home' ? 'bg-white/5 text-white border-l-4 border-[#D6B174]' : 'text-[#6A727D] hover:bg-white/5 hover:text-white'
            }`}
          >
            <Home className="w-5 h-5 shrink-0 text-[#D6B174]" />
            <span>Bosh sahifa</span>
          </button>

          <button 
            onClick={() => { setActiveTab('universities'); setSelectedCountry(null); }}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'universities' ? 'bg-white/5 text-white border-l-4 border-[#D6B174]' : 'text-[#6A727D] hover:bg-white/5 hover:text-white'
            }`}
          >
            <GraduationCap className="w-5 h-5 shrink-0 text-[#D6B174]" />
            <span>Davlatlar</span>
          </button>

          <button 
            onClick={() => setActiveTab('ai')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'ai' ? 'bg-white/5 text-white border-l-4 border-[#D6B174]' : 'text-[#6A727D] hover:bg-white/5 hover:text-white'
            }`}
          >
            <Bot className="w-5 h-5 shrink-0 text-[#D6B174]" />
            <span className="flex-1 text-left">AI Consultant</span>
            <span className="bg-[#D6B174] text-[#031222] text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Yangi</span>
          </button>

          <button 
            onClick={() => setActiveTab('applications')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'applications' ? 'bg-white/5 text-white border-l-4 border-[#D6B174]' : 'text-[#6A727D] hover:bg-white/5 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5 shrink-0 text-[#D6B174]" />
            <span>Mening arizalarim</span>
          </button>

          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'profile' ? 'bg-white/5 text-white border-l-4 border-[#D6B174]' : 'text-[#6A727D] hover:bg-white/5 hover:text-white'
            }`}
          >
            <User className="w-5 h-5 shrink-0 text-[#D6B174]" />
            <span>Mening profilim</span>
          </button>
        </nav>

        {/* Sidebar Mini Card */}
        {user && (
          <div className="p-6 border-t border-white/5">
            <div className="bg-[#D6B174]/5 rounded-2xl p-4 border border-[#D6B174]/15">
              <p className="text-[10px] text-[#D6B174] uppercase font-bold tracking-wider mb-2">Profil O'lchovlari</p>
              <div className="space-y-1.5 text-xs text-white/90">
                <div className="flex justify-between">
                  <span className="text-white/40">IELTS:</span>
                  <span className="font-semibold">{user.ielts_score ? user.ielts_score : 'Yo\'q'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">GPA:</span>
                  <span className="font-semibold">{user.gpa ? user.gpa : 'Yo\'q'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Yillik Byudjet:</span>
                  <span className="font-semibold text-[#D6B174] font-mono">{user.budget ? `$${user.budget.toLocaleString()}` : 'Bepul'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* TOP BAR / MOBILE HEADER */}
      <header className="lg:hidden h-16 bg-[#0B1C2C] text-white flex items-center justify-between px-6 sticky top-0 z-40 border-b border-white/5">
        <div className="flex items-center space-x-2.5">
          <img src={logoImg} alt="EDUVISA Logo" className="h-8 w-8 object-contain rounded-md shrink-0" referrerPolicy="no-referrer" />
          <span className="text-[#D6B174] text-lg font-bold font-display tracking-tight">EDUVISA</span>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setActiveTab('profile')}
            className="w-8 h-8 rounded-full bg-[#D6B174]/20 flex items-center justify-center text-[#D6B174] font-bold text-xs"
          >
            {user ? user.firstName[0] : 'U'}
          </button>
        </div>
      </header>

      {/* OFFLINE BANNER */}
      {!navigator.onLine && (
        <div className="bg-[#E40016] text-white text-center py-2 px-4 text-xs font-bold sticky top-16 lg:top-0 z-30">
          Oflayn rejim — Ba'zi ma'lumotlar eski yoki o'zgarishsiz ko'rinishi mumkin. AI chat ulanish talab qiladi.
        </div>
      )}

      {/* MAIN SCREEN ROUTING CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 p-4 md:p-8 lg:p-10 overflow-y-auto pb-24 lg:pb-10 max-w-7xl mx-auto w-full">
        
        {/* TAB 1: BOSH SAHIFA (HOME) */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Elegant Welcome Banner */}
            <div className="bg-white border border-[#E5E8EB] p-6 md:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm relative overflow-hidden">
              <div className="relative z-10 space-y-1">
                <p className="text-[#D6B174] text-xs font-bold uppercase tracking-wider">Xush kelibsiz</p>
                <h2 className="text-2xl md:text-3xl font-bold font-display text-[#0B1C2C]">
                  Salom, {user?.firstName} {user?.lastName}!
                </h2>
                <p className="text-xs text-[#6A727D] max-w-md">
                  Sizning profilingiz bo'yicha eng yaxshi imkoniyatlar tahlil qilindi. Bugungi universitet va grant tavsiyalaringiz tayyor.
                </p>
              </div>
              <div className="relative z-10 flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => { setActiveTab('universities'); setSelectedCountry(null); }} 
                  className="flex-1 md:flex-none bg-[#0B1C2C] text-[#D6B174] px-5 py-3 rounded-2xl font-bold text-xs hover:bg-[#B99056] hover:text-[#031222] transition-colors shadow-md"
                >
                  Davlatlarni ko'rish
                </button>
                <button 
                  onClick={() => setActiveTab('ai')}
                  className="flex-1 md:flex-none bg-[#D6B174]/10 text-[#0B1C2C] border border-[#D6B174]/30 px-5 py-3 rounded-2xl font-bold text-xs hover:bg-[#D6B174]/20 transition-colors"
                >
                  AI Konsultatsiya
                </button>
              </div>
              <div className="absolute -right-16 -bottom-16 w-44 h-44 border-[16px] border-[#D6B174]/10 rounded-full"></div>
            </div>

            {/* Grid Layout: Recommended Unis & Application Stages */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Recommended Universities (8 Cols) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold font-display text-[#0B1C2C] flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#D6B174]" /> Sizga mos universitetlar
                  </h3>
                  <button 
                    onClick={() => {
                      setUniFilterMatch(true);
                      setSelectedCountry(null);
                      setActiveTab('universities');
                    }}
                    className="text-xs text-[#D6B174] font-bold hover:underline"
                  >
                    Barchasi
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendedUniversities.length > 0 ? (
                    recommendedUniversities.map((uni) => (
                      <div 
                        key={uni.id} 
                        className="bg-white border border-[#E5E8EB] p-5 rounded-2xl flex flex-col justify-between hover:border-[#D6B174] transition-all cursor-pointer group shadow-sm hover:shadow-md"
                        onClick={() => setSelectedUni(uni)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl p-1.5 bg-[#F3F5F8] rounded-xl">{uni.logo}</span>
                            <div>
                              <h4 className="text-sm font-bold text-[#0B1C2C] group-hover:text-[#D6B174] transition-colors truncate max-w-[170px]">{uni.name}</h4>
                              <p className="text-[11px] text-[#6A727D]">{uni.country}</p>
                            </div>
                          </div>
                          <span className="bg-[#1E9E5A]/10 text-[#1E9E5A] text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">Sizga mos</span>
                        </div>

                        <p className="text-xs text-[#6A727D] line-clamp-2 mb-4 leading-relaxed">
                          {uni.description}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-[#E5E8EB] text-xs">
                          <span className="font-mono text-xs font-bold text-[#0B1C2C]">${uni.budget.toLocaleString()}/y</span>
                          <span className="text-[11px] text-[#6A727D]">IELTS: {uni.ielts}+</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 bg-white border border-[#E5E8EB] rounded-2xl p-8 text-center text-[#6A727D]">
                      Hozircha sizning profilingiz bo'yicha mos universitetlar topilmadi. Profil ma'lumotlarini o'zgartirib ko'ring.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Application Status & Notifications (4 Cols) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Applications Status card */}
                <div className="bg-white border border-[#E5E8EB] rounded-2xl p-6 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6A727D] mb-4">Arizalarim holati</h4>
                  
                  {applications.length > 0 ? (
                    <div className="space-y-4">
                      {applications.slice(0, 2).map((app) => (
                        <div key={app.id} className="flex items-center space-x-3 p-2 hover:bg-[#F7F9FA] rounded-xl transition-all">
                          <span className="text-xl">
                            {app.status.includes('Ko\'rib') ? '🟡' : app.status.includes('Tasdiq') ? '🟢' : '🔴'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-[#0B1C2C] truncate">{app.universityName}</p>
                            <p className="text-[10px] text-[#6A727D] truncate">{app.program}</p>
                          </div>
                          <span className="text-[10px] font-mono text-[#6A727D]">{app.date}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-[#6A727D]">
                      Hozircha ariza topshirilmagan.
                    </div>
                  )}

                  <button 
                    onClick={() => setActiveTab('applications')}
                    className="w-full mt-4 py-2 text-center border border-[#E5E8EB] hover:bg-[#F3F5F8] rounded-xl text-xs font-bold transition-all text-[#0B1C2C]"
                  >
                    Barcha arizalarim
                  </button>
                </div>

                {/* AI Advisor Mini Widget */}
                <div className="bg-[#0B1C2C] text-white rounded-2xl p-5 border border-white/5 relative overflow-hidden shadow-md flex flex-col justify-between min-h-[180px]">
                  <div className="relative z-10 flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-[#D6B174] flex items-center justify-center text-[#031222] font-bold text-xs">
                      AI
                    </div>
                    <span className="font-bold text-sm text-[#D6B174]">AI Maslahatchi</span>
                  </div>
                  <p className="relative z-10 text-[11px] text-white/80 leading-relaxed mt-2">
                    Siz uchun yangi grantlar tahlili tugadi. IELTS {user?.ielts_score || '7.5'} balingiz uchun Hanyang University to'liq mos kelishi mumkin.
                  </p>
                  <button 
                    onClick={() => setActiveTab('ai')}
                    className="relative z-10 w-full mt-4 bg-[#D6B174] hover:bg-[#B99056] text-[#031222] text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                  >
                    <span>Muloqotni boshlash</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

            </div>

            {/* Notifications Panel */}
            <div className="bg-white border border-[#E5E8EB] p-6 rounded-3xl shadow-sm">
              <h4 className="text-sm font-bold font-display text-[#0B1C2C] mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#D6B174]" /> Oxirgi bildirishnomalar
              </h4>
              <div className="space-y-3">
                {notifications.map((notif, idx) => (
                  <div key={idx} className="flex items-start space-x-3 p-3 bg-[#F7F9FA] rounded-xl text-xs border border-[#E5E8EB]/50">
                    <span className="text-[#D6B174] mt-0.5">●</span>
                    <p className="text-[#212630] font-medium leading-relaxed">{notif}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: UNIVERSITETLAR (UNIVERSITIES) */}
        {activeTab === 'universities' && (() => {
          // Unique countries from loaded universities
          const countryList = Array.from(new Set(allUniversities.map(u => u.country))).map(country => {
            const unis = allUniversities.filter(u => u.country === country);
            const flagEmoji = unis[0]?.logo || '🌍';
            const countryInfo: Record<string, { desc: string; color: string }> = {
              'Buyuk Britaniya': { desc: 'Dunyo reytingi yuqori universitetlar', color: '#012169' },
              'Xitoy':           { desc: 'Arzon va sifatli ta\'lim, full grantlar', color: '#DE2910' },
              'Janubiy Koreya':  { desc: 'Texnologiya va IT sohasida yetakchi', color: '#C60C30' },
              'Avstraliya':      { desc: 'Jahon miqyosidagi tadqiqot markazlari', color: '#00008B' },
              'Germaniya':       { desc: 'Bepul ta\'lim imkoniyatlari mavjud', color: '#000000' },
              'Singapur':        { desc: 'Osiyo\'ning eng nufuzli ta\'lim markazi', color: '#EF3340' },
            };
            const info = countryInfo[country] || { desc: `${unis.length} ta universitet mavjud`, color: '#0B1C2C' };
            return { country, unis, flagEmoji, desc: info.desc, color: info.color };
          });

          // Universities of selected country
          const countryUnis = selectedCountry
            ? allUniversities.filter(u => u.country === selectedCountry).filter(uni => {
                const matchesSearch = !uniSearch || uni.name.toLowerCase().includes(uniSearch.toLowerCase()) || 
                  uni.programs.some(p => p.toLowerCase().includes(uniSearch.toLowerCase()));
                const matchesProfile = !uniFilterMatch || !user || (
                  (user.budget === null || uni.budget <= user.budget) &&
                  (user.ielts_score === null || !user.has_ielts || uni.ielts <= user.ielts_score)
                );
                return matchesSearch && matchesProfile;
              })
            : [];

          return (
            <div className="space-y-6 animate-fadeIn">
              {!selectedCountry ? (
                /* ===== DAVLATLAR RO'YXATI ===== */
                <>
                  <div className="bg-white border border-[#E5E8EB] p-5 rounded-3xl shadow-sm">
                    <h3 className="font-display font-bold text-lg text-[#0B1C2C] mb-1">Ta'lim Olish Mumkin Bo'lgan Davlatlar</h3>
                    <p className="text-xs text-[#6A727D]">Qiziqtirgan davlatni tanlang — o'sha davlatdagi universitetlar ko'rsatiladi</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {countryList.map(({ country, unis, flagEmoji, desc }) => (
                      <button
                        key={country}
                        onClick={() => { setSelectedCountry(country); setUniSearch(''); setUniFilterMatch(false); }}
                        className="bg-white border border-[#E5E8EB] rounded-3xl overflow-hidden hover:shadow-xl hover:border-[#D6B174] transition-all text-left group shadow-sm"
                      >
                        {/* Country header banner */}
                        <div className="bg-[#0B1C2C] px-6 pt-6 pb-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                          <span className="text-5xl block mb-3">{flagEmoji}</span>
                          <h4 className="font-display font-bold text-lg text-white group-hover:text-[#D6B174] transition-colors leading-tight">
                            {country}
                          </h4>
                        </div>
                        {/* Info footer */}
                        <div className="px-6 py-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-[#6A727D] leading-relaxed">{desc}</p>
                          </div>
                          <div className="ml-3 shrink-0 flex flex-col items-end">
                            <span className="text-[10px] text-[#6A727D] uppercase font-bold tracking-wide">Universitetlar</span>
                            <span className="text-xl font-bold font-display text-[#D6B174]">{unis.length}</span>
                          </div>
                        </div>
                        <div className="px-6 pb-4">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#D6B174] group-hover:gap-2.5 transition-all">
                            Ko'rish <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                /* ===== TANLANGAN DAVLAT UNIVERSITETLARI ===== */
                <>
                  {/* Back + Search bar */}
                  <div className="bg-white border border-[#E5E8EB] p-5 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setSelectedCountry(null); setUniSearch(''); setUniFilterMatch(false); }}
                        className="p-2.5 bg-[#F3F5F8] hover:bg-[#D6B174]/15 rounded-xl transition-colors text-[#0B1C2C] hover:text-[#D6B174] shrink-0"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      <div>
                        <h3 className="font-display font-bold text-base text-[#0B1C2C]">
                          {allUniversities.find(u => u.country === selectedCountry)?.logo} {selectedCountry}
                        </h3>
                        <p className="text-xs text-[#6A727D]">{allUniversities.filter(u => u.country === selectedCountry).length} ta universitet mavjud</p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Universitet yoki yo'nalish nomini qidiring..."
                          value={uniSearch}
                          onChange={(e) => setUniSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-sm focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630]"
                        />
                        <Search className="w-5 h-5 text-[#6A727D] absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E5E8EB]/50">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="matchToggle"
                          checked={uniFilterMatch}
                          onChange={(e) => setUniFilterMatch(e.target.checked)}
                          className="w-4 h-4 accent-[#D6B174] cursor-pointer"
                        />
                        <label htmlFor="matchToggle" className="text-xs font-semibold text-[#0B1C2C] cursor-pointer">
                          Profilimga mos keladiganlarini ko'rsat
                        </label>
                      </div>
                      <span className="text-xs text-[#6A727D] font-medium">{countryUnis.length} ta topildi</span>
                    </div>
                  </div>

                  {/* University Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {countryUnis.map((uni) => {
                      const isSaved = bookmarks.includes(uni.id);
                      return (
                        <div
                          key={uni.id}
                          className="bg-white border border-[#E5E8EB] rounded-2xl overflow-hidden hover:shadow-xl transition-all flex flex-col justify-between group h-full cursor-pointer shadow-sm"
                          onClick={() => setSelectedUni(uni)}
                        >
                          <div className="p-6 pb-4">
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-3xl p-2.5 bg-[#F3F5F8] rounded-2xl block">{uni.logo}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleBookmark(uni.id); }}
                                className="p-2 bg-[#F3F5F8] hover:bg-[#D6B174]/15 rounded-xl transition-colors text-[#6A727D] hover:text-[#D6B174]"
                              >
                                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-[#D6B174] text-[#D6B174]' : ''}`} />
                              </button>
                            </div>
                            <h4 className="font-display font-bold text-base text-[#0B1C2C] group-hover:text-[#D6B174] transition-colors leading-snug line-clamp-1 mb-1">
                              {uni.name}
                            </h4>
                            <p className="text-xs text-[#6A727D] mb-4">{uni.country}</p>
                            <p className="text-xs text-[#6A727D] leading-relaxed line-clamp-3">{uni.description}</p>
                          </div>
                          <div className="px-6 py-4 bg-[#F7F9FA] border-t border-[#E5E8EB] flex items-center justify-between text-xs font-semibold">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-[#6A727D] uppercase font-bold tracking-wide">Yillik Byudjet</span>
                              <span className="text-xs font-bold text-[#0B1C2C] font-mono">${uni.budget.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[10px] text-[#6A727D] uppercase font-bold tracking-wide">Talab</span>
                              <span className="text-xs font-bold text-[#0B1C2C]">IELTS {uni.ielts}+</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {countryUnis.length === 0 && (
                      <div className="col-span-full bg-white border border-[#E5E8EB] rounded-3xl p-12 text-center text-[#6A727D]">
                        <GraduationCap className="w-12 h-12 mx-auto text-[#D6B174] mb-3 stroke-[1.5]" />
                        <h4 className="font-display font-bold text-[#0B1C2C] text-sm mb-1">Natija topilmadi</h4>
                        <p className="text-xs">Qidiruv parametrlarini o'zgartiring</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* TAB 3: AI CONSULTANT (AI CHAT) */}
        {activeTab === 'ai' && (
          <div className="flex-1 bg-white border border-[#E5E8EB] rounded-3xl shadow-sm flex flex-col h-[650px] overflow-hidden animate-fadeIn">
            
            {/* Chat header */}
            <div className="bg-[#0B1C2C] p-5 text-white flex items-center justify-between border-b border-white/5 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D6B174] flex items-center justify-center text-[#031222]">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-base text-[#D6B174]">Premium AI Konsultant</h4>
                  <div className="flex items-center space-x-1.5 text-[10px] text-white/50">
                    <span className="w-1.5 h-1.5 bg-[#1E9E5A] rounded-full animate-ping"></span>
                    <span>Profil ma'lumotlariga asoslangan real javoblar</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={clearChatHistory}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-[#6A727D] hover:text-white"
                  title="Suhbatni tozalash"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* System Profile Context Info Row */}
            <div className="bg-[#D6B174]/5 px-5 py-2 border-b border-[#E5E8EB] flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#0B1C2C] font-semibold">
              <span>Profil konteksti:</span>
              <span className="text-[#6A727D]">IELTS: {user?.ielts_score || 'Yo\'q'}</span>
              <span className="text-[#6A727D]">GPA: {user?.gpa || 'Yo\'q'}</span>
              <span className="text-[#6A727D]">Byudjet: {user?.budget ? `$${user.budget.toLocaleString()}` : 'Bepul'}</span>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#F7F9FA]">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6A727D]">
                  <Bot className="w-12 h-12 text-[#D6B174] mb-3 stroke-[1.5]" />
                  <h5 className="font-display font-bold text-[#0B1C2C] text-sm mb-1">Muloqotni boshlang</h5>
                  <p className="text-xs max-w-sm mb-4">
                    Sizga mos universitetlarni topish, hujjatlar yaroqliligini tekshirish yoki ariza topshirish bo'yicha har qanday savolingizni bering.
                  </p>
                </div>
              ) : (
                chatHistory.map((chat, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-start space-x-3 ${chat.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                  >
                    {chat.role === 'model' && (
                      <div className="w-8 h-8 rounded-lg bg-[#0B1C2C] flex items-center justify-center text-white font-bold text-xs shrink-0 font-display">
                        AI
                      </div>
                    )}
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed max-w-[80%] shadow-sm ${
                      chat.role === 'user' 
                        ? 'bg-[#D6B174] text-[#031222] rounded-tr-none font-medium' 
                        : 'bg-[#0B1C2C] text-white rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-line">{chat.message}</p>
                      <div className="text-[9px] text-right mt-1 opacity-40">
                        {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Chat Loading typing effect */}
              {chatLoading && (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0B1C2C] flex items-center justify-center text-white font-bold text-xs shrink-0 font-display">
                    AI
                  </div>
                  <div className="bg-[#0B1C2C] text-white rounded-2xl rounded-tl-none p-4 text-xs max-w-[80%] shadow-sm">
                    <div className="flex space-x-1 py-1.5 px-0.5">
                      <span className="w-2 h-2 bg-[#D6B174] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-[#D6B174] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-[#D6B174] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef}></div>
            </div>

            {/* Quick question chips */}
            <div className="p-3 bg-[#F3F5F8] border-t border-[#E5E8EB] flex gap-2 overflow-x-auto no-scrollbar shrink-0">
              <button 
                onClick={() => handleSendMessage(undefined, "Menga qaysi universitet mos?")}
                className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] rounded-full px-4 py-2 text-xs font-semibold shrink-0 transition-all text-[#0B1C2C]"
              >
                🎓 Menga qaysi mos?
              </button>
              <button 
                onClick={() => handleSendMessage(undefined, "Hujjatlarim yetarlimi?")}
                className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] rounded-full px-4 py-2 text-xs font-semibold shrink-0 transition-all text-[#0B1C2C]"
              >
                📄 Hujjatlarim yetarlimi?
              </button>
              <button 
                onClick={() => handleSendMessage(undefined, "Arizam qaysi bosqichda?")}
                className="bg-white border border-[#E5E8EB] hover:border-[#D6B174] rounded-full px-4 py-2 text-xs font-semibold shrink-0 transition-all text-[#0B1C2C]"
              >
                ⏳ Arizam holati qanday?
              </button>
            </div>

            {/* Input form */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-[#E5E8EB] flex items-center space-x-3 shrink-0">
              <input 
                type="text" 
                placeholder="Savolingizni yozing..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-[#F3F5F8] rounded-2xl px-5 py-3.5 text-xs text-[#212630] placeholder:text-[#6A727D] focus:outline-none focus:bg-white focus:border-[#D6B174] border border-transparent transition-all"
                disabled={chatLoading}
              />
              <button 
                type="submit" 
                className="bg-[#0B1C2C] text-[#D6B174] p-3.5 rounded-2xl hover:bg-[#B99056] hover:text-[#031222] transition-colors shadow-md shrink-0"
                disabled={chatLoading}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        )}

        {/* TAB 4: MENING ARIZALARIM (APPLICATIONS) */}
        {activeTab === 'applications' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Applications List Header with New Application button */}
            <div className="flex justify-between items-center bg-white border border-[#E5E8EB] p-5 rounded-3xl shadow-sm">
              <div>
                <h3 className="font-display font-bold text-lg text-[#0B1C2C]">Hujjat topshirish monitoringi</h3>
                <p className="text-xs text-[#6A727D]">Arizalaringiz statusi real vaqtda yangilanadi</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedCountry(null);
                  setActiveTab('universities');
                  showToast('Ariza uchun avval davlat va universitetni tanlang', 'info');
                }}
                className="bg-[#0B1C2C] text-[#D6B174] font-bold px-4 py-2.5 rounded-2xl text-xs hover:bg-[#B99056] hover:text-[#031222] transition-colors flex items-center space-x-2 shadow-md"
              >
                <span>+ Yangi Ariza</span>
              </button>
            </div>

            {/* Active applications Timeline or cards */}
            <div className="space-y-6">
              {applications.length > 0 ? (
                applications.map((app) => (
                  <div key={app.id} className="bg-white border border-[#E5E8EB] rounded-3xl overflow-hidden shadow-sm">
                    {/* Upper */}
                    <div className="p-6 border-b border-[#E5E8EB] flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl p-2 bg-[#F3F5F8] rounded-2xl">🎓</span>
                        <div>
                          <h4 className="font-display font-bold text-base text-[#0B1C2C]">{app.universityName}</h4>
                          <p className="text-xs text-[#6A727D]">{app.program}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="flex flex-col md:items-end">
                          <span className="text-[10px] text-[#6A727D] uppercase font-bold tracking-wider">Topshirilgan Sana</span>
                          <span className="text-xs font-mono font-bold text-[#0B1C2C]">{app.date}</span>
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                          app.status.includes('Ko\'rib') ? 'bg-[#D6B174]/10 text-[#D6B174]' :
                          app.status.includes('Tasdiq') ? 'bg-[#1E9E5A]/10 text-[#1E9E5A]' : 'bg-[#E40016]/10 text-[#E40016]'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                    </div>

                    {/* Timeline History and Hujjatlar */}
                    <div className="p-6 bg-[#F7F9FA] grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Timeline status history */}
                      <div className="space-y-4">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-[#6A727D] mb-2">Ariza Tarixi</h5>
                        <div className="space-y-4 pl-3 relative border-l border-[#E5E8EB]">
                          {app.history.map((hist, idx) => (
                            <div key={idx} className="relative pl-4">
                              {/* Node Circle */}
                              <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-[#D6B174]"></div>
                              <div className="text-xs">
                                <span className="font-bold text-[#0B1C2C]">{hist.status}</span>
                                <span className="text-[10px] text-[#6A727D] ml-2 font-mono">{hist.date}</span>
                                <p className="text-[11px] text-[#6A727D] mt-0.5 leading-relaxed">{hist.note}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Documents attached */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-[#6A727D] mb-2">Hujjatlar</h5>
                        <div className="space-y-2.5">
                          {app.documents.map((doc, idx) => (
                            <a
                              key={idx}
                              href={doc.url ? `${doc.url}?auth=${encodeURIComponent(token || '')}` : undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between p-3 bg-white border border-[#E5E8EB] rounded-2xl text-xs hover:border-[#D6B174]/50 transition-colors"
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <FileText className="w-4.5 h-4.5 text-[#D6B174] shrink-0" />
                                <span className="font-semibold text-[#0B1C2C] truncate">{doc.type}</span>
                              </div>
                              <span className={`font-bold flex items-center gap-1 text-[11px] shrink-0 ${
                                doc.status === 'Tasdiqlangan' ? 'text-[#1E9E5A]' :
                                doc.status === 'Rad etilgan' ? 'text-[#E40016]' : 'text-[#D6B174]'
                              }`}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> {doc.status}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white border border-[#E5E8EB] rounded-3xl p-12 text-center text-[#6A727D]">
                  <FileText className="w-12 h-12 mx-auto text-[#D6B174] mb-3 stroke-[1.5]" />
                  <h4 className="font-display font-bold text-[#0B1C2C] text-sm mb-1">Arizalar mavjud emas</h4>
                  <p className="text-xs max-w-sm mx-auto mb-4">
                    Sizda hali topshirilgan arizalar mavjud emas. Universitetlardan birini tanlang va birinchi arizangizni boshlang!
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 5: PROFILE & DOCUMENTS */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fadeIn">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Profile details editor (8 cols) */}
              <div className="lg:col-span-8 bg-white border border-[#E5E8EB] p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#0B1C2C]">Shaxsiy Ma'lumotlarim</h3>
                  <p className="text-xs text-[#6A727D]">Profilingizni to'ldirib, o'zingizga mos ta'lim va grantlarni aniqlashtiring</p>
                </div>

                {profileSuccessMsg && (
                  <div className="p-3 bg-[#1E9E5A]/10 text-[#1E9E5A] rounded-xl text-xs font-semibold animate-fadeIn">
                    {profileSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  {/* General details group */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Ismingiz</label>
                      <input 
                        type="text" 
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Familiyangiz</label>
                      <input 
                        type="text" 
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Telefon raqamingiz</label>
                      <input 
                        type="tel" 
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Foydalanuvchi nomi</label>
                      <input 
                        type="text" 
                        value={user?.username}
                        disabled
                        className="w-full px-4 py-3 bg-white/5 border border-[#E5E8EB]/50 rounded-2xl text-xs text-[#6A727D] cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>

                  {/* Onboarding score details group */}
                  <div className="pt-4 border-t border-[#E5E8EB] space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1C2C]">Ta'lim va Byudjet o'lchovlari</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">Yillik Byudjet ($)</label>
                        <input 
                          type="number" 
                          placeholder="Yillik byudjetingiz"
                          value={editBudget}
                          onChange={(e) => setEditBudget(e.target.value)}
                          className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">IELTS Bali</label>
                        <input 
                          type="number" 
                          step="0.5"
                          placeholder="Masalan: 7.5"
                          value={editIelts}
                          onChange={(e) => setEditIelts(e.target.value)}
                          className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1.5">O'rtacha GPA ko'rsatkichi</label>
                        <input 
                          type="number" 
                          step="0.1"
                          placeholder="Masalan: 4.8"
                          value={editGpa}
                          onChange={(e) => setEditGpa(e.target.value)}
                          className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630] font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="bg-[#0B1C2C] text-[#D6B174] font-bold px-6 py-3 rounded-2xl text-xs hover:bg-[#B99056] hover:text-[#031222] transition-colors shadow-md"
                  >
                    Ma'lumotlarni saqlash
                  </button>
                </form>
              </div>

              {/* Documents box (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Document Uploader */}
                <div className="bg-white border border-[#E5E8EB] p-6 rounded-3xl shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6A727D]">Hujjat yuklash moduli</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#212630] mb-1">Hujjat turi</label>
                      <select 
                        value={uploadType} 
                        onChange={(e) => setUploadType(e.target.value)}
                        className="w-full px-3 py-2 bg-[#F3F5F8] border border-transparent rounded-xl text-xs focus:outline-none focus:border-[#D6B174] text-[#212630]"
                      >
                        <option value="Pasport">Pasport nushasi</option>
                        <option value="IELTS Sertifikati">IELTS / TOEFL</option>
                        <option value="Diplom / Attestat">Diplom va ilovasi</option>
                        <option value="Tavsiyanoma">Tavsiyanoma (Recommendation)</option>
                        <option value="Resume">Resume / CV</option>
                      </select>
                    </div>

                    {/* Standard upload triggers */}
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer border-2 border-dashed border-[#E5E8EB] hover:border-[#D6B174] rounded-2xl p-6 text-center transition-colors block">
                        <input 
                          type="file" 
                          accept="image/*,application/pdf"
                          onChange={handleFileUpload}
                          className="hidden" 
                          disabled={isUploading}
                        />
                        <Upload className="w-8 h-8 text-[#D6B174] mx-auto mb-2" />
                        <span className="text-xs font-bold text-[#0B1C2C] block">Fayl tanlang</span>
                        <span className="text-[10px] text-[#6A727D] mt-1 block">PDF yoki Rasm (Maks 15MB)</span>
                      </label>

                      {/* Camera capture trigger specifically requested for mobile compatibility */}
                      <button 
                        type="button"
                        onClick={triggerCameraMock}
                        className="w-full bg-[#F3F5F8] hover:bg-[#E5E8EB] text-[#0B1C2C] font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors border border-transparent"
                      >
                        <Camera className="w-4 h-4 text-[#D6B174]" />
                        <span>Kamera orqali rasmga olish</span>
                      </button>
                    </div>

                    {isUploading && (
                      <div className="p-2.5 bg-[#D6B174]/10 text-[#0B1C2C] border border-[#D6B174]/20 rounded-xl text-xs text-center animate-pulse">
                        Hujjat serverga yuklanmoqda...
                      </div>
                    )}
                  </div>
                </div>

                {/* List of uploaded documents */}
                <div className="bg-white border border-[#E5E8EB] p-6 rounded-3xl shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6A727D]">Hujjatlarim ({documents.length})</h4>
                  
                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto no-scrollbar">
                    {documents.map((doc, idx) => (
                      <div key={idx} className="p-3 bg-[#F7F9FA] border border-[#E5E8EB] rounded-2xl flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <FileText className="w-4.5 h-4.5 text-[#D6B174] shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-[#0B1C2C] block truncate">{doc.type}</span>
                            <span className="text-[9px] text-[#6A727D] font-mono block truncate">{doc.name} • {doc.size}</span>
                          </div>
                        </div>
                        <span className="text-[#1E9E5A] font-bold text-[10px] flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Tasdiqlangan
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preferences settings & notifications toggle */}
                <div className="bg-white border border-[#E5E8EB] p-6 rounded-3xl shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6A727D]">Bildirishnomalar Sozlamalari</h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span>Status o'zgarishi (Web Push)</span>
                      <button onClick={requestPushPermission} className="text-[#D6B174] font-bold hover:underline">
                        Yoqish
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Telegram orqali ogohlantirish</span>
                      <a href="https://t.me/Eduvisa_ai_bot" target="_blank" rel="noreferrer" className="text-[#D6B174] font-bold hover:underline flex items-center gap-1">
                        <span>Bot</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0B1C2C] text-white border-t border-white/5 flex items-center justify-around px-2 z-40">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'home' ? 'text-[#D6B174]' : 'text-[#6A727D]'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[9px]">Bosh sahifa</span>
        </button>

        <button 
          onClick={() => { setActiveTab('universities'); setSelectedCountry(null); }}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'universities' ? 'text-[#D6B174]' : 'text-[#6A727D]'
          }`}
        >
          <GraduationCap className="w-5 h-5 mb-0.5" />
          <span className="text-[9px]">Davlatlar</span>
        </button>

        <button 
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold transition-all relative ${
            activeTab === 'ai' ? 'text-[#D6B174]' : 'text-[#6A727D]'
          }`}
        >
          <div className="relative">
            <Bot className="w-5 h-5 mb-0.5" />
            <span className="absolute -top-1 -right-2.5 w-1.5 h-1.5 bg-[#D6B174] rounded-full"></span>
          </div>
          <span className="text-[9px]">AI</span>
        </button>

        <button 
          onClick={() => setActiveTab('applications')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'applications' ? 'text-[#D6B174]' : 'text-[#6A727D]'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[9px]">Arizalarim</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'profile' ? 'text-[#D6B174]' : 'text-[#6A727D]'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-[9px]">Profil</span>
        </button>
      </nav>

      {/* MODAL 1: UNIVERSITY DETAIL POPUP & APPLY */}
      {selectedUni && (
        <div className="fixed inset-0 bg-[#0B1C2C]/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-[#E5E8EB] max-h-[90vh] flex flex-col animate-scaleUp">
            
            {/* Header */}
            <div className="bg-[#0B1C2C] p-6 text-white flex justify-between items-start border-b border-white/5 shrink-0">
              <div className="flex items-center space-x-3.5">
                <span className="text-3xl p-2 bg-white/5 rounded-2xl block">{selectedUni.logo}</span>
                <div>
                  <h4 className="font-display font-semibold text-lg text-[#D6B174]">{selectedUni.name}</h4>
                  <p className="text-xs text-[#6A727D]">{selectedUni.country}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedUni(null);
                  setIsApplying(false);
                }}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-[#6A727D] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#F7F9FA]">
              
              {!isApplying ? (
                <>
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#6A727D]">Universitet Haqida</h5>
                    <p className="text-xs text-[#212630] leading-relaxed">
                      {selectedUni.description}
                    </p>
                  </div>

                  {/* Requirements & Budget Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-[#E5E8EB] p-4 rounded-2xl">
                      <span className="text-[10px] text-[#6A727D] uppercase font-bold tracking-wider">Yillik Ta'lim Narxi</span>
                      <p className="text-base font-bold font-mono text-[#0B1C2C] mt-1">
                        ${selectedUni.budget.toLocaleString()} / yil
                      </p>
                      <p className="text-[10px] text-[#6A727D] mt-0.5">Kontrakt to'lovlari yo'nalishga qarab farqlanishi mumkin.</p>
                    </div>

                    <div className="bg-white border border-[#E5E8EB] p-4 rounded-2xl">
                      <span className="text-[10px] text-[#6A727D] uppercase font-bold tracking-wider">Grant va Chegirmalar</span>
                      <p className="text-xs font-bold text-[#1E9E5A] mt-1">
                        {selectedUni.grantInfo}
                      </p>
                    </div>

                    <div className="bg-white border border-[#E5E8EB] p-4 rounded-2xl">
                      <span className="text-[10px] text-[#6A727D] uppercase font-bold tracking-wider">IELTS Talabi</span>
                      <p className="text-sm font-bold text-[#0B1C2C] mt-1">
                        IELTS {selectedUni.ielts} yoki undan yuqori
                      </p>
                    </div>

                    <div className="bg-white border border-[#E5E8EB] p-4 rounded-2xl">
                      <span className="text-[10px] text-[#6A727D] uppercase font-bold tracking-wider">GPA O'rtacha Baho Talabi</span>
                      <p className="text-sm font-bold text-[#0B1C2C] mt-1">
                        O'rtacha GPA: {selectedUni.gpa} (5.0 balldan)
                      </p>
                    </div>
                  </div>

                  {/* Program options available */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#6A727D]">Dasturlar & Yo'nalishlar</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedUni.programs.map((program, idx) => (
                        <span key={idx} className="bg-white border border-[#E5E8EB] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0B1C2C]">
                          {program}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <form onSubmit={handleApplySubmit} className="space-y-5">
                  {/* Step label */}
                  <div className="flex items-center gap-3 p-4 bg-[#0B1C2C]/5 rounded-2xl border border-[#0B1C2C]/10">
                    <div className="w-8 h-8 bg-[#D6B174] rounded-full flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4 text-[#031222]" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold font-display text-[#0B1C2C]">Ariza topshirish</h5>
                      <p className="text-[11px] text-[#6A727D]">Quyidagi yo'nalishlardan birini tanlang</p>
                    </div>
                  </div>

                  {/* Program cards */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6A727D]">
                      Ta'lim yo'nalishi <span className="text-[#E40016]">*</span>
                    </label>
                    <div className="space-y-2">
                      {selectedUni.programs.map((prog, idx) => (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            applyProgram === prog
                              ? 'border-[#D6B174] bg-[#D6B174]/8 ring-1 ring-[#D6B174]'
                              : 'border-[#E5E8EB] bg-white hover:border-[#D6B174]/50 hover:bg-[#F7F9FA]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="applyProgram"
                            value={prog}
                            checked={applyProgram === prog}
                            onChange={() => setApplyProgram(prog)}
                            className="accent-[#D6B174] w-4 h-4 shrink-0"
                          />
                          <span className="text-sm font-semibold text-[#0B1C2C]">{prog}</span>
                          {applyProgram === prog && (
                            <CheckCircle2 className="w-4 h-4 text-[#D6B174] ml-auto shrink-0" />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Ota-ona ma'lumotlari */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6A727D]">
                      Ota-ona ma'lumotlari <span className="text-[#E40016]">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input type="text" placeholder="Otasining F.I.Sh" value={applyFatherName} onChange={(e) => setApplyFatherName(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630]" />
                      <input type="tel" placeholder="Otasining telefoni" value={applyFatherPhone} onChange={(e) => setApplyFatherPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630] font-mono" />
                      <input type="text" placeholder="Onasining F.I.Sh" value={applyMotherName} onChange={(e) => setApplyMotherName(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630]" />
                      <input type="tel" placeholder="Onasining telefoni" value={applyMotherPhone} onChange={(e) => setApplyMotherPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630] font-mono" />
                    </div>
                  </div>

                  {/* Aloqa ma'lumotlari */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6A727D]">
                      Aloqa ma'lumotlari <span className="text-[#E40016]">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input type="email" placeholder="Email manzil" value={applyEmail} onChange={(e) => setApplyEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630]" />
                      <input type="tel" placeholder="Telefon raqamingiz" value={applyContactPhone} onChange={(e) => setApplyContactPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F3F5F8] border border-transparent rounded-2xl text-xs focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all text-[#212630] font-mono" />
                    </div>
                  </div>

                  {/* Hujjatlarni yuklash */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6A727D]">
                      Hujjatlar <span className="text-[#E40016]">*</span>
                    </label>
                    <div className="space-y-2">
                      {[
                        { label: 'Pasport nusxasi', file: applyPassportFile, set: setApplyPassportFile },
                        { label: '3x4 rasm', file: applyPhoto3x4File, set: setApplyPhoto3x4File },
                        { label: "Metrika (Tug'ilganlik guvohnomasi)", file: applyBirthCertFile, set: setApplyBirthCertFile },
                        { label: 'ID Karta', file: applyIdCardFile, set: setApplyIdCardFile },
                        { label: 'Zagran pasport', file: applyForeignPassportFile, set: setApplyForeignPassportFile },
                      ].map((item, idx) => (
                        <label key={idx} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                          item.file ? 'border-[#1E9E5A] bg-[#1E9E5A]/5' : 'border-[#E5E8EB] bg-white hover:border-[#D6B174]/50'
                        }`}>
                          <input type="file" accept="image/*,application/pdf" className="hidden"
                            onChange={(e) => item.set(e.target.files?.[0] || null)} />
                          {item.file ? <CheckCircle2 className="w-4 h-4 text-[#1E9E5A] shrink-0" /> : <Upload className="w-4 h-4 text-[#D6B174] shrink-0" />}
                          <span className="text-xs font-semibold text-[#0B1C2C] flex-1 truncate">{item.label}</span>
                          <span className="text-[10px] text-[#6A727D] truncate max-w-[90px]">{item.file ? item.file.name : 'Tanlang'}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {!applyProgram && (
                    <p className="text-[11px] text-[#E40016] font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Davom etish uchun yo'nalish tanlang
                    </p>
                  )}

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsApplying(false)}
                      className="flex-1 bg-white border border-[#E5E8EB] text-[#212630] py-3.5 rounded-2xl font-bold text-xs hover:bg-[#F3F5F8] transition-colors"
                    >
                      ← Orqaga
                    </button>
                    <button
                      type="submit"
                      disabled={!applyProgram || isSubmittingApp}
                      className="flex-1 bg-[#0B1C2C] text-[#D6B174] hover:bg-[#B99056] hover:text-[#031222] py-3.5 rounded-2xl font-bold text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSubmittingApp ? 'Yuborilmoqda...' : '✓ Ariza Yuborish'}
                    </button>
                  </div>
                </form>
              )}

            </div>

            {/* Footer triggers */}
            {!isApplying && (
              <div className="p-4 bg-[#F3F5F8] border-t border-[#E5E8EB] flex gap-3 shrink-0">
                <button 
                  onClick={() => toggleBookmark(selectedUni.id)}
                  className="flex-1 bg-white hover:bg-[#F3F5F8] border border-[#E5E8EB] font-bold text-[#0B1C2C] py-3.5 rounded-2xl text-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <Bookmark className={`w-4 h-4 ${bookmarks.includes(selectedUni.id) ? 'fill-[#D6B174] text-[#D6B174]' : ''}`} />
                  <span>{bookmarks.includes(selectedUni.id) ? 'Saqlangan' : 'Saqlab Qo\'yish'}</span>
                </button>
                <button 
                  onClick={() => {
                    resetApplyForm();
                    setApplyContactPhone(user?.phone || '');
                    setIsApplying(true);
                  }}
                  className="flex-1 bg-[#0B1C2C] text-[#D6B174] hover:bg-[#B99056] hover:text-[#031222] font-bold py-3.5 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center space-x-1.5"
                >
                  <span>Ariza topshirish</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* GLOBAL TOAST ALERT POPUP */}
      {toast && (
        <div className={`fixed bottom-20 lg:bottom-6 right-4 z-50 px-5 py-3.5 rounded-2xl text-xs font-bold flex items-center space-x-2.5 shadow-2xl animate-slideIn ${
          toast.type === 'success' ? 'bg-[#1E9E5A] text-white' :
          toast.type === 'error' ? 'bg-[#E40016] text-white' : 'bg-[#0B1C2C] text-[#D6B174] border border-[#D6B174]/20'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
}
