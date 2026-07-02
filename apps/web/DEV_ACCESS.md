# Frontend development access

The frontend development server binds to `0.0.0.0:3000` so it can be opened from localhost or a temporary remote development host.

```bash
npm run web:dev
```

If you open the dev server from a custom hostname instead of localhost, set the hostname explicitly before starting Next.js:

```bash
SAUNA_ALLOWED_DEV_ORIGINS=dev.example.com npm run web:dev
```

For local API proxying, Next.js rewrites `/api/sauna/*` to the backend configured by `SAUNA_BACKEND_INTERNAL_URL` or `SAUNA_API_INTERNAL_URL`.

```bash
SAUNA_BACKEND_INTERNAL_URL=http://127.0.0.1:19588 npm run web:dev
```

Production deployments should call the public API domain directly through:

```text
NEXT_PUBLIC_SAUNA_API_BASE_URL=https://api.sauna.wrenzeal.top/api/v1
```
