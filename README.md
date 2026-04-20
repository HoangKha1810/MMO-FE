# TRUNGTAMMMO.VN - Next.js Migration

Dự án đã được chuyển đổi từ PHP thuần sang Next.js 15 + React 19 + Tailwind CSS 4 + TypeScript.

## Mục lụ

- [Giới thiệu](#giới-thiệu)
- [Yêu cầu](#yêu-cầu)
- [Cài đặt](#cài-đặt)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Tính năng đã migrate](#tính-năng-đã-migrate)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Môi trường](#môi-trường)
- [Phát triển](#phát-triển)

## Giới thiệu

Dự án TRUNGTAMMMO là một hệ sinh thái dịch vụ MMO phức tạp bao gồm:
- **SMM (Social Media Marketing)**: Dịch vụ tăng tương tác mạng xã hội
- **Auto MXH**: Tự động hóa các tác vụ mạng xã hội
- **Đổi/Mua thẻ**: Nạp tiền qua thẻ cào
- **Nạp tiền**: Chuyển khoản, MoMo, SePay
- **Diễn đàn**: Cộng đồng người dùng
- **Game Market**: Mua bán tài khoản game
- **Tài nguyên MMO**: Công cụ, source code, data
- **Support TikTok**: Dịch vụ hỗ trợ TikTok
- **Admin Panel**: Quản trị hệ thống

## Yêu cầu

- Node.js 18+
- npm / yarn / pnpm
- MySQL 8.x / MariaDB 10.x
- Prisma CLI

## Cài đặt

```bash
# 1. Clone / Copy project
cd /Users/hkha/Desktop/mmo

# 2. Cài dependencies
npm install

# 3. Copy và cấu hình .env
cp .env.example .env
# Chỉnh sửa .env với thông tin database của bạn

# 4. Tạo database
mysql -u root -p
CREATE DATABASE htbmmo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 5. Push schema vào database
npx prisma db push

# 6. Khởi chạy dev server
npm run dev
```

## Cấu trúc dự án

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication (login, register, logout)
│   │   ├── user/                # User endpoints (balance, orders, deposit)
│   │   ├── admin/                # Admin endpoints
│   │   ├── smm/                 # SMM service endpoints
│   │   ├── card/                # Card exchange endpoints
│   │   └── ...
│   ├── auth/                    # Auth pages
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── admin/                    # Admin pages
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── orders/
│   │   └── ...
│   ├── user/                    # User pages
│   │   ├── home/
│   │   ├── smm/
│   │   ├── card/
│   │   ├── deposit/
│   │   ├── resources/
│   │   ├── forum/
│   │   └── ...
│   └── layout.tsx
├── components/
│   ├── ui/                      # Shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── avatar.tsx
│   │   └── dropdown-menu.tsx
│   └── layout/                   # Layout components
│       ├── app-shell.tsx         # Main user layout
│       └── providers.tsx        # Theme, Query providers
├── lib/
│   ├── db.ts                    # Prisma client
│   └── utils.ts                 # Utility functions
├── types/
│   └── index.ts                # TypeScript types
└── hooks/                       # Custom React hooks
```

## Tính năng đã migrate

### Đã hoàn thành

- [x] **Authentication**: Login, Register, Forgot Password
- [x] **Dashboard**: Trang chủ với thống kê và dịch vụ
- [x] **Admin Dashboard**: Giám sát hệ thống với pulse metrics
- [x] **Admin Sidebar**: Navigation cho admin panel
- [x] **SMM Services**: Danh sách và đặt hàng dịch vụ
- [x] **Card Exchange**: Đổi thẻ / Mua thẻ
- [x] **Deposit**: Nạp tiền với nhiều phương thức
- [x] **Resources**: Kho tài nguyên MMO
- [x] **API Routes**: Đầy đủ API endpoints
- [x] **Database Schema**: Prisma schema tương ứng với MySQL
- [x] **UI Components**: Shadcn/ui components đầy đủ
- [x] **Theme System**: Dark/Light mode với Tailwind

### Chưa migrate (cần làm tiếp)

- [ ] **Forum**: Tạo thread, bài viết, reply
- [ ] **Game Market**: Mua bán tài khoản game
- [ ] **Auto MXH**: Dashboard và order
- [ ] **Support TikTok**: Chat widget
- [ ] **Social**: Bạn bè, tin nhắn
- [ ] **Profile Page**: Trang cá nhân đầy đủ
- [ ] **History Page**: Lịch sử giao dịch
- [ ] **Statistics Page**: Thống kê chi tiết
- [ ] **Admin Users Page**: Quản lý người dùng
- [ ] **Admin Orders Page**: Quản lý đơn hàng
- [ ] **Admin Deposits Page**: Quản lý nạp tiền
- [ ] **Admin Settings**: Cài đặt hệ thống
- [ ] **Cart**: Giỏ hàng
- [ ] **Find Job**: Tìm việc làm MMO

## Database Schema

Prisma schema đã được migrate từ MySQL với các models:

- `users` - Người dùng
- `settings` - Cấu hình hệ thống
- `rate_limits` - Rate limiting
- `ip_blacklist` / `banned_ips` - Bảo mật IP
- `activity_logs` - Nhật ký hoạt động
- `deposit_transactions` - Giao dịch nạp tiền
- `card_orders` - Đơn hàng thẻ
- `smm_orders` / `smm_services` - SMM
- `automxh_orders` / `automxh_categories` / `automxh_products` - Auto MXH
- `support_tiktok_orders` - Support TikTok
- `forum_categories` / `forum_threads` / `forum_posts` - Diễn đàn
- `resource_orders` / `mmo_resources` - Tài nguyên
- `cart_items` - Giỏ hàng
- `game_orders` - Game market
- `find_jobs` - Tìm việc
- `social_friendships` / `social_messages` - Mạng xã hội
- `notifications` - Thông báo

## API Routes

### Auth
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register` - Đăng ký
- `GET/POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/forgot-password` - Quên mật khẩu
- `POST /api/auth/2fa/verify` - Xác thực 2FA

### User
- `GET /api/user/balance` - Lấy số dư
- `GET/POST /api/user/deposit` - Nạp tiền
- `GET /api/user/orders` - Lịch sử đơn hàng
- `GET /api/user/cart` - Giỏ hàng
- `POST /api/user/cart/add` - Thêm vào giỏ
- `GET /api/user/profile` - Hồ sơ

### SMM
- `GET /api/smm/services` - Danh sách dịch vụ
- `POST /api/smm/order` - Tạo đơn hàng
- `GET /api/smm/my-orders` - Đơn hàng của tôi
- `GET /api/smm/order-status` - Trạng thái đơn

### Admin
- `GET /api/admin/stats` - Thống kê tổng quan
- `GET /api/admin/users` - Danh sách users
- `POST /api/admin/users/update` - Cập nhật user
- `GET /api/admin/orders` - Tất cả đơn hàng
- `POST /api/admin/orders/update-status` - Cập nhật trạng thái
- `GET /api/admin/deposits` - Tất cả nạp tiền
- `POST /api/admin/deposits/process` - Xử lý nạp tiền

## Môi trường

```env
DATABASE_URL="mysql://root:@localhost:3306/htbmmo"
NODE_ENV=development
ENCRYPTION_KEY=your-32-char-secret-key
NEXTAUTH_SECRET=your-nextauth-secret
TURNSTILE_SITE_KEY=your-turnstile-key
TURNSTILE_SECRET_KEY=your-turnstile-secret
TELEGRAM_BOT_TOKEN=
MOMO_API_KEY=
SEPAY_API_KEY=
```

## Phát triển

```bash
# Dev server
npm run dev

# Build production
npm run build

# Type check
npm run type-check

# Prisma Studio (DB GUI)
npm run db:studio

# Push schema changes
npm run db:push
```

## Chú ý quan trọng

1. **Password Hashing**: Hiện tại sử dụng SHA-256. Khuyến nghị chuyển sang bcrypt hoặc argon2
2. **Session**: Sử dụng cookies của Next.js. Cân nhắc chuyển sang JWT hoặc NextAuth.js
3. **API External**: Các API bên thứ 3 (MoMo, SePay, Telegram) cần implement riêng
4. **Security**: Cần thêm rate limiting, CSRF protection, input validation phía client
5. **Responsive**: Một số component cần kiểm tra responsive trên mobile
6. **Icons**: Đã thay thế lucide-react bằng emoji trong một số chỗ. Cần chuẩn hóa icon usage

## Migration Notes từ PHP

- Controllers PHP → API Routes trong Next.js
- Views PHP (HTML + PHP) → React Components
- Alpine.js → React + TypeScript
- Tailwind CDN → Tailwind CSS 4 (build)
- `getSetting()` → `db.settings.findMany()`
- `format_vnd()` → `new Intl.NumberFormat('vi-VN')`
- `base_url()` → Sử dụng Next.js routing
- Session auth → Cookie-based auth

## License

Copyright © 2025 TRUNGTAMMMO.VN
