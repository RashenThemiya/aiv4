const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");

const config = require("../src/config");
const {
  optimizeProductImage,
  productImageFilePath,
  removeProductImage,
  saveProductImage,
} = require("../src/services/productMedia");

async function samplePng(width = 2000, height = 1200) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 37, g: 99, b: 235, alpha: 1 },
    },
  }).png().toBuffer();
}

test("product images are converted to bounded WebP files", async () => {
  const optimized = await optimizeProductImage(await samplePng());
  assert.equal(optimized.mimeType, "image/webp");
  assert.equal(optimized.width, 1600);
  assert.equal(optimized.height, 960);
  assert.ok(optimized.fileSize > 0);
  const metadata = await sharp(optimized.buffer).metadata();
  assert.equal(metadata.format, "webp");
});

test("invalid product image bytes are rejected", async () => {
  await assert.rejects(
    () => optimizeProductImage(Buffer.from("not an image")),
    (error) => error.code === "INVALID_PRODUCT_IMAGE"
  );
});

test("stored product images remain company scoped and can be removed", async () => {
  const originalUploadDir = config.uploadDir;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "product-media-test-"));
  config.uploadDir = temporaryRoot;
  try {
    const stored = await saveProductImage({
      companyId: "company123",
      productId: "product456",
      buffer: await samplePng(300, 300),
      altText: "  Test product  ",
    });
    assert.match(stored.fileName, /^[a-f0-9]{32}\.webp$/);
    assert.equal(stored.altText, "Test product");
    assert.equal(
      stored.imageUrl,
      `/media/products/company123/product456/${stored.fileName}`
    );
    const filePath = productImageFilePath("company123", "product456", stored.fileName);
    await fs.access(filePath);
    await removeProductImage("company123", "product456", stored);
    await assert.rejects(() => fs.access(filePath));
  } finally {
    config.uploadDir = originalUploadDir;
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("product media paths reject traversal attempts", () => {
  assert.throws(
    () => productImageFilePath("company123", "product456", "../secret.webp"),
    /Invalid product image filename/
  );
});
