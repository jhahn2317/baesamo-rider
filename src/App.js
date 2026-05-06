import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, 
  addDoc, query, where, deleteDoc 
} from 'firebase/firestore';

// ==========================================
// 1. 배사모 FIREBASE SETUP
// [주의] 만약 가입 에러가 계속된다면, 파이어베이스 콘솔의 '프로젝트 설정'에서 
// 이 값을 최신값으로 다시 확인해 보세요.
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

// 정산일 계산 헬퍼 함수
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
// [화면 컴포넌트] 로그인 / 회원가입 / 대기
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
      <p className="text-gray-400 text-xs mb-8 font-bold">배달을 사랑하는 모임 전용 수익 관리 앱</p>
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
    onRegister({ ...formData, email: fakeEmail, age, status: 'pending' });
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
// [메인 앱]
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState('delivery');

  // 배달 관련 상태
  const [dailyDeliveries, setDailyDeliveries] = useState([]);
  const [timerActive, setTimerActive] = useState(false);
  const [trackingStartTime, setTrackingStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryFormData, setDeliveryFormData] = useState({ 
    date: '', startTime: '', endTime: '', 
    amountBaemin: '', countBaemin: '', 
    amountCoupang: '', countCoupang: '' 
  });

  // 인증 감시
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // 사용자 정보 실시간 감시
        const userDocRef = doc(db, 'users', currentUser.uid);
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data());
          setLoading(false);
        });
        // 배달 내역 실시간 감시
        const q = query(collection(db, 'delivery'), where('userId', '==', currentUser.uid));
        onSnapshot(q, (s) => {
          const docs = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setDailyDeliveries(docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        });
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // 타이머 로직
  useEffect(() => {
    let interval;
    if (timerActive && trackingStartTime) {
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((new Date() - new Date(trackingStartTime)) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, trackingStartTime]);

  const pendingAmount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return dailyDeliveries
      .filter(d => getPaydayStr(d.date) > today)
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [dailyDeliveries]);

  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    const timestamp = new Date().toISOString();
    const adds = [];
    const createAdd = (amt, cnt, platform) => {
      const finalAmt = parseInt(String(amt || 0).replace(/[^0-9]/g, ''), 10);
      const finalCnt = parseInt(String(cnt || 0).replace(/[^0-9]/g, ''), 10);
      if (finalAmt > 0 || finalCnt > 0) {
        adds.push({
          userId: user.uid,
          date: deliveryFormData.date || new Date().toISOString().split('T')[0],
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

    try {
      createAdd(deliveryFormData.amountBaemin, deliveryFormData.countBaemin, '배민');
      createAdd(deliveryFormData.amountCoupang, deliveryFormData.countCoupang, '쿠팡');
      for (const data of adds) {
        await addDoc(collection(db, 'delivery'), data);
      }
      setTimerActive(false);
      setTrackingStartTime(null);
      setIsDeliveryModalOpen(false);
    } catch (err) {
      alert("기록 저장 실패: " + err.message);
    }
  };

  // 회원가입 함수 (디버깅 강화)
  const handleRegister = async (data) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await setDoc(doc(db, 'users', res.user.uid), { ...data, status: 'pending' });
      alert("신청 완료! 승인 대기 상태입니다.");
      setShowRegister(false);
    } catch (err) {
      console.error(err);
      // 구체적인 에러 메시지 팝업
      alert(`[가입에러] 코드: ${err.code}\n내용: ${err.message}`);
    }
  };

  if (loading) return <div className="min-h-screen flex flex-col items-center justify-center font-black text-orange-500 text-2xl bg-orange-50">🛵 로딩 중...</div>;

  if (!user) {
    if (showRegister) return <RegisterScreen onBackToLogin={() => setShowRegister(false)} onRegister={handleRegister} />;
    return <LoginScreen onGoToRegister={() => setShowRegister(true)} onLogin={async (e, p) => {
      try { await signInWithEmailAndPassword(auth, e, p); } catch (err) { alert("로그인 실패: 아이디 또는 비밀번호를 확인하세요."); }
    }} />;
  }

  if (!userData || userData.status === 'pending') return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-7xl mb-6">⏳</div>
      <h2 className="text-2xl font-black text-gray-800 mb-2">승인 대기 중</h2>
      <p className="text-gray-400 font-bold">관리자가 승인한 후에 서비스 이용이 가능합니다.</p>
      <button onClick={() => signOut(auth)} className="mt-10 text-gray-400 font-bold border border-gray-200 px-6 py-2 rounded-xl active:bg-gray-100">로그아웃</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-32 text-gray-900 font-sans select-none">
      <header className="bg-white/90 backdrop-blur-md px-6 pt-12 pb-4 shadow-sm border-b sticky top-0 z-40 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black text-orange-500 block mb-0.5 uppercase tracking-widest italic">Rider Pro</span>
          <h1 className="text-xl font-black">{activeTab === 'delivery' ? '내 배달 수익' : '설정'}</h1>
        </div>
        <div className="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-black text-gray-500">{userData.nickname} 님</div>
      </header>

      <main className="px-5 pt-6 max-w-md mx-auto">
        {activeTab === 'delivery' && (
          <div className="space-y-4">
            {/* 타이머 섹션 */}
            <div className={`p-6 rounded-[2.5rem] shadow-xl transition-all duration-700 ${timerActive ? 'bg-gradient-to-br from-blue-600 to-indigo-800 ring-4 ring-blue-100' : 'bg-slate-600'}`}>
              <div className="flex justify-between items-center text-white">
                <div>
                  <p className="text-[11px] font-black opacity-80 mb-1 uppercase">Live Tracking</p>
                  <p className="text-4xl font-black tracking-tighter">
                    {timerActive ? `${Math.floor(elapsedSeconds / 3600).toString().padStart(2, '0')}:${String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}` : '00:00:00'}
                  </p>
                </div>
                <button onClick={() => {
                  if (!timerActive) {
                    setTrackingStartTime(new Date().toISOString());
                    setTimerActive(true);
                    setElapsedSeconds(0);
                  } else {
                    const now = new Date();
                    setDeliveryFormData({ 
                      date: now.toISOString().split('T')[0], 
                      startTime: new Date(trackingStartTime).toTimeString().slice(0, 5), 
                      endTime: now.toTimeString().slice(0, 5), 
                      amountBaemin: '', countBaemin: '', amountCoupang: '', countCoupang: '' 
                    });
                    setIsDeliveryModalOpen(true);
                  }
                }} className={`px-6 py-4 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all ${timerActive ? 'bg-white text-blue-700' : 'bg-white/20 text-white border border-white/20'}`}>
                  {timerActive ? '운행 종료 🏁' : '배달 시작 🚀'}
                </button>
              </div>
            </div>

            {/* 카드 섹션 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">정산 예정금</p>
                <p className="text-xl font-black text-blue-600">{pendingAmount.toLocaleString()}원</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">전체 누계</p>
                <p className="text-xl font-black text-gray-800">{dailyDeliveries.reduce((a, b) => a + (b.amount || 0), 0).toLocaleString()}원</p>
              </div>
            </div>

            {/* 리스트 섹션 */}
            <div className="space-y-2 pt-4">
              <h3 className="text-[10px] font-black text-gray-400 px-2 uppercase tracking-widest">Recent Logs</h3>
              {dailyDeliveries.length === 0 ? (
                <div className="text-center py-10 text-gray-300 font-bold">기록이 없습니다.</div>
              ) : (
                dailyDeliveries.map(d => (
                  <div key={d.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${d.platform === '배민' ? 'bg-[#2ac1bc] text-white' : 'bg-gray-800 text-white'}`}>{d.platform}</div>
                      <div>
                        <p className="text-sm font-black text-gray-800">{d.amount.toLocaleString()}원</p>
                        <p className="text-[10px] font-bold text-gray-400">{d.date.replace(/-/g, '.')} · {d.count}건</p>
                      </div>
                    </div>
                    <button onClick={async () => { if (window.confirm('기록을 삭제할까요?')) await deleteDoc(doc(db, 'delivery', d.id)); }} className="text-gray-300 hover:text-red-400 text-xl font-light px-2">×</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 text-center space-y-6">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">👤</div>
            <div>
              <h2 className="text-2xl font-black text-gray-800">{userData.nickname}</h2>
              <p className="text-sm font-bold text-gray-400 mt-1">{userData.bikeNumber} · {userData.age}세</p>
            </div>
            <button onClick={() => signOut(auth)} className="w-full bg-gray-50 text-gray-400 py-4 rounded-2xl font-black border border-gray-100 active:scale-95 transition-transform">로그아웃</button>
          </div>
        )}
      </main>

      {/* 모달 섹션 */}
      {isDeliveryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end justify-center p-0">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom border-t-8 border-blue-600 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 shrink-0"></div>
            <h2 className="text-2xl font-black text-gray-900 mb-6">오늘 고생하셨습니다! 🏁</h2>
            <form onSubmit={handleDeliverySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-2xl border">
                  <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase">Start</label>
                  <input type="time" value={deliveryFormData.startTime} onChange={e => setDeliveryFormData({ ...deliveryFormData, startTime: e.target.value })} className="bg-transparent font-black w-full outline-none text-blue-600" />
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border">
                  <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase">End</label>
                  <input type="time" value={deliveryFormData.endTime} onChange={e => setDeliveryFormData({ ...deliveryFormData, endTime: e.target.value })} className="bg-transparent font-black w-full outline-none text-rose-500" />
                </div>
              </div>
              <div className="bg-teal-50/50 p-5 rounded-3xl border border-teal-100 space-y-3">
                <p className="text-xs font-black text-teal-600">🛵 배달의민족</p>
                <div className="flex gap-2">
                  <input placeholder="총수익" type="number" value={deliveryFormData.amountBaemin} onChange={e => setDeliveryFormData({ ...deliveryFormData, amountBaemin: e.target.value })} className="flex-[7] p-3 rounded-xl border font-black outline-none" />
                  <input placeholder="건수" type="number" value={deliveryFormData.countBaemin} onChange={e => setDeliveryFormData({ ...deliveryFormData, countBaemin: e.target.value })} className="flex-[3] p-3 rounded-xl border font-black text-center outline-none" />
                </div>
              </div>
              <div className="bg-gray-50 p-5 rounded-3xl border border-gray-200 space-y-3">
                <p className="text-xs font-black text-gray-600">🛵 쿠팡이츠</p>
                <div className="flex gap-2">
                  <input placeholder="총수익" type="number" value={deliveryFormData.amountCoupang} onChange={e => setDeliveryFormData({ ...deliveryFormData, amountCoupang: e.target.value })} className="flex-[7] p-3 rounded-xl border font-black outline-none" />
                  <input placeholder="건수" type="number" value={deliveryFormData.countCoupang} onChange={e => setDeliveryFormData({ ...deliveryFormData, countCoupang: e.target.value })} className="flex-[3] p-3 rounded-xl border font-black text-center outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-lg active:scale-95 shadow-lg">저장하고 마감하기 🎯</button>
              <button type="button" onClick={() => setIsDeliveryModalOpen(false)} className="w-full text-gray-400 font-bold py-2">기록 취소</button>
            </form>
          </div>
        </div>
      )}

      {/* 하단 탭바 */}
      <nav className="fixed bottom-8 left-6 right-6 h-20 bg-white/90 backdrop-blur-xl shadow-2xl rounded-[2.5rem] border border-gray-100 flex justify-around items-center z-50 max-w-md mx-auto">
        <button onClick={() => setActiveTab('delivery')} className={`flex flex-col items-center w-20 transition-all ${activeTab === 'delivery' ? 'text-blue-600 scale-110' : 'text-gray-300'}`}>
          <div className="text-2xl mb-1">🎯</div>
          <span className="text-[10px] font-black">수익분석</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center w-20 transition-all ${activeTab === 'settings' ? 'text-blue-600 scale-110' : 'text-gray-300'}`}>
          <div className="text-2xl mb-1">⚙️</div>
          <span className="text-[10px] font-black">설정</span>
        </button>
      </nav>
    </div>
  );
}
