import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, where, deleteDoc, updateDoc } from 'firebase/firestore';

// 💡 [수정완료] Settings, Users, Ghost 등 필요한 아이콘을 모두 포함했습니다.
import { 
  Plus, Calendar as CalendarIcon, Bike, CheckCircle2, 
  Trash2, Clock, Search, ChevronDown, ChevronUp, 
  Target, Edit3, X, Timer, Coins, Filter, RefreshCw, 
  ChevronLeft, ChevronRight, Settings, Users, Ghost
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
// 2. HELPER FUNCTIONS 
// ==========================================
const getKSTDateStr = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const kstTime = new Date(utc + (9 * 3600000));
  return `${kstTime.getFullYear()}-${String(kstTime.getMonth() + 1).padStart(2, '0')}-${String(kstTime.getDate()).padStart(2, '0')}`;
};

const formatLargeMoney = (v) => {
  if (v === '' || v === undefined || v === null) return '0';
  const num = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : v;
  return isNaN(num) ? '0' : new Intl.NumberFormat('ko-KR').format(num);
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

// ==========================================
// 3. 로그인 및 회원가입 화면
// ==========================================
function LoginScreen({ onLogin, onGoToRegister }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loginId || !password) return alert("아이디와 비밀번호를 입력하세요.");
    onLogin(`${loginId.trim().toLowerCase()}@baesamo.com`, password);
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🛵</div>
      <h1 className="text-3xl font-black text-gray-800 mb-2 italic">BAESAMO RIDER</h1>
      <p className="text-gray-400 text-xs mb-8 font-bold">배달을 사랑하는 모임 전용 앱</p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input required type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="아이디" className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 font-bold outline-none shadow-sm focus:ring-2 focus:ring-orange-300 transition-all" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 font-bold outline-none shadow-sm focus:ring-2 focus:ring-orange-300 transition-all" />
        <button type="submit" className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black shadow-md mt-2 active:scale-95 transition-transform">🔑 로그인</button>
      </form>
      <button onClick={onGoToRegister} className="mt-8 text-sm font-black text-gray-400 underline decoration-2 underline-offset-4">✍️ 아직 계정이 없으신가요? 가입하기</button>
    </div>
  );
}

function RegisterScreen({ onRegister, onBackToLogin }) {
  const [formData, setFormData] = useState({ loginId: '', password: '', name: '', bikeNumber: '', nickname: '', birthYear: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password.length < 6) return alert("비밀번호는 최소 6자리 이상이어야 합니다!");
    const fakeEmail = `${formData.loginId.trim().toLowerCase()}@baesamo.com`;
    const age = 2026 - parseInt(formData.birthYear) + 1;
    // 💡 초기 상태에 isRiding, isStealth 속성 추가
    onRegister({ ...formData, email: fakeEmail, age, status: 'pending', isRiding: false, isStealth: false });
  };

  return (
    <div className="min-h-screen bg-white p-6 pt-10 flex flex-col items-center overflow-y-auto">
      <h2 className="text-2xl font-black text-gray-800 mb-6 italic">가입 신청 ✍️</h2>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 pb-10">
        <div className="bg-orange-50 p-5 rounded-3xl border border-orange-100 space-y-3">
          <label className="text-[10px] font-black text-orange-400 ml-1">계정 정보</label>
          <input required placeholder="사용할 아이디" value={formData.loginId} onChange={e => setFormData({ ...formData, loginId: e.target.value })} className="w-full p-3 rounded-xl border border-orange-200 font-bold outline-none" />
          <input required type="password" placeholder="비밀번호 (6자 이상)" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full p-3 rounded-xl border border-orange-200 font-bold outline-none" />
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
// 4. 배달 수익 관리 뷰
// ==========================================
function DeliveryView({ user, userData, dailyDeliveries }) {
  const todayStr = getKSTDateStr();
  const [selectedYear, setSelectedYear] = useState(parseInt(todayStr.slice(0, 4)));
  const [selectedMonth, setSelectedMonth] = useState(parseInt(todayStr.slice(5, 7)));

  const [isDeliverySummaryOpen, setIsDeliverySummaryOpen] = useState(false);
  const [isPendingSummaryOpen, setIsPendingSummaryOpen] = useState(true);

  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const emptyForm = { date: todayStr, startTime: '', endTime: '', amountBaemin: '', countBaemin: '', amountCoupang: '', countCoupang: '' };
  const [deliveryFormData, setDeliveryFormData] = useState(emptyForm);

  // 로컬 타이머 상태
  const [timerActive, setTimerActive] = useState(userData.isRiding || false);
  const [trackingStartTime, setTrackingStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Firestore 상태와 로컬 타이머 동기화 (운행 중이 아니면 타이머 초기화)
  useEffect(() => {
    setTimerActive(userData.isRiding || false);
  }, [userData.isRiding]);

  useEffect(() => {
    let interval;
    if (timerActive && trackingStartTime) {
      interval = setInterval(() => setElapsedSeconds(Math.floor((new Date() - new Date(trackingStartTime)) / 1000)), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, trackingStartTime]);

  const filteredDailyDeliveries = useMemo(() => {
    return dailyDeliveries.filter(d => typeof d?.date === 'string' && d.date.startsWith(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`));
  }, [dailyDeliveries, selectedYear, selectedMonth]);

  const deliveryFilteredTotal = filteredDailyDeliveries.reduce((a, b) => a + (b.amount || 0), 0);
  const deliveryFilteredCount = filteredDailyDeliveries.reduce((a, b) => a + (b.count || 0), 0);

  const pendingByPayday = useMemo(() => {
    const groups = {};
    dailyDeliveries.forEach(d => {
      const pd = getPaydayStr(d.date);
      if (!pd || pd < todayStr) return;
      if (!groups[pd]) groups[pd] = { total: 0, items: [] };
      groups[pd].total += (d.amount || 0);
      groups[pd].items.push(d);
    });
    return groups;
  }, [dailyDeliveries, todayStr]);
  const upcomingPaydays = Object.keys(pendingByPayday).sort();

  // 💡 [수정] 배달 시작 시 Firestore user 문서의 isRiding 업데이트
  const handleStartDelivery = async () => {
    setTrackingStartTime(new Date().toISOString());
    setTimerActive(true);
    setElapsedSeconds(0);
    await updateDoc(doc(db, 'users', user.uid), { isRiding: true, isStealth: false });
  };

  // 💡 [수정] 배달 종료 시 Firestore 업데이트
  const handleEndDelivery = async () => {
    const endObj = new Date();
    const startObj = trackingStartTime ? new Date(trackingStartTime) : endObj;
    
    setDeliveryFormData({ 
      ...emptyForm, 
      date: getKSTDateStr(), 
      startTime: `${String(startObj.getHours()).padStart(2, '0')}:${String(startObj.getMinutes()).padStart(2, '0')}`,
      endTime: `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`
    });
    
    setTimerActive(false);
    setTrackingStartTime(null);
    setIsDeliveryModalOpen(true);

    // 운행 종료 및 스텔스 초기화
    await updateDoc(doc(db, 'users', user.uid), { isRiding: false, isStealth: false });
  };

  // 💡 [추가] 스텔스 모드 토글
  const toggleStealth = async () => {
    await updateDoc(doc(db, 'users', user.uid), { isStealth: !userData.isStealth });
  };

  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    const timestamp = new Date().toISOString();

    const adds = [];
    const createAdd = (amtStr, cntStr, platform) => {
      const amt = parseInt(String(amtStr || 0).replace(/,/g, ''), 10) || 0;
      const cnt = parseInt(String(cntStr || 0).replace(/,/g, ''), 10) || 0;
      if (amt > 0 || cnt > 0) {
        adds.push({
          userId: user.uid,
          date: deliveryFormData.date,
          platform,
          amount: amt,
          count: cnt,
          startTime: deliveryFormData.startTime,
          endTime: deliveryFormData.endTime,
          updatedAt: timestamp,
          nickname: userData.nickname
        });
      }
    };

    createAdd(deliveryFormData.amountBaemin, deliveryFormData.countBaemin, '배민');
    createAdd(deliveryFormData.amountCoupang, deliveryFormData.countCoupang, '쿠팡');

    for (const newDel of adds) {
      await addDoc(collection(db, 'delivery'), newDel);
    }

    setIsDeliveryModalOpen(false);
    setDeliveryFormData(emptyForm);
  };

  const deleteShift = async (id) => {
    if(!window.confirm('기록을 정말 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'delivery', id));
  };

  return (
    <div className="flex flex-col gap-3 pb-8 pt-2 animate-in fade-in duration-500 text-slate-800">
      
      <div className="flex justify-between items-center px-4 mb-2">
        <button onClick={() => setSelectedMonth(m => m === 1 ? 12 : m - 1)} className="p-2 bg-white rounded-full shadow-sm"><ChevronLeft size={18}/></button>
        <span className="text-lg font-black">{selectedYear}년 {selectedMonth}월</span>
        <button onClick={() => setSelectedMonth(m => m === 12 ? 1 : m + 1)} className="p-2 bg-white rounded-full shadow-sm"><ChevronRight size={18}/></button>
      </div>

      <div className={`mx-2 rounded-[2rem] p-5 shadow-lg transition-all duration-700 ${timerActive ? (userData.isStealth ? 'bg-gradient-to-br from-gray-700 to-gray-900 ring-4 ring-gray-400' : 'bg-gradient-to-br from-blue-600 to-indigo-800 ring-4 ring-blue-100') : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${timerActive ? 'bg-white/20 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
               {userData.isStealth ? <Ghost size={24} /> : <Timer size={24} />}
            </div>
            <div>
              <div className="text-[11px] font-black text-blue-100 flex items-center mb-0.5">
                {userData.isStealth ? 'Stealth Mode On' : 'Live Tracking'}
                {timerActive && <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ml-1.5 ${userData.isStealth ? 'bg-gray-400' : 'bg-red-400'}`}></span>}
              </div>
              <div className="text-[32px] font-black tracking-tighter leading-none text-white">
                 {timerActive && trackingStartTime ? `${Math.floor(elapsedSeconds/3600).toString().padStart(2,'0')}:${String(Math.floor((elapsedSeconds%3600)/60)).padStart(2,'0')}:${String(elapsedSeconds%60).padStart(2,'0')}` : '00:00:00'}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 items-end">
            <button onClick={() => timerActive ? handleEndDelivery() : handleStartDelivery()} 
              className={`px-5 py-3 rounded-[1.2rem] font-black text-sm shadow-md transition-all active:scale-95 ${timerActive ? 'bg-white text-blue-700' : 'bg-white/20 text-white border border-white/20'}`}>
              {timerActive ? '마감하기' : '배달 시작'}
            </button>
            {/* 💡 스텔스 토글 버튼 (운행 중에만 노출) */}
            {timerActive && (
              <button onClick={toggleStealth} className={`text-[10px] px-3 py-1.5 rounded-lg font-black flex items-center gap-1 transition-all shadow-sm ${userData.isStealth ? 'bg-gray-800 text-gray-200 border border-gray-600' : 'bg-blue-800/50 text-blue-100 border border-blue-400/30'}`}>
                 <Ghost size={12}/> {userData.isStealth ? '스텔스 끄기' : '스텔스 켜기'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mx-2">
        <button onClick={() => { setIsDeliverySummaryOpen(!isDeliverySummaryOpen); setIsPendingSummaryOpen(false); }} className={`flex-1 py-3.5 rounded-2xl border text-[13px] font-black shadow-sm flex justify-center items-center gap-1.5 ${isDeliverySummaryOpen ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
           🏍️ 이번 달 수익 {isDeliverySummaryOpen ? '∧' : '∨'}
        </button>
        <button onClick={() => { setIsPendingSummaryOpen(!isPendingSummaryOpen); setIsDeliverySummaryOpen(false); }} className={`flex-1 py-3.5 rounded-2xl border text-[13px] font-black shadow-sm flex justify-center items-center gap-1.5 ${isPendingSummaryOpen ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
           💰 정산 예정금 {isPendingSummaryOpen ? '∧' : '∨'}
        </button>
      </div>

      {isDeliverySummaryOpen && (
        <div className="mx-2 bg-gradient-to-br from-blue-700 to-indigo-800 rounded-[2rem] p-5 text-white shadow-lg animate-in slide-in-from-top-2">
          <div className="text-[11px] font-black opacity-90 mb-1">{selectedMonth}월 수익 현황</div>
          <div className="text-[32px] font-black tracking-tighter leading-none mb-4">{formatLargeMoney(deliveryFilteredTotal)}<span className="text-base ml-1 opacity-80">원</span></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-xl p-3 flex justify-between items-center"><span className="text-xs font-bold text-[#4cd1cc]">배민</span><span className="text-sm font-black">{formatLargeMoney(filteredDailyDeliveries.filter(d=>d.platform==='배민').reduce((a,b)=>a+(b.amount||0),0))}원</span></div>
            <div className="bg-white/10 rounded-xl p-3 flex justify-between items-center"><span className="text-xs font-bold text-blue-200">쿠팡</span><span className="text-sm font-black">{formatLargeMoney(filteredDailyDeliveries.filter(d=>d.platform==='쿠팡').reduce((a,b)=>a+(b.amount||0),0))}원</span></div>
          </div>
        </div>
      )}

      {isPendingSummaryOpen && (
        <div className="mx-2 animate-in slide-in-from-top-2 space-y-2">
          {upcomingPaydays.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 text-center text-slate-400 font-bold text-sm shadow-sm">입금 대기 중인 정산금이 없습니다.</div>
          ) : (
            upcomingPaydays.map(pd => (
              <div key={pd} className="bg-gradient-to-br from-teal-700 to-cyan-800 rounded-[2rem] p-5 text-white shadow-lg">
                <div className="text-[11px] font-black opacity-90 mb-1">{pd.slice(5).replace('-','/')} 입금예정</div>
                <div className="text-[32px] font-black tracking-tighter">{formatLargeMoney(pendingByPayday[pd].total)}<span className="text-base opacity-80 ml-1">원</span></div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mx-2 mt-4 space-y-2">
        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-2 mb-2">최근 배달 로그</h3>
        {dailyDeliveries.slice(0, 15).map(d => (
          <div key={d.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm ${d.platform === '배민' ? 'bg-[#2ac1bc] text-white' : 'bg-gray-800 text-white'}`}>{d.platform}</div>
              <div>
                <p className="text-[15px] font-black text-gray-800">{formatLargeMoney(d.amount)}원</p>
                <p className="text-[10px] font-bold text-gray-400">{d.date.replace(/-/g, '.')} ({d.startTime}~{d.endTime}) · {d.count}건</p>
              </div>
            </div>
            <button onClick={() => deleteShift(d.id)} className="p-2 text-gray-300 hover:text-red-400"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>

      <button onClick={() => { setDeliveryFormData(emptyForm); setIsDeliveryModalOpen(true); }} className="fixed bottom-24 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-[0_4px_20px_rgba(37,99,235,0.5)] flex items-center justify-center active:scale-90 transition-transform z-40">
        <Plus size={28}/>
      </button>

      {isDeliveryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-[90] p-0">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom border-t-8 border-blue-600">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5"></div>
            <h2 className="text-xl font-black text-gray-900 mb-5">오늘 고생하셨습니다! 🏁</h2>
            
            <form onSubmit={handleDeliverySubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2 pb-2">
                <div className="bg-gray-50 rounded-xl p-2 border">
                  <label className="text-[10px] font-bold text-gray-400 ml-1">날짜</label>
                  <input type="date" value={deliveryFormData.date} onChange={e=>setDeliveryFormData({...deliveryFormData, date:e.target.value})} className="w-full bg-transparent px-1 font-black text-[13px] outline-none" />
                </div>
                <div className="bg-gray-50 rounded-xl p-2 border">
                  <label className="text-[10px] font-bold text-gray-400 ml-1">시작시간</label>
                  <input type="time" value={deliveryFormData.startTime} onChange={e=>setDeliveryFormData({...deliveryFormData, startTime:e.target.value})} className="w-full bg-transparent px-1 font-black text-[13px] outline-none" />
                </div>
                <div className="bg-gray-50 rounded-xl p-2 border">
                  <label className="text-[10px] font-bold text-gray-400 ml-1">종료시간</label>
                  <input type="time" value={deliveryFormData.endTime} onChange={e=>setDeliveryFormData({...deliveryFormData, endTime:e.target.value})} className="w-full bg-transparent px-1 font-black text-[13px] outline-none text-rose-500" />
                </div>
              </div>

              <div className="bg-[#2ac1bc]/10 p-4 rounded-2xl border border-[#2ac1bc]/30">
                <div className="font-black text-[#1f938f] text-[13px] mb-2 flex items-center gap-1.5"><Bike size={14}/> 배달의민족</div>
                <div className="flex gap-2">
                  <input placeholder="총 수익 금액" type="text" inputMode="numeric" value={deliveryFormData.amountBaemin ? formatLargeMoney(deliveryFormData.amountBaemin) : ''} onChange={e => setDeliveryFormData({...deliveryFormData, amountBaemin: e.target.value.replace(/[^0-9]/g, '')})} className="flex-[7] p-3.5 rounded-xl border border-white outline-none font-black text-lg focus:ring-2 focus:ring-[#2ac1bc]/50" />
                  <input placeholder="건수" type="text" inputMode="numeric" value={deliveryFormData.countBaemin} onChange={e => setDeliveryFormData({...deliveryFormData, countBaemin: e.target.value.replace(/[^0-9]/g, '')})} className="flex-[3] p-3.5 rounded-xl border border-white outline-none font-black text-lg text-center focus:ring-2 focus:ring-[#2ac1bc]/50" />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <div className="font-black text-blue-600 text-[13px] mb-2 flex items-center gap-1.5"><Bike size={14}/> 쿠팡이츠</div>
                <div className="flex gap-2">
                  <input placeholder="총 수익 금액" type="text" inputMode="numeric" value={deliveryFormData.amountCoupang ? formatLargeMoney(deliveryFormData.amountCoupang) : ''} onChange={e => setDeliveryFormData({...deliveryFormData, amountCoupang: e.target.value.replace(/[^0-9]/g, '')})} className="flex-[7] p-3.5 rounded-xl border border-white outline-none font-black text-lg focus:ring-2 focus:ring-blue-300" />
                  <input placeholder="건수" type="text" inputMode="numeric" value={deliveryFormData.countCoupang} onChange={e => setDeliveryFormData({...deliveryFormData, countCoupang: e.target.value.replace(/[^0-9]/g, '')})} className="flex-[3] p-3.5 rounded-xl border border-white outline-none font-black text-lg text-center focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>

              <button type="submit" className="w-full bg-gray-900 text-white py-4 mt-2 rounded-2xl font-black text-lg shadow-xl active:scale-95">저장하고 마감하기</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. 운행 현황 뷰 (새로운 기능!)
// ==========================================
function StatusView({ allUsers }) {
  // 스텔스 인원은 활동(Active)에서 빼고 비운행(Inactive)로 섞습니다.
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
              <div key={rider.uid} className="flex justify-between items-center bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100/50">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shadow-md shadow-blue-200">
                      {rider.nickname.slice(0,2)}
                    </div>
                    <div>
                      <div className="font-black text-gray-800">{rider.nickname}</div>
                      <div className="text-[11px] font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-0.5 inline-block">
                        {getBikeFourDigits(rider.bikeNumber)}
                      </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-1">
                    <span className="relative flex h-3 w-3 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-blue-600">배달중</span>
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
        
        <div className="space-y-2">
          {inactiveRiders.length === 0 ? (
            <div className="text-center py-6 text-gray-400 font-bold text-sm">모두가 배달 중입니다! 🔥</div>
          ) : (
            inactiveRiders.map(rider => (
              <div key={rider.uid} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                 <div className="flex items-center gap-3 opacity-60">
                    <div className="w-8 h-8 bg-gray-300 text-white rounded-full flex items-center justify-center font-black text-xs">
                      {rider.nickname.slice(0,2)}
                    </div>
                    <div>
                      <div className="font-black text-gray-700 text-sm">{rider.nickname}</div>
                      <div className="text-[10px] font-bold text-gray-400">
                        {getBikeFourDigits(rider.bikeNumber)}
                      </div>
                    </div>
                 </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// [메인 앱]
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [allUsers, setAllUsers] = useState([]); // 💡 모든 유저 상태 (현황판 용)
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState('delivery'); // 'delivery' | 'status' | 'settings'
  
  const [dailyDeliveries, setDailyDeliveries] = useState([]);

  // 인증 감시
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // 내 사용자 정보 실시간 감시
        const userDocRef = doc(db, 'users', currentUser.uid);
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data());
          setLoading(false);
        });

        // 💡 모든 승인된 유저 목록 가져오기 (운행 현황 용)
        const usersQuery = query(collection(db, 'users'), where('status', '==', 'approved'));
        onSnapshot(usersQuery, (s) => {
           const users = s.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
           setAllUsers(users);
        });
 
        // 본인의 배달 내역 감시
        const q = query(collection(db, 'delivery'), where('userId', '==', currentUser.uid));
        onSnapshot(q, (s) => {
          const docs = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setDailyDeliveries(docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).reverse());
        });
      } else {
        setUser(null);
        setUserData(null);
        setAllUsers([]);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-orange-500 text-2xl bg-orange-50">🛵 로딩 중...</div>;

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
      <p className="text-gray-500 font-bold mb-1">단톡방 방장(관리자)의 승인을 기다려주세요!</p>
      <p className="text-xs text-gray-400 mb-8">{userData.nickname} / {userData.bikeNumber}</p>
      <button onClick={() => signOut(auth)} className="text-gray-400 font-bold border border-gray-200 px-6 py-2 rounded-xl active:bg-gray-100">임시 로그아웃</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans select-none pb-24">
      {/* 글로벌 헤더 */}
      <header className="bg-white/90 backdrop-blur-md px-6 pt-12 pb-4 shadow-sm border-b sticky top-0 z-40 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black text-orange-500 block mb-0.5 uppercase tracking-widest italic">Baesamo Pro</span>
          <h1 className="text-xl font-black">
            {activeTab === 'delivery' ? '내 배달 수익' : activeTab === 'status' ? '실시간 운행 현황' : '설정'}
          </h1>
        </div>
        <div className="bg-orange-50 px-3 py-1.5 rounded-full text-xs font-black text-orange-600 border border-orange-100 shadow-sm flex items-center gap-1.5">
          {userData.isRiding && !userData.isStealth && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>}
          {userData.nickname} 님
        </div>
      </header>

      {/* 메인 라우터 */}
      <main className="max-w-md mx-auto relative min-h-[80vh]">
        {activeTab === 'delivery' && (
          <DeliveryView user={user} userData={userData} dailyDeliveries={dailyDeliveries} />
        )}

        {/* 💡 새로 추가된 운행 현황 컴포넌트 호출 */}
        {activeTab === 'status' && (
          <StatusView allUsers={allUsers} />
        )}

        {activeTab === 'settings' && (
          <div className="px-5 pt-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 text-center space-y-6">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner border border-orange-100">🛵</div>
              <div>
                <h2 className="text-2xl font-black text-gray-800">{userData.nickname}</h2>
                <p className="text-sm font-bold text-gray-400 mt-1">{userData.name} · {userData.bikeNumber}</p>
                <div className="mt-4 inline-block bg-green-50 text-green-600 px-3 py-1 rounded-lg text-xs font-black border border-green-200">
                  승인된 정식 멤버
                </div>
              </div>
              <button onClick={() => signOut(auth)} className="w-full bg-gray-50 text-gray-500 py-4 rounded-2xl font-black border border-gray-200 active:scale-95 transition-transform hover:bg-gray-100">안전하게 로그아웃</button>
            </div>
          </div>
        )}
      </main>

      {/* 💡 하단 탭바 3개로 확장 */}
      <nav className="fixed bottom-6 left-6 right-6 h-[72px] bg-white/90 backdrop-blur-xl shadow-2xl rounded-full border border-gray-100 flex justify-around items-center z-50 max-w-sm mx-auto">
        <button onClick={() => setActiveTab('delivery')} className={`flex flex-col items-center w-20 transition-all ${activeTab === 'delivery' ? 'text-orange-500 scale-110' : 'text-gray-300 hover:text-gray-400'}`}>
          <Target size={24} className="mb-1" />
          <span className="text-[10px] font-black">수익관리</span>
        </button>
        <button onClick={() => setActiveTab('status')} className={`flex flex-col items-center w-20 transition-all ${activeTab === 'status' ? 'text-blue-500 scale-110' : 'text-gray-300 hover:text-gray-400'}`}>
          <Users size={24} className="mb-1" />
          <span className="text-[10px] font-black">운행현황</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center w-20 transition-all ${activeTab === 'settings' ? 'text-gray-800 scale-110' : 'text-gray-300 hover:text-gray-400'}`}>
          <Settings size={24} className="mb-1" />
          <span className="text-[10px] font-black">내 정보</span>
        </button>
      </nav>
    </div>
  );
}
