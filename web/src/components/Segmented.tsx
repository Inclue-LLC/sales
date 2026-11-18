export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {props.options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={props.value === o.value}
          className={props.value === o.value ? "on" : ""}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 表示切替などの好みをブラウザに覚えておく（失敗しても動作に影響しない） */
export function loadPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(`pref:${key}`) as T) || fallback;
  } catch {
    return fallback;
  }
}
export function savePref(key: string, v: string) {
  try {
    localStorage.setItem(`pref:${key}`, v);
  } catch {
    /* noop */
  }
}
