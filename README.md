# Auza Secure API Server cho Render

Gói này thay kiểu web ghi thẳng Firebase bằng **server API + Firebase Admin SDK**. Firebase config/service account chỉ nằm trong Render Environment, không xuất hiện trong trình duyệt nên người khác không thể dùng JS spam database như ảnh.

## Cách deploy Render

1. Tạo GitHub repo, upload toàn bộ thư mục này.
2. Render > New > Web Service > chọn repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment Variables:

```env
PORT=10000
NODE_ENV=production
CORS_ORIGIN=https://domain-shop-cua-ban.com
JWT_SECRET=chuoi_bi_mat_that_dai_it_nhat_64_ky_tu
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mat_khau_admin_manh
FIREBASE_DATABASE_URL=https://shopnew-d9579-default-rtdb.firebaseio.com
FIREBASE_SERVICE_ACCOUNT_BASE64=...
ALLOW_REGISTER=true
```

## Lấy FIREBASE_SERVICE_ACCOUNT_BASE64

Firebase Console > Project settings > Service accounts > Generate new private key. Sau đó chạy local:

```bash
base64 -w 0 serviceAccountKey.json
```

Copy chuỗi ra Render env `FIREBASE_SERVICE_ACCOUNT_BASE64`.

## Rules Firebase bắt buộc

Dán file `database.rules.json` vào Realtime Database Rules:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

Server dùng Admin SDK nên vẫn đọc/ghi được. Browser không ghi thẳng được nữa.

## Gắn vào web hiện tại

Trong `index.html`, bỏ script `assets/firebase.js`, thay bằng:

```html
<script>
window.AUZA_API_BASE = "https://ten-api-render.onrender.com";
</script>
<script src="assets/api-client.js"></script>
```

Copy `public/assets/api-client.js` vào thư mục `assets/` của web.

## API chính

- `POST /api/auth/admin-login` `{username,password}`
- `POST /api/auth/register` `{email,password,name}`
- `POST /api/auth/login` `{email,password}`
- `GET /api/bootstrap`
- `GET /api/data/products`
- `POST /api/order`
- `POST /api/deposit`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- tương tự: users, orders, deposits, banks, coupons, keys, tickets, categories, chats

## Lưu ý quan trọng

Không commit `serviceAccountKey.json`, `.env`, mật khẩu admin lên GitHub. Chỉ để trong Render Environment.
