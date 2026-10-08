# Smart Finance Frontend

React 19.2 + TypeScript + Vite 开发环境，使用 npm 和 package-lock.json 锁定依赖。

## 开始开发

需要 Node.js 20.19+ 或 22.12+（云环境当前使用 Node.js 24）。

```bash
cd /workspace/smart-finance-frontend
npm ci
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

从 `src/App.tsx` 开始编写页面，保存后 Vite 自动热更新。
`.npmrc` 将 npm 缓存放在云环境可写的 `/workspace/.npm-cache`；在其他机器上可覆盖此缓存路径。

## 验证与构建

```bash
npm run lint
npm run build
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
```

构建命令包含 TypeScript 检查，输出位于 `dist/`。项目目前没有自动化测试套件。
本地静态前端开发不需要 API 密钥或后端服务；连接业务 API 时再配置相关环境变量。
