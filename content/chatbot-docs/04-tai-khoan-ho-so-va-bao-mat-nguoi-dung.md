# TRUNGTAMMMO: Tài Khoản, Hồ Sơ, Đăng Nhập Và Bảo Mật Người Dùng

## 1. Mục tiêu của tài liệu này

Tài liệu này hướng dẫn chi tiết các thao tác liên quan đến tài khoản người dùng trên TRUNGTAMMMO, bao gồm đăng ký, đăng nhập, xác minh, hồ sơ cá nhân, phiên đăng nhập, bảo mật và các tình huống thường gặp khi không vào được hệ thống.

## 2. Khi nào người dùng cần tài liệu này?

Bạn nên dùng tài liệu này khi gặp một trong các nhu cầu sau:

- chưa có tài khoản và muốn tạo tài khoản mới
- đã có tài khoản nhưng chưa đăng nhập được
- cần hiểu bước xác minh 2FA
- muốn cập nhật hồ sơ người dùng
- nghi ngờ tài khoản có dấu hiệu bất thường
- cần phân biệt trang user, admin và các khu dịch vụ khác

## 3. Cách tạo tài khoản mới

### 3.1 Chuẩn bị

Trước khi đăng ký, người dùng nên chuẩn bị:

- username dễ nhớ
- email đang dùng thật
- mật khẩu mạnh
- thiết bị cá nhân đủ an toàn để lưu phiên đăng nhập

### 3.2 Quy trình đăng ký cơ bản

1. Vào trang Auth của hệ thống.
2. Chuyển sang tab hoặc panel Đăng ký.
3. Điền username, email và mật khẩu theo yêu cầu.
4. Kiểm tra kỹ thông tin trước khi gửi.
5. Hoàn tất đăng ký.
6. Quay lại luồng đăng nhập để vào hệ thống.

### 3.3 Sau khi đăng ký xong nên làm gì?

- đăng nhập ngay để kiểm tra tài khoản hoạt động bình thường
- vào hồ sơ để rà lại thông tin cá nhân
- nếu hệ thống hỗ trợ 2FA thì nên bật sớm
- ghi nhớ email và username đã dùng

## 4. Cách đăng nhập đúng

### 4.1 Thông tin có thể dùng để đăng nhập

Tùy cấu hình hiện tại, người dùng thường có thể đăng nhập bằng:

- username
- email

### 4.2 Luồng đăng nhập

1. Mở trang đăng nhập.
2. Nhập username hoặc email.
3. Nhập mật khẩu.
4. Nếu có tùy chọn giữ phiên trên thiết bị cá nhân, chỉ bật khi dùng máy tin cậy.
5. Gửi biểu mẫu đăng nhập.
6. Nếu tài khoản có 2FA, hệ thống sẽ chuyển sang bước xác minh.

### 4.3 Trường hợp đăng nhập thành công nhưng vào nhầm khu

TRUNGTAMMMO có nhiều khu như user, admin và các module dịch vụ. Nếu người dùng mở nhầm route không phù hợp với phiên hiện tại, hệ thống có thể điều hướng sang trang hỗ trợ truy cập để quay về đúng nơi cần vào.

Nguyên tắc cơ bản:

- tài khoản member bình thường nên thao tác trong khu user
- khu admin chỉ dành cho người có quyền quản trị
- nếu đang đăng nhập rồi mà lại mở nhầm trang auth, hệ thống sẽ điều hướng về khu hợp lệ

## 5. Xác minh 2FA

### 5.1 Khi nào sẽ thấy bước này?

Nếu tài khoản có bật xác minh 2 lớp, sau khi nhập đúng username và mật khẩu, người dùng chưa vào thẳng khu user ngay mà phải qua bước xác minh bổ sung.

### 5.2 Cần chuẩn bị gì?

- ứng dụng tạo mã 2FA hoặc phương thức xác minh đã gắn với tài khoản
- thiết bị cá nhân đang giữ mã xác minh

### 5.3 Lưu ý quan trọng

- không chia sẻ mã 2FA cho người khác
- không gửi ảnh mã 2FA qua chat công khai
- nếu đổi điện thoại, cần đảm bảo vẫn còn phương thức khôi phục phù hợp

## 6. Hồ sơ người dùng và thông tin tài khoản

### 6.1 Hồ sơ dùng để làm gì?

Khu hồ sơ giúp người dùng:

- xem thông tin tài khoản cơ bản
- kiểm tra trạng thái thành viên
- rà các thông tin định danh đang gắn với tài khoản
- theo dõi số dư, cấp bậc hoặc trạng thái hệ thống nếu giao diện có hiển thị

### 6.2 Khi nào cần kiểm tra hồ sơ?

- sau khi đăng ký tài khoản mới
- trước khi nạp tiền số lượng lớn
- khi cần xác minh email, username hoặc trạng thái thành viên
- khi nghi ngờ đang dùng nhầm tài khoản

## 7. Giữ phiên đăng nhập và đổi thiết bị

### 7.1 Nên bật “giữ đăng nhập” khi nào?

Chỉ nên bật trên:

- máy cá nhân
- điện thoại cá nhân
- môi trường bạn kiểm soát được

Không nên bật trên:

- máy công cộng
- máy đi mượn
- VPS dùng chung
- trình duyệt lạ không tin cậy

### 7.2 Khi nào nên đăng xuất?

- sau khi thao tác xong trên máy không quen
- khi nghi ngờ có người khác đã chạm vào tài khoản
- sau khi đổi mật khẩu hoặc thay đổi thông tin bảo mật

## 8. Bảo mật tài khoản người dùng

### 8.1 Mật khẩu

Nên dùng mật khẩu:

- đủ dài
- không trùng với mật khẩu email chính
- không dùng lại mật khẩu của mạng xã hội hoặc ví điện tử

### 8.2 Email gắn với tài khoản

Email nên là email đang dùng thật vì đây thường là đầu mối quan trọng để:

- nhận thông tin liên hệ
- khôi phục tài khoản nếu có quy trình hỗ trợ
- đối chiếu khi cần xử lý sự cố

### 8.3 Dấu hiệu tài khoản có nguy cơ

- thấy phiên lạ hoặc thao tác lạ
- không hiểu vì sao trạng thái tài khoản thay đổi
- phát sinh giao dịch bản thân không thực hiện
- không vào được tài khoản dù chắc chắn thông tin đúng

Khi đó người dùng nên:

1. ngừng thao tác thêm
2. đổi mật khẩu nếu vẫn còn truy cập được
3. chuẩn bị username, email, thời điểm xảy ra lỗi
4. liên hệ hỗ trợ

## 9. Các tình huống đăng nhập thường gặp

### 9.1 Quên mật khẩu

- kiểm tra xem bạn đang nhập username hay email đúng chưa
- xác nhận không bị bật nhầm bộ gõ hoặc caps lock
- nếu hệ thống có trang quên mật khẩu, dùng đúng luồng đó
- nếu không tự xử lý được, liên hệ hỗ trợ và gửi username hoặc email

### 9.2 Đúng tài khoản nhưng vào nhầm route

Hãy quay về:

- khu user nếu bạn là member bình thường
- trang chủ hệ thống nếu chưa rõ nên vào đâu
- trang hỗ trợ truy cập nếu hệ thống đã điều hướng sẵn cho bạn

### 9.3 Tài khoản bị khóa hoặc hạn chế

Trong tình huống này, người dùng cần chuẩn bị:

- username
- email
- thời gian gần nhất còn đăng nhập được
- mô tả ngắn gọn điều gì xảy ra trước khi bị khóa

## 10. Cách dùng tài khoản đúng theo từng mục tiêu

### 10.1 Nếu bạn chỉ muốn mua dịch vụ

Sau khi đăng nhập, thường sẽ đi theo chuỗi:

1. kiểm tra số dư
2. nạp tiền nếu cần
3. chọn module dịch vụ
4. theo dõi đơn hàng

### 10.2 Nếu bạn cần hỗ trợ kỹ thuật

Sau khi đăng nhập, nên vào:

- lịch sử giao dịch
- đơn hàng
- module cụ thể đang gặp lỗi
- chatbot user để hỏi nhanh quy trình

## 11. Ghi chú cho chatbot

Khi người dùng hỏi về tài khoản, chatbot cần phân loại nhanh câu hỏi vào một trong các nhóm sau:

- đăng ký tài khoản
- đăng nhập
- xác minh 2FA
- hồ sơ người dùng
- lỗi vào nhầm khu auth hoặc admin
- bảo mật tài khoản

Nếu câu hỏi liên quan tới dữ liệu tài khoản thực tế như khóa tài khoản, reset bảo mật hoặc tra cứu phiên đăng nhập cụ thể, chatbot phải hướng người dùng sang hỗ trợ thay vì tự khẳng định kết quả cuối cùng.
