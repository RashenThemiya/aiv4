const AdminUser = require("../models/AdminUser");
const { verifyToken } = require("../services/auth");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Authentication required" });

    const user = await AdminUser.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid admin user" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  next();
}

function canAccessCompany(req, res, next) {
  if (!req.user && req.baseUrl?.startsWith("/widget/")) return next();
  if (req.user?.role === "superadmin") return next();
  if (req.user?.companyId?.toString() === req.params.companyId || req.user?.companyId?.toString() === req.params.id) {
    return next();
  }
  return res.status(403).json({ error: "You can only access your assigned company" });
}

module.exports = { requireAuth, requireSuperAdmin, canAccessCompany };
