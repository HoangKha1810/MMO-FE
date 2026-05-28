# Windows VPS: tự hiện maintenance khi tắt `npm run start`

VPS trong ảnh là Windows và đang có Nginx tại:

```powershell
C:\nginx
```

Cơ chế đúng:

- Nginx chạy cố định ở port `80`.
- Website Next.js chạy bằng `npm run start` ở `127.0.0.1:3000`.
- Khi Next.js còn chạy, Nginx chuyển request vào Next.js.
- Khi bạn tắt cửa sổ `npm run start`, Nginx không kết nối được `127.0.0.1:3000` nên tự hiện trang bảo trì.
- Muốn ép bảo trì thủ công, tạo file `maintenance.flag`.

## File đã chuẩn bị trong project

```text
public/maintenance-static.html
deploy/windows-nginx-maintenance.conf
```

## 1. Copy trang maintenance vào Nginx

Trên Windows VPS, tạo thư mục:

```powershell
New-Item -ItemType Directory -Force C:\nginx\html\maintenance
```

Copy file:

```text
public\maintenance-static.html
```

vào:

```text
C:\nginx\html\maintenance\maintenance-static.html
```

## 2. Cấu hình Nginx

Backup file cũ trước:

```powershell
Copy-Item C:\nginx\conf\nginx.conf C:\nginx\conf\nginx.conf.bak
```

Mở file:

```text
C:\nginx\conf\nginx.conf
```

Dán nội dung từ file:

```text
deploy\windows-nginx-maintenance.conf
```

vào `nginx.conf`.

File này đã được merge theo config cũ bạn gửi, gồm:

- `trungtammmo.vn` và `www.trungtammmo.vn`
- redirect `trungtammmo.com` và `www.trungtammmo.com` về `.vn`
- SSL path `C:\nginx\ssl\trungtammmo.vn\...`
- proxy Next.js sang `127.0.0.1:3000`
- fallback maintenance khi Next.js tắt
- bật/tắt maintenance thủ công bằng `maintenance.flag`

## 3. Test và reload Nginx

Chạy PowerShell bằng Administrator:

```powershell
cd C:\nginx
.\nginx.exe -t
.\nginx.exe -s reload
```

Nếu Nginx chưa chạy:

```powershell
cd C:\nginx
.\nginx.exe
```

Kiểm tra file maintenance có đọc được không:

```text
https://trungtammmo.vn/maintenance-static.html
```

Nếu URL này còn hiện `503 Service Temporarily Unavailable`, nghĩa là file chưa nằm đúng chỗ. Kiểm tra lại phải có file:

```text
C:\nginx\html\maintenance\maintenance-static.html
```

## 4. Chạy website chính

Trong thư mục web Next.js:

```powershell
npm run build
npm run start
```

Khi `npm run start` đang chạy, truy cập domain sẽ vào web chính.

## 5. Test tự hiện maintenance

Tắt cửa sổ `npm run start` hoặc dừng process Node.

Sau đó mở:

```text
http://trungtammmo.vn
```

Nginx sẽ tự hiện trang maintenance.

## 6. Bật maintenance thủ công

Dùng khi web vẫn chạy nhưng bạn muốn chặn người dùng vào web chính:

```powershell
New-Item C:\nginx\html\maintenance\maintenance.flag -ItemType File -Force
C:\nginx\nginx.exe -s reload
```

## 7. Tắt maintenance thủ công

```powershell
Remove-Item C:\nginx\html\maintenance\maintenance.flag -Force
C:\nginx\nginx.exe -s reload
```

## 8. Lưu ý về HTTPS

File `deploy/windows-nginx-maintenance.conf` đã có sẵn block `listen 443 ssl` cho domain chính, nên `https://trungtammmo.vn` cũng sẽ hiện maintenance khi app Next.js tắt.
