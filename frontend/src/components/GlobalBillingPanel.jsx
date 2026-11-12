import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileImage,
  PackagePlus,
  Pencil,
  RefreshCcw,
  RotateCcw,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { api, formatDate } from "../lib/api";
import { classNames } from "../utils/classNames";
import { Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "./ui";
import { ToastBridge } from "./ToastProvider";
import { useDialog } from "./DialogProvider";

const emptyPlan = { name: "", description: "", price: "", currency: "LKR", credits: "", sortOrder: 0, isActive: true };
const emptyBank = { bankName: "", accountName: "", accountNumber: "", branch: "", instructions: "" };
const emptyFilters = { companyId: "", status: "", dateFrom: "", dateTo: "" };
const number = (value) => new Intl.NumberFormat().format(Number(value || 0));
const money = (value, currency = "LKR") => `${currency} ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2 }).format(Number(value || 0))}`;

function planPayload(plan) {
  return {
    ...plan,
    price: Number(plan.price),
    credits: Number(plan.credits),
    sortOrder: Number(plan.sortOrder || 0),
  };
}

function Pagination({ meta, page, setPage, pageSize, setPageSize, busy, label }) {
  const totalPages = Math.max(1, meta.pages || 1);
  const first = meta.total ? ((meta.page - 1) * meta.limit) + 1 : 0;
  const last = meta.total ? Math.min(meta.page * meta.limit, meta.total) : 0;
  const buttons = Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-slate-600">
        <span>Showing <strong className="text-slate-900">{first}-{last}</strong> of <strong className="text-slate-900">{meta.total || 0}</strong></span>
        <label className="flex items-center gap-2">
          <span>Rows per page</span>
          <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 outline-none focus:border-emerald-500" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
            <option value={20}>20</option><option value={50}>50</option>
          </select>
        </label>
      </div>
      <nav className="flex flex-wrap items-center gap-1.5" aria-label={`${label} pagination`}>
        <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40" disabled={page <= 1 || busy} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16}/> Previous</button>
        {buttons.map((pageNumber, index) => (
          <span className="contents" key={pageNumber}>
            {index > 0 && pageNumber - buttons[index - 1] > 1 && <span className="px-1 text-slate-400">...</span>}
            <button type="button" className={classNames("h-9 min-w-9 rounded-lg border px-3 font-bold", pageNumber === page ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700")} onClick={() => setPage(pageNumber)} disabled={busy}>{pageNumber}</button>
          </span>
        ))}
        <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40" disabled={page >= totalPages || busy} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next <ChevronRight size={16}/></button>
      </nav>
    </div>
  );
}

function FilterBar({ filters, setFilters, companies, statuses, onApply, onReset, busy }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[1.25fr_.8fr_.75fr_.75fr_auto_auto] xl:items-end">
      <Field label="Company">
        <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500" value={filters.companyId} onChange={(event) => setFilters({ ...filters, companyId: event.target.value })}>
          <option value="">All companies</option>
          {companies.map((company) => <option value={company._id} key={company._id}>{company.name}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          {statuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}
        </select>
      </Field>
      <Field label="From"><TextInput type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}/></Field>
      <Field label="To"><TextInput type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}/></Field>
      <PrimaryButton type="button" className="h-11 rounded-xl" disabled={busy} onClick={onApply}>Apply</PrimaryButton>
      <SecondaryButton type="button" className="h-11 rounded-xl" disabled={busy} onClick={onReset}>Reset</SecondaryButton>
    </div>
  );
}

export function GlobalBillingPanel() {
  const dialog = useDialog();
  const [tab, setTab] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [bank, setBank] = useState(emptyBank);
  const [editingBank, setEditingBank] = useState(false);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [editingPlan, setEditingPlan] = useState("");
  const [editingPlanForm, setEditingPlanForm] = useState(emptyPlan);
  const [requests, setRequests] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [requestFilters, setRequestFilters] = useState({ ...emptyFilters, status: "pending" });
  const [appliedRequestFilters, setAppliedRequestFilters] = useState({ ...emptyFilters, status: "pending" });
  const [allocationFilters, setAllocationFilters] = useState(emptyFilters);
  const [appliedAllocationFilters, setAppliedAllocationFilters] = useState(emptyFilters);
  const [requestPage, setRequestPage] = useState(1);
  const [requestPageSize, setRequestPageSize] = useState(20);
  const [allocationPage, setAllocationPage] = useState(1);
  const [allocationPageSize, setAllocationPageSize] = useState(20);
  const [requestMeta, setRequestMeta] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [allocationMeta, setAllocationMeta] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [pendingTotal, setPendingTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextPlans, nextBank, nextCompanies, pending] = await Promise.all([
        api.billing.plans(), api.billing.settings(), api.companies.list(),
        api.billing.requests({ status: "pending", page: 1, limit: 1 }),
      ]);
      setPlans(nextPlans);
      setBank({ ...emptyBank, ...nextBank });
      setCompanies(nextCompanies);
      setPendingTotal(pending.total || 0);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.billing.requests({ ...appliedRequestFilters, page: requestPage, limit: requestPageSize });
      setRequests(data.requests || []);
      setRequestMeta({ page: data.page || 1, limit: data.limit || requestPageSize, total: data.total || 0, pages: Math.max(1, data.pages || 1) });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [appliedRequestFilters, requestPage, requestPageSize]);

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.billing.allocations({ ...appliedAllocationFilters, page: allocationPage, limit: allocationPageSize });
      setAllocations(data.allocations || []);
      setAllocationMeta({ page: data.page || 1, limit: data.limit || allocationPageSize, total: data.total || 0, pages: Math.max(1, data.pages || 1) });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [appliedAllocationFilters, allocationPage, allocationPageSize]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { if (tab === "approvals") loadRequests(); }, [tab, loadRequests]);
  useEffect(() => { if (tab === "allocations") loadAllocations(); }, [tab, loadAllocations]);

  const activePlanCount = useMemo(() => plans.filter((plan) => plan.isActive).length, [plans]);

  async function createPlan(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await api.billing.createPlan(planPayload(planForm)); setPlanForm(emptyPlan); setNotice("Pricing plan created."); await loadBase(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  function startPlanEdit(plan) {
    setEditingPlan(plan._id);
    setEditingPlanForm({ name: plan.name, description: plan.description || "", price: plan.price, currency: plan.currency, credits: plan.credits, sortOrder: plan.sortOrder || 0, isActive: plan.isActive });
  }

  async function savePlan(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await api.billing.updatePlan(editingPlan, planPayload(editingPlanForm)); setEditingPlan(""); setNotice("Pricing plan updated."); await loadBase(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function deletePlan(plan) {
    const confirmed = await dialog.confirm({ title: "Delete pricing plan?", message: `Delete ${plan.name}? Existing payment history will remain available.`, confirmLabel: "Delete plan", tone: "danger" });
    if (!confirmed) return;
    setBusy(true); setError(""); setNotice("");
    try { await api.billing.deletePlan(plan._id); setNotice("Pricing plan deleted."); await loadBase(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function saveBank(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await api.billing.updateSettings(bank); setEditingBank(false); setNotice("Bank-transfer instructions updated."); await loadBase(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function review(item, approve) {
    const note = await dialog.prompt({ title: approve ? "Approve payment" : "Reject payment", message: approve ? `Approve ${money(item.amount, item.currency)} for ${item.companyId?.name || "this company"} and allocate ${number(item.credits)} credits.` : `Explain why the payment from ${item.companyId?.name || "this company"} is being rejected.`, inputLabel: approve ? "Approval note (optional)" : "Rejection reason", placeholder: approve ? "Add an optional note for the company" : "Enter the reason for rejection", required: !approve, confirmLabel: approve ? "Approve and allocate" : "Reject payment", tone: approve ? "default" : "danger" });
    if (note === null || (!approve && !note.trim())) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (approve) await api.billing.approve(item._id, note); else await api.billing.reject(item._id, note);
      setNotice(approve ? "Payment approved and credits allocated." : "Payment request rejected.");
      await Promise.all([loadRequests(), loadBase()]);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function reverseAllocation(item) {
    const reason = await dialog.prompt({ title: "Reverse credit allocation?", message: `This removes ${number(item.credits)} credits from ${item.companyId?.name || "this company"} and creates a permanent reversal record.`, inputLabel: "Reversal reason", placeholder: "Explain why this allocation is being reversed", required: true, confirmLabel: "Reverse credits", tone: "danger" });
    if (reason === null || !reason.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try { await api.billing.reverse(item._id, reason); setNotice("Credit allocation reversed and recorded."); await loadAllocations(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function openSlip(item) {
    try {
      const blob = await api.billing.slip(item._id); const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer"); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { setError(err.message); }
  }

  async function downloadReport() {
    setBusy(true); setError("");
    try {
      const blob = await api.billing.allocationsReport(appliedAllocationFilters);
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `pentarix-credit-allocations-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice("Payment allocation report downloaded.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const tabs = [
    { id: "plans", label: "Pricing plans", icon: WalletCards },
    { id: "approvals", label: "Payment approvals", icon: BadgeCheck },
    { id: "allocations", label: "Credit allocations", icon: CircleDollarSign },
  ];

  return (
    <div className="global-billing-page space-y-6">
      <ToastBridge error={error} notice={notice}/>

      <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/60 p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-200/35"/>
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-white/80 text-emerald-700 shadow-sm"><CircleDollarSign size={32}/></span><div><h2 className="text-2xl font-black tracking-tight text-slate-950">Billing & Credits</h2><p className="mt-1 text-sm text-slate-600">Manage packages, verify company payments and control completed allocations.</p></div></div>
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-4"><div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3"><div className="text-xl font-black text-slate-950">{plans.length}</div><div className="text-[11px] text-slate-500">Plans</div></div><div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3"><div className="text-xl font-black text-emerald-700">{activePlanCount}</div><div className="text-[11px] text-slate-500">Active</div></div><div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3"><div className="text-xl font-black text-amber-600">{pendingTotal}</div><div className="text-[11px] text-slate-500">Pending</div></div></div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setTab(id)} className={classNames("flex min-w-fit flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition", tab === id ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800")}><Icon size={18}/>{label}</button>)}
      </div>

      {tab === "plans" && <div className="space-y-6">
        <section><div className="mb-4 flex items-end justify-between"><div><h3 className="text-lg font-bold text-slate-950">AI credit packages</h3><p className="mt-1 text-sm text-slate-500">Plans visible to company administrators when purchasing credits.</p></div><SecondaryButton onClick={loadBase} disabled={loading}><RefreshCcw className={loading ? "animate-spin" : ""} size={15}/> Refresh</SecondaryButton></div>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{plans.map((plan) => <article key={plan._id} className={classNames("relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-teal-50 p-5 shadow-sm", !plan.isActive && "opacity-65")}>{editingPlan === plan._id ? <form className="space-y-4" onSubmit={savePlan}><div className="flex justify-between"><h4 className="font-bold text-slate-950">Edit pricing plan</h4><button type="button" onClick={() => setEditingPlan("")}><XCircle size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Plan name"><TextInput required value={editingPlanForm.name} onChange={(e) => setEditingPlanForm({ ...editingPlanForm, name: e.target.value })}/></Field><Field label="Credits"><TextInput required type="number" min="1" value={editingPlanForm.credits} onChange={(e) => setEditingPlanForm({ ...editingPlanForm, credits: e.target.value })}/></Field><Field label="Price"><TextInput required type="number" min="0" step="0.01" value={editingPlanForm.price} onChange={(e) => setEditingPlanForm({ ...editingPlanForm, price: e.target.value })}/></Field><Field label="Currency"><TextInput required maxLength="3" value={editingPlanForm.currency} onChange={(e) => setEditingPlanForm({ ...editingPlanForm, currency: e.target.value.toUpperCase() })}/></Field></div><Field label="Description"><TextArea value={editingPlanForm.description} onChange={(e) => setEditingPlanForm({ ...editingPlanForm, description: e.target.value })}/></Field><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={editingPlanForm.isActive} onChange={(e) => setEditingPlanForm({ ...editingPlanForm, isActive: e.target.checked })}/> Active and visible</label><div className="flex gap-2"><PrimaryButton type="submit" disabled={busy}>Save</PrimaryButton><SecondaryButton type="button" onClick={() => setEditingPlan("")}>Cancel</SecondaryButton></div></form> : <><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-bold text-slate-950">{plan.name}</h4><span className={classNames("rounded-full px-2 py-1 text-[10px] font-bold uppercase", plan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{plan.isActive ? "Active" : "Inactive"}</span></div><div className="mt-3 text-2xl font-black text-emerald-700">{money(plan.price, plan.currency)}</div></div><div className="flex"><button type="button" onClick={() => startPlanEdit(plan)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-emerald-700" title="Edit"><Pencil size={16}/></button><button type="button" onClick={() => deletePlan(plan)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Delete"><Trash2 size={16}/></button></div></div><div className="mt-3 text-lg font-bold text-slate-900">{number(plan.credits)} credits</div><p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">{plan.description || "No description"}</p></>}</article>)}</div>
        </section>
        <div className="grid gap-6 xl:grid-cols-2"><form onSubmit={createPlan} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><PackagePlus size={20}/></span><div><h3 className="font-bold text-slate-950">Create pricing plan</h3><p className="mt-1 text-xs text-slate-500">Add a new prepaid AI credit package.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Plan name"><TextInput required value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}/></Field><Field label="Credits"><TextInput required type="number" min="1" value={planForm.credits} onChange={(e) => setPlanForm({ ...planForm, credits: e.target.value })}/></Field><Field label="Price"><TextInput required type="number" min="0" step="0.01" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}/></Field><Field label="Currency"><TextInput required maxLength="3" value={planForm.currency} onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value.toUpperCase() })}/></Field></div><Field label="Description"><TextArea value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}/></Field><label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={planForm.isActive} onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}/> Active and visible to companies</label><PrimaryButton className="mt-4" type="submit" disabled={busy}>Create plan</PrimaryButton></form>
          {editingBank ? <form onSubmit={saveBank} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Banknote className="text-emerald-700" size={21}/><h3 className="font-bold text-slate-950">Bank-transfer instructions</h3></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Bank"><TextInput value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })}/></Field><Field label="Account name"><TextInput value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })}/></Field><Field label="Account number"><TextInput value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}/></Field><Field label="Branch"><TextInput value={bank.branch} onChange={(e) => setBank({ ...bank, branch: e.target.value })}/></Field></div><Field label="Instructions"><TextArea value={bank.instructions} onChange={(e) => setBank({ ...bank, instructions: e.target.value })}/></Field><div className="mt-4 flex gap-2"><PrimaryButton type="submit" disabled={busy}>Save bank details</PrimaryButton><SecondaryButton type="button" onClick={() => setEditingBank(false)}>Cancel</SecondaryButton></div></form> : <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Banknote className="text-emerald-700" size={21}/><h3 className="font-bold text-slate-950">Bank-transfer instructions</h3></div><SecondaryButton onClick={() => setEditingBank(true)}><Pencil size={15}/> Edit</SecondaryButton></div><dl className="mt-5 grid grid-cols-[120px_1fr] gap-3 text-sm"><dt className="text-slate-500">Bank</dt><dd className="font-semibold">{bank.bankName || "Not configured"}</dd><dt className="text-slate-500">Account name</dt><dd className="font-semibold">{bank.accountName || "-"}</dd><dt className="text-slate-500">Account number</dt><dd className="font-semibold">{bank.accountNumber || "-"}</dd><dt className="text-slate-500">Branch</dt><dd className="font-semibold">{bank.branch || "-"}</dd></dl>{bank.instructions && <p className="mt-4 whitespace-pre-wrap border-t border-emerald-100 pt-4 text-sm text-slate-600">{bank.instructions}</p>}</section>}
        </div>
      </div>}

      {tab === "approvals" && <div className="space-y-5"><FilterBar filters={requestFilters} setFilters={setRequestFilters} companies={companies} statuses={[{ value: "", label: "All statuses" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "reversed", label: "Reversed" }]} busy={loading} onApply={() => { setRequestPage(1); setAppliedRequestFilters(requestFilters); }} onReset={() => { const next = { ...emptyFilters, status: "pending" }; setRequestFilters(next); setRequestPage(1); setAppliedRequestFilters(next); }}/><section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-950">Payment review queue</h3><p className="mt-1 text-xs text-slate-500">Verify payment slips before allocating purchased credits.</p></div><SecondaryButton onClick={loadRequests}><RefreshCcw className={loading ? "animate-spin" : ""} size={15}/> Refresh</SecondaryButton></div><div className="max-h-[58vh] overflow-auto"><table className="w-full min-w-[980px] text-sm"><thead className="sticky top-0 z-10 bg-emerald-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{requests.map((item) => <tr key={item._id}><td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td><td className="px-4 py-3 font-semibold text-slate-900">{item.companyId?.name || "Company"}</td><td className="px-4 py-3"><div className="font-semibold text-slate-800">{item.planName}</div><div className="text-xs text-slate-500">{number(item.credits)} credits</div></td><td className="px-4 py-3"><div className="font-semibold text-slate-800">{money(item.amount, item.currency)}</div><div className="text-xs text-slate-500">{item.bankReference || "No bank reference"}</div></td><td className="px-4 py-3"><span className={classNames("rounded-full px-2.5 py-1 text-xs font-bold capitalize", item.status === "approved" ? "bg-emerald-100 text-emerald-700" : item.status === "rejected" ? "bg-rose-100 text-rose-700" : item.status === "reversed" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700")}>{item.status}</span>{item.reviewNote && <div className="mt-2 max-w-52 text-xs text-slate-500">{item.reviewNote}</div>}</td><td className="px-4 py-3"><div className="flex gap-2"><SecondaryButton onClick={() => openSlip(item)}><FileImage size={14}/> Slip</SecondaryButton>{item.status === "pending" && <><button disabled={busy} onClick={() => review(item, true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><BadgeCheck className="inline" size={14}/> Approve</button><button disabled={busy} onClick={() => review(item, false)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white"><XCircle className="inline" size={14}/> Reject</button></>}</div></td></tr>)}{!requests.length && !loading && <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-400">No payment requests match these filters.</td></tr>}</tbody></table></div><Pagination meta={requestMeta} page={requestPage} setPage={setRequestPage} pageSize={requestPageSize} setPageSize={setRequestPageSize} busy={loading} label="Payment approvals"/></section></div>}

      {tab === "allocations" && <div className="space-y-5"><FilterBar filters={allocationFilters} setFilters={setAllocationFilters} companies={companies} statuses={[{ value: "", label: "Approved and reversed" }, { value: "approved", label: "Approved" }, { value: "reversed", label: "Reversed" }]} busy={loading} onApply={() => { setAllocationPage(1); setAppliedAllocationFilters(allocationFilters); }} onReset={() => { setAllocationFilters(emptyFilters); setAllocationPage(1); setAppliedAllocationFilters(emptyFilters); }}/><section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-950">Credit allocation history</h3><p className="mt-1 text-xs text-slate-500">Completed purchases and permanent reversal records.</p></div><div className="flex gap-2"><SecondaryButton onClick={loadAllocations}><RefreshCcw className={loading ? "animate-spin" : ""} size={15}/> Refresh</SecondaryButton><PrimaryButton onClick={downloadReport} disabled={busy}><Download size={15}/> Download CSV</PrimaryButton></div></div><div className="max-h-[58vh] overflow-auto"><table className="w-full min-w-[1080px] text-sm"><thead className="sticky top-0 z-10 bg-emerald-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Allocated</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{allocations.map((item) => <tr key={item._id}><td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(item.reviewedAt || item.createdAt)}</td><td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.companyId?.name || "Company"}</div><div className="text-xs text-slate-500">{item.companyId?.slug || ""}</div></td><td className="px-4 py-3"><div className="font-semibold text-slate-800">{item.planName}</div><div className="text-xs font-semibold text-emerald-700">{number(item.credits)} credits</div></td><td className="px-4 py-3"><div className="font-semibold text-slate-800">{money(item.amount, item.currency)}</div><div className="text-xs text-slate-500">{item.bankReference || "-"}</div></td><td className="px-4 py-3 text-xs text-slate-500">PAY-{item._id}</td><td className="px-4 py-3"><span className={classNames("rounded-full px-2.5 py-1 text-xs font-bold capitalize", item.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700")}>{item.status}</span>{item.reversalReason && <div className="mt-2 max-w-56 text-xs text-slate-500">{item.reversalReason}</div>}</td><td className="px-4 py-3"><div className="flex gap-2"><SecondaryButton onClick={() => openSlip(item)}><FileImage size={14}/> Slip</SecondaryButton>{item.status === "approved" && <button type="button" disabled={busy} onClick={() => reverseAllocation(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"><RotateCcw size={14}/> Reverse</button>}{item.status === "reversed" && <span className="inline-flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-500"><CheckCircle2 size={14}/> Recorded</span>}</div></td></tr>)}{!allocations.length && !loading && <tr><td colSpan="7" className="px-5 py-12 text-center text-slate-400">No credit allocations match these filters.</td></tr>}</tbody></table></div><Pagination meta={allocationMeta} page={allocationPage} setPage={setAllocationPage} pageSize={allocationPageSize} setPageSize={setAllocationPageSize} busy={loading} label="Credit allocations"/></section></div>}
    </div>
  );
}
