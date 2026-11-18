// 設定：期間・為替レート・キャラクター候補・共有パスワード
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Api, SHARED_LOGIN_EMAIL, type Settings } from "../api";
import { auth } from "../firebase";
import { useAuth } from "../components/Auth";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [chars, setChars] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Api.getSettings()
      .then((s) => {
        setSettings(s);
        setChars(s.characters.join("\n"));
      })
      .catch((e) => toast.error(e.message));
  }, [toast]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    try {
      const s = await Api.saveSettings({ ...settings, characters: lines(chars) });
      setSettings(s);
      setChars(s.characters.join("\n"));
      toast.info("設定を保存しました");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return <div className="page loading">読み込み中…</div>;

  return (
    <div className="page settings">
      <PageHeader title="設定" actions={<span className="mobile-only"><LogoutButton /></span>} />
      <form className="card" onSubmit={save}>
        <h2>期間・為替レート</h2>
        <div className="form-grid">
          <label>
            開始月
            <input type="month" required value={settings.startMonth} onChange={(e) => setSettings({ ...settings, startMonth: e.target.value })} />
          </label>
          <label>
            終了月
            <input type="month" required value={settings.endMonth} onChange={(e) => setSettings({ ...settings, endMonth: e.target.value })} />
          </label>
          <label>
            為替レート（1元 = ○円）
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={settings.jpyPerCny}
              onChange={(e) => setSettings({ ...settings, jpyPerCny: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="hint">
          日本の売上は円で入力し、このレートで元に換算して表示・集計します（レートを変えると過去の分も含めて換算し直します）。期間を縮めても、入力済みのデータは消えません。
        </p>
        <h2>キャラクター候補</h2>
        <p className="hint">1行に1つずつ入力します。入力フォームの候補に表示されます（候補にない名前も入力できます）。</p>
        <textarea rows={5} value={chars} onChange={(e) => setChars(e.target.value)} />
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            保存する
          </button>
        </div>
      </form>
      <PasswordCard />
    </div>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button className="btn" onClick={logout}>
      ログアウト
    </button>
  );
}

function PasswordCard() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) {
      toast.error("確認用のパスワードが一致しません");
      return;
    }
    setBusy(true);
    try {
      await Api.changePassword(pw);
      // パスワードを変えると以前のログインが無効になるので、新しいパスワードで入り直す
      await signInWithEmailAndPassword(auth, SHARED_LOGIN_EMAIL, pw);
      setPw("");
      setPw2("");
      toast.info("パスワードを変更しました");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>ログインパスワード</h2>
      <p className="hint">全員共通のパスワードです。変更すると、他の人の端末は新しいパスワードで入り直しになります。</p>
      <div className="form-grid">
        <label>
          新しいパスワード（8文字以上）
          <input type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label>
          もう一度入力
          <input type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={busy}>
          変更する
        </button>
      </div>
    </form>
  );
}
