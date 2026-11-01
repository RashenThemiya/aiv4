const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function documentKey(value) {
  const input = String(value || "").replace(/\\/g, "/");
  const directory = path.posix.dirname(input) === "."
    ? ""
    : path.posix.dirname(input).toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();
  const base = path.posix.basename(input, path.posix.extname(input))
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/[\s_-]+(?:copy|v(?:ersion)?)[\s_-]*\d*$/g, "")
    .replace(/[\s_-]+\d+$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return [directory, base].filter(Boolean).join("/");
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

module.exports = { documentKey, hashFile };
