import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Msg = { id: number; kind: "info" | "error"; text: string };
type ToastApi = { info: (t: string) => void; error: (t: string) => void };

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const api = useMemo<ToastApi>(() => {
    let seq = 0;
    const push = (kind: Msg["kind"], text: string) => {
      const id = ++seq + Date.now();
      setMsgs((m) => [...m, { id, kind, text }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), kind === "error" ? 6000 : 2500);
    };
    return { info: (t) => push("info", t), error: (t) => push("error", t) };
  }, []);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts">
        {msgs.map((m) => (
          <div key={m.id} className={`toast ${m.kind}`}>
            {m.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("ToastProvider がありません");
  return v;
}
