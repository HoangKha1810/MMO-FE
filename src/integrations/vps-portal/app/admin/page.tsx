"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { SiteHeader } from "@vps/components/layout/site-header";
import { GlowCard } from "@vps/components/ui/glow-card";
import {
  createAdminCatalogItem,
  formatCurrency,
  getAdminCatalogItems,
  getAdminDashboard,
  getAdminInstances,
  getAdminOrders,
  getAdminResources,
  getStoredSession,
  runAdminInstanceAction,
  saveAdminSettings,
  subscribeSession,
  syncAdminCatalog,
  updateAdminCatalogItem,
  adminRefundOrder,
} from "@vps/lib/api";
import {
  AdminCatalogResources,
  AdminDashboard,
  AdminInstance,
  AdminOrder,
  CatalogItem,
  Session,
  StoreSettings,
} from "@vps/lib/types";

const defaultSettings: StoreSettings = {
  brand_name: "TRUNGTAMMMO.VN",
  hero_title: "Thuê VPS tốc độ cao, quản lý dễ dàng tại TRUNGTAMMMO.VN",
  hero_subtitle:
    "Bảng giá rõ ràng, kích hoạt nhanh, giao diện mượt và khu quản lý máy chủ tập trung cho từng tài khoản.",
  hero_badge: "Hệ thống VPS tự động",
  support_link: "https://zalo.me/3482369546728805278",
  announcement:
    "Danh mục VPS, giá bán và tình trạng máy chủ đều có thể quản lý tập trung trên một giao diện.",
  theme_default: "dark",
  intro_customer_count: "16890",
  addon_cpu_price: 15000,
  addon_ram_price: 15000,
  addon_disk_price: 5000,
  addon_disk_step: 10,
};

type TabKey = "overview" | "catalog" | "orders" | "instances" | "settings";

const tabLabels: Record<TabKey, string> = {
  overview: "Tổng quan",
  catalog: "Danh mục",
  orders: "Đơn hàng",
  instances: "Máy chủ",
  settings: "Cấu hình",
};

function emptyCatalogForm() {
  return {
    title: "",
    slug: "",
    sku: "",
    shortDescription: "",
    description: "",
    vncloudProductId: 0,
    vncloudOsId: 0,
    billingCycleCode: "",
    salePrice: 0,
    comparePrice: 0,
    addonCpu: 0,
    addonRam: 0,
    addonDisk: 0,
    badgeText: "",
    heroGradientFrom: "#0f766e",
    heroGradientTo: "#2563eb",
    sortOrder: 0,
    isActive: true,
    isFeatured: false,
  };
}

export default function AdminPage() {
  const session = useSyncExternalStore(
    subscribeSession,
    getStoredSession,
    () => null,
  );
  const [tab, setTab] = useState<TabKey>("overview");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogResources, setCatalogResources] = useState<AdminCatalogResources>({
    products: [],
    billingCycles: [],
    operatingSystems: [],
  });
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [instances, setInstances] = useState<AdminInstance[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [catalogForm, setCatalogForm] = useState(emptyCatalogForm());
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectedRemoteProduct =
    catalogResources.products.find(
      (product) => product.vncloud_product_id === catalogForm.vncloudProductId,
    ) ?? null;

  async function fetchAdminData(activeSession: Session) {
    const [
      dashboardResponse,
      catalogResponse,
      resourcesResponse,
      ordersResponse,
      instancesResponse,
    ] = await Promise.all([
      getAdminDashboard(activeSession.token),
      getAdminCatalogItems(activeSession.token),
      getAdminResources(activeSession.token),
      getAdminOrders(activeSession.token),
      getAdminInstances(activeSession.token),
    ]);

    return {
      dashboardResponse,
      catalogResponse,
      resourcesResponse,
      ordersResponse,
      instancesResponse,
    };
  }

  const applyAdminData = useCallback(
    (data: Awaited<ReturnType<typeof fetchAdminData>>) => {
      setDashboard(data.dashboardResponse);
      setCatalogItems(data.catalogResponse.items);
      setCatalogResources(data.resourcesResponse);
      setOrders(data.ordersResponse.orders);
      setInstances(data.instancesResponse.instances);
      setSettings(data.dashboardResponse.settings);
    },
    [],
  );

  useEffect(() => {
    if (!session || session.user.role !== "admin") {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const data = await fetchAdminData(session);

        if (!cancelled) {
          applyAdminData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "Không tải được dữ liệu quản trị.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAdminData, session]);

  function hydrateCatalogForm(item: CatalogItem) {
    setEditingItemId(item.id);
    setCatalogForm({
      title: item.title,
      slug: item.slug,
      sku: item.sku,
      shortDescription: item.short_description || "",
      description: item.description || "",
      vncloudProductId: item.vncloud_product_id ?? 0,
      vncloudOsId: item.vncloud_os_id ?? 0,
      billingCycleCode: item.billing_cycle_code,
      salePrice: item.sale_price,
      comparePrice: item.compare_price ?? 0,
      addonCpu: item.addon_cpu,
      addonRam: item.addon_ram,
      addonDisk: item.addon_disk,
      badgeText: item.badge_text || "",
      heroGradientFrom: item.hero_gradient_from,
      heroGradientTo: item.hero_gradient_to,
      sortOrder: item.sort_order ?? 0,
      isActive: Boolean(item.is_active ?? 1),
      isFeatured: Boolean(item.is_featured),
    });
  }

  function resetCatalogForm() {
    setEditingItemId(null);
    setCatalogForm(emptyCatalogForm());
  }

  function handleCatalogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    startTransition(async () => {
      try {
        const catalogPayload = {
          ...catalogForm,
          comparePrice:
            catalogForm.comparePrice > 0 ? catalogForm.comparePrice : undefined,
        };

        if (editingItemId) {
          await updateAdminCatalogItem(session.token, editingItemId, catalogPayload);
          setMessage("Đã cập nhật gói VPS.");
        } else {
          await createAdminCatalogItem(session.token, catalogPayload);
          setMessage("Đã tạo gói VPS mới.");
        }
        resetCatalogForm();
        applyAdminData(await fetchAdminData(session));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không lưu được gói VPS.");
      }
    });
  }

  function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    startTransition(async () => {
      try {
        await saveAdminSettings(session.token, settings);
        setMessage("Đã lưu cấu hình storefront.");
        applyAdminData(await fetchAdminData(session));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không lưu được cấu hình.");
      }
    });
  }

  function handleSyncCatalog() {
    if (!session) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await syncAdminCatalog(session.token);
        setMessage(
          `${result.message} | sản phẩm: ${result.synced.products}, hệ điều hành: ${result.synced.operatingSystems}, chu kỳ: ${result.synced.billingCycles}`,
        );
        applyAdminData(await fetchAdminData(session));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Đồng bộ danh mục VPS thất bại.");
      }
    });
  }

  function handleAdminAction(instanceId: number, action: string) {
    if (!session) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await runAdminInstanceAction(session.token, instanceId, action);
        setMessage(result.message);
        applyAdminData(await fetchAdminData(session));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không gửi được lệnh quản trị.");
      }
    });
  }

  if (!session || session.user.role !== "admin") {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="section-shell py-14">
          <GlowCard>
            <div className="mesh-panel p-10 text-center">
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-4xl font-semibold">
                Khu quản trị chỉ dành cho tài khoản admin
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[var(--muted)]">
                Đăng nhập bằng tài khoản admin trong bảng `users` để quản trị giá bán,
                danh mục VPS và các máy chủ đã giao cho từng người dùng.
              </p>
              <div className="mt-8 flex justify-center gap-4">
                <Link href="/vps/auth" className="action-button">
                  Đăng nhập admin
                </Link>
                <Link href="/vps" className="ghost-button">
                  Về trang chủ
                </Link>
              </div>
            </div>
          </GlowCard>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <SiteHeader brandName={dashboard?.settings.brand_name} supportLink={dashboard?.settings.support_link} />

      <main className="section-shell space-y-8 py-10">
        <div className="mesh-panel relative overflow-hidden p-8">
          <div className="admin-orb absolute left-[5%] top-[15%] h-32 w-32 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="admin-orb absolute bottom-[10%] right-[8%] h-40 w-40 rounded-full bg-orange-400/15 blur-3xl" />
          <div className="admin-orb absolute right-[20%] top-[25%] h-28 w-28 rounded-full bg-emerald-400/12 blur-3xl" />
          <div className="admin-orb absolute left-[35%] bottom-[20%] h-24 w-24 rounded-full bg-violet-400/12 blur-3xl" />
          
          <div>
            <span className="eyebrow">Trung tâm quản trị</span>
            <h1 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
              Quản trị VPS, giá bán và dữ liệu người dùng trên một dashboard
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
              Từ đây bạn có thể đồng bộ danh mục VPS, bật tắt từng gói, xem đã bán
              cho ai và thao tác nhanh với các VPS đã tạo cho khách.
            </p>
          </div>

          {message ? (
            <div className="mt-6 rounded-2xl border border-cyan-300/18 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
              {message}
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {(["overview", "catalog", "orders", "instances", "settings"] as TabKey[]).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    tab === item
                      ? "bg-white text-slate-950"
                      : "border border-white/10 bg-white/5 text-[var(--muted)]"
                  }`}
                >
                  {tabLabels[item]}
                </button>
              ),
            )}

            <button type="button" className="ghost-button ml-auto" onClick={handleSyncCatalog}>
              <RefreshCcw className="h-4 w-4" />
              Đồng bộ danh mục
            </button>
          </div>
        </div>

        {tab === "overview" ? (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <GlowCard>
              <div className="mesh-panel p-8">
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold">
                  Ảnh chụp nhanh dữ liệu nhà cung cấp
                </h2>
                <pre className="mt-5 overflow-auto rounded-[26px] border border-white/10 bg-black/20 p-5 text-xs leading-7 text-[var(--muted)]">
                  {JSON.stringify(dashboard?.agency ?? {}, null, 2)}
                </pre>
              </div>
            </GlowCard>

            <GlowCard>
              <div className="mesh-panel p-8">
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold">
                  Đơn gần đây
                </h2>
                <div className="mt-6 space-y-4">
                  {dashboard?.recentOrders.map((order) => (
                    <div key={order.id} className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                            {order.order_code}
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {order.username} · {order.title}
                          </p>
                        </div>
                        <span className="status-pill">{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </GlowCard>
          </div>
        ) : null}

        {tab === "catalog" ? (
          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <GlowCard>
              <div className="mesh-panel p-8">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold">
                    Tạo / sửa listing
                  </h2>
                  {editingItemId ? (
                    <button type="button" className="ghost-button" onClick={resetCatalogForm}>
                      Hủy sửa
                    </button>
                  ) : null}
                </div>

                <form className="mt-6 space-y-4" onSubmit={handleCatalogSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      className="input-shell"
                      placeholder="Tên gói VPS"
                      value={catalogForm.title}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="input-shell"
                      placeholder="SKU"
                      value={catalogForm.sku}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          sku: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <select
                      className="select-shell"
                      value={catalogForm.vncloudProductId}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          vncloudProductId: Number(event.target.value),
                        }))
                      }
                    >
                      <option value={0}>Chọn gói VPS</option>
                      {catalogResources.products.map((product) => (
                        <option key={product.vncloud_product_id} value={product.vncloud_product_id}>
                          {product.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="select-shell"
                      value={catalogForm.vncloudOsId}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          vncloudOsId: Number(event.target.value),
                        }))
                      }
                    >
                      <option value={0}>Chọn hệ điều hành</option>
                      {catalogResources.operatingSystems.map((operatingSystem) => (
                        <option key={operatingSystem.vncloud_os_id} value={operatingSystem.vncloud_os_id}>
                          {operatingSystem.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Chu kỳ thanh toán
                      </span>
                      <select
                        className="select-shell"
                        value={catalogForm.billingCycleCode}
                        onChange={(event) =>
                          setCatalogForm((current) => ({
                            ...current,
                            billingCycleCode: event.target.value,
                          }))
                        }
                      >
                        <option value="">Chọn chu kỳ thanh toán</option>
                        {catalogResources.billingCycles.map((cycle) => (
                          <option key={cycle.cycle_code} value={cycle.cycle_code}>
                            {cycle.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Giá bán
                      </span>
                      <input
                        className="input-shell"
                        type="number"
                        placeholder="Giá bán đang hiển thị"
                        value={catalogForm.salePrice}
                        onChange={(event) =>
                          setCatalogForm((current) => ({
                            ...current,
                            salePrice: Number(event.target.value),
                          }))
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Giá đại lý
                      </span>
                      <div className="input-shell flex min-h-[52px] items-center bg-white/4 text-sm font-semibold text-[var(--foreground)]">
                        {selectedRemoteProduct
                          ? formatCurrency(selectedRemoteProduct.base_price)
                          : "Chọn gói VPS để xem"}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Giá gốc
                      </span>
                      <input
                        className="input-shell"
                        type="number"
                        placeholder="Giá gốc gạch chéo"
                        value={catalogForm.comparePrice}
                        onChange={(event) =>
                          setCatalogForm((current) => ({
                            ...current,
                            comparePrice: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-cyan-400/18 bg-cyan-400/8 px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                    Giá cộng thêm cho khách ở popup custom mua VPS không sửa trong form listing này.
                    Anh vào tab <strong className="text-[var(--foreground)]">Cấu hình</strong> để chỉnh
                    giá `CPU / RAM / Disk` addon toàn cục.
                  </div>

                  <div className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Mô tả ngắn để PR
                    </span>
                    <textarea
                      className="textarea-shell min-h-28"
                      placeholder="Ví dụ: VPS 1 Core / 1 GB RAM phù hợp chạy website nhỏ, MMO cơ bản hoặc bot nhẹ."
                      value={catalogForm.shortDescription}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          shortDescription: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <input
                      className="input-shell"
                      type="number"
                      placeholder="CPU gốc của gói"
                      value={catalogForm.addonCpu}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          addonCpu: Number(event.target.value),
                        }))
                      }
                    />
                    <input
                      className="input-shell"
                      type="number"
                      placeholder="RAM gốc của gói"
                      value={catalogForm.addonRam}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          addonRam: Number(event.target.value),
                        }))
                      }
                    />
                    <input
                      className="input-shell"
                      type="number"
                      placeholder="Disk gốc của gói (GB)"
                      value={catalogForm.addonDisk}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          addonDisk: Number(event.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      className="input-shell"
                      placeholder="Màu gradient đầu"
                      value={catalogForm.heroGradientFrom}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          heroGradientFrom: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="input-shell"
                      placeholder="Màu gradient cuối"
                      value={catalogForm.heroGradientTo}
                      onChange={(event) =>
                        setCatalogForm((current) => ({
                          ...current,
                          heroGradientTo: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={catalogForm.isActive}
                        onChange={(event) =>
                          setCatalogForm((current) => ({
                            ...current,
                            isActive: event.target.checked,
                          }))
                        }
                      />
                      Mở bán
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={catalogForm.isFeatured}
                        onChange={(event) =>
                          setCatalogForm((current) => ({
                            ...current,
                            isFeatured: event.target.checked,
                          }))
                        }
                      />
                      Nổi bật
                    </label>
                  </div>

                  <button type="submit" className="action-button">
                    {editingItemId ? "Cập nhật listing" : "Tạo listing mới"}
                  </button>
                </form>
              </div>
            </GlowCard>

            <GlowCard>
              <div className="mesh-panel p-8">
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold">
                  Listing hiện có
                </h2>
                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  {catalogItems.map((item) => {
                    const remoteProduct =
                      catalogResources.products.find(
                        (product) => product.vncloud_product_id === item.vncloud_product_id,
                      ) ?? null;

                    return (
                    <div 
                      key={item.id} 
                      className="rounded-[26px] border border-white/10 bg-white/6 p-5 transition-all hover:border-cyan-400/30 hover:bg-white/10"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                            {item.sku}
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold">{item.title}</h3>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
                            <span>Giá đại lý: {remoteProduct ? formatCurrency(remoteProduct.base_price) : "--"}</span>
                            <span>Giá bán: {formatCurrency(item.sale_price)}</span>
                            <span>
                              Giá gốc: {item.compare_price ? formatCurrency(item.compare_price) : "--"}
                            </span>
                            <span>{item.billing_cycle_label || item.billing_cycle_code}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <span className="status-pill">{item.badge_text || "danh mục"}</span>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => hydrateCatalogForm(item)}
                          >
                            Sửa
                          </button>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </GlowCard>
          </div>
        ) : null}

        {tab === "orders" ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Đơn hàng</th>
                  <th>Người dùng</th>
                  <th>Gói</th>
                  <th>Trạng thái</th>
                  <th>Tổng tiền</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_code}</td>
                    <td>
                      {order.username}
                      <br />
                      <span className="text-xs text-[var(--muted)]">{order.email}</span>
                    </td>
                    <td>{order.title}</td>
                    <td>
                      <span className="status-pill">{order.status}</span>
                      {order.refund_amount ? (
                        <p className="mt-1 text-xs text-cyan-400">
                          Hoàn: {formatCurrency(order.refund_amount)}
                        </p>
                      ) : null}
                    </td>
                    <td>{formatCurrency(order.total_price)}</td>
                    <td>
                      {order.status === "active" && !order.refund_requested_at && (
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={async () => {
                            if (!session) return;
                            if (!window.confirm(`Hoàn tiền đơn hàng ${order.order_code} (${formatCurrency(order.total_price)}) cho ${order.username}?`)) return;
                            try {
                              const result = await adminRefundOrder(session.token, order.id);
                              setMessage(result.message);
                              void applyAdminData(await fetchAdminData(session));
                            } catch (error) {
                              setMessage(error instanceof Error ? error.message : "Lỗi khi hoàn tiền.");
                            }
                          }}
                        >
                          Hoàn tiền
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "instances" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {instances.map((instance) => (
              <GlowCard key={instance.id}>
                <div className="mesh-panel p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                        {instance.order_code}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold">
                        {instance.owner_username} · VPS #{instance.vncloud_vps_id}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                          {instance.owner_email} · {instance.ip_address || "Đang cấp IP"}
                      </p>
                    </div>
                    <span className="status-pill">{instance.status}</span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleAdminAction(instance.id, "on")}
                    >
                      Bật
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleAdminAction(instance.id, "off")}
                    >
                      Tắt
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleAdminAction(instance.id, "restart")}
                    >
                      Khởi động lại
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        handleAdminAction(
                          instance.id,
                          instance.auto_renew ? "off-auto-renew" : "on-auto-renew",
                        )
                      }
                    >
                      Đổi tự gia hạn
                    </button>
                    {!/(cancelled?|failed?|deleted?)/i.test(instance.status) && (
                      <button
                        type="button"
                        className="ghost-button text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
                        onClick={async () => {
                          if (!session) return;
                          if (!window.confirm(`Xóa VPS #${instance.vncloud_vps_id} của ${instance.owner_username}?`)) return;
                          try {
                            const result = await runAdminInstanceAction(session.token, instance.id, "cancel");
                            setMessage(result.message);
                            void applyAdminData(await fetchAdminData(session));
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Lỗi khi xóa VPS.");
                          }
                        }}
                      >
                        Xóa VPS
                      </button>
                    )}
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        ) : null}

        {tab === "settings" ? (
          <GlowCard>
            <div className="mesh-panel p-8">
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold">
                Cấu hình storefront
              </h2>
              <form className="mt-6 space-y-4" onSubmit={handleSettingsSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="input-shell"
                    placeholder="Tên thương hiệu"
                    value={settings.brand_name}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        brand_name: event.target.value,
                      }))
                    }
                  />
                  <input
                    className="input-shell"
                    placeholder="Nhãn nổi bật"
                    value={settings.hero_badge}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        hero_badge: event.target.value,
                      }))
                    }
                  />
                </div>

                <input
                  className="input-shell"
                  placeholder="Tiêu đề hero"
                  value={settings.hero_title}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      hero_title: event.target.value,
                    }))
                  }
                />
                <textarea
                  className="textarea-shell min-h-28"
                  placeholder="Mô tả hero"
                  value={settings.hero_subtitle}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      hero_subtitle: event.target.value,
                    }))
                  }
                />
                <textarea
                  className="textarea-shell min-h-24"
                  placeholder="Thông báo"
                  value={settings.announcement}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      announcement: event.target.value,
                    }))
                  }
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="input-shell"
                    placeholder="Liên kết hỗ trợ"
                    value={settings.support_link}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        support_link: event.target.value,
                      }))
                    }
                  />
                  <select
                    className="select-shell"
                    value={settings.theme_default}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        theme_default: event.target.value as StoreSettings["theme_default"],
                      }))
                    }
                  >
                    <option value="dark">Mặc định tối</option>
                    <option value="light">Mặc định sáng</option>
                  </select>
                </div>
                <input
                  className="input-shell"
                  placeholder="Số khách hàng PR ở trang giới thiệu"
                  value={settings.intro_customer_count}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      intro_customer_count: event.target.value.replace(/[^\d]/g, ""),
                    }))
                  }
                />
                <div className="rounded-[24px] border border-cyan-400/16 bg-cyan-400/6 px-5 py-5">
                  <div className="flex flex-col gap-2">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                      Giá addon custom cho khách
                    </p>
                    <p className="text-sm leading-7 text-[var(--muted)]">
                      Đây là chỗ chỉnh các giá `CPU / RAM / Disk` mà khách thấy trong popup mua VPS.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        CPU / 1 core / tháng
                      </span>
                      <input
                        className="input-shell"
                        type="number"
                        value={settings.addon_cpu_price}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            addon_cpu_price: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        RAM / 1 GB / tháng
                      </span>
                      <input
                        className="input-shell"
                        type="number"
                        value={settings.addon_ram_price}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            addon_ram_price: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Disk / 1 nấc / tháng
                      </span>
                      <input
                        className="input-shell"
                        type="number"
                        value={settings.addon_disk_price}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            addon_disk_price: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Bước disk (GB)
                      </span>
                      <input
                        className="input-shell"
                        type="number"
                        value={settings.addon_disk_step}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            addon_disk_step: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                    Ví dụ mặc định: CPU 15.000đ / 1 core, RAM 15.000đ / 1 GB, Disk 5.000đ / 10 GB.
                  </p>
                </div>
                <button type="submit" className="action-button">
                  Lưu cấu hình
                </button>
              </form>
            </div>
          </GlowCard>
        ) : null}

        {isPending ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
            Đang cập nhật dữ liệu quản trị...
          </div>
        ) : null}
      </main>
    </div>
  );
}
