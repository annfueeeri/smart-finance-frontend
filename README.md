# Smart Finance Frontend

React 19.2 + TypeScript + Vite のフロントエンドです。npm と package-lock.json で依存関係を管理します。
[smart-finance-backend](https://github.com/annfueeeri/smart-finance-backend) と接続し、Session Cookie と CSRF token でログインします。

## フロントエンドとバックエンドを起動する

Node.js 20.19 以上、または 22.12 以上が必要です（クラウド環境では Node.js 24）。
バックエンドには JDK 17 と Maven 3.9.x が必要です。

1. バックエンドの README に従って、`LOGIN_BOOTSTRAP_USERNAME` と `LOGIN_BOOTSTRAP_PASSWORD` を環境変数で設定し、ローカルアカウントを用意します。バックエンドのルートで `mvn spring-boot:run` を実行します。既定のポートは 8080 です。
2. フロントエンドのルートで次のコマンドを実行します。

```sh
npm ci
npm run dev
```

Vite はブラウザからの `/api` リクエストをバックエンドへ転送します。
バックエンドのポートが異なる場合は、サーバー側の転送先を設定します。

```sh
BACKEND_URL=http://127.0.0.1:18080 npm run dev
```

`.env.example` を `.env.local` にコピーして BACKEND_URL を変更することもできます。変更後は Vite を再起動します。
以前の `VITE_LOGIN_API_URL` によるログイン専用 URL 設定は、全認証 API に共通する BACKEND_URL に統一しました。
BACKEND_URL には `/api/auth/login` ではなくバックエンドのオリジンを指定します。
この変数は Vite のサーバー側で使用し、ブラウザには組み込みません。
パスワードを `VITE_*` 変数に設定しないでください。これらの変数はブラウザに公開されます。
`.npmrc` は `/workspace/.npm-cache` を使用します。本機では `npm --cache <書き込み可能なディレクトリ> ci` で変更できます。

## ログインのパラメーター

入力項目と API のフィールドは **username** と **password** に統一しています。
メールアドレス形式の username も使えますが、同じ username のアカウントがデータベースに存在する必要があります。
バックエンドは email フィールドからの変換を行いません。
画面からは `src/api/auth.ts` の共通メソッドを呼び出します。

```ts
import { login } from './api/auth'

await login({ username, password })
// 成功後のみダッシュボードに移動します。
```

共通メソッドは次の順序で通信します。

1. `GET /api/auth/csrf` で CSRF token を取得し、ブラウザが JSESSIONID Cookie を保存します。
2. `POST /api/auth/login` に JSON `{ username, password }`、Cookie、`X-CSRF-TOKEN` ヘッダーを送ります。
3. ブラウザが更新された Session Cookie を保存し、`GET /api/auth/me` で現在のユーザーを取得します。

fetch を直接使用する場合は以下の形式です。

```ts
const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
if (!csrfResponse.ok) throw new Error('CSRF token を取得できませんでした')
const csrf = await csrfResponse.json()

const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    [csrf.headerName]: csrf.token,
  },
  body: JSON.stringify({ username, password }),
})
if (!response.ok) throw new Error('ログインに失敗しました')
const user = await response.json() // { username: string }
```

| 操作 | API | 結果 |
| --- | --- | --- |
| CSRF の取得 | `GET /api/auth/csrf` | token、headerName、parameterName |
| ログイン | `POST /api/auth/login` | 200：username、400：入力エラー、401：認証失敗、403：CSRF エラー |
| 現在のユーザー | `GET /api/auth/me` | 200：username、401：未ログインまたはセッション切れ |
| ログアウト | `POST /api/auth/logout` | 204：Session を破棄 |

成功時は以前の暫定的な `{ success: true }` ではなく、バックエンドの `{ username: string }` を検証します。
ログイン後は CSRF token が更新されるため、ログアウト前に共通メソッドが再取得します。
パスワードや Session ID は localStorage に保存しません。HttpOnly Cookie はブラウザが管理します。
ダッシュボードへの直接移動、再読み込み、ルート切り替え、ウィンドウの再フォーカス時にセッションを確認します。
失敗、不正な応答、15 秒のリクエストタイムアウトは日本語で表示し、再試行できます。
ログアウトに失敗した場合も、ログアウト済みとして画面遷移しません。

## 検証・ビルド・デプロイ

```sh
npm run lint
npm run build
BACKEND_URL=http://127.0.0.1:18080 npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

ビルドには TypeScript の型チェックが含まれ、出力先は `dist/` です。
Vite dev と preview の両方が同じ `/api` プロキシを使用します。
本番では同じサイトの `/api/` を Spring Boot に転送し、その他のリクエストにフロントエンドの静的ファイルを返します。
Nginx の API 設定例：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

proxy_pass の末尾に `/` を追加しないことで、`/api` パスを保持します。
本番では HTTPS を使用し、バックエンドで `SESSION_COOKIE_SECURE=true` を設定してください。

## ブラウザ連携テスト

```sh
npm run test:e2e
```

稼働中のバックエンドと専用のテストアカウントが必要です。テストプロセスの環境変数に
`BACKEND_URL`、`E2E_LOGIN_USERNAME`、`E2E_LOGIN_PASSWORD` を設定してください。
パスワードを Git やコマンドライン引数に書かないでください。
Playwright は 5174 ポートで Vite を起動し、実際のプロキシとバックエンドを使って
ログイン、Cookie、セッション復元、ログアウト、エラー処理を確認します。
認証情報を含む trace、動画、スクリーンショットは記録しません。
初回は `npx playwright install chromium` でブラウザをインストールできます。
クラウド環境の既存 Chromium を利用する場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` を設定します。

## 業務画面

ユーザー表示は実際のログイン情報です。資産金額、取引履歴、グラフはサンプルデータとして表示しています。
口座管理や予算管理などの業務機能は、まだバックエンドに接続していません。
