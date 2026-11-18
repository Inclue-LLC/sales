import { useEffect, useRef, useState } from "react";
import { parseAmount } from "../format";

const fmt = (v: number) => (v === 0 ? "" : v.toLocaleString("ja-JP"));

/**
 * 金額入力。表示は3桁区切り、フォーカスを外したとき（または Enter）に確定する。
 * 値が変わったときだけ onCommit を呼ぶ。
 */
export function MoneyInput(props: {
  value: number;
  onCommit?: (v: number) => void;
  onChange?: (v: number) => void;
  label?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(fmt(props.value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  // 入力中は外からの値で上書きしない（カーソル位置が飛ぶため）
  useEffect(() => {
    if (!focused.current) setText(fmt(props.value));
  }, [props.value]);

  const commit = () => {
    const v = parseAmount(text);
    if (v === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(fmt(v));
    if (v !== props.value) props.onCommit?.(v);
  };

  return (
    <div className={`money-input ${invalid ? "invalid" : ""}`}>
      <span className="yen">¥</span>
      <input
        inputMode="numeric"
        placeholder="0"
        aria-label={props.label}
        value={text}
        disabled={props.disabled}
        autoFocus={props.autoFocus}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseAmount(e.target.value);
          setInvalid(v === null);
          if (v !== null) props.onChange?.(v);
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}
