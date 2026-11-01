const express = require("express");
const AdminUser = require("../models/AdminUser");
const Company = require("../models/Company");
const { requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireSuperAdmin);

router.get("/", async (_req, res) => {
  try {
    const users = await AdminUser.find().sort({ createdAt: -1 }).populate("companyId", "name slug");
    res.json(users.map((user) => user.toSafeJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email, password, role, companyId } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Name, email, password, and role are required" });
    }
    if (role === "company_admin") {
      const company = await Company.findById(companyId);
      if (!company) return res.status(400).json({ error: "Valid companyId is required" });
    }

    const user = new AdminUser({
      name,
      email,
      role,
      companyId: role === "company_admin" ? companyId : null,
    });
    user.setPassword(password);
    await user.save();
    res.status(201).json(user.toSafeJSON());
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Admin email already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, role, companyId, password, isActive } = req.body;
    const user = await AdminUser.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Admin user not found" });

    if (role === "company_admin") {
      const company = await Company.findById(companyId);
      if (!company) return res.status(400).json({ error: "Valid companyId is required" });
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (role !== undefined || companyId !== undefined) {
      user.companyId = user.role === "company_admin" ? companyId : null;
    }
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.setPassword(password);
    await user.save();

    res.json(user.toSafeJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot delete your own admin account" });
    }
    const user = await AdminUser.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "Admin user not found" });
    res.json({ message: "Admin user deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
