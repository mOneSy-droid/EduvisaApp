import React, { useState, useEffect } from 'react';
import logoImg from '../assets/images/eduvisa_logo_1782826587445.jpg';
import { 
  Users, 
  FileText, 
  ShieldCheck, 
  Search, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye, 
  LogOut, 
  ChevronRight, 
  UserCheck, 
  AlertCircle, 
  Filter, 
  Phone, 
  DollarSign, 
  Award,
  BookOpen,
  Calendar,
  Menu,
  X,
  User,
  Lock,
  GraduationCap,
  Plus,
  Globe,
  Trash2,
  ExternalLink,
  Building2
} from 'lucide-react';

interface Student {
  username: string;
  password?: string;
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
}

interface Application {
  id: string;
  universityId: string;
  universityName: string;
  universityCountry?: string;
  program: string;
  status: string;
  date: string;
  username: string;
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  contactEmail?: string;
  contactPhone?: string;
  history: { status: string; date: string; note: string }[];
  documents: { name: string; type: string; status: string; url?: string }[];
}

interface DocumentItem {
  id?: string | number;
  name: string;
  type: string;
  size: string;
  status: string;
  url: string;
  username: string;
}

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

interface AdminPanelProps {
  token: string;
  onLogout: () => void;
  apiFetch: (endpoint: string, options?: any) => Promise<any>;
}

// Country flag mapping
const COUNTRY_FLAGS: Record<string, string> = {
  'Buyuk Britaniya': '🇬🇧', 'Germaniya': '🇩🇪', 'Xitoy': '🇨🇳',
  'Janubiy Koreya': '🇰🇷', 'Avstraliya': '🇦🇺', 'Singapur': '🇸🇬',
  'AQSh': '🇺🇸', 'Yaponiya': '🇯🇵', 'Fransiya': '🇫🇷', 'Kanada': '🇨🇦',
  'Gollandiya': '🇳🇱', 'Shvetsiya': '🇸🇪', 'Italiya': '🇮🇹', 'Ispaniya': '🇪🇸',
  'Chexiya': '🇨🇿', 'Polsha': '🇵🇱', 'Avstriya': '🇦🇹', 'Shveytsariya': '🇨🇭',
};

const COUNTRY_CSS: Record<string, string> = {
  'Buyuk Britaniya': 'country-gb', 'Germaniya': 'country-de', 'Xitoy': 'country-cn',
  'Janubiy Koreya': 'country-kr', 'Avstraliya': 'country-au', 'Singapur': 'country-sg',
  'AQSh': 'country-us', 'Yaponiya': 'country-jp',
};

export default function AdminPanel({ token, onLogout, apiFetch }: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'students' | 'applications' | 'documents' | 'universities'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Search & Filter state
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [appSearch, setAppSearch] = useState<string>('');
  const [appFilterStatus, setAppFilterStatus] = useState<string>('all');
  const [docFilterStatus, setDocFilterStatus] = useState<string>('all');
  const [uniFilterCountry, setUniFilterCountry] = useState<string>('Barchasi');

  // Selected entities for modals / actions
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [appDetailUsername, setAppDetailUsername] = useState<string | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [showStudentPassword, setShowStudentPassword] = useState<boolean>(false);
  const [updatingApp, setUpdatingApp] = useState<Application | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // University Add Modal
  const [showAddUni, setShowAddUni] = useState<boolean>(false);
  const [addUniName, setAddUniName] = useState('');
  const [addUniCountry, setAddUniCountry] = useState('');
  const [addUniLogo, setAddUniLogo] = useState('🏫');
  const [addUniBudget, setAddUniBudget] = useState('');
  const [addUniIelts, setAddUniIelts] = useState('');
  const [addUniGpa, setAddUniGpa] = useState('');
  const [addUniGrant, setAddUniGrant] = useState('');
  const [addUniPrograms, setAddUniPrograms] = useState('Bakalavr');
  const [addUniDesc, setAddUniDesc] = useState('');
  const [addUniLoading, setAddUniLoading] = useState(false);
  const [uniToDelete, setUniToDelete] = useState<University | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load all admin data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [studentList, appList, docList] = await Promise.all([
        apiFetch('/api/admin/students'),
        apiFetch('/api/admin/applications'),
        apiFetch('/api/admin/documents')
      ]);
      setStudents(studentList);
      setApplications(appList);
      setDocuments(docList);

      // Load universities separately (non-fatal)
      try {
        const uniList = await apiFetch('/api/admin/universities');
        setUniversities(uniList);
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Admin data load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update Application status
  const handleUpdateAppStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingApp || !newStatus) return;
    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/admin/applications/${updatingApp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          note: statusNote || `Status o'zgartirildi: ${newStatus}`
        })
      });
      if (res.success) {
        setApplications(prev => prev.map(a => a.id === updatingApp.id
          ? { ...a, status: newStatus, history: [{ status: newStatus, date: new Date().toISOString().split('T')[0], note: statusNote || `Status o'zgartirildi` }, ...a.history] }
          : a
        ));
        setUpdatingApp(null);
        setNewStatus('');
        setStatusNote('');
        loadData(true);
      }
    } catch {
      showToast('Arizani yangilashda xatolik', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Document Status
  const handleUpdateDocStatus = async (username: string, docName: string, status: string) => {
    try {
      setRefreshing(true);
      const res = await apiFetch(`/api/admin/documents/${username}/${encodeURIComponent(docName)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (res.success) {
        setDocuments(prev => prev.map(d => d.username === username && d.name === docName ? { ...d, status } : d));
        loadData(true);
      }
    } catch {
      showToast('Hujjat holatini yangilashda xatolik', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Open document file properly (with auth token in query param — server supports it)
  const openDocFile = (url: string) => {
    if (!url) return;
    const separator = url.includes('?') ? '&' : '?';
    window.open(`${url}${separator}auth=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
  };

  // Add University
  const handleAddUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUniName.trim() || !addUniCountry.trim()) {
      showToast('Nomi va davlat kiritilishi shart', 'error');
      return;
    }
    try {
      setAddUniLoading(true);
      const programs = addUniPrograms.split(',').map(p => p.trim()).filter(Boolean);
      const res = await apiFetch('/api/admin/universities', {
        method: 'POST',
        body: JSON.stringify({
          name: addUniName,
          country: addUniCountry,
          logo: addUniLogo || COUNTRY_FLAGS[addUniCountry] || '🏫',
          budget: addUniBudget ? Number(addUniBudget) : 5000,
          ielts: addUniIelts ? Number(addUniIelts) : 0,
          gpa: addUniGpa ? Number(addUniGpa) : 0,
          grantInfo: addUniGrant,
          programs,
          description: addUniDesc
        })
      });
      if (res.success) {
        setUniversities(prev => [...prev, res.university]);
        showToast(`${res.university.name} muvaffaqiyatli qo'shildi!`);
        setShowAddUni(false);
        // Reset form
        setAddUniName(''); setAddUniCountry(''); setAddUniLogo('🏫');
        setAddUniBudget(''); setAddUniIelts(''); setAddUniGpa('');
        setAddUniGrant(''); setAddUniPrograms('Bakalavr'); setAddUniDesc('');
      }
    } catch {
      showToast("Universitetni qo'shishda xatolik", 'error');
    } finally {
      setAddUniLoading(false);
    }
  };

  // Delete University
  const handleDeleteUniversity = async (uni: University) => {
    try {
      await apiFetch(`/api/admin/universities/${uni.id}`, { method: 'DELETE' });
      setUniversities(prev => prev.filter(u => u.id !== uni.id));
      setUniToDelete(null);
      showToast(`${uni.name} o'chirildi`);
    } catch {
      showToast("O'chirishda xatolik", 'error');
    }
  };

  // Stats
  const totalStudents = students.length;
  const pendingApps = applications.filter(a => a.status.includes('Ko\'rib chiqilyapti') || a.status.includes('start')).length;
  const acceptedApps = applications.filter(a => a.status.includes('Tasdiqlangan') || a.status.includes('Qabul')).length;
  const pendingDocs = documents.filter(d => d.status === 'Yuklangan' || d.status === 'Kutilmoqda').length;
  const verifiedDocs = documents.filter(d => d.status === 'Tasdiqlangan').length;

  // Filtered
  const filteredStudents = students.filter(s => {
    const term = studentSearch.toLowerCase();
    return s.firstName.toLowerCase().includes(term) || s.lastName.toLowerCase().includes(term) ||
      s.phone.includes(term) || s.username.toLowerCase().includes(term);
  });

  const filteredApps = applications.filter(a => {
    const term = appSearch.toLowerCase();
    const student = students.find(s => s.username === a.username);
    const studentName = student ? `${student.firstName} ${student.lastName}` : '';
    const matchesSearch = a.universityName.toLowerCase().includes(term) ||
      a.program.toLowerCase().includes(term) || a.username.toLowerCase().includes(term) ||
      studentName.toLowerCase().includes(term);
    const matchesStatus =
      appFilterStatus === 'all' ? true :
      appFilterStatus === 'pending' ? (a.status.includes('Ko\'rib') || a.status.includes('start')) :
      appFilterStatus === 'accepted' ? (a.status.includes('Tasdiqlangan') || a.status.includes('Qabul')) :
      appFilterStatus === 'rejected' ? a.status.includes('Rad') : true;
    return matchesSearch && matchesStatus;
  });

  const appGroupMap = new Map<string, { username: string; apps: Application[] }>();
  filteredApps.forEach(app => {
    if (!appGroupMap.has(app.username)) appGroupMap.set(app.username, { username: app.username, apps: [] });
    appGroupMap.get(app.username)!.apps.push(app);
  });
  const studentAppGroups = Array.from(appGroupMap.values())
    .sort((a, b) => (b.apps[0]?.date || '').localeCompare(a.apps[0]?.date || ''));

  const filteredDocs = documents.filter(d => {
    return docFilterStatus === 'all' ? true :
      docFilterStatus === 'verified' ? d.status === 'Tasdiqlangan' :
      docFilterStatus === 'pending' ? (d.status === 'Yuklangan' || d.status === 'Kutilmoqda' || d.status === 'Yuborilgan') :
      docFilterStatus === 'rejected' ? d.status === 'Rad etilgan' : true;
  });

  const countriesInUni = Array.from(new Set(universities.map(u => u.country)));
  const filteredUniversities = uniFilterCountry === 'Barchasi' ? universities
    : universities.filter(u => u.country === uniFilterCountry);

  // ----- RENDER -----
  return (
    <div className="min-h-screen text-[#E8EDF2] font-sans flex flex-col lg:flex-row w-full" style={{ background: 'linear-gradient(135deg, #071320 0%, #0B1C2C 50%, #0D2236 100%)' }}>
      
      {/* ===== SIDEBAR ===== */}
      <aside className="w-full lg:w-72 flex flex-col lg:h-screen sticky top-0 shrink-0 z-20"
        style={{ background: 'linear-gradient(180deg, #071320 0%, #0B1C2C 100%)', borderRight: '1px solid rgba(214,177,116,0.1)' }}>
        
        {/* Logo Row */}
        <div className="p-4 lg:p-6 flex items-center justify-between lg:block border-b border-white/5">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="EDUVISA" className="h-9 w-9 object-contain rounded-xl shrink-0" referrerPolicy="no-referrer" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#D6B174] text-xl font-bold tracking-tight font-display">EDUVISA</span>
                <span className="text-[8px] bg-[#D6B174] text-[#031222] rounded px-1.5 py-0.5 uppercase tracking-widest font-bold">ADMIN</span>
              </div>
              <p className="text-[#4A6A8A] text-[9px] uppercase tracking-widest mt-0.5">Boshqaruv Markazi</p>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="bg-white/5 hover:bg-white/10 text-white/85 p-2 rounded-lg transition-colors border border-white/10">
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <button onClick={onLogout} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition-colors border border-red-500/20">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 px-3 py-2 space-y-0.5 lg:block ${mobileMenuOpen ? 'block pb-4' : 'hidden'}`}>
          {[
            { key: 'dashboard', label: 'Boshqaruv Paneli', Icon: Users },
            { key: 'students', label: 'Talabalar', Icon: UserCheck, badge: students.length },
            { key: 'applications', label: 'Arizalar', Icon: FileText, badge: pendingApps, badgeColor: 'bg-amber-500 text-[#031222]' },
            { key: 'documents', label: 'Hujjatlar', Icon: ShieldCheck, badge: pendingDocs, badgeColor: 'bg-blue-500 text-white' },
            { key: 'universities', label: 'Universitetlar', Icon: Building2, badge: universities.length },
          ].map(({ key, label, Icon, badge, badgeColor }) => (
            <button key={key}
              onClick={() => { setActiveSubTab(key as any); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                activeSubTab === key
                  ? 'text-white border-l-4 border-[#D6B174]'
                  : 'text-white/50 hover:text-white'
              }`}
              style={activeSubTab === key ? { background: 'rgba(214,177,116,0.08)' } : {}}
            >
              <Icon className="w-4 h-4 shrink-0 text-[#D6B174]" />
              <span className="flex-1 text-left">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeColor || 'bg-white/10 text-white'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Admin Identity */}
        <div className="hidden lg:flex p-5 border-t items-center gap-3" style={{ borderColor: 'rgba(214,177,116,0.1)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[#D6B174] font-bold text-xs shrink-0"
            style={{ background: 'rgba(214,177,116,0.15)', border: '1px solid rgba(214,177,116,0.3)' }}>ADM</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">Administrator</p>
            <p className="text-[10px] text-[#4A6A8A] truncate">admin@eduvisa.uz</p>
          </div>
          <button onClick={onLogout} className="text-[#4A6A8A] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ===== MAIN PANEL ===== */}
      <main className="flex-1 p-5 lg:p-8 overflow-y-auto lg:h-screen">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-7 gap-4">
          <div>
            <h1 className="text-lg lg:text-xl font-bold text-white font-display">
              {activeSubTab === 'dashboard' && 'EduVisa Boshqaruv Markazi'}
              {activeSubTab === 'students' && "Talabalar Ma'lumotlar Bazasi"}
              {activeSubTab === 'applications' && "Arizalar ro'yxati"}
              {activeSubTab === 'documents' && 'Hujjatlarni tekshirish'}
              {activeSubTab === 'universities' && 'Universitetlar boshqaruvi'}
            </h1>
            <p className="text-[#4A6A8A] text-xs mt-0.5">Haqiqiy vaqt rejimida boshqarish</p>
          </div>
          <div className="flex gap-2">
            {activeSubTab === 'universities' && (
              <button onClick={() => setShowAddUni(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'linear-gradient(135deg,#D6B174,#C49A52)', color: '#031222' }}>
                <Plus className="w-4 h-4" />
                <span>Universitet qo'shish</span>
              </button>
            )}
            <button onClick={() => loadData(true)} disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0"
              style={{ background: 'rgba(22,40,64,0.8)', border: '1px solid rgba(214,177,116,0.15)', color: '#D6B174' }}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Yangilash</span>
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-80">
            <RefreshCw className="w-10 h-10 text-[#D6B174] animate-spin mb-4" />
            <p className="text-[#4A6A8A] text-sm font-semibold">Yuklanmoqda...</p>
          </div>
        ) : (
          <>
            {/* ===== DASHBOARD ===== */}
            {activeSubTab === 'dashboard' && (
              <div className="space-y-7 animate-fadeIn">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Jami Talabalar', value: `${totalStudents} ta`, icon: Users, color: 'from-blue-600 to-blue-800', glow: 'rgba(59,130,246,0.2)' },
                    { label: "Ko'rib chiqilyapti", value: `${pendingApps} ta`, icon: FileText, color: 'from-amber-500 to-amber-700', glow: 'rgba(245,158,11,0.2)' },
                    { label: 'Tasdiqlanganlar', value: `${acceptedApps} ta`, icon: CheckCircle, color: 'from-emerald-500 to-emerald-700', glow: 'rgba(16,185,129,0.2)' },
                    { label: 'Kutilayotgan Hujjat', value: `${pendingDocs} ta`, icon: ShieldCheck, color: 'from-purple-500 to-purple-700', glow: 'rgba(139,92,246,0.2)' },
                  ].map(({ label, value, icon: Icon, color, glow }) => (
                    <div key={label} className="p-5 rounded-2xl flex items-center gap-4 transition-all hover:scale-[1.02]"
                      style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)', boxShadow: `0 4px 20px ${glow}` }}>
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider">{label}</p>
                        <h3 className="text-xl font-bold text-white mt-0.5">{value}</h3>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent Applications + Quick Stats */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-7">
                  <div className="xl:col-span-2 rounded-2xl overflow-hidden" style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                    <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(214,177,116,0.08)' }}>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">So'nggi Arizalar</h3>
                      <button onClick={() => setActiveSubTab('applications')} className="text-[#D6B174] text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all">
                        Barchasi <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      {applications.length === 0 ? (
                        <div className="p-8 text-center text-[#4A6A8A] text-xs">Arizalar mavjud emas</div>
                      ) : applications.slice(0, 5).map(app => {
                        const student = students.find(s => s.username === app.username);
                        return (
                          <div key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-white/3 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#D6B174] shrink-0"
                                style={{ background: 'rgba(214,177,116,0.1)', border: '1px solid rgba(214,177,116,0.2)' }}>
                                {student ? `${student.firstName[0]}${student.lastName[0]}` : '??'}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">{student ? `${student.firstName} ${student.lastName}` : app.username}</h4>
                                <p className="text-[10px] text-[#4A6A8A] mt-0.5 truncate">{app.universityName} — {app.program}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#4A6A8A] font-mono">{app.date}</span>
                              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                                app.status.includes('🟡') ? 'bg-amber-500/15 text-amber-400' :
                                app.status.includes('🟢') ? 'bg-emerald-500/15 text-emerald-400' :
                                'bg-red-500/15 text-red-400'
                              }`}>{app.status}</span>
                              <button onClick={() => { setUpdatingApp(app); setNewStatus(app.status); }}
                                className="text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-all text-[#D6B174] hover:bg-[#D6B174]/10"
                                style={{ border: '1px solid rgba(214,177,116,0.2)' }}>
                                Boshqarish
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick info */}
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl space-y-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-white">Hujjatlar Nazorati</h4>
                          <p className="text-[11px] text-[#4A6A8A] mt-1">Hozirda <strong className="text-white">{pendingDocs} ta</strong> hujjat tekshirilishi kutilmoqda.</p>
                          <button onClick={() => setActiveSubTab('documents')} className="text-[#D6B174] font-bold text-[10px] mt-2 block hover:underline">Hujjatlarni ko'rish →</button>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl space-y-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-white">Faol Arizalar</h4>
                          <p className="text-[11px] text-[#4A6A8A] mt-1"><strong className="text-white">{pendingApps} ta</strong> ariza ko'rib chiqilishi kutilmoqda.</p>
                          <button onClick={() => setActiveSubTab('applications')} className="text-[#D6B174] font-bold text-[10px] mt-2 block hover:underline">Arizalarni boshqarish →</button>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl" style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                      <h4 className="text-xs font-bold text-white mb-3">O'rtacha Ko'rsatkichlar</h4>
                      <div className="space-y-2 text-xs">
                        {[
                          { label: "IELTS O'rtacha", value: (students.filter(s => s.ielts_score).reduce((a, s) => a + (s.ielts_score || 0), 0) / (students.filter(s => s.ielts_score).length || 1)).toFixed(1) },
                          { label: "GPA O'rtacha", value: (students.filter(s => s.gpa).reduce((a, s) => a + (s.gpa || 0), 0) / (students.filter(s => s.gpa).length || 1)).toFixed(2) },
                          { label: "Universitetlar", value: `${universities.length} ta` },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between items-center">
                            <span className="text-[#4A6A8A]">{label}:</span>
                            <span className="font-bold font-mono text-white">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== STUDENTS ===== */}
            {activeSubTab === 'students' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between"
                  style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-[#4A6A8A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Talaba ismi, username yoki telefon..."
                      value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white placeholder:text-[#4A6A8A]"
                      style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.06)' }} />
                  </div>
                  <div className="text-xs text-[#4A6A8A] font-bold">Jami {filteredStudents.length} ta talaba</div>
                </div>

                {/* Mobile Cards */}
                <div className="block md:hidden space-y-3">
                  {filteredStudents.map(student => (
                    <div key={student.username} className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.08)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#D6B174] shrink-0"
                            style={{ background: 'rgba(214,177,116,0.1)', border: '1px solid rgba(214,177,116,0.2)' }}>
                            {student.firstName[0]}{student.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{student.firstName} {student.lastName}</h4>
                            <p className="text-[10px] text-[#4A6A8A] font-mono">@{student.username}</p>
                          </div>
                        </div>
                        <button onClick={() => { setSelectedStudent(student); setShowStudentPassword(false); }}
                          className="text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all text-[#D6B174]"
                          style={{ background: 'rgba(214,177,116,0.1)', border: '1px solid rgba(214,177,116,0.2)' }}>
                          Ko'rish
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl" style={{ background: 'rgba(11,28,44,0.5)' }}>
                        <div><span className="text-[#4A6A8A] block text-[9px] uppercase tracking-wider font-bold">Telefon</span><span className="font-mono text-white">{student.phone}</span></div>
                        <div><span className="text-[#4A6A8A] block text-[9px] uppercase tracking-wider font-bold">Byudjet</span><span className="font-bold text-emerald-400">{student.budget ? `$${student.budget.toLocaleString()}` : 'Bepul'}</span></div>
                        <div><span className="text-[#4A6A8A] block text-[9px] uppercase tracking-wider font-bold">IELTS</span>{student.ielts_score ? <span className="bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded text-[10px] font-mono mt-0.5 inline-block">{student.ielts_score}</span> : <span className="text-[#4A6A8A]">Yo'q</span>}</div>
                        <div><span className="text-[#4A6A8A] block text-[9px] uppercase tracking-wider font-bold">GPA</span>{student.gpa ? <span className="bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded text-[10px] font-mono mt-0.5 inline-block">{student.gpa}</span> : <span className="text-[#4A6A8A]">Yo'q</span>}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block rounded-2xl overflow-hidden" style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.08)' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="text-[#4A6A8A] text-[10px] font-bold uppercase tracking-wider" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {['F.I.SH', 'Username', 'Telefon', 'IELTS', 'GPA', 'Byudjet', 'Harakat'].map(h => (
                            <th key={h} className="py-4 px-5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.length === 0 ? (
                          <tr><td colSpan={7} className="py-8 text-center text-[#4A6A8A] text-xs">Talabalar topilmadi</td></tr>
                        ) : filteredStudents.map(student => (
                          <tr key={student.username} className="hover:bg-white/2 transition-colors text-xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#D6B174]"
                                  style={{ background: 'rgba(214,177,116,0.1)' }}>
                                  {student.firstName[0]}{student.lastName[0]}
                                </div>
                                <span className="font-bold text-white">{student.firstName} {student.lastName}</span>
                              </div>
                            </td>
                            <td className="py-4 px-5 font-mono text-[#4A6A8A]">@{student.username}</td>
                            <td className="py-4 px-5 font-mono text-white">{student.phone}</td>
                            <td className="py-4 px-5">{student.ielts_score ? <span className="bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded font-mono">{student.ielts_score}</span> : <span className="text-[#4A6A8A]">—</span>}</td>
                            <td className="py-4 px-5">{student.gpa ? <span className="bg-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded font-mono">{student.gpa}</span> : <span className="text-[#4A6A8A]">—</span>}</td>
                            <td className="py-4 px-5 font-mono text-emerald-400 font-bold">{student.budget ? `$${student.budget.toLocaleString()}` : 'Bepul'}</td>
                            <td className="py-4 px-5">
                              <button onClick={() => { setSelectedStudent(student); setShowStudentPassword(false); }}
                                className="text-[#D6B174] text-[10px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:bg-[#D6B174]/10"
                                style={{ border: '1px solid rgba(214,177,116,0.2)' }}>
                                <Eye className="w-3.5 h-3.5" /> Ko'rish
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== APPLICATIONS ===== */}
            {activeSubTab === 'applications' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between"
                  style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-[#4A6A8A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Talaba ismi, universitet yoki yo'nalish..."
                      value={appSearch} onChange={e => setAppSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white placeholder:text-[#4A6A8A]"
                      style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.06)' }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Filter className="w-4 h-4 text-[#4A6A8A]" />
                    {[
                      { key: 'all', label: 'Barchasi' }, { key: 'pending', label: "Ko'rib chiqilyapti" },
                      { key: 'accepted', label: 'Qabul qilinganlar' }, { key: 'rejected', label: 'Rad etilganlar' }
                    ].map(({ key, label }) => (
                      <button key={key} onClick={() => setAppFilterStatus(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${appFilterStatus === key ? 'text-white' : 'text-[#4A6A8A] hover:text-white'}`}
                        style={{ background: appFilterStatus === key ? 'rgba(214,177,116,0.2)' : 'rgba(22,40,64,0.5)', border: `1px solid ${appFilterStatus === key ? 'rgba(214,177,116,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {studentAppGroups.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl text-[#4A6A8A] text-xs"
                    style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.08)' }}>
                    Arizalar topilmadi
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studentAppGroups.map(group => {
                      const student = students.find(s => s.username === group.username);
                      const latestApp = group.apps[0];
                      const hasPending = group.apps.some(a => a.status.includes('🟡'));
                      const hasAccepted = group.apps.some(a => a.status.includes('🟢'));
                      return (
                        <button key={group.username} onClick={() => setAppDetailUsername(group.username)}
                          className="text-left p-5 rounded-2xl transition-all hover:scale-[1.01] space-y-3"
                          style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-[#D6B174] shrink-0"
                              style={{ background: 'rgba(214,177,116,0.1)', border: '1px solid rgba(214,177,116,0.2)' }}>
                              {student ? `${student.firstName[0]}${student.lastName[0]}` : '??'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white text-sm truncate">{student ? `${student.firstName} ${student.lastName}` : group.username}</p>
                              <p className="text-[10px] text-[#4A6A8A] font-mono">@{group.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <span className="text-[10px] font-bold text-[#4A6A8A]">{group.apps.length} ta ariza</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              hasPending ? 'bg-amber-500/15 text-amber-400' :
                              hasAccepted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                            }`}>{latestApp.status}</span>
                          </div>
                          <p className="text-[11px] text-[#4A6A8A] truncate">So'nggi: <span className="font-semibold text-white">{latestApp.universityName}</span></p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===== DOCUMENTS ===== */}
            {activeSubTab === 'documents' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="p-4 rounded-2xl flex items-center justify-between"
                  style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Filter className="w-4 h-4 text-[#4A6A8A]" />
                    {[
                      { key: 'all', label: 'Barcha Hujjatlar' }, { key: 'pending', label: 'Kutilayotganlar' },
                      { key: 'verified', label: 'Tasdiqlanganlar' }, { key: 'rejected', label: 'Rad etilganlar' }
                    ].map(({ key, label }) => (
                      <button key={key} onClick={() => setDocFilterStatus(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${docFilterStatus === key ? 'text-white' : 'text-[#4A6A8A] hover:text-white'}`}
                        style={{ background: docFilterStatus === key ? 'rgba(214,177,116,0.2)' : 'rgba(22,40,64,0.5)', border: `1px solid ${docFilterStatus === key ? 'rgba(214,177,116,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-[#4A6A8A] font-bold">{filteredDocs.length} ta hujjat</div>
                </div>

                {filteredDocs.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl text-[#4A6A8A] text-xs"
                    style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.08)' }}>
                    Hujjatlar topilmadi
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredDocs.map(doc => {
                      const student = students.find(s => s.username === doc.username);
                      const isImage = doc.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                      return (
                        <div key={`${doc.username}-${doc.name}`} className="p-5 rounded-2xl flex flex-col justify-between transition-all hover:scale-[1.01]"
                          style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="p-3 rounded-xl text-white font-bold text-xs"
                                style={{ background: isImage ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)', border: `1px solid ${isImage ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'}` }}>
                                {isImage ? '🖼️' : '📄'}
                              </div>
                              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                                doc.status === 'Tasdiqlangan' ? 'bg-emerald-500/15 text-emerald-400' :
                                doc.status === 'Rad etilgan' ? 'bg-red-500/15 text-red-400' :
                                'bg-amber-500/15 text-amber-400'
                              }`}>{doc.status}</span>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white line-clamp-1" title={doc.name}>{doc.name}</h4>
                              <p className="text-[10px] text-[#4A6A8A] mt-1">Tur: <strong className="text-white/70">{doc.type}</strong> ({doc.size})</p>
                            </div>
                            <div className="flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-[#D6B174]"
                                style={{ background: 'rgba(214,177,116,0.1)' }}>
                                {student ? `${student.firstName[0]}${student.lastName[0]}` : '??'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-white truncate">{student ? `${student.firstName} ${student.lastName}` : doc.username}</p>
                                <p className="text-[9px] text-[#4A6A8A]">@{doc.username}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <button
                              onClick={() => openDocFile(doc.url)}
                              className="flex-1 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 text-[#D6B174] hover:bg-[#D6B174]/10"
                              style={{ border: '1px solid rgba(214,177,116,0.2)' }}>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Faylni ko'rish</span>
                            </button>
                            {doc.status !== 'Tasdiqlangan' && (
                              <button onClick={() => handleUpdateDocStatus(doc.username, doc.name, 'Tasdiqlangan')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl transition-all" title="Tasdiqlash">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {doc.status !== 'Rad etilgan' && (
                              <button onClick={() => handleUpdateDocStatus(doc.username, doc.name, 'Rad etilgan')}
                                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl transition-all" title="Rad etish">
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===== UNIVERSITIES ===== */}
            {activeSubTab === 'universities' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Country filter */}
                <div className="p-4 rounded-2xl flex flex-wrap gap-2 items-center"
                  style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                  <Globe className="w-4 h-4 text-[#4A6A8A]" />
                  <span className="text-xs font-bold text-[#4A6A8A]">Davlat:</span>
                  {['Barchasi', ...countriesInUni].map(c => (
                    <button key={c as string} onClick={() => setUniFilterCountry(c as string)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${uniFilterCountry === c ? 'text-white' : 'text-[#4A6A8A] hover:text-white'}`}
                      style={{ background: uniFilterCountry === c ? 'rgba(214,177,116,0.2)' : 'rgba(22,40,64,0.5)', border: `1px solid ${uniFilterCountry === c ? 'rgba(214,177,116,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
                      {COUNTRY_FLAGS[c as string] || ''} {c as string}
                    </button>
                  ))}
                  <div className="ml-auto text-xs text-[#4A6A8A] font-bold">{filteredUniversities.length} ta universitet</div>
                </div>

                {filteredUniversities.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl text-[#4A6A8A] text-sm"
                    style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.08)' }}>
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Hali universitet qo'shilmagan. "Universitet qo'shish" tugmasini bosing.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredUniversities.map(uni => (
                      <div key={uni.id} className="p-5 rounded-2xl flex flex-col justify-between transition-all hover:scale-[1.01] group"
                        style={{ background: 'rgba(22,40,64,0.7)', border: '1px solid rgba(214,177,116,0.1)' }}>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <span className="text-3xl">{uni.logo}</span>
                            <button onClick={() => setUniToDelete(uni)}
                              className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <h4 className="font-display font-bold text-base text-white group-hover:text-[#D6B174] transition-colors line-clamp-1">{uni.name}</h4>
                            <p className="text-[11px] text-[#4A6A8A] mt-0.5">{COUNTRY_FLAGS[uni.country] || '🌍'} {uni.country}</p>
                          </div>
                          {uni.description && <p className="text-[11px] text-[#6A8AA8] leading-relaxed line-clamp-2">{uni.description}</p>}
                          <div className="flex flex-wrap gap-1.5">
                            {uni.programs.slice(0, 3).map(p => (
                              <span key={p} className="text-[9px] px-2 py-0.5 rounded-full font-bold text-[#D6B174]"
                                style={{ background: 'rgba(214,177,116,0.1)', border: '1px solid rgba(214,177,116,0.15)' }}>{p}</span>
                            ))}
                            {uni.programs.length > 3 && <span className="text-[9px] text-[#4A6A8A]">+{uni.programs.length - 3}</span>}
                          </div>
                        </div>
                        <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div>
                            <span className="text-[9px] text-[#4A6A8A] uppercase font-bold tracking-wide block">Yillik Byudjet</span>
                            <span className="text-sm font-bold font-mono text-white">${uni.budget.toLocaleString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-[#4A6A8A] uppercase font-bold tracking-wide block">IELTS Talab</span>
                            <span className="text-sm font-bold text-white">{uni.ielts > 0 ? uni.ielts + '+' : 'Shart emas'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== MODAL: Update Application Status ===== */}
      {updatingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0F2236', border: '1px solid rgba(214,177,116,0.2)' }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(214,177,116,0.1)' }}>
              <div>
                <h3 className="text-sm font-bold text-white">Arizani Boshqarish</h3>
                <p className="text-[11px] text-[#4A6A8A] mt-0.5">{updatingApp.universityName} — {updatingApp.program}</p>
              </div>
              <button onClick={() => setUpdatingApp(null)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-[#4A6A8A] hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateAppStatus} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-2">Ariza Holati</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "🟡 Ko'rib chiqilyapti", label: "🟡 Ko'rib chiqilyapti" },
                    { value: '🟢 Tasdiqlangan / Qabul qilingan', label: '🟢 Qabul qilindi' },
                    { value: '🔴 Rad etilgan', label: '🔴 Rad etildi' }
                  ].map(item => (
                    <button type="button" key={item.value} onClick={() => setNewStatus(item.value)}
                      className={`py-2.5 px-3 text-[11px] font-semibold rounded-xl text-center transition-all ${
                        newStatus === item.value ? 'text-white' : 'text-[#4A6A8A] hover:text-white'
                      }`}
                      style={{ border: `1px solid ${newStatus === item.value ? 'rgba(214,177,116,0.4)' : 'rgba(255,255,255,0.06)'}`, background: newStatus === item.value ? 'rgba(214,177,116,0.1)' : 'rgba(11,28,44,0.5)' }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-2">Izoh</label>
                <textarea rows={3} placeholder="Masalan: Universitetdan rasmiy taklifnoma keldi!"
                  value={statusNote} onChange={e => setStatusNote(e.target.value)}
                  className="w-full p-3 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white placeholder:text-[#4A6A8A]"
                  style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.06)' }} />
              </div>
              {/* History */}
              <div>
                <p className="text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-2">Tarix Yo'li</p>
                <div className="max-h-28 overflow-y-auto space-y-2 p-3 rounded-xl" style={{ background: 'rgba(11,28,44,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {updatingApp.history.map((h, i) => (
                    <div key={i} className="text-[10px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                      <div className="flex justify-between font-bold text-white">
                        <span>{h.status}</span>
                        <span className="font-mono text-[9px] text-[#4A6A8A]">{h.date}</span>
                      </div>
                      <p className="text-[#4A6A8A] mt-0.5">{h.note}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button type="button" onClick={() => setUpdatingApp(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-[#4A6A8A] hover:text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(22,40,64,0.5)' }}>
                  Bekor qilish
                </button>
                <button type="submit" disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-[#031222] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#D6B174,#C49A52)' }}>
                  {actionLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL: App Detail (Student Applications) ===== */}
      {appDetailUsername && (() => {
        const student = students.find(s => s.username === appDetailUsername);
        const studentApps = applications.filter(a => a.username === appDetailUsername);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ background: '#0F2236', border: '1px solid rgba(214,177,116,0.2)' }}>
              <div className="p-5 flex items-center justify-between shrink-0" style={{ background: 'rgba(11,28,44,0.9)', borderBottom: '1px solid rgba(214,177,116,0.1)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#D6B174] font-bold text-sm shrink-0"
                    style={{ background: 'rgba(214,177,116,0.15)', border: '1px solid rgba(214,177,116,0.3)' }}>
                    {student ? `${student.firstName[0]}${student.lastName[0]}` : '??'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{student ? `${student.firstName} ${student.lastName}` : appDetailUsername}</h3>
                    <p className="text-[10px] text-[#4A6A8A]">@{appDetailUsername} — {studentApps.length} ta ariza</p>
                  </div>
                </div>
                <button onClick={() => { setAppDetailUsername(null); setExpandedAppId(null); }}
                  className="p-1.5 hover:bg-white/5 text-[#4A6A8A] hover:text-white rounded-lg transition-colors shrink-0">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3 overflow-y-auto">
                {studentApps.map(app => {
                  const isOpen = expandedAppId === app.id;
                  return (
                    <div key={app.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={() => setExpandedAppId(isOpen ? null : app.id)}
                        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-white/3 transition-colors text-left"
                        style={{ background: 'rgba(22,40,64,0.5)' }}>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{app.universityName}{app.universityCountry ? ` — ${app.universityCountry}` : ''}</p>
                          <p className="text-[11px] text-[#4A6A8A]">{app.program} · {app.date}</p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          app.status.includes('🟡') ? 'bg-amber-500/15 text-amber-400' :
                          app.status.includes('🟢') ? 'bg-emerald-500/15 text-emerald-400' :
                          'bg-red-500/15 text-red-400'
                        }`}>{app.status}</span>
                      </button>
                      {isOpen && (
                        <div className="p-4 space-y-4" style={{ background: 'rgba(11,28,44,0.4)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {[
                              { label: 'Otasi', val: app.fatherName, sub: app.fatherPhone },
                              { label: 'Onasi', val: app.motherName, sub: app.motherPhone },
                              { label: 'Email', val: app.contactEmail },
                              { label: 'Telefon', val: app.contactPhone },
                            ].map(({ label, val, sub }) => (
                              <div key={label} className="p-3 rounded-xl" style={{ background: 'rgba(22,40,64,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="text-[9px] font-bold text-[#4A6A8A] uppercase tracking-wider block mb-1">{label}</span>
                                <p className="font-semibold text-white">{val || 'Kiritilmagan'}</p>
                                {sub && <p className="font-mono text-[#4A6A8A] text-[10px]">{sub}</p>}
                              </div>
                            ))}
                          </div>
                          {/* Documents */}
                          <div>
                            <span className="text-[9px] font-bold text-[#4A6A8A] uppercase tracking-wider block mb-2">Yuklangan hujjatlar</span>
                            {app.documents.length === 0 ? (
                              <p className="text-[11px] text-[#4A6A8A] italic">Hujjat yuklanmagan</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {app.documents.map((doc, idx) => (
                                  <button key={idx} onClick={() => doc.url && openDocFile(doc.url)}
                                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl text-[11px] font-semibold text-white hover:bg-[#D6B174]/10 transition-colors text-left"
                                    style={{ border: '1px solid rgba(214,177,116,0.15)', background: 'rgba(22,40,64,0.6)' }}>
                                    <span className="truncate">{doc.type}</span>
                                    <Eye className="w-3.5 h-3.5 text-[#4A6A8A] shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button onClick={() => { setUpdatingApp(app); setNewStatus(app.status); }}
                            className="w-full py-2.5 rounded-xl text-xs font-bold transition-all text-[#031222]"
                            style={{ background: 'linear-gradient(135deg,#D6B174,#C49A52)' }}>
                            Ariza holatini boshqarish
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="p-5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => { setAppDetailUsername(null); setExpandedAppId(null); }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-[#4A6A8A] hover:text-white transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(22,40,64,0.5)' }}>
                  Yopish
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== MODAL: Student Profile ===== */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ background: '#0F2236', border: '1px solid rgba(214,177,116,0.2)' }}>
            <div className="p-5 flex items-center justify-between" style={{ background: 'rgba(11,28,44,0.9)', borderBottom: '1px solid rgba(214,177,116,0.1)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#D6B174] font-bold text-sm"
                  style={{ background: 'rgba(214,177,116,0.15)', border: '1px solid rgba(214,177,116,0.3)' }}>
                  {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                  <p className="text-[10px] text-[#4A6A8A]">Talaba profili va hujjatlari</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="p-1.5 hover:bg-white/5 text-[#4A6A8A] hover:text-white rounded-lg transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'IELTS', value: selectedStudent.ielts_score ? String(selectedStudent.ielts_score) : "Yo'q" },
                  { label: 'GPA', value: selectedStudent.gpa ? String(selectedStudent.gpa) : "Yo'q" },
                  { label: 'Byudjet', value: selectedStudent.budget ? `$${selectedStudent.budget.toLocaleString()}` : 'Bepul' },
                  { label: 'Tizim ID', value: `@${selectedStudent.username}` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-xl text-center" style={{ background: 'rgba(22,40,64,0.6)', border: '1px solid rgba(214,177,116,0.08)' }}>
                    <span className="text-[9px] font-bold text-[#4A6A8A] uppercase tracking-wider">{label}</span>
                    <p className="text-sm font-bold text-white mt-1 font-mono truncate">{value}</p>
                  </div>
                ))}
              </div>
              {/* Contact info */}
              <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(22,40,64,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Bog'lanish Ma'lumotlari</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#4A6A8A]" /><span className="text-[#4A6A8A]">Telefon:</span><span className="font-mono text-white">{selectedStudent.phone}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#4A6A8A]" /><span className="text-[#4A6A8A]">Telegram:</span><span className="font-mono text-white">{selectedStudent.telegram_chat_id || 'Ulanmagan'}</span></div>
                  <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#4A6A8A]" /><span className="text-[#4A6A8A]">IP:</span><span className="font-mono text-white">{selectedStudent.last_login_ip || 'Noaniq'}</span></div>
                </div>
              </div>
              {/* Credentials */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider pb-2 mb-3" style={{ borderBottom: '1px solid rgba(245,158,11,0.1)' }}>Kirish Ma'lumotlari (faqat admin)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2"><User className="w-4 h-4 text-[#4A6A8A]" /><span className="text-[#4A6A8A]">Username:</span><span className="font-mono text-white">{selectedStudent.username}</span></div>
                  <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-[#4A6A8A]" /><span className="text-[#4A6A8A]">Parol:</span>
                    <span className="font-mono text-white">{showStudentPassword ? (selectedStudent.password || "Noma'lum") : '••••••••'}</span>
                    <button type="button" onClick={() => setShowStudentPassword(v => !v)} className="text-[10px] font-bold text-amber-400 hover:underline ml-1">{showStudentPassword ? 'Yashirish' : "Ko'rsatish"}</button>
                  </div>
                </div>
              </div>
              {/* Student Apps */}
              <div>
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider pb-2 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Talabaning Arizalari</h4>
                <div className="space-y-2">
                  {applications.filter(a => a.username === selectedStudent.username).length === 0 ? (
                    <p className="text-xs text-[#4A6A8A] italic">Faol arizalar mavjud emas</p>
                  ) : applications.filter(a => a.username === selectedStudent.username).map(app => (
                    <div key={app.id} className="p-3 rounded-xl flex items-center justify-between text-xs" style={{ background: 'rgba(22,40,64,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div><p className="font-bold text-white">{app.universityName}</p><p className="text-[10px] text-[#4A6A8A] mt-0.5">{app.program}</p></div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${app.status.includes('🟡') ? 'bg-amber-500/15 text-amber-400' : app.status.includes('🟢') ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{app.status}</span>
                        <span className="text-[10px] text-[#4A6A8A] font-mono">{app.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Docs */}
              <div>
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider pb-2 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Yuklangan Hujjatlar</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {documents.filter(d => d.username === selectedStudent.username).length === 0 ? (
                    <p className="text-xs text-[#4A6A8A] italic col-span-2">Yuklangan hujjatlar mavjud emas</p>
                  ) : documents.filter(d => d.username === selectedStudent.username).map(doc => (
                    <div key={doc.name} className="p-3 rounded-xl flex flex-col justify-between text-xs" style={{ background: 'rgba(22,40,64,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-white truncate max-w-[130px]" title={doc.name}>{doc.name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${doc.status === 'Tasdiqlangan' ? 'bg-emerald-500/15 text-emerald-400' : doc.status === 'Rad etilgan' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{doc.status}</span>
                      </div>
                      <p className="text-[9px] text-[#4A6A8A]">Tur: {doc.type} ({doc.size})</p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => openDocFile(doc.url)}
                          className="flex-1 text-center py-1.5 rounded-lg text-[9px] font-bold text-[#D6B174] hover:bg-[#D6B174]/10 transition-colors"
                          style={{ border: '1px solid rgba(214,177,116,0.2)' }}>
                          Ko'rish
                        </button>
                        {doc.status !== 'Tasdiqlangan' && (
                          <button onClick={() => handleUpdateDocStatus(doc.username, doc.name, 'Tasdiqlangan')}
                            className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold">
                            Tasdiqlash
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setSelectedStudent(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-[#4A6A8A] hover:text-white transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(22,40,64,0.5)' }}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: Add University ===== */}
      {showAddUni && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ background: '#0F2236', border: '1px solid rgba(214,177,116,0.2)' }}>
            <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(214,177,116,0.1)' }}>
              <div>
                <h3 className="text-sm font-bold text-white">Yangi Universitet Qo'shish</h3>
                <p className="text-[11px] text-[#4A6A8A] mt-0.5">Davlat tanlang va universitet ma'lumotlarini kiriting</p>
              </div>
              <button onClick={() => setShowAddUni(false)} className="p-1.5 hover:bg-white/5 text-[#4A6A8A] hover:text-white rounded-lg transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUniversity} className="p-5 space-y-3 overflow-y-auto">
              {/* Country select */}
              <div>
                <label className="block text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-1.5">Davlat <span className="text-red-400">*</span></label>
                <select value={addUniCountry} onChange={e => { setAddUniCountry(e.target.value); setAddUniLogo(COUNTRY_FLAGS[e.target.value] || '🏫'); }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white"
                  style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} required>
                  <option value="">Davlat tanlang...</option>
                  {['Buyuk Britaniya','Germaniya','Xitoy','Janubiy Koreya','Avstraliya','Singapur','AQSh','Yaponiya','Fransiya','Kanada','Gollandiya','Shvetsiya','Italiya','Ispaniya','Chexiya','Polsha','Avstriya','Shveytsariya','Qozog\'iston','Rossiya','Turkiya','UAE','Boshqa'].map(c => (
                    <option key={c} value={c}>{COUNTRY_FLAGS[c] || '🌍'} {c}</option>
                  ))}
                </select>
              </div>
              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-1.5">Universitet nomi <span className="text-red-400">*</span></label>
                <input type="text" placeholder="Masalan: Seoul National University" value={addUniName} onChange={e => setAddUniName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white placeholder:text-[#4A6A8A]"
                  style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} required />
              </div>
              {/* Budget + IELTS + GPA */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Yillik Byudjet ($)', placeholder: '5000', val: addUniBudget, set: setAddUniBudget, type: 'number' },
                  { label: 'IELTS Talab', placeholder: '6.5', val: addUniIelts, set: setAddUniIelts, type: 'number' },
                  { label: "GPA O'rtacha", placeholder: '3.5', val: addUniGpa, set: setAddUniGpa, type: 'number' },
                ].map(({ label, placeholder, val, set, type }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-1.5">{label}</label>
                    <input type={type} placeholder={placeholder} value={val} onChange={e => set(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white placeholder:text-[#4A6A8A] font-mono"
                      style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  </div>
                ))}
              </div>
              {/* Grant info */}
              <div>
                <label className="block text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-1.5">Grant ma'lumoti</label>
                <input type="text" placeholder="Masalan: 50% stipendiya mavjud" value={addUniGrant} onChange={e => setAddUniGrant(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white placeholder:text-[#4A6A8A]"
                  style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              {/* Programs */}
              <div>
                <label className="block text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-1.5">Yo'nalishlar (vergul bilan ajrating)</label>
                <input type="text" placeholder="Bakalavr, Magistr, IT, Tibbiyot" value={addUniPrograms} onChange={e => setAddUniPrograms(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white placeholder:text-[#4A6A8A]"
                  style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-[#4A6A8A] uppercase tracking-wider mb-1.5">Tavsif</label>
                <textarea rows={2} placeholder="Universitet haqida qisqacha ma'lumot..." value={addUniDesc} onChange={e => setAddUniDesc(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all text-white placeholder:text-[#4A6A8A]"
                  style={{ background: 'rgba(11,28,44,0.8)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>

              <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button type="button" onClick={() => setShowAddUni(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#4A6A8A] hover:text-white transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(22,40,64,0.5)' }}>
                  Bekor qilish
                </button>
                <button type="submit" disabled={addUniLoading}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-[#031222] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#D6B174,#C49A52)' }}>
                  {addUniLoading ? "Qo'shilmoqda..." : "✓ Qo'shish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL: Delete University Confirm ===== */}
      {uniToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: '#0F2236', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-red-400" /></div>
              <div>
                <h3 className="text-sm font-bold text-white">Universitetni o'chirish</h3>
                <p className="text-[11px] text-[#4A6A8A] mt-0.5">{uniToDelete.name}</p>
              </div>
            </div>
            <p className="text-xs text-[#6A8AA8]">Bu amalni ortga qaytarib bo'lmaydi. Rostan o'chirishni xohlaysizmi?</p>
            <div className="flex gap-2">
              <button onClick={() => setUniToDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#4A6A8A] hover:text-white transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(22,40,64,0.5)' }}>
                Bekor qilish
              </button>
              <button onClick={() => handleDeleteUniversity(uniToDelete)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all">
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TOAST ===== */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-2xl text-xs font-bold shadow-2xl animate-slideIn flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
