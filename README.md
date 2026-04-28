# random19k Server API v2

Deploy Render:
- Build command: `npm install`
- Start command: `npm start`
- Root Directory: để trống

ENV cần có:
- `PORT=10000`
- `JWT_SECRET`
- `ADMIN_SECRET`
- `CORS_ORIGINS=https://domain-shop-cua-ban` (không có `/` cuối; dùng `*` chỉ để test)
- `FIREBASE_DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT_JSON` JSON 1 dòng, private_key có `\n`

Endpoint test:
- `/`
- `/api/health`

Không commit `.env` hoặc service account lên GitHub.
