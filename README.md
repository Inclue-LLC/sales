# 売上PL管理

売上PL（日本／中国）とライセンス案件一覧を、ブラウザで入力・閲覧する社内向けWebアプリです。
**すべての入力はWeb画面から行います。** 入力した値はサーバー（Cloud Functions）に保存され、合計や週次→月次の集計もサーバーで計算してから画面に返します。

## 構成

| 役割 | 技術 |
|---|---|
| 画面 | React + TypeScript + Vite、表は AG Grid Community |
| サーバー（API・集計） | Cloud Functions for Firebase（Node.js 22、東京リージョン） |
| データベース | Cloud Firestore |
| ログイン | Firebase Authentication（メール＋パスワード） |
| ホスティング | Firebase Hosting |

```
functions/src/domain/   集計・週判定・CSV・入力チェック（ここが唯一の計算箇所）
functions/src/repo.ts   Firestore の読み書き（コレクション構成はこのファイルの先頭に記載）
functions/src/index.ts  API（callable 関数 `api` 1本に action を渡して振り分け）
web/src/pages/          画面（月次PL / オンライン週次 / ライセンス案件 / 設定）
scripts/                サンプルデータ投入・メンバー作成
```

- 画面から Firestore には直接アクセスできません（`firestore.rules` で全拒否）。読み書きはすべて API を経由し、API は `members` に登録されたユーザーだけが使えます。
- 金額は整数（円）で保存し、通貨コード（`currency: "JPY"`）も一緒に記録します。将来、元で入力して円に換算する機能を追加するときのためです。
- カテゴリ（ライセンス／商品販売 オンライン・オフライン／その他）は Firestore の `categories` に保存しています。将来、画面から追加・変更できるようにするためです。
- 変更内容は `auditLogs` に履歴として残ります。

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
- エミュレータの管理画面：http://localhost:4000

エミュレータのデータは `emulator-data/` に保存されるので、終了して再起動しても残ります（Ctrl+C で終了したとき）。

テストを実行するとき：

```bash
npm test
```

## 本番環境への公開（Firebase）

1. [Firebase コンソール](https://console.firebase.google.com/)でプロジェクトを作成し、**Blaze プラン（従量課金）** にします。Cloud Functions を使うために必要です。このアプリの規模なら、ほぼ無料枠の範囲に収まります。念のため予算アラートを設定しておくと安心です。
2. 次の3つを有効にします。
   - Authentication の「メール/パスワード」
   - Firestore（ロケーションは `asia-northeast1`）
   - Hosting
3. 「プロジェクトの設定」でウェブアプリを追加し、表示された設定値を `web/.env.production.local` に書きます（書き方は `web/.env.example` を参照）。
4. `.firebaserc` の `default` を、作成したプロジェクトID に書き換えます。
5. デプロイします。

   ```bash
   npx firebase login
   ```

   ```bash
   npm run deploy
   ```

6. 最初のメンバーを作成します。2人目以降は、画面の「設定 > メンバー」から追加できます。

   ```bash
   gcloud auth application-default login
   ```

   ```bash
   npm run create-member -- --prod --project <プロジェクトID> you@example.com <パスワード> "表示名"
   ```

## 仕様上の決めごと（確認済みのデフォルト案）

- 週は月曜始まり。計上月は「その週の木曜日が属する月」で自動判定し、週次画面で手動で変更できます（期間内の月のみ）。
- 期間の第1週は「木曜日が開始月に入る最初の週」、最終週は「木曜日が終了月に入る最後の週」です。
- 期間を縮めても、期間外になったデータは削除せず非表示にするだけです。
- マイナスの金額も入力できます。入金済みは手入力です。
- 同時に編集した場合は後から保存した値が残ります（セル単位で保存するので、別のセルの編集は打ち消し合いません）。
- 案件の No は欠番を詰めません。マスタから候補を消しても、既存の案件の値は残ります。
- CSV は BOM 付き UTF-8 で、月次PLは画面と同じ横長の形式です。

## 未対応（今後）

- Excel（`売上PL.xlsx`）からのインポート
- 6章の将来拡張（案件からPLへの自動集計、元から円への換算、達成率とグラフ、カテゴリ編集画面）
