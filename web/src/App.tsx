import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Api } from "./api";
import { AuthProvider, useAuth } from "./components/Auth";
import { ToastProvider } from "./components/Toast";
import DealsPage from "./pages/Deals";
import LoginPage from "./pages/Login";
import MonthlyPlPage from "./pages/MonthlyPl";
import SettingsPage from "./pages/Settings";
import WeeklyPage from "./pages/Weekly";

function Shell() {
  const { user, ready, logout } = useAuth();
  const [access, setAccess] = useState<"checking" | "ok" | "denied">("checking");
  const [menuOpen, setMenuOpen] = useState(false);

  // メンバー登録されているか確認（Auth にアカウントがあってもメンバーでなければ使えない）
  useEffect(() => {
    if (!user) return;
    setAccess("checking");
    Api.getSettings()
      .then(() => setAccess("ok"))
      .catch((e: Error) => setAccess(e.message.includes("権限") ? "denied" : "ok"));
  }, [user]);

  if (!ready) return <div className="loading">読み込み中…</div>;
  if (!user) return <LoginPage />;
  if (access === "checking") return <div className="loading">読み込み中…</div>;
  if (access === "denied")
    return (
      <div className="login">
        <div className="card login-card">
          <p>このアカウント（{user.email}）には利用権限がありません。</p>
          <button onClick={logout}>ログアウト</button>
        </div>
      </div>
    );

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">売上PL管理</span>
        <button className="menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="メニュー">
          ☰
        </button>
        <nav className={menuOpen ? "open" : ""} onClick={() => setMenuOpen(false)}>
          <NavLink to="/pl">月次PL</NavLink>
          <NavLink to="/weekly">オンライン週次</NavLink>
          <NavLink to="/deals">ライセンス案件</NavLink>
          <NavLink to="/settings">設定</NavLink>
          <a className="nav-logout" onClick={logout}>
            ログアウト
          </a>
        </nav>
        <div className="spacer" />
        <span className="user">{user.email}</span>
        <button className="link" onClick={logout}>
          ログアウト
        </button>
      </header>
      <main>
        <Routes>
          <Route path="/pl" element={<MonthlyPlPage />} />
          <Route path="/weekly" element={<WeeklyPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/pl" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
