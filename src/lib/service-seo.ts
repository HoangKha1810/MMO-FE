export interface ServiceSeoEntry {
  slug: string;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  keywords: string[];
  highlights: string[];
  useCases: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  ctaLabel: string;
  ctaHref: string;
}

export const serviceSeoEntries: ServiceSeoEntry[] = [
  {
    slug: 'smm',
    title: 'Dịch vụ SMM tăng tương tác mạng xã hội',
    shortTitle: 'SMM',
    eyebrow: 'Social Media Marketing',
    description:
      'Mua dịch vụ SMM tăng like, follow, comment, view và tương tác mạng xã hội cho Facebook, TikTok, Instagram, YouTube với luồng đặt đơn tự động.',
    keywords: ['dịch vụ SMM', 'tăng tương tác', 'mua like Facebook', 'tăng follow TikTok', 'SMM Việt Nam'],
    highlights: ['Nhiều gói theo nền tảng', 'Theo dõi đơn trong tài khoản', 'Phù hợp reseller và shop online'],
    useCases: ['Tăng tín hiệu ban đầu cho fanpage', 'Đẩy social proof cho chiến dịch bán hàng', 'Vận hành dịch vụ SMM cho khách lẻ'],
    faqs: [
      {
        question: 'Dịch vụ SMM phù hợp với ai?',
        answer: 'Phù hợp với shop online, creator, agency, reseller và người làm MMO cần tăng tín hiệu mạng xã hội có kiểm soát.',
      },
      {
        question: 'Có thể theo dõi trạng thái đơn không?',
        answer: 'Có. Sau khi đăng nhập, người dùng có thể xem lịch sử đơn và trạng thái xử lý trong khu vực tài khoản.',
      },
    ],
    ctaLabel: 'Vào khu SMM',
    ctaHref: '/auth/login',
  },
  {
    slug: 'auto-mxh',
    title: 'Auto MXH tự động hóa tài khoản mạng xã hội',
    shortTitle: 'Auto MXH',
    eyebrow: 'Automation',
    description:
      'Dịch vụ Auto MXH giúp tự động hóa thao tác, chăm sóc tài khoản và tối ưu quy trình vận hành mạng xã hội cho đội MMO.',
    keywords: ['Auto MXH', 'tự động hóa mạng xã hội', 'nuôi tài khoản', 'automation MMO'],
    highlights: ['Tiết kiệm thời gian thao tác', 'Phù hợp vận hành số lượng lớn', 'Dễ kết hợp proxy và tài nguyên'],
    useCases: ['Chăm sóc tài khoản MXH', 'Tối ưu quy trình làm job', 'Vận hành tài khoản cho đội nhóm'],
    faqs: [
      {
        question: 'Auto MXH có thay thế thao tác thủ công không?',
        answer: 'Auto MXH giúp giảm thao tác lặp lại, còn kịch bản cụ thể nên được cấu hình theo nhu cầu vận hành.',
      },
      {
        question: 'Có cần proxy riêng không?',
        answer: 'Với nhiều tài khoản, nên dùng proxy phù hợp để tách môi trường và giảm rủi ro đăng nhập.',
      },
    ],
    ctaLabel: 'Dùng Auto MXH',
    ctaHref: '/auth/login',
  },
  {
    slug: 'tai-nguyen-mmo',
    title: 'Tài nguyên MMO chất lượng cho vận hành online',
    shortTitle: 'Tài nguyên MMO',
    eyebrow: 'MMO Resources',
    description:
      'Kho tài nguyên MMO gồm tài khoản, dữ liệu, công cụ và sản phẩm số phục vụ bán hàng, seeding, automation và vận hành chiến dịch online.',
    keywords: ['tài nguyên MMO', 'mua tài nguyên MMO', 'tài khoản số', 'tool MMO'],
    highlights: ['Tư vấn theo nhu cầu', 'Nhiều nhóm tài nguyên', 'Phù hợp chiến dịch bán hàng và MMO'],
    useCases: ['Chuẩn bị tài khoản cho chiến dịch', 'Mua dữ liệu hoặc công cụ vận hành', 'Bổ sung tài nguyên cho đội reseller'],
    faqs: [
      {
        question: 'Tài nguyên có mua tự động không?',
        answer: 'Một số tài nguyên có thể xử lý tự động, một số tài nguyên cần liên hệ admin để kiểm tra tồn kho và cách bàn giao.',
      },
      {
        question: 'Thanh toán bằng ví nào?',
        answer: 'Các luồng mua trong hệ thống ưu tiên trừ trực tiếp từ ví game hoặc số dư theo cấu hình dịch vụ.',
      },
    ],
    ctaLabel: 'Xem tài nguyên',
    ctaHref: '/auth/login',
  },
  {
    slug: 'proxy-cloud',
    title: 'Proxy Cloud cho MMO, nuôi tài khoản và automation',
    shortTitle: 'Proxy Cloud',
    eyebrow: 'Proxy',
    description:
      'Dịch vụ proxy cloud hỗ trợ residential, datacenter và proxy theo nhu cầu cho đăng nhập tài khoản, automation, kiểm thử và vận hành MMO.',
    keywords: ['proxy cloud', 'proxy MMO', 'proxy nuôi tài khoản', 'proxy datacenter', 'proxy residential'],
    highlights: ['Quản lý ngay trong tài khoản', 'Phù hợp automation', 'Dễ kết hợp Auto MXH và tài nguyên'],
    useCases: ['Tách môi trường đăng nhập', 'Chạy tool và automation', 'Kiểm thử website hoặc chiến dịch'],
    faqs: [
      {
        question: 'Proxy dùng cho mục đích gì?',
        answer: 'Proxy giúp tách IP, phục vụ đăng nhập, kiểm thử, automation và các tác vụ MMO cần môi trường ổn định.',
      },
      {
        question: 'Có thể mua nhiều proxy cùng lúc không?',
        answer: 'Có thể quản lý nhiều gói proxy trong tài khoản nếu dịch vụ đang mở bán.',
      },
    ],
    ctaLabel: 'Mua proxy',
    ctaHref: '/auth/login',
  },
  {
    slug: 'cho-mmo',
    title: 'Chợ MMO mua bán dịch vụ và sản phẩm số',
    shortTitle: 'Chợ MMO',
    eyebrow: 'Marketplace',
    description:
      'Chợ MMO kết nối người mua và người bán dịch vụ số, tài nguyên, sản phẩm MMO và gói vận hành online trong một hệ sinh thái.',
    keywords: ['chợ MMO', 'mua bán MMO', 'marketplace MMO', 'dịch vụ số'],
    highlights: ['Tập trung nhiều nhóm dịch vụ', 'Hỗ trợ người mua và seller', 'Phù hợp cộng đồng MMO Việt Nam'],
    useCases: ['Đăng bán sản phẩm số', 'Tìm nguồn dịch vụ MMO', 'Mở kênh doanh thu reseller'],
    faqs: [
      {
        question: 'Chợ MMO khác gì tài nguyên MMO?',
        answer: 'Tài nguyên MMO tập trung vào sản phẩm do hệ thống hoặc admin cung cấp, còn chợ MMO hướng tới giao dịch đa người bán.',
      },
      {
        question: 'Seller có thể tham gia không?',
        answer: 'Có. Seller có thể dùng khu vực seller nếu tài khoản đủ điều kiện và dịch vụ đang được mở.',
      },
    ],
    ctaLabel: 'Vào chợ MMO',
    ctaHref: '/auth/login',
  },
  {
    slug: 'forum-mmo',
    title: 'Forum MMO chia sẻ kiến thức và kết nối cộng đồng',
    shortTitle: 'Forum MMO',
    eyebrow: 'Community',
    description:
      'Forum MMO là nơi trao đổi kinh nghiệm, hỏi đáp, đăng bài, kết nối cộng đồng và cập nhật kiến thức kiếm tiền online.',
    keywords: ['forum MMO', 'cộng đồng MMO', 'kiến thức MMO', 'kiếm tiền online'],
    highlights: ['Không gian cộng đồng', 'Chia sẻ kinh nghiệm thực chiến', 'Hỗ trợ kết nối người làm MMO'],
    useCases: ['Đăng bài hỏi đáp', 'Tìm ý tưởng dịch vụ mới', 'Xây dựng uy tín trong cộng đồng'],
    faqs: [
      {
        question: 'Forum có dành cho người mới không?',
        answer: 'Có. Người mới có thể đọc bài, hỏi đáp và học kinh nghiệm từ cộng đồng.',
      },
      {
        question: 'Có thể quảng bá dịch vụ không?',
        answer: 'Có thể nếu tuân thủ quy định cộng đồng và đúng chuyên mục được phép.',
      },
    ],
    ctaLabel: 'Vào forum',
    ctaHref: '/auth/login',
  },
  {
    slug: 'mua-ban-game',
    title: 'Trao đổi game, vật phẩm và dịch vụ game',
    shortTitle: 'Trao đổi game',
    eyebrow: 'Game Exchange',
    description:
      'Khu trao đổi game hỗ trợ đăng bài tài khoản, vật phẩm, dịch vụ game và sản phẩm liên quan cho cộng đồng game thủ.',
    keywords: ['trao đổi game', 'dịch vụ game', 'tài khoản game', 'vật phẩm game'],
    highlights: ['Dễ mở rộng danh mục game', 'Phù hợp ví game', 'Có thể kết hợp random tài khoản'],
    useCases: ['Đăng bài trao đổi tài khoản game', 'Trao đổi vật phẩm hoặc dịch vụ game', 'Tạo gói combo cho game thủ'],
    faqs: [
      {
        question: 'Dịch vụ này dùng ví game không?',
        answer: 'Có thể dùng ví game cho các giao dịch game theo cấu hình hiện tại của hệ thống.',
      },
      {
        question: 'Có hỗ trợ random tài khoản không?',
        answer: 'Có thể tách riêng random tài khoản game để người dùng mua nhanh theo danh mục.',
      },
    ],
    ctaLabel: 'Mở khu trao đổi game',
    ctaHref: '/auth/login',
  },
  {
    slug: 'tai-khoan-game',
    title: 'Thuê tài khoản game 99 năm từ nguồn API Random1K và ShopReg61',
    shortTitle: 'Thuê tài khoản game 99 năm',
    eyebrow: 'Game Accounts',
    description:
      'Dịch vụ thuê tài khoản game 99 năm đồng bộ nguồn API, hỗ trợ danh mục game, kho sản phẩm và luồng thuê tự động bằng ví game.',
    keywords: ['thuê tài khoản game 99 năm', 'tài khoản game thuê', 'shop tài khoản game', 'Random1K', 'ShopReg61'],
    highlights: ['Đồng bộ nguồn API', 'Thuê nhanh bằng ví game', 'Dễ lọc theo danh mục'],
    useCases: ['Cho thuê tài khoản game 99 năm', 'Tạo shop acc game', 'Kết hợp random và sản phẩm cố định'],
    faqs: [
      {
        question: 'Nguồn tài khoản game lấy từ đâu?',
        answer: 'Hệ thống có thể đồng bộ từ các nguồn API như Random1K hoặc ShopReg61 theo cấu hình admin.',
      },
      {
        question: 'Người mua nhận hàng thế nào?',
        answer: 'Sau khi thuê thành công, tài khoản nhận dữ liệu đơn trong lịch sử hoặc khu vực đơn hàng game.',
      },
    ],
    ctaLabel: 'Xem tài khoản game thuê',
    ctaHref: '/auth/login',
  },
  {
    slug: 'random-game',
    title: 'Random thuê tài khoản game 99 năm và túi mù game',
    shortTitle: 'Random thuê tài khoản game 99 năm',
    eyebrow: 'Random Game',
    description:
      'Dịch vụ random thuê tài khoản game 99 năm giúp người dùng thuê nhanh các gói túi mù, quay tài khoản và nhận kết quả tự động sau thanh toán.',
    keywords: ['random thuê tài khoản game 99 năm', 'random tài khoản game', 'túi mù acc game', 'thuê random acc'],
    highlights: ['Trải nghiệm mua nhanh', 'Phù hợp chiến dịch khuyến mãi', 'Tối ưu doanh thu ví game'],
    useCases: ['Bán gói túi mù acc', 'Tạo minigame bán hàng', 'Đẩy doanh thu từ ví game'],
    faqs: [
      {
        question: 'Random thuê game có phù hợp hơn gói thường không?',
        answer: 'Nếu thiết kế gói hợp lý, random game thường tạo vòng mua nhanh và tỷ lệ quay lại tốt hơn sản phẩm cố định.',
      },
      {
        question: 'Có cần đăng nhập không?',
        answer: 'Có. Người dùng cần đăng nhập để hệ thống trừ ví, lưu lịch sử và bàn giao kết quả.',
      },
    ],
    ctaLabel: 'Thuê random game',
    ctaHref: '/auth/login',
  },
  {
    slug: 'doi-the',
    title: 'Đổi thẻ cào và thanh toán số cho người dùng MMO',
    shortTitle: 'Đổi thẻ',
    eyebrow: 'Payment',
    description:
      'Dịch vụ đổi thẻ hỗ trợ người dùng nạp, đổi và quản lý giao dịch thanh toán số trong hệ sinh thái MMO.',
    keywords: ['đổi thẻ', 'đổi thẻ cào', 'nạp tiền MMO', 'thanh toán MMO'],
    highlights: ['Phù hợp người dùng game', 'Tích hợp ví hệ thống', 'Dễ theo dõi lịch sử giao dịch'],
    useCases: ['Nạp số dư hệ thống', 'Thanh toán dịch vụ game', 'Hỗ trợ người dùng không dùng ngân hàng'],
    faqs: [
      {
        question: 'Đổi thẻ có lưu lịch sử không?',
        answer: 'Có. Người dùng có thể theo dõi giao dịch trong tài khoản nếu luồng đổi thẻ được kích hoạt.',
      },
      {
        question: 'Dịch vụ này nên đặt ở đâu?',
        answer: 'Nên đặt gần nhóm game và nạp tiền để người dùng dễ chuyển đổi từ ví game sang mua dịch vụ.',
      },
    ],
    ctaLabel: 'Dùng đổi thẻ',
    ctaHref: '/auth/login',
  },
  {
    slug: 'vps-gpu-ai',
    title: 'Thuê VPS GPU mạnh cho AI, render và chơi game',
    shortTitle: 'VPS GPU AI',
    eyebrow: 'GPU Cloud',
    description:
      'Dịch vụ thuê VPS GPU mạnh cho AI, render, chạy mô hình, automation nặng và cloud gaming với cấu hình GPU linh hoạt.',
    keywords: ['VPS GPU', 'thuê GPU AI', 'cloud GPU Việt Nam', 'VPS AI', 'VPS chơi game'],
    highlights: ['Hợp với AI và render', 'Tùy chọn cấu hình linh hoạt', 'Có thể bán theo gói cài sẵn'],
    useCases: ['Chạy Stable Diffusion hoặc ComfyUI', 'Render video và hình ảnh', 'Cloud gaming hoặc máy ảo GPU'],
    faqs: [
      {
        question: 'VPS GPU nên bán thế nào để lời hơn?',
        answer: 'Nên bán theo gói cài sẵn như AI image, render, gaming, bot automation thay vì chỉ bán máy thô theo giờ.',
      },
      {
        question: 'Người dùng cần biết kỹ thuật không?',
        answer: 'Có thể giảm rào cản bằng preset phần mềm, hướng dẫn đăng nhập và gói hỗ trợ cài đặt ban đầu.',
      },
    ],
    ctaLabel: 'Thuê VPS GPU',
    ctaHref: '/auth/login',
  },
  {
    slug: 'tiktok-shop-shopee',
    title: 'Dịch vụ TikTok Shop và Shopee cho nhà bán hàng',
    shortTitle: 'TikTok Shop & Shopee',
    eyebrow: 'Social Commerce',
    description:
      'Gói dịch vụ hỗ trợ nhà bán hàng TikTok Shop và Shopee: seeding, review, livestream traffic, affiliate/KOC và tối ưu vận hành shop.',
    keywords: ['dịch vụ TikTok Shop', 'dịch vụ Shopee', 'seeding review', 'livestream TikTok Shop', 'affiliate KOC'],
    highlights: ['Nhu cầu B2B rõ ràng', 'Dễ bán theo combo tháng', 'Có thể kết hợp SMM, content và forum'],
    useCases: ['Tăng tín hiệu shop mới', 'Đẩy livestream bán hàng', 'Tìm KOC/affiliate cho sản phẩm'],
    faqs: [
      {
        question: 'Vì sao nên mở dịch vụ TikTok Shop và Shopee?',
        answer: 'Nhà bán hàng đang cần dịch vụ vận hành, nội dung, seeding và affiliate để cạnh tranh khi chi phí nền tảng tăng.',
      },
      {
        question: 'Có thể bán theo gói nào?',
        answer: 'Có thể bán gói seeding review, tăng traffic livestream, quản lý affiliate/KOC và combo nội dung sản phẩm theo tháng.',
      },
    ],
    ctaLabel: 'Tư vấn shop',
    ctaHref: '/auth/login',
  },
  {
    slug: 'kien-thuc-mmo',
    title: 'Kiến thức MMO, hướng dẫn kiếm tiền online và vận hành dịch vụ số',
    shortTitle: 'Kiến thức MMO',
    eyebrow: 'MMO Learning',
    description:
      'Kho kiến thức MMO giúp người dùng học cách vận hành dịch vụ số, chọn nguồn hàng, bán tài nguyên, quản lý ví và tối ưu chiến dịch.',
    keywords: ['kiến thức MMO', 'hướng dẫn MMO', 'kiếm tiền online', 'kinh nghiệm bán dịch vụ số'],
    highlights: ['Tăng trust cho thương hiệu', 'Hỗ trợ SEO dài hạn', 'Dẫn người dùng vào dịch vụ trả phí'],
    useCases: ['Viết bài hướng dẫn', 'Tạo case study dịch vụ', 'Xây dựng cộng đồng người dùng mới'],
    faqs: [
      {
        question: 'Nội dung kiến thức có giúp bán dịch vụ không?',
        answer: 'Có. Bài hướng dẫn tốt giúp người dùng hiểu nhu cầu, tin nền tảng hơn và chuyển đổi sang dịch vụ trả phí.',
      },
      {
        question: 'Nên viết chủ đề nào trước?',
        answer: 'Nên ưu tiên các bài có intent mua như tăng tương tác, mua proxy, tài khoản game, random game và VPS GPU AI.',
      },
    ],
    ctaLabel: 'Xem cộng đồng',
    ctaHref: '/auth/login',
  },
];

export const serviceSeoRoutes = serviceSeoEntries.map((service) => `/services/${service.slug}`);

export function getServiceSeoEntry(slug: string) {
  return serviceSeoEntries.find((service) => service.slug === slug) || null;
}
