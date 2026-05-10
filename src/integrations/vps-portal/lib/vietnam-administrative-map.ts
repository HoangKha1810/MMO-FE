import vietnamMap from "@svg-maps/vietnam";

type LegacyLocation = (typeof vietnamMap.locations)[number];

export type VietnamAdministrativeUnit = {
  id: string;
  label: string;
  kind: "Tỉnh" | "Thành phố";
  region: "Bắc Bộ" | "Trung Bộ" | "Nam Bộ";
  legacyNames: readonly string[];
  mergedFrom: readonly string[];
  description: string;
  isKeyHub?: boolean;
  locations: readonly LegacyLocation[];
};

export type VietnamNetworkHub = {
  id: string;
  label: string;
  unitId: string;
  locationId: string;
  detail: string;
  displayLeft?: number;
  displayTop?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  anchorX?: number;
  anchorY?: number;
};

const legacyLocationsByName = new Map(
  vietnamMap.locations.map((location: LegacyLocation) => [location.name, location]),
);

const administrativeUnitConfigs = [
  {
    id: "ha-noi",
    label: "Hà Nội",
    kind: "Thành phố",
    region: "Bắc Bộ",
    legacyNames: ["Ha Noi"],
    mergedFrom: ["Hà Nội"],
    description:
      "Cụm kết nối miền Bắc, phù hợp website, backend và workflow cần độ trễ tốt tại khu vực phía Bắc.",
    isKeyHub: true,
  },
  {
    id: "hue",
    label: "Huế",
    kind: "Thành phố",
    region: "Trung Bộ",
    legacyNames: ["Thua Thien-Hue"],
    mergedFrom: ["Huế"],
    description:
      "Giữ nguyên đơn vị hành chính hiện hành, nằm trên trục kết nối miền Trung và thuận tiện cho hạ tầng phân tán.",
  },
  {
    id: "quang-ninh",
    label: "Quảng Ninh",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Quang Ninh"],
    mergedFrom: ["Quảng Ninh"],
    description:
      "Giữ nguyên đơn vị hành chính, thuận lợi cho các luồng truy cập Đông Bắc và các dịch vụ yêu cầu vùng phủ rộng.",
  },
  {
    id: "cao-bang",
    label: "Cao Bằng",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Cao Bang"],
    mergedFrom: ["Cao Bằng"],
    description:
      "Đơn vị hành chính giữ nguyên, nằm trong mạng hiển thị để bảo đảm bản đồ tỉnh/thành đầy đủ và đúng hiện trạng.",
  },
  {
    id: "lang-son",
    label: "Lạng Sơn",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Lang Son"],
    mergedFrom: ["Lạng Sơn"],
    description:
      "Giữ nguyên đơn vị hành chính hiện hành trong cụm Bắc Bộ.",
  },
  {
    id: "lai-chau",
    label: "Lai Châu",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Lai Chau"],
    mergedFrom: ["Lai Châu"],
    description:
      "Tỉnh giữ nguyên trong hệ 34 tỉnh/thành hiện hành của Việt Nam.",
  },
  {
    id: "dien-bien",
    label: "Điện Biên",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Dien Bien"],
    mergedFrom: ["Điện Biên"],
    description:
      "Tỉnh giữ nguyên, được render theo ranh giới hành chính hiện hành.",
  },
  {
    id: "son-la",
    label: "Sơn La",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Son La"],
    mergedFrom: ["Sơn La"],
    description:
      "Tỉnh giữ nguyên, thuộc cụm Bắc Bộ trong bản đồ giới thiệu hệ thống.",
  },
  {
    id: "thanh-hoa",
    label: "Thanh Hóa",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Thanh Hoa"],
    mergedFrom: ["Thanh Hóa"],
    description:
      "Tỉnh giữ nguyên, phù hợp hiển thị như một điểm hành chính lớn trong dải Bắc Trung Bộ.",
  },
  {
    id: "nghe-an",
    label: "Nghệ An",
    kind: "Tỉnh",
    region: "Trung Bộ",
    legacyNames: ["Nghe An"],
    mergedFrom: ["Nghệ An"],
    description:
      "Tỉnh giữ nguyên, được hiển thị đúng trong hệ 34 tỉnh/thành hiện hành.",
  },
  {
    id: "ha-tinh",
    label: "Hà Tĩnh",
    kind: "Tỉnh",
    region: "Trung Bộ",
    legacyNames: ["Ha Tinh"],
    mergedFrom: ["Hà Tĩnh"],
    description:
      "Tỉnh giữ nguyên trong hệ hành chính mới, nằm trên dải kết nối miền Trung.",
  },
  {
    id: "tuyen-quang",
    label: "Tuyên Quang",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Ha Giang", "Tuyen Quang"],
    mergedFrom: ["Hà Giang", "Tuyên Quang"],
    description:
      "Tỉnh hiện tại được hình thành từ Hà Giang và Tuyên Quang trong đợt sắp xếp cấp tỉnh năm 2025.",
  },
  {
    id: "lao-cai",
    label: "Lào Cai",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Lao Cai", "Yen Bai"],
    mergedFrom: ["Lào Cai", "Yên Bái"],
    description:
      "Tỉnh hiện tại được gộp từ Lào Cai và Yên Bái.",
  },
  {
    id: "thai-nguyen",
    label: "Thái Nguyên",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Bac Kan", "Thai Nguyen"],
    mergedFrom: ["Bắc Kạn", "Thái Nguyên"],
    description:
      "Tỉnh hiện tại được gộp từ Bắc Kạn và Thái Nguyên.",
  },
  {
    id: "phu-tho",
    label: "Phú Thọ",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Hoa Binh", "Vinh Phuc", "Phu Tho"],
    mergedFrom: ["Hòa Bình", "Vĩnh Phúc", "Phú Thọ"],
    description:
      "Tỉnh hiện tại được gộp từ Hòa Bình, Vĩnh Phúc và Phú Thọ.",
  },
  {
    id: "bac-ninh",
    label: "Bắc Ninh",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Bac Giang", "Bac Ninh"],
    mergedFrom: ["Bắc Giang", "Bắc Ninh"],
    description:
      "Tỉnh hiện tại được gộp từ Bắc Giang và Bắc Ninh.",
  },
  {
    id: "hung-yen",
    label: "Hưng Yên",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Hung Yen", "Thai Binh"],
    mergedFrom: ["Hưng Yên", "Thái Bình"],
    description:
      "Tỉnh hiện tại được gộp từ Hưng Yên và Thái Bình.",
  },
  {
    id: "hai-phong",
    label: "Hải Phòng",
    kind: "Thành phố",
    region: "Bắc Bộ",
    legacyNames: ["Hai Phong", "Hai Duong"],
    mergedFrom: ["Hải Phòng", "Hải Dương"],
    description:
      "Thành phố hiện tại được gộp từ Hải Phòng và Hải Dương, đóng vai trò cửa ngõ quan trọng của miền Bắc.",
  },
  {
    id: "ninh-binh",
    label: "Ninh Bình",
    kind: "Tỉnh",
    region: "Bắc Bộ",
    legacyNames: ["Ha Nam", "Nam Dinh", "Ninh Binh"],
    mergedFrom: ["Hà Nam", "Nam Định", "Ninh Bình"],
    description:
      "Tỉnh hiện tại được gộp từ Hà Nam, Nam Định và Ninh Bình.",
  },
  {
    id: "quang-tri",
    label: "Quảng Trị",
    kind: "Tỉnh",
    region: "Trung Bộ",
    legacyNames: ["Quang Binh", "Quang Tri"],
    mergedFrom: ["Quảng Bình", "Quảng Trị"],
    description:
      "Tỉnh hiện tại được gộp từ Quảng Bình và Quảng Trị.",
  },
  {
    id: "da-nang",
    label: "Đà Nẵng",
    kind: "Thành phố",
    region: "Trung Bộ",
    legacyNames: ["Da Nang", "Quang Nam", "Hoang Sa"],
    mergedFrom: ["Đà Nẵng", "Quảng Nam", "Hoàng Sa"],
    description:
      "Thành phố hiện tại được gộp từ Đà Nẵng và Quảng Nam, đồng thời bao gồm Hoàng Sa trong dữ liệu bản đồ.",
    isKeyHub: true,
  },
  {
    id: "quang-ngai",
    label: "Quảng Ngãi",
    kind: "Tỉnh",
    region: "Trung Bộ",
    legacyNames: ["Kon Tum", "Quang Ngai"],
    mergedFrom: ["Kon Tum", "Quảng Ngãi"],
    description:
      "Tỉnh hiện tại được gộp từ Kon Tum và Quảng Ngãi.",
  },
  {
    id: "gia-lai",
    label: "Gia Lai",
    kind: "Tỉnh",
    region: "Trung Bộ",
    legacyNames: ["Gia Lai", "Binh Dinh"],
    mergedFrom: ["Gia Lai", "Bình Định"],
    description:
      "Tỉnh hiện tại được gộp từ Gia Lai và Bình Định.",
  },
  {
    id: "khanh-hoa",
    label: "Khánh Hòa",
    kind: "Tỉnh",
    region: "Trung Bộ",
    legacyNames: ["Khanh Hoa", "Ninh Thuan", "Truong Sa"],
    mergedFrom: ["Khánh Hòa", "Ninh Thuận", "Trường Sa"],
    description:
      "Tỉnh hiện tại được gộp từ Khánh Hòa và Ninh Thuận, đồng thời bao gồm Trường Sa trong dữ liệu bản đồ.",
  },
  {
    id: "lam-dong",
    label: "Lâm Đồng",
    kind: "Tỉnh",
    region: "Trung Bộ",
    legacyNames: ["Lam Dong", "Dak Nong", "Binh Thuan"],
    mergedFrom: ["Lâm Đồng", "Đắk Nông", "Bình Thuận"],
    description:
      "Tỉnh hiện tại được gộp từ Lâm Đồng, Đắk Nông và Bình Thuận.",
  },
  {
    id: "dak-lak",
    label: "Đắk Lắk",
    kind: "Tỉnh",
    region: "Trung Bộ",
    legacyNames: ["Dak Lak", "Phu Yen"],
    mergedFrom: ["Đắk Lắk", "Phú Yên"],
    description:
      "Tỉnh hiện tại được gộp từ Đắk Lắk và Phú Yên.",
  },
  {
    id: "ho-chi-minh",
    label: "TP. Hồ Chí Minh",
    kind: "Thành phố",
    region: "Nam Bộ",
    legacyNames: ["Ho Chi Minh", "Ba Ria–Vung Tau", "Binh Duong"],
    mergedFrom: ["TP. Hồ Chí Minh", "Bà Rịa - Vũng Tàu", "Bình Dương"],
    description:
      "Thành phố hiện tại được gộp từ TP. Hồ Chí Minh, Bà Rịa - Vũng Tàu và Bình Dương; đây là cụm vận hành trọng điểm phía Nam.",
    isKeyHub: true,
  },
  {
    id: "dong-nai",
    label: "Đồng Nai",
    kind: "Tỉnh",
    region: "Nam Bộ",
    legacyNames: ["Dong Nai", "Binh Phuoc"],
    mergedFrom: ["Đồng Nai", "Bình Phước"],
    description:
      "Tỉnh hiện tại được gộp từ Đồng Nai và Bình Phước.",
  },
  {
    id: "tay-ninh",
    label: "Tây Ninh",
    kind: "Tỉnh",
    region: "Nam Bộ",
    legacyNames: ["Tay Ninh", "Long An"],
    mergedFrom: ["Tây Ninh", "Long An"],
    description:
      "Tỉnh hiện tại được gộp từ Tây Ninh và Long An.",
  },
  {
    id: "can-tho",
    label: "Cần Thơ",
    kind: "Thành phố",
    region: "Nam Bộ",
    legacyNames: ["Can Tho", "Soc Trang", "Hau Giang"],
    mergedFrom: ["Cần Thơ", "Sóc Trăng", "Hậu Giang"],
    description:
      "Thành phố hiện tại được gộp từ Cần Thơ, Sóc Trăng và Hậu Giang; là điểm quan trọng của Đồng bằng sông Cửu Long.",
  },
  {
    id: "vinh-long",
    label: "Vĩnh Long",
    kind: "Tỉnh",
    region: "Nam Bộ",
    legacyNames: ["Vinh Long", "Ben Tre", "Tra Vinh"],
    mergedFrom: ["Vĩnh Long", "Bến Tre", "Trà Vinh"],
    description:
      "Tỉnh hiện tại được gộp từ Vĩnh Long, Bến Tre và Trà Vinh.",
  },
  {
    id: "dong-thap",
    label: "Đồng Tháp",
    kind: "Tỉnh",
    region: "Nam Bộ",
    legacyNames: ["Dong Thap", "Tien Giang"],
    mergedFrom: ["Đồng Tháp", "Tiền Giang"],
    description:
      "Tỉnh hiện tại được gộp từ Đồng Tháp và Tiền Giang.",
  },
  {
    id: "ca-mau",
    label: "Cà Mau",
    kind: "Tỉnh",
    region: "Nam Bộ",
    legacyNames: ["Ca Mau", "Bac Lieu"],
    mergedFrom: ["Cà Mau", "Bạc Liêu"],
    description:
      "Tỉnh hiện tại được gộp từ Cà Mau và Bạc Liêu.",
  },
  {
    id: "an-giang",
    label: "An Giang",
    kind: "Tỉnh",
    region: "Nam Bộ",
    legacyNames: ["An Giang", "Kien Giang"],
    mergedFrom: ["An Giang", "Kiên Giang"],
    description:
      "Tỉnh hiện tại được gộp từ An Giang và Kiên Giang.",
  },
] as const;

export const vietnamAdministrativeUnits: VietnamAdministrativeUnit[] =
  administrativeUnitConfigs.map((unit) => ({
    ...unit,
    locations: unit.legacyNames
      .map((legacyName) => legacyLocationsByName.get(legacyName))
      .filter((location): location is LegacyLocation => Boolean(location)),
  }));

export const vietnamAdministrativeMapViewBox = vietnamMap.viewBox;

export const vietnamNetworkHubs: VietnamNetworkHub[] = [
  {
    id: "hub-ha-noi",
    label: "Hà Nội",
    unitId: "ha-noi",
    locationId: "hanoi",
    detail: "Cụm kết nối trọng điểm miền Bắc",
    displayLeft: 38.6,
    displayTop: 16.4,
    labelOffsetX: 34,
    labelOffsetY: -10,
    anchorX: 0.52,
    anchorY: 0.46,
  },
  {
    id: "hub-da-nang",
    label: "Đà Nẵng",
    unitId: "da-nang",
    locationId: "danang",
    detail: "Điểm trung chuyển miền Trung",
    displayLeft: 60.6,
    displayTop: 47.9,
    labelOffsetX: 34,
    labelOffsetY: -8,
    anchorX: 0.52,
    anchorY: 0.52,
  },
  {
    id: "hub-binh-duong",
    label: "Bình Dương",
    unitId: "ho-chi-minh",
    locationId: "binhduong",
    detail: "Cụm vận hành công nghiệp phía Nam",
    displayLeft: 47.2,
    displayTop: 76.8,
    labelOffsetX: 30,
    labelOffsetY: -30,
    anchorX: 0.55,
    anchorY: 0.42,
  },
  {
    id: "hub-ho-chi-minh",
    label: "TP.HCM",
    unitId: "ho-chi-minh",
    locationId: "hcm",
    detail: "Truy cập lớn cho MMO, web và automation",
    displayLeft: 46.2,
    displayTop: 82.4,
    labelOffsetX: 30,
    labelOffsetY: -2,
    anchorX: 0.52,
    anchorY: 0.5,
  },
  {
    id: "hub-can-tho",
    label: "Cần Thơ",
    unitId: "can-tho",
    locationId: "cantho",
    detail: "Phủ khu vực Đồng bằng sông Cửu Long",
    displayLeft: 35.6,
    displayTop: 87.1,
    labelOffsetX: 28,
    labelOffsetY: 20,
    anchorX: 0.48,
    anchorY: 0.5,
  },
];
