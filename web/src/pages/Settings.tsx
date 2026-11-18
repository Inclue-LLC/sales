import { useCallback, useEffect, useState } from "react";
import { Api, type Masters, type Member, type Settings } from "../api";
import { useAuth } from "../components/Auth";
import { useToast } from "../components/Toast";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [chars, setChars] = useState("");
  const [contracts, setContracts] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Api.getSettings()
      .then(({ settings, masters }) => {
        setSettings(settings);
        setChars(masters.characters.join("\n"));
        setContracts(masters.contractTypes.join("\n"));
      })
      .catch((e) => toast.error(e.message));
  }, [toast]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    try {
      const masters: Masters = { characters: lines(chars), contractTypes: lines(contracts) };
      const r = await Api.saveSettings(settings, masters);
      setSettings(r.settings);
      setChars(r.masters.characters.join("\n"));
      setContracts(r.masters.contractTypes.join("\n"));
      toast.info("設定を保存しました");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return <div className="page loading">読み込み中…</div>;

  return (
    <div className="page page-scroll">
      <header className="page-head">
        <div>
          <h1>設定</h1>
          <p className="sub">期間・候補マスタ・メンバーを管理します</p>
        </div>
        <div className="head-actions mobile-only">
          <LogoutButton />
        </div>
      </header>
      <form className="card" onSubmit={save}>
        <h2>期間・表示</h2>
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
            通貨単位の表示ラベル
            <input value={settings.currencyLabel} maxLength={10} onChange={(e) => setSettings({ ...settings, currencyLabel: e.target.value })} />
          </label>
        </div>
        <p className="hint">期間を縮めても、期間外になったデータは削除されません（期間を戻すと再表示されます）。</p>

        <h2>候補マスタ</h2>
        <p className="hint">1行に1つずつ入力してください。候補を消しても、既存の案件の値はそのまま残ります。</p>
        <div className="form-grid">
          <label>
            キャラクター候補
            <textarea rows={6} value={chars} onChange={(e) => setChars(e.target.value)} />
          </label>
          <label>
            契約形態候補
            <textarea rows={6} value={contracts} onChange={(e) => setContracts(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <div className="spacer" />
          <button type="submit" className="primary" disabled={busy}>
            保存
          </button>
        </div>
      </form>
      <MembersCard />
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

function MembersCard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  const load = useCallback(() => {
    Api.listMembers().then(setMembers).catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  const wrap = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.info(msg);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>メンバー</h2>
      <p className="hint">全員が同じ権限で閲覧・編集できます。</p>
      <table className="table">
        <thead>
          <tr>
            <th>メールアドレス</th>
            <th>表示名</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.uid}>
              <td>{m.email}</td>
              <td>{m.displayName}</td>
              <td className="actions">
                <button
                  disabled={busy}
                  onClick={() => {
                    const pw = prompt(`${m.email} の新しいパスワード（8文字以上）`);
                    if (pw) wrap(() => Api.resetMemberPassword(m.uid, pw), "パスワードを変更しました");
                  }}
                >
                  パスワード変更
                </button>
                {m.uid !== user?.uid && (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => confirm(`${m.email} を削除しますか？`) && wrap(() => Api.deleteMember(m.uid), "削除しました")}
                  >
                    削除
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          wrap(async () => {
            await Api.createMember(form.email, form.password, form.displayName);
            setForm({ email: "", password: "", displayName: "" });
          }, "メンバーを追加しました");
        }}
      >
        <input type="email" required placeholder="メールアドレス" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="表示名" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <input
          type="password"
          required
          minLength={8}
          placeholder="初期パスワード（8文字以上）"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button type="submit" className="primary" disabled={busy}>
          追加
        </button>
      </form>
    </div>
  );
}
