import { CatalogItem } from "./types";

export function sortCatalogItemsForStorefront(items: CatalogItem[]) {
  return [...items].sort((left, right) => {
    const byPrice = Number(left.sale_price ?? 0) - Number(right.sale_price ?? 0);
    if (byPrice !== 0) {
      return byPrice;
    }

    const byCpu = Number(left.addon_cpu ?? 0) - Number(right.addon_cpu ?? 0);
    if (byCpu !== 0) {
      return byCpu;
    }

    const byRam = Number(left.addon_ram ?? 0) - Number(right.addon_ram ?? 0);
    if (byRam !== 0) {
      return byRam;
    }

    return Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  });
}
