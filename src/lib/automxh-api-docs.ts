import type { AutoMxhCatalogSection, AutoMxhProductWithVariants, AutoMxhVariant } from '@/lib/automxh';

export interface AutoMxhDocsCatalogSection {
  category: AutoMxhCatalogSection['category'];
  products: AutoMxhProductWithVariants[];
}

export interface AutoMxhApiConnectionMethod {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
}

export interface AutoMxhApiEndpointDoc {
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

export interface AutoMxhApiDocsRuntimeMeta {
  vatPercent?: number;
}

export interface AutoMxhApiDocsService {
  id: number;
  variant_id: number;
  product_id: number;
  category_id: number;
  category_name: string;
  category_slug: string;
  product_name: string;
  name: string;
  type: string;
  badge: string;
  quantity: number;
  price: number;
  vat_amount: number;
  total_to_pay: number;
  cost: number;
  original_price: number;
  api_provider_id: number;
  api_service_id: string;
  allow_avatar: boolean;
  allow_files: boolean;
  description: string;
}

export interface AutoMxhApiDocsContent {
  baseUrl: string;
  authNotes: string[];
  priceNotes: string[];
  connectionMethods: AutoMxhApiConnectionMethod[];
  endpoints: AutoMxhApiEndpointDoc[];
  services: AutoMxhApiDocsService[];
  summary: {
    totalCategories: number;
    totalProducts: number;
    totalServices: number;
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
  return Math.round(Number(value || 0) * 100) / 100;
}

function calcVat(price: number, vatPercent: number) {
  return Math.round((Number(price || 0) * Number(vatPercent || 0)) / 100);
}

function variantForJson(service: AutoMxhApiDocsService) {
  return {
    id: service.id,
    variant_id: service.variant_id,
    product_id: service.product_id,
    category: {
      id: service.category_id,
      name: service.category_name,
      slug: service.category_slug,
    },
    product_name: service.product_name,
    name: service.name,
    type: service.type,
    badge: service.badge,
    quantity: service.quantity,
    price: service.price,
    vat_amount: service.vat_amount,
    total_to_pay: service.total_to_pay,
    currency: 'VND',
    api_provider_id: service.api_provider_id,
    api_service_id: service.api_service_id,
    allow_avatar: service.allow_avatar,
    allow_files: service.allow_files,
    description: service.description,
  };
}

function normalizeDocsService(
  section: AutoMxhDocsCatalogSection,
  product: AutoMxhProductWithVariants,
  variant: AutoMxhVariant,
  vatPercent: number
): AutoMxhApiDocsService {
  const price = roundMoney(Number(variant.price || 0));
  const vatAmount = calcVat(price, vatPercent);

  return {
    id: Number(variant.id || 0),
    variant_id: Number(variant.id || 0),
    product_id: Number(product.id || 0),
    category_id: Number(section.category.id || 0),
    category_name: section.category.name || '',
    category_slug: section.category.slug || '',
    product_name: product.name || '',
    name: variant.name || '',
    type: variant.type || '',
    badge: variant.badge || '',
    quantity: Math.max(1, Math.trunc(Number(variant.quantity || 1))),
    price,
    vat_amount: vatAmount,
    total_to_pay: roundMoney(price + vatAmount),
    cost: roundMoney(Number(variant.cost || 0)),
    original_price: roundMoney(Number(variant.original_price || 0)),
    api_provider_id: Math.max(0, Math.trunc(Number(variant.api_provider_id || 0))),
    api_service_id: String(variant.api_service_id || ''),
    allow_avatar: Boolean(variant.allow_avatar),
    allow_files: Boolean(variant.allow_files),
    description: variant.description || product.description || '',
  };
}

export function buildAutoMxhApiDocs(
  baseUrl: string,
  sectionsInput: AutoMxhDocsCatalogSection[] = [],
  runtimeMeta: AutoMxhApiDocsRuntimeMeta = {}
): AutoMxhApiDocsContent {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const externalBaseUrl = `${normalizedBaseUrl}/api/external/automxh`;
  const vatPercent = Number.isFinite(runtimeMeta.vatPercent) ? Number(runtimeMeta.vatPercent) : 0;
  const products = sectionsInput.flatMap((section) => section.products);
  const services = sectionsInput.flatMap((section) =>
    section.products.flatMap((product) =>
      product.variants.map((variant) => normalizeDocsService(section, product, variant, vatPercent))
    )
  );
  const sampleService =
    services.find((service) => service.price > 0) ||
    services[0] ||
    {
      id: 1001,
      variant_id: 1001,
      product_id: 101,
      category_id: 1,
      category_name: 'Facebook',
      category_slug: 'facebook',
      product_name: 'Tăng like bài viết',
      name: 'Server tốc độ cao',
      type: 'Default',
      badge: 'HOT',
      quantity: 1000,
      price: 15000,
      vat_amount: calcVat(15000, vatPercent),
      total_to_pay: 15000 + calcVat(15000, vatPercent),
      cost: 10000,
      original_price: 0,
      api_provider_id: 12,
      api_service_id: '1234',
      allow_avatar: false,
      allow_files: false,
      description: 'Dịch vụ Auto MXH mẫu',
    };
  const sampleOrderId = 987654321;

  return {
    baseUrl: normalizedBaseUrl,
    authNotes: [
      'External AutoMXH API bắt buộc gửi API key do admin cấp theo 1 trong 3 cách: x-api-key, Authorization: Bearer, hoặc query api_key/key.',
      'API key dùng chung hệ cấp key với Game API/SMM để admin quản lý tập trung theo từng user.',
      'API tạo đơn AutoMXH sẽ trừ ví chính users.balance của user gắn với API key, không trừ game_balance.',
      'User thường chỉ xem và kiểm tra được đơn AutoMXH của chính mình; admin được kiểm tra để vận hành.',
      'Endpoint services trả đúng các gói variant đang active trên web, kèm product/category để đối tác map giao diện dễ hơn.',
    ],
    priceNotes: [
      'AutoMXH dùng giá theo gói variant cố định, không nhập quantity tự do như SMM.',
      `Khi tạo đơn, hệ thống tính subtotal = variant.price, sau đó cộng VAT ${vatPercent}%.`,
      'Endpoint quote chỉ tính giá; endpoint order/add mới tạo đơn thật và trừ tiền ví chính.',
      'Nếu variant có api_provider_id và api_service_id, hệ thống sẽ đẩy đơn sang provider sau khi giữ tiền.',
      'Nếu provider lỗi sau khi tạo đơn nội bộ, đơn vẫn lưu trên web để admin xử lý thủ công.',
    ],
    summary: {
      totalCategories: sectionsInput.length,
      totalProducts: products.length,
      totalServices: services.length,
      vatPercent,
    },
    services,
    connectionMethods: [
      {
        id: 'services',
        title: 'Lấy bảng giá AutoMXH bằng fetch',
        description: 'Dùng cho đối tác hoặc tool nội bộ cần lấy toàn bộ gói AutoMXH đang bán bằng API key.',
        language: 'ts',
        code: `const response = await fetch('${externalBaseUrl}/services', {
  cache: 'no-store',
  headers: {
    'x-api-key': 'ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  }
});

const payload = await response.json();
console.log(payload.data[0].total_to_pay);`,
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
    variant_id: ${sampleService.variant_id},
    product_id: ${sampleService.product_id}
  })
});

const payload = await response.json();
console.log(payload.checkout.total_to_pay);`,
      },
      {
        id: 'add-order',
        title: 'Tạo đơn và trừ tiền ví chính',
        description: 'Dùng cho đối tác đấu API web: user nạp tiền vào web, gọi API tạo đơn, hệ thống trừ ví chính rồi xử lý provider.',
        language: 'bash',
        code: `curl --request POST '${externalBaseUrl}/order' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '${JSON.stringify({
    variant_id: sampleService.variant_id,
    product_id: sampleService.product_id,
    link: 'https://www.facebook.com/example/posts/123',
  })}'`,
      },
      {
        id: 'curl-status',
        title: 'Kiểm tra trạng thái bằng cURL',
        description: 'Dùng để check trạng thái một đơn AutoMXH đã tạo trên web.',
        language: 'bash',
        code: `curl '${externalBaseUrl}/status?order=${sampleOrderId}' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
      },
      {
        id: 'deposit',
        title: 'Nạp tiền nguồn bằng API key',
        description: 'Dùng cho web con hoặc webhook ngân hàng cần cộng tiền vào tài khoản đang sở hữu API key trước khi tạo đơn.',
        language: 'bash',
        code: `curl --request POST '${externalBaseUrl}/deposit' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '${JSON.stringify({
    amount: 100000,
    external_ref: 'BANK_TXN_001',
    note: 'Nap tien tu web con',
  })}'`,
      },
    ],
    endpoints: [
      {
        id: 'services',
        title: 'Lấy danh sách gói AutoMXH và giá web',
        method: 'GET',
        endpoint: `${externalBaseUrl}/services`,
        description: 'Trả về toàn bộ variant AutoMXH đang active, kèm product/category, giá bán, VAT preview và mapping provider nếu có.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"services" nếu gọi endpoint tổng /api/external/automxh' },
          { name: 'category', description: 'Slug category cần lọc, ví dụ facebook' },
          { name: 'search', description: 'Từ khóa tìm trong tên gói/product/category' },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          category: `${sampleService.category_slug} - optional`,
          search: 'keyword - optional',
        }),
        requestExample: `curl '${externalBaseUrl}/services?category=${sampleService.category_slug}' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          summary: {
            total_services: services.length,
            total_categories: sectionsInput.length,
          },
          data: services.slice(0, 2).map(variantForJson),
        }),
        errorExample: prettyJson({
          success: false,
          message: 'API key không hợp lệ',
        }),
        notes: [
          'Đây là endpoint chính để lấy giá AutoMXH hiện tại.',
          'variant_id có thể truyền bằng field service khi tích hợp theo kiểu SMM panel.',
          'total_to_pay trong docs/bảng là preview đã gồm VAT; endpoint response live giữ price gốc và checkout nằm ở quote/order.',
        ],
      },
      {
        id: 'catalog',
        title: 'Lấy catalog category/product',
        method: 'GET',
        endpoint: `${externalBaseUrl}/catalog`,
        description: 'Trả về cấu trúc category và product như màn hình AutoMXH trên web.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"catalog" nếu gọi endpoint tổng /api/external/automxh' },
          { name: 'search', description: 'Từ khóa tìm trong product/category' },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          search: 'facebook - optional',
        }),
        requestExample: `curl '${externalBaseUrl}/catalog?search=facebook' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          summary: {
            total_categories: sectionsInput.length,
            total_products: products.length,
          },
          data: sectionsInput.slice(0, 1).map((section) => ({
            category: section.category,
            products: section.products.slice(0, 2).map((product) => ({
              id: product.id,
              product_id: product.id,
              name: product.name,
              min_price: product.min_price,
              variant_count: product.variants.length,
            })),
          })),
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Không thể tải catalog AutoMXH',
        }),
        notes: [
          'Dùng catalog khi muốn dựng menu/tab giống web.',
          'Muốn lấy đủ variant trong một category thì dùng endpoint category/{slug}.',
          'Product bị tắt hoặc xóa mềm sẽ không trả về.',
        ],
      },
      {
        id: 'category',
        title: 'Lấy product và variant theo nhóm',
        method: 'GET',
        endpoint: `${externalBaseUrl}/category/${sampleService.category_slug}`,
        description: 'Trả về product trong một category kèm toàn bộ variant/gói con đang active.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'slug', description: 'Slug category trên URL path', required: true },
        ],
        requestPayloadTitle: 'Path Param',
        requestPayload: prettyJson({
          slug: sampleService.category_slug,
        }),
        requestExample: `curl '${externalBaseUrl}/category/${sampleService.category_slug}' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          category: {
            id: sampleService.category_id,
            name: sampleService.category_name,
            slug: sampleService.category_slug,
          },
          summary: {
            total_products: products.length,
            total_variants: services.length,
          },
          data: [
            {
              id: sampleService.product_id,
              product_id: sampleService.product_id,
              name: sampleService.product_name,
              variants: [variantForJson(sampleService)],
            },
          ],
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Không tìm thấy nhóm dịch vụ Auto MXH',
        }),
        notes: [
          'Endpoint này phù hợp để render màn hình đặt đơn theo từng category.',
          'inputs trong product cho biết ô nhập phụ nếu product có cấu hình.',
          'variant_id là mã cần dùng cho quote/order.',
        ],
      },
      {
        id: 'quote',
        title: 'Tính giá đơn AutoMXH',
        method: 'POST',
        endpoint: `${externalBaseUrl}/quote`,
        description: 'Tính subtotal, VAT và tổng tiền phải trả cho một gói AutoMXH bằng đúng công thức tạo đơn trên web.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'variant_id hoặc variant', description: 'ID gói/variant từ endpoint services', required: true },
          { name: 'product_id', description: 'Optional, dùng để khóa variant đúng product' },
        ],
        requestPayloadTitle: 'JSON Body',
        requestPayload: prettyJson({
          variant_id: sampleService.variant_id,
          product_id: sampleService.product_id,
        }),
        requestExample: `curl --request POST '${externalBaseUrl}/quote' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '${JSON.stringify({
    variant_id: sampleService.variant_id,
    product_id: sampleService.product_id,
  })}'`,
        responseExample: prettyJson({
          success: true,
          service: variantForJson(sampleService),
          checkout: {
            quantity: sampleService.quantity,
            subtotal: sampleService.price,
            vat_amount: sampleService.vat_amount,
            vat_percent: vatPercent,
            total_to_pay: sampleService.total_to_pay,
            formula: 'variant.price + VAT',
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Thiếu variant_id',
        }),
        notes: [
          'Endpoint này không tạo đơn, chỉ tính giá để đối soát.',
          'AutoMXH không nhận quantity tự do; quantity là thông tin của gói.',
          'total_to_pay đã gồm VAT.',
        ],
      },
      {
        id: 'add-order',
        title: 'Tạo đơn AutoMXH và trừ tiền',
        method: 'POST',
        endpoint: `${externalBaseUrl}/order`,
        description: 'Tạo đơn thật trên web, trừ ví chính của user gắn với API key, sau đó đẩy provider nếu gói đã map API.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"add" nếu gọi endpoint tổng /api/external/automxh' },
          { name: 'variant_id hoặc service', description: 'ID gói/variant từ endpoint services', required: true },
          { name: 'product_id', description: 'Optional, dùng để khóa variant đúng product' },
          { name: 'link', description: 'Link/object cần chạy dịch vụ', required: true },
          { name: 'buyer_info', description: 'Thông tin liên hệ nếu product yêu cầu' },
          { name: 'custom_value', description: 'Nội dung nhập phụ nếu product yêu cầu' },
        ],
        requestPayloadTitle: 'JSON Body',
        requestPayload: prettyJson({
          service: sampleService.variant_id,
          product_id: sampleService.product_id,
          link: 'https://www.facebook.com/example/posts/123',
          buyer_info: 'Zalo/Telegram - optional',
          custom_value: 'Ghi chú / username - optional',
        }),
        requestExample: `curl --request POST '${externalBaseUrl}/order' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '${JSON.stringify({
    service: sampleService.variant_id,
    product_id: sampleService.product_id,
    link: 'https://www.facebook.com/example/posts/123',
  })}'`,
        responseExample: prettyJson({
          success: true,
          message: 'Đơn Auto MXH đã được tạo và trừ tiền ví chính',
          order: sampleOrderId,
          provider_order: '123456789',
          charge: sampleService.total_to_pay,
          currency: 'VND',
          balance: 343423,
          data: {
            id: sampleOrderId,
            order: sampleOrderId,
            api_order_id: '123456789',
            product_id: sampleService.product_id,
            variant_id: sampleService.variant_id,
            variant_name: sampleService.name,
            quantity: sampleService.quantity,
            status: 'processing',
            subtotal: sampleService.price,
            vat_amount: sampleService.vat_amount,
            total_to_pay: sampleService.total_to_pay,
            balance_after: 343423,
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Số dư ví chính không đủ. Vui lòng nạp thêm tiền vào web',
        }),
        notes: [
          'Đây là endpoint để đối tác đấu API web anh và tạo đơn thật.',
          'Có thể gọi alias /api/external/automxh/add hoặc endpoint tổng với action=add.',
          'Nếu gói chưa map provider, đơn vẫn tạo ở trạng thái pending để admin xử lý.',
        ],
      },
      {
        id: 'status',
        title: 'Kiểm tra trạng thái một đơn',
        method: 'GET',
        endpoint: `${externalBaseUrl}/status?order=${sampleOrderId}`,
        description: 'Lấy trạng thái một đơn AutoMXH. Nếu đơn có provider order id, hệ thống có thể đồng bộ trạng thái provider về đơn nội bộ.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"status" nếu gọi endpoint tổng /api/external/automxh' },
          { name: 'order hoặc id', description: 'ID đơn AutoMXH trên web', required: true },
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
            id: sampleOrderId,
            status: 'processing',
            provider_order: '123456789',
            provider_status: {
              status: 'Processing',
              remains: '120',
            },
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Bạn chỉ được kiểm tra trạng thái các đơn Auto MXH của chính mình',
        }),
        notes: [
          'User chỉ được check đơn thuộc tài khoản của mình.',
          'Admin có thể check đơn để đối soát vận hành.',
          'order ở đây là ID đơn nội bộ AutoMXH, không phải service id.',
        ],
      },
      {
        id: 'orders',
        title: 'Lấy lịch sử đơn AutoMXH',
        method: 'GET',
        endpoint: `${externalBaseUrl}/orders`,
        description: 'Trả về các đơn AutoMXH gần nhất của user gắn với API key.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'limit', description: 'Số dòng cần lấy, tối đa 100' },
          { name: 'product_ids', description: 'Lọc theo product_id, cách nhau bằng dấu phẩy' },
        ],
        requestPayloadTitle: 'Query Params',
        requestPayload: prettyJson({
          limit: 50,
          product_ids: `${sampleService.product_id} - optional`,
        }),
        requestExample: `curl '${externalBaseUrl}/orders?limit=20' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'`,
        responseExample: prettyJson({
          success: true,
          data: [
            {
              id: sampleOrderId,
              product_id: sampleService.product_id,
              variant_id: sampleService.variant_id,
              api_order_id: '123456789',
              price: sampleService.total_to_pay,
              order_status: 'processing',
              product_name: sampleService.product_name,
              variant_name: sampleService.name,
              created_at: '2026-06-23T08:00:00.000Z',
            },
          ],
        }),
        errorExample: prettyJson({
          success: false,
          message: 'API key không hợp lệ',
        }),
        notes: [
          'Endpoint này phục vụ tool/đối tác xem lịch sử đơn của chính API key.',
          'Dữ liệu trả về đã giải mã buyer_info/custom_value nếu có.',
          'Nên dùng status để đồng bộ provider cho từng đơn quan trọng.',
        ],
      },
      {
        id: 'balance',
        title: 'Kiểm tra số dư ví chính',
        method: 'GET',
        endpoint: `${externalBaseUrl}/balance`,
        description: 'Trả số dư ví chính của user gắn với API key. Đây là số dư dùng để tạo đơn AutoMXH.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"balance" nếu gọi endpoint tổng /api/external/automxh' },
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
          'Số dư này là users.balance.',
          'Nếu tạo đơn thiếu tiền, endpoint order trả lỗi và không tạo đơn.',
          'Có thể gọi endpoint tổng /api/external/automxh?action=balance.',
        ],
      },
      {
        id: 'deposit',
        title: 'Nạp tiền vào ví nguồn API key',
        method: 'POST',
        endpoint: `${externalBaseUrl}/deposit`,
        description: 'Cộng tiền vào ví chính của user đang sở hữu API key. SMM và AutoMXH dùng chung ví chính này.',
        parameters: [
          { name: 'x-api-key / key / api_key', description: 'API key do admin cấp', required: true },
          { name: 'action', description: '"deposit" nếu gọi endpoint tổng /api/external/automxh' },
          { name: 'amount', description: 'Số tiền VND cần cộng vào ví nguồn', required: true },
          { name: 'external_ref', description: 'Mã giao dịch bên ngoài để chống cộng trùng' },
          { name: 'note', description: 'Ghi chú đối soát' },
        ],
        requestPayloadTitle: 'JSON Body',
        requestPayload: prettyJson({
          amount: 100000,
          external_ref: 'BANK_TXN_001',
          note: 'Nap tien tu web con',
        }),
        requestExample: `curl --request POST '${externalBaseUrl}/deposit' \\
  --header 'x-api-key: ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  --header 'Content-Type: application/json' \\
  --data '${JSON.stringify({
    amount: 100000,
    external_ref: 'BANK_TXN_001',
    note: 'Nap tien tu web con',
  })}'`,
        responseExample: prettyJson({
          success: true,
          message: 'Đã nạp tiền vào tài khoản nguồn API key',
          amount: 100000,
          balance: 443423,
          currency: 'VND',
          transaction_id: 12345,
          external_ref: 'BANK_TXN_001',
          already_processed: false,
          data: {
            user_id: 1001,
            username: 'partner_user',
            amount: 100000,
            balance_after: 443423,
            transaction_id: 12345,
          },
        }),
        errorExample: prettyJson({
          success: false,
          message: 'Thiếu amount hoặc amount không hợp lệ',
        }),
        notes: [
          'Endpoint này cộng users.balance của tài khoản gắn với API key.',
          'external_ref nên là mã giao dịch ngân hàng/webhook; nếu gửi lại cùng mã, hệ thống trả already_processed để tránh cộng trùng.',
          'Có thể gọi endpoint tổng /api/external/automxh với action=deposit.',
        ],
      },
    ],
  };
}
