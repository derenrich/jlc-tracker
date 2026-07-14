// Maps a raw API component item to the Firestore documents. Shared by the
// daily ingest and the archive backfill so the two always agree on shape.

export function tierPrices(item) {
  return (item.componentPrices ?? [])
    .map((t) => ({ qty: t.startNumber, price: t.productPrice }))
    .sort((a, b) => a.qty - b.qty);
}

export function partDoc(item, date) {
  return {
    code: item.componentCode,
    model: item.componentModelEn ?? '',
    brand: item.componentBrandEn ?? '',
    description: item.describe ?? '',
    category: item.firstSortName ?? '',
    subcategory: item.secondSortName ?? '',
    package: item.componentSpecificationEn ?? '',
    libraryType: item.componentLibraryType, // "base" | "expand"
    stock: item.stockCount ?? 0,
    minOrder: item.leastPatchNumber ?? 1,
    prices: tierPrices(item),
    attributes: (item.attributes ?? [])
      .filter((a) => a.attribute_value_name && a.attribute_value_name !== '-')
      .map((a) => ({ name: a.attribute_name_en, value: a.attribute_value_name })),
    lcscUrl: item.lcscGoodsUrl ?? '',
    jlcUrl: item.urlSuffix ? `https://jlcpcb.com/partdetail/${item.urlSuffix}` : '',
    // Only the stable lcsc.com link; the alternative (dataManualFileAccessIdUrl)
    // is a signed URL that expires ~30 minutes after fetch.
    datasheetUrl: item.dataManualUrl || '',
    updatedAt: date,
  };
}

// One point of price/stock history: date, unit price at the lowest quantity
// break (USD), stock count.
export function historyEntry(item, date) {
  return { d: date, p: tierPrices(item)[0]?.price ?? null, s: item.stockCount ?? 0 };
}
