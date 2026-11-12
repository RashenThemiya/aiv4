const express = require("express");
const crypto = require("crypto");
const Company = require("../models/Company");
const TokenUsage = require("../models/TokenUsage");
const TokenWallet = require("../models/TokenWallet");
const CreditTransaction = require("../models/CreditTransaction");
const UsageReceipt = require("../models/UsageReceipt");
const CreditPurchaseRequest = require("../models/CreditPurchaseRequest");
const { requireSuperAdmin, canAccessCompany } = require("../middleware/auth");
const { addCredits, getTokenUsage, listTransactions } = require("../services/tokenUsage");

const router = express.Router();

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function createWidgetApiKey() {
  return `ragw_${crypto.randomBytes(32).toString("hex")}`;
}

const DEFAULT_WIDGET_THEME = {
  headerColor: "#000000",
  sendButtonColor: "#000000",
  launcherColor: "#000000",
  launcherIcon: "bot",
};

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeWidgetTheme(theme = {}, fallbackTheme = DEFAULT_WIDGET_THEME) {
  const source =
    theme && typeof theme.widgetTheme === "object" && theme.widgetTheme !== null
      ? theme.widgetTheme
      : theme || {};
  const fallback = {
    headerColor: isHexColor(fallbackTheme.headerColor)
      ? fallbackTheme.headerColor
      : DEFAULT_WIDGET_THEME.headerColor,
    sendButtonColor: isHexColor(fallbackTheme.sendButtonColor)
      ? fallbackTheme.sendButtonColor
      : DEFAULT_WIDGET_THEME.sendButtonColor,
    launcherColor: isHexColor(fallbackTheme.launcherColor)
      ? fallbackTheme.launcherColor
      : DEFAULT_WIDGET_THEME.launcherColor,
    launcherIcon: ["bot", "message", "question"].includes(fallbackTheme.launcherIcon)
      ? fallbackTheme.launcherIcon
      : DEFAULT_WIDGET_THEME.launcherIcon,
  };

  return {
    headerColor: isHexColor(source.headerColor)
      ? source.headerColor
      : fallback.headerColor,

    sendButtonColor: isHexColor(source.sendButtonColor)
      ? source.sendButtonColor
      : fallback.sendButtonColor,

    launcherColor: isHexColor(source.launcherColor)
      ? source.launcherColor
      : fallback.launcherColor,

    launcherIcon: ["bot", "message", "question"].includes(source.launcherIcon)
      ? source.launcherIcon
      : fallback.launcherIcon,
  };
}

router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const { name, description, slug, widgetTheme, monthlyTokenLimit } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Company name is required" });
    }

    const companySlug = slug || slugify(name);
    const existing = await Company.findOne({ slug: companySlug });
    if (existing) {
      return res.status(409).json({ error: "Company slug already exists" });
    }

    const company = await Company.create({
      name,
      slug: companySlug,
      description: description || "",
      widgetTheme: normalizeWidgetTheme(widgetTheme),
      monthlyTokenLimit:
        monthlyTokenLimit === undefined
          ? undefined
          : Math.max(0, Number(monthlyTokenLimit) || 0),
    });
    await TokenWallet.create({ companyId: company._id, status: "suspended" });

    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (_req, res) => {
  try {
    const filter =
      _req.user.role === "superadmin" ? {} : { _id: _req.user.companyId };
    const companies = await Company.find(filter).sort({ createdAt: -1 });
    const enriched = await Promise.all(
      companies.map(async (company) => ({
        ...company.toObject(),
        tokenUsage: await getTokenUsage(company._id),
      }))
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", canAccessCompany, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json({
      ...company.toObject(),
      tokenUsage: await getTokenUsage(company._id),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", canAccessCompany, async (req, res) => {
  try {
    const {
      name,
      description,
      isActive,
      widgetTheme,
      shippingDetails,
      assistantSettings,
      monthlyTokenLimit,
    } = req.body;

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    if (name !== undefined) company.name = name;
    if (description !== undefined) company.description = description;
    if (isActive !== undefined) company.isActive = isActive;
    if (monthlyTokenLimit !== undefined && req.user.role === "superadmin") {
      const parsedLimit = Number(monthlyTokenLimit);
      if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
        return res.status(400).json({ error: "Monthly token limit must be zero or greater" });
      }
      company.monthlyTokenLimit = Math.floor(parsedLimit);
    }
    if (shippingDetails && typeof shippingDetails === "object") {
      company.shippingDetails = {
        senderName: String(shippingDetails.senderName || "").trim(),
        phone: String(shippingDetails.phone || "").trim(),
        address: String(shippingDetails.address || "").trim(),
      };
    }
    if (assistantSettings && typeof assistantSettings === "object") {
      const welcome = assistantSettings.welcomeMessage || {};
      company.assistantSettings = {
        welcomeMessage: {
          en: String(welcome.en || "").trim().slice(0, 1200),
          si: String(welcome.si || "").trim().slice(0, 1200),
          ta: String(welcome.ta || "").trim().slice(0, 1200),
        },
        supportPhone: String(assistantSettings.supportPhone || "").trim().slice(0, 80),
        supportWhatsApp: String(assistantSettings.supportWhatsApp || "").trim().slice(0, 80),
        businessHours: String(assistantSettings.businessHours || "").trim().slice(0, 240),
      };
    }
    if (widgetTheme !== undefined) {
      company.widgetTheme = normalizeWidgetTheme(widgetTheme, company.widgetTheme);
    }

    await company.save();

    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/token-usage", canAccessCompany, async (req, res) => {
  try {
    const usage = await getTokenUsage(req.params.id);
    if (!usage) return res.status(404).json({ error: "Company not found" });
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/credits/transactions", canAccessCompany, async (req, res) => {
  try {
    const company = await Company.exists({ _id: req.params.id });
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(await listTransactions(req.params.id, req.query));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/credits", requireSuperAdmin, async (req, res) => {
  try {
    const result = await addCredits(req.params.id, {
      credits: req.body?.credits,
      type: req.body?.type,
      reference: String(req.body?.reference || "").trim(),
      paymentAmount: req.body?.paymentAmount,
      paymentCurrency: String(req.body?.paymentCurrency || "LKR").trim(),
      note: String(req.body?.note || "").trim(),
      source: "superadmin",
      createdBy: req.user._id,
    });
    res.status(result.duplicate ? 200 : 201).json({
      wallet: await getTokenUsage(req.params.id),
      transaction: result.transaction,
      duplicate: Boolean(result.duplicate),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.put("/:id/widget-theme", canAccessCompany, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    company.widgetTheme = normalizeWidgetTheme(req.body, company.widgetTheme);
    await company.save();

    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/widget-api-key", canAccessCompany, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).select("+widgetApiKeyHash");
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const apiKey = createWidgetApiKey();
    company.widgetApiKeyHash = hashApiKey(apiKey);
    company.widgetApiKeyPreview = `${apiKey.slice(0, 10)}...${apiKey.slice(-6)}`;
    await company.save();

    res.json({
      apiKey,
      widgetApiKeyPreview: company.widgetApiKeyPreview,
      message: "Widget API key generated. Copy it now; it will not be shown again.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    await TokenUsage.deleteMany({ companyId: company._id });
    await TokenWallet.deleteMany({ companyId: company._id });
    await CreditTransaction.deleteMany({ companyId: company._id });
    await UsageReceipt.deleteMany({ companyId: company._id });
    await CreditPurchaseRequest.deleteMany({ companyId: company._id });
    res.json({ message: "Company deleted", company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
