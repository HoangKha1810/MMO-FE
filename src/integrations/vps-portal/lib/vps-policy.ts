export const VPS_POLICY_VERSION = "2026-04-09";

export type VpsPolicySection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export const vpsPolicyHighlights = [
  "Dịch vụ VPS chỉ được sử dụng cho mục đích hợp pháp, không phục vụ spam, tấn công, lừa đảo hay phát tán mã độc.",
  "Khách hàng cần tự bảo mật thông tin đăng nhập, dữ liệu và quyền truy cập từ xa được cấp sau khi hệ thống bàn giao VPS.",
  "Yêu cầu hoàn tiền chỉ được xem xét khi sự cố phát sinh từ hệ thống hoặc việc cung cấp dịch vụ không đúng cam kết công khai.",
  "Khiếu nại và hỗ trợ được tiếp nhận qua các kênh chính thức của TRUNGTAMMMO.VN và được xử lý theo mức độ vụ việc.",
] as const;

export const vpsPolicySections: readonly VpsPolicySection[] = [
  {
    id: "pham-vi",
    title: "1. Phạm vi áp dụng",
    paragraphs: [
      "Chính sách này áp dụng cho toàn bộ dịch vụ VPS được đăng ký, thanh toán và quản lý trên TRUNGTAMMMO.VN. Khi tạo đơn hàng hoặc tiếp tục sử dụng dịch vụ, khách hàng được hiểu là đã đọc, hiểu và đồng ý với toàn bộ nội dung bên dưới.",
      "TRUNGTAMMMO.VN có quyền điều chỉnh nội dung chính sách khi cần thiết để phù hợp với hoạt động vận hành, yêu cầu pháp lý và thay đổi từ nhà cung cấp hạ tầng. Phiên bản mới nhất sẽ được công bố trên website và có hiệu lực kể từ thời điểm đăng tải.",
    ],
  },
  {
    id: "su-dung-hop-phap",
    title: "2. Điều kiện sử dụng dịch vụ VPS",
    paragraphs: [
      "Khách hàng chịu trách nhiệm đối với toàn bộ dữ liệu, ứng dụng, website và hành vi phát sinh trên VPS được cấp. Dịch vụ chỉ được sử dụng cho các mục đích hợp pháp và không xâm phạm quyền, lợi ích hợp pháp của bên thứ ba.",
    ],
    bullets: [
      "Không sử dụng VPS để spam email, phát tán mã độc, lừa đảo, tổ chức cờ bạc, hack, DDoS, đào coin trái phép hoặc các hành vi vi phạm pháp luật Việt Nam.",
      "Không được lợi dụng tài khoản, IP hoặc quyền truy cập từ xa do hệ thống cấp để thực hiện hành vi gây ảnh hưởng đến hạ tầng, uy tín hoặc an toàn thông tin của TRUNGTAMMMO.VN và đối tác.",
      "Khách hàng phải tự bảo mật mật khẩu, SSH/RDP, key truy cập và các thông tin quản trị được cấp sau khi VPS được bàn giao.",
    ],
  },
  {
    id: "kich-hoat-ban-giao",
    title: "3. Kích hoạt, bàn giao và quản lý dịch vụ",
    paragraphs: [
      "Đơn VPS được xử lý sau khi thanh toán thành công và khi hệ thống nhận phản hồi provision từ nhà cung cấp hạ tầng. Thời gian kích hoạt thực tế có thể phụ thuộc vào tình trạng tài nguyên, hệ điều hành và chu kỳ thuê tương ứng.",
      "Thông tin truy cập như IP, tài khoản quản trị, mật khẩu, trạng thái dịch vụ và kỳ hạn tiếp theo sẽ được hiển thị trong khu quản lý VPS của khách hàng ngay khi dữ liệu được đồng bộ thành công.",
    ],
    bullets: [
      "TRUNGTAMMMO.VN có quyền tạm dừng xử lý đơn nếu phát hiện dấu hiệu bất thường, gian lận hoặc vi phạm chính sách.",
      "Khách hàng cần chủ động lưu lại và thay đổi thông tin đăng nhập mặc định sau khi nhận VPS để tăng mức độ an toàn.",
    ],
  },
  {
    id: "thanh-toan-gia-han",
    title: "4. Thanh toán, số dư và gia hạn",
    paragraphs: [
      "Các đơn VPS trên website được thanh toán bằng số dư tài khoản nội bộ. Khách hàng cần bảo đảm tài khoản có đủ số dư trước khi xác nhận mua hàng.",
      "Việc nạp tiền, gia hạn hoặc phát sinh nâng cấp cấu hình có thể được áp dụng theo giá bán công khai tại thời điểm giao dịch. Mọi ưu đãi, khuyến mãi hoặc giá đặc biệt nếu có sẽ tuân theo điều kiện riêng của từng chương trình.",
    ],
    bullets: [
      "Dịch vụ có thể bị gián đoạn hoặc không được gia hạn nếu khách hàng không thanh toán đúng thời hạn.",
      "Các khoản phí đã dùng cho phần thời gian dịch vụ đã sử dụng hoặc tài nguyên đã provision thực tế có thể không được hoàn lại toàn bộ.",
    ],
  },
  {
    id: "hoan-tien",
    title: "5. Hoàn tiền và từ chối hoàn tiền",
    paragraphs: [
      "TRUNGTAMMMO.VN xem xét hoàn tiền đối với dịch vụ VPS khi sự cố phát sinh từ hệ thống, việc provision không thành công, hoặc dịch vụ được cung cấp sai nghiêm trọng so với thông tin công bố. Mức hoàn tiền được xác định theo từng trường hợp cụ thể và thời gian dịch vụ còn lại.",
      "Với dịch vụ VPS tiêu chuẩn không thuộc diện khuyến mãi đặc biệt, yêu cầu hoàn tiền sớm có thể được xem xét ưu tiên trong giai đoạn đầu sử dụng nếu nguyên nhân đến từ lỗi hệ thống hoặc chất lượng dịch vụ không đạt cam kết công khai.",
    ],
    bullets: [
      "Không áp dụng hoàn tiền đối với trường hợp vi phạm pháp luật, vi phạm chính sách sử dụng, spam, tấn công, gian lận hoặc bị khóa dịch vụ do lỗi từ phía khách hàng.",
      "Không áp dụng hoàn tiền cho phần thời gian dịch vụ đã sử dụng, cấu hình đã nâng cấp, đơn hàng khuyến mãi ghi rõ không hoàn tiền, hoặc lỗi phát sinh từ phần mềm/cấu hình do khách hàng tự triển khai.",
      "Yêu cầu hoàn tiền cần được gửi qua kênh hỗ trợ chính thức để được kiểm tra nhật ký dịch vụ và thời gian sử dụng thực tế.",
    ],
  },
  {
    id: "bao-mat-du-lieu",
    title: "6. Bảo mật thông tin và dữ liệu",
    paragraphs: [
      "TRUNGTAMMMO.VN thu thập các thông tin cần thiết như tài khoản, email, giao dịch, số dư, lịch sử mua hàng và dữ liệu kỹ thuật liên quan để quản lý dịch vụ, xác minh giao dịch, hỗ trợ khách hàng và phòng chống gian lận.",
      "Thông tin cá nhân được lưu trữ theo phạm vi cần thiết cho vận hành dịch vụ và có thể được cung cấp cho cơ quan có thẩm quyền khi có yêu cầu hợp pháp. Chúng tôi không chủ động chia sẻ dữ liệu khách hàng cho bên thứ ba ngoài phạm vi cần thiết để cung cấp dịch vụ.",
    ],
    bullets: [
      "Khách hàng có trách nhiệm tự sao lưu dữ liệu ứng dụng, website và dữ liệu nội bộ trên VPS của mình.",
      "TRUNGTAMMMO.VN không chịu trách nhiệm cho mất mát dữ liệu phát sinh từ việc khách hàng quên sao lưu, để lộ mật khẩu hoặc tự thay đổi cấu hình sai.",
    ],
  },
  {
    id: "sla-khieu-nai",
    title: "7. Hỗ trợ kỹ thuật, SLA và khiếu nại",
    paragraphs: [
      "Hệ thống được vận hành với mục tiêu duy trì mức độ sẵn sàng cao và hỗ trợ kỹ thuật nhanh qua các kênh chính thức của TRUNGTAMMMO.VN. Trong điều kiện bình thường, chúng tôi hướng tới độ ổn định dịch vụ tương đương chuẩn vận hành VPS thương mại.",
      "Các khoảng thời gian bảo trì định kỳ, sự cố bất khả kháng, tấn công từ bên ngoài, lỗi do khách hàng tự cấu hình hoặc lỗi từ phần mềm của bên thứ ba sẽ không được tính là cơ sở bồi thường hoặc khiếu nại mặc định.",
    ],
    bullets: [
      "Khiếu nại về chất lượng dịch vụ nên được gửi sớm ngay khi phát hiện để thuận tiện cho việc đối chiếu log và xác minh nguyên nhân.",
      "TRUNGTAMMMO.VN ưu tiên giải quyết khiếu nại trên tinh thần thương lượng, minh bạch và giữ quyền từ chối các yêu cầu không có căn cứ hoặc vượt quá thời gian hợp lý để xác minh.",
    ],
  },
  {
    id: "hieu-luc",
    title: "8. Xác nhận đồng ý",
    paragraphs: [
      "Trong luồng mua VPS, khách hàng cần xác nhận đã đọc và đồng ý với Chính sách dịch vụ VPS trước khi hệ thống tiếp nhận đơn. Đây là điều kiện bắt buộc để hoàn tất giao dịch.",
      "Nếu khách hàng không đồng ý với các điều khoản nêu trên, vui lòng không tiếp tục đặt mua hoặc sử dụng dịch vụ VPS trên TRUNGTAMMMO.VN.",
    ],
  },
] as const;
