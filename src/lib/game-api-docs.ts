export interface GameApiConnectionMethod {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
}

export interface GameApiEndpointDoc {
  id: string;
  title: string;
  method: 'GET' | 'POST';
  endpoint: string;
  description: string;
  requestPayloadTitle: string;
  requestPayload: string;
  requestExample: string;
  responseExample: string;
  errorExample: string;
  notes: string[];
}

export interface GameApiDocsContent {
  baseUrl: string;
  apiKeyPlaceholder: string;
  authNotes: string[];
  connectionMethods: GameApiConnectionMethod[];
  endpoints: GameApiEndpointDoc[];
  deployment: GameApiDeploymentGuide;
}

export interface GameApiDnsRecord {
  host: string;
  type: 'A' | 'CNAME';
  target: string;
  proxy: 'DNS only' | 'Proxied' | 'Off';
  ttl: string;
  note: string;
}

export interface GameApiDeploymentStep {
  title: string;
  description: string;
  code?: string;
  language?: string;
}

export interface GameApiDeploymentGuide {
  serverIp: string;
  bePort: number;
  apiPrefix: string;
  warnings: string[];
  dnsRecords: GameApiDnsRecord[];
  steps: GameApiDeploymentStep[];
  verification: string[];
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeBaseUrl(baseUrl: string) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

export function buildGameApiDocs(baseUrl: string): GameApiDocsContent {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const apiKeyPlaceholder = 'ttmmo_apikey_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const origin = normalizedBaseUrl.replace(/\/api\/external\/game$/i, '');
  const deployDomain = 'api.trungtammmo.vn';
  const serverIp = '160.191.237.249';
  const bePort = 4000;

  return {
    baseUrl: normalizedBaseUrl,
    apiKeyPlaceholder,
    authNotes: [
      'Mọi request phải gửi apikey theo 1 trong các cách: x-api-key, Authorization: Bearer, query apikey hoặc body apikey.',
      'Hệ thống vẫn nhận api_key/key cũ để tương thích các tool đã đấu trước đó.',
      'Tất cả lệnh mua game/random/game-market đều trừ đúng ví game của account gắn với apikey.',
      'Giá trả về là giá đang bán trên web, đã tính đúng VAT/phí đang hiển thị của hệ thống.',
      'Mỗi user có một apikey riêng và user tự xem được apikey của chính mình ở màn người dùng.',
    ],
    deployment: {
      serverIp,
      bePort,
      apiPrefix: '/api',
      warnings: [
        'Nếu trang FE đang chạy ở trungtammmo.vn thì KHÔNG nên repoint root domain về BE. Dùng subdomain api.trungtammmo.vn cho BE là đúng hơn.',
        'Chỉ mở cổng 80 và 443 public. Port 4000 nên chỉ nghe nội bộ trên server Windows.',
        'BE trong repo đang mount router tại /api và mặc định listen ở PORT=4000.',
      ],
      dnsRecords: [
        {
          host: 'api',
          type: 'A',
          target: serverIp,
          proxy: 'DNS only',
          ttl: 'Auto',
          note: `Dùng cho BE/IIS reverse proxy. Domain final sẽ là https://${deployDomain}`,
        },
        {
          host: '@',
          type: 'A',
          target: serverIp,
          proxy: 'Off',
          ttl: 'Auto',
          note: 'Chỉ đổi root domain nếu anh MUỐN cho trungtammmo.vn cùng vào BE. Nếu FE đang sống ở root thì GIỮ NGUYÊN record này.',
        },
      ],
      steps: [
        {
          title: '1. Chốt record DNS',
          description: 'Tại nhà cung cấp DNS/Cloudflare, tạo record A cho subdomain api trỏ về server Windows BE.',
          language: 'text',
          code: `api.trungtammmo.vn  ->  ${serverIp}`,
        },
        {
          title: '2. Mở firewall trên server Windows',
          description: 'Cho phép HTTP/HTTPS đi vào IIS. Port 4000 chỉ cần nội bộ nếu IIS reverse proxy local.',
          language: 'powershell',
          code: `New-NetFirewallRule -DisplayName "HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
New-NetFirewallRule -DisplayName "BE 4000 localhost" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow`,
        },
        {
          title: '3. Build và chạy BE trên port 4000',
          description: 'BE trong repo đang listen ở PORT=4000. Chạy service trước, sau đó mới reverse proxy bằng IIS.',
          language: 'powershell',
          code: `cd C:\\path\\to\\mmo\\BE
npm install
npm run build
$env:PORT=4000
npm run start

# test local
curl http://127.0.0.1:4000/api/health`,
        },
        {
          title: '4. Cài IIS + URL Rewrite + ARR',
          description: 'Cần IIS, URL Rewrite và Application Request Routing để reverse proxy domain vào Node/Express.',
          language: 'text',
          code: `Bật role: Web Server (IIS)
Cài thêm:
- URL Rewrite 2
- Application Request Routing (ARR) 3`,
        },
        {
          title: '5. Bật reverse proxy trong ARR',
          description: 'Mở IIS Manager -> server node -> Application Request Routing Cache -> Server Proxy Settings -> tick Enable proxy.',
        },
        {
          title: '6. Tạo site IIS cho api.trungtammmo.vn',
          description: 'Tạo site mới hoặc dùng Default Web Site, nhưng binding phải tách riêng theo host header.',
          language: 'text',
          code: `Site name: trungtammmo-api
Physical path: C:\\inetpub\\trungtammmo-api
HTTP binding:
- Type: http
- IP: All Unassigned
- Port: 80
- Host name: ${deployDomain}`,
        },
        {
          title: '7. Thêm rule reverse proxy về BE port 4000',
          description: 'Dùng URL Rewrite để forward tất cả request domain API về Node app đang nghe ở 127.0.0.1:4000.',
          language: 'xml',
          code: `<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToBE" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:${bePort}/{R:1}" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_HOST" value="${deployDomain}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>
    <proxy reverseRewriteHostInResponseHeaders="false" />
  </system.webServer>
</configuration>`,
        },
        {
          title: '8. Tạo SSL Let’s Encrypt bằng win-acme',
          description: 'Để nhanh và bền trên Windows IIS, dùng win-acme để cấp cert và auto renewal.',
          language: 'text',
          code: `Download win-acme (wacs) -> chạy wacs.exe với Administrator
Chọn:
N - Create certificate (full options)
1 - Single binding of an IIS site
Site: trungtammmo-api
Email: email của anh
Agree TOS
Finish

win-acme sẽ:
- xin cert Let's Encrypt
- bind SSL vào site IIS
- tạo scheduled task auto renew`,
        },
        {
          title: '9. Thêm HTTPS binding và redirect 80 -> 443',
          description: 'Sau khi có cert, site cần binding 443 dùng SNI đúng host api.trungtammmo.vn.',
          language: 'text',
          code: `HTTPS binding:
- Type: https
- IP: All Unassigned
- Port: 443
- Host name: ${deployDomain}
- Require Server Name Indication (SNI): checked
- SSL certificate: Let's Encrypt certificate của ${deployDomain}

Sau đó thêm HTTP Redirect hoặc URL Rewrite để redirect http -> https.`,
        },
        {
          title: '10. Test domain public',
          description: 'Sau khi DNS resolve xong và IIS proxy on, test health endpoint từ ngoài internet.',
          language: 'bash',
          code: `curl https://${deployDomain}/api/health

# kết quả mong đợi
{
  "success": true,
  "name": "trungtammmo-be"
}`,
        },
        {
          title: '11. Nếu muốn root domain cùng vào BE',
          description: 'Chỉ làm nếu anh muốn trungtammmo.vn phục vụ BE thay vì FE. Nếu FE đang chạy root thì bỏ qua bước này.',
          language: 'text',
          code: `Thêm thêm binding host:
- trungtammmo.vn
- www.trungtammmo.vn (nếu cần)

Nhưng cần rất cẩn thận vì sẽ ảnh hưởng FE hiện tại.`,
        },
      ],
      verification: [
        `DNS resolve: api.trungtammmo.vn -> ${serverIp}`,
        `Health local: http://127.0.0.1:${bePort}/api/health`,
        `Health public: https://${deployDomain}/api/health`,
        `Game API public: https://${deployDomain}/profile.php, /products.php, /product.php, /buy_product, /order.php`,
      ],
    },
    connectionMethods: [
      {
        id: 'curl',
        title: 'Kết nối bằng cURL',
        description: 'Hợp khi web đối tác cần test nhanh endpoint từ server, terminal hoặc Postman-import.',
        language: 'bash',
        code: `curl --request GET '${normalizedBaseUrl}/profile.php' \\
  --header 'x-api-key: ${apiKeyPlaceholder}'`,
      },
      {
        id: 'fetch',
        title: 'Kết nối bằng JavaScript fetch',
        description: 'Dùng cho Node.js, Next.js, backend service hoặc webhook worker.',
        language: 'ts',
        code: `const response = await fetch('${normalizedBaseUrl}/products.php', {
  headers: {
    'x-api-key': '${apiKeyPlaceholder}'
  }
});

const payload = await response.json();
console.log(payload);`,
      },
      {
        id: 'php',
        title: 'Kết nối bằng PHP cURL',
        description: 'Phù hợp khi web đối tác đang chạy PHP và cần tạo đơn mua game/random hoặc game market.',
        language: 'php',
        code: `$payload = 'id=RES-123&amount=1&apikey=${apiKeyPlaceholder}';

$ch = curl_init('${normalizedBaseUrl}/buy_product');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/x-www-form-urlencoded',
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$result = curl_exec($ch);
curl_close($ch);

echo $result;`,
      },
      {
        id: 'bearer',
        title: 'Kết nối bằng Authorization Bearer',
        description: 'Nếu phía đối tác đã có middle-layer auth theo chuẩn bearer, có thể dùng cách này thay cho x-api-key.',
        language: 'bash',
        code: `curl --request GET '${normalizedBaseUrl}/products.php' \\
  --header 'Authorization: Bearer ${apiKeyPlaceholder}'`,
      },
    ],
    endpoints: [
      {
        id: 'compat-profile',
        title: 'Profile.php - lấy ví game của account',
        method: 'GET',
        endpoint: `${normalizedBaseUrl}/profile.php`,
        description: 'Endpoint tương thích kiểu random1k/shopreg để bên đối tác lấy username và số dư ví game của chính account đang sở hữu apikey.',
        requestPayloadTitle: 'Dữ liệu gửi',
        requestPayload: 'Không cần body. Gửi apikey trong query/header. Có thể gọi bằng x-api-key, Authorization Bearer hoặc ?apikey=...',
        requestExample: `curl --request GET '${normalizedBaseUrl}/profile.php?apikey=${apiKeyPlaceholder}'`,
        responseExample: prettyJson({
          status: 'success',
          msg: 'Lấy thông tin tài khoản thành công',
          data: {
            username: 'partner_user',
            money: 1250000,
            game_money: 1250000,
            game_balance: 1250000,
            main_money: 50000,
            main_balance: 50000,
            wallet_type: 'game',
            email: 'partner@example.com',
            fullname: 'Partner User',
            user_id: 25,
          },
        }),
        errorExample: prettyJson({
          status: 'error',
          msg: 'apikey không hợp lệ',
        }),
        notes: [
          'Đây là route tương thích provider, nên shape trả về là status/msg/data.',
          'money, game_money và game_balance chính là ví game của account bên web anh, không phải ví hệ thống chung.',
          'main_money/main_balance chỉ là ví thường để đối chiếu, buy_product luôn dùng ví game.',
        ],
      },
      {
        id: 'compat-products',
        title: 'Products.php - lấy catalog game/random/game-market',
        method: 'GET',
        endpoint: `${normalizedBaseUrl}/products.php`,
        description: 'Catalog chính tương thích random1k/shopreg. Trả về categories có products bên trong. Bao gồm tài khoản game, random game và cả game market.',
        requestPayloadTitle: 'Dữ liệu gửi',
        requestPayload: 'Không cần body. Gọi GET và gửi apikey. Product ID của hệ thống dùng prefix: RES-123 cho tài khoản game/random, GM-789 cho game market.',
        requestExample: `curl --request GET '${normalizedBaseUrl}/products.php' \\
  --header 'x-api-key: ${apiKeyPlaceholder}'`,
        responseExample: prettyJson({
          status: 'success',
          msg: 'Lấy danh sách sản phẩm thành công',
          categories: [
            {
              id: 'resource-game',
              parent_id: null,
              name: 'Tài khoản game API',
              icon: '/assets/game-thumbnails/pubg-mobile.png',
              products: [],
            },
            {
              id: 'resource-game:pubg-mobile',
              parent_id: 'resource-game',
              name: 'PUBG Mobile',
              icon: '/assets/game-thumbnails/pubg-mobile.png',
              products: [
                {
                  id: 'RES-123',
                  name: 'Acc PUBG Mobile Premium',
                  price: 329000,
                  amount: 6,
                  description: 'Acc PUBG Mobile premium.',
                  flag: 'game-account',
                  min: 1,
                  max: 6,
                  thumbnail: 'https://trungtammmo.vn/assets/game-thumbnails/pubg-mobile.png',
                  image: 'https://trungtammmo.vn/assets/game-thumbnails/pubg-mobile.png',
                  content: 'Có mail đăng ký và thông tin đăng nhập.',
                  category_name: 'PUBG Mobile',
                  category_slug: 'pubg-mobile',
                  source_type: 'resource',
                },
              ],
            },
            {
              id: 'resource-random:lien-quan-mobile',
              parent_id: 'resource-random',
              name: 'Liên Quân Mobile',
              icon: '/assets/game-thumbnails/lien-quan-mobile.png',
              products: [
                {
                  id: 'RES-124',
                  name: 'Random Acc Lien Quan VIP',
                  price: 59000,
                  amount: 38,
                  description: 'Random acc Lien Quan API.',
                  flag: 'random-account',
                  min: 1,
                  max: 10,
                  thumbnail: 'https://trungtammmo.vn/assets/game-thumbnails/lien-quan-mobile.png',
                  image: 'https://trungtammmo.vn/assets/game-thumbnails/lien-quan-mobile.png',
                  content: 'Đăng nhập đổi mật khẩu ngay sau khi nhận acc.',
                  category_name: 'Lien Quan Mobile',
                  category_slug: 'lien-quan-mobile',
                  source_type: 'resource',
                },
              ],
            },
            {
              id: 'game-market:valorant',
              parent_id: 'game-market',
              name: 'Valorant',
              icon: 'https://trungtammmo.vn/assets/uploads/game-market/valorant-main.jpg',
              products: [
                {
                  id: 'GM-789',
                  name: 'Nick Valorant Ascendant Full Mail',
                  price: 1500000,
                  amount: 1,
                  description: 'Tài khoản rank cao, đã verify mail, có skin premium.',
                  flag: 'game-market',
                  min: 1,
                  max: 1,
                  thumbnail: 'https://trungtammmo.vn/assets/uploads/game-market/valorant-main.jpg',
                  image: 'https://trungtammmo.vn/assets/uploads/game-market/valorant-main.jpg',
                  content: 'Ascendant 2\\n12 premium skins\\nServer AP, da co sdt backup',
                  category_name: 'Valorant',
                  category_slug: 'valorant',
                  source_type: 'market',
                },
              ],
            },
          ],
          source: {
            vat_percent: 8,
            resource_total: 2,
            market_total: 1,
          },
        }),
        errorExample: prettyJson({
          status: 'error',
          msg: 'Thiếu apikey',
        }),
        notes: [
          'ID product có prefix để bên đấu API phân biệt rõ resource/game-market.',
          'Bên đối tác có thể dùng ngay shape categories/products giống provider để map ít code nhất.',
        ],
      },
      {
        id: 'compat-product',
        title: 'Product.php - lấy chi tiết 1 sản phẩm',
        method: 'GET',
        endpoint: `${normalizedBaseUrl}/product.php`,
        description: 'Lấy 1 product theo đúng ID đang thấy trong products.php. Hỗ trợ cả RES-* và GM-*.',
        requestPayloadTitle: 'Dữ liệu gửi',
        requestPayload: 'Query param: product=RES-123 hoặc product=GM-789',
        requestExample: `curl --request GET '${normalizedBaseUrl}/product.php?product=GM-789' \\
  --header 'x-api-key: ${apiKeyPlaceholder}'`,
        responseExample: prettyJson({
          status: 'success',
          msg: 'Lấy chi tiết sản phẩm thành công',
          product: [
            {
              id: 'GM-789',
              name: 'Nick Valorant Ascendant Full Mail',
              price: 1500000,
              amount: 1,
              description: 'Tài khoản rank cao, đã verify mail, có skin premium.',
              flag: 'game-market',
              min: 1,
              max: 1,
              thumbnail: 'https://trungtammmo.vn/assets/uploads/game-market/valorant-main.jpg',
              image: 'https://trungtammmo.vn/assets/uploads/game-market/valorant-main.jpg',
              content: 'Server AP, da co sdt backup',
              category_name: 'Valorant',
              category_slug: 'valorant',
              source_type: 'market',
            },
          ],
        }),
        errorExample: prettyJson({
          status: 'error',
          msg: 'ID sản phẩm không hợp lệ',
        }),
        notes: [
          'Shape product bám theo provider: product là array 1 phần tử.',
          'Nếu đã có product ID từ products.php thì có thể gọi product.php để đồng bộ nội dung chi tiết trước khi mua.',
        ],
      },
      {
        id: 'compat-buy-product',
        title: 'Buy_product - mua acc game hoặc game market',
        method: 'POST',
        endpoint: `${normalizedBaseUrl}/buy_product`,
        description: 'Endpoint mua hàng tương thích provider. Nếu ID là RES-* thì mua tài khoản game/random. Nếu ID là GM-* thì mua game market bằng chính ví game của account đang giữ apikey.',
        requestPayloadTitle: 'Dữ liệu gửi',
        requestPayload: `POST application/x-www-form-urlencoded

id=RES-123
amount=1
apikey=${apiKeyPlaceholder}

Hoặc:
id=GM-789
amount=1
apikey=${apiKeyPlaceholder}`,
        requestExample: `curl --request POST '${normalizedBaseUrl}/buy_product' \\
  --header 'Content-Type: application/x-www-form-urlencoded' \\
  --data 'id=RES-123&amount=1&apikey=${apiKeyPlaceholder}'`,
        responseExample: prettyJson({
          status: 'success',
          msg: 'Lấy trạng thái đơn thành công',
          trans_id: 'RES-456',
          order_status: 'completed',
          data: [
            'Provider: Auto API',
            'Trans ID: R1K-20260511-0099',
            'login: demo@example.com',
            'password: pass123',
          ],
          file: '',
          content: 'Provider: Auto API\\nTrans ID: R1K-20260511-0099\\nlogin: demo@example.com\\npassword: pass123',
          source_type: 'resource',
          product: {
            id: 123,
            product_code: 'TN00123',
            title: 'Acc PUBG Mobile Premium',
            thumbnail: 'https://trungtammmo.vn/assets/game-thumbnails/pubg-mobile.png',
          },
          quantity: 1,
          total_price: 329000,
          created_at: '2026-05-11T09:20:00.000Z',
          updated_at: '2026-05-11T09:20:01.000Z',
        }),
        errorExample: prettyJson({
          status: 'error',
          msg: 'Ví game không đủ. Vui lòng nạp thêm 129000đ để mua sản phẩm này.',
        }),
        notes: [
          'trans_id là ID để bên đối tác poll tiếp qua order.php.',
          'data/content/file được trả theo kiểu provider để tương thích tốt hơn với random1k/shopreg.',
          'Nếu là game market thì amount chỉ hỗ trợ 1 mỗi lần gọi.',
        ],
      },
      {
        id: 'compat-order',
        title: 'Order.php - poll trạng thái và dữ liệu bàn giao',
        method: 'GET',
        endpoint: `${normalizedBaseUrl}/order.php`,
        description: 'Poll trạng thái đơn sau khi mua. Hỗ trợ cả RES-* và GM-*; nếu có file hoặc nội dung bàn giao thì trả ngay trong response.',
        requestPayloadTitle: 'Dữ liệu gửi',
        requestPayload: 'Query param: order=RES-456 hoặc order=GM-999',
        requestExample: `curl --request GET '${normalizedBaseUrl}/order.php?order=GM-999' \\
  --header 'x-api-key: ${apiKeyPlaceholder}'`,
        responseExample: prettyJson({
          status: 'success',
          msg: 'Lấy trạng thái đơn thành công',
          trans_id: 'GM-999',
          order_status: 'completed',
          data: [
            'login: valorant@example.com',
            'password: pass123',
            'mail: full-access',
          ],
          file: '',
          content: 'login: valorant@example.com\\npassword: pass123\\nmail: full-access',
          source_type: 'game-market',
          product: {
            id: 789,
            code: 'GM1715499999',
            title: 'Nick Valorant Ascendant Full Mail',
            category: 'valorant',
            category_name: 'Valorant',
            thumbnail: 'https://trungtammmo.vn/assets/uploads/game-market/valorant-main.jpg',
            delivery_method: 'manual',
          },
          amount: 1500000,
          created_at: '2026-05-11T10:05:00.000Z',
        }),
        errorExample: prettyJson({
          status: 'error',
          msg: 'ID đơn hàng không hợp lệ',
        }),
        notes: [
          'Nếu đơn là RES-* thì sẽ trả data/file/content theo luồng tài khoản game/random.',
          'Nếu đơn là GM-* thì sẽ trả data/file/content theo luồng bàn giao game market.',
          'order_status là trạng thái thật của đơn trên web anh: pending/processing/completed/failed/refunded...',
        ],
      },
    ],
  };
}
