import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Api } from "./api";
import { AuthProvider, useAuth } from "./components/Auth";
import { IconBag, IconBriefcase, IconDots, IconLogout, IconSettings, IconStore, IconTable } from "./components/Icons";
import { ToastProvider } from "./components/Toast";
import LoginPage from "./pages/Login";
import EntryPage from "./pages/EntryPage";
import OnlinePage from "./pages/Online";
import SummaryPage from "./pages/Summary";
import { licenseConfig, offlineConfig, otherConfig } from "./pages/configs";
import SettingsPage from "./pages/Settings";

function Shell() {
  const { user, ready, logout } = useAuth();
  const [access, setAccess] = useState<"checking" | "ok" | "denied">("checking");

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
          <p>このアカウントでは利用できません。ログアウトして、共有パスワードで入り直してください。</p>
          <button onClick={logout}>ログアウト</button>
        </div>
      </div>
    );

  const nav = [
    { to: "/summary", label: "売上一覧", short: "一覧", icon: <IconTable /> },
    { to: "/license", label: "ライセンス", short: "ライセンス", icon: <IconBriefcase /> },
    { to: "/online", label: "オンライン", short: "オンライン", icon: <IconBag /> },
    { to: "/offline", label: "オフライン", short: "オフライン", icon: <IconStore /> },
    { to: "/other", label: "その他", short: "その他", icon: <IconDots /> },
    { to: "/settings", label: "設定", short: "設定", icon: <IconSettings /> },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">PL</span>
          <span>売上PL管理</span>
        </div>
        <nav>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {n.icon}
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="user-email">ログイン中</span>
          <div className="spacer" />
          <button className="icon-btn" onClick={logout} title="ログアウト" aria-label="ログアウト">
            <IconLogout />
          </button>
        </div>
      </aside>
      <main>
        <Routes>
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/license" element={<EntryPage key="license" config={licenseConfig} />} />
          <Route path="/online" element={<OnlinePage />} />
          <Route path="/offline" element={<EntryPage key="offline" config={offlineConfig} />} />
          <Route path="/other" element={<EntryPage key="other" config={otherConfig} />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/summary" replace />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to}>
            {n.icon}
            <span>{n.short}</span>
          </NavLink>
        ))}
      </nav>
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
