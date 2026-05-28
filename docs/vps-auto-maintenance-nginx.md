# Tự hiện trang bảo trì khi `npm run start` dừng

Khi `npm run start` đã dừng, app Next.js không còn chạy nên nó không thể tự redirect sang trang bảo trì. Cách đúng là để Nginx đứng phía trước website:

- Next.js còn sống: Nginx proxy vào `http://127.0.0.1:3000`.
- Next.js chết/dừng: Nginx tự trả file HTML bảo trì.
- Muốn bật bảo trì thủ công: tạo file `maintenance.flag`.

## File đã chuẩn bị

```text
public/maintenance-static.html
deploy/nginx-trungtammmo-maintenance.conf
```

## Cài trên VPS

Chạy tại thư mục project trên VPS:

```bash
sudo mkdir -p /var/www/trungtammmo-maintenance
sudo cp public/maintenance-static.html /var/www/trungtammmo-maintenance/maintenance-static.html
sudo cp deploy/nginx-trungtammmo-maintenance.conf /etc/nginx/sites-available/trungtammmo.vn
sudo ln -sf /etc/nginx/sites-available/trungtammmo.vn /etc/nginx/sites-enabled/trungtammmo.vn
sudo nginx -t
sudo systemctl reload nginx
```

Nếu SSL certificate của bạn không nằm ở:

```text
/etc/letsencrypt/live/trungtammmo.vn/fullchain.pem
/etc/letsencrypt/live/trungtammmo.vn/privkey.pem
```

hãy sửa lại 2 dòng `ssl_certificate` và `ssl_certificate_key` trong:

```text
/etc/nginx/sites-available/trungtammmo.vn
```

## Test tự động

Khi web chạy:

```bash
npm run start
```

Website sẽ vào trang chính.

Khi dừng app:

```bash
pkill -f "next start"
```

hoặc dừng process đang chạy `npm run start`, Nginx sẽ tự hiển thị trang bảo trì.

## Bật bảo trì thủ công

```bash
sudo touch /var/www/trungtammmo-maintenance/maintenance.flag
sudo systemctl reload nginx
```

## Tắt bảo trì thủ công

```bash
sudo rm /var/www/trungtammmo-maintenance/maintenance.flag
sudo systemctl reload nginx
```

## Ghi chú

Nếu bạn đang dùng PM2/systemd để tự restart Next.js, lúc app crash nó có thể tự bật lại rất nhanh. Khi đó fallback chỉ hiện trong lúc app chết thật sự hoặc khi bạn bật `maintenance.flag`.
