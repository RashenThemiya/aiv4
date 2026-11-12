import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  FileSpreadsheet,
  Globe2,
  ImagePlus,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search as SearchIcon,
  Send,
  Settings2,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { api, formatDate } from "../lib/api";
import { loadMetaSdk, startMessengerLogin } from "../lib/metaSdk";
import { Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "./ui";
import { ToastBridge } from "./ToastProvider";
import { useDialog } from "./DialogProvider";

const emptyProduct = {
  sku: "",
  nameEn: "",
  nameSi: "",
  nameTa: "",
  price: "",
  currency: "LKR",
  stock: "",
  variants: [],
  isActive: true,
};

const emptyMessenger = {
  pageId: "",
  pageName: "",
  pageAccessToken: "",
  isActive: true,
};

function Alert({ error, notice }) {
  return <ToastBridge error={error} notice={notice} />;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value, currency = "LKR") {
  return `${currency} ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ProductManagementLegacy({ companyId }) {
  const dialog = useDialog();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [duplicateMode, setDuplicateMode] = useState("update");
  const [importResult, setImportResult] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setProducts(await api.products.list(companyId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [companyId]);

  function edit(product) {
    setEditingId(product._id);
    setForm({
      sku: product.sku || "",
      nameEn: product.name?.en || "",
      nameSi: product.name?.si || "",
      nameTa: product.name?.ta || "",
      price: String(product.price ?? ""),
      currency: product.currency || "LKR",
      stock: product.stock === null || product.stock === undefined ? "" : String(product.stock),
      variants: (product.variants || []).map((variant) => ({
        name: variant.name || "",
        sku: variant.sku || "",
        priceAdjustment: String(variant.priceAdjustment ?? 0),
        stock: variant.stock === null || variant.stock === undefined ? "" : String(variant.stock),
        isActive: variant.isActive !== false,
      })),
      isActive: product.isActive !== false,
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const payload = {
      sku: form.sku,
      name: { en: form.nameEn, si: form.nameSi, ta: form.nameTa },
      price: Number(form.price),
      currency: form.currency,
      stock: form.stock === "" ? null : Number(form.stock),
      variants: form.variants.map((variant) => ({
        ...variant,
        name: variant.name.trim(),
        sku: variant.sku.trim(),
        priceAdjustment: Number(variant.priceAdjustment || 0),
        stock: variant.stock === "" ? null : Number(variant.stock),
      })).filter((variant) => variant.name),
      isActive: form.isActive,
    };
    setLoading(true);
    try {
      if (editingId) await api.products.update(companyId, editingId, payload);
      else await api.products.create(companyId, payload);
      setNotice(editingId ? "Product updated" : "Product created");
      setEditingId("");
      setForm(emptyProduct);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(product) {
    const confirmed = await dialog.confirm({ title: "Delete product?", message: `Delete ${product.name?.en || product.sku} from this catalogue?`, confirmLabel: "Delete product", tone: "danger" });
    if (!confirmed) return;
    try {
      await api.products.remove(companyId, product._id);
      setNotice("Product deleted");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function updateVariant(index, field, value) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => (
        variantIndex === index ? { ...variant, [field]: value } : variant
      )),
    }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, { name: "", sku: "", priceAdjustment: "0", stock: "", isActive: true }],
    }));
  }

  function removeVariant(index) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
  }

  async function downloadTemplate() {
    try {
      const blob = await api.products.template(companyId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "product-catalogue-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  }

  async function importSpreadsheet(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLoading(true); setError(""); setNotice(""); setImportResult(null);
    try {
      const result = await api.products.import(companyId, file, duplicateMode);
      setImportResult(result);
      setNotice(`Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors.`);
      await load();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">{editingId ? "Edit product" : "Add product"}</h2>
          <p className="mt-1 text-sm text-slate-500">This catalogue controls products, prices, options, and ordering across the website, WhatsApp, Messenger, and voice assistant.</p>
        </div>
        <Alert error={error} notice={notice} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU"><TextInput required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="English name"><TextInput required value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></Field>
          <Field label="Sinhala name"><TextInput value={form.nameSi} onChange={(e) => setForm({ ...form, nameSi: e.target.value })} /></Field>
          <Field label="Tamil name"><TextInput value={form.nameTa} onChange={(e) => setForm({ ...form, nameTa: e.target.value })} /></Field>
          <Field label="Price"><TextInput required min="0" step="0.01" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Currency"><TextInput required value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
          <Field label="Stock (blank = unlimited)"><TextInput min="0" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-sm font-semibold text-slate-800">Product options</div><div className="text-xs text-slate-500">Add sizes, colours, or models and any price difference.</div></div>
            <SecondaryButton type="button" onClick={addVariant}><Plus size={15} /> Add option</SecondaryButton>
          </div>
          <div className="mt-3 space-y-3">
            {form.variants.map((variant, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
                <Field label="Option name"><TextInput required value={variant.name} placeholder="Smoke Grey" onChange={(e) => updateVariant(index, "name", e.target.value)} /></Field>
                <Field label="Option SKU"><TextInput value={variant.sku} placeholder="LHS-KTL-17-GRY" onChange={(e) => updateVariant(index, "sku", e.target.value)} /></Field>
                <Field label="Additional amount (+/-)"><TextInput type="number" step="0.01" placeholder="0 for same price, 900 to add LKR 900" value={variant.priceAdjustment} onChange={(e) => updateVariant(index, "priceAdjustment", e.target.value)} /></Field>
                <Field label="Stock (blank = unlimited)"><TextInput type="number" min="0" value={variant.stock} onChange={(e) => updateVariant(index, "stock", e.target.value)} /></Field>
                <div className="flex items-center justify-between gap-3 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={variant.isActive} onChange={(e) => updateVariant(index, "isActive", e.target.checked)} /> Available</label>
                  <SecondaryButton type="button" onClick={() => removeVariant(index)}><Trash2 size={15} /> Remove</SecondaryButton>
                </div>
              </div>
            ))}
            {!form.variants.length && <div className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500">No options. The base product will be ordered directly.</div>}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Available for ordering</label>
        <div className="flex gap-2">
          <PrimaryButton type="submit" disabled={loading}>{editingId ? "Save changes" : "Add product"}</PrimaryButton>
          {editingId && <SecondaryButton onClick={() => { setEditingId(""); setForm(emptyProduct); }}>Cancel</SecondaryButton>}
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-emerald-50/60 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3"><span className="rounded-xl bg-white p-2.5 text-emerald-700 shadow-sm"><FileSpreadsheet size={20}/></span><div><h3 className="font-bold text-slate-950">Bulk import with Excel</h3><p className="mt-1 text-sm text-slate-600">Download the template, fill one product per row, and upload the completed .xlsx file.</p></div></div>
            <div className="flex flex-wrap items-center gap-2"><SecondaryButton type="button" onClick={downloadTemplate}><Download size={16}/> Download template</SecondaryButton><select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={duplicateMode} onChange={(e)=>setDuplicateMode(e.target.value)}><option value="update">Update matching SKUs</option><option value="skip">Skip matching SKUs</option></select><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"><Upload size={16}/>{loading ? "Importing…" : "Upload Excel"}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" disabled={loading} onChange={importSpreadsheet}/></label></div>
          </div>
          {importResult?.errors?.length > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><div className="font-bold">Rows requiring attention</div><ul className="mt-2 list-disc space-y-1 pl-5">{importResult.errors.slice(0,20).map((item,index)=><li key={`${item.row}-${index}`}>Row {item.row}{item.sku ? ` (${item.sku})` : ""}: {item.error}</li>)}</ul>{importResult.errors.length>20&&<div className="mt-2">Plus {importResult.errors.length-20} more errors.</div>}</div>}
        </div>
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div><h2 className="text-lg font-bold">Product catalogue</h2><p className="text-sm text-slate-500">{products.length} products</p></div>
          <SecondaryButton onClick={load} disabled={loading}><RefreshCcw size={16} /> Refresh</SecondaryButton>
        </div>
        <div className="divide-y divide-slate-100">
          {products.map((product) => (
            <div key={product._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Package size={20} /></div>
                <div>
                  <div className="font-semibold">{product.name?.en || product.name?.si || product.name?.ta}</div>
                  <div className="text-sm text-slate-500">{product.sku} · {product.currency} {Number(product.price).toFixed(2)} · Stock {product.stock ?? "Unlimited"}</div>
                  <div className="mt-1 text-xs text-slate-400">{product.isActive ? "Active" : "Inactive"}{product.variants?.length ? ` · ${product.variants.map((item) => item.name).join(", ")}` : ""}</div>
                </div>
              </div>
              <div className="flex gap-2"><SecondaryButton onClick={() => edit(product)}><Pencil size={15} /> Edit</SecondaryButton><SecondaryButton onClick={() => remove(product)}><Trash2 size={15} /> Delete</SecondaryButton></div>
            </div>
          ))}
          {!products.length && <div className="p-10 text-center text-sm text-slate-500">No products yet. Add the first product to enable conversational ordering.</div>}
        </div>
      </section>
    </div>
  );
}

function ProductManagement({ companyId }) {
  const dialog = useDialog();
  const [catalogue, setCatalogue] = useState({ summary: {}, products: [], pagination: {} });
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState("");
  const [productModal, setProductModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [view, setView] = useState("grid");
  const [duplicateMode, setDuplicateMode] = useState("update");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const products = catalogue.products || [];
  const summary = catalogue.summary || {};
  const pagination = catalogue.pagination || { page: 1, pages: 1, total: 0 };
  const readableError = (err) => err?.technicalMessage || err?.message || "The request could not be completed.";
  const imageUrl = (product) => product?.imageUrl
    ? (/^https?:\/\//i.test(product.imageUrl) ? product.imageUrl : `${api.baseUrl}${product.imageUrl}`)
    : "";

  async function load(targetPage = page, targetPageSize = pageSize) {
    setLoading(true);
    try {
      setCatalogue(await api.products.dashboard(companyId, {
        search: appliedSearch,
        status,
        page: targetPage,
        limit: targetPageSize,
      }));
    } catch (err) { setError(readableError(err)); } finally { setLoading(false); }
  }

  useEffect(() => { load(page, pageSize); }, [companyId, appliedSearch, status, page, pageSize]);
  useEffect(() => () => { if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  function closeProductModal() {
    setProductModal(false); setEditingId(""); setForm(emptyProduct);
    setImageFile(null); setImagePreview(""); setRemoveImage(false);
  }

  function openAdd() {
    setError(""); setEditingId(""); setForm(emptyProduct);
    setImageFile(null); setImagePreview(""); setRemoveImage(false); setProductModal(true);
  }

  function openEdit(product) {
    setEditingId(product._id);
    setForm({
      sku: product.sku || "", nameEn: product.name?.en || "", nameSi: product.name?.si || "",
      nameTa: product.name?.ta || "", price: String(product.price ?? ""), currency: product.currency || "LKR",
      stock: product.stock == null ? "" : String(product.stock), isActive: product.isActive !== false,
      variants: (product.variants || []).map((variant) => ({
        name: variant.name || "", sku: variant.sku || "", priceAdjustment: String(variant.priceAdjustment ?? 0),
        stock: variant.stock == null ? "" : String(variant.stock), isActive: variant.isActive !== false,
      })),
    });
    setImageFile(null); setImagePreview(imageUrl(product)); setRemoveImage(false); setProductModal(true);
  }

  function updateVariant(index, field, value) {
    setForm((current) => ({ ...current, variants: current.variants.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }

  function pickImage(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a JPG, PNG or WebP image smaller than 5 MB."); return;
    }
    setImageFile(file); setImagePreview(URL.createObjectURL(file)); setRemoveImage(false);
  }

  async function saveProduct(event) {
    event.preventDefault(); setLoading(true); setError(""); setNotice("");
    const payload = {
      sku: form.sku, name: { en: form.nameEn, si: form.nameSi, ta: form.nameTa },
      price: Number(form.price), currency: form.currency, stock: form.stock === "" ? null : Number(form.stock),
      isActive: form.isActive,
      variants: form.variants.map((variant) => ({ ...variant, priceAdjustment: Number(variant.priceAdjustment || 0), stock: variant.stock === "" ? null : Number(variant.stock) })).filter((variant) => variant.name.trim()),
    };
    try {
      const product = editingId ? await api.products.update(companyId, editingId, payload) : await api.products.create(companyId, payload);
      if (imageFile) await api.products.uploadImage(companyId, product._id, imageFile, form.nameEn || form.nameSi || form.nameTa);
      else if (editingId && removeImage) await api.products.removeImage(companyId, editingId);
      setNotice(editingId ? "Product updated successfully." : "Product added successfully.");
      closeProductModal(); await load();
    } catch (err) { setError(readableError(err)); } finally { setLoading(false); }
  }

  async function deleteProduct(product) {
    const confirmed = await dialog.confirm({ title: "Delete product?", message: `Delete ${product.name?.en || product.sku} from this catalogue?`, confirmLabel: "Delete product", tone: "danger" });
    if (!confirmed) return;
    try { await api.products.remove(companyId, product._id); setNotice("Product deleted."); await load(); }
    catch (err) { setError(readableError(err)); }
  }

  async function downloadTemplate() {
    try {
      const blob = await api.products.template(companyId); const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "product-catalogue-template.xlsx"; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(readableError(err)); }
  }

  async function pickImport(file) {
    if (!file) return; setImportFile(file); setImportPreview(null); setImportResult(null); setLoading(true); setError("");
    try { setImportPreview(await api.products.previewImport(companyId, file)); }
    catch (err) { setError(readableError(err)); } finally { setLoading(false); }
  }

  async function importProducts(event) {
    event.preventDefault(); if (!importFile) return; setLoading(true); setError("");
    try {
      const result = await api.products.import(companyId, importFile, duplicateMode); setImportResult(result);
      setNotice(`Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`); await load();
      if (!result.errors.length) { setImportModal(false); setImportFile(null); setImportPreview(null); }
    } catch (err) { setError(readableError(err)); } finally { setLoading(false); }
  }

  const statCards = [
    ["Total products", summary.total || 0, Boxes, "border-blue-100 bg-gradient-to-br from-white via-blue-50/70 to-blue-100/60", "bg-blue-100 text-blue-700"],
    ["Active products", summary.active || 0, BadgeCheck, "border-violet-100 bg-gradient-to-br from-white via-violet-50/70 to-violet-100/60", "bg-violet-100 text-violet-700"],
    ["Low stock", summary.lowStock || 0, AlertTriangle, "border-emerald-100 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/60", "bg-emerald-100 text-emerald-700"],
    ["Catalogue value", `LKR ${Number(summary.inventoryValue || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`, WalletCards, "border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-orange-100/70", "bg-orange-100 text-orange-700"],
  ];
  const totalProductPages = Math.max(1, pagination.pages || 1);
  const firstProductShown = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const lastProductShown = pagination.total ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;
  const productPageButtons = Array.from(new Set([
    1,
    pagination.page - 1,
    pagination.page,
    pagination.page + 1,
    totalProductPages,
  ])).filter((item) => item >= 1 && item <= totalProductPages).sort((a, b) => a - b);

  return <div className="catalogue-page space-y-6">
    <Alert error={error} notice={notice}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statCards.map(([label, value, Icon, card, iconStyle]) => <div key={label} className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${card}`}><div className="absolute -bottom-8 -right-6 h-24 w-24 rounded-full bg-white/45"/><div className="relative flex items-center gap-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${iconStyle}`}><Icon size={23} strokeWidth={2.3}/></span><div className="min-w-0"><div className="text-sm font-semibold text-slate-600">{label}</div><div className={`${label === "Catalogue value" ? "text-2xl" : "text-3xl"} mt-1 truncate font-bold tracking-tight text-slate-950`}>{value}</div></div></div></div>)}</div>

    <section className="catalogue-toolbar rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <form className="grid flex-1 gap-4 sm:grid-cols-[minmax(280px,420px)_245px_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedSearch(search.trim()); }}><label className="block"><span className="mb-2 block text-sm font-bold text-[#14234b]">Search Products</span><span className="relative block"><SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19}/><input className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product name, SKU or category..."/></span></label><label className="block"><span className="mb-2 block text-sm font-bold text-[#14234b]">Status</span><select className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-[#14234b] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All Products</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"><SearchIcon size={19}/> Search</button></form>
      <div className="flex gap-3"><button type="button" onClick={() => { setImportModal(true); setImportResult(null); }} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-[#14234b] transition hover:border-blue-400 hover:bg-blue-50"><Upload size={18}/> Import Excel</button><button type="button" onClick={openAdd} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"><Plus size={20}/> Add Product</button></div>
    </div></section>

    <section className="catalogue-products-panel overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center text-blue-700"><Package size={31} strokeWidth={2.2}/></span><div><h2 className="text-xl font-black text-[#101f4a]">Products</h2><p className="text-sm text-slate-500">{pagination.total || 0} products in your catalogue</p></div></div><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => load(page, pageSize)} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-[#14234b] hover:bg-slate-50 disabled:opacity-50"><RefreshCcw className={loading ? "animate-spin" : ""} size={16}/> Refresh</button><button type="button" onClick={downloadTemplate} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-[#14234b] hover:bg-slate-50"><Download size={17}/> Download Template</button><div className="flex rounded-xl border border-slate-300 bg-white p-1"><button type="button" className={`rounded-lg p-2 ${view === "grid" ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "text-slate-600"}`} onClick={() => setView("grid")}><LayoutGrid size={20}/></button><button type="button" className={`rounded-lg p-2 ${view === "list" ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "text-slate-600"}`} onClick={() => setView("list")}><List size={20}/></button></div></div></div>
      <div className={`max-h-[62vh] overflow-auto overscroll-contain ${view === "grid" ? "grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3" : "divide-y divide-slate-100"}`}>
        {products.map((product) => {
          const name = product.name?.en || product.name?.si || product.name?.ta || product.sku;
          const src = imageUrl(product);
          return <article key={product._id} className={view === "grid" ? "relative flex min-h-[174px] gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg" : "relative flex gap-4 p-4"}>
            <div className={view === "grid" ? "flex w-[132px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100" : "flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50"}>{src ? <img src={src} alt={product.image?.altText || name} className="h-full w-full object-contain p-2"/> : <Package className="text-slate-300" size={view === "grid" ? 44 : 28}/>}</div>
            <div className="min-w-0 flex-1 py-1">
              <div className="flex min-h-8 items-start justify-between gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${product.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}><span className={`h-2 w-2 rounded-full ${product.isActive ? "bg-emerald-500" : "bg-slate-400"}`}/>{product.isActive ? "Active" : "Inactive"}</span><div className="flex gap-1"><button type="button" title="Edit" className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs font-bold text-[#14234b] hover:border-blue-400 hover:bg-blue-50" onClick={() => openEdit(product)}><Pencil size={13}/> Edit</button><button type="button" title="Delete" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-[#14234b] hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600" onClick={() => deleteProduct(product)}><Trash2 size={14}/></button></div></div>
              <h3 className="mt-1 truncate text-base font-black text-[#101b3f]">{name}</h3>
              <p className="mt-0.5 text-sm text-slate-500">SKU: {product.sku}</p>
              <div className="mt-1 text-base font-black text-[#101b3f]">{money(product.price, product.currency)}</div>
              <div className={`mt-1 flex items-center gap-1.5 text-sm ${Number.isInteger(product.stock) && product.stock <= 5 ? "font-bold text-amber-600" : "text-slate-600"}`}><Package size={14}/> Stock: {product.stock ?? "Unlimited"}</div>
              {product.variants?.length > 0 && <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-slate-600"><span>Variants:</span>{product.variants.slice(0, 3).map((variant) => <span key={variant._id || variant.name} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{variant.name}</span>)}</div>}
            </div>
          </article>;
        })}
        {!products.length && <div className="col-span-full p-12 text-center text-sm text-slate-500"><Package className="mx-auto mb-3 text-slate-300" size={42}/>No products found. Add a product or change the filters.</div>}
      </div>
      <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-slate-600"><span>Showing <strong className="text-slate-900">{firstProductShown}–{lastProductShown}</strong> of <strong className="text-slate-900">{pagination.total || 0}</strong></span><label className="flex items-center gap-2"><span>Products per page</span><select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={20}>20</option><option value={50}>50</option></select></label></div>
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Product catalogue pagination">
          <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={pagination.page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16}/> Previous</button>
          {productPageButtons.map((pageNumber, index) => <span key={pageNumber} className="contents">{index > 0 && pageNumber - productPageButtons[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}<button type="button" aria-current={pageNumber === pagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-lg border px-3 font-bold transition ${pageNumber === pagination.page ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`} disabled={loading} onClick={() => setPage(pageNumber)}>{pageNumber}</button></span>)}
          <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={pagination.page >= totalProductPages || loading} onClick={() => setPage((current) => Math.min(totalProductPages, current + 1))}>Next <ChevronRight size={16}/></button>
        </nav>
      </div>
    </section>

    {productModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071a43]/75 p-4 backdrop-blur-[2px]">
      <form onSubmit={saveProduct} className="max-h-[94vh] w-full max-w-[960px] overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-8 pb-4 pt-6">
          <div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center text-blue-600"><Package size={48} strokeWidth={2.2}/></span><div><h2 className="text-3xl font-black tracking-tight text-[#07163d]">{editingId ? "Edit Product" : "Add New Product"}</h2><p className="text-base text-slate-500">Create a product for your catalogue and ordering channels.</p></div></div>
          <button type="button" onClick={closeProductModal} className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[#07163d] hover:bg-slate-200"><X size={25}/></button>
        </div>
        <div className="space-y-5 px-8 pb-6">
          <div className="grid gap-8 md:grid-cols-[342px_minmax(0,1fr)]">
            <div><div className="mb-3 text-lg font-black text-[#07163d]">Product Image</div><label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); pickImage(event.dataTransfer.files?.[0]); }} className="flex min-h-[280px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-blue-600 bg-gradient-to-br from-white to-blue-50/60 p-5 text-center">{imagePreview && !removeImage ? <img src={imagePreview} alt="Preview" className="h-[220px] w-full object-contain"/> : <><Upload className="text-blue-600" size={48}/><span className="mt-4 text-lg font-black text-[#07163d]">Drag & drop a product image</span><span className="mt-1 text-sm text-slate-500">PNG, JPG or WebP · Max 5 MB</span><span className="mt-4 rounded-xl border border-blue-600 bg-white px-8 py-2 text-sm font-bold text-blue-700">Browse Files</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => pickImage(event.target.files?.[0])}/></label>{imagePreview && !removeImage && <button type="button" className="mt-2 w-full text-sm font-bold text-rose-600" onClick={() => { setImageFile(null); setImagePreview(""); setRemoveImage(true); }}>Remove image</button>}</div>
            <div className="grid content-start gap-x-7 gap-y-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-2 block text-base font-black text-[#07163d]">Product Name</span><input required className="h-11 w-full rounded-lg border border-slate-300 px-4 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10" placeholder="Enter product name" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })}/></label>
              <label><span className="mb-2 block text-base font-black text-[#07163d]">SKU</span><input required className="h-11 w-full rounded-lg border border-slate-300 px-4 outline-none focus:border-blue-600" placeholder="Enter SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}/></label>
              <label><span className="mb-2 block text-base font-black text-[#07163d]">Price</span><input required type="number" min="0" step="0.01" className="h-11 w-full rounded-lg border border-slate-300 px-4 outline-none focus:border-blue-600" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}/></label>
              <label><span className="mb-2 block text-base font-black text-[#07163d]">Currency</span><select className="h-11 w-full rounded-lg border border-slate-300 px-4 outline-none focus:border-blue-600" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="LKR">LKR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></label>
              <label><span className="mb-2 block text-base font-black text-[#07163d]">Stock</span><input type="number" min="0" className="h-11 w-full rounded-lg border border-slate-300 px-4 outline-none focus:border-blue-600" placeholder="Enter stock quantity" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}/><span className="mt-1 block text-xs text-slate-500">Leave blank for unlimited</span></label>
              <label className="flex items-center gap-3 self-end sm:col-span-2"><span className="relative inline-flex h-8 w-14 items-center"><input type="checkbox" className="peer sr-only" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}/><span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-blue-600"/><span className="relative ml-1 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-6"/></span><span className="text-base font-black text-[#07163d]">Active for ordering</span></label>
            </div>
          </div>
          <div className="border-t border-slate-300 pt-3"><h3 className="text-2xl font-black text-[#07163d]">Variants &amp; Options</h3><p className="text-sm text-slate-500">Add colours, sizes or models.</p>
            <div className="mt-3 space-y-3">{form.variants.map((variant, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-300 bg-slate-50/60 p-3 sm:grid-cols-[1.25fr_1.25fr_1fr_.8fr_40px]"><Field label="Option Name"><TextInput required value={variant.name} onChange={(e) => updateVariant(index, "name", e.target.value)}/></Field><Field label="Option SKU"><TextInput value={variant.sku} onChange={(e) => updateVariant(index, "sku", e.target.value)}/></Field><Field label="Price Adjustment"><TextInput type="number" step="0.01" value={variant.priceAdjustment} onChange={(e) => updateVariant(index, "priceAdjustment", e.target.value)}/></Field><Field label="Stock"><TextInput type="number" min="0" value={variant.stock} onChange={(e) => updateVariant(index, "stock", e.target.value)}/></Field><button type="button" title="Remove option" className="mt-6 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-[#14234b] hover:bg-rose-50 hover:text-rose-600" onClick={() => setForm({ ...form, variants: form.variants.filter((_, i) => i !== index) })}><Trash2 size={16}/></button></div>)}</div>
            <button type="button" onClick={() => setForm({ ...form, variants: [...form.variants, { name: "", sku: "", priceAdjustment: "0", stock: "", isActive: true }] })} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-blue-600 px-5 text-sm font-bold text-blue-700 hover:bg-blue-50"><Plus size={17}/> Add Option</button>
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-4 border-t border-slate-300 bg-white px-8 py-4"><button type="button" onClick={closeProductModal} className="h-11 rounded-xl border border-slate-300 px-8 font-bold text-[#14234b] hover:bg-slate-50">Cancel</button><button type="submit" disabled={loading} className="h-11 rounded-xl bg-blue-600 px-9 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">{loading ? "Saving..." : editingId ? "Save Changes" : "Save Product"}</button></div>
      </form>
    </div>}

    {importModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071a43]/75 p-4 backdrop-blur-[2px]">
      <form onSubmit={importProducts} className="max-h-[94vh] w-full max-w-[870px] overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between px-8 pb-5 pt-6"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white"><FileSpreadsheet size={33}/></span><div><h2 className="text-3xl font-black tracking-tight text-[#07163d]">Import Products from Excel</h2><p className="text-base text-slate-500">Add or update many catalogue products at once.</p></div></div><button type="button" onClick={() => setImportModal(false)} className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[#07163d] hover:bg-slate-200"><X size={25}/></button></div>
        <div className="space-y-3 px-7">
          <section className="flex items-center gap-5 rounded-2xl border border-slate-300 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-2xl font-black text-emerald-700">1</span><div className="min-w-0 flex-1"><h3 className="text-xl font-black text-[#07163d]">Download the template</h3><p className="text-sm text-slate-500">Use the required columns and keep the header row unchanged.</p></div><button type="button" onClick={downloadTemplate} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-5 text-sm font-bold text-[#14234b] hover:bg-slate-50"><Download size={17}/> Download Template</button></section>
          <section className="flex items-start gap-5 rounded-2xl border border-slate-300 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-2xl font-black text-emerald-700">2</span><div className="flex-1"><h3 className="text-xl font-black text-[#07163d]">Choose how duplicates are handled</h3><div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]"><label className="text-sm font-bold text-[#14234b]">Matching SKUs</label><select className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-emerald-600" value={duplicateMode} onChange={(e) => setDuplicateMode(e.target.value)}><option value="update">Update existing products</option><option value="skip">Skip existing products</option></select></div><p className="mt-2 text-sm text-slate-500">{duplicateMode === "update" ? "Products with the same SKU will be updated." : "Products with the same SKU will be left unchanged."}</p></div></section>
          <section className="flex items-start gap-5 rounded-2xl border border-slate-300 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-2xl font-black text-emerald-700">3</span><div className="min-w-0 flex-1"><h3 className="text-xl font-black text-[#07163d]">Upload your completed file</h3><label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); pickImport(event.dataTransfer.files?.[0]); }} className="mt-3 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-600 bg-gradient-to-br from-white to-emerald-50/70 p-5 text-center"><FileSpreadsheet className="text-emerald-600" size={52}/><span className="mt-2 text-lg font-black text-[#07163d]">Drag &amp; drop your Excel file</span><span className="text-sm text-slate-500">.XLSX only · Maximum 10 MB</span><span className="mt-3 rounded-xl border border-slate-400 bg-white px-7 py-2 text-sm font-bold text-[#14234b]">Choose Excel File</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => pickImport(event.target.files?.[0])}/></label>{importFile && <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white"><FileSpreadsheet size={21}/></span><div className="min-w-0 flex-1"><div className="truncate font-bold text-[#14234b]">{importFile.name}</div><div className="text-xs text-slate-500">{importPreview ? `${importPreview.totalRows} product rows · ` : "Validating · "}{Math.max(1, Math.round(importFile.size / 1024))} KB</div></div>{importPreview && <span className={`rounded-full px-3 py-1 text-xs font-bold ${importPreview.errorRows ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{importPreview.errorRows ? `${importPreview.errorRows} errors` : "✓ Ready to import"}</span>}<button type="button" onClick={() => { setImportFile(null); setImportPreview(null); setImportResult(null); }} className="p-1 text-[#14234b]"><X size={19}/></button></div>}</div></section>
          <section className="flex items-center gap-5 rounded-2xl bg-blue-50 px-6 py-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-blue-600 text-xl font-black text-blue-700">i</span><div className="font-black text-[#07163d]">Before importing</div><div className="h-16 w-px bg-blue-200"/><ul className="space-y-1 text-sm text-[#14234b]"><li>✓ Product Name and SKU are required</li><li>✓ Use the template format for product variants</li><li>✓ Product images can be added after import</li></ul></section>
          {(importResult?.errors?.length > 0 || importPreview?.errors?.length > 0) && <div className="max-h-28 overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{(importResult?.errors || importPreview.errors).slice(0, 20).map((item, index) => <div key={`${item.row}-${index}`}>Row {item.row}: {item.error}</div>)}</div>}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-200 px-8 py-4"><p className="text-sm text-slate-500">Your file is validated before products are saved.</p><div className="flex gap-3"><button type="button" onClick={() => setImportModal(false)} className="h-11 rounded-xl border border-slate-300 px-8 font-bold text-[#14234b] hover:bg-slate-50">Cancel</button><button type="submit" disabled={loading || !importPreview} className="h-11 rounded-xl bg-emerald-600 px-8 font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">{loading ? "Checking..." : `Import ${importPreview?.validRows || 0} Products`}</button></div></div>
      </form>
    </div>}
  </div>;
}

function OrderManagement({ companyId, company }) {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingOrder, setEditingOrder] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

  async function load(targetPage = page, targetPageSize = pageSize) {
    setLoading(true);
    setError("");
    try {
      const [orderResult, summaryResult] = await Promise.all([
        api.orders.list(companyId, { status, search, page: targetPage, limit: targetPageSize }),
        api.orders.summary(companyId),
      ]);
      const nextOrders = orderResult.orders || [];
      setOrders(nextOrders);
      setPagination({
        page: orderResult.page || targetPage,
        limit: orderResult.limit || targetPageSize,
        total: orderResult.total || 0,
        pages: Math.max(1, orderResult.pages || 1),
      });
      const visibleIds = new Set(nextOrders.map((order) => order._id));
      setSelectedOrderIds((current) => new Set([...current].filter((id) => visibleIds.has(id))));
      setSummary(summaryResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page, pageSize); }, [companyId, status, page, pageSize]);

  function applySearch() {
    if (page === 1) load(1, pageSize);
    else setPage(1);
  }

  function changeStatus(nextStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  function changePageSize(nextSize) {
    setPageSize(nextSize);
    setPage(1);
  }

  async function setOrderStatus(orderId, nextStatus) {
    try {
      const updated = await api.orders.setStatus(companyId, orderId, nextStatus);
      if (updated.trackingNotificationResult?.status === "sent") {
        setNotice("Order status updated and the customer received the tracking details.");
      } else if (updated.trackingNotificationResult?.status === "failed") {
        setError(`Order status updated, but the tracking notification failed: ${updated.trackingNotificationResult.error || "Try sending it again."}`);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditingOrder(order) {
    setError("");
    setNotice("");
    setEditingOrder(order);
    setEditForm({
      customer: {
        name: order.customer?.name || "",
        phone: order.customer?.phone || "",
        deliveryAddress: order.customer?.deliveryAddress || "",
      },
      items: (order.items || []).map((item) => ({
        productId: item.productId || "",
        sku: item.sku || "",
        name: item.name || "",
        variant: item.variant || "",
        quantity: String(item.quantity || 1),
        unitPrice: String(item.unitPrice ?? 0),
      })),
      deliveryFee: String(order.deliveryFee ?? 0),
      currency: order.currency || "LKR",
      paymentMethod: order.paymentMethod || "",
      priceStatus: order.priceStatus || "pending",
      status: order.status || "new",
      notes: order.notes || "",
      tracking: {
        courierName: order.tracking?.courierName || "",
        trackingId: order.tracking?.trackingId || "",
        trackingUrl: order.tracking?.trackingUrl || "",
      },
    });
  }

  async function copyTrackingMessage(order, trackingOverride = null) {
    const tracking = trackingOverride || order?.tracking || {};
    const parts = [`Your order ${order?.orderNumber || ""} has been handed over for delivery.`];
    if (tracking.courierName) parts.push(`Courier: ${tracking.courierName}`);
    if (tracking.trackingId) parts.push(`Tracking ID: ${tracking.trackingId}`);
    if (tracking.trackingUrl) parts.push(`Track your parcel: ${tracking.trackingUrl}`);
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      setNotice("Customer tracking message copied.");
    } catch (_error) {
      setError("The tracking message could not be copied. Copy the tracking details manually.");
    }
  }

  function updateOrderItem(index, field, value) {
    setEditForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      )),
    }));
  }

  function addOrderItem() {
    setEditForm((current) => ({
      ...current,
      items: [...current.items, {
        productId: "", sku: "", name: "", variant: "", quantity: "1", unitPrice: "0",
      }],
    }));
  }

  function removeOrderItem(index) {
    setEditForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveOrderEdit(event) {
    event.preventDefault();
    if (!editingOrder || !editForm) return;
    setSavingOrder(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.orders.update(companyId, editingOrder._id, {
        ...editForm,
        expectedUpdatedAt: editingOrder.updatedAt,
        deliveryFee: Number(editForm.deliveryFee || 0),
        items: editForm.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      });
      setEditingOrder(null);
      setEditForm(null);
      if (updated.trackingNotificationResult?.status === "sent" && updated.trackingNotificationResult?.attempted) {
        setNotice(`Order ${editingOrder.orderNumber} was updated and tracking details were sent to the customer.`);
      } else if (updated.trackingNotificationResult?.status === "failed") {
        setError(`Order ${editingOrder.orderNumber} was updated, but the tracking notification failed: ${updated.trackingNotificationResult.error || "Try sending it again."}`);
      } else {
        setNotice(`Order ${editingOrder.orderNumber} updated successfully.`);
      }
      await load();
    } catch (err) {
      setError(err.technicalMessage || err.message);
    } finally {
      setSavingOrder(false);
    }
  }

  async function retryTrackingNotification(order) {
    setSavingOrder(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.orders.retryTrackingNotification(companyId, order._id);
      if (updated.trackingNotificationResult?.status === "sent") {
        setNotice(`Tracking details for ${order.orderNumber} were sent successfully.`);
      } else {
        setError(updated.trackingNotificationResult?.error || "The tracking notification could not be sent.");
      }
      if (editingOrder?._id === order._id) setEditingOrder(updated);
      await load();
    } catch (err) {
      setError(err.technicalMessage || err.message);
    } finally {
      setSavingOrder(false);
    }
  }

  const selectedOrders = orders.filter((order) => selectedOrderIds.has(order._id));
  const totalPages = Math.max(1, pagination.pages || 1);
  const firstShown = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const lastShown = pagination.total ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;
  const pageButtons = Array.from(new Set([
    1,
    pagination.page - 1,
    pagination.page,
    pagination.page + 1,
    totalPages,
  ])).filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);

  function toggleOrderSelection(orderId) {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleAllVisibleOrders() {
    setSelectedOrderIds((current) => {
      const allVisibleSelected = orders.length > 0 && orders.every((order) => current.has(order._id));
      if (allVisibleSelected) return new Set();
      return new Set(orders.map((order) => order._id));
    });
  }

  function printBill(order) {
    const printWindow = window.open("", "_blank", "width=900,height=760");
    if (!printWindow) {
      setError("Your browser blocked the print window. Allow pop-ups for this dashboard and try again.");
      return;
    }
    printWindow.opener = null;
    const confirmedPrice = order.priceStatus !== "pending";
    const currency = order.currency || "LKR";
    const rows = (order.items || []).map((item) => `
      <tr>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
          ${item.variant ? `<div class="muted">Option: ${escapeHtml(item.variant)}</div>` : ""}
          ${item.sku ? `<div class="muted">SKU: ${escapeHtml(item.sku)}</div>` : ""}
        </td>
        <td class="number">${escapeHtml(item.quantity)}</td>
        <td class="number">${confirmedPrice ? escapeHtml(money(item.unitPrice, currency)) : "Pending"}</td>
        <td class="number">${confirmedPrice ? escapeHtml(money(item.lineTotal, currency)) : "Pending"}</td>
      </tr>
    `).join("");
    const totalLabel = confirmedPrice ? money(order.total, currency) : "Seller to confirm";
    const createdAt = order.createdAt
      ? new Date(order.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })
      : "-";
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(order.orderNumber)} - Order bill</title>
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #0f172a; font: 14px/1.5 Arial, sans-serif; }
            .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 2px solid #0f766e; }
            .brand { color: #0f766e; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
            h1 { margin: 5px 0 0; font-size: 27px; }
            .bill-title { text-align: right; }
            .bill-title strong { display: block; font-size: 18px; }
            .muted { color: #64748b; font-size: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 26px 0; }
            h2 { margin: 0 0 8px; color: #475569; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
            p { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { padding: 10px; background: #f1f5f9; color: #475569; font-size: 11px; letter-spacing: .05em; text-align: left; text-transform: uppercase; }
            td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            .number { text-align: right; white-space: nowrap; }
            .summary { width: 330px; margin: 24px 0 0 auto; }
            .summary div { display: flex; justify-content: space-between; gap: 20px; padding: 5px 0; }
            .summary .total { margin-top: 8px; padding-top: 12px; border-top: 2px solid #0f172a; font-size: 18px; font-weight: 700; }
            .status { display: inline-block; padding: 3px 9px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            .footer { margin-top: 42px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <header class="header">
            <div><div class="brand">${escapeHtml(company?.name || "Pentarix AI Assistant")}</div><h1>Order Bill</h1></div>
            <div class="bill-title"><strong>${escapeHtml(order.orderNumber)}</strong><span class="muted">${escapeHtml(createdAt)}</span></div>
          </header>
          <section class="grid">
            <div>
              <h2>Bill to</h2>
              <p><strong>${escapeHtml(order.customer?.name || "-")}</strong></p>
              <p>${escapeHtml(order.customer?.phone || "No phone number")}</p>
              <p>${escapeHtml(order.customer?.deliveryAddress || "No delivery address")}</p>
            </div>
            <div>
              <h2>Order details</h2>
              <p>Payment: <strong>${escapeHtml(order.paymentMethod || "-")}</strong></p>
              <p>Channel: ${escapeHtml(order.channel || "-")} · ${escapeHtml((order.language || "").toUpperCase())}</p>
              <p>Status: <span class="status">${escapeHtml(order.status || "new")}</span></p>
            </div>
          </section>
          <table>
            <thead><tr><th>Item</th><th class="number">Qty</th><th class="number">Unit price</th><th class="number">Amount</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">No items</td></tr>'}</tbody>
          </table>
          <section class="summary">
            ${confirmedPrice ? `<div><span>Subtotal</span><strong>${escapeHtml(money(order.subtotal, currency))}</strong></div><div><span>Delivery</span><strong>${escapeHtml(money(order.deliveryFee, currency))}</strong></div>` : ""}
            <div class="total"><span>Total</span><span>${escapeHtml(totalLabel)}</span></div>
          </section>
          <footer class="footer">Generated by Pentarix AI Assistant</footer>
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  function printSelectedBills() {
    if (!selectedOrders.length) return;
    const printWindow = window.open("", "_blank", "width=1000,height=820");
    if (!printWindow) {
      setError("Your browser blocked the print window. Allow pop-ups for this dashboard and try again.");
      return;
    }
    printWindow.opener = null;
    const pages = selectedOrders.map((order) => {
      const confirmedPrice = order.priceStatus !== "pending";
      const currency = order.currency || "LKR";
      const rows = (order.items || []).map((item) => `
        <tr><td><strong>${escapeHtml(item.name || "Item")}</strong>${item.variant ? `<div class="muted">Option: ${escapeHtml(item.variant)}</div>` : ""}${item.sku ? `<div class="muted">SKU: ${escapeHtml(item.sku)}</div>` : ""}</td><td class="number">${escapeHtml(item.quantity)}</td><td class="number">${confirmedPrice ? escapeHtml(money(item.unitPrice, currency)) : "Pending"}</td><td class="number">${confirmedPrice ? escapeHtml(money(item.lineTotal, currency)) : "Pending"}</td></tr>
      `).join("");
      const totalLabel = confirmedPrice ? money(order.total, currency) : "Seller to confirm";
      const createdAt = order.createdAt
        ? new Date(order.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })
        : "-";
      return `<article class="bill-page">
        <header class="header"><div><div class="brand">${escapeHtml(company?.name || "Business")}</div><h1>Order Bill</h1></div><div class="bill-title"><strong>${escapeHtml(order.orderNumber)}</strong><span class="muted">${escapeHtml(createdAt)}</span></div></header>
        <section class="grid"><div><h2>Bill to</h2><p><strong>${escapeHtml(order.customer?.name || "-")}</strong></p><p>${escapeHtml(order.customer?.phone || "No phone number")}</p><p>${escapeHtml(order.customer?.deliveryAddress || "No delivery address")}</p></div><div><h2>Order details</h2><p>Payment: <strong>${escapeHtml(order.paymentMethod || "-")}</strong></p><p>Channel: ${escapeHtml(order.channel || "-")} / ${escapeHtml((order.language || "").toUpperCase())}</p><p>Status: <span class="status">${escapeHtml(order.status || "new")}</span></p></div></section>
        <table><thead><tr><th>Item</th><th class="number">Qty</th><th class="number">Unit price</th><th class="number">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No items</td></tr>'}</tbody></table>
        <section class="summary">${confirmedPrice ? `<div><span>Subtotal</span><strong>${escapeHtml(money(order.subtotal, currency))}</strong></div><div><span>Delivery</span><strong>${escapeHtml(money(order.deliveryFee, currency))}</strong></div>` : ""}<div class="total"><span>Total</span><span>${escapeHtml(totalLabel)}</span></div></section>
        <footer class="footer">Generated by Pentarix AI Assistant</footer>
      </article>`;
    }).join("");
    printWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Selected order bills</title><style>
      @page { size: A4; margin: 16mm; } * { box-sizing: border-box; } body { margin: 0; color: #0f172a; font: 14px/1.5 Arial, sans-serif; }
      .bill-page { min-height: 260mm; break-after: page; page-break-after: always; position: relative; padding-bottom: 28px; } .bill-page:last-child { break-after: auto; page-break-after: auto; }
      .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 2px solid #0f766e; } .brand { color: #0f766e; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; } h1 { margin: 5px 0 0; font-size: 27px; } .bill-title { text-align: right; } .bill-title strong { display: block; font-size: 18px; } .muted { color: #64748b; font-size: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 26px 0; } h2 { margin: 0 0 8px; color: #475569; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; } p { margin: 3px 0; } table { width: 100%; border-collapse: collapse; } th { padding: 10px; background: #f1f5f9; color: #475569; font-size: 11px; text-align: left; text-transform: uppercase; } td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; } .number { text-align: right; white-space: nowrap; }
      .summary { width: 330px; margin: 24px 0 0 auto; } .summary div { display: flex; justify-content: space-between; gap: 20px; padding: 5px 0; } .summary .total { margin-top: 8px; padding-top: 12px; border-top: 2px solid #0f172a; font-size: 18px; font-weight: 700; } .status { display: inline-block; padding: 3px 9px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; text-transform: uppercase; } .footer { position: absolute; right: 0; bottom: 0; left: 0; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; text-align: center; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>${pages}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  function printShippingLabel(order) {
    const printWindow = window.open("", "_blank", "width=620,height=820");
    if (!printWindow) {
      setError("Your browser blocked the print window. Allow pop-ups for this dashboard and try again.");
      return;
    }
    printWindow.opener = null;
    const multiline = (value, fallback = "-") => escapeHtml(value || fallback).replace(/\r?\n/g, "<br>");
    const sender = company?.shippingDetails || {};
    const senderName = sender.senderName || company?.name || "Seller";
    const itemCount = (order.items || []).reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
    const orderItems = order.items || [];
    const itemLines = orderItems.slice(0, 4).map((item) => `
      <li><strong>${escapeHtml(item.quantity)} &times; ${escapeHtml(item.name || "Item")}</strong>${item.variant ? ` — ${escapeHtml(item.variant)}` : ""}</li>
    `).join("") + (orderItems.length > 4 ? `<li>+ ${orderItems.length - 4} more product line${orderItems.length - 4 === 1 ? "" : "s"}</li>` : "");
    const payment = String(order.paymentMethod || "-");
    const isCashOnDelivery = /cash\s*on\s*delivery|\bcod\b/i.test(payment);
    const confirmedPrice = order.priceStatus !== "pending";
    const amount = confirmedPrice
      ? money(order.total, order.currency || "LKR")
      : "Seller to confirm";
    const createdAt = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString("en-LK", { dateStyle: "medium" })
      : "-";

    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(order.orderNumber)} - Shipping label</title>
          <style>
            @page { size: 4in 6in; margin: 0; }
            * { box-sizing: border-box; }
            body { width: 4in; min-height: 6in; margin: 0; padding: 5mm; color: #000; font: 12px/1.35 Arial, sans-serif; }
            .label { display: flex; min-height: calc(6in - 10mm); flex-direction: column; overflow: hidden; border: 2px solid #000; }
            .top { display: flex; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 2px solid #000; }
            .brand { font-size: 15px; font-weight: 900; }
            .subline { margin-top: 1px; color: #444; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
            .order { font-size: 14px; font-weight: 800; text-align: right; }
            .date { font-size: 10px; text-align: right; }
            .block { padding: 9px 10px; border-bottom: 2px solid #000; }
            .heading { margin-bottom: 4px; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
            .name { font-size: 16px; font-weight: 800; }
            .to .name { font-size: 20px; }
            .address { margin-top: 4px; font-size: 14px; font-weight: 600; white-space: normal; }
            .phone { margin-top: 5px; font-size: 14px; font-weight: 800; }
            .payment { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; }
            .cod { padding: 7px 8px; border: 2px solid #000; font-size: 15px; font-weight: 900; text-align: center; }
            ul { margin: 5px 0 0; padding-left: 17px; }
            li { margin: 2px 0; }
            .footer { margin-top: auto; padding: 6px 10px; font-size: 9px; text-align: center; }
            .powered { display: block; margin-top: 2px; color: #777; font-size: 7px; letter-spacing: .05em; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <main class="label">
            <header class="top">
              <div><div class="brand">${escapeHtml(company?.name || senderName)}</div><div class="subline">Parcel delivery</div></div>
              <div><div class="order">${escapeHtml(order.orderNumber)}</div><div class="date">${escapeHtml(createdAt)}</div></div>
            </header>
            <section class="block">
              <div class="heading">From</div>
              <div class="name">${escapeHtml(senderName)}</div>
              <div>${multiline(sender.address, "Sender address not configured")}</div>
              <div class="phone">${escapeHtml(sender.phone || "Sender phone not configured")}</div>
            </section>
            <section class="block to">
              <div class="heading">To</div>
              <div class="name">${escapeHtml(order.customer?.name || "Customer")}</div>
              <div class="address">${multiline(order.customer?.deliveryAddress, "No delivery address")}</div>
              <div class="phone">TEL: ${escapeHtml(order.customer?.phone || "No phone number")}</div>
            </section>
            <section class="block payment">
              <div><div class="heading">Payment</div><strong>${escapeHtml(payment)}</strong></div>
              <div class="cod">${isCashOnDelivery ? `COD<br>${escapeHtml(amount)}` : escapeHtml(amount)}</div>
            </section>
            <section class="block">
              <div class="heading">Contents — ${escapeHtml(itemCount)} item${itemCount === 1 ? "" : "s"}</div>
              <ul>${itemLines || "<li>No items recorded</li>"}</ul>
            </section>
            <footer class="footer">Handle with care · Order ${escapeHtml(order.orderNumber)}<span class="powered">Powered by Pentarix AI Assistant</span></footer>
          </main>
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  function printSelectedShippingLabels() {
    if (!selectedOrders.length) return;
    const printWindow = window.open("", "_blank", "width=700,height=860");
    if (!printWindow) {
      setError("Your browser blocked the print window. Allow pop-ups for this dashboard and try again.");
      return;
    }
    printWindow.opener = null;
    const sender = company?.shippingDetails || {};
    const senderName = sender.senderName || company?.name || "Seller";
    const multiline = (value, fallback = "-") => escapeHtml(value || fallback).replace(/\r?\n/g, "<br>");
    const labels = selectedOrders.map((order) => {
      const itemCount = (order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
      const orderItems = order.items || [];
      const itemLines = orderItems.slice(0, 4).map((item) => `<li><strong>${escapeHtml(item.quantity)} &times; ${escapeHtml(item.name || "Item")}</strong>${item.variant ? ` — ${escapeHtml(item.variant)}` : ""}</li>`).join("") + (orderItems.length > 4 ? `<li>+ ${orderItems.length - 4} more product line${orderItems.length - 4 === 1 ? "" : "s"}</li>` : "");
      const payment = String(order.paymentMethod || "-");
      const isCashOnDelivery = /cash\s*on\s*delivery|\bcod\b/i.test(payment);
      const amount = order.priceStatus !== "pending" ? money(order.total, order.currency || "LKR") : "Seller to confirm";
      const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-LK", { dateStyle: "medium" }) : "-";
      return `<article class="sheet"><main class="label">
        <header class="top"><div><div class="brand">${escapeHtml(company?.name || senderName)}</div><div class="subline">Parcel delivery</div></div><div><div class="order">${escapeHtml(order.orderNumber)}</div><div class="date">${escapeHtml(createdAt)}</div></div></header>
        <section class="block"><div class="heading">From</div><div class="name">${escapeHtml(senderName)}</div><div>${multiline(sender.address, "Sender address not configured")}</div><div class="phone">${escapeHtml(sender.phone || "Sender phone not configured")}</div></section>
        <section class="block to"><div class="heading">To</div><div class="name">${escapeHtml(order.customer?.name || "Customer")}</div><div class="address">${multiline(order.customer?.deliveryAddress, "No delivery address")}</div><div class="phone">TEL: ${escapeHtml(order.customer?.phone || "No phone number")}</div></section>
        <section class="block payment"><div><div class="heading">Payment</div><strong>${escapeHtml(payment)}</strong></div><div class="cod">${isCashOnDelivery ? `COD<br>${escapeHtml(amount)}` : escapeHtml(amount)}</div></section>
        <section class="block"><div class="heading">Contents — ${escapeHtml(itemCount)} item${itemCount === 1 ? "" : "s"}</div><ul>${itemLines || "<li>No items recorded</li>"}</ul></section>
        <footer class="footer">Handle with care · Order ${escapeHtml(order.orderNumber)}<span class="powered">Powered by Pentarix AI Assistant</span></footer>
      </main></article>`;
    }).join("");
    printWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Selected shipping labels</title><style>
      @page { size: 4in 6in; margin: 0; } * { box-sizing: border-box; } body { margin: 0; color: #000; font: 12px/1.35 Arial, sans-serif; }
      .sheet { width: 4in; height: 6in; padding: 5mm; break-after: page; page-break-after: always; } .sheet:last-child { break-after: auto; page-break-after: auto; }
      .label { display: flex; min-height: calc(6in - 10mm); flex-direction: column; overflow: hidden; border: 2px solid #000; } .top { display: flex; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 2px solid #000; } .brand { font-size: 15px; font-weight: 900; } .subline { margin-top: 1px; color: #444; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; } .order { font-size: 14px; font-weight: 800; text-align: right; } .date { font-size: 10px; text-align: right; }
      .block { padding: 9px 10px; border-bottom: 2px solid #000; } .heading { margin-bottom: 4px; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } .name { font-size: 16px; font-weight: 800; } .to .name { font-size: 20px; } .address { margin-top: 4px; font-size: 14px; font-weight: 600; } .phone { margin-top: 5px; font-size: 14px; font-weight: 800; } .payment { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; } .cod { padding: 7px 8px; border: 2px solid #000; font-size: 15px; font-weight: 900; text-align: center; } ul { margin: 5px 0 0; padding-left: 17px; } li { margin: 2px 0; } .footer { margin-top: auto; padding: 6px 10px; font-size: 9px; text-align: center; } .powered { display: block; margin-top: 2px; color: #777; font-size: 7px; letter-spacing: .05em; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>${labels}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  const statuses = ["new", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  const editedSubtotal = (editForm?.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );
  const editedTotal = editedSubtotal + (Number(editForm?.deliveryFee) || 0);
  const statusStyles = {
    new: "border-emerald-200 bg-emerald-50 text-emerald-700",
    confirmed: "border-cyan-200 bg-cyan-50 text-cyan-700",
    processing: "border-violet-200 bg-violet-50 text-violet-700",
    shipped: "border-blue-200 bg-blue-50 text-blue-700",
    delivered: "border-teal-200 bg-teal-50 text-teal-700",
    cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const summaryCards = [
    { label: "New orders", value: summary?.counts?.new || 0, icon: ShoppingCart, card: "border-blue-100 bg-gradient-to-br from-white via-blue-50/70 to-blue-100/60", iconStyle: "bg-blue-100 text-blue-700" },
    { label: "Processing", value: summary?.counts?.processing || 0, icon: Settings2, card: "border-violet-100 bg-gradient-to-br from-white via-violet-50/70 to-violet-100/60", iconStyle: "bg-violet-100 text-violet-700" },
    { label: "Delivered", value: summary?.counts?.delivered || 0, icon: BadgeCheck, card: "border-emerald-100 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/60", iconStyle: "bg-emerald-100 text-emerald-700" },
    { label: "Order value", value: money(summary?.revenue || 0, "LKR"), icon: WalletCards, card: "border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-orange-100/70", iconStyle: "bg-orange-100 text-orange-700" },
  ];
  return (
    <div className="space-y-6">
      <Alert error={error} notice={notice} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, card, iconStyle }) => (
          <div key={label} className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${card}`}>
            <div className="absolute -bottom-8 -right-6 h-24 w-24 rounded-full bg-white/45" />
            <div className="relative flex items-center gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${iconStyle}`}><Icon size={23} strokeWidth={2.3} /></span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-600">{label}</div>
                <div className={`${label === "Order value" ? "text-2xl" : "text-3xl"} mt-1 truncate font-bold tracking-tight text-slate-950`}>{value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(260px,1fr)_210px_auto] sm:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Search orders</span>
              <span className="relative block">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Order, customer or phone..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") applySearch(); }}
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Status</span>
              <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium capitalize text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" value={status} onChange={(event) => changeStatus(event.target.value)}>
                <option value="">All statuses</option>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <PrimaryButton className="h-11 rounded-xl bg-blue-600 px-6 shadow-blue-900/10 hover:bg-blue-700 focus:ring-blue-500/15" onClick={applySearch} disabled={loading}>
              {loading ? <RefreshCcw className="animate-spin" size={17} /> : <SearchIcon size={17} />}
              Search
            </PrimaryButton>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <SecondaryButton className="h-11 rounded-xl disabled:cursor-not-allowed disabled:opacity-45" type="button" onClick={printSelectedBills} disabled={!selectedOrders.length}><ReceiptText size={16} /> Print selected bills</SecondaryButton>
            <PrimaryButton className="h-11 rounded-xl bg-blue-600 shadow-blue-900/10 hover:bg-blue-700 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-45" type="button" onClick={printSelectedShippingLabels} disabled={!selectedOrders.length}><Printer size={16} /> Print selected labels</PrimaryButton>
            {selectedOrders.length > 0 && <SecondaryButton className="h-11 rounded-xl" type="button" onClick={() => setSelectedOrderIds(new Set())}>Clear</SecondaryButton>}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ClipboardList size={19} /></span>
            <div>
              <h2 className="font-bold text-slate-950">Orders list</h2>
              <p className="text-xs text-slate-500">{selectedOrders.length ? `${selectedOrders.length} order${selectedOrders.length === 1 ? "" : "s"} selected on this page` : `${pagination.total} order${pagination.total === 1 ? "" : "s"} found`}</p>
            </div>
          </div>
          <SecondaryButton className="h-9 rounded-xl" onClick={() => load(page, pageSize)} disabled={loading}><RefreshCcw className={loading ? "animate-spin" : ""} size={15} /> Refresh</SecondaryButton>
        </div>
        <div className="max-h-[62vh] overflow-auto overscroll-contain">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.25)]">
              <tr>
                <th className="w-12 px-5 py-3.5"><input className="h-4 w-4 rounded border-slate-300 accent-blue-600" type="checkbox" aria-label="Select all visible orders" checked={orders.length > 0 && orders.every((order) => selectedOrderIds.has(order._id))} onChange={toggleAllVisibleOrders} /></th>
                <th className="w-10 px-2 py-3.5">#</th>
                <th className="px-4 py-3.5">Order</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Items</th>
                <th className="px-4 py-3.5">Total</th>
                <th className="px-4 py-3.5">Channel</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order, orderIndex) => {
                const firstItem = order.items?.[0];
                const extraItemCount = Math.max((order.items?.length || 0) - 1, 0);
                return (
                  <tr key={order._id} className={`transition hover:bg-blue-50/30 ${selectedOrderIds.has(order._id) ? "bg-blue-50/50" : "bg-white"}`}>
                    <td className="px-5 py-5 align-top"><input className="h-4 w-4 rounded border-slate-300 accent-blue-600" type="checkbox" aria-label={`Select order ${order.orderNumber}`} checked={selectedOrderIds.has(order._id)} onChange={() => toggleOrderSelection(order._id)} /></td>
                    <td className="px-2 py-5 align-top font-semibold text-slate-500">{((pagination.page - 1) * pagination.limit) + orderIndex + 1}</td>
                    <td className="px-4 py-5 align-top"><div className="max-w-[170px] break-words font-bold leading-5 text-slate-900">{order.orderNumber}</div><div className="mt-1 text-xs leading-5 text-slate-500">{formatDate(order.createdAt)}</div></td>
                    <td className="px-4 py-5 align-top">
                      <div className="font-semibold text-slate-900">{order.customer?.name || "Customer"}</div>
                      <div className="mt-1 text-xs text-slate-500">{order.customer?.phone || "No phone"}</div>
                      <div className="mt-2 inline-flex max-w-48 items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700" title={order.customer?.deliveryAddress || "No delivery address"}><MapPin size={11} /><span className="truncate">{order.customer?.deliveryAddress || "No address"}</span></div>
                    </td>
                    <td className="px-4 py-5 align-top">
                      {firstItem ? (
                        <div className="flex max-w-[250px] items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500"><Package size={19} /></span>
                          <div className="min-w-0"><div className="font-semibold leading-5 text-slate-800">{firstItem.quantity} × {firstItem.name}</div>{firstItem.variant && <div className="mt-0.5 text-xs text-slate-500">{firstItem.variant}</div>}{extraItemCount > 0 && <div className="mt-1 text-xs font-semibold text-blue-600">+{extraItemCount} more item{extraItemCount === 1 ? "" : "s"}</div>}</div>
                        </div>
                      ) : <span className="text-slate-400">No items</span>}
                    </td>
                    <td className="px-4 py-5 align-top"><div className="font-bold text-slate-950">{order.priceStatus === "pending" ? "Seller to confirm" : money(order.total, order.currency || "LKR")}</div><div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CreditCard size={12} /> {order.paymentMethod || "Not specified"}</div></td>
                    <td className="px-4 py-5 align-top"><div className="flex items-center gap-1.5 font-semibold capitalize text-slate-700"><Globe2 size={14} className="text-slate-400" /> {order.channel}</div><span className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{order.language}</span></td>
                    <td className="px-4 py-5 align-top"><select className={`h-9 min-w-28 rounded-full border px-3 text-xs font-bold capitalize outline-none transition focus:ring-4 focus:ring-blue-500/10 ${statusStyles[order.status] || "border-slate-200 bg-slate-50 text-slate-700"}`} value={order.status} onChange={(event) => setOrderStatus(order._id, event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></td>
                    <td className="px-5 py-5 align-top">
                      <div className="ml-auto flex min-w-[150px] flex-col gap-2">
                        <button type="button" onClick={() => startEditingOrder(order)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"><Pencil size={14} /> Edit order</button>
                        <button type="button" onClick={() => printBill(order)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"><ReceiptText size={14} /> Bill</button>
                        <button type="button" onClick={() => printShippingLabel(order)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"><Truck size={14} /> Shipping label</button>
                        {(order.tracking?.trackingId || order.tracking?.trackingUrl) && <button type="button" onClick={() => copyTrackingMessage(order)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"><Copy size={14} /> Copy tracking</button>}
                        {order.tracking?.notification?.status === "failed" && <button type="button" onClick={() => retryTrackingNotification(order)} disabled={savingOrder} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-50"><Send size={14} /> Retry notification</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!orders.length && <div className="p-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><ClipboardList size={22} /></span><div className="mt-3 font-semibold text-slate-700">No matching orders</div><div className="mt-1 text-sm text-slate-500">Try changing the search text or status filter.</div></div>}
        </div>
        <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>Showing <strong className="text-slate-900">{firstShown}–{lastShown}</strong> of <strong className="text-slate-900">{pagination.total}</strong></span>
            <label className="flex items-center gap-2">
              <span>Rows per page</span>
              <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))}>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Orders pagination">
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={pagination.page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /> Previous</button>
            {pageButtons.map((pageNumber, index) => (
              <span key={pageNumber} className="contents">
                {index > 0 && pageNumber - pageButtons[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
                <button type="button" aria-current={pageNumber === pagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-bold transition ${pageNumber === pagination.page ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`} disabled={loading} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
              </span>
            ))}
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={pagination.page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next <ChevronRight size={16} /></button>
          </nav>
        </div>
      </section>
      {editingOrder && editForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={`Edit order ${editingOrder.orderNumber}`}>
          <form onSubmit={saveOrderEdit} className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div><div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Edit order</div><h2 className="mt-1 text-xl font-bold text-slate-950">{editingOrder.orderNumber}</h2></div>
              <SecondaryButton type="button" onClick={() => { setEditingOrder(null); setEditForm(null); }} disabled={savingOrder}>Close</SecondaryButton>
            </div>
            <div className="max-h-[75vh] space-y-6 overflow-y-auto p-5 sm:p-6">
              <Alert error={error} />
              <section>
                <h3 className="mb-3 font-bold text-slate-950">Customer and delivery</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Customer name"><TextInput required maxLength={160} value={editForm.customer.name} onChange={(event) => setEditForm({ ...editForm, customer: { ...editForm.customer, name: event.target.value } })} /></Field>
                  <Field label="Phone number"><TextInput maxLength={50} value={editForm.customer.phone} onChange={(event) => setEditForm({ ...editForm, customer: { ...editForm.customer, phone: event.target.value } })} /></Field>
                  <div className="md:col-span-2"><Field label="Delivery address"><TextArea required maxLength={1000} value={editForm.customer.deliveryAddress} onChange={(event) => setEditForm({ ...editForm, customer: { ...editForm.customer, deliveryAddress: event.target.value } })} /></Field></div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-950">Order items</h3><SecondaryButton type="button" onClick={addOrderItem}><Plus size={15} /> Add item</SecondaryButton></div>
                <div className="space-y-3">
                  {editForm.items.map((item, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="md:col-span-4"><Field label="Item name"><TextInput required maxLength={200} value={item.name} onChange={(event) => updateOrderItem(index, "name", event.target.value)} /></Field></div>
                        <div className="md:col-span-2"><Field label="SKU"><TextInput maxLength={100} value={item.sku} onChange={(event) => updateOrderItem(index, "sku", event.target.value)} /></Field></div>
                        <div className="md:col-span-2"><Field label="Option"><TextInput maxLength={120} value={item.variant} onChange={(event) => updateOrderItem(index, "variant", event.target.value)} /></Field></div>
                        <div className="md:col-span-1"><Field label="Qty"><TextInput required type="number" min="1" max="1000" step="1" value={item.quantity} onChange={(event) => updateOrderItem(index, "quantity", event.target.value)} /></Field></div>
                        <div className="md:col-span-2"><Field label="Unit price"><TextInput required type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateOrderItem(index, "unitPrice", event.target.value)} /></Field></div>
                        <div className="flex items-end md:col-span-1"><SecondaryButton type="button" className="w-full px-2 text-rose-700" onClick={() => removeOrderItem(index)} disabled={editForm.items.length === 1} title="Remove item"><Trash2 size={16} /></SecondaryButton></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-bold text-slate-950">Payment and processing</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Payment method"><TextInput required maxLength={120} value={editForm.paymentMethod} onChange={(event) => setEditForm({ ...editForm, paymentMethod: event.target.value })} /></Field>
                  <Field label="Currency"><TextInput required maxLength={3} value={editForm.currency} onChange={(event) => setEditForm({ ...editForm, currency: event.target.value.toUpperCase() })} /></Field>
                  <Field label="Delivery fee"><TextInput required type="number" min="0" step="0.01" value={editForm.deliveryFee} onChange={(event) => setEditForm({ ...editForm, deliveryFee: event.target.value })} /></Field>
                  <Field label="Price status"><select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={editForm.priceStatus} onChange={(event) => setEditForm({ ...editForm, priceStatus: event.target.value })}><option value="pending">Seller to confirm</option><option value="confirmed">Confirmed</option></select></Field>
                  <Field label="Order status"><select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                  <div className="rounded-xl bg-emerald-50 px-4 py-3"><div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Calculated total</div><div className="mt-1 text-xl font-bold text-emerald-950">{money(editedTotal, editForm.currency || "LKR")}</div><div className="text-xs text-emerald-700">Subtotal {money(editedSubtotal, editForm.currency || "LKR")}</div></div>
                  <div className="md:col-span-3"><Field label="Internal notes"><TextArea maxLength={2000} value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} /></Field></div>
                </div>
              </section>

              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-emerald-950"><Truck size={18} /> Courier tracking</div>
                    <p className="mt-1 text-xs text-emerald-700">Enter the tracking details supplied by the delivery service after handing over the parcel.</p>
                  </div>
                  {(editForm.tracking.trackingId || editForm.tracking.trackingUrl) && <SecondaryButton type="button" onClick={() => copyTrackingMessage(editingOrder, editForm.tracking)}><Copy size={15} /> Copy customer message</SecondaryButton>}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Courier service"><TextInput maxLength={160} placeholder="Prompt Xpress, Koombiyo, Domex..." value={editForm.tracking.courierName} onChange={(event) => setEditForm({ ...editForm, tracking: { ...editForm.tracking, courierName: event.target.value } })} /></Field>
                  <Field label="Tracking ID"><TextInput maxLength={200} placeholder="Courier-provided tracking number" value={editForm.tracking.trackingId} onChange={(event) => setEditForm({ ...editForm, tracking: { ...editForm.tracking, trackingId: event.target.value } })} /></Field>
                  <div className="md:col-span-2"><Field label="Courier tracking link"><TextInput type="url" maxLength={2000} placeholder="https://courier.example/track/..." value={editForm.tracking.trackingUrl} onChange={(event) => setEditForm({ ...editForm, tracking: { ...editForm.tracking, trackingUrl: event.target.value } })} /></Field></div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white/80 px-4 py-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-700">Customer notification: </span>
                    <span className={`font-bold capitalize ${editingOrder.tracking?.notification?.status === "failed" ? "text-rose-700" : editingOrder.tracking?.notification?.status === "sent" ? "text-emerald-700" : "text-slate-500"}`}>{String(editingOrder.tracking?.notification?.status || "not_sent").replace("_", " ")}</span>
                    {editingOrder.tracking?.notification?.lastError && <div className="mt-1 max-w-2xl text-rose-700">{editingOrder.tracking.notification.lastError}</div>}
                  </div>
                  {editingOrder.tracking?.notification?.status === "failed" && <SecondaryButton type="button" onClick={() => retryTrackingNotification(editingOrder)} disabled={savingOrder}><Send size={15} /> Retry notification</SecondaryButton>}
                </div>
              </section>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <SecondaryButton type="button" onClick={() => { setEditingOrder(null); setEditForm(null); }} disabled={savingOrder}>Cancel</SecondaryButton>
              <PrimaryButton type="submit" disabled={savingOrder || !editForm.items.length}>{savingOrder ? "Saving…" : "Save order changes"}</PrimaryButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MessengerManagement({ companyId }) {
  const dialog = useDialog();
  const [integration, setIntegration] = useState(null);
  const [form, setForm] = useState(emptyMessenger);
  const [connectConfig, setConnectConfig] = useState(null);
  const [availablePages, setAvailablePages] = useState([]);
  const [connectionId, setConnectionId] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const config = await api.messengerIntegration.connectConfig(companyId);
      setConnectConfig(config);
      if (config.enabled) {
        loadMetaSdk({ appId: config.appId, graphApiVersion: config.graphApiVersion }).catch(() => {});
      }
      const value = await api.messengerIntegration.get(companyId);
      if (!value) {
        setIntegration(null);
        setForm(emptyMessenger);
        return;
      }
      setIntegration(value);
      setForm({ pageId: value.pageId || "", pageName: value.pageName || "", pageAccessToken: "", isActive: value.isActive !== false });
    } catch (err) {
      if (err.status === 404) { setIntegration(null); setForm(emptyMessenger); }
      else setError(err.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [companyId]);

  async function save(event) {
    event.preventDefault();
    setLoading(true); setError(""); setNotice("");
    try {
      const value = await api.messengerIntegration.save(companyId, form, Boolean(integration));
      setIntegration(value); setForm((current) => ({ ...current, pageAccessToken: "" })); setNotice("Messenger integration saved");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function validate() {
    setLoading(true); setError(""); setNotice("");
    try { const result = await api.messengerIntegration.validate(companyId); setNotice(`Connected to ${result.page?.name || "Facebook Page"}`); await load(); }
    catch (err) { setError(err.technicalMessage || err.message); } finally { setLoading(false); }
  }

  async function startConnection() {
    setLoading(true); setError(""); setNotice(""); setAvailablePages([]); setConnectionId("");
    try {
      const config = connectConfig || await api.messengerIntegration.connectConfig(companyId);
      setConnectConfig(config);
      if (!config.enabled) throw new Error(config.reason || "Messenger connection is not configured");
      const authorization = await startMessengerLogin({
        appId: config.appId,
        configId: config.configId,
        graphApiVersion: config.graphApiVersion,
        permissions: config.permissions,
      });
      const result = await api.messengerIntegration.discoverPages(companyId, authorization);
      setAvailablePages(result.pages || []);
      setConnectionId(result.connectionId);
      setSelectedPageId(result.pages?.[0]?.id || "");
      if (result.pages?.length === 1) {
        const connected = await api.messengerIntegration.connectPage(companyId, {
          connectionId: result.connectionId,
          pageId: result.pages[0].id,
        });
        setIntegration(connected);
        setForm({ pageId: connected.pageId, pageName: connected.pageName || "", pageAccessToken: "", isActive: true });
        setAvailablePages([]); setConnectionId("");
        setNotice(`Messenger connected to ${connected.pageName || connected.pageId}`);
      } else {
        setNotice("Choose the Facebook Page that Pentarix should automate.");
      }
    } catch (err) {
      setError(err.technicalMessage || err.message);
    } finally { setLoading(false); }
  }

  async function finishConnection() {
    if (!connectionId || !selectedPageId) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const connected = await api.messengerIntegration.connectPage(companyId, {
        connectionId,
        pageId: selectedPageId,
      });
      setIntegration(connected);
      setForm({ pageId: connected.pageId, pageName: connected.pageName || "", pageAccessToken: "", isActive: true });
      setAvailablePages([]); setConnectionId(""); setSelectedPageId("");
      setNotice(`Messenger connected to ${connected.pageName || connected.pageId}`);
    } catch (err) { setError(err.technicalMessage || err.message); }
    finally { setLoading(false); }
  }

  async function disconnect() {
    if (!integration) return;
    const confirmed = await dialog.confirm({ title: "Disconnect Messenger?", message: "Disconnect this Facebook Page from Pentarix? Automated Messenger replies will stop.", confirmLabel: "Disconnect", tone: "danger" });
    if (!confirmed) return;
    setLoading(true); setError(""); setNotice("");
    try {
      await api.messengerIntegration.remove(companyId);
      setIntegration(null); setForm(emptyMessenger);
      setNotice("Messenger disconnected");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,620px)_1fr]">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-lg font-bold">Facebook Messenger</h2><p className="mt-1 text-sm text-slate-500">Authorize Pentarix and choose the Facebook Page your company owns.</p></div>
        <Alert error={error} notice={notice} />
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm leading-6 text-blue-900">Sign in with Facebook and approve the Pages you manage. Your Facebook password is entered only in Meta's window.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton onClick={startConnection} disabled={loading || connectConfig?.enabled === false}>
              {integration ? "Reconnect with Facebook" : "Connect with Facebook"}
            </PrimaryButton>
            {integration && <SecondaryButton onClick={validate} disabled={loading}><CheckCircle2 size={16} /> Validate</SecondaryButton>}
            {integration && <SecondaryButton onClick={disconnect} disabled={loading} className="text-rose-700"><Trash2 size={16} /> Disconnect</SecondaryButton>}
          </div>
          {connectConfig?.enabled === false && <p className="mt-3 text-xs text-amber-800">{connectConfig.reason}</p>}
        </div>

        {availablePages.length > 1 && (
          <div className="rounded-xl border border-slate-200 p-4">
            <Field label="Choose Facebook Page">
              <select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)}>
                {availablePages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
              </select>
            </Field>
            <PrimaryButton className="mt-3" onClick={finishConnection} disabled={loading || !selectedPageId}>Connect selected Page</PrimaryButton>
          </div>
        )}

        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Advanced manual connection</summary>
          <form onSubmit={save} className="space-y-4 border-t border-slate-200 p-4">
            <Field label="Facebook Page ID"><TextInput required value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} /></Field>
            <Field label="Page name"><TextInput value={form.pageName} onChange={(e) => setForm({ ...form, pageName: e.target.value })} /></Field>
            <Field label={integration ? "New Page access token (leave blank to keep current)" : "Page access token"}><TextInput required={!integration} type="password" value={form.pageAccessToken} onChange={(e) => setForm({ ...form, pageAccessToken: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Integration active</label>
            <PrimaryButton type="submit" disabled={loading}>{integration ? "Update manual connection" : "Save manual connection"}</PrimaryButton>
          </form>
        </details>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold">Connection status</h2>
        <p className="mt-2 text-sm text-slate-600">The Pentarix Meta App handles the webhook. Each company only authorizes the Facebook Page it owns.</p>
        <div className="mt-4 rounded-md bg-slate-950 p-3 font-mono text-xs text-white">{api.baseUrl}/api/messenger/webhook</div>
        <p className="mt-3 text-sm text-slate-500">Page tokens are encrypted before storage and never displayed again.</p>
        {integration
          ? <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><div className="font-semibold">Connected</div><div>Page: {integration.pageName || integration.pageId}</div><div>Method: {integration.onboardingMethod === "facebook_login" ? "Facebook authorization" : "Manual"}</div><div>Token ending: {integration.pageAccessTokenLast4 || "-"}</div></div>
          : <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No Facebook Page connected yet.</div>}
      </section>
    </div>
  );
}

export function CommercePanel({ companyId, company, section }) {
  if (!companyId) return null;
  if (section === "products") return <ProductManagement companyId={companyId} />;
  if (section === "orders") return <OrderManagement companyId={companyId} company={company} />;
  if (section === "messenger") return <MessengerManagement companyId={companyId} />;
  return null;
}
