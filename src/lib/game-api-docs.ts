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
  const apiKeyPlaceholder = 'ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const origin = normalizedBaseUrl.replace(/\/api\/external\/game$/i, '');
  const deployDomain = 'api.trungtammmo.vn';
  const serverIp = '160.191.237.249';
  const bePort = 4000;

  return {
    baseUrl: normalizedBaseUrl,
    apiKeyPlaceholder,
    authNotes: [
      'Moi request phai gui API key theo 1 trong 3 cach: x-api-key, Authorization: Bearer, hoac query api_key.',
      'Tat ca lenh mua game/random/game-market deu tru dung vi game cua account gan voi API key.',
      'Gia tra ve la gia dang ban tren web, da tinh dung VAT/phi dang hien thi cua he thong.',
      'Tai lieu nay chi hien thi trong admin; API key khong xuat hien o khu vuc public.',
    ],
    deployment: {
      serverIp,
      bePort,
      apiPrefix: '/api',
      warnings: [
        'Neu trang FE dang chay o trungtammmo.vn thi KHONG nen repoint root domain ve BE. Dung subdomain api.trungtammmo.vn cho BE la dung hon.',
        'Chi mo cong 80 va 443 public. Port 4000 nen chi nghe noi bo tren server Windows.',
        'BE trong repo dang mount router tai /api va default listen o PORT=4000.',
      ],
      dnsRecords: [
        {
          host: 'api',
          type: 'A',
          target: serverIp,
          proxy: 'DNS only',
          ttl: 'Auto',
          note: `Dung cho BE/IIS reverse proxy. Domain final se la https://${deployDomain}`,
        },
        {
          host: '@',
          type: 'A',
          target: serverIp,
          proxy: 'Off',
          ttl: 'Auto',
          note: 'Chi doi root domain neu anh MUON cho trungtammmo.vn cung vao BE. Neu FE dang song o root thi GIU NGUYEN record nay.',
        },
      ],
      steps: [
        {
          title: '1. Chot record DNS',
          description: 'Tai nha cung cap DNS/Cloudflare, tao record A cho subdomain api tro ve server Windows BE.',
          language: 'text',
          code: `api.trungtammmo.vn  ->  ${serverIp}`,
        },
        {
          title: '2. Mo firewall tren server Windows',
          description: 'Cho phep HTTP/HTTPS di vao IIS. Port 4000 chi can noi bo neu IIS reverse proxy local.',
          language: 'powershell',
          code: `New-NetFirewallRule -DisplayName "HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
New-NetFirewallRule -DisplayName "BE 4000 localhost" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow`,
        },
        {
          title: '3. Build va chay BE tren port 4000',
          description: 'BE trong repo dang listen o PORT=4000. Chay service truoc, sau do moi reverse proxy bang IIS.',
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
          title: '4. Cai IIS + URL Rewrite + ARR',
          description: 'Can IIS, URL Rewrite va Application Request Routing de reverse proxy domain vao Node/Express.',
          language: 'text',
          code: `Bat role: Web Server (IIS)
Cai them:
- URL Rewrite 2
- Application Request Routing (ARR) 3`,
        },
        {
          title: '5. Bat reverse proxy trong ARR',
          description: 'Mo IIS Manager -> server node -> Application Request Routing Cache -> Server Proxy Settings -> tick Enable proxy.',
        },
        {
          title: '6. Tao site IIS cho api.trungtammmo.vn',
          description: 'Tao site moi hoac dung Default Web Site, nhung binding phai tach rieng theo host header.',
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
          title: '7. Them rule reverse proxy ve BE port 4000',
          description: 'Dung URL Rewrite de forward tat ca request domain API ve Node app dang nghe o 127.0.0.1:4000.',
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
          title: '8. Tao SSL Lets Encrypt bang win-acme',
          description: 'De nhanh va ben tren Windows IIS, dung win-acme de cap cert va auto renewal.',
          language: 'text',
          code: `Download win-acme (wacs) -> chay wacs.exe voi Administrator
Chon:
N - Create certificate (full options)
1 - Single binding of an IIS site
Site: trungtammmo-api
Email: email cua anh
Agree TOS
Finish

win-acme se:
- xin cert Let's Encrypt
- bind SSL vao site IIS
- tao scheduled task auto renew`,
        },
        {
          title: '9. Them HTTPS binding va redirect 80 -> 443',
          description: 'Sau khi co cert, site can binding 443 dung SNI dung host api.trungtammmo.vn.',
          language: 'text',
          code: `HTTPS binding:
- Type: https
- IP: All Unassigned
- Port: 443
- Host name: ${deployDomain}
- Require Server Name Indication (SNI): checked
- SSL certificate: Let's Encrypt certificate cua ${deployDomain}

Sau do them HTTP Redirect hoac URL Rewrite de redirect http -> https.`,
        },
        {
          title: '10. Test domain public',
          description: 'Sau khi DNS resolve xong va IIS proxy on, test health endpoint tu ngoai internet.',
          language: 'bash',
          code: `curl https://${deployDomain}/api/health

# ket qua mong doi
{
  "success": true,
  "name": "trungtammmo-be"
}`,
        },
        {
          title: '11. Neu muon root domain cung vao BE',
          description: 'Chi lam neu anh muon trungtammmo.vn phuc vu BE thay vi FE. Neu FE dang chay root thi bo qua buoc nay.',
          language: 'text',
          code: `Them them binding host:
- trungtammmo.vn
- www.trungtammmo.vn (neu can)

Nhung can rat can than vi se anh huong FE hien tai.`,
        },
      ],
      verification: [
        `DNS resolve: api.trungtammmo.vn -> ${serverIp}`,
        `Health local: http://127.0.0.1:${bePort}/api/health`,
        `Health public: https://${deployDomain}/api/health`,
        `Game API public: ${origin}/api/external/game/account (FE docs) va https://${deployDomain}/api/health (BE service)`,
      ],
    },
    connectionMethods: [
      {
        id: 'curl',
        title: 'Ket noi bang cURL',
        description: 'Hop khi web doi tac can test nhanh endpoint tu server, terminal hoac Postman-import.',
        language: 'bash',
        code: `curl --request GET '${normalizedBaseUrl}/account' \\
  --header 'x-api-key: ${apiKeyPlaceholder}'`,
      },
      {
        id: 'fetch',
        title: 'Ket noi bang JavaScript fetch',
        description: 'Dung cho Node.js, Next.js, backend service hoac webhook worker.',
        language: 'ts',
        code: `const response = await fetch('${normalizedBaseUrl}/resources?collection=game-accounts&page=1&per_page=20', {
  headers: {
    'x-api-key': '${apiKeyPlaceholder}'
  }
});

const payload = await response.json();
console.log(payload);`,
      },
      {
        id: 'php',
        title: 'Ket noi bang PHP cURL',
        description: 'Phu hop khi web doi tac dang chay PHP va can tao don mua game/random.',
        language: 'php',
        code: `$payload = json_encode([
  'resource_id' => 123,
  'quantity' => 1,
]);

$ch = curl_init('${normalizedBaseUrl}/resources');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/json',
  'x-api-key: ${apiKeyPlaceholder}',
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$result = curl_exec($ch);
curl_close($ch);

echo $result;`,
      },
      {
        id: 'bearer',
        title: 'Ket noi bang Authorization Bearer',
        description: 'Neu phia doi tac da co middle-layer auth theo chuan bearer, co the dung cach nay thay cho x-api-key.',
        language: 'bash',
        code: `curl --request GET '${normalizedBaseUrl}/market?page=1&per_page=10' \\
  --header 'Authorization: Bearer ${apiKeyPlaceholder}'`,
      },
    ],
    endpoints: [
      {
        id: 'compat-profile',
        title: 'Profile.php - lấy ví game của account',
        method: 'GET',
        endpoint: `${normalizedBaseUrl}/profile.php`,
        description: 'Endpoint tương thích kiểu random1k/shopreg để bên đối tác lấy username và số dư ví game của chính account đã được cấp API key.',
        requestPayloadTitle: 'Du lieu gui',
        requestPayload: 'Khong can body. Gui api_key trong query/header. Co the goi bang x-api-key, Authorization Bearer hoac ?api_key=...',
        requestExample: `curl --request GET '${normalizedBaseUrl}/profile.php?api_key=${apiKeyPlaceholder}'`,
        responseExample: prettyJson({
          status: 'success',
          msg: 'Lấy thông tin tài khoản thành công',
          data: {
            username: 'partner_user',
            money: 1250000,
            email: 'partner@example.com',
            fullname: 'Partner User',
            user_id: 25,
          },
        }),
        errorExample: prettyJson({
          status: 'error',
          msg: 'API key khong hop le',
        }),
        notes: [
          'Đây là route tương thích provider, nên shape trả về là status/msg/data.',
          'money chính là ví game của account bên web anh, không phải ví hệ thống chung.',
        ],
      },
      {
        id: 'compat-products',
        title: 'Products.php - lấy catalog game/random/game-market',
        method: 'GET',
        endpoint: `${normalizedBaseUrl}/products.php`,
        description: 'Catalog chính tương thích random1k/shopreg. Trả về categories có products bên trong. Bao gồm tài khoản game, random game và cả game market.',
        requestPayloadTitle: 'Du lieu gui',
        requestPayload: 'Khong can body. Goi GET va gui api_key. Product ID của hệ thống dùng prefix: RES-123 cho tài khoản game/random, GM-789 cho game market.',
        requestExample: `curl --request GET '${normalizedBaseUrl}/products.php' \\
  --header 'x-api-key: ${apiKeyPlaceholder}'`,
        responseExample: prettyJson({
          status: 'success',
          msg: 'Lấy danh sách sản phẩm thành công',
          categories: [
            {
              id: 'resource-game',
              parent_id: null,
              name: 'Tai khoan game API',
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
                  content: 'Co mail dang ky va thong tin dang nhap.',
                  category_name: 'PUBG Mobile',
                  category_slug: 'pubg-mobile',
                  source_type: 'resource',
                },
              ],
            },
            {
              id: 'resource-random:lien-quan-mobile',
              parent_id: 'resource-random',
              name: 'Lien Quan Mobile',
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
                  content: 'Dang nhap doi mat khau ngay sau khi nhan acc.',
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
                  description: 'Tai khoan rank cao, da verify mail, co skin premium.',
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
          msg: 'Thieu API key',
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
        requestPayloadTitle: 'Du lieu gui',
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
              description: 'Tai khoan rank cao, da verify mail, co skin premium.',
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
        description: 'Endpoint mua hàng tương thích provider. Nếu ID là RES-* thì mua tài khoản game/random. Nếu ID là GM-* thì mua game market bằng chính ví game của account đang giữ API key.',
        requestPayloadTitle: 'Du lieu gui',
        requestPayload: `POST application/x-www-form-urlencoded

id=RES-123
amount=1
api_key=${apiKeyPlaceholder}

Hoặc:
id=GM-789
amount=1
api_key=${apiKeyPlaceholder}`,
        requestExample: `curl --request POST '${normalizedBaseUrl}/buy_product' \\
  --header 'Content-Type: application/x-www-form-urlencoded' \\
  --data 'id=RES-123&amount=1&api_key=${apiKeyPlaceholder}'`,
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
        requestPayloadTitle: 'Du lieu gui',
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
