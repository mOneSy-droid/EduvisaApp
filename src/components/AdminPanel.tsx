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
  MessageSquare, 
  Phone, 
  DollarSign, 
  Award,
  BookOpen,
  Calendar,
  Menu,
  X,
  User,
  Lock
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
  name: string;
  type: string;
  size: string;
  status: string;
  url: string;
  username: string;
}

interface AdminPanelProps {
  token: string;
  onLogout: () => void;
  apiFetch: (endpoint: string, options?: any) => Promise<any>;
}

export default function AdminPanel({ token, onLogout, apiFetch }: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'students' | 'applications' | 'documents'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Search & Filter state
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [appSearch, setAppSearch] = useState<string>('');
  const [appFilterStatus, setAppFilterStatus] = useState<string>('all');
  const [docFilterStatus, setDocFilterStatus] = useState<string>('all');

  // Selected entities for modals / actions
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [appDetailUsername, setAppDetailUsername] = useState<string | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [showStudentPassword, setShowStudentPassword] = useState<boolean>(false);
  const [updatingApp, setUpdatingApp] = useState<Application | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

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
        // Update local state
        setApplications(prev => prev.map(a => a.id === updatingApp.id ? { ...a, status: newStatus, history: [ { status: newStatus, date: new Date().toISOString().split('T')[0], note: statusNote || `Status o'zgartirildi` }, ...a.history ] } : a));
        setUpdatingApp(null);
        setNewStatus('');
        setStatusNote('');
        loadData(true); // Silent reload to stay in sync
      }
    } catch (err) {
      alert('Arizani yangilashda xatolik yuz berdi');
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
    } catch (err) {
      alert('Hujjat holatini yangilashda xatolik yuz berdi');
    } finally {
      setRefreshing(false);
    }
  };

  // Stats calculation
  const totalStudents = students.length;
  const pendingApps = applications.filter(a => a.status.includes('Ko\'rib chiqilyapti') || a.status.includes('start')).length;
  const acceptedApps = applications.filter(a => a.status.includes('Tasdiqlangan') || a.status.includes('Qabul')).length;
  const rejectedApps = applications.filter(a => a.status.includes('Rad')).length;
  const verifiedDocs = documents.filter(d => d.status === 'Tasdiqlangan').length;
  const pendingDocs = documents.filter(d => d.status === 'Yuklangan' || d.status === 'Kutilmoqda').length;

  // Filtered lists
  const filteredStudents = students.filter(s => {
    const term = studentSearch.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(term) ||
      s.lastName.toLowerCase().includes(term) ||
      s.phone.includes(term) ||
      s.username.toLowerCase().includes(term)
    );
  });

  const filteredApps = applications.filter(a => {
    const term = appSearch.toLowerCase();
    const student = students.find(s => s.username === a.username);
    const studentName = student ? `${student.firstName} ${student.lastName}` : '';
    const matchesSearch = 
      a.universityName.toLowerCase().includes(term) ||
      a.program.toLowerCase().includes(term) ||
      a.username.toLowerCase().includes(term) ||
      studentName.toLowerCase().includes(term);

    const matchesStatus = 
      appFilterStatus === 'all' ? true :
      appFilterStatus === 'pending' ? (a.status.includes('Ko\'rib') || a.status.includes('start')) :
      appFilterStatus === 'accepted' ? (a.status.includes('Tasdiqlangan') || a.status.includes('Qabul')) :
      appFilterStatus === 'rejected' ? a.status.includes('Rad') : true;

    return matchesSearch && matchesStatus;
  });

  // Arizalarni talaba (username) bo'yicha guruhlash — har bir talaba uchun 1 karta
  const appGroupMap = new Map<string, { username: string; apps: Application[] }>();
  filteredApps.forEach(app => {
    if (!appGroupMap.has(app.username)) {
      appGroupMap.set(app.username, { username: app.username, apps: [] });
    }
    appGroupMap.get(app.username)!.apps.push(app);
  });
  const studentAppGroups = Array.from(appGroupMap.values())
    .sort((a, b) => (b.apps[0]?.date || '').localeCompare(a.apps[0]?.date || ''));

  const filteredDocs = documents.filter(d => {
    const matchesStatus = 
      docFilterStatus === 'all' ? true :
      docFilterStatus === 'verified' ? d.status === 'Tasdiqlangan' :
      docFilterStatus === 'pending' ? (d.status === 'Yuklangan' || d.status === 'Kutilmoqda' || d.status === 'Yuborilgan') :
      docFilterStatus === 'rejected' ? d.status === 'Rad etilgan' : true;
    return matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#212630] font-sans flex flex-col lg:flex-row w-full">
      {/* Sidebar - Admin Navigation */}
      <aside className="w-full lg:w-72 bg-[#0B1C2C] text-white flex flex-col lg:h-screen sticky top-0 border-r border-white/5 shrink-0 z-20">
        <div className="p-4 lg:p-8 flex items-center justify-between lg:block border-b lg:border-b-0 border-white/5">
          <div className="flex items-center space-x-3">
            <img src={logoImg} alt="EDUVISA Logo" className="h-9 w-9 object-contain rounded-lg shrink-0" referrerPolicy="no-referrer" />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[#D6B174] text-xl font-bold tracking-tight font-display">EDUVISA</span>
                <span className="text-[9px] bg-[#D6B174] text-[#031222] rounded px-1.5 py-0.5 uppercase tracking-widest font-bold">ADMIN</span>
              </div>
              <p className="text-[#6A727D] text-[9px] lg:text-[10px] uppercase tracking-widest mt-0.5">Hujjatlar va Arizalar Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 lg:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="bg-white/5 hover:bg-white/10 text-white/85 p-2 rounded-lg transition-colors flex items-center justify-center border border-white/10"
              aria-label="Menyuni ochish/yopish"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <button 
              onClick={onLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition-colors flex items-center justify-center border border-red-500/20"
              title="Chiqish"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 px-4 py-2 space-y-1 lg:block ${mobileMenuOpen ? 'block pb-4' : 'hidden'}`}>
          <button 
            onClick={() => {
              setActiveSubTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
              activeSubTab === 'dashboard' ? 'bg-[#D6B174]/10 text-white border-l-4 border-[#D6B174]' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 shrink-0 text-[#D6B174]" />
            <span>Boshqaruv Paneli</span>
          </button>

          <button 
            onClick={() => {
              setActiveSubTab('students');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
              activeSubTab === 'students' ? 'bg-[#D6B174]/10 text-white border-l-4 border-[#D6B174]' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0 text-[#D6B174]" />
            <span className="flex-1 text-left">Talabalar</span>
            <span className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">{students.length}</span>
          </button>

          <button 
            onClick={() => {
              setActiveSubTab('applications');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
              activeSubTab === 'applications' ? 'bg-[#D6B174]/10 text-white border-l-4 border-[#D6B174]' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0 text-[#D6B174]" />
            <span className="flex-1 text-left">Arizalar</span>
            {pendingApps > 0 && (
              <span className="bg-amber-500 text-[#031222] text-[10px] px-2 py-0.5 rounded-full font-bold">{pendingApps}</span>
            )}
          </button>

          <button 
            onClick={() => {
              setActiveSubTab('documents');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
              activeSubTab === 'documents' ? 'bg-[#D6B174]/10 text-white border-l-4 border-[#D6B174]' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#D6B174]" />
            <span className="flex-1 text-left">Hujjatlar</span>
            {pendingDocs > 0 && (
              <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">{pendingDocs}</span>
            )}
          </button>
        </nav>

        {/* Admin Mini Identity (Desktop) */}
        <div className="hidden lg:flex p-6 border-t border-white/5 items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#D6B174]/15 border border-[#D6B174]/30 flex items-center justify-center text-[#D6B174] font-bold text-sm">
            ADM
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">Administrator</p>
            <p className="text-[10px] text-[#6A727D] truncate">admin@eduvisa.uz</p>
          </div>
          <button 
            onClick={onLogout} 
            className="text-[#6A727D] hover:text-red-400 transition-colors p-1.5 hover:bg-white/5 rounded-lg"
            title="Tizimdan chiqish"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Panel Body */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto lg:h-screen">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-[#0B1C2C] font-display">
              {activeSubTab === 'dashboard' && 'EduVisa Administrator Boshqaruv Markazi'}
              {activeSubTab === 'students' && 'Talabalar Ma\'lumotlar Bazasi'}
              {activeSubTab === 'applications' && 'Arizalar ro\'yxati va statuslari'}
              {activeSubTab === 'documents' && 'Hujjatlarni tekshirish va tasdiqlash'}
            </h1>
            <p className="text-[#6A727D] text-xs lg:text-sm mt-0.5">
              Haqiqiy vaqt rejimida talaba va arizalar holatini boshqaring
            </p>
          </div>
          <button 
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-[#E5E8EB] bg-white rounded-xl text-xs font-bold hover:bg-[#F3F5F8] transition-all disabled:opacity-50 shrink-0 self-start sm:self-center shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6A727D] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Yangilash</span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96">
            <RefreshCw className="w-10 h-10 text-[#D6B174] animate-spin mb-4" />
            <p className="text-[#6A727D] text-sm font-semibold">Tizim ma'lumotlari yuklanmoqda...</p>
          </div>
        ) : (
          <>
            {/* Dashboard Subtab */}
            {activeSubTab === 'dashboard' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Stats cards bento grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="bg-white border border-[#E5E8EB] p-6 rounded-2xl shadow-sm flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#6A727D] uppercase tracking-wider">Jami Talabalar</p>
                      <h3 className="text-2xl font-bold text-[#0B1C2C] mt-1">{totalStudents} ta</h3>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E5E8EB] p-6 rounded-2xl shadow-sm flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#6A727D] uppercase tracking-wider">Kutilayotgan Arizalar</p>
                      <h3 className="text-2xl font-bold text-[#0B1C2C] mt-1">{pendingApps} ta</h3>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E5E8EB] p-6 rounded-2xl shadow-sm flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#6A727D] uppercase tracking-wider">Tasdiqlanganlar</p>
                      <h3 className="text-2xl font-bold text-[#0B1C2C] mt-1">{acceptedApps} ta</h3>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E5E8EB] p-6 rounded-2xl shadow-sm flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#6A727D] uppercase tracking-wider">Kutilayotgan Hujjatlar</p>
                      <h3 className="text-2xl font-bold text-[#0B1C2C] mt-1">{pendingDocs} ta</h3>
                    </div>
                  </div>
                </div>

                {/* Main sections */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  {/* Left block - recent applications */}
                  <div className="xl:col-span-2 bg-white border border-[#E5E8EB] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-[#E5E8EB] flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#0B1C2C] uppercase tracking-wider">So'nggi Arizalar</h3>
                      <button 
                        onClick={() => setActiveSubTab('applications')}
                        className="text-[#D6B174] hover:text-[#B99056] text-xs font-bold flex items-center gap-1"
                      >
                        <span>Barchasi</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="divide-y divide-[#E5E8EB] overflow-x-auto">
                      {applications.length === 0 ? (
                        <div className="p-8 text-center text-[#6A727D] text-xs">Arizalar mavjud emas</div>
                      ) : (
                        applications.slice(0, 5).map(app => {
                          const student = students.find(s => s.username === app.username);
                          return (
                            <div key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-[#0B1C2C]/5 flex items-center justify-center text-xs font-bold text-[#0B1C2C] shrink-0">
                                  {student ? `${student.firstName[0]}${student.lastName[0]}` : '??'}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-[#0B1C2C] truncate">{student ? `${student.firstName} ${student.lastName}` : app.username}</h4>
                                  <p className="text-[10px] text-[#6A727D] mt-0.5 truncate">{app.universityName} — <span className="font-semibold text-slate-800">{app.program}</span></p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                <span className="text-[10px] text-[#6A727D] font-mono">{app.date}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                                    app.status.includes('🟡') ? 'bg-amber-100 text-amber-800' :
                                    app.status.includes('🟢') ? 'bg-green-100 text-green-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {app.status}
                                  </span>
                                  <button 
                                    onClick={() => {
                                      setUpdatingApp(app);
                                      setNewStatus(app.status);
                                    }}
                                    className="text-xs bg-slate-50 hover:bg-[#D6B174]/15 hover:text-[#0B1C2C] text-[#6A727D] border border-[#E5E8EB] px-3 py-1.5 rounded-lg font-bold transition-all"
                                  >
                                    Boshqarish
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right block - quick notifications / action items */}
                  <div className="bg-white border border-[#E5E8EB] rounded-2xl shadow-sm p-6 flex flex-col">
                    <h3 className="text-sm font-bold text-[#0B1C2C] uppercase tracking-wider mb-4">Tezkor Ma'lumotlar</h3>
                    
                    <div className="space-y-4 flex-1">
                      <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-xl flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-[#0B1C2C]">Hujjatlar Nazorati</h4>
                          <p className="text-[11px] text-[#6A727D] mt-1">
                            Hozirda <strong>{pendingDocs} ta</strong> talaba hujjati tekshirilishi kutilmoqda. Tasdiqlanmagan hujjatlar bilan ariza topshirish cheklanishi mumkin.
                          </p>
                          <button 
                            onClick={() => setActiveSubTab('documents')}
                            className="text-[#D6B174] font-bold text-[10px] mt-2 block hover:underline"
                          >
                            Hujjatlarni ko'rish &rarr;
                          </button>
                        </div>
                      </div>

                      <div className="border border-amber-100 bg-amber-50/50 p-4 rounded-xl flex items-start space-x-3">
                        <FileText className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-[#0B1C2C]">Ko'rib chiqilayotgan Arizalar</h4>
                          <p className="text-[11px] text-[#6A727D] mt-1">
                            Sizda ko'rib chiqish muddati kelgan <strong>{pendingApps} ta</strong> faol ariza mavjud. Universitetdan qabul xabarlarini tezda yangilang.
                          </p>
                          <button 
                            onClick={() => setActiveSubTab('applications')}
                            className="text-[#D6B174] font-bold text-[10px] mt-2 block hover:underline"
                          >
                            Arizalarni boshqarish &rarr;
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-[#E5E8EB] p-4 rounded-xl">
                        <h4 className="text-xs font-bold text-[#0B1C2C] mb-2">Talabalar Profili O'rtachasi</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#6A727D]">IELTS O'rtacha Bal:</span>
                            <span className="font-bold font-mono">
                              {(students.filter(s => s.ielts_score).reduce((acc, s) => acc + (s.ielts_score || 0), 0) / (students.filter(s => s.ielts_score).length || 1)).toFixed(1)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#6A727D]">GPA O'rtacha:</span>
                            <span className="font-bold font-mono">
                              {(students.filter(s => s.gpa).reduce((acc, s) => acc + (s.gpa || 0), 0) / (students.filter(s => s.gpa).length || 1)).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#6A727D]">Byudjet o'rtachasi:</span>
                            <span className="font-bold font-mono text-green-600">
                              ${(students.filter(s => s.budget).reduce((acc, s) => acc + (s.budget || 0), 0) / (students.filter(s => s.budget).length || 1)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Students List Subtab */}
            {activeSubTab === 'students' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Search Bar & Filters */}
                <div className="bg-white border border-[#E5E8EB] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-[#6A727D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Talaba ismi, username yoki telefon..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[#F3F5F8] border border-transparent rounded-xl text-xs font-semibold focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all"
                    />
                  </div>
                  <div className="text-xs text-[#6A727D] font-bold">
                    Jami {filteredStudents.length} ta talaba topildi
                  </div>
                </div>

                {/* Mobile view cards */}
                <div className="block md:hidden space-y-4">
                  {filteredStudents.length === 0 ? (
                    <div className="bg-white border border-[#E5E8EB] p-8 text-center rounded-2xl text-[#6A727D] text-xs">
                      Hech qanday talaba topilmadi
                    </div>
                  ) : (
                    filteredStudents.map(student => (
                      <div key={student.username} className="bg-white border border-[#E5E8EB] p-4 rounded-xl shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#0B1C2C]/5 flex items-center justify-center text-xs font-bold text-[#0B1C2C] shrink-0">
                              {student.firstName[0]}{student.lastName[0]}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-[#0B1C2C] truncate">{student.firstName} {student.lastName}</h4>
                              <p className="text-[10px] text-[#6A727D] font-mono truncate">@{student.username}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => { setSelectedStudent(student); setShowStudentPassword(false); }}
                            className="text-[11px] bg-amber-50 hover:bg-amber-100/70 text-[#B99056] px-2.5 py-1.5 rounded-lg font-bold transition-all shrink-0"
                          >
                            Ko'rish
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-[#6A727D] block text-[9px] uppercase tracking-wider font-bold">Telefon</span>
                            <span className="font-mono text-[#0B1C2C]">{student.phone}</span>
                          </div>
                          <div>
                            <span className="text-[#6A727D] block text-[9px] uppercase tracking-wider font-bold">Yillik Byudjet</span>
                            <span className="font-bold text-green-700">{student.budget ? `$${student.budget.toLocaleString()}` : 'Bepul'}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-[#6A727D] block text-[9px] uppercase tracking-wider font-bold">IELTS</span>
                            {student.ielts_score ? (
                              <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[10px] font-mono mt-0.5 inline-block">{student.ielts_score}</span>
                            ) : (
                              <span className="text-[#6A727D]">Yo'q</span>
                            )}
                          </div>
                          <div className="mt-1">
                            <span className="text-[#6A727D] block text-[9px] uppercase tracking-wider font-bold">GPA Baho</span>
                            {student.gpa ? (
                              <span className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded text-[10px] font-mono mt-0.5 inline-block">{student.gpa}</span>
                            ) : (
                              <span className="text-[#6A727D]">Yo'q</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Students Table - Desktop Only */}
                <div className="hidden md:block bg-white border border-[#E5E8EB] rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#E5E8EB] text-[#6A727D] text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-4 px-6">F.I.SH</th>
                          <th className="py-4 px-6">Username</th>
                          <th className="py-4 px-6">Telefon</th>
                          <th className="py-4 px-6">IELTS</th>
                          <th className="py-4 px-6">GPA</th>
                          <th className="py-4 px-6">Yillik Byudjet</th>
                          <th className="py-4 px-6">Harakat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E8EB] text-xs">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-[#6A727D]">Hech qanday talaba topilmadi</td>
                          </tr>
                        ) : (
                          filteredStudents.map(student => (
                            <tr key={student.username} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-6">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full bg-[#0B1C2C]/5 flex items-center justify-center text-xs font-bold text-[#0B1C2C]">
                                    {student.firstName[0]}{student.lastName[0]}
                                  </div>
                                  <span className="font-bold text-[#0B1C2C]">{student.firstName} {student.lastName}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6 font-mono text-[#6A727D]">@{student.username}</td>
                              <td className="py-4 px-6 font-mono">{student.phone}</td>
                              <td className="py-4 px-6">
                                {student.ielts_score ? (
                                  <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded font-mono">{student.ielts_score}</span>
                                ) : (
                                  <span className="text-[#6A727D]">Mavjud emas</span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                {student.gpa ? (
                                  <span className="bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded font-mono">{student.gpa}</span>
                                ) : (
                                  <span className="text-[#6A727D]">Mavjud emas</span>
                                )}
                              </td>
                              <td className="py-4 px-6 font-mono text-green-700 font-bold">
                                {student.budget ? `$${student.budget.toLocaleString()}` : 'Bepul'}
                              </td>
                              <td className="py-4 px-6">
                                <button 
                                  onClick={() => { setSelectedStudent(student); setShowStudentPassword(false); }}
                                  className="text-[#D6B174] hover:text-[#B99056] font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100/50 px-2.5 py-1.5 rounded-lg transition-all"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Profilni ko'rish</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Applications Manager Subtab */}
            {activeSubTab === 'applications' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Search & Filters */}
                <div className="bg-white border border-[#E5E8EB] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-[#6A727D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Talaba ismi, universitet yoki yo'nalish..."
                      value={appSearch}
                      onChange={(e) => setAppSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[#F3F5F8] border border-transparent rounded-xl text-xs font-semibold focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all"
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                    <Filter className="w-4 h-4 text-[#6A727D]" />
                    {['all', 'pending', 'accepted', 'rejected'].map(st => (
                      <button 
                        key={st}
                        onClick={() => setAppFilterStatus(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          appFilterStatus === st ? 'bg-[#0B1C2C] text-white' : 'bg-slate-100 text-[#6A727D] hover:bg-slate-200'
                        }`}
                      >
                        {st === 'all' && 'Barchasi'}
                        {st === 'pending' && 'Ko\'rib chiqilayotganlar'}
                        {st === 'accepted' && 'Qabul qilinganlar'}
                        {st === 'rejected' && 'Rad etilganlar'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Har bir talaba uchun 1 karta */}
                {studentAppGroups.length === 0 ? (
                  <div className="bg-white border border-[#E5E8EB] p-8 text-center rounded-2xl text-[#6A727D] text-xs">
                    Hech qanday ariza topilmadi
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studentAppGroups.map(group => {
                      const student = students.find(s => s.username === group.username);
                      const latestApp = group.apps[0];
                      const hasPending = group.apps.some(a => a.status.includes('🟡'));
                      const hasAccepted = group.apps.some(a => a.status.includes('🟢'));
                      return (
                        <button
                          key={group.username}
                          onClick={() => setAppDetailUsername(group.username)}
                          className="text-left bg-white border border-[#E5E8EB] p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-[#D6B174]/50 transition-all space-y-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#0B1C2C]/5 flex items-center justify-center text-xs font-bold text-[#0B1C2C] shrink-0">
                              {student ? `${student.firstName[0]}${student.lastName[0]}` : '??'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#0B1C2C] text-sm truncate">{student ? `${student.firstName} ${student.lastName}` : group.username}</p>
                              <p className="text-[10px] text-[#6A727D] font-mono truncate">@{group.username}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="text-[10px] font-bold text-[#6A727D] uppercase tracking-wider">
                              {group.apps.length} ta ariza
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              hasPending ? 'bg-amber-100 text-amber-800' :
                              hasAccepted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {latestApp.status}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#6A727D] truncate">
                            So'nggi: <span className="font-semibold text-[#0B1C2C]">{latestApp.universityName}</span>
                            {latestApp.universityCountry ? ` (${latestApp.universityCountry})` : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Documents Verification Subtab */}
            {activeSubTab === 'documents' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Filters */}
                <div className="bg-white border border-[#E5E8EB] p-4 rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Filter className="w-4 h-4 text-[#6A727D]" />
                    {['all', 'pending', 'verified', 'rejected'].map(st => (
                      <button 
                        key={st}
                        onClick={() => setDocFilterStatus(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          docFilterStatus === st ? 'bg-[#0B1C2C] text-white' : 'bg-slate-100 text-[#6A727D] hover:bg-slate-200'
                        }`}
                      >
                        {st === 'all' && 'Barcha Hujjatlar'}
                        {st === 'pending' && 'Kutilayotganlar'}
                        {st === 'verified' && 'Tasdiqlanganlar'}
                        {st === 'rejected' && 'Rad etilganlar'}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-[#6A727D] font-bold">
                    Jami {filteredDocs.length} ta hujjat topildi
                  </div>
                </div>

                {/* Documents Grid */}
                {filteredDocs.length === 0 ? (
                  <div className="bg-white border border-[#E5E8EB] p-12 text-center rounded-2xl text-[#6A727D] text-xs">
                    Hech qanday hujjat topilmadi
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredDocs.map(doc => {
                      const student = students.find(s => s.username === doc.username);
                      return (
                        <div key={`${doc.username}-${doc.name}`} className="bg-white border border-[#E5E8EB] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="p-3 rounded-xl bg-slate-100 text-[#0B1C2C] font-bold text-xs">
                                PDF
                              </div>
                              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                                doc.status === 'Tasdiqlangan' ? 'bg-green-100 text-green-800' :
                                doc.status === 'Rad etilgan' ? 'bg-red-100 text-red-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {doc.status}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-[#0B1C2C] line-clamp-1" title={doc.name}>
                                {doc.name}
                              </h4>
                              <p className="text-[10px] text-[#6A727D] mt-1">Tur: <strong>{doc.type}</strong> ({doc.size})</p>
                            </div>

                            <div className="border-t border-slate-100 pt-3 flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                                {student ? `${student.firstName[0]}${student.lastName[0]}` : '??'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-[#0B1C2C] truncate">
                                  {student ? `${student.firstName} ${student.lastName}` : doc.username}
                                </p>
                                <p className="text-[9px] text-[#6A727D] truncate">@{doc.username}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                            <a 
                              href={`${doc.url}?auth=${encodeURIComponent(token)}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex-1 bg-slate-50 hover:bg-[#D6B174]/15 hover:text-[#0B1C2C] text-[#6A727D] border border-[#E5E8EB] py-2 rounded-xl text-[10px] font-bold transition-all text-center flex items-center justify-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Faylni ochish</span>
                            </a>

                            {doc.status !== 'Tasdiqlangan' && (
                              <button 
                                onClick={() => handleUpdateDocStatus(doc.username, doc.name, 'Tasdiqlangan')}
                                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-xl transition-all"
                                title="Tasdiqlash"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}

                            {doc.status !== 'Rad etilgan' && (
                              <button 
                                onClick={() => handleUpdateDocStatus(doc.username, doc.name, 'Rad etilgan')}
                                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl transition-all"
                                title="Rad etish"
                              >
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
          </>
        )}
      </main>

      {/* MODAL 1: Update Application Status & Note */}
      {updatingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#E5E8EB] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#E5E8EB] flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-[#0B1C2C] uppercase tracking-wider">Arizani Tahrirlash</h3>
                <p className="text-[11px] text-[#6A727D] mt-0.5">{updatingApp.universityName} — {updatingApp.program}</p>
              </div>
              <button 
                onClick={() => setUpdatingApp(null)}
                className="p-1.5 hover:bg-slate-200 text-[#6A727D] rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAppStatus} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#6A727D] uppercase tracking-wider mb-2">Ariza Holati</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: '🟡 Ko\'rib chiqilyapti', label: '🟡 Ko\'rib chiqilyapti' },
                    { value: '🟢 Tasdiqlangan / Qabul qilingan', label: '🟢 Qabul qilindi' },
                    { value: '🔴 Rad etilgan', label: '🔴 Rad etildi' }
                  ].map(item => (
                    <button 
                      type="button"
                      key={item.value}
                      onClick={() => setNewStatus(item.value)}
                      className={`py-2 px-3 border text-[11px] font-semibold rounded-xl text-center transition-all ${
                        newStatus === item.value 
                          ? 'border-[#D6B174] bg-[#D6B174]/10 text-[#0B1C2C] font-bold' 
                          : 'border-[#E5E8EB] bg-white text-[#6A727D] hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6A727D] uppercase tracking-wider mb-2">
                  Talaba uchun Izoh (Tarixda saqlanadi va talaba ko'ra oladi)
                </label>
                <textarea 
                  rows={3}
                  placeholder="Masalan: Universitet sizga rasmiy taklifnoma yubordi! Tabriklaymiz!"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-[#E5E8EB] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#D6B174] focus:bg-white transition-all"
                />
              </div>

              {/* History view */}
              <div className="pt-2">
                <p className="text-[10px] font-bold text-[#6A727D] uppercase tracking-wider mb-2">Tarix Yo'li</p>
                <div className="max-h-32 overflow-y-auto space-y-2 border border-[#E5E8EB] p-3 rounded-xl bg-slate-50">
                  {updatingApp.history.map((h, i) => (
                    <div key={i} className="text-[10px] leading-relaxed border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between font-bold text-[#0B1C2C]">
                        <span>{h.status}</span>
                        <span className="font-mono text-[9px] text-[#6A727D]">{h.date}</span>
                      </div>
                      <p className="text-[#6A727D] mt-0.5">{h.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 pt-4 border-t border-[#E5E8EB]">
                <button 
                  type="button"
                  onClick={() => setUpdatingApp(null)}
                  className="flex-1 py-2.5 border border-[#E5E8EB] bg-slate-100 hover:bg-slate-200 text-[#6A727D] rounded-xl text-xs font-bold transition-all"
                >
                  Bekor qilish
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-[#0B1C2C] hover:bg-[#1a3857] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Talabaning barcha arizalari va batafsil ma'lumotlari */}
      {appDetailUsername && (() => {
        const student = students.find(s => s.username === appDetailUsername);
        const studentApps = applications.filter(a => a.username === appDetailUsername);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white border border-[#E5E8EB] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-[#E5E8EB] flex items-center justify-between bg-[#0B1C2C] text-white shrink-0">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#D6B174]/20 border border-[#D6B174]/40 flex items-center justify-center text-[#D6B174] font-bold text-sm shrink-0">
                    {student ? `${student.firstName[0]}${student.lastName[0]}` : '??'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider truncate">{student ? `${student.firstName} ${student.lastName}` : appDetailUsername}</h3>
                    <p className="text-[10px] text-white/60">@{appDetailUsername} — {studentApps.length} ta ariza</p>
                  </div>
                </div>
                <button
                  onClick={() => { setAppDetailUsername(null); setExpandedAppId(null); }}
                  className="p-1.5 hover:bg-white/10 text-white/80 rounded-lg transition-colors shrink-0"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                {studentApps.map(app => {
                  const isOpen = expandedAppId === app.id;
                  return (
                    <div key={app.id} className="border border-[#E5E8EB] rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedAppId(isOpen ? null : app.id)}
                        className="w-full flex items-center justify-between gap-3 p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0B1C2C] truncate">
                            {app.universityName}{app.universityCountry ? ` — ${app.universityCountry}` : ''}
                          </p>
                          <p className="text-[11px] text-[#6A727D] truncate">{app.program} · {app.date}</p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          app.status.includes('🟡') ? 'bg-amber-100 text-amber-800' :
                          app.status.includes('🟢') ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {app.status}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="p-4 space-y-4 border-t border-[#E5E8EB]">
                          {/* Ota-ona va aloqa ma'lumotlari */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="bg-slate-50 border border-[#E5E8EB] p-3 rounded-xl">
                              <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider block mb-1">Otasi</span>
                              <p className="font-semibold text-[#0B1C2C]">{app.fatherName || 'Kiritilmagan'}</p>
                              <p className="font-mono text-[#6A727D]">{app.fatherPhone || '—'}</p>
                            </div>
                            <div className="bg-slate-50 border border-[#E5E8EB] p-3 rounded-xl">
                              <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider block mb-1">Onasi</span>
                              <p className="font-semibold text-[#0B1C2C]">{app.motherName || 'Kiritilmagan'}</p>
                              <p className="font-mono text-[#6A727D]">{app.motherPhone || '—'}</p>
                            </div>
                            <div className="bg-slate-50 border border-[#E5E8EB] p-3 rounded-xl">
                              <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider block mb-1">Email</span>
                              <p className="font-mono text-[#0B1C2C] truncate">{app.contactEmail || '—'}</p>
                            </div>
                            <div className="bg-slate-50 border border-[#E5E8EB] p-3 rounded-xl">
                              <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider block mb-1">Telefon</span>
                              <p className="font-mono text-[#0B1C2C]">{app.contactPhone || '—'}</p>
                            </div>
                          </div>

                          {/* Hujjatlar */}
                          <div>
                            <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider block mb-2">Yuklangan hujjatlar</span>
                            {app.documents.length === 0 ? (
                              <p className="text-[11px] text-[#6A727D] italic">Hujjat yuklanmagan</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {app.documents.map((doc, idx) => (
                                  <a
                                    key={idx}
                                    href={doc.url ? `${doc.url}?auth=${encodeURIComponent(token)}` : undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between gap-2 border border-[#E5E8EB] bg-white p-2.5 rounded-xl text-[11px] font-semibold text-[#0B1C2C] hover:bg-[#D6B174]/10 transition-colors"
                                  >
                                    <span className="truncate">{doc.type}</span>
                                    <Eye className="w-3.5 h-3.5 text-[#6A727D] shrink-0" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => { setUpdatingApp(app); setNewStatus(app.status); }}
                            className="w-full py-2.5 bg-[#0B1C2C] hover:bg-[#1a3857] text-white rounded-xl text-xs font-bold transition-all"
                          >
                            Ariza holatini boshqarish
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-6 border-t border-[#E5E8EB] bg-slate-50 flex shrink-0">
                <button
                  onClick={() => { setAppDetailUsername(null); setExpandedAppId(null); }}
                  className="w-full py-2.5 bg-[#0B1C2C] hover:bg-[#1a3857] text-white rounded-xl text-xs font-bold transition-all"
                >
                  Yopish
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 2: View Student Detailed Profile */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#E5E8EB] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#E5E8EB] flex items-center justify-between bg-[#0B1C2C] text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#D6B174]/20 border border-[#D6B174]/40 flex items-center justify-center text-[#D6B174] font-bold text-sm">
                  {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                  <p className="text-[10px] text-white/60">Talaba profili va hujjatlari</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 hover:bg-white/10 text-white/80 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Detailed Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-[#E5E8EB] p-3 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider">IELTS Score</span>
                  <p className="text-sm font-bold text-[#0B1C2C] mt-1 font-mono">
                    {selectedStudent.ielts_score ? selectedStudent.ielts_score : 'Yo\'q'}
                  </p>
                </div>
                <div className="bg-slate-50 border border-[#E5E8EB] p-3 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider">GPA Baho</span>
                  <p className="text-sm font-bold text-[#0B1C2C] mt-1 font-mono">
                    {selectedStudent.gpa ? selectedStudent.gpa : 'Yo\'q'}
                  </p>
                </div>
                <div className="bg-slate-50 border border-[#E5E8EB] p-3 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider">Byudjet</span>
                  <p className="text-sm font-bold text-[#0B1C2C] mt-1 font-mono text-green-700">
                    {selectedStudent.budget ? `$${selectedStudent.budget.toLocaleString()}` : 'Belgilanmagan'}
                  </p>
                </div>
                <div className="bg-slate-50 border border-[#E5E8EB] p-3 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-[#6A727D] uppercase tracking-wider">Tizimdagi ID</span>
                  <p className="text-[10px] font-bold text-[#6A727D] mt-1 truncate">
                    @{selectedStudent.username}
                  </p>
                </div>
              </div>

              {/* Personal Details */}
              <div className="space-y-3 bg-slate-50/50 border border-[#E5E8EB] p-4 rounded-xl">
                <h4 className="text-[10px] font-bold text-[#0B1C2C] uppercase tracking-wider border-b border-slate-200 pb-2">Bog'lanish Ma'lumotlari</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-[#6A727D]" />
                    <span className="font-semibold text-slate-700">Telefon:</span>
                    <span className="font-mono">{selectedStudent.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-[#6A727D]" />
                    <span className="font-semibold text-slate-700">Telegram Chat ID:</span>
                    <span className="font-mono">{selectedStudent.telegram_chat_id || 'Ulanmagan'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-[#6A727D]" />
                    <span className="font-semibold text-slate-700">IP Manzili:</span>
                    <span className="font-mono">{selectedStudent.last_login_ip || 'Noaniq'}</span>
                  </div>
                </div>
              </div>

              {/* Login Credentials (Admin only) */}
              <div className="space-y-3 bg-amber-50/60 border border-amber-200 p-4 rounded-xl">
                <h4 className="text-[10px] font-bold text-[#0B1C2C] uppercase tracking-wider border-b border-amber-200 pb-2">Kirish Ma'lumotlari (faqat admin)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-[#6A727D]" />
                    <span className="font-semibold text-slate-700">Username:</span>
                    <span className="font-mono">{selectedStudent.username}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-[#6A727D]" />
                    <span className="font-semibold text-slate-700">Parol:</span>
                    <span className="font-mono">{showStudentPassword ? (selectedStudent.password || 'Noma\'lum') : '••••••••'}</span>
                    <button
                      type="button"
                      onClick={() => setShowStudentPassword(v => !v)}
                      className="text-[10px] font-bold text-[#B99056] hover:underline ml-1"
                    >
                      {showStudentPassword ? 'Yashirish' : 'Ko\'rsatish'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Student's Applications */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-[#0B1C2C] uppercase tracking-wider border-b border-slate-200 pb-2">Talabaning Arizalari</h4>
                <div className="space-y-2">
                  {applications.filter(a => a.username === selectedStudent.username).length === 0 ? (
                    <p className="text-xs text-[#6A727D] italic">Faol arizalar mavjud emas</p>
                  ) : (
                    applications.filter(a => a.username === selectedStudent.username).map(app => (
                      <div key={app.id} className="border border-[#E5E8EB] p-3 rounded-xl bg-white flex items-center justify-between text-xs shadow-sm">
                        <div>
                          <p className="font-bold text-[#0B1C2C]">{app.universityName}</p>
                          <p className="text-[10px] text-[#6A727D] mt-0.5">{app.program}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            app.status.includes('🟡') ? 'bg-amber-100 text-amber-800' :
                            app.status.includes('🟢') ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {app.status}
                          </span>
                          <span className="text-[10px] text-[#6A727D] font-mono">{app.date}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Student's Documents */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-[#0B1C2C] uppercase tracking-wider border-b border-slate-200 pb-2 font-display">Talabaning Yuklagan Hujjatlari</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {documents.filter(d => d.username === selectedStudent.username).length === 0 ? (
                    <p className="text-xs text-[#6A727D] italic col-span-2">Yuklangan hujjatlar mavjud emas</p>
                  ) : (
                    documents.filter(d => d.username === selectedStudent.username).map(doc => (
                      <div key={doc.name} className="border border-[#E5E8EB] p-3 rounded-xl bg-white flex flex-col justify-between text-xs shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-[#0B1C2C] truncate max-w-[130px]" title={doc.name}>{doc.name}</span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${
                            doc.status === 'Tasdiqlangan' ? 'bg-green-100 text-green-800' :
                            doc.status === 'Rad etilgan' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        <p className="text-[9px] text-[#6A727D]">Tur: {doc.type} ({doc.size})</p>
                        <div className="mt-3 flex gap-2">
                          <a 
                            href={`${doc.url}?auth=${encodeURIComponent(token)}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex-1 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600 hover:bg-[#D6B174]/15 hover:text-[#0B1C2C]"
                          >
                            Ochish
                          </a>
                          {doc.status !== 'Tasdiqlangan' && (
                            <button 
                              onClick={() => handleUpdateDocStatus(doc.username, doc.name, 'Tasdiqlangan')}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[9px] font-bold"
                            >
                              Tasdiqlash
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#E5E8EB] bg-slate-50 flex">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="w-full py-2.5 bg-[#0B1C2C] hover:bg-[#1a3857] text-white rounded-xl text-xs font-bold transition-all"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
