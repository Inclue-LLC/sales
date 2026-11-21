// ログイン：共有パスワードだけを入力する（内部では共有アカウントでログイン）
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { SHARED_LOGIN_EMAIL } from "../api";
import { auth } from "../firebase";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, SHARED_LOGIN_EMAIL, password);
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(
        code === "auth/too-many-requests"
          ? "何度も間違えたため、しばらくログインできません。時間をおいてお試しください"
          : "パスワードが正しくありません",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <span className="brand-mark">PL</span>
        <h1>売上PL管理</h1>
        {/* パスワード管理ツールが共有アカウントとして保存できるよう、見えないユーザー名欄を置く */}
        <input type="text" name="username" autoComplete="username" value={SHARED_LOGIN_EMAIL} readOnly hidden />
        <label>
          パスワード
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={busy}>
          ログイン
        </button>
      </form>
    </div>
  );
}
