# Habitww

毎日の習慣を記録し、GitHub 風の草グラフで可視化する習慣トラッカー。

- 本番: https://habitww.pacelong.life
- スタック: React + MUI + Vite / Supabase / Cloudflare Workers(静的配信)

## ドキュメント

- [docs/design.md](docs/design.md) — アプリ内部の設計(画面構成、データモデル、RLS)
- [docs/integration.md](docs/integration.md) — 外部連携(Cloudflare デプロイ、Supabase 認証・スキーマ管理、ローカル開発)

## クイックスタート

```bash
npm install
cp .env.example .env   # Supabase の URL / anon key を記入
npm run dev
```

デプロイは `main` に push するだけ(Cloudflare Workers Builds が自動実行)。
