# Auza API Server - NO FIREBASE

Server này bỏ hoàn toàn Firebase. Data lưu trong `data/db.json` trên server Render.

## Render setup

Chọn **New -> Web Service**, không chọn Static Site.

- Build Command: `npm install`
- Start Command: `node server.js`

## Environment Variables cần thêm

```env
ADMIN_USER=admin
ADMIN_PASS=matkhaucuaban
JWT_SECRET=chuoi-random-dai-kho-doan
CORS_ORIGIN=*
```

Không cần `FIREBASE_SERVICE_ACCOUNT`, không cần `FIREBASE_DATABASE_URL`.

## API chính

- `POST /api/admin/login` admin login
- `GET /api/public` data public shop
- `GET /api/products` sản phẩm public
- `POST /api/auth/register` user đăng ký
- `POST /api/auth/login` user đăng nhập
- `POST /api/orders` user tạo đơn
- `GET /api/admin/db` lấy toàn bộ DB admin
- `/api/admin/products`, `/api/admin/users`, `/api/admin/orders`, `/api/admin/banks`, `/api/admin/coupons`, `/api/admin/keys`, `/api/admin/tickets` hỗ trợ GET/POST/PUT/DELETE

## Gắn vào web

Trong `index.html`, bỏ dòng load `assets/firebase.js` và thêm:

```html
<script>window.AUZA_API_BASE='https://TEN-SERVICE.onrender.com'</script>
<script src="assets/api-client.js"></script>
```

Upload `public/assets/api-client.js` vào hosting web của bạn hoặc dùng link từ Render.

## Lưu ý Render Free

Data trong `data/db.json` có thể mất khi Render rebuild/redeploy vì filesystem không bền. Muốn chắc chắn lâu dài thì cần Render Disk, Postgres, Supabase, MongoDB Atlas hoặc VPS.
