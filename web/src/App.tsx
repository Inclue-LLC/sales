import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Api } from "./api";
import { AuthProvider, useAuth } from "./components/Auth";
import { IconBriefcase, IconCalendar, IconChart, IconLogout, IconSettings } from "./components/Icons";
import { ToastProvider } from "./components/Toast";
import DealsPage from "./pages/Deals";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import SettingsPage from "./pages/Settings";
import WeeklyPage from "./pages/Weekly";

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
          <p>このアカウント（{user.email}）には利用権限がありません。</p>
          <button onClick={logout}>ログアウト</button>
        </div>
      </div>
    );

  const nav = [
    { to: "/pl", label: "ダッシュボード", icon: <IconChart /> },
    { to: "/weekly", label: "オンライン週次", icon: <IconCalendar /> },
    { to: "/deals", label: "ライセンス案件", icon: <IconBriefcase /> },
    { to: "/settings", label: "設定", icon: <IconSettings /> },
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
          <div className="user" title={user.email ?? ""}>
            <span className="avatar">{(user.email ?? "?").slice(0, 1).toUpperCase()}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button className="icon-btn" onClick={logout} title="ログアウト" aria-label="ログアウト">
            <IconLogout />
          </button>
        </div>
      </aside>
      <main>
        <Routes>
          <Route path="/pl" element={<DashboardPage />} />
          <Route path="/weekly" element={<WeeklyPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/pl" replace />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to}>
            {n.icon}
            <span>{n.label.replace("オンライン", "")}</span>
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
