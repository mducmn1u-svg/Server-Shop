# random19k Server API

Server API riêng cho shop random19k. Mục tiêu: khóa logic nhạy cảm khỏi frontend để tránh người khác mở DevTools/Firebase rồi tự cộng tiền, tự lấy acc, tự tạo key.

## Deploy Render

1. Upload repo này lên GitHub.
2. Render > New > Web Service > chọn repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add Environment Variables theo `.env.example`.
6. Tuyệt đối không commit `.env` hoặc service account JSON lên GitHub.

## Env quan trọng

- `JWT_SECRET`: chuỗi random dài.
- `ADMIN_SECRET`: chuỗi random dài, dùng cho admin panel/server-only.
- `CORS_ORIGINS`: domain shop frontend được gọi API.
- `FIREBASE_DATABASE_URL`: Realtime Database URL.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: service account JSON dạng 1 dòng, hoặc dùng 3 biến `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

## Header auth

User API cần:

```http
Authorization: Bearer <token>
```

Admin API cần thêm:

```http
x-admin-secret: <ADMIN_SECRET>
```

## Firebase Rules gợi ý sau khi chuyển qua API

Khóa write trực tiếp từ client. Client chỉ nên đọc public config/sản phẩm nếu cần.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "public": {
      ".read": true,
      ".write": false
    },
    "toolFiles": {
      ".read": false,
      ".write": false
    },
    "users": {
      "$uid": {
        ".read": false,
        ".write": false
      }
    },
    "accounts": { ".read": false, ".write": false },
    "topups": { ".read": false, ".write": false },
    "ekeys": { ".read": false, ".write": false },
    "purchases": { ".read": false, ".write": false }
  }
}
```

## API chính

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`

### Shop

- `GET /api/products`
- `POST /api/purchase`
- `GET /api/history?type=purchase|topup|ekey`

### Ekey / Tools

- `GET /api/ekey/plans`
- `POST /api/ekey/buy`
- `POST /api/tools/open`

### Topup

- `GET /api/topup/bank-info`
- `POST /api/topup/bank-bill`
- `POST /api/topup/card`

### Admin

- `GET /api/admin/topups`
- `POST /api/admin/topups/:id/approve`
- `POST /api/admin/topups/:id/reject`
- `GET /api/admin/users`
- `POST /api/admin/users/:uid/balance`
- `POST /api/admin/accounts`
- `GET /api/admin/stock`
- `POST /api/admin/tool-files`

## Chống phá đã có

- Không tin số dư/uid từ client.
- Purchase dùng Firebase transaction để tránh race tự mua trùng.
- Rate limit theo nhóm endpoint.
- Validate input bằng Zod.
- Helmet security headers.
- CORS allowlist.
- Admin secret cho endpoint admin.
- Password hash bcrypt cho user mới. User cũ password plain vẫn login được, sau login sẽ tự migrate sang hash.
