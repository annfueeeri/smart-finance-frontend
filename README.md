# Smart Finance Frontend

React 19.2 + TypeScript + Vite の開発環境です。npm と package-lock.json で依存関係を管理します。

## 開発を始める

Node.js 20.19 以上、または 22.12 以上が必要です（クラウド環境では Node.js 24 を使用）。
プロジェクトのルートディレクトリで、次のコマンドを実行してください。

```bash
npm ci
npm run dev
```

`src/App.tsx` から画面の開発を始められます。保存すると Vite が変更を即座に反映します。
`.npmrc` は npm キャッシュをクラウド環境の `/workspace/.npm-cache` に配置します。
ローカル環境では、このキャッシュ設定を削除するか、書き込み可能なパスに変更してください。

## 検証とビルド

```bash
npm run lint
npm run build
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
```

ビルドには TypeScript の型チェックが含まれます。出力先は `dist/` です。
このプロジェクトには、現時点で自動テストスイートはありません。

## ログイン API

`.env.example` を `.env.local` にコピーし、`VITE_LOGIN_API_URL` をバックエンドのログイン URL に設定してください。
設定後は開発サーバーを再起動します。本番ビルドでもビルド時の設定値を使用します。
未設定の場合は、同一オリジンの `/api/auth/login` に送信します。Vite 単体ではこの API を提供しません。

暫定のリクエスト形式は以下です。

```http
POST /api/auth/login
Content-Type: application/json
Accept: application/json
```

```json
{ "email": "name@example.com", "password": "example-password" }
```

成功時は HTTP 2xx と次の JSON を返してください。

```json
{ "success": true }
```

認証失敗時は HTTP 401/403、または HTTP 2xx と `{ "success": false }` を返します。
通信エラー、不正な応答、タイムアウト、HTTP エラーの場合は画面に日本語のエラーメッセージを表示し、画面遷移を行いません。
空欄や不正なメールアドレスは送信前に確認します。送信中は二重送信を防ぎます。

`credentials: 'include'` で Cookie ベースのセッションに対応します。
バックエンドでセッション Cookie を発行・管理してください。Cookie の属性や CORS はバックエンド側で適切に設定します。
別オリジンの場合は、フロントエンドのオリジンを指定した CORS 設定と資格情報の許可が必要です。
メールアドレスやパスワードをログ、ブラウザストレージ、URL に保存しません。
`VITE_` の変数はブラウザに公開されるため、秘密情報を設定しないでください。

この実装の対象はログインリクエストと成功・失敗時の画面動作です。
トークン形式の認証、ログアウト API、セッション復元、認証済みルートの保護は、バックエンドの仕様確定後に追加します。
資産一覧の金額や取引履歴は引き続きサンプルデータです。業務 API は未接続です。
