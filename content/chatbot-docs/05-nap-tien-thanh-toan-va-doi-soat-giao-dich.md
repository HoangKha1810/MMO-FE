# TRUNGTAMMMO: Nạp Tiền, Thanh Toán Và Đối Soát Giao Dịch Cho Người Dùng

## 1. Mục tiêu của tài liệu này

Tài liệu này mô tả chi tiết cách nạp tiền vào ví hệ thống, cách hiểu trạng thái giao dịch, cách kiểm tra khi giao dịch pending, và người dùng cần chuẩn bị gì khi phải liên hệ hỗ trợ về thanh toán.

## 2. Ví hệ thống hoạt động như thế nào?

Phần lớn giao dịch trên TRUNGTAMMMO không thanh toán trực tiếp ở từng module riêng lẻ. Thay vào đó, người dùng:

1. tạo giao dịch nạp tiền
2. hoàn tất thanh toán theo hướng dẫn
3. chờ số dư cộng vào ví
4. dùng số dư đó để mua SMM, tài nguyên, Auto MXH hoặc các dịch vụ khác

Ưu điểm của mô hình này là:

- dễ theo dõi số dư
- dễ đối chiếu lịch sử
- tách bạch bước thanh toán và bước đặt đơn

## 3. Quy trình nạp tiền chuẩn

### 3.1 Trước khi nạp

Người dùng nên:

- kiểm tra đang đăng nhập đúng tài khoản
- xác nhận số tiền muốn nạp
- hạn chế tạo nhiều giao dịch trùng nhau trong cùng một lúc nếu chưa cần thiết

### 3.2 Các bước nạp tiền

1. Vào trang Nạp tiền trong khu user.
2. Nhập số tiền muốn nạp.
3. Chọn phương thức thanh toán nếu giao diện có nhiều lựa chọn.
4. Tạo giao dịch.
5. Hệ thống sinh giao dịch chờ thanh toán.
6. Người dùng chuyển sang cổng thanh toán hoặc quét QR theo hướng dẫn.
7. Sau khi thanh toán thành công, hệ thống sẽ cập nhật trạng thái và cộng số dư.

### 3.3 Sau khi thanh toán xong

Người dùng cần kiểm tra:

- số dư ví đã tăng chưa
- lịch sử nạp gần đây đã có bản ghi mới chưa
- trạng thái giao dịch còn pending hay đã success

## 4. Ý nghĩa các trạng thái giao dịch thường gặp

### 4.1 Pending

Pending nghĩa là giao dịch đã được tạo trong hệ thống nhưng chưa hoàn tất bước đối soát cuối cùng.

Điều này có thể xảy ra khi:

- người dùng chưa thanh toán
- vừa mới thanh toán xong và hệ thống đang chờ đồng bộ
- webhook hoặc bước xác nhận cuối đang đến chậm

### 4.2 Success

Success nghĩa là giao dịch đã được ghi nhận thành công và số dư đã hoặc sẽ phản ánh đúng vào ví theo logic xử lý của hệ thống.

### 4.3 Failed hoặc canceled

Nếu hệ thống có hiển thị trạng thái thất bại hoặc hủy, thường có nghĩa là giao dịch đó không được dùng để cộng ví và người dùng cần tạo giao dịch mới nếu vẫn muốn nạp.

## 5. Cách kiểm tra khi giao dịch còn pending

### 5.1 Việc đầu tiên nên làm

- mở lại trang Nạp tiền
- xem danh sách lịch sử nạp gần đây
- kiểm tra đúng giao dịch vừa tạo
- so sánh số tiền đã chuyển với số tiền trên giao dịch

### 5.2 Không nên làm gì?

- không nên tạo thêm nhiều giao dịch trùng nhau ngay lập tức nếu chưa kiểm tra xong giao dịch cũ
- không nên kết luận giao dịch lỗi chỉ sau vài giây
- không nên gửi thiếu mã giao dịch khi liên hệ hỗ trợ

### 5.3 Khi nào nên chờ thêm?

Nếu vừa thanh toán xong, người dùng nên cho hệ thống một khoảng thời gian ngắn để đồng bộ rồi mới kiểm tra tiếp.

## 6. Những lỗi thanh toán thường gặp

### 6.1 Chuyển đúng tiền nhưng chưa thấy cộng ví

Các nguyên nhân phổ biến:

- giao dịch vẫn đang ở bước đối soát
- người dùng đang xem nhầm tài khoản
- đã tạo nhiều giao dịch và đang nhìn nhầm mã
- dữ liệu trạng thái chưa refresh ở giao diện hiện tại

### 6.2 Chuyển nhầm số tiền

Nếu số tiền chuyển khác với số tiền trên giao dịch, việc khớp giao dịch có thể chậm hơn hoặc cần hỗ trợ thủ công, tùy logic vận hành hiện tại.

### 6.3 Tạo nhiều giao dịch giống nhau

Khi người dùng tạo nhiều giao dịch pending liên tiếp:

- khó xác định giao dịch nào vừa được thanh toán
- dễ đối chiếu nhầm
- khi nhắn hỗ trợ cũng mất thời gian hơn

## 7. Khi nào cần liên hệ hỗ trợ thanh toán?

Nên liên hệ hỗ trợ khi:

- đã thanh toán xong nhưng số dư vẫn chưa lên sau thời gian hợp lý
- bạn không chắc mình đã thanh toán đúng giao dịch nào
- trạng thái không thay đổi dù đã refresh lại
- giao dịch đã bị nhầm số tiền hoặc nhầm nội dung

## 8. Cần gửi gì để hỗ trợ xử lý nhanh?

Khi nhắn hỗ trợ, người dùng nên chuẩn bị đủ:

- username
- mã giao dịch nạp tiền
- số tiền đã chuyển
- thời gian thanh toán
- ảnh chụp màn hình thanh toán nếu có

Đây là bộ thông tin tối thiểu để đối soát nhanh hơn.

## 9. Sau khi nạp thành công nên làm gì?

Sau khi ví đã lên số dư, người dùng có thể tiếp tục:

- mua dịch vụ SMM
- mua tài nguyên MMO
- đặt đơn Auto MXH
- đặt các dịch vụ hỗ trợ khác đang mở bán

Nên kiểm tra số dư trước khi vào module mua hàng để tránh bị gián đoạn giữa chừng.

## 10. Luồng chuẩn từ nạp tiền đến mua hàng

1. Đăng nhập đúng tài khoản.
2. Vào Nạp tiền.
3. Tạo giao dịch.
4. Hoàn tất thanh toán.
5. Chờ trạng thái success và ví cập nhật.
6. Chuyển sang module cần mua.
7. Đặt đơn bằng số dư ví.
8. Theo dõi đơn hàng hoặc lịch sử giao dịch.

## 11. Cách tự kiểm tra giao dịch trước khi nhắn support

Người dùng nên tự check theo checklist sau:

1. có đang mở đúng tài khoản hay không
2. mã giao dịch vừa tạo là mã nào
3. đã chuyển đúng số tiền hay chưa
4. giao dịch đó còn pending hay đã success
5. ví đã được cộng số dư chưa

Nếu cả năm bước đều đã kiểm tra mà vẫn chưa ổn, lúc đó hãy liên hệ hỗ trợ.

## 12. Ghi chú cho chatbot

Khi người dùng hỏi về nạp tiền, chatbot cần:

- hỏi rõ là chưa thanh toán hay đã thanh toán xong
- nếu đã thanh toán, yêu cầu người dùng kiểm tra lịch sử nạp gần đây và mã giao dịch
- không khẳng định giao dịch đã được cộng ví nếu không có dữ liệu thực tế
- hướng người dùng chuẩn bị mã giao dịch, số tiền và ảnh chụp khi cần liên hệ hỗ trợ
