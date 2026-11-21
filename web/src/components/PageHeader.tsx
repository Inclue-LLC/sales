import type { ReactNode } from "react";

export function PageHeader(props: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{props.title}</h1>
        {props.sub && <p className="sub">{props.sub}</p>}
      </div>
      {props.actions && <div className="head-actions">{props.actions}</div>}
    </header>
  );
}
