// Firestore の読み書き。
//
// settings/app                    … 期間・通貨ラベル・キャラクター候補
// targets/{lineId}_{YYYY-MM}      … 1ページ目の目標（元）
// entries/{autoId}                … ライセンス／オフライン／その他の案件（kind で区別）
// onlineWeekly/{weekStart}        … 中国オンラインの週次（チャネル別）
// weeks/{weekStart}               … 計上月の手動変更（現在は画面から変更しない）
// members/{uid}                   … 利用を許可したメンバー
// auditLogs/{autoId}              … 変更履歴

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { targetKey, type RawData } from "./domain/aggregate";
import { DEFAULT_SETTINGS, currencyOf, type Channel, type Entry, type EntryInput, type EntryKind, type Settings } from "./domain/types";

const db = () => getFirestore();
const iso = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.().toISOString() ?? "";

export async function getSettings(): Promise<Settings> {
  const snap = await db().doc("settings/app").get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db().doc("settings/app").set(s);
}

function toEntry(id: string, x: FirebaseFirestore.DocumentData): Entry {
  return {
    id,
    kind: x.kind,
    country: x.country,
    month: x.month,
    amount: x.amount ?? 0,
    currency: x.currency ?? currencyOf(x.country),
    amountCny: 0, // 呼び出し側でレートを使って計算する
    character: x.character,
    type: x.type,
    venue: x.venue,
    content: x.content,
    createdAt: iso(x.createdAt),
    updatedAt: iso(x.updatedAt),
  };
}

export async function listEntries(kind?: EntryKind): Promise<Entry[]> {
  const q = kind ? db().collection("entries").where("kind", "==", kind) : db().collection("entries");
  const snap = await q.get();
  return snap.docs.map((d) => toEntry(d.id, d.data()));
}

export async function getEntry(id: string): Promise<Entry | null> {
  const snap = await db().doc(`entries/${id}`).get();
  return snap.exists ? toEntry(snap.id, snap.data()!) : null;
}

export async function createEntry(kind: EntryKind, input: EntryInput, uid: string): Promise<Entry> {
  const ref = await db()
    .collection("entries")
    .add({ ...input, kind, currency: currencyOf(input.country), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
  return (await getEntry(ref.id))!;
}

export async function updateEntry(id: string, input: EntryInput, uid: string): Promise<Entry> {
  await db()
    .doc(`entries/${id}`)
    .update({ ...input, currency: currencyOf(input.country), updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
  return (await getEntry(id))!;
}

export async function deleteEntry(id: string): Promise<void> {
  await db().doc(`entries/${id}`).delete();
}

export async function saveTargets(changes: { lineId: string; month: string; value: number }[], uid: string) {
  const batch = db().batch();
  for (const c of changes) {
    batch.set(db().doc(`targets/${c.lineId}_${c.month}`), {
      lineId: c.lineId,
      month: c.month,
      amount: c.value,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    });
  }
  await batch.commit();
}

export async function saveOnline(changes: { weekStart: string; channel: Channel; value: number }[], uid: string) {
  const batch = db().batch();
  for (const c of changes) {
    // チャネル単位で merge するので、別のチャネルを同時に編集しても上書きし合わない
    batch.set(
      db().doc(`onlineWeekly/${c.weekStart}`),
      { weekStart: c.weekStart, [c.channel]: c.value, currency: "CNY", updatedAt: FieldValue.serverTimestamp(), updatedBy: uid },
      { merge: true },
    );
  }
  await batch.commit();
}

export async function loadRaw(): Promise<RawData> {
  const [settings, entries, targetsSnap, onlineSnap, weeksSnap] = await Promise.all([
    getSettings(),
    listEntries(),
    db().collection("targets").get(),
    db().collection("onlineWeekly").get(),
    db().collection("weeks").get(),
  ]);
  const targets = new Map<string, number>();
  for (const d of targetsSnap.docs) {
    const x = d.data();
    targets.set(targetKey(x.lineId, x.month), Number(x.amount ?? 0));
  }
  const online = new Map<string, Partial<Record<Channel, number>>>();
  for (const d of onlineSnap.docs) {
    const x = d.data();
    online.set(x.weekStart, { xiaohongshu: Number(x.xiaohongshu ?? 0), taobao: Number(x.taobao ?? 0) });
  }
  const weekOverrides: Record<string, string | null> = {};
  for (const d of weeksSnap.docs) weekOverrides[d.id] = d.data().bookingMonthOverride ?? null;
  return { settings, entries, targets, online, weekOverrides };
}

export async function isMember(uid: string): Promise<boolean> {
  return (await db().doc(`members/${uid}`).get()).exists;
}

export async function audit(uid: string, email: string | undefined, action: string, detail: Record<string, unknown>) {
  await db().collection("auditLogs").add({ at: FieldValue.serverTimestamp(), uid, email: email ?? null, action, detail });
}
