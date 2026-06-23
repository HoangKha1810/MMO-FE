import type { SmmServiceRecord } from '@/lib/smm-provider';

export interface SmmApiConnectionMethod {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
}

export interface SmmApiEndpointDoc {
  id: string;
  title: string;
  method: 'GET' | 'POST';
  endpoint: string;
  description: string;
  parameters?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  requestPayloadTitle: string;
  requestPayload: string;
  requestExample: string;
  responseExample: string;
  errorExample: string;
  notes: string[];
}

export interface SmmApiDocsRuntimeMeta {
  providerName?: string;
  exchangeRate?: number;
  marginPercent?: number;
  vatPercent?: number;
}

export interface SmmApiDocsService {
  id: number;
  provider_id: number;
  service: number;
  name: string;
  type: string;
  category: string;
  platform: string;
  min: number;
  max: number;
  refill: boolean;
  price_per_1k_vnd: number;
  price_per_unit_vnd: number;
  is_comment_service: boolean;
  total_orders: number;
}

export interface SmmApiDocsContent {
  baseUrl: string;
  authNotes: string[];
  priceNotes: string[];
  connectionMethods: SmmApiConnectionMethod[];
  endpoints: SmmApiEndpointDoc[];
  services: SmmApiDocsService[];
  summary: {
    totalServices: number;
    totalPlatforms: number;
    totalCategories: number;
    providerName: string;
    vatPercent: number;
  };
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeBaseUrl(baseUrl: string) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function slugifyText(text: string) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function normalizeDocsService(service: SmmServiceRecord): SmmApiDocsService {
  return {
    id: Number(service.id || 0),
    provider_id: Number(service.provider_id || 0),
    service: Number(service.service || 0),
    name: String(service.name || ''),
    type: String(service.type || 'Default'),
    category: String(service.category || 'Chưa phân loại'),
    platform: String(service.platform || 'SMM'),
    min: Number(service.min || 0),
    max: Number(service.max || 0),
    refill: Boolean(service.refill),
    price_per_1k_vnd: roundMoney(Number(service.price_per_1k_vnd || 0)),
    price_per_unit_vnd: roundMoney(Number(service.price_per_unit_vnd || 0)),
    is_comment_service: Boolean(service.is_comment_service),
    total_orders: Math.max(0, Math.trunc(Number(service.total_orders || 0))),
  };
}

function serviceForJson(service: SmmApiDocsService) {
  return {
    id: service.id,
    provider_id: service.provider_id,
    service: service.service,
    name: service.name,
    type: service.type,
    category: service.category,
    platform: service.platform,
    min: service.min,
    max: service.max,
    refill: service.refill,
    price_per_1k_vnd: service.price_per_1k_vnd,
    price_per_unit_vnd: service.price_per_unit_vnd,
    is_comment_service: service.is_comment_service,
    total_orders: service.total_orders,
  };
}

export function buildSmmApiDocs(
  baseUrl: string,
  servicesInput: SmmServiceRecord[] = [],
  runtimeMeta: SmmApiDocsRuntimeMeta = {}
): SmmApiDocsContent {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const externalBaseUrl = `${normalizedBaseUrl}/api/external/smm`;
  const services = servicesInput.map(normalizeDocsService);
  const platforms = Array.from(new Set(services.map((service) => service.platform).filter(Boolean)));
  const categories = Array.from(new Set(services.map((service) => service.category).filter(Boolean)));
  const providerName = runtimeMeta.providerName || 'Provider SMM đang bật';
  const vatPercent = Number.isFinite(runtimeMeta.vatPercent) ? Number(runtimeMeta.vatPercent) : 0;

  const sampleService =
    services.find((service) => !service.is_comment_service && service.min > 0) ||
    services[0] ||
    {
      id: 3350,
      provider_id: 12,
      service: 23,
      name: 'Facebook Post Like',
      type: 'Default',
      category: '[FB] Tăng Like Facebook',
      platform: 'Facebook',
      min: 50,
      max: 200000,
      refill: false,
      price_per_1k_vnd: 15000,
      price_per_unit_vnd: 15,
      is_comment_service: false,
      total_orders: 0,
    };

  const sampleQuantity = Math.min(Math.max(sampleService.min || 1, 1000), sampleService.max || 1000);
  const sampleSubtotal = Math.ceil((sampleQuantity / 1000) * sampleService.price_per_1k_vnd);
  const sampleVat = Math.round((sampleSubtotal * vatPercent) / 100);
  const sampleTotal = Math.round(sampleSubtotal + sampleVat);
  const sampleCategorySlug = slugifyText(sampleService.category) || 'facebook';
  const sampleOrderId = '987654321';

  return {
    baseUrl: normalizedBaseUrl,
    authNotes: [
      'External SMM API bắt buộc gửi API key do admin cấp theo 1 trong 3 cách: x-api-key, Authorization: Bearer, hoặc query api_key/key.',
      'API key hiện dùng chung hệ cấp key với Game API để admin quản lý tập trung theo từng user.',
      'User thường chỉ xem/kiểm tra được đơn SMM của chính mình; admin được kiểm tra nhiều đơn để vận hành.',
      'Giá trả về là giá bán đang hiển thị trên web, lấy từ cache dịch vụ SMM sau khi đã tính margin hoặc giá custom.',
      'API tạo đơn SMM sẽ trừ ví chính users.balance của user gắn với API key, không trừ game_balance.',
    ],
    priceNotes: [
      'price_per_1k_vnd là giá bán cho 1.000 số lượng trên web.',
      'price_per_unit_vnd = price_per_1k_vnd / 1000, dùng để tham khảo giá lẻ.',
      `Khi tạo đơn, hệ thống tính subtotal = ceil(quantity / 1000 * price_per_1k_vnd), sau đó cộng VAT ${vatPercent}%.`,
      'Dịch vụ comment sẽ tự lấy quantity theo số dòng comment hợp lệ thay vì quantity nhập tay.',
      'Endpoint quote chỉ tính giá; endpoint order/add mới tạo đơn thật, gọi provider và trừ tiền.',
    ],
    summary: {
      totalServices: services.length,
      totalPlatforms: platforms.length,
      totalCategories: categories.length,
      providerName,
      vatPercent,
    },
    services,
    connectionMethods: [
      {
        id: 'services',
        title: 'Lấy bảng giá web bằng fetch',
        description: 'Dùng cho đối tác hoặc tool nội bộ cần lấy danh sách dịch vụ SMM đang bán bằng API key.',
        language: 'ts',
        code: `const response = await fetch('${externalBaseUrl}/services', {
  cache: 'no-store',
  headers: {
    'x-api-key': 'ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  }
});

const payload = await response.json();
console.log(payload.data[0].price_per_unit_vnd);`,
      },
      {
        id: 'quote',
        title: 'Tính giá đơn bằng API key',
        description: 'Dùng để kiểm tra tổng tiền trước khi tạo đơn hoặc đối soát giá hiển thị trên web.',
        language: 'ts',
        code: `const response = await fetch('${externalBaseUrl}/quote', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  body: JSON.stringify({
    service_id: ${sampleService.service},
    provider_id: ${sampleService.provider_id},
    quantity: ${sampleQuantity}
  })
});

const payload = await response.json();
console.log(payload);`,
      },
      {
        id: 'add-order',
        title: 'Tạo đơn và trừ tiền ví chính',
        description: 'Dùng cho đối tác đấu API web anh: user nạp tiền vào web, gọi API tạo đơn, hệ thống trừ ví chính rồi đẩy đơn sang provider.',
        language: 'bash',
        code: `curl --request POST '${externalBaseUrl}/order' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '${JSON.stringify({
    service: sampleService.service,
    link: 'https://www.facebook.com/example/posts/123',
    quantity: sampleQuantity,
  })}'`,
      },
      {
        id: 'curl-status',
        title: 'Kiểm tra trạng thái bằng cURL',
        description: 'Dùng khi admin hoặc user có cookie đăng nhập hợp lệ và cần kiểm tra nhanh một mã đơn provider.',
        language: 'bash',
        code: `curl '${externalBaseUrl}/status?order=${sampleOrderId}' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
      },
    ],
    endpoints: [
      {
        id: 'services',
        title: 'Lấy danh sách dịch vụ và giá web',
        method: 'GET',
        endpoint: `${externalBaseUrl}/services`,
        description: 'Trả về toàn bộ dịch vụ SMM đang active, kèm giá bán trên web, min/max, platform, category và thống kê tổng.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"services" nếu gọi endpoint tổng /api/external/smm' },
          { name: 'platform', description: 'Lọc platform, ví dụ Facebook' },
          { name: 'category', description: 'Slug hoặc tên category cần lọc' },
          { name: 'search', description: 'Từ khóa tìm trong tên service/category' },
          { name: 'page, per_page', description: 'Phân trang, per_page tối đa 500' },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          refresh: '0 | 1 - optional, refresh=1 sẽ sync lại provider trước khi trả data',
          platform: 'Facebook - optional',
          category: 'fb-binh-luan-facebook - optional',
          search: 'keyword - optional',
          page: 1,
          per_page: 100,
        }),
        requestExample: `curl '${externalBaseUrl}/services?platform=Facebook' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          meta: {
            providerName,
            exchangeRate: runtimeMeta.exchangeRate || 27000,
            marginPercent: runtimeMeta.marginPercent || 0,
            responseType: 'JSON',
          },
          summary: {
            total_services: services.length,
            total_platforms: platforms.length,
            total_categories: categories.length,
          },
          data: services.slice(0, 2).map(serviceForJson),
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Không thể tải dịch vụ SMM',
        }),
        notes: [
          'Đây là endpoint chính để lấy giá web hiện tại.',
          'Dữ liệu được no-store để tránh browser giữ giá cũ.',
          'Nếu refresh=1, hệ thống gọi provider rồi cập nhật cache trước khi trả về.',
        ],
      },
      {
        id: 'categories',
        title: 'Lấy các card category như màn hình web',
        method: 'GET',
        endpoint: `${externalBaseUrl}/categories`,
        description: 'Trả về mỗi category một dòng tổng hợp min/max và khoảng giá / lượt giống card trên trang SMM.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"categories" nếu gọi endpoint tổng /api/external/smm' },
          { name: 'platform', description: 'Lọc platform, ví dụ Facebook' },
          { name: 'search', description: 'Từ khóa tìm trong category/service' },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          platform: 'Facebook - optional',
          search: 'keyword - optional',
        }),
        requestExample: `curl '${externalBaseUrl}/categories?platform=Facebook' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          summary: {
            total_categories: categories.length,
            total_services: services.length,
          },
          data: [
            {
              category: sampleService.category,
              clean_category: sampleService.category.replace(/\[.*?\]\s*/g, '').trim(),
              category_slug: sampleCategorySlug,
              platform: sampleService.platform,
              service_count: 1,
              min: sampleService.min,
              max: sampleService.max,
              price_range: {
                min_per_unit_vnd: sampleService.price_per_unit_vnd,
                max_per_unit_vnd: sampleService.price_per_unit_vnd,
                display_per_unit: `${roundMoney(sampleService.price_per_unit_vnd)} đ / lượt`,
              },
            },
          ],
        }),
        errorExample: prettyJson({
          success: false,
          message: 'API key không hợp lệ',
        }),
        notes: [
          'Endpoint này dùng để đối chiếu trực tiếp card trên web.',
          'display_per_unit chính là khoảng giá dạng “đ / lượt” trong ảnh mẫu.',
          'Giá min/max lấy từ tất cả service active trong category.',
        ],
      },
      {
        id: 'category',
        title: 'Lấy dịch vụ theo nhóm',
        method: 'GET',
        endpoint: `${externalBaseUrl}/category/${sampleCategorySlug}`,
        description: 'Dùng ở màn hình đặt đơn theo từng category. Endpoint trả thêm vat_percent để UI tính preview thanh toán.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'slug', description: 'Slug category trên URL path', required: true },
        ],
        requestPayloadTitle: 'Path Param',
        requestPayload: prettyJson({
          slug: sampleCategorySlug,
        }),
        requestExample: `curl '${externalBaseUrl}/category/${sampleCategorySlug}' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          category: sampleService.category,
          clean_category: sampleService.category.replace(/\[.*?\]\s*/g, '').trim(),
          platform: sampleService.platform,
          vat_percent: vatPercent,
          data: [serviceForJson(sampleService)],
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Không tìm thấy nhóm dịch vụ SMM',
        }),
        notes: [
          'Slug category dùng cùng logic slug trong web user SMM.',
          'data vẫn giữ price_per_1k_vnd là giá bán hiện tại.',
          'Nếu category bị tắt/không có service active, endpoint trả 404.',
        ],
      },
      {
        id: 'quote',
        title: 'Tính giá đơn SMM',
        method: 'POST',
        endpoint: `${externalBaseUrl}/quote`,
        description: 'Tính subtotal, VAT và tổng tiền phải trả cho một service SMM bằng đúng công thức tạo đơn trên web.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'service hoặc service_id', description: 'ID dịch vụ SMM từ endpoint services', required: true },
          { name: 'provider_id', description: 'Provider ID, optional nếu dùng provider mặc định' },
          { name: 'quantity', description: 'Số lượng cần mua', required: true },
          { name: 'comments', description: 'Danh sách comment, mỗi dòng một comment; bắt buộc cho dịch vụ comment' },
          { name: 'reaction', description: 'Optional nếu provider/service yêu cầu reaction' },
        ],
        requestPayloadTitle: 'JSON Body',
        requestPayload: prettyJson({
          service_id: sampleService.service,
          provider_id: sampleService.provider_id,
          link: 'https://www.facebook.com/example/posts/123',
          quantity: sampleQuantity,
          comments: 'Dòng 1\\nDòng 2 - chỉ dùng cho dịch vụ comment',
          reaction: 'like - optional nếu provider yêu cầu',
        }),
        requestExample: `curl --request POST '${externalBaseUrl}/quote' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '${JSON.stringify({
    service_id: sampleService.service,
    provider_id: sampleService.provider_id,
    quantity: sampleQuantity,
  })}'`,
        responseExample: prettyJson({
          success: true,
          service: serviceForJson(sampleService),
          checkout: {
            subtotal: sampleSubtotal,
            vat_amount: sampleVat,
            vat_percent: vatPercent,
            total_to_pay: sampleTotal,
            quantity: sampleQuantity,
            formula: 'ceil(quantity / 1000 * price_per_1k_vnd) + VAT',
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Số lượng không hợp lệ. Min 50 - Max 200000',
        }),
        notes: [
          'Nếu là dịch vụ comment, quantity được tính theo số dòng comments.',
          'Endpoint này không tạo đơn, chỉ tính giá để đối soát.',
          'total_to_pay đã gồm VAT.',
        ],
      },
      {
        id: 'add-order',
        title: 'Tạo đơn SMM và trừ tiền',
        method: 'POST',
        endpoint: `${externalBaseUrl}/order`,
        description: 'Tạo đơn thật trên web, trừ ví chính của user gắn với API key, gọi provider và lưu vào lịch sử SMM.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"add" nếu gọi endpoint tổng /api/external/smm' },
          { name: 'service hoặc service_id', description: 'ID dịch vụ SMM từ endpoint services', required: true },
          { name: 'link', description: 'Link/object cần chạy dịch vụ', required: true },
          { name: 'quantity', description: 'Số lượng cần mua', required: true },
          { name: 'comments', description: 'Danh sách comment, mỗi dòng một comment; bắt buộc cho dịch vụ comment' },
          { name: 'reaction', description: 'Optional nếu provider/service yêu cầu reaction' },
          { name: 'provider_id', description: 'Optional nếu cần chỉ định provider' },
        ],
        requestPayloadTitle: 'JSON Body',
        requestPayload: prettyJson({
          service: sampleService.service,
          link: 'https://www.facebook.com/example/posts/123',
          quantity: sampleQuantity,
          comments: 'Comment 1\\nComment 2 - chỉ dùng cho dịch vụ comment',
          reaction: 'like - optional',
        }),
        requestExample: `curl --request POST '${externalBaseUrl}/order' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '${JSON.stringify({
    service: sampleService.service,
    link: 'https://www.facebook.com/example/posts/123',
    quantity: sampleQuantity,
  })}'`,
        responseExample: prettyJson({
          success: true,
          message: 'Đơn SMM đã được tạo và trừ tiền ví chính',
          order: sampleOrderId,
          charge: sampleTotal,
          currency: 'VND',
          balance: 343423,
          data: {
            id: 1024,
            order: sampleOrderId,
            api_order_id: sampleOrderId,
            service: sampleService.service,
            service_name: sampleService.name,
            quantity: sampleQuantity,
            status: 'Processing',
            subtotal: sampleSubtotal,
            vat_amount: sampleVat,
            total_to_pay: sampleTotal,
            balance_after: 343423,
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Số dư ví chính không đủ. Vui lòng nạp thêm tiền vào web',
        }),
        notes: [
          'Đây là endpoint mà đối tác dùng để đấu API web anh và tạo đơn thật.',
          'Nếu provider lỗi sau khi đã giữ tiền, hệ thống tự hoàn tiền và ghi transaction refund.',
          'Có thể gọi alias /api/external/smm/add hoặc endpoint tổng với action=add.',
        ],
      },
      {
        id: 'status',
        title: 'Kiểm tra trạng thái một đơn',
        method: 'GET',
        endpoint: `${externalBaseUrl}/status?order=${sampleOrderId}`,
        description: 'Lấy trạng thái từ provider cho một đơn và đồng bộ lại order nội bộ nếu tìm thấy order trên web.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"status" nếu gọi endpoint tổng /api/external/smm' },
          { name: 'order', description: 'Mã đơn provider trả về khi tạo đơn', required: true },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          order: sampleOrderId,
        }),
        requestExample: `curl '${externalBaseUrl}/status?order=${sampleOrderId}' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          data: {
            charge: '15000',
            start_count: '120',
            status: 'Completed',
            remains: '0',
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Bạn chỉ được kiểm tra trạng thái các đơn SMM của chính mình',
        }),
        notes: [
          'User chỉ được check đơn thuộc tài khoản của mình.',
          'Admin có thể check đơn để đối soát vận hành.',
          'Payload trạng thái giữ theo provider nhưng hệ thống có normalize vào order nội bộ.',
        ],
      },
      {
        id: 'multi-status',
        title: 'Kiểm tra trạng thái nhiều đơn',
        method: 'GET',
        endpoint: `${externalBaseUrl}/status?orders=${sampleOrderId},987654322`,
        description: 'Kiểm tra nhiều mã đơn provider trong một lần gọi. Hệ thống nhóm theo provider để giảm request.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"status" nếu gọi endpoint tổng /api/external/smm' },
          { name: 'orders', description: 'Danh sách mã đơn provider, cách nhau bằng dấu phẩy, tối đa 100 mã', required: true },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          orders: `${sampleOrderId},987654322`,
          limit: 100,
        }),
        requestExample: `curl '${externalBaseUrl}/status?orders=${sampleOrderId},987654322' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          data: {
            [sampleOrderId]: {
              charge: '15000',
              start_count: '120',
              status: 'Completed',
              remains: '0',
            },
            '987654322': {
              charge: '8500',
              start_count: '400',
              status: 'Processing',
              remains: '120',
            },
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Provider chỉ cho phép tối đa 100 order mỗi lần',
        }),
        notes: [
          'Tối đa 100 mã đơn mỗi request.',
          'Nếu có order local đang chạy, hệ thống sẽ cập nhật start_count/remains/status sau khi check provider.',
          'Nên dùng endpoint này cho trang admin tracking thay vì gọi từng order.',
        ],
      },
      {
        id: 'balance',
        title: 'Kiểm tra số dư ví chính',
        method: 'GET',
        endpoint: `${externalBaseUrl}/balance`,
        description: 'Trả số dư ví chính của user gắn với API key. Đây là số dư dùng để tạo đơn SMM.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"balance" nếu gọi endpoint tổng /api/external/smm' },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          action: 'balance',
        }),
        requestExample: `curl '${externalBaseUrl}/balance' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          balance: 343423,
          currency: 'VND',
          data: {
            user_id: 1001,
            username: 'partner_user',
            balance: 343423,
            game_balance: 0,
            api_status: 'active',
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'API key không hợp lệ',
        }),
        notes: [
          'balance là ví chính users.balance, dùng cho đơn SMM.',
          'Đối tác nạp tiền vào tài khoản web rồi gọi API tạo đơn từ số dư này.',
          'Có thể gọi endpoint tổng /api/external/smm?action=balance.',
        ],
      },
      {
        id: 'my-orders',
        title: 'Lịch sử đơn SMM của user',
        method: 'GET',
        endpoint: `${externalBaseUrl}/orders?service_ids=${sampleService.service}`,
        description: 'Trả về tối đa 100 đơn SMM mới nhất của user gắn với API key, có thể lọc theo danh sách service_id.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"orders" nếu gọi endpoint tổng /api/external/smm' },
          { name: 'service_ids', description: 'Danh sách service_id cần lọc, optional' },
          { name: 'limit', description: 'Số dòng trả về, tối đa 100' },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          service_ids: `${sampleService.service},${sampleService.service + 1}`,
        }),
        requestExample: `curl '${externalBaseUrl}/orders?service_ids=${sampleService.service}' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          data: [
            {
              id: 1024,
              api_order_id: sampleOrderId,
              service_id: sampleService.service,
              service_name: sampleService.name,
              quantity: sampleQuantity,
              price: sampleSubtotal,
              status: 'Processing',
              start_count: 0,
              remains: sampleQuantity,
              created_at: '2026-06-23T06:30:00.000Z',
              updated_at: '2026-06-23T06:30:00.000Z',
            },
          ],
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Unauthorized',
        }),
        notes: [
          'Endpoint này phục vụ lịch sử trong màn đặt đơn SMM.',
          'Các đơn Processing cũ hơn 45 giây sẽ được sync trạng thái nhanh trước khi trả về.',
          'price là subtotal lưu trên order; tổng tiền trừ ví nằm ở transaction thanh toán.',
        ],
      },
    ],
  };
}
