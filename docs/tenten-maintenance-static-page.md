# Trang tĩnh bảo trì trên tenten

File HTML đã chuẩn bị:

```text
public/maintenance-static.html
```

## Tạo trang tĩnh

1. Vào quản trị tên miền tenten của `trungtammmo.vn`.
2. Mở **Thiết lập nhanh DNS thông dụng**.
3. Chọn **Thiết lập trang tĩnh**.
4. Bấm **+ Thêm**.
5. Đặt tiêu đề:

```text
TRUNGTAMMMO.VN đang bảo trì
```

6. Nếu tenten có mục chọn type, chọn kiểu **HTML** hoặc **Trang HTML**.
7. Mở file `public/maintenance-static.html`, copy toàn bộ nội dung và dán vào ô nội dung trang.
8. Lưu trang.

## Bật trang bảo trì

Vào **Cấu hình DNS RECORD** rồi thêm record:

```text
Host: @
Loại: PAGE
Giá trị: chọn trang "TRUNGTAMMMO.VN đang bảo trì"
```

Nếu muốn cả `www.trungtammmo.vn` cũng hiện bảo trì, thêm record thứ hai:

```text
Host: www
Loại: PAGE
Giá trị: chọn trang "TRUNGTAMMMO.VN đang bảo trì"
```

Nếu tenten báo trùng record, hãy tạm xóa hoặc tắt record cũ của `@` và `www` đang trỏ về server chính trước khi thêm `PAGE`.

## Tắt bảo trì

1. Xóa hoặc tắt record `PAGE` của `@`.
2. Xóa hoặc tắt record `PAGE` của `www` nếu đã thêm.
3. Khôi phục record cũ trỏ về server chính.

Record server chính thường là một trong các dạng sau:

```text
Host: @
Loại: A
Giá trị: IP server chính
```

hoặc:

```text
Host: www
Loại: CNAME
Giá trị: trungtammmo.vn
```

## Lưu ý quan trọng

- Trang tĩnh của tenten có ghi rõ không hỗ trợ xác thực qua SSL, nên `https://trungtammmo.vn` có thể không hiện đẹp hoặc có cảnh báo chứng chỉ trong thời gian bật PAGE.
- Cách này phù hợp khi server chính đang bảo trì nặng hoặc không thể truy cập.
- Nếu server chính vẫn chạy được, nên dùng trang bảo trì trong code Next.js để giữ HTTPS ổn định hơn.
