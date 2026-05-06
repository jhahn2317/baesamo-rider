import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
// 💡 아이콘 라이브러리 충돌을 막기 위해 lucide-react 임포트를 제거했습니다!
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// 1. 배사모 FIREBASE SETUP
const firebaseConfig = {
  apiKey: "AIzaSyCfRl6es38NWQA1GUAxT5Uxx446lEBAG0c",
  authDomain: "baesamo-app.firebaseapp.com",
  projectId: "baesamo-app",
  storageBucket: "baesamo-app.firebasestorage.app",
  messagingSenderId: "246846263578",
  appId: "1:246846263578:web:7b77296cddbe144e1a1ca3",
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase 초기화 에러", e);
}

// ==========================================
// [컴포넌트 1] 로그인 화면
// ==========================================
function LoginScreen({ onLogin, onGoToRegister }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const fakeEmail = `${loginId}@baesamo.com`;
    onLogin(fakeEmail, password);
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md mb-4 text-5xl">
        🛵
      </div>
      <h1 className="text-3xl font-black text-gray-800 mb-2 tracking-tighter">
        배사모 RIDER
      </h1>
      <p className="text-gray-500 font-bold text-sm mb-8">
        배달을 사랑하는 모임 전용 수익 관리 앱
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input
          required
          type="text"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value.toLowerCase())}
          placeholder="아이디 (영문/숫자)"
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3.5 font-bold outline-none focus:border-orange-400 shadow-sm"
        />
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자리 이상)"
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3.5 font-bold outline-none focus:border-orange-400 shadow-sm mb-2"
        />

        <button
          type="submit"
          className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform mt-4"
        >
          🔑 로그인
        </button>
      </form>

      <button
        onClick={onGoToRegister}
        className="mt-6 text-sm font-black text-gray-500 underline flex items-center justify-center gap-1"
      >
        📝 아직 계정이 없으신가요? 가입하기
      </button>
    </div>
  );
}

// ==========================================
// [컴포넌트 2] 신규 가입 폼 화면
// ==========================================
function RegisterScreen({ onRegister, onBackToLogin }) {
  const [formData, setFormData] = useState({
    loginId: "",
    password: "",
    name: "",
    bikeNumber: "",
    nickname: "",
    birthYear: "",
    rider1: "메인폰",
    rider2: "서브폰",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      alert("비밀번호는 6자리 이상이어야 합니다.");
      return;
    }

    const fakeEmail = `${formData.loginId}@baesamo.com`;
    const age = 2026 - parseInt(formData.birthYear) + 1;

    onRegister({ ...formData, email: fakeEmail, age, status: "pending" });
  };

  return (
    <div className="min-h-screen bg-white p-6 pt-10 flex flex-col items-center">
      <h2 className="text-2xl font-black text-gray-800 mb-6 text-center">
        회원가입 ✍️
      </h2>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-3">
          <div>
            <label className="text-[10px] font-black text-orange-600 ml-1">
              아이디 (영문/숫자)
            </label>
            <input
              required
              type="text"
              value={formData.loginId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  loginId: e.target.value.toLowerCase(),
                })
              }
              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-orange-400"
              placeholder="예: snack3"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-orange-600 ml-1">
              비밀번호 (6자리 이상)
            </label>
            <input
              required
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-orange-400"
              placeholder="******"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-500 ml-1">
            이름 (실명)
          </label>
          <input
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-gray-400"
            placeholder="홍길동"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-500 ml-1">
            단톡방 닉네임
          </label>
          <input
            required
            value={formData.nickname}
            onChange={(e) =>
              setFormData({ ...formData, nickname: e.target.value })
            }
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-gray-400"
            placeholder="배달왕길동"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-500 ml-1">
            오토바이 번호
          </label>
          <input
            required
            value={formData.bikeNumber}
            onChange={(e) =>
              setFormData({ ...formData, bikeNumber: e.target.value })
            }
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-gray-400"
            placeholder="경기화성라7475"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-500 ml-1">
            출생년도 (4자리 숫자)
          </label>
          <input
            required
            type="number"
            value={formData.birthYear}
            onChange={(e) =>
              setFormData({ ...formData, birthYear: e.target.value })
            }
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-gray-400"
            placeholder="1990"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black shadow-md mt-4 active:scale-95"
        >
          가입 신청 완료
        </button>
        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full bg-white text-gray-500 py-3.5 rounded-2xl font-black border border-gray-200 mt-2 active:scale-95"
        >
          뒤로 가기
        </button>
      </form>
    </div>
  );
}

// ==========================================
// [컴포넌트 3] 승인 대기 화면
// ==========================================
function PendingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🚨</div>
      <h2 className="text-2xl font-black text-gray-800 mb-2">
        승인 대기 중입니다 ⏳
      </h2>
      <p className="text-gray-500 font-bold text-sm leading-relaxed">
        관리자가 가입을 승인하면 앱을 사용할 수 있습니다.
        <br />
        단톡방에 승인 요청을 남겨주세요!
      </p>
      <button
        onClick={() => signOut(auth)}
        className="mt-8 text-sm font-bold text-gray-400 underline"
      >
        로그아웃
      </button>
    </div>
  );
}

// ==========================================
// [메인 앱] 라우팅 및 탭 관리
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState("delivery");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const unsubDoc = onSnapshot(
          doc(db, "users", currentUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data());
            } else {
              signOut(auth);
            }
            setLoading(false);
          }
        );
        return () => unsubDoc();
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert("로그인 실패! 아이디나 비밀번호를 확인해주세요.");
      console.error(error);
    }
  };

  const handleRegister = async (data) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      const newUser = userCredential.user;

      const { password, ...dbData } = data;
      await setDoc(doc(db, "users", newUser.uid), dbData);

      alert("가입 성공! 관리자 승인을 기다려주세요.");
      setShowRegister(false);
    } catch (error) {
      alert("가입 실패! (이미 존재하는 아이디이거나 오류가 발생했습니다)");
      console.error(error);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center font-black text-orange-500">
        로딩중... 🛵
      </div>
    );

  if (!user) {
    if (showRegister) {
      return (
        <RegisterScreen
          onRegister={handleRegister}
          onBackToLogin={() => setShowRegister(false)}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={handleLogin}
        onGoToRegister={() => setShowRegister(true)}
      />
    );
  }

  if (userData?.status === "pending") return <PendingScreen />;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900">
      <header className="bg-white px-5 pt-10 pb-4 shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black text-orange-500 tracking-widest block mb-0.5">
              BAESAMO RIDER
            </span>
            <h1 className="text-xl font-black">
              {activeTab === "delivery"
                ? "내 배달 기록"
                : activeTab === "board"
                ? "라이더 현황판"
                : "설정 / 내 정보"}
            </h1>
          </div>
          <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            {userData?.nickname || "사용자"} 님
          </div>
        </div>
      </header>

      <main className="px-5 pt-4 max-w-md mx-auto">
        {activeTab === "delivery" && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 text-center">
            <h2 className="text-lg font-black text-gray-800 mb-2">
              여기에 배달 기능이 들어갑니다!
            </h2>
            <div className="text-xs text-orange-500 font-black bg-orange-50 p-2 rounded-xl">
              투폰 설정: {userData?.rider1} / {userData?.rider2}
            </div>
          </div>
        )}

        {activeTab === "board" && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 text-center">
            <h2 className="text-lg font-black text-gray-800 mb-2">
              라이더 현황판
            </h2>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 space-y-4 text-center">
            <h2 className="text-lg font-black text-gray-800">
              내 정보 및 설정
            </h2>
            <p className="text-sm text-gray-500 font-bold mb-4">
              {userData?.bikeNumber} / {userData?.age}세
            </p>

            {userData?.status === "admin" && (
              <button className="w-full bg-blue-500 text-white py-3 rounded-xl font-black mb-2 shadow-md">
                👑 관리자: 친구들 가입 승인하기
              </button>
            )}

            <button
              onClick={() => signOut(auth)}
              className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-black border border-gray-200"
            >
              로그아웃
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-4 right-4 h-[72px] bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-lg border border-gray-200 flex justify-around items-center z-50 px-2 max-w-md mx-auto">
        <button
          onClick={() => setActiveTab("delivery")}
          className={`flex flex-col items-center w-16 transition-all ${
            activeTab === "delivery"
              ? "text-orange-500 scale-110"
              : "text-gray-400"
          }`}
        >
          <div className="text-xl">🎯</div>
          <span className="text-[10px] font-black mt-1.5">내 기록</span>
        </button>
        <button
          onClick={() => setActiveTab("board")}
          className={`flex flex-col items-center w-16 transition-all ${
            activeTab === "board"
              ? "text-orange-500 scale-110"
              : "text-gray-400"
          }`}
        >
          <div className="text-xl">🛵</div>
          <span className="text-[10px] font-black mt-1.5">현황판</span>
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center w-16 transition-all ${
            activeTab === "settings"
              ? "text-orange-500 scale-110"
              : "text-gray-400"
          }`}
        >
          <div className="text-xl">⚙️</div>
          <span className="text-[10px] font-black mt-1.5">설정</span>
        </button>
      </nav>
    </div>
  );
}
