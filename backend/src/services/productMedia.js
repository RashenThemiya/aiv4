const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const config = require("../config");

const MAX_IMAGE_EDGE = 1600;
const WEBP_QUALITY = 85;

function safeSegment(value, label) {
  const segment = String(value || "").trim();
  if (!segment || !/^[a-zA-Z0-9_-]+$/.test(segment)) {
    throw new Error(`Invalid ${label}`);
  }
  return segment;
}

function productImageDirectory(companyId, productId) {
  return path.resolve(
    config.uploadDir,
    safeSegment(companyId, "company ID"),
    "products",
    safeSegment(productId, "product ID")
  );
}

function productImageFilePath(companyId, productId, fileName) {
  const directory = productImageDirectory(companyId, productId);
  const safeFileName = String(fileName || "").trim();
  if (!/^[a-zA-Z0-9_-]+\.webp$/.test(safeFileName)) {
    throw new Error("Invalid product image filename");
  }
  const filePath = path.resolve(directory, safeFileName);
  if (!filePath.startsWith(`${directory}${path.sep}`)) throw new Error("Invalid product image path");
  return filePath;
}

function productImagePublicPath(companyId, productId, fileName) {
  return `/media/products/${encodeURIComponent(String(companyId))}/${encodeURIComponent(String(productId))}/${encodeURIComponent(String(fileName))}`;
}

function absoluteProductImageUrl(companyId, productId, fileName) {
  const baseUrl = String(config.publicBackendUrl || `http://localhost:${config.port}`).replace(/\/$/, "");
  return `${baseUrl}${productImagePublicPath(companyId, productId, fileName)}`;
}

async function optimizeProductImage(buffer) {
  try {
    const result = await sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (!result.info.width || !result.info.height) throw new Error("Image dimensions are unavailable");
    return {
      buffer: result.data,
      mimeType: "image/webp",
      fileSize: result.data.length,
      width: result.info.width,
      height: result.info.height,
    };
  } catch (error) {
    const invalidImage = new Error("The selected image could not be read. Choose a valid JPG, PNG or WebP image.");
    invalidImage.code = "INVALID_PRODUCT_IMAGE";
    invalidImage.cause = error;
    throw invalidImage;
  }
}

async function saveProductImage({ companyId, productId, buffer, altText = "" }) {
  const optimized = await optimizeProductImage(buffer);
  const directory = productImageDirectory(companyId, productId);
  await fsp.mkdir(directory, { recursive: true });
  const fileName = `${crypto.randomUUID().replace(/-/g, "")}.webp`;
  const filePath = productImageFilePath(companyId, productId, fileName);
  const temporaryPath = `${filePath}.tmp`;

  try {
    await fsp.writeFile(temporaryPath, optimized.buffer, { flag: "wx" });
    await fsp.rename(temporaryPath, filePath);
  } catch (error) {
    await fsp.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }

  return {
    fileName,
    mimeType: optimized.mimeType,
    fileSize: optimized.fileSize,
    width: optimized.width,
    height: optimized.height,
    altText: String(altText || "").trim().slice(0, 300),
    imageUrl: productImagePublicPath(companyId, productId, fileName),
  };
}

async function removeProductImage(companyId, productId, image) {
  const fileName = image?.fileName;
  if (!fileName) return;
  const filePath = productImageFilePath(companyId, productId, fileName);
  await fsp.rm(filePath, { force: true });
  const directory = productImageDirectory(companyId, productId);
  if (fs.existsSync(directory) && (await fsp.readdir(directory)).length === 0) {
    await fsp.rmdir(directory).catch(() => {});
  }
}

module.exports = {
  absoluteProductImageUrl,
  optimizeProductImage,
  productImageDirectory,
  productImageFilePath,
  productImagePublicPath,
  removeProductImage,
  saveProductImage,
};
