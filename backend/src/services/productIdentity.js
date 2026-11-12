function normalizeSku(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/^[`'"\u2018\u2019\u201c\u201d]+|[`'"\u2018\u2019\u201c\u201d]+$/gu, "")
    .trim()
    .toUpperCase();
}

function dedupeProductsBySku(products = []) {
  const unique = new Map();

  for (const product of products) {
    const sku = normalizeSku(product?.sku);
    const key = sku ? `sku:${sku}` : `id:${String(product?._id || product?.productId || "")}`;
    const current = unique.get(key);
    const rawSku = String(product?.sku || "").normalize("NFKC").trim();
    const isCanonical = Boolean(sku) && rawSku === sku;
    const currentRawSku = String(current?.sku || "").normalize("NFKC").trim();
    const currentIsCanonical = Boolean(sku) && currentRawSku === sku;

    // Prefer the already-clean database record when decorated and canonical
    // versions of the same SKU both exist.
    if (!current || (isCanonical && !currentIsCanonical)) {
      unique.set(key, product);
    }
  }

  return Array.from(unique.values());
}

module.exports = { dedupeProductsBySku, normalizeSku };
