# 売上PL管理

中国・日本の売上を管理する社内向けWebアプリです。入力はすべてWeb画面から行います。

## 画面

| ページ | 内容 |
|---|---|
| 1. 売上一覧 | 中国・日本の区分ごとに、月別の「目標」と「売上」を一覧表示（単位：元）。2026年11月から右へ月が進む。目標はこの画面で入力。売上が目標以上なら青、未満なら赤 |
| 2. ライセンス | 国・キャラクター・種別（MG／ロイヤリティ）・金額・計上月 |
| 3. 中国オンライン | 週ごとに小红书・淘宝の売上を元で入力。月をまたぐ週は木曜日のある月に入る |
| 4. オフライン | 国・キャラクター・種別（POP UP／委託販売）・お店・イベント名・金額・計上月 |
| 5. その他 | 国・案件内容・金額・計上月 |
| 設定 | 期間、為替レート（1元＝○円）、キャラクター候補、メンバー（ログインできる人） |

2〜5ページ目で入力した金額は、計上月ごとに1ページ目の「売上」へ自動で反映されます。

## 構成

| 役割 | 技術 |
|---|---|
| 画面 | React + TypeScript + Vite |
| サーバー（保存・集計） | Cloud Functions for Firebase（東京リージョン） |
| データベース | Cloud Firestore（画面からの直接アクセスは禁止し、すべてサーバー経由） |
| ログイン | Firebase Authentication（メール＋パスワード） |
| ホスティング | Firebase Hosting |

```
functions/src/domain/   集計・週の判定・CSV・入力チェック（集計はここだけで行う）
functions/src/repo.ts   Firestore の読み書き（コレクション構成はファイル先頭に記載）
functions/src/index.ts  API
web/src/pages/          画面
scripts/                サンプルデータ投入・メンバー作成
```

## ローカルで動かす

必要なもの：Node.js 22、Java 11 以上（Firestore エミュレータが使います）

```bash
npm run setup
```

```bash
npm run dev
```

起動したら、別のターミナルでサンプルデータを入れます（ローカル専用）。

```bash
npm run seed
```

- 画面：http://localhost:5173 （ログイン：`demo@example.com` / `password123`）
- エミュレータの管理画面：http://localhost:4100

エミュレータのデータは `emulator-data/` に保存されるので、終了して再起動しても残ります（Ctrl+C で終了したとき）。

テストを実行するとき：

```bash
npm test
```

## 本番環境への公開（Firebase）

### 初回の準備（Firebase コンソール）

1. https://console.firebase.google.com/ でプロジェクトを作成（Google アナリティクスは不要）。
2. 左下の料金プランを **Blaze（従量課金）** に変更（Cloud Functions に必要。この規模なら通常は無料枠内）。念のため予算アラートを設定する。
3. 「Authentication」→「始める」→「メール/パスワード」を有効にする。
4. 「Firestore Database」→「データベースを作成」→ ロケーション `asia-northeast1（東京）`、本番環境モードで作成。
5. 「プロジェクトの設定」→「マイアプリ」→ ウェブアプリ（`</>`）を追加し、表示された `firebaseConfig` の値を `web/.env.production.local` に書く（`web/.env.example` をコピーして作る。このファイルは Git に入らない）。

### 公開（デプロイ）

```bash
npx firebase login
```

```bash
npx firebase deploy --project <プロジェクトID>
```

初回は数分かかります。完了すると `Hosting URL: https://<プロジェクトID>.web.app` が表示されます。

### 最初のメンバーを登録

1. Firebase コンソール「Authentication」→「ユーザーを追加」でメールアドレスとパスワードを登録し、表示された **ユーザー UID** をコピー。
2. 「Firestore Database」→「コレクションを開始」→ コレクション ID `members`、ドキュメント ID に UID を貼り付け、フィールド `email`（文字列）にメールアドレスを入れて保存。
3. 公開 URL を開いてログイン。2人目以降は画面の「設定 > メンバー」から追加できる。

### 更新するとき

コードを更新したら、もう一度 `npx firebase deploy --project <プロジェクトID>` を実行します。

## 決めごと

- 金額は整数で保存します。中国の案件は元、日本の案件は円で入力・保存し、一覧と売上一覧では設定の為替レートで元に換算して表示します（レートを変えると過去分も換算し直します）。マイナスも入力できます。
- 中国オンラインの週は月曜〜日曜で、計上月は「その週の木曜日がある月」です。
- 期間を縮めても入力済みのデータは消えません（期間を戻すと再表示されます）。
- 変更内容は `auditLogs` に履歴として残ります。
