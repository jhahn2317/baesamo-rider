import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, where, deleteDoc, updateDoc } from 'firebase/firestore';

// 💡 필수 아이콘 Import (Vercel 에러 방지용)
import { 
  Plus, Calendar as CalendarIcon, Bike, CheckCircle2, 
  Trash2, Clock, ChevronDown, ChevronUp, 
  Target, Edit3, X, Timer, Coins, Filter, RefreshCw, 
  ChevronLeft, ChevronRight, Settings, Users, Ghost,
  CalendarCheck, AlertCircle, ChevronDownSquare, Share
} from 'lucide-react';

// ==========================================
// 1. 배사모 FIREBASE SETUP
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCfRI6es38NWQAIGUAxT5Uxx446TE8AG0c",
  authDomain: "baesamo-app.firebaseapp.com",
  projectId: "baesamo-app",
  storageBucket: "baesamo-app.firebasestorage.app",
  messagingSenderId: "246846263578",
  appId: "1:246846263578:web:7b77296cddbe144e1a1ca3"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 2. HELPER FUNCTIONS (유틸리티 함수)
// ==========================================
const getKSTDateStr = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const kstTime = new Date(utc + (9 * 3600000));
  return `${kstTime.getFullYear()}-${String(kstTime.getMonth() + 1).padStart(2, '0')}-${String(kstTime.getDate()).padStart(2, '0')}`;
};

const getKSTDateStrFromDate = (dObj) => {
  if (!dObj || isNaN(dObj.getTime())) return '';
  const utc = dObj.getTime() + (dObj.getTimezoneOffset() * 60000);
  const kstTime = new Date(utc + (9 * 3600000));
  return `${kstTime.getFullYear()}-${String(kstTime.getMonth() + 1).padStart(2, '0')}-${String(kstTime.getDate()).padStart(2, '0')}`;
};

const formatTimeStr = (dateObj) => {
  if (!dateObj) return '';
  return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
};

const getPaydayStr = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return '';
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const daysToAdd = [5, 4, 3, 9, 8, 7, 6][d.getDay()];
  d.setDate(d.getDate() + daysToAdd);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getWeekOfMonth = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return 1;
  const date = new Date(dateStr);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return Math.ceil((date.getDate() + firstDay) / 7);
};

const formatLargeMoney = (v) => {
  if (v === '' || v === undefined || v === null) return '0';
  const num = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : v;
  return isNaN(num) ? '0' : new Intl.NumberFormat('ko-KR').format(num);
};

const formatCompactMoney = (val) => {
  if (!val || val === 0) return '0';
  const absVal = Math.abs(val);
  if (absVal >= 10000) {
    const v = absVal / 10000;
    return (Number.isInteger(v) ? v : v.toFixed(1)) + '만';
  }
  return new Intl.NumberFormat('ko-KR').format(absVal);
};

const calcDailyMetrics = (deliveries) => {
  if (!deliveries || deliveries.length === 0) return { durationStr: '', hourlyRate: 0, perDelivery: 0, totalCnt: 0, totalAmt: 0 };
  let intervals = [];
  deliveries.forEach(d => {
    if(d.startTime && d.endTime && typeof d.startTime === 'string' && typeof d.endTime === 'string') {
      let [sh, sm] = d.startTime.split(':').map(Number);
      let [eh, em] = d.endTime.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        let start = sh * 60 + sm;
        let end = eh * 60 + em;
        if (end <= start) end += 1440; 
        intervals.push({start, end});
      }
    }
  });
  intervals.sort((a,b) => a.start - b.start);
  let merged = [];
  if (intervals.length > 0) {
    let current = {...intervals[0]};
    for(let i=1; i<intervals.length; i++) {
      if (intervals[i].start <= current.end) current.end = Math.max(current.end, intervals[i].end);
      else { merged.push(current); current = {...intervals[i]}; }
    }
    merged.push(current);
  }
  let totalMins = merged.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
  let totalAmt = deliveries.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  let totalCnt = deliveries.reduce((acc, curr) => acc + (curr.count || 0), 0);
  
  let hours = Math.floor(totalMins / 60);
  let mins = totalMins % 60;
  let durationStr = totalMins > 0 ? `${hours > 0 ? hours+'시간 ' : ''}${mins > 0 ? mins+'분' : ''}`.trim() : '';
  let hourlyRate = totalMins > 0 ? Math.round(totalAmt / (totalMins / 60)) : 0;
  let perDelivery = totalCnt > 0 ? Math.round(totalAmt / totalCnt) : 0;
  return { durationStr, hourlyRate, perDelivery, totalCnt, totalAmt };
};

const getGroupMetrics = (items) => {
  let totalMins = 0; const byDate = {};
  items.forEach(d => { if(!d.date) return; if(!byDate[d.date]) byDate[d.date] = []; byDate[d.date].push(d); });
  Object.values(byDate).forEach(dayItems => {
    let intervals = [];
    dayItems.forEach(d => {
      if(d.startTime && d.endTime && typeof d.startTime === 'string' && typeof d.endTime === 'string') {
        let [sh, sm] = d.startTime.split(':').map(Number); let [eh, em] = d.endTime.split(':').map(Number);
        let start = sh * 60 + sm; let end = eh * 60 + em;
        if (end <= start) end += 1440; 
        intervals.push({start, end});
      }
    });
    intervals.sort((a,b) => a.start - b.start); let merged = [];
    if (intervals.length > 0) {
      let current = {...intervals[0]};
      for(let i=1; i<intervals.length; i++) {
        if (intervals[i].start <= current.end) current.end = Math.max(current.end, intervals[i].end);
        else { merged.push(current); current = {...intervals[i]}; }
      }
      merged.push(current);
    }
    totalMins += merged.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
  });
  const totalAmt = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalCnt = items.reduce((acc, curr) => acc + (curr.count || 0), 0);
  let hours = Math.floor(totalMins / 60);
  let mins = totalMins % 60;
  return { 
    durationStr: totalMins > 0 ? `${hours > 0 ? hours+'시간 ' : ''}${mins > 0 ? mins+'분' : ''}`.trim() : '-', 
    totalCnt, totalAmt, 
    perDelivery: totalCnt > 0 ? Math.round(totalAmt / totalCnt) : 0, 
    hourlyRate: totalMins > 0 ? Math.round(totalAmt / (totalMins / 60)) : 0 
  };
};

export const handleTouchStart = (e) => {
  e.currentTarget.dataset.startY = e.touches[0].clientY;
  e.currentTarget.style.transition = 'none'; 
};

export const handleTouchMove = (e) => {
  const startY = parseFloat(e.currentTarget.dataset.startY || 0);
  const currentY = e.touches[0].clientY;
  const swipeDistance = currentY - startY;
  if (swipeDistance > 0) {
    e.currentTarget.style.transform = `translateY(${swipeDistance}px)`;
  }
};

export const handleTouchEnd = (e, closeFunction) => {
  const startY = parseFloat(e.currentTarget.dataset.startY || 0);
  const currentY = e.changedTouches[0].clientY;
  const swipeDistance = currentY - startY;
  const modalHeight = e.currentTarget.clientHeight;

  e.currentTarget.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
  if (swipeDistance > modalHeight * 0.35) {
    e.currentTarget.style.transform = 'translateY(100%)';
    setTimeout(() => { closeFunction(); e.currentTarget.style.transform = ''; }, 250);
  } else {
    e.currentTarget.style.transform = 'translateY(0)';
    setTimeout(() => { e.currentTarget.style.transform = ''; }, 300);
  }
};

// ==========================================
// 3. 로그인 및 회원가입 화면
// ==========================================
function LoginScreen({ onLogin, onGoToRegister }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('baesamo_saved_id');
    const savedPw = localStorage.getItem('baesamo_saved_pw');
    if (savedId && savedPw) {
      setLoginId(savedId);
      setPassword(savedPw);
      setRememberMe(true);
    }
  }, []);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loginId || !password) return alert("아이디와 비밀번호를 입력하세요.");
    
    if (rememberMe) {
      localStorage.setItem('baesamo_saved_id', loginId);
      localStorage.setItem('baesamo_saved_pw', password);
    } else {
      localStorage.removeItem('baesamo_saved_id');
      localStorage.removeItem('baesamo_saved_pw');
    }

    onLogin(`${loginId.trim().toLowerCase()}@baesamo.com`, password);
  };

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-6 text-center relative">
      <div className="text-6xl mb-4 animate-bounce">🛵</div>
      <h1 className="text-3xl font-black text-gray-800 mb-2 italic">BAESAMO PRO</h1>
      <p className="text-gray-500 text-xs mb-8 font-bold">배달을 사랑하는 모임 전용 수익 관리 앱</p>
      
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input 
          required type="text" value={loginId} onChange={e => setLoginId(e.target.value)} 
          placeholder="아이디" autoComplete="username"
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 font-bold outline-none shadow-sm focus:ring-2 focus:ring-blue-400 transition-all" 
        />
        <input 
          required type="password" value={password} onChange={e => setPassword(e.target.value)} 
          placeholder="비밀번호" autoComplete="current-password"
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 font-bold outline-none shadow-sm focus:ring-2 focus:ring-blue-400 transition-all" 
        />
        
        <label className="flex items-center justify-start gap-2 pt-1 pb-2 cursor-pointer ml-1">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
          <span className="text-xs font-bold text-gray-500 cursor-pointer">아이디/비밀번호 저장 (자동로그인)</span>
        </label>

        <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-[1.2rem] font-black text-lg shadow-md active:scale-95 transition-transform">
          🔑 로그인
        </button>
      </form>

      <div className="mt-8 flex flex-col gap-4">
        <button onClick={onGoToRegister} className="text-sm font-black text-gray-400 underline decoration-2 underline-offset-4 active:text-gray-600">
          ✍️ 아직 계정이 없으신가요? 가입하기
        </button>
        <button onClick={() => setShowInstallGuide(true)} className="text-xs font-black text-blue-500 bg-blue-100/50 px-4 py-2 rounded-full border border-blue-200 shadow-sm active:scale-95 transition-transform mt-6">
          📲 내 스마트폰에 앱으로 설치하는 방법
        </button>
      </div>

      {showInstallGuide && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-5">
           <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 text-left shadow-2xl relative">
              <button onClick={() => setShowInstallGuide(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-gray-500 active:scale-95"><X size={20}/></button>
              
              <h2 className="text-xl font-black text-gray-900 mb-6 mt-2 flex items-center gap-2">📱 앱으로 설치하기</h2>
              
              <div className="space-y-6">
                 <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <h3 className="text-sm font-black text-blue-600 mb-2 flex items-center gap-1">🍎 아이폰 (Safari 브라우저)</h3>
                    <ol className="text-xs font-bold text-gray-600 space-y-1.5 list-decimal list-inside ml-1 leading-relaxed">
                       <li>화면 하단 메뉴바 중앙의 <span className="bg-white border px-1 rounded shadow-sm inline-block translate-y-0.5"><Share size={12} className="inline"/> 공유</span> 버튼을 누릅니다.</li>
                       <li>메뉴를 위로 올려 <span className="text-gray-800 bg-gray-200 px-1 rounded">홈 화면에 추가 (+)</span> 를 누릅니다.</li>
                       <li>우측 상단의 <b>[추가]</b>를 누르면 바탕화면에 생성됩니다!</li>
                    </ol>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <h3 className="text-sm font-black text-green-600 mb-2 flex items-center gap-1">🤖 안드로이드 (Chrome 브라우저)</h3>
                    <ol className="text-xs font-bold text-gray-600 space-y-1.5 list-decimal list-inside ml-1 leading-relaxed">
                       <li>화면 우측 상단의 <span className="text-gray-800 bg-gray-200 px-1 rounded font-black tracking-widest">⋮</span> (점 3개) 버튼을 누릅니다.</li>
                       <li>메뉴에서 <span className="text-gray-800 bg-gray-200 px-1 rounded">홈 화면에 추가</span> 또는 <span className="text-gray-800 bg-gray-200 px-1 rounded">앱 설치</span>를 누릅니다.</li>
                       <li>설치를 수락하면 바탕화면에 앱이 생성됩니다!</li>
                    </ol>
                 </div>
              </div>

              <button onClick={() => setShowInstallGuide(false)} className="w-full bg-blue-600 text-white font-black text-sm py-4 rounded-2xl mt-6 shadow-md active:scale-95 transition-transform">확인했습니다</button>
           </div>
        </div>
      )}
    </div>
  );
}

function RegisterScreen({ onRegister, onBackToLogin }) {
  const [formData, setFormData] = useState({ loginId: '', password: '', name: '', bikeNumber: '', nickname: '', birthYear: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password.length < 6) return alert("비밀번호는 최소 6자리 이상이어야 합니다!");
    const fakeEmail = `${formData.loginId.trim().toLowerCase()}@baesamo.com`;
    const age = new Date().getFullYear() - parseInt(formData.birthYear) + 1;
    onRegister({ ...formData, email: fakeEmail, age, status: 'pending', isRiding: false, isStealth: false });
  };

  return (
    <div className="min-h-screen bg-white p-6 pt-10 flex flex-col items-center overflow-y-auto">
      <h2 className="text-2xl font-black text-gray-800 mb-6 italic">가입 신청 ✍️</h2>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 pb-10">
        <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 space-y-3">
          <label className="text-[10px] font-black text-blue-500 ml-1">계정 정보</label>
          <input required placeholder="사용할 아이디" value={formData.loginId} onChange={e => setFormData({ ...formData, loginId: e.target.value })} className="w-full p-3 rounded-xl border border-blue-200 font-bold outline-none" />
          <input required type="password" placeholder="비밀번호 (6자 이상)" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full p-3 rounded-xl border border-blue-200 font-bold outline-none" />
        </div>
        <input required placeholder="이름 (실명)" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 font-bold" />
        <input required placeholder="단톡방 닉네임" value={formData.nickname} onChange={e => setFormData({ ...formData, nickname: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 font-bold" />
        <input required placeholder="오토바이 번호 (예: 경기화성라1234)" value={formData.bikeNumber} onChange={e => setFormData({ ...formData, bikeNumber: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 font-bold" />
        <input required type="number" placeholder="출생년도 (4자리 숫자)" value={formData.birthYear} onChange={e => setFormData({ ...formData, birthYear: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 font-bold" />
        <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black shadow-lg mt-4 active:scale-95 transition-transform">가입 신청 완료</button>
        <button type="button" onClick={onBackToLogin} className="w-full text-gray-400 py-2 font-bold text-sm">뒤로 가기</button>
      </form>
    </div>
  );
}

// ==========================================
// 4. 배달 수익 관리 메인 뷰 (투폰 기능 추가)
// ==========================================
function DeliveryView({ user, userData, dailyDeliveries }) {
  const todayStr = getKSTDateStr();
  const [selectedYear, setSelectedYear] = useState(parseInt(todayStr.slice(0, 4)));
  const [selectedMonth, setSelectedMonth] = useState(parseInt(todayStr.slice(5, 7)));

  const [deliverySubTab, setDeliverySubTab] = useState('daily');
  const [deliveryDateRange, setDeliveryDateRange] = useState({ start: '', end: '' });
  const [showDeliveryFilters, setShowDeliveryFilters] = useState(false);
  
  const [isDeliverySummaryOpen, setIsDeliverySummaryOpen] = useState(false);
  const [isPendingSummaryOpen, setIsPendingSummaryOpen] = useState(true);
  const [isYearlySummaryOpen, setIsYearlySummaryOpen] = useState(false);
  
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [mergeModeDate, setMergeModeDate] = useState(null);
  const [selectedShiftsToMerge, setSelectedShiftsToMerge] = useState([]);
  
  const [calYear, setCalYear] = useState(selectedYear);
  const [calMonth, setCalMonth] = useState(selectedMonth);

  const [splitQueue, setSplitQueue] = useState([]);
  const [recoveryShift, setRecoveryShift] = useState(() => {
    const saved = localStorage.getItem('baesamoRecoveryShift');
    return saved ? JSON.parse(saved) : null;
  });

  const [expandedDailyDates, setExpandedDailyDates] = useState({});
  const toggleDailyDate = (date, e) => {
    e.stopPropagation();
    setExpandedDailyDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  useEffect(() => {
    setCalYear(selectedYear);
    setCalMonth(selectedMonth);
  }, [selectedYear, selectedMonth]);

  const [selectedShiftDetail, setSelectedShiftDetail] = useState(null);
  const [selectedWeeklySummary, setSelectedWeeklySummary] = useState(null);
  const [selectedDailySummary, setSelectedDailySummary] = useState(null);

  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [editingDeliveryShift, setEditingDeliveryShift] = useState(null);
  
  const emptyForm = { 
    date: todayStr, startTime: '', endTime: '', 
    useTwoPhones: false,
    mainBaeminAmt: '', mainBaeminCnt: '', mainCoupangAmt: '', mainCoupangCnt: '', 
    subBaeminAmt: '', subBaeminCnt: '', subCoupangAmt: '', subCoupangCnt: '' 
  };
  const [deliveryFormData, setDeliveryFormData] = useState(emptyForm);

  const [timerActive, setTimerActive] = useState(userData?.isRiding || false);
  const [trackingStartTime, setTrackingStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setTimerActive(userData?.isRiding || false);
  }, [userData?.isRiding]);

  useEffect(() => {
    let interval;
    if (timerActive && trackingStartTime) {
      interval = setInterval(() => setElapsedSeconds(Math.floor((new Date() - new Date(trackingStartTime)) / 1000)), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, trackingStartTime]);

  const handleStartDelivery = async () => {
    setTrackingStartTime(new Date().toISOString());
    setTimerActive(true);
    setElapsedSeconds(0);
    await updateDoc(doc(db, 'users', user.uid), { isRiding: true, isStealth: false });
  };

  const handleEndDelivery = async () => {
    setTimerActive(false);
    setTrackingStartTime(null);
    await updateDoc(doc(db, 'users', user.uid), { isRiding: false, isStealth: false });
  };
  
  const toggleStealth = async () => {
    await updateDoc(doc(db, 'users', user.uid), { isStealth: !userData.isStealth });
  };

  const getTodaySaved = (device, platform, targetDate) => {
    let amt = 0, cnt = 0;
    (dailyDeliveries || []).forEach(d => {
       if (editingDeliveryShift && editingDeliveryShift.items.some(item => item.id === d.id)) return;
       if (d.date === targetDate && d.device === device && d.platform === platform) {
           amt += (d.amount || 0); cnt += (d.count || 0);
       }
    });
    return { amt, cnt };
  };

  const filteredDailyDeliveries = useMemo(() => {
    let data = dailyDeliveries || [];
    if (deliveryDateRange.start || deliveryDateRange.end) {
      if (deliveryDateRange.start) data = data.filter(d => typeof d?.date === 'string' && d.date >= deliveryDateRange.start);
      if (deliveryDateRange.end) data = data.filter(d => typeof d?.date === 'string' && d.date <= deliveryDateRange.end);
    } else data = data.filter(d => typeof d?.date === 'string' && d.date.startsWith(`${calYear}-${String(calMonth).padStart(2, '0')}`));
    return data;
  }, [dailyDeliveries, calYear, calMonth, deliveryDateRange]);

  const deliveryFilteredTotal = filteredDailyDeliveries.reduce((a,b) => a + (b.amount||0), 0);
  const deliveryFilteredCount = filteredDailyDeliveries.reduce((a,b) => a + (b.count||0), 0);
  const deliveryAvgPerDelivery = deliveryFilteredCount > 0 ? Math.round(deliveryFilteredTotal / deliveryFilteredCount) : 0;
  
  const filteredMainItems = filteredDailyDeliveries.filter(d => d.device === 'main');
  const filteredSubItems = filteredDailyDeliveries.filter(d => d.device === 'sub');

  const dailyShifts = useMemo(() => {
    const shiftsByDate = {};
    filteredDailyDeliveries.forEach(d => {
        if(!d.date) return;
        if(!shiftsByDate[d.date]) shiftsByDate[d.date] = {};
        const shiftKey = (d.startTime && d.endTime) ? `${d.startTime}-${d.endTime}` : `no-time-${d.id}`;
        if(!shiftsByDate[d.date][shiftKey]) { shiftsByDate[d.date][shiftKey] = { id: shiftKey, date: d.date, startTime: d.startTime, endTime: d.endTime, items: [], totalAmt: 0, totalCnt: 0 }; }
        shiftsByDate[d.date][shiftKey].items.push(d);
        shiftsByDate[d.date][shiftKey].totalAmt += (d.amount || 0);
        shiftsByDate[d.date][shiftKey].totalCnt += (d.count || 0);
    });
    const result = {};
    Object.keys(shiftsByDate).sort((a,b)=>new Date(b)-new Date(a)).forEach(date => {
        result[date] = Object.values(shiftsByDate[date]).sort((a,b) => (b.startTime||'').localeCompare(a.startTime||''));
    });
    return result;
  }, [filteredDailyDeliveries]);

  const dailyDates = Object.keys(dailyShifts);

  const pendingByPayday = useMemo(() => {
    const groups = {};
    (dailyDeliveries || []).forEach(d => {
      const pd = getPaydayStr(d.date);
      if (!pd || pd < todayStr) return; 
      if (!groups[pd]) groups[pd] = { total: 0, main: 0, sub: 0, items: [] };
      groups[pd].total += (d.amount || 0);
      if (d.device === 'main') groups[pd].main += (d.amount || 0);
      if (d.device === 'sub') groups[pd].sub += (d.amount || 0);
      groups[pd].items.push(d);
    });
    return groups;
  }, [dailyDeliveries, todayStr]);

  const upcomingPaydays = Object.keys(pendingByPayday).sort();
  
  const paydayGroups = useMemo(() => {
    const groups = {};
    (dailyDeliveries || []).forEach(d => {
      const pd = getPaydayStr(d.date);
      if (!pd) return; 
      if (!groups[pd]) groups[pd] = { total: 0, main: 0, sub: 0, items: [] };
      groups[pd].total += (d.amount||0);
      if (d.device === 'main') groups[pd].main += (d.amount||0);
      if (d.device === 'sub') groups[pd].sub += (d.amount||0);
      groups[pd].items.push(d);
    });
    return groups;
  }, [dailyDeliveries]);
  
  const pastPaydays = Object.keys(paydayGroups).filter(pd => pd < todayStr).sort((a,b) => b.localeCompare(a));

  const monthlyMetrics = useMemo(() => getGroupMetrics(filteredDailyDeliveries), [filteredDailyDeliveries]);
  const yearlyItems = useMemo(() => (dailyDeliveries || []).filter(d => typeof d?.date === 'string' && d.date.startsWith(String(selectedYear))), [dailyDeliveries, selectedYear]);
  const yearlyMetrics = useMemo(() => getGroupMetrics(yearlyItems), [yearlyItems]);
  
  const yearlyMainAmt = yearlyItems.filter(d => d.device === 'main').reduce((a,b)=>a+(b.amount||0), 0);
  const yearlySubAmt = yearlyItems.filter(d => d.device === 'sub').reduce((a,b)=>a+(b.amount||0), 0);

  const handleDeliverySubmit = async (e) => {
    e.preventDefault(); if (!user) return;
    const timestamp = new Date().toISOString(); 
    const adds = [];

    if (!editingDeliveryShift && timerActive) {
        handleEndDelivery();
    }

    const createAdd = (inputAmtStr, inputCntStr, device, platform) => {
      const inputAmt = parseInt(String(inputAmtStr||0).replace(/,/g, ''), 10) || 0;
      const inputCnt = parseInt(String(inputCntStr||0).replace(/,/g, ''), 10) || 0;
      if(inputAmt === 0 && inputCnt === 0) return;
      
      const saved = getTodaySaved(device, platform, deliveryFormData.date);
      const finalAmt = Math.max(0, inputAmt - saved.amt);
      const finalCnt = Math.max(0, inputCnt - saved.cnt);
      
      if(finalAmt > 0 || finalCnt > 0) {
         adds.push({ 
           userId: user.uid,
           date: deliveryFormData.date, 
           device, 
           platform, 
           amount: finalAmt, 
           count: finalCnt, 
           startTime: deliveryFormData.startTime, 
           endTime: deliveryFormData.endTime, 
           updatedAt: timestamp, 
           nickname: userData.nickname 
         });
      }
    };

    createAdd(deliveryFormData.mainBaeminAmt, deliveryFormData.mainBaeminCnt, 'main', '배민');
    createAdd(deliveryFormData.mainCoupangAmt, deliveryFormData.mainCoupangCnt, 'main', '쿠팡');
    
    if (deliveryFormData.useTwoPhones) {
        createAdd(deliveryFormData.subBaeminAmt, deliveryFormData.subBaeminCnt, 'sub', '배민');
        createAdd(deliveryFormData.subCoupangAmt, deliveryFormData.subCoupangCnt, 'sub', '쿠팡');
    }

    if (adds.length > 0) {
      if (editingDeliveryShift) {
          for(const item of editingDeliveryShift.items) { await deleteDoc(doc(db, 'delivery', item.id)); }
          for(const newDel of adds) { await addDoc(collection(db, 'delivery'), newDel); }
      } else {
          for(const newDel of adds) await addDoc(collection(db, 'delivery'), newDel);
      }
    }
    
    if (splitQueue.length > 0) {
       const nextShift = splitQueue[0];
       setDeliveryFormData({
           ...emptyForm,
           date: nextShift.date,
           startTime: nextShift.startTime,
           endTime: nextShift.endTime
       });
       setSplitQueue(splitQueue.slice(1));
    } else {
       localStorage.removeItem('baesamoRecoveryShift');
       setRecoveryShift(null);
       setIsDeliveryModalOpen(false); 
       setEditingDeliveryShift(null);
    }
  };

  const openEditShiftForm = (shift) => {
    let hasSubData = shift.items.some(i => i.device === 'sub');
    const form = { ...emptyForm, date: shift.date, startTime: shift.startTime || '', endTime: shift.endTime || '', useTwoPhones: hasSubData };
    
    const platforms = ['배민', '쿠팡'];
    const devices = ['main', 'sub'];
    
    devices.forEach(device => {
        platforms.forEach(platform => {
            const deviceEng = device === 'main' ? 'main' : 'sub';
            const platformEng = platform === '배민' ? 'Baemin' : 'Coupang';
            
            let priorAmt = 0; let priorCnt = 0;
            (dailyDeliveries || []).forEach(d => {
                if (shift.items.some(item => item.id === d.id)) return;
                if (d.date === shift.date && d.device === device && d.platform === platform) {
                    priorAmt += (d.amount || 0); priorCnt += (d.count || 0);
                }
            });
            
            const thisItem = shift.items.find(i => i.device === device && i.platform === platform);
            const thisAmt = thisItem ? (thisItem.amount || 0) : 0;
            const thisCnt = thisItem ? (thisItem.count || 0) : 0;
            
            const cumulativeAmt = priorAmt + thisAmt;
            const cumulativeCnt = priorCnt + thisCnt;
            
            if (cumulativeAmt > 0 || cumulativeCnt > 0) {
                form[`${deviceEng}${platformEng}Amt`] = String(cumulativeAmt);
                form[`${deviceEng}${platformEng}Cnt`] = String(cumulativeCnt);
            }
        });
    });

    setDeliveryFormData(form); setEditingDeliveryShift(shift); setSelectedShiftDetail(null); setIsDeliveryModalOpen(true); 
  };

  const deleteShift = async (shift) => {
    if(!window.confirm('이 시간대의 기록을 통째로 모두 삭제하시겠습니까?')) return;
    for(const item of shift.items) { await deleteDoc(doc(db, 'delivery', item.id)); }
    setSelectedShiftDetail(null);
  };

  const handleToggleMergeShift = (shiftId) => {
      setSelectedShiftsToMerge(prev => prev.includes(shiftId) ? prev.filter(id => id !== shiftId) : [...prev, shiftId]);
  };

  const executeShiftMerge = async (date) => {
      if (selectedShiftsToMerge.length < 2) {
          alert("통합할 회차를 2개 이상 선택해주세요!");
          return;
      }
      if (!window.confirm(`선택한 ${selectedShiftsToMerge.length}개의 회차를 하나로 완벽하게 통합하시겠습니까?\n(시작~종료 시간이 자동으로 합쳐집니다)`)) return;
      
      const shifts = dailyShifts[date].filter(s => selectedShiftsToMerge.includes(s.id));
      let allItems = [];
      shifts.forEach(s => allItems.push(...s.items));
      
      let minStart = "23:59";
      let maxEnd = "00:00";
      allItems.forEach(item => {
          if (item.startTime && item.startTime < minStart) minStart = item.startTime;
          if (item.endTime && item.endTime > maxEnd) maxEnd = item.endTime;
      });
      if (minStart === "23:59") minStart = "";
      if (maxEnd === "00:00") maxEnd = "";

      const aggregated = {};
      allItems.forEach(item => {
          const key = `${item.device}-${item.platform}`;
          if (!aggregated[key]) {
              aggregated[key] = { device: item.device, platform: item.platform, amount: 0, count: 0 };
          }
          aggregated[key].amount += (item.amount || 0);
          aggregated[key].count += (item.count || 0);
      });

      const timestamp = new Date().toISOString();
      for (const item of allItems) { await deleteDoc(doc(db, 'delivery', item.id)); }
      for (const val of Object.values(aggregated)) {
          if (val.amount > 0 || val.count > 0) {
              await addDoc(collection(db, 'delivery'), {
                  userId: user.uid,
                  date: date,
                  device: val.device,
                  platform: val.platform,
                  amount: val.amount,
                  count: val.count,
                  startTime: minStart,
                  endTime: maxEnd,
                  updatedAt: timestamp,
                  nickname: userData.nickname
              });
          }
      }
      
      setMergeModeDate(null);
      setSelectedShiftsToMerge([]);
      alert("✨ 성공적으로 회차 통합이 완료되었습니다!");
  };

  const handleCloseDeliveryModal = () => {
     if (editingDeliveryShift) {
         if(window.confirm("수정 중인 내용을 취소하시겠습니까?")) setIsDeliveryModalOpen(false);
     } else if (timerActive) {
         setShowCloseConfirm(true);
     } else {
         if (window.confirm("창을 닫으시겠습니까?\n(임시 보관함에 유지됩니다)")) {
             setIsDeliveryModalOpen(false);
             if (deliveryFormData.startTime) {
                 const recoveryData = { formData: deliveryFormData, splitQueue: splitQueue };
                 localStorage.setItem('baesamoRecoveryShift', JSON.stringify(recoveryData));
                 setRecoveryShift(recoveryData);
             }
         }
     }
  };

  const NetDiffInfo = ({ device, platform, inputAmt, inputCnt, date }) => {
     const saved = getTodaySaved(device, platform, date);
     if (saved.amt === 0 && saved.cnt === 0) return null;
     const netAmt = Math.max(0, (parseInt(String(inputAmt).replace(/,/g,''))||0) - saved.amt);
     return (
         <div className="text-[11px] text-blue-600 ml-[68px] font-black flex items-center gap-1 mt-1 pb-1 tracking-tight">
             <span className="opacity-80">↳ 누적 {formatLargeMoney(saved.amt)} ➔</span> <span className="text-rose-500 font-black">실적: +{formatLargeMoney(netAmt)}</span>
         </div>
     )
  };

  return (
    <div className="flex flex-col gap-2 pb-8 pt-1 animate-in fade-in duration-500 text-slate-800 min-h-[80vh]">
      
      {recoveryShift && !timerActive && (
         <div className="bg-red-50 border border-red-200 rounded-2xl p-3 shadow-sm flex flex-col gap-2 animate-in slide-in-from-top-2 mx-1 mt-2">
            <div className="flex items-center gap-2">
               <AlertCircle size={16} className="text-red-600" />
               <span className="text-xs font-black text-red-700">저장 안 된 마감 기록이 있습니다!</span>
            </div>
            <div className="flex gap-2 justify-end">
                <button onClick={() => {
                    if(window.confirm('임시 기록을 영구 삭제하시겠습니까?')) {
                        localStorage.removeItem('baesamoRecoveryShift'); setRecoveryShift(null);
                    }
                }} className="bg-white text-red-500 border border-red-200 text-[10px] px-3 py-1.5 rounded-lg font-bold shadow-sm active:scale-95">삭제</button>
                <button onClick={() => {
                    setDeliveryFormData(recoveryShift.formData);
                    setSplitQueue(recoveryShift.splitQueue || []);
                    setIsDeliveryModalOpen(true);
                }} className="bg-red-600 text-white text-xs px-4 py-1.5 rounded-lg font-black shadow-md active:scale-95">마감 이어쓰기 🚀</button>
            </div>
         </div>
      )}

      {/* 프리미엄 타이머 카드 */}
      <div className={`mx-1 rounded-[2rem] p-5 shadow-lg transition-all duration-700 mt-2 ${timerActive ? (userData.isStealth ? 'bg-gradient-to-br from-gray-700 to-gray-900 ring-4 ring-gray-400' : 'bg-gradient-to-br from-blue-600 to-indigo-800 ring-4 ring-blue-100 shadow-[0_10px_20px_rgba(37,99,235,0.3)]') : 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-md'}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3 ml-1">
            <div className={`p-3 rounded-2xl ${timerActive ? 'bg-white/20 text-white animate-pulse shadow-inner' : 'bg-slate-700 text-slate-300 shadow-inner'}`}>
               {userData.isStealth ? <Ghost size={24} /> : <Timer size={24} />}
            </div>
            <div>
              <div className={`text-[11px] font-black flex items-center mb-0.5 ${timerActive ? 'text-blue-100' : 'text-slate-200'}`}>
                {userData.isStealth ? 'Stealth Mode On' : 'Live Tracking'}
                {timerActive && <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse shadow-sm ml-1.5 ${userData.isStealth ? 'bg-gray-400' : 'bg-red-400'}`}></span>}
                {trackingStartTime && timerActive && (
                   <span className="ml-2 text-[10px] text-blue-100 font-bold bg-white/10 px-1.5 py-0.5 rounded shadow-sm border border-blue-300/30 tracking-tighter">
                       {new Date(trackingStartTime).getHours().toString().padStart(2,'0')}:{new Date(trackingStartTime).getMinutes().toString().padStart(2,'0')} 시작
                   </span>
                )}
              </div>
              <div className={`text-[32px] font-black tracking-tighter leading-none text-white drop-shadow-md`}>
                 {timerActive && trackingStartTime ? `${Math.floor(elapsedSeconds/3600).toString().padStart(2,'0')}:${String(Math.floor((elapsedSeconds%3600)/60)).padStart(2,'0')}:${String(elapsedSeconds%60).padStart(2,'0')}` : '00:00:00'}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
             <button onClick={() => { 
               if(timerActive) {
                 const endObj = new Date();
                 const startObj = new Date(trackingStartTime);
                 const startDateStr = getKSTDateStrFromDate(startObj);
                 const endDateStr = getKSTDateStrFromDate(endObj);
                 if (startDateStr !== endDateStr) {
                     setDeliveryFormData({ ...emptyForm, date: startDateStr, startTime: formatTimeStr(startObj), endTime: '23:59' });
                     setSplitQueue([{ date: endDateStr, startTime: '00:00', endTime: formatTimeStr(endObj) }]);
                 } else {
                     setDeliveryFormData({ ...emptyForm, date: startDateStr, startTime: formatTimeStr(startObj), endTime: formatTimeStr(endObj) });
                     setSplitQueue([]);
                 }
                 setEditingDeliveryShift(null); 
                 setIsDeliveryModalOpen(true);
               } else {
                 handleStartDelivery();
               }
             }} className={`px-5 py-3 rounded-[1.2rem] font-black text-sm shadow-md transition-all active:scale-95 ${timerActive ? 'bg-white text-blue-700 hover:bg-blue-50' : 'bg-white/20 text-white border border-white/20 hover:bg-white/30'}`}>
               {timerActive ? '마감하기' : '배달 시작'}
             </button>
             {timerActive && (
               <button onClick={toggleStealth} className={`text-[10px] px-3 py-1.5 rounded-lg font-black flex items-center gap-1 transition-all shadow-sm ${userData.isStealth ? 'bg-gray-800 text-gray-200 border border-gray-600' : 'bg-blue-800/50 text-blue-100 border border-blue-400/30'}`}>
                  <Ghost size={12}/> {userData.isStealth ? '스텔스 끄기' : '스텔스 켜기'}
               </button>
             )}
          </div>
        </div>
      </div>

      {/* 요약 카드 영역 */}
      <div className="mb-1 mx-1 mt-2">
        {isYearlySummaryOpen ? (
          <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden mb-1 animate-in fade-in" onClick={() => setIsYearlySummaryOpen(false)}>
            <Bike className="absolute -right-2 -bottom-2 w-32 h-32 opacity-10 rotate-12" fill="white" />
            <div className="flex justify-between items-end mb-4 relative z-10 cursor-pointer gap-2">
              <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black opacity-90 mb-1 flex items-center gap-1 text-slate-300 whitespace-nowrap">
                   <ChevronUp size={16}/> {selectedYear}년 누적 배달 수익
                </div>
                <div className="inline-flex items-baseline bg-black/20 px-2 py-1.5 rounded-2xl border border-white/10 shadow-inner mt-1 max-w-full overflow-hidden">
                   <span className="text-[24px] font-black tracking-tighter text-white leading-none truncate">{formatLargeMoney(yearlyMetrics.totalAmt)}</span>
                   <span className="text-[11px] ml-0.5 font-bold text-slate-300 shrink-0">원</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex flex-col items-end gap-1.5 text-[9px] font-bold opacity-90 pb-1 whitespace-nowrap tracking-tighter">
                   <span className="flex gap-1.5 text-slate-100"><span>총 {formatLargeMoney(yearlyMetrics.totalCnt)}건</span><span>{yearlyMetrics.durationStr} 근무</span></span>
                   <span className="flex gap-1.5 text-slate-300"><span>평단 {formatLargeMoney(yearlyMetrics.perDelivery)}원</span><span>시급 {formatLargeMoney(yearlyMetrics.hourlyRate)}원</span></span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-3 relative z-10">
               <div className="bg-white/10 rounded-xl p-2.5 flex flex-col gap-1 border border-white/20 shadow-sm">
                 <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-300">기본기기</span><span className="text-[13px] font-black text-white">{formatLargeMoney(yearlyMainAmt)}원</span></div>
                 <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-300">투폰(서브)</span><span className="text-[13px] font-black text-white">{formatLargeMoney(yearlySubAmt)}원</span></div>
               </div>
               <div className="bg-white/10 rounded-xl p-2.5 flex flex-col gap-1 border border-white/20 shadow-sm">
                 <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-[#4cd1cc]">배민</span><span className="text-[13px] font-black text-white">{formatLargeMoney(yearlyItems.filter(d=>d.platform==='배민').reduce((a,b)=>a+(b.amount||0),0))}원</span></div>
                 <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-300">쿠팡</span><span className="text-[13px] font-black text-white">{formatLargeMoney(yearlyItems.filter(d=>d.platform==='쿠팡').reduce((a,b)=>a+(b.amount||0),0))}원</span></div>
               </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex justify-between items-center cursor-pointer text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setIsYearlySummaryOpen(true)}>
             <span className="text-sm font-black flex items-center gap-1.5">🗓️ {selectedYear}년 누적 수익 확인</span>
             <ChevronDownSquare size={18} className="text-slate-400" />
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-1 mx-1">
        <button onClick={() => { setIsDeliverySummaryOpen(!isDeliverySummaryOpen); setIsPendingSummaryOpen(false); setIsYearlySummaryOpen(false); }} className={`flex-1 py-3.5 rounded-2xl border text-[13px] font-black transition-colors shadow-sm flex justify-center items-center gap-1.5 ${isDeliverySummaryOpen ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
           🏍️ {calMonth}월 수익 확인 {isDeliverySummaryOpen ? '∧' : '∨'}
        </button>
        <button onClick={() => { setIsPendingSummaryOpen(!isPendingSummaryOpen); setIsDeliverySummaryOpen(false); setIsYearlySummaryOpen(false); }} className={`flex-1 py-3.5 rounded-2xl border text-[13px] font-black transition-colors shadow-sm flex justify-center items-center gap-1.5 ${isPendingSummaryOpen ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
           💰 정산 예정금 {isPendingSummaryOpen ? '∧' : '∨'}
        </button>
      </div>

      <div className="mx-1">
        {isDeliverySummaryOpen && (() => {
            const baeminTotal = filteredDailyDeliveries.filter(d=>d.platform==='배민').reduce((a,b)=>a+(b.amount||0),0);
            const coupangTotal = filteredDailyDeliveries.filter(d=>d.platform==='쿠팡').reduce((a,b)=>a+(b.amount||0),0);

            return (
              <div className="bg-gradient-to-br from-blue-700 to-indigo-800 rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden mb-2 animate-in slide-in-from-top-2" onClick={() => setIsDeliverySummaryOpen(false)}>
                <Bike className="absolute -right-2 -bottom-2 w-32 h-32 opacity-10 rotate-12" fill="white" />
                
                <div className="flex flex-col mb-4 relative z-10 cursor-pointer">
                    <div className="text-[11px] font-black opacity-90 mb-1 flex items-center gap-1">
                        <ChevronUp size={14}/> {(deliveryDateRange.start || deliveryDateRange.end) ? '지정 기간 수익' : `${calMonth}월 수익 현황`}
                    </div>
                    <div className="flex justify-between items-end">
                       <div className="text-[32px] font-black tracking-tighter leading-none">{formatLargeMoney(deliveryFilteredTotal)}<span className="text-base ml-1 opacity-80 font-bold">원</span></div>
                       <div className="flex flex-col items-end gap-1.5 text-[10px] font-bold opacity-90 pb-1">
                          <span className="flex gap-2"><span>총 {formatLargeMoney(deliveryFilteredCount)}건</span><span>{monthlyMetrics.durationStr} 근무</span></span>
                          <span className="flex gap-2 text-blue-200"><span>평단 {formatLargeMoney(deliveryAvgPerDelivery)}원</span><span>시급 {formatLargeMoney(monthlyMetrics.hourlyRate)}원</span></span>
                       </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 relative z-10">
                   <div className="bg-white/10 rounded-xl p-2.5 flex flex-col gap-1 border border-white/20 shadow-sm">
                     <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-blue-200">기본기기</span><span className="text-[13px] font-black text-white">{formatLargeMoney(filteredMainItems.reduce((a,b)=>a+(b.amount||0),0))}원</span></div>
                     <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-blue-200">투폰(서브)</span><span className="text-[13px] font-black text-white">{formatLargeMoney(filteredSubItems.reduce((a,b)=>a+(b.amount||0),0))}원</span></div>
                   </div>
                   <div className="bg-white/10 rounded-xl p-2.5 flex flex-col gap-1 border border-white/20 shadow-sm">
                     <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-[#4cd1cc]">배민</span><span className="text-[13px] font-black text-white">{formatLargeMoney(baeminTotal)}원</span></div>
                     <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-blue-200">쿠팡</span><span className="text-[13px] font-black text-white">{formatLargeMoney(coupangTotal)}원</span></div>
                   </div>
                </div>
              </div>
            );
        })()}
      </div>

      {isPendingSummaryOpen && (() => {
        const upcomingToDisplay = upcomingPaydays.slice(0, 2);
        return (
            <div className="grid grid-cols-2 gap-2 mb-2 animate-in slide-in-from-top-2 mx-1">
              {upcomingToDisplay.length === 0 ? (
                <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-200 text-center text-slate-500 text-sm font-black">입금 대기 중인 정산금이 없습니다.</div>
              ) : (
                upcomingToDisplay.map((pd, idx) => {
                  const group = pendingByPayday[pd];
                  const metrics = getGroupMetrics(group.items);
                  
                  const baeminTot = group.items.filter(d=>d.platform==='배민').reduce((a,b)=>a+(b.amount||0),0);
                  const coupangTot = group.items.filter(d=>d.platform==='쿠팡').reduce((a,b)=>a+(b.amount||0),0);

                  return (
                    <div key={pd} onClick={() => setSelectedWeeklySummary(pd)} className={`rounded-[2rem] p-5 shadow-lg border bg-gradient-to-br from-teal-700 to-cyan-800 border-teal-600 flex flex-col justify-between cursor-pointer active:scale-95 transition-transform text-white relative overflow-hidden col-span-2`}>
                      <Bike className="absolute -right-2 -bottom-2 w-32 h-32 opacity-10 rotate-12" fill="white" />
                      <div className="flex flex-col mb-4 relative z-10">
                          <div className="text-[11px] font-black opacity-90 mb-1 flex items-center gap-1">
                             <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shadow-sm border ${idx === 0 ? 'bg-white text-teal-700 border-white' : 'bg-teal-600 text-white border-teal-500'}`}>{idx === 0 ? '이번주' : '다음주'}</span>
                             <span className="text-teal-50">{pd.slice(5).replace('-','/')} 정산예정</span>
                          </div>
                          <div className="flex justify-between items-end">
                             <div className={`text-[32px] font-black tracking-tighter leading-none mt-1`}>{formatLargeMoney(group.total)}<span className="text-base font-bold ml-1 opacity-80">원</span></div>
                             <div className="flex flex-col items-end gap-1.5 text-[10px] font-bold opacity-90 pb-1">
                                <span className="flex gap-2 text-teal-50"><span>총 {formatLargeMoney(metrics.totalCnt)}건</span><span>{metrics.durationStr} 근무</span></span>
                                <span className="flex gap-2 text-teal-200"><span>평단 {formatLargeMoney(metrics.perDelivery)}원</span><span>시급 {formatLargeMoney(metrics.hourlyRate)}원</span></span>
                             </div>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 relative z-10">
                         <div className="bg-white/10 rounded-xl p-2.5 flex flex-col gap-1 border border-white/20 shadow-sm">
                           <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-teal-100">기본기기</span><span className="text-[13px] font-black text-white">{formatLargeMoney(group.main || 0)}원</span></div>
                           <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-teal-100">투폰(서브)</span><span className="text-[13px] font-black text-white">{formatLargeMoney(group.sub || 0)}원</span></div>
                         </div>
                         <div className="bg-white/10 rounded-xl p-2.5 flex flex-col gap-1 border border-white/20 shadow-sm">
                           <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-[#a5f3fc]">배민</span><span className="text-[13px] font-black text-white">{formatLargeMoney(baeminTot)}원</span></div>
                           <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-teal-100">쿠팡</span><span className="text-[13px] font-black text-white">{formatLargeMoney(coupangTot)}원</span></div>
                         </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
        );
      })()}

      <div className="flex items-center gap-2 mt-2 mx-1">
        <div className="flex bg-white p-1 rounded-2xl flex-1 shadow-sm border border-slate-200">
          <button onClick={() => setDeliverySubTab('daily')} className={`flex-1 py-3 rounded-[1rem] text-[13px] font-black transition-all ${deliverySubTab==='daily'?'bg-blue-600 text-white shadow-md':'text-slate-500 hover:bg-slate-50'}`}>상세내역</button>
          <button onClick={() => setDeliverySubTab('calendar')} className={`flex-1 py-3 rounded-[1rem] text-[13px] font-black transition-all ${deliverySubTab==='calendar'?'bg-blue-600 text-white shadow-md':'text-slate-500 hover:bg-slate-50'}`}>달력</button>
          <button onClick={() => setDeliverySubTab('weekly')} className={`flex-1 py-3 rounded-[1rem] text-[13px] font-black transition-all ${deliverySubTab==='weekly'?'bg-blue-600 text-white shadow-md':'text-slate-500 hover:bg-slate-50'}`}>주차별</button>
        </div>
        <button onClick={() => setShowDeliveryFilters(!showDeliveryFilters)} className={`p-3.5 rounded-2xl transition-colors shadow-sm border ${showDeliveryFilters ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}><Filter size={20} /></button>
      </div>

      {showDeliveryFilters && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-200 animate-in slide-in-from-top-2 mx-1 mt-2">
          <div className="flex items-center gap-2">
            <input type="date" value={deliveryDateRange.start} onChange={(e) => setDeliveryDateRange({...deliveryDateRange, start: e.target.value})} className="flex-1 bg-slate-50 rounded-xl px-2 h-[44px] text-sm font-black outline-none border border-slate-200 focus:border-blue-500 text-slate-800" />
            <span className="text-slate-400 font-black">~</span>
            <input type="date" value={deliveryDateRange.end} onChange={(e) => setDeliveryDateRange({...deliveryDateRange, end: e.target.value})} className="flex-1 bg-slate-50 rounded-xl px-2 h-[44px] text-sm font-black outline-none border border-slate-200 focus:border-blue-500 text-slate-800" />
          </div>
          <button onClick={() => setDeliveryDateRange({start:'', end:''})} className="w-full mt-3 bg-slate-100 border border-slate-200 text-slate-600 py-3 rounded-xl font-black text-sm flex justify-center items-center gap-1.5 active:bg-slate-200 transition-colors"><RefreshCw size={14}/> 초기화</button>
        </div>
      )}

      {deliverySubTab === 'calendar' && (() => {
        const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth, 0).getDate();
        const days = Array(firstDay).fill(null).concat(Array.from({length:daysInMonth}, (_,i)=>i+1));
        const dataByDate = {};
        (dailyDeliveries || []).forEach(d => { 
           if(d.date && d.date.startsWith(`${calYear}-${String(calMonth).padStart(2, '0')}`)) { 
               if(!dataByDate[d.date]) dataByDate[d.date] = { amt: 0 }; 
               dataByDate[d.date].amt += (d.amount||0); 
           } 
        });
        return (
          <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-blue-200 animate-in slide-in-from-bottom-2 mt-3 mx-1">
             <div className="flex justify-between items-center px-3 mb-4 mt-1">
                <button onClick={() => { if(calMonth===1){setCalMonth(12); setCalYear(calYear-1);} else setCalMonth(calMonth-1); }} className="p-2 bg-slate-50 text-blue-600 rounded-xl border border-slate-200 shadow-sm active:scale-95"><ChevronLeft size={18}/></button>
                <span className="font-black text-slate-800 text-[17px]">{calYear}년 {calMonth}월</span>
                <button onClick={() => { if(calMonth===12){setCalMonth(1); setCalYear(calYear+1);} else setCalMonth(calMonth+1); }} className="p-2 bg-slate-50 text-blue-600 rounded-xl border border-slate-200 shadow-sm active:scale-95"><ChevronRight size={18}/></button>
             </div>

             <div className="grid grid-cols-7 gap-1 text-center mb-2">{['일','월','화','수','목','금','토'].map((d,i) => <div key={d} className={`text-[11px] font-black ${i===0?'text-red-500':i===6?'text-blue-500':'text-slate-500'}`}>{d}</div>)}</div>
             <div className="grid grid-cols-7 gap-1">
               {days.map((d, i) => {
                 if(!d) return <div key={`empty-${i}`} className="h-[65px] bg-slate-50 rounded-xl border border-slate-100"></div>;
                 const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                 const dayData = dataByDate[dateStr] || { amt: 0 };
                 const isToday = dateStr === todayStr;
                 const dayIndex = (i % 7);
                 const isRed = dayIndex === 0;
                 const isBlue = dayIndex === 6;
                 const dayColor = isRed ? 'text-red-500' : isBlue ? 'text-blue-500' : 'text-slate-800';
                 
                 return (
                   <div key={`day-${i}`} onClick={() => { if(dayData.amt > 0) setSelectedDailySummary(dateStr); }} className={`h-[65px] border rounded-xl p-1 flex flex-col items-center justify-center ${dayData.amt>0?'border-blue-300 bg-blue-50/80 shadow-sm cursor-pointer active:scale-95 transition-transform':'border-slate-200 bg-white'} ${isToday ? 'ring-2 ring-blue-500 ring-offset-1 z-10 shadow-md' : ''}`}>
                     <span className={`text-[13px] font-black mb-1 ${dayColor}`}>{d}</span>
                     {dayData.amt > 0 && <span className="text-[10px] font-black text-blue-600 w-full text-center truncate tracking-tighter">{formatCompactMoney(dayData.amt).replace('+','')}</span>}
                   </div>
                 )
               })}
             </div>
          </div>
        );
      })()}

      {deliverySubTab === 'weekly' && (
        <div className="space-y-3 animate-in slide-in-from-right duration-300 mt-3 mx-1">
          {pastPaydays.map(pDate => {
             const group = paydayGroups[pDate];
             const metrics = getGroupMetrics(group.items);
             
             const baeminTot = group.items.filter(d=>d.platform==='배민').reduce((a,b)=>a+(b.amount||0),0);
             const coupangTot = group.items.filter(d=>d.platform==='쿠팡').reduce((a,b)=>a+(b.amount||0),0);
             const etcTot = group.total - baeminTot - coupangTot;

             return (
               <div key={pDate} onClick={() => setSelectedWeeklySummary(pDate)} className="bg-white rounded-[1.5rem] py-5 px-5 shadow-sm border border-slate-200 cursor-pointer active:scale-95 transition-transform">
                 <div className="flex justify-between items-end mb-1">
                   <div className="flex items-center gap-2">
                       <span className="font-black text-slate-800 text-lg tracking-tight">{parseInt(pDate.slice(5,7))}월 {getWeekOfMonth(pDate)}주차</span>
                       <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg font-bold">{pDate.slice(5).replace('-', '/')} 정산완료</span>
                   </div>
                    <div className="text-[20px] font-black text-slate-700 leading-none tracking-tighter">{formatLargeMoney(group.total)}원</div>
                 </div>
                 
                 <div className="text-[11px] font-bold text-slate-500 mt-1.5 mb-3 flex justify-end gap-3">
                   <span className="text-[#1f938f]">배민 {formatLargeMoney(baeminTot)}</span>
                   <span className="text-slate-600">쿠팡 {formatLargeMoney(coupangTot)}</span>
                   {etcTot > 0 && <span className="text-slate-400">기타 {formatLargeMoney(etcTot)}</span>}
                 </div>

                 <div className="flex justify-between items-center text-[12px] text-slate-500 font-bold bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-inner">
                    <span className="flex items-center gap-1.5"><Timer size={14} className="text-slate-400"/>{metrics.durationStr || '-'}</span>
                    <span className="flex items-center gap-1.5"><Bike size={14} className="text-slate-400"/>총 <span className="font-black text-slate-800">{metrics.totalCnt}</span>건</span>
                    <span className="flex items-center gap-1.5 text-blue-600"><Coins size={14} className="text-blue-500"/>시급 <span className="font-black">{formatLargeMoney(metrics.hourlyRate)}</span>원</span>
                 </div>
               </div>
             )
          })}
        </div>
      )}

      {deliverySubTab === 'daily' && (
        <div className="space-y-3 animate-in slide-in-from-left duration-300 mt-3 mx-1">
          {dailyDates.map(date => {
            const shiftList = dailyShifts[date] || [];
            const allItemsForDay = shiftList.flatMap(s => s.items);
            const dayMetrics = calcDailyMetrics(allItemsForDay);
            
            const dateObj = new Date(date);
            const dayIndex = dateObj.getDay();
            const dayName = ['일','월','화','수','목','금','토'][dayIndex];
            const dateColorClass = (dayIndex === 0) ? 'text-red-500' : dayIndex === 6 ? 'text-blue-600' : 'text-slate-900';
            
            return (
              <div key={date} className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                 
                 <div className="p-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setSelectedDailySummary(date)}>
                     <div className="flex justify-between items-end mb-1.5">
                        <div className={`text-[15px] font-black text-slate-800 tracking-tight flex items-center gap-1.5 ${dateColorClass}`}>
                            <span>{date.slice(5).replace('-','/')} ({dayName})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] font-black text-slate-500">총 {dayMetrics.totalCnt}건</span>
                            <span className="text-[18px] font-black text-blue-600 leading-none">{formatLargeMoney(dayMetrics.totalAmt)}원</span>
                        </div>
                     </div>
                     <div className="flex justify-between items-center mt-2.5">
                        <div className="text-[12px] font-black text-slate-800 flex items-center gap-1">
                            <Clock size={12} className="text-slate-400"/> {dayMetrics.durationStr}
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <span className="bg-slate-50 text-[10px] font-bold text-slate-500 px-2 py-1 rounded border border-slate-200 shadow-sm">평단 {formatLargeMoney(dayMetrics.perDelivery)}</span>
                            {dayMetrics.hourlyRate > 0 && <span className="bg-blue-50 text-[10px] font-bold text-blue-600 px-2 py-1 rounded border border-blue-200 shadow-sm">시급 {formatLargeMoney(dayMetrics.hourlyRate)}</span>}
                        </div>
                     </div>
                 </div>

                 {/* 회차 통합하기 버튼 UI */}
                 <div className="border-t border-slate-100 bg-slate-50 flex justify-between items-center pr-3">
                    <button onClick={(e) => toggleDailyDate(date, e)} className="flex-1 py-3 flex justify-center items-center gap-1 text-[12px] font-black text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 transition-colors active:bg-slate-100">
                       {expandedDailyDates[date] ? <>▲ 회차별 상세 닫기</> : <>▼ 회차별 상세 보기</>}
                    </button>
                    {expandedDailyDates[date] && shiftList.length > 1 && (
                       <div className="shrink-0">
                           {mergeModeDate === date ? (
                               <div className="flex gap-1.5 animate-in fade-in">
                                   <button onClick={() => {setMergeModeDate(null); setSelectedShiftsToMerge([]);}} className="px-2.5 py-1.5 bg-gray-200 text-gray-700 text-[10px] font-black rounded-lg active:scale-95">취소</button>
                                   <button onClick={() => executeShiftMerge(date)} className="px-2.5 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg shadow-sm active:scale-95">통합 실행</button>
                               </div>
                           ) : (
                               <button onClick={() => {setMergeModeDate(date); setSelectedShiftsToMerge([]);}} className="px-2.5 py-1.5 bg-slate-200 text-slate-700 text-[10px] font-black rounded-lg shadow-sm active:scale-95 flex items-center gap-1 animate-in fade-in">🔗 회차 통합</button>
                           )}
                       </div>
                    )}
                 </div>

                 {expandedDailyDates[date] && (
                     <div className="px-4 pb-4 space-y-2 bg-slate-50 animate-in slide-in-from-top-2 duration-300">
                        {shiftList.map((shift, index) => {
                        const shiftOrder = shiftList.length - index;
                        let shiftDurationStr = '';
                        let shiftHourlyRate = 0;
                        
                        if (shift.startTime && shift.endTime) {
                            let [sh, sm] = shift.startTime.split(':').map(Number);
                            let [eh, em] = shift.endTime.split(':').map(Number);
                            let startMins = sh * 60 + sm;
                            let endMins = eh * 60 + em;
                            if (endMins <= startMins) endMins += 1440;
                            let totalMins = endMins - startMins;
                            let h = Math.floor(totalMins / 60);
                            let m = totalMins % 60;
                            shiftDurationStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                            shiftHourlyRate = totalMins > 0 ? Math.round(shift.totalAmt / (totalMins / 60)) : 0;
                        }
                        
                        const platforms = Array.from(new Set(shift.items.map(item => item.platform)));
                        const isMergeActive = mergeModeDate === date;
                        const isSelectedForMerge = selectedShiftsToMerge.includes(shift.id);

                        return (
                          <div key={shift.id} onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isMergeActive) handleToggleMergeShift(shift.id);
                                  else setSelectedShiftDetail(shift); 
                              }} 
                              className={`flex justify-between items-center p-3 rounded-2xl border cursor-pointer active:scale-95 shadow-sm mt-2 transition-all ${isMergeActive ? (isSelectedForMerge ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300' : 'bg-white border-slate-300 grayscale opacity-60') : 'bg-gradient-to-br from-slate-500 to-indigo-600 border-white/10 text-white hover:from-slate-600 hover:to-indigo-700'}`}>
                              
                              {/* 통합 모드 체크박스 */}
                              {isMergeActive && (
                                  <div className="mr-3 shrink-0 flex items-center justify-center">
                                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelectedForMerge ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                          {isSelectedForMerge && <CheckCircle2 size={14} className="text-white"/>}
                                      </div>
                                  </div>
                              )}

                              <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="flex flex-col items-center justify-center shrink-0 w-[36px] gap-0.5">
                                      <span className={`text-[11px] font-black px-1.5 py-0.5 rounded border shadow-sm leading-none ${isMergeActive ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/20 text-white border-white/20'}`}>{shiftOrder}차</span>
                                      {shiftDurationStr && <span className={`text-[9px] font-bold tracking-tighter leading-none ${isMergeActive ? 'text-slate-500' : 'text-indigo-100'}`}>({shiftDurationStr})</span>}
                                  </div>
                                  <div className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${isMergeActive ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white/20 text-white border-white/20'}`}>
                                      <div className="text-[18px] font-black leading-none">{shift.totalCnt}</div>
                                  </div>
                                  <div className="pl-1 flex-1 min-w-0 flex flex-col justify-center gap-1">
                                      <div className={`font-bold text-[13px] shrink-0 tracking-tight leading-none ${isMergeActive ? 'text-slate-800' : 'text-white'}`}>
                                         {shift.startTime && shift.endTime ? `${shift.startTime}~${shift.endTime}` : '시간 미지정'}
                                      </div>
                                      <div className="flex gap-1 items-center flex-wrap">
                                         {platforms.map(p => (
                                            <span key={p} className={`text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm leading-none ${isMergeActive ? (p === '배민' ? 'bg-[#2ac1bc]/20 text-[#1f938f] border-[#2ac1bc]/30' : 'bg-slate-200 text-slate-600 border-slate-300') : (p === '배민' ? 'bg-[#2ac1bc]/80 text-white border-[#2ac1bc]/50' : 'bg-slate-800/50 text-white border-slate-600')}`}>
                                               {p}
                                            </span>
                                         ))}
                                      </div>
                                  </div>
                              </div>
                              <div className="flex flex-col items-end shrink-0 pl-1 gap-1">
                                 <div className={`font-black text-[16px] leading-none tracking-tighter ${isMergeActive ? 'text-blue-600' : 'text-white'}`}>{formatLargeMoney(shift.totalAmt)}원</div>
                                 {shiftHourlyRate > 0 && <div className={`text-[10px] font-black px-1.5 py-0.5 rounded border shadow-sm flex items-center gap-0.5 leading-none ${isMergeActive ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-indigo-100 bg-white/10 border-white/20'}`}><span className="text-amber-400">💡</span>시급 {formatLargeMoney(shiftHourlyRate)}원</div>}
                              </div>
                          </div>
                        );
                        })}
                     </div>
                 )}
              </div>
            );
          })}
        </div>
      )}

      {selectedShiftDetail && (
         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-[80] p-0 overflow-y-auto no-scrollbar">
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => handleTouchEnd(e, () => setSelectedShiftDetail(null))}
              className="bg-white w-full max-w-md rounded-t-[3rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300 relative border-t-8 border-blue-600"
            >
               <div className="w-14 h-1.5 bg-slate-300 rounded-full mx-auto mb-6 shrink-0"></div>
               <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-1.5"><Bike size={22} className="text-blue-600"/> 근무 타임 상세</h3>
                  <button onClick={() => setSelectedShiftDetail(null)} className="text-slate-500 p-2 bg-slate-100 rounded-full active:scale-95 border border-slate-200"><X size={20}/></button>
               </div>
               
               <div className="mb-6">
                  <div className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1.5"><CalendarCheck size={14}/> {selectedShiftDetail.date}</div>
                  <div className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">
                     {selectedShiftDetail.startTime && selectedShiftDetail.endTime ? `${selectedShiftDetail.startTime} ~ ${selectedShiftDetail.endTime}` : '시간 미지정 기록'}
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 mb-6 shadow-inner">
                     {selectedShiftDetail.items.map(item => (
                        <div key={item.id} className="flex justify-between items-center">
                           <div className="flex items-center gap-2.5">
                              <span className={`text-[12px] font-black px-2 py-1 rounded text-white shadow-sm border ${item.platform === '배민' ? 'bg-[#2ac1bc] border-[#1f938f]' : 'bg-[#111111] border-black'}`}>{item.platform}</span>
                              <span className="font-black text-base text-slate-800">{item.device === 'main' ? userData.nickname : '투폰(서브)'}</span>
                              <span className="text-[12px] font-bold text-slate-500 ml-1">({item.count}건)</span>
                           </div>
                           <div className="font-black text-slate-900 text-xl tracking-tight">{formatLargeMoney(item.amount)}원</div>
                        </div>
                     ))}
                  </div>

                  {(() => {
                      const shiftStart = selectedShiftDetail.startTime;
                      const shiftEnd = selectedShiftDetail.endTime;
                      let durationStr = '-';
                      let hourlyRate = 0;
                      if (shiftStart && shiftEnd) {
                          let [sh, sm] = shiftStart.split(':').map(Number);
                          let [eh, em] = shiftEnd.split(':').map(Number);
                          let startMins = sh * 60 + sm;
                          let endMins = eh * 60 + em;
                          if (endMins <= startMins) endMins += 1440;
                          let totalMins = endMins - startMins;
                          let h = Math.floor(totalMins / 60);
                          let m = totalMins % 60;
                          durationStr = `${h > 0 ? h+'시간 ' : ''}${m > 0 ? m+'분' : ''}`.trim();
                          hourlyRate = totalMins > 0 ? Math.round(selectedShiftDetail.totalAmt / (totalMins / 60)) : 0;
                      }
                      let avgAmt = selectedShiftDetail.totalCnt > 0 ? Math.round(selectedShiftDetail.totalAmt / selectedShiftDetail.totalCnt) : 0;

                      return (
                         <div className="bg-blue-50/80 rounded-3xl p-5 border border-blue-200 shadow-sm">
                            <div className="grid grid-cols-2 gap-y-5 gap-x-5">
                               <div>
                                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Bike size={12}/>총 배달 건수</div>
                                  <div className="text-xl font-black text-slate-900">{selectedShiftDetail.totalCnt}건</div>
                               </div>
                               <div>
                                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Coins size={12}/>평균 단가</div>
                                  <div className="text-xl font-black text-slate-900">{formatLargeMoney(avgAmt)}원</div>
                               </div>
                               <div>
                                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={12}/>근무 시간</div>
                                  <div className="text-xl font-black text-slate-900">{durationStr}</div>
                               </div>
                               <div>
                                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Timer size={12}/>시간당 시급</div>
                                  <div className="text-xl font-black text-blue-600">{formatLargeMoney(hourlyRate)}원</div>
                               </div>
                            </div>
                            <div className="border-t border-blue-200/60 pt-5 mt-5 flex justify-between items-end">
                               <div className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-1">총 정산 금액</div>
                               <div className="text-4xl font-black tracking-tighter text-blue-600 leading-none">
                                   {formatLargeMoney(selectedShiftDetail.totalAmt)}<span className="text-lg text-slate-800 font-bold ml-1">원</span>
                               </div>
                            </div>
                         </div>
                      );
                  })()}
               </div>

               <div className="grid grid-cols-2 gap-3 pt-5 border-t border-slate-200">
                  <button onClick={() => openEditShiftForm(selectedShiftDetail)} className="py-4 bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-700 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-95 shadow-sm"><Edit3 size={18}/> 타임 전체 수정</button>
                  <button onClick={() => deleteShift(selectedShiftDetail)} className="py-4 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-95 shadow-sm"><Trash2 size={18}/> 삭제</button>
               </div>
            </div>
         </div>
      )}

      {selectedDailySummary && (() => {
          const dayItems = (dailyDeliveries || []).filter(d => d.date === selectedDailySummary);
          const metrics = calcDailyMetrics(dayItems);
          
          const baeminTot = dayItems.filter(d=>d.platform==='배민').reduce((a,b)=>a+(b.amount||0),0);
          const coupangTot = dayItems.filter(d=>d.platform==='쿠팡').reduce((a,b)=>a+(b.amount||0),0);
          const etcTot = metrics.totalAmt - baeminTot - coupangTot;
          
          const mainTot = dayItems.filter(d=>d.device==='main').reduce((a,b)=>a+(b.amount||0),0);
          const subTot = dayItems.filter(d=>d.device==='sub').reduce((a,b)=>a+(b.amount||0),0);

          return (
             <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-[70] p-0">
                <div 
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={(e) => handleTouchEnd(e, () => setSelectedDailySummary(null))}
                  className="bg-white w-full max-w-md rounded-t-[3rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col relative overflow-hidden border-t-8 border-blue-600"
                >
                   <div className="w-14 h-1.5 bg-slate-300 rounded-full mx-auto mb-6 shrink-0"></div>
                   <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Target className="text-blue-600" size={28}/> {selectedDailySummary.slice(5).replace('-','/')} 일일 요약</h2>
                      <button onClick={() => setSelectedDailySummary(null)} className="bg-slate-100 text-slate-500 p-2.5 rounded-full active:scale-95 border border-slate-200"><X size={22}/></button>
                   </div>

                   <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-[2.5rem] p-7 text-white shadow-xl relative overflow-hidden border border-slate-600">
                       <Bike className="absolute -right-4 -bottom-4 w-36 h-36 opacity-10 rotate-12" fill="white" />
                       <div className="relative z-10">
                           <div className="text-slate-300 text-[12px] font-bold mb-1.5 tracking-widest uppercase">오늘 총 정산 금액</div>
                           <div className="text-[40px] font-black tracking-tighter mb-6 text-white leading-none">{formatLargeMoney(metrics.totalAmt)}<span className="text-xl font-bold opacity-80 ml-1">원</span></div>
                           
                           <div className="grid grid-cols-2 gap-5 gap-y-7 border-t border-white/10 pt-6">
                              <div>
                                 <div className="text-[11px] text-slate-400 font-bold mb-1 uppercase tracking-widest">총 배달 건수</div>
                                 <div className="text-2xl font-black text-white">{formatLargeMoney(metrics.totalCnt)}건</div>
                              </div>
                              <div>
                                 <div className="text-[11px] text-slate-400 font-bold mb-1 uppercase tracking-widest">평균 단가</div>
                                 <div className="text-2xl font-black text-white">{formatLargeMoney(metrics.perDelivery)}원</div>
                              </div>
                              <div>
                                 <div className="text-[11px] text-slate-400 font-bold mb-1 uppercase tracking-widest">총 근무 시간</div>
                                 <div className="text-2xl font-black text-white">{metrics.durationStr || '-'}</div>
                              </div>
                              <div>
                                 <div className="text-[11px] text-slate-400 font-bold mb-1 uppercase tracking-widest">평균 시급</div>
                                 <div className="text-2xl font-black text-blue-400">{formatLargeMoney(metrics.hourlyRate || 0)}원</div>
                              </div>
                           </div>

                           <div className="bg-white/10 rounded-2xl p-4 mt-7 flex flex-col gap-2.5 shadow-sm border border-white/10 relative z-10">
                              <div className="flex divide-x divide-white/20">
                                <div className="flex-1 px-2 flex justify-between items-center"><span className="text-[12px] font-bold text-slate-300">기본기기</span><span className="text-base font-black text-white">{formatLargeMoney(mainTot)}원</span></div>
                                <div className="flex-1 px-2 flex justify-between items-center"><span className="text-[12px] font-bold text-slate-300">투폰(서브)</span><span className="text-base font-black text-white">{formatLargeMoney(subTot)}원</span></div>
                              </div>
                              <div className="w-full h-px bg-white/10"></div>
                              <div className="flex divide-x divide-white/20">
                                <div className="flex-1 px-2 flex justify-between items-center"><span className="text-[12px] font-bold text-[#4cd1cc]">배민</span><span className="text-base font-black text-white">{formatLargeMoney(baeminTot)}원</span></div>
                                <div className="flex-1 px-2 flex justify-between items-center"><span className="text-[12px] font-bold text-slate-300">쿠팡</span><span className="text-base font-black text-white">{formatLargeMoney(coupangTot)}원</span></div>
                              </div>
                              {etcTot > 0 && (
                                 <div className="text-right text-[11px] text-slate-400 font-bold mt-1 pr-2">기타 통합수익: {formatLargeMoney(etcTot)}원</div>
                              )}
                           </div>
                       </div>
                   </div>
                </div>
             </div>
          );
      })()}

      {selectedWeeklySummary && (() => {
          const pd = selectedWeeklySummary;
          const items = pendingByPayday[pd]?.items || paydayGroups[pd]?.items || [];
          const metrics = getGroupMetrics(items);
          
          const baeminTot = items.filter(d=>d.platform==='배민').reduce((a,b)=>a+(b.amount||0),0);
          const coupangTot = items.filter(d=>d.platform==='쿠팡').reduce((a,b)=>a+(b.amount||0),0);
          const etcTot = metrics.totalAmt - baeminTot - coupangTot;

          const title = `${pd.slice(5).replace('-','/')} 입금 예정`;

          return (
             <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-[70] p-0">
                <div 
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={(e) => handleTouchEnd(e, () => setSelectedWeeklySummary(null))}
                  className="bg-white w-full max-w-md rounded-t-[3rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col relative overflow-hidden border-t-8 border-blue-600"
                >
                   <div className="w-14 h-1.5 bg-slate-300 rounded-full mx-auto mb-6 shrink-0"></div>
                   <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Target className="text-blue-600" size={28}/> {title}</h2>
                      <button onClick={() => setSelectedWeeklySummary(null)} className="bg-slate-100 text-slate-500 p-2.5 rounded-full active:scale-95 border border-slate-200"><X size={22}/></button>
                   </div>

                   <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-[2.5rem] p-7 text-white shadow-xl relative overflow-hidden border border-slate-600">
                       <Bike className="absolute -right-4 -bottom-4 w-36 h-36 opacity-10 rotate-12" fill="white" />
                       <div className="relative z-10">
                           <div className="text-slate-300 text-[12px] font-bold mb-1.5 tracking-widest uppercase">총 정산 금액</div>
                           <div className="text-[40px] font-black tracking-tighter mb-6 text-white leading-none">{formatLargeMoney(metrics.totalAmt)}<span className="text-xl font-bold opacity-80 ml-1">원</span></div>
                           
                           <div className="grid grid-cols-2 gap-5 gap-y-7 border-t border-white/10 pt-6">
                               <div>
                                 <div className="text-[11px] text-slate-400 font-bold mb-1 uppercase tracking-widest">배달 건수</div>
                                 <div className="text-2xl font-black text-white">{formatLargeMoney(metrics.totalCnt)}건</div>
                               </div>
                              <div>
                                 <div className="text-[11px] text-slate-400 font-bold mb-1 uppercase tracking-widest">근무 시간</div>
                                 <div className="text-2xl font-black text-white">{metrics.durationStr}</div>
                              </div>
                              <div>
                                 <div className="text-[11px] text-slate-400 font-bold mb-1 uppercase tracking-widest">평균 단가</div>
                                 <div className="text-2xl font-black text-white">{formatLargeMoney(metrics.perDelivery)}원</div>
                              </div>
                               <div>
                                 <div className="text-[11px] text-slate-400 font-bold mb-1 uppercase tracking-widest">평균 시급</div>
                                 <div className="text-2xl font-black text-blue-400">{formatLargeMoney(metrics.hourlyRate || 0)}원</div>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-5 mt-7 pt-6 border-t border-white/10">
                               <div><div className="text-[11px] text-[#4cd1cc] font-bold mb-0.5">배민 수익</div><div className="text-xl font-black text-white">{formatLargeMoney(baeminTot)}원</div></div>
                              <div><div className="text-[11px] text-slate-300 font-bold mb-0.5">쿠팡 수익</div><div className="text-xl font-black text-white">{formatLargeMoney(coupangTot)}원</div></div>
                           </div>
                           {etcTot > 0 && (
                               <div className="mt-3 text-[11px] text-slate-400 font-bold text-right">기타(통합) 수익: {formatLargeMoney(etcTot)}원</div>
                           )}
                       </div>
                   </div>
                </div>
             </div>
          );
      })()}

      <button onClick={() => { 
        const now = new Date();
        const timeNow = formatTimeStr(now);
        setEditingDeliveryShift(null);
        setDeliveryFormData({ 
          ...emptyForm, 
          date: getKSTDateStr(),
          startTime: timeNow,
          endTime: timeNow
        });
        setIsDeliveryModalOpen(true); 
      }} className="fixed bottom-24 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)] flex items-center justify-center active:scale-90 transition-all z-40 border border-blue-600"><Plus size={28}/></button>

      {/* 심폐소생술 마감 취소 모달 */}
      {showCloseConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
             <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 relative overflow-hidden border border-gray-100">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32}/></div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">마감 기록을 닫으시겠습니까?</h3>
                    <p className="text-[12px] font-bold text-slate-500">배달을 아직 진행 중이시라면 타이머를 살려둘 수 있습니다.</p>
                </div>
                <div className="space-y-2">
                    <button onClick={() => { setShowCloseConfirm(false); setIsDeliveryModalOpen(false); }} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-3.5 rounded-[1.2rem] font-black text-sm transition-colors border border-blue-200">
                        🏃‍♂️ 앗, 아직 배달 중! (타이머 계속)
                    </button>
                    <button onClick={() => {
                        setShowCloseConfirm(false);
                        setIsDeliveryModalOpen(false);
                        handleEndDelivery();
                        if (deliveryFormData.startTime) {
                            const recoveryData = { formData: deliveryFormData, splitQueue: splitQueue };
                            localStorage.setItem('baesamoRecoveryShift', JSON.stringify(recoveryData));
                            setRecoveryShift(recoveryData);
                        }
                    }} className="w-full bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 py-3.5 rounded-[1.2rem] font-black text-sm transition-colors border border-slate-200 hover:border-rose-200">
                        💾 바빠서 나중에 적을래 (임시 보관)
                    </button>
                    <button onClick={() => setShowCloseConfirm(false)} className="w-full bg-white text-slate-400 py-3 rounded-[1.2rem] font-black text-[11px] underline">취소하고 다시 마감 화면으로</button>
                </div>
             </div>
          </div>
      )}

      {isDeliveryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-[90] p-0 overflow-y-auto no-scrollbar">
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => handleTouchEnd(e, handleCloseDeliveryModal)}
            className="bg-[#f8fafc] w-full max-w-md rounded-t-[2.5rem] p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 mt-20 border-t-8 border-blue-500 flex flex-col max-h-[90vh]"
          >
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4 shrink-0"></div>
            <div className="flex justify-between items-center mb-5 shrink-0">
               <h2 className="text-xl font-black text-slate-900 tracking-tight">{editingDeliveryShift ? '근무 기록 수정' : splitQueue.length > 0 ? '이전 시간 정산 기록' : '배달 최종 마감'}</h2>
               <button onClick={handleCloseDeliveryModal} className="bg-white text-slate-500 p-2.5 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleDeliverySubmit} className="space-y-4 overflow-y-auto no-scrollbar pb-2">
              
              <div className="grid grid-cols-3 gap-2 pb-4 border-b border-slate-200 w-full">
                <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-sm">
                  <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5 ml-1"><CalendarIcon size={10} className="text-blue-500"/>날짜</label>
                  <input type="date" value={deliveryFormData.date} onChange={e=>setDeliveryFormData({...deliveryFormData, date:e.target.value})} className="w-full bg-transparent px-1 h-[24px] font-black text-[13px] outline-none text-slate-800" />
                </div>
                <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-sm">
                  <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5 ml-1"><Clock size={10} className="text-blue-500"/>시작</label>
                  <input type="time" value={deliveryFormData.startTime} onChange={e=>setDeliveryFormData({...deliveryFormData, startTime:e.target.value})} className="w-full bg-transparent px-1 h-[24px] font-black text-[13px] outline-none text-slate-800" />
                </div>
                <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-sm">
                  <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5 ml-1"><Clock size={10} className="text-blue-500"/>종료</label>
                  <input type="time" value={deliveryFormData.endTime} onChange={e=>setDeliveryFormData({...deliveryFormData, endTime:e.target.value})} className="w-full bg-transparent px-1 h-[24px] font-black text-[13px] outline-none text-slate-800" />
                </div>
              </div>

              {/* 🛵 배민 입력 폼 */}
              <div className="bg-white p-4 rounded-[1.2rem] shadow-sm border border-slate-200 mt-2">
                <div className="font-black text-[#1f938f] text-[13px] mb-3 flex items-center gap-1.5"><Bike size={14}/> 배달의민족</div>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                     <div className="flex gap-2 items-center w-full">
                        <span className="w-[60px] shrink-0 text-[12px] font-black text-slate-600 bg-slate-50 rounded-xl text-center flex items-center justify-center h-[46px] border border-slate-100">{userData.nickname}</span>
                        <input type="text" inputMode="numeric" pattern="[0-9,]*" value={deliveryFormData.mainBaeminAmt ? formatLargeMoney(deliveryFormData.mainBaeminAmt) : ''} onChange={e => setDeliveryFormData({...deliveryFormData, mainBaeminAmt: e.target.value.replace(/[^0-9]/g, '')})} placeholder="총액" className="flex-[7] min-w-0 text-[17px] font-black bg-slate-50 rounded-xl px-3 h-[46px] outline-none border border-slate-200 focus:bg-white focus:border-[#2ac1bc] focus:ring-2 focus:ring-[#2ac1bc]/20 transition-all text-slate-900 placeholder:text-slate-300" />
                        <input type="text" inputMode="numeric" pattern="[0-9,]*" value={deliveryFormData.mainBaeminCnt} onChange={e => setDeliveryFormData({...deliveryFormData, mainBaeminCnt: e.target.value.replace(/[^0-9]/g, '')})} placeholder="건수" className="flex-[3] min-w-0 text-[17px] font-black bg-slate-50 rounded-xl px-1 h-[46px] text-center outline-none border border-slate-200 focus:bg-white focus:border-[#2ac1bc] focus:ring-2 focus:ring-[#2ac1bc]/20 transition-all text-slate-900 placeholder:text-slate-300" />
                     </div>
                     <NetDiffInfo device="main" platform="배민" inputAmt={deliveryFormData.mainBaeminAmt} inputCnt={deliveryFormData.mainBaeminCnt} date={deliveryFormData.date} />
                  </div>

                  {deliveryFormData.useTwoPhones && (
                    <>
                      <div className="w-full border-t border-slate-100"></div>
                      <div className="flex flex-col gap-1 animate-in fade-in">
                        <div className="flex gap-2 items-center w-full">
                            <span className="w-[60px] shrink-0 text-[11px] font-black text-slate-500 bg-slate-100 rounded-xl text-center flex items-center justify-center h-[46px] border border-slate-200 shadow-inner">투폰(서브)</span>
                            <input type="text" inputMode="numeric" pattern="[0-9,]*" value={deliveryFormData.subBaeminAmt ? formatLargeMoney(deliveryFormData.subBaeminAmt) : ''} onChange={e => setDeliveryFormData({...deliveryFormData, subBaeminAmt: e.target.value.replace(/[^0-9]/g, '')})} placeholder="서브 총액" className="flex-[7] min-w-0 text-[15px] font-black bg-slate-50 rounded-xl px-3 h-[46px] outline-none border border-slate-200 focus:bg-white focus:border-[#2ac1bc] focus:ring-2 focus:ring-[#2ac1bc]/20 transition-all text-slate-900 placeholder:text-slate-300" />
                            <input type="text" inputMode="numeric" pattern="[0-9,]*" value={deliveryFormData.subBaeminCnt} onChange={e => setDeliveryFormData({...deliveryFormData, subBaeminCnt: e.target.value.replace(/[^0-9]/g, '')})} placeholder="건수" className="flex-[3] min-w-0 text-[15px] font-black bg-slate-50 rounded-xl px-1 h-[46px] text-center outline-none border border-slate-200 focus:bg-white focus:border-[#2ac1bc] focus:ring-2 focus:ring-[#2ac1bc]/20 transition-all text-slate-900 placeholder:text-slate-300" />
                        </div>
                        <NetDiffInfo device="sub" platform="배민" inputAmt={deliveryFormData.subBaeminAmt} inputCnt={deliveryFormData.subBaeminCnt} date={deliveryFormData.date} />
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* 🛵 쿠팡 입력 폼 */}
              <div className="bg-white p-4 rounded-[1.2rem] shadow-sm border border-slate-200">
                <div className="font-black text-blue-600 text-[13px] mb-3 flex items-center gap-1.5"><Bike size={14}/> 쿠팡이츠</div>
                <div className="space-y-3">
                   <div className="flex flex-col gap-1">
                     <div className="flex gap-2 items-center w-full">
                        <span className="w-[60px] shrink-0 text-[12px] font-black text-slate-600 bg-slate-50 rounded-xl text-center flex items-center justify-center h-[46px] border border-slate-100">{userData.nickname}</span>
                        <input type="text" inputMode="numeric" pattern="[0-9,]*" value={deliveryFormData.mainCoupangAmt ? formatLargeMoney(deliveryFormData.mainCoupangAmt) : ''} onChange={e => setDeliveryFormData({...deliveryFormData, mainCoupangAmt: e.target.value.replace(/[^0-9]/g, '')})} placeholder="총액" className="flex-[7] min-w-0 text-[17px] font-black bg-slate-50 rounded-xl px-3 h-[46px] outline-none border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-300" />
                        <input type="text" inputMode="numeric" pattern="[0-9,]*" value={deliveryFormData.mainCoupangCnt} onChange={e => setDeliveryFormData({...deliveryFormData, mainCoupangCnt: e.target.value.replace(/[^0-9]/g, '')})} placeholder="건수" className="flex-[3] min-w-0 text-[17px] font-black bg-slate-50 rounded-xl px-1 h-[46px] text-center outline-none border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-300" />
                     </div>
                     <NetDiffInfo device="main" platform="쿠팡" inputAmt={deliveryFormData.mainCoupangAmt} inputCnt={deliveryFormData.mainCoupangCnt} date={deliveryFormData.date} />
                  </div>

                  {deliveryFormData.useTwoPhones && (
                    <>
                      <div className="w-full border-t border-slate-100"></div>
                      <div className="flex flex-col gap-1 animate-in fade-in">
                        <div className="flex gap-2 items-center w-full">
                            <span className="w-[60px] shrink-0 text-[11px] font-black text-slate-500 bg-slate-100 rounded-xl text-center flex items-center justify-center h-[46px] border border-slate-200 shadow-inner">투폰(서브)</span>
                            <input type="text" inputMode="numeric" pattern="[0-9,]*" value={deliveryFormData.subCoupangAmt ? formatLargeMoney(deliveryFormData.subCoupangAmt) : ''} onChange={e => setDeliveryFormData({...deliveryFormData, subCoupangAmt: e.target.value.replace(/[^0-9]/g, '')})} placeholder="서브 총액" className="flex-[7] min-w-0 text-[15px] font-black bg-slate-50 rounded-xl px-3 h-[46px] outline-none border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-300" />
                            <input type="text" inputMode="numeric" pattern="[0-9,]*" value={deliveryFormData.subCoupangCnt} onChange={e => setDeliveryFormData({...deliveryFormData, subCoupangCnt: e.target.value.replace(/[^0-9]/g, '')})} placeholder="건수" className="flex-[3] min-w-0 text-[15px] font-black bg-slate-50 rounded-xl px-1 h-[46px] text-center outline-none border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-300" />
                        </div>
                        <NetDiffInfo device="sub" platform="쿠팡" inputAmt={deliveryFormData.subCoupangAmt} inputCnt={deliveryFormData.subCoupangCnt} date={deliveryFormData.date} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!deliveryFormData.useTwoPhones && (
                  <button type="button" onClick={() => setDeliveryFormData({...deliveryFormData, useTwoPhones: true})} className="w-full mt-2 bg-slate-200/50 hover:bg-slate-200 text-slate-600 font-black text-[13px] py-3 rounded-[1rem] transition-colors border border-slate-300/50 shadow-sm border-dashed">
                      + 투폰(공기계) 실적 추가하기 📱
                  </button>
              )}
              
              <button type="submit" disabled={!(deliveryFormData.mainBaeminAmt || deliveryFormData.mainCoupangAmt || deliveryFormData.subBaeminAmt || deliveryFormData.subCoupangAmt)} className="w-full shrink-0 h-[56px] flex items-center justify-center bg-blue-600 mt-5 rounded-[1.2rem] text-white font-black text-lg active:scale-95 shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 border border-blue-700">
                {editingDeliveryShift ? '수정 완료' : splitQueue.length > 0 ? '저장하고 다음 타임 쓰기' : '마감 저장'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. 운행 현황 뷰 (실시간)
// ==========================================
function StatusView({ allUsers }) {
  const activeRiders = allUsers.filter(u => u.isRiding && !u.isStealth);
  const stealthCount = allUsers.filter(u => u.isRiding && u.isStealth).length;
  const inactiveRiders = allUsers.filter(u => !u.isRiding || u.isStealth);

  const getBikeFourDigits = (bikeNumber) => {
    if (!bikeNumber) return '????';
    const match = bikeNumber.match(/\d{4}$/);
    return match ? match[0] : bikeNumber.slice(-4);
  };

  return (
    <div className="px-5 pt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-24">
      {/* 액티브 (운행 중) 섹션 */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-blue-100">
        <h2 className="text-sm font-black text-blue-600 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Bike size={18}/> 🚀 현재 운행 중인 라이더</span>
          <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[11px]">
             {activeRiders.length}명 {stealthCount > 0 && <span className="text-gray-500 ml-1">+ 스텔스 {stealthCount}명</span>}
          </span>
        </h2>
        
        <div className="space-y-2">
          {activeRiders.length === 0 ? (
            <div className="text-center py-6 text-gray-400 font-bold text-sm bg-gray-50 rounded-2xl border border-dashed border-gray-200">
               지금 배달 중인 멤버가 없습니다.
            </div>
          ) : (
            activeRiders.map(rider => (
              <div key={rider.uid} className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shadow-md shadow-blue-200 shrink-0">
                      {rider.nickname.slice(0,1)}
                    </div>
                    <div className="font-black text-gray-800 text-base">
                      {rider.nickname} <span className="text-blue-500 font-bold text-sm">({getBikeFourDigits(rider.bikeNumber)})</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-blue-200 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-red-500 uppercase">On</span>
                 </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 인액티브 (비운행) 섹션 */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
        <h2 className="text-sm font-black text-gray-500 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Users size={18}/> ☕ 휴식 중인 라이더</span>
          <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-[11px]">{inactiveRiders.length}명</span>
        </h2>
        
        <div className="grid grid-cols-2 gap-2">
          {inactiveRiders.map(rider => (
            <div key={rider.uid} className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100 opacity-60">
               <div className="w-6 h-6 bg-gray-300 text-white rounded-full flex items-center justify-center font-black text-[10px]">
                 {rider.nickname.slice(0,1)}
               </div>
               <div className="font-bold text-gray-700 text-xs truncate">
                 {rider.nickname} <span className="text-[10px] text-gray-400">({getBikeFourDigits(rider.bikeNumber)})</span>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// [메인 앱 (App Component)]
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState('delivery');
  const [dailyDeliveries, setDailyDeliveries] = useState([]);
  
  // 글로벌 긴급 공지 상태 추가
  const [globalNotice, setGlobalNotice] = useState(null);

  // 화면 확대/축소 방지
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.getElementsByTagName('head')[0].appendChild(meta);

    // iOS 더블 탭 줌 방지
    const preventZoom = (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchstart', preventZoom, { passive: false });
    return () => document.removeEventListener('touchstart', preventZoom);
  }, []);

  // 인증 및 실시간 감시
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // 내 사용자 정보 감시
        const userDocRef = doc(db, 'users', currentUser.uid);
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data());
          setLoading(false);
        });

        // 승인된 모든 유저 감시 (현황판용)
        const approvedQuery = query(collection(db, 'users'), where('status', 'in', ['approved', 'admin']));
        onSnapshot(approvedQuery, (s) => {
           const users = s.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
           setAllUsers(users);
        });
 
        // 본인의 배달 내역 감시
        const q = query(collection(db, 'delivery'), where('userId', '==', currentUser.uid));
        onSnapshot(q, (s) => {
          const docs = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setDailyDeliveries(docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).reverse());
        });

        // 글로벌 긴급 공지 감시
        onSnapshot(doc(db, 'settings', 'globalNotice'), (s) => {
          if (s.exists()) setGlobalNotice(s.data());
          else setGlobalNotice(null);
        });

      } else {
        setUser(null);
        setUserData(null);
        setAllUsers([]);
        setPendingUsers([]);
        setGlobalNotice(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // 관리자 판단 로직
  const isAdmin = userData?.status === 'admin' || userData?.isAdmin === true;

  // 관리자용 가입 대기열 감시
  useEffect(() => {
    if (isAdmin) {
      const pendingQuery = query(collection(db, 'users'), where('status', '==', 'pending'));
      const unsubPending = onSnapshot(pendingQuery, (s) => {
         const pUsers = s.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
         setPendingUsers(pUsers);
      });
      return () => unsubPending();
    } else {
      setPendingUsers([]);
    }
  }, [isAdmin]);

  const handleRegister = async (data) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await setDoc(doc(db, 'users', res.user.uid), { ...data, status: 'pending' });
      alert("신청 완료! 승인 대기 상태입니다.");
      setShowRegister(false);
    } catch (err) {
      alert(`[가입에러] 내용: ${err.message}`);
    }
  };

  // 관리자 액션 함수
  const handleApproveUser = async (targetUid) => {
    if (!window.confirm('이 사용자의 가입을 승인하시겠습니까?')) return;
    await updateDoc(doc(db, 'users', targetUid), { status: 'approved' });
    alert('승인되었습니다!');
  };

  const handleRejectUser = async (targetUid) => {
    if (!window.confirm('가입을 거절하고 이 데이터를 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'users', targetUid));
    alert('거절(삭제) 되었습니다.');
  };

  // 공지사항 자동 초기화 로직 및 등록 함수
  const todayStr = getKSTDateStr();
  // 공지사항의 날짜가 '오늘'일 때만 글자를 보여줌 (자정 지나면 자동 숨김)
  const displayNotice = globalNotice?.date === todayStr ? globalNotice?.text : '';

  const handleEditNotice = async () => {
    if (!isAdmin) return;
    const newText = prompt("🚨 오늘의 중요 공지를 입력하세요 (경찰 단속, 폭우 등)\n\n※ 자정이 지나면 자동으로 사라집니다.\n※ 내용을 모두 지우고 확인을 누르면 공지가 숨겨집니다.", displayNotice || '');
    if (newText !== null) {
      await setDoc(doc(db, 'settings', 'globalNotice'), {
        text: newText.trim(),
        date: todayStr, // 등록한 날짜 박제 (자정 초기화용)
        updatedAt: new Date().toISOString(),
        updatedBy: userData.nickname
      });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-blue-500 text-2xl bg-blue-50">🛵 로딩 중...</div>;

  if (!user) {
    if (showRegister) return <RegisterScreen onBackToLogin={() => setShowRegister(false)} onRegister={handleRegister} />;
    return <LoginScreen onGoToRegister={() => setShowRegister(true)} onLogin={async (e, p) => {
      try { await signInWithEmailAndPassword(auth, e, p); } catch (err) { alert("로그인 실패: 아이디 또는 비밀번호를 확인하세요."); }
    }} />;
  }

  if (!userData || userData.status === 'pending') return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-7xl mb-6 animate-bounce">⏳</div>
      <h2 className="text-2xl font-black text-gray-800 mb-2">승인 대기 중</h2>
      <p className="text-gray-500 font-bold mb-1">관리자의 승인을 기다려주세요!</p>
      <p className="text-xs text-gray-400 mb-8">{userData?.nickname} / {userData?.bikeNumber}</p>
      <button onClick={() => signOut(auth)} className="text-gray-400 font-bold border border-gray-200 px-6 py-2 rounded-xl active:bg-gray-100">임시 로그아웃</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans select-none pb-24 overflow-x-hidden">
      <header className="bg-white/90 backdrop-blur-md px-6 pt-12 pb-4 shadow-sm border-b sticky top-0 z-40 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black text-blue-500 block mb-0.5 uppercase tracking-widest italic">Baesamo Pro</span>
          <h1 className="text-xl font-black">
            {activeTab === 'delivery' ? '내 배달 수익' : activeTab === 'status' ? '실시간 운행 현황' : '내 정보 관리'}
          </h1>
        </div>
        <div className="bg-blue-50 px-3 py-1.5 rounded-full text-xs font-black text-blue-600 border border-blue-100 shadow-sm flex items-center gap-1.5">
          {userData.isRiding && !userData.isStealth && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>}
          {isAdmin ? '👑' : ''} {userData.nickname} 님
        </div>
      </header>

      {/* 글로벌 공지사항 배너 (헤더 바로 아래, 내용 최상단에 항상 노출) */}
      {(displayNotice || isAdmin) && (
        <div className="max-w-md mx-auto px-5 pt-4">
           <div 
             onClick={isAdmin ? handleEditNotice : undefined}
             className={`relative overflow-hidden rounded-2xl p-3 flex items-center gap-3 shadow-sm border transition-all ${displayNotice ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-dashed border-gray-300'} ${isAdmin ? 'cursor-pointer active:scale-95 hover:brightness-95' : ''}`}
           >
              <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full shadow-inner ${displayNotice ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-300 text-white'}`}>
                <AlertCircle size={18} />
              </div>
              <div className="flex-1 min-w-0">
                {displayNotice ? (
                  <div className="font-black text-red-600 text-[13px] leading-snug break-keep">
                    {displayNotice}
                  </div>
                ) : (
                  <div className="font-bold text-gray-400 text-[12px]">
                    + 관리자 전용: 오늘의 긴급 공지 등록 (자정 초기화)
                  </div>
                )}
              </div>
              {isAdmin && <Edit3 size={14} className={`shrink-0 ${displayNotice ? 'text-red-300' : 'text-gray-300'}`} />}
           </div>
        </div>
      )}

      <main className="max-w-md mx-auto relative min-h-[80vh]">
        {activeTab === 'delivery' && (
          <DeliveryView user={user} userData={userData} dailyDeliveries={dailyDeliveries} />
        )}

        {activeTab === 'status' && (
          <StatusView allUsers={allUsers} />
        )}

        {activeTab === 'settings' && (
          <div className="px-5 pt-6 animate-in fade-in slide-in-from-right-4 space-y-4 pb-10">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 text-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner border border-blue-100">🛵</div>
              <div>
                <h2 className="text-2xl font-black text-gray-800">{userData.nickname}</h2>
                <p className="text-sm font-bold text-gray-400 mt-1">{userData.name} · {userData.bikeNumber}</p>
                <div className="mt-4 inline-flex items-center gap-1 bg-green-50 text-green-600 px-3 py-1 rounded-lg text-xs font-black border border-green-200">
                  {isAdmin ? '👑 방장 (관리자)' : '승인된 정식 멤버'}
                </div>
              </div>
              <button onClick={() => signOut(auth)} className="w-full bg-gray-50 text-gray-500 py-4 rounded-2xl font-black border border-gray-200 active:scale-95 transition-transform hover:bg-gray-100">안전하게 로그아웃</button>
            </div>

            {/* 관리자 전용 메뉴 */}
            {isAdmin && (
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-blue-200 animate-in slide-in-from-bottom-4">
                 <h3 className="text-sm font-black text-blue-600 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">👑 가입 승인 대기열</span>
                    <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[10px]">{pendingUsers.length}명 대기중</span>
                 </h3>

                 <div className="space-y-3">
                    {pendingUsers.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 font-bold text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        가입 승인을 대기 중인 멤버가 없습니다.
                      </div>
                    ) : (
                      pendingUsers.map(pUser => (
                        <div key={pUser.uid} className="flex flex-col gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-sm">
                           <div className="flex justify-between items-start">
                              <div>
                                <div className="font-black text-gray-800 text-base">{pUser.nickname} <span className="text-xs font-bold text-gray-500">({pUser.name})</span></div>
                                <div className="text-[11px] font-bold text-gray-500 mt-1">오토바이: {pUser.bikeNumber}</div>
                                <div className="text-[11px] font-bold text-gray-500">출생년도: {pUser.birthYear}년생 ({pUser.age}세)</div>
                              </div>
                           </div>
                           <div className="flex gap-2 mt-1">
                              <button onClick={() => handleApproveUser(pUser.uid)} className="flex-[2] bg-blue-600 text-white py-2.5 rounded-xl text-sm font-black active:scale-95 shadow-sm">승인하기</button>
                              <button onClick={() => handleRejectUser(pUser.uid)} className="flex-1 bg-white text-rose-500 border border-rose-200 py-2.5 rounded-xl text-sm font-black active:scale-95 shadow-sm">거절/삭제</button>
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 h-[72px] bg-white/90 backdrop-blur-xl shadow-2xl rounded-full border border-gray-100 flex justify-around items-center z-50 max-w-sm mx-auto">
        <button onClick={() => setActiveTab('delivery')} className={`flex flex-col items-center w-20 transition-all ${activeTab === 'delivery' ? 'text-blue-600 scale-110' : 'text-gray-400 hover:text-gray-500'}`}>
          <Target size={24} className="mb-1" />
          <span className="text-[10px] font-black">수익관리</span>
        </button>
        <button onClick={() => setActiveTab('status')} className={`flex flex-col items-center w-20 transition-all ${activeTab === 'status' ? 'text-blue-600 scale-110' : 'text-gray-400 hover:text-gray-500'}`}>
          <Users size={24} className="mb-1" />
          <span className="text-[10px] font-black">운행현황</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center w-20 transition-all ${activeTab === 'settings' ? 'text-gray-800 scale-110' : 'text-gray-400 hover:text-gray-500'}`}>
          <Settings size={24} className="mb-1" />
          <span className="text-[10px] font-black">내 정보</span>
        </button>
      </nav>
    </div>
  );
}
