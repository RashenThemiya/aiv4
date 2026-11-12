import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  ChevronLeft,
  ChevronRight,
  FileImage,
  PackagePlus,
  Pencil,
  RefreshCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { api, formatDate } from "../lib/api";
import { classNames } from "../utils/classNames";
import { Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "./ui";
import { ToastBridge } from "./ToastProvider";
import { useDialog } from "./DialogProvider";

const money = (value, currency = "LKR") => `${currency} ${new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
}).format(Number(value || 0))}`;
const credits = (value) => new Intl.NumberFormat().format(Number(value || 0));
const emptyPlan = { name: "", description: "", price: "", currency: "LKR", credits: "", sortOrder: 0, isActive: true };
const emptyBank = { bankName: "", accountName: "", accountNumber: "", branch: "", instructions: "" };

function planPayload(plan) {
  return {
    ...plan,
    price: Number(plan.price),
    credits: Number(plan.credits),
    sortOrder: Number(plan.sortOrder || 0),
  };
}

export function BillingPanel({ company, isSuperAdmin, onApproved }) {
  const dialog = useDialog();
  const [plans, setPlans] = useState([]);
  const [requests, setRequests] = useState([]);
  const [bank, setBank] = useState(emptyBank);
  const [editingBank, setEditingBank] = useState(true);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [editingPlan, setEditingPlan] = useState("");
  const [editingPlanForm, setEditingPlanForm] = useState(emptyPlan);
  const [purchase, setPurchase] = useState({ planId: "", bankReference: "", note: "", slip: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestPage, setRequestPage] = useState(1);
  const [requestPageSize, setRequestPageSize] = useState(20);
  const [requestPagination, setRequestPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const load = useCallback(async () => {
    try {
      const [nextPlans, nextBank, nextRequests] = await Promise.all([
        api.billing.plans(),
        api.billing.settings(),
        api.billing.requests({ page: requestPage, limit: requestPageSize }),
      ]);
      setPlans(nextPlans);
      setBank({ ...emptyBank, ...nextBank });
      if (nextBank.bankName || nextBank.accountName || nextBank.accountNumber) setEditingBank(false);
      const requestItems = Array.isArray(nextRequests) ? nextRequests : (nextRequests.requests || []);
      setRequests(requestItems);
      setRequestPagination({
        page: nextRequests.page || 1,
        limit: nextRequests.limit || requestPageSize,
        total: nextRequests.total ?? requestItems.length,
        pages: Math.max(1, nextRequests.pages || 1),
      });
      const activePlans = nextPlans.filter((plan) => plan.isActive);
      setPurchase((current) => ({
        ...current,
        planId: activePlans.some((plan) => plan._id === current.planId)
          ? current.planId
          : activePlans[0]?._id || "",
      }));
    } catch (err) {
      setError(err.message);
    }
  }, [company._id, requestPage, requestPageSize]);

  useEffect(() => { load(); }, [load]);

  async function createPlan(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.billing.createPlan(planPayload(planForm));
      setPlanForm(emptyPlan);
      setNotice("Pricing plan created.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startPlanEdit(plan) {
    setEditingPlan(plan._id);
    setEditingPlanForm({
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      currency: plan.currency,
      credits: plan.credits,
      sortOrder: plan.sortOrder || 0,
      isActive: plan.isActive,
    });
  }

  async function savePlanEdit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.billing.updatePlan(editingPlan, planPayload(editingPlanForm));
      setEditingPlan("");
      setEditingPlanForm(emptyPlan);
      setNotice("Pricing plan updated.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePlan(plan) {
    const confirmed = await dialog.confirm({ title: "Delete pricing plan?", message: `Delete the pricing plan “${plan.name}”? Existing payment history will be preserved.`, confirmLabel: "Delete plan", tone: "danger" });
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.billing.deletePlan(plan._id);
      if (editingPlan === plan._id) {
        setEditingPlan("");
        setEditingPlanForm(emptyPlan);
      }
      setNotice("Pricing plan deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveBank(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.billing.updateSettings(bank);
      setNotice("Bank instructions updated.");
      setEditingBank(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPurchase(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!purchase.slip) {
      setError("Choose a payment slip first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.billing.submitRequest(company._id, purchase);
      setPurchase((current) => ({ ...current, bankReference: "", note: "", slip: null }));
      formElement.reset();
      setNotice("Payment submitted for review. Credits will be added after approval.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function review(item, approve) {
    const note = await dialog.prompt({ title: approve ? "Approve payment" : "Reject payment", message: approve ? `Approve this payment and allocate ${credits(item.credits)} credits to ${company.name}.` : `Explain why this payment from ${company.name} is being rejected.`, inputLabel: approve ? "Approval note (optional)" : "Rejection reason", placeholder: approve ? "Add an optional note" : "Enter the reason for rejection", required: !approve, confirmLabel: approve ? "Approve and allocate" : "Reject payment", tone: approve ? "default" : "danger" });
    if (note === null || (!approve && !note.trim())) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (approve) await api.billing.approve(item._id, note);
      else await api.billing.reject(item._id, note);
      setNotice(approve ? "Payment approved and credits added." : "Payment request rejected.");
      await load();
      if (approve) await onApproved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openSlip(item) {
    try {
      const blob = await api.billing.slip(item._id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.message);
    }
  }

  const totalRequestPages = Math.max(1, requestPagination.pages || 1);
  const firstRequestShown = requestPagination.total
    ? ((requestPagination.page - 1) * requestPagination.limit) + 1
    : 0;
  const lastRequestShown = requestPagination.total
    ? Math.min(requestPagination.page * requestPagination.limit, requestPagination.total)
    : 0;
  const requestPageButtons = Array.from(new Set([
    1,
    requestPagination.page - 1,
    requestPagination.page,
    requestPagination.page + 1,
    totalRequestPages,
  ])).filter((item) => item >= 1 && item <= totalRequestPages).sort((a, b) => a - b);

  return (
    <div className="billing-panel space-y-6">
      <ToastBridge error={error} notice={notice} />

      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-bold text-slate-950">{isSuperAdmin ? "Payment review queue" : "My payment requests"}</h3><p className="mt-1 text-xs text-slate-500">{isSuperAdmin ? "Review payment slips before adding purchased credits." : "Track submitted payment slips and their review status."}</p></div>
          <SecondaryButton className="rounded-xl" onClick={() => load()} disabled={busy}><RefreshCcw className={busy ? "animate-spin" : ""} size={15}/> Refresh</SecondaryButton>
        </div>
        <div className="max-h-[58vh] overflow-auto overscroll-contain">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-emerald-50 text-left text-xs uppercase text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.25)]">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                {isSuperAdmin && <th className="px-4 py-3">Company</th>}
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((item) => (
                <tr key={item._id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                  {isSuperAdmin && <td className="px-4 py-3 font-semibold text-slate-800">{item.companyId?.name || "Company"}</td>}
                  <td className="px-4 py-3"><div className="font-semibold text-slate-800">{item.planName}</div><div className="text-xs text-slate-500">{credits(item.credits)} credits</div></td>
                  <td className="px-4 py-3"><div className="text-slate-800">{money(item.amount, item.currency)}</div><div className="text-xs text-slate-500">{item.bankReference || "No reference"}</div></td>
                  <td className="px-4 py-3">
                    <span className={classNames(
                      "rounded-full px-2 py-1 text-xs font-bold capitalize",
                      item.status === "approved" ? "bg-emerald-100 text-emerald-700" : item.status === "rejected" ? "bg-rose-100 text-rose-700" : item.status === "reversed" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700"
                    )}>{item.status}</span>
                    {item.reviewNote && <div className="mt-1 max-w-52 text-xs text-slate-500">{item.reviewNote}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <SecondaryButton onClick={() => openSlip(item)}><FileImage size={14} /> Slip</SecondaryButton>
                      {isSuperAdmin && item.status === "pending" && (
                        <>
                          <button disabled={busy} onClick={() => review(item, true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><BadgeCheck size={14} className="inline" /> Approve</button>
                          <button disabled={busy} onClick={() => review(item, false)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white"><XCircle size={14} className="inline" /> Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!requests.length && <tr><td colSpan={isSuperAdmin ? 6 : 5} className="px-5 py-10 text-center text-slate-400">No payment requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-slate-600"><span>Showing <strong className="text-slate-900">{firstRequestShown}–{lastRequestShown}</strong> of <strong className="text-slate-900">{requestPagination.total}</strong></span><label className="flex items-center gap-2"><span>Rows per page</span><select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={requestPageSize} onChange={(event) => { setRequestPageSize(Number(event.target.value)); setRequestPage(1); }}><option value={20}>20</option><option value={50}>50</option></select></label></div>
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Payment request pagination">
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={requestPagination.page <= 1 || busy} onClick={() => setRequestPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16}/> Previous</button>
            {requestPageButtons.map((pageNumber, index) => <span key={pageNumber} className="contents">{index > 0 && pageNumber - requestPageButtons[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}<button type="button" aria-current={pageNumber === requestPagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-lg border px-3 font-bold transition ${pageNumber === requestPagination.page ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`} disabled={busy} onClick={() => setRequestPage(pageNumber)}>{pageNumber}</button></span>)}
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={requestPagination.page >= totalRequestPages || busy} onClick={() => setRequestPage((current) => Math.min(totalRequestPages, current + 1))}>Next <ChevronRight size={16}/></button>
          </nav>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-950">AI credit packages</h3>
          <p className="text-sm text-slate-500">Choose a package. Larger packages provide more prepaid AI credits.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.filter((plan) => plan.isActive || isSuperAdmin).map((plan) => (
            <article key={plan._id} className={classNames(
              "relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/50 to-teal-50 p-5 shadow-sm",
              !plan.isActive && editingPlan !== plan._id && "opacity-60"
            )}>
              <div className="pointer-events-none absolute -bottom-12 -right-8 h-28 w-28 rounded-full bg-emerald-100/60" />
              {editingPlan === plan._id ? (
                <form className="relative space-y-4" onSubmit={savePlanEdit}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-slate-950">Edit pricing plan</h4>
                    <button type="button" onClick={() => setEditingPlan("")} className="rounded-lg p-2 text-slate-500 hover:bg-white"><XCircle size={17} /></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Plan name"><TextInput required value={editingPlanForm.name} onChange={(event) => setEditingPlanForm({ ...editingPlanForm, name: event.target.value })} /></Field>
                    <Field label="Credits"><TextInput required type="number" min="1" value={editingPlanForm.credits} onChange={(event) => setEditingPlanForm({ ...editingPlanForm, credits: event.target.value })} /></Field>
                    <Field label="Price"><TextInput required type="number" min="0" step="0.01" value={editingPlanForm.price} onChange={(event) => setEditingPlanForm({ ...editingPlanForm, price: event.target.value })} /></Field>
                    <Field label="Currency"><TextInput required maxLength="3" value={editingPlanForm.currency} onChange={(event) => setEditingPlanForm({ ...editingPlanForm, currency: event.target.value.toUpperCase() })} /></Field>
                  </div>
                  <Field label="Description"><TextArea value={editingPlanForm.description} onChange={(event) => setEditingPlanForm({ ...editingPlanForm, description: event.target.value })} /></Field>
                  <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={editingPlanForm.isActive} onChange={(event) => setEditingPlanForm({ ...editingPlanForm, isActive: event.target.checked })} /> Active and visible to companies</label>
                  <div className="flex flex-wrap gap-2"><PrimaryButton type="submit" disabled={busy}>Save changes</PrimaryButton><SecondaryButton type="button" onClick={() => setEditingPlan("")}>Cancel</SecondaryButton></div>
                </form>
              ) : (
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div><h4 className="font-bold text-slate-950">{plan.name}</h4><div className="mt-2 text-2xl font-extrabold text-emerald-700">{money(plan.price, plan.currency)}</div></div>
                    {isSuperAdmin && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => startPlanEdit(plan)} className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-emerald-700" title="Edit plan"><Pencil size={16} /></button>
                        <button type="button" onClick={() => deletePlan(plan)} disabled={busy} className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700" title="Delete plan"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-lg font-bold text-slate-900">{credits(plan.credits)} credits</div>
                  <p className="mt-2 min-h-10 text-sm text-slate-500">{plan.description}</p>
                  {!plan.isActive && <span className="mt-3 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">Inactive</span>}
                </div>
              )}
            </article>
          ))}
        </div>
        {!plans.length && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No pricing plans are available yet.</div>}
      </section>

      {isSuperAdmin ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={createPlan} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><PackagePlus className="text-emerald-600" size={19} /><h3 className="font-bold text-slate-950">Create pricing plan</h3></div>
            <p className="mt-1 text-xs text-slate-500">Use this form only when adding a new credit package.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Plan name"><TextInput required value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} /></Field>
              <Field label="Credits"><TextInput required type="number" min="1" value={planForm.credits} onChange={(event) => setPlanForm({ ...planForm, credits: event.target.value })} /></Field>
              <Field label="Price"><TextInput required type="number" min="0" step="0.01" value={planForm.price} onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })} /></Field>
              <Field label="Currency"><TextInput required maxLength="3" value={planForm.currency} onChange={(event) => setPlanForm({ ...planForm, currency: event.target.value.toUpperCase() })} /></Field>
            </div>
            <Field label="Description"><TextArea value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} /></Field>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={planForm.isActive} onChange={(event) => setPlanForm({ ...planForm, isActive: event.target.checked })} /> Active and visible to companies</label>
            <div className="mt-4"><PrimaryButton type="submit" disabled={busy}>Create plan</PrimaryButton></div>
          </form>

          {editingBank ? (
            <form onSubmit={saveBank} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Banknote className="text-emerald-600" size={19} /><h3 className="font-bold text-slate-950">Bank transfer instructions</h3></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Bank"><TextInput value={bank.bankName} onChange={(event) => setBank({ ...bank, bankName: event.target.value })} /></Field>
                <Field label="Account name"><TextInput value={bank.accountName} onChange={(event) => setBank({ ...bank, accountName: event.target.value })} /></Field>
                <Field label="Account number"><TextInput value={bank.accountNumber} onChange={(event) => setBank({ ...bank, accountNumber: event.target.value })} /></Field>
                <Field label="Branch"><TextInput value={bank.branch} onChange={(event) => setBank({ ...bank, branch: event.target.value })} /></Field>
              </div>
              <Field label="Instructions"><TextArea value={bank.instructions} onChange={(event) => setBank({ ...bank, instructions: event.target.value })} /></Field>
              <div className="mt-4 flex gap-2"><PrimaryButton type="submit" disabled={busy}>Save bank details</PrimaryButton>{(bank.bankName || bank.accountNumber) && <SecondaryButton type="button" onClick={() => setEditingBank(false)}>Cancel</SecondaryButton>}</div>
            </form>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-2"><Banknote className="text-emerald-700" size={19} /><h3 className="font-bold text-emerald-950">Bank transfer instructions</h3></div><SecondaryButton type="button" onClick={() => setEditingBank(true)}><Pencil size={15} /> Edit bank details</SecondaryButton></div>
              <dl className="mt-5 grid grid-cols-[120px_1fr] gap-2 text-sm"><dt className="text-emerald-700">Bank</dt><dd className="font-semibold">{bank.bankName || "—"}</dd><dt className="text-emerald-700">Account name</dt><dd className="font-semibold">{bank.accountName || "—"}</dd><dt className="text-emerald-700">Account number</dt><dd className="font-semibold">{bank.accountNumber || "—"}</dd><dt className="text-emerald-700">Branch</dt><dd className="font-semibold">{bank.branch || "—"}</dd></dl>
              {bank.instructions && <p className="mt-4 whitespace-pre-wrap border-t border-emerald-200 pt-4 text-sm text-emerald-800">{bank.instructions}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="font-bold text-emerald-950">Pay by bank transfer</h3>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-2 text-sm"><dt className="text-emerald-700">Bank</dt><dd className="font-semibold">{bank.bankName || "Contact Pentarix"}</dd><dt className="text-emerald-700">Account name</dt><dd className="font-semibold">{bank.accountName || "—"}</dd><dt className="text-emerald-700">Account number</dt><dd className="font-semibold">{bank.accountNumber || "—"}</dd><dt className="text-emerald-700">Branch</dt><dd className="font-semibold">{bank.branch || "—"}</dd></dl>
            {bank.instructions && <p className="mt-4 whitespace-pre-wrap text-sm text-emerald-800">{bank.instructions}</p>}
          </div>
          <form onSubmit={submitPurchase} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-950">Submit payment slip</h3>
            <div className="mt-4 space-y-4">
              <Field label="Package"><select required className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm" value={purchase.planId} onChange={(event) => setPurchase({ ...purchase, planId: event.target.value })}>{plans.filter((plan) => plan.isActive).map((plan) => <option key={plan._id} value={plan._id}>{plan.name} — {money(plan.price, plan.currency)} — {credits(plan.credits)} credits</option>)}</select></Field>
              <Field label="Bank transaction reference"><TextInput value={purchase.bankReference} onChange={(event) => setPurchase({ ...purchase, bankReference: event.target.value })} /></Field>
              <Field label="Payment slip (JPG, PNG, WebP or PDF; max 8 MB)"><input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setPurchase({ ...purchase, slip: event.target.files?.[0] || null })} className="block w-full text-sm" /></Field>
              <Field label="Note"><TextArea value={purchase.note} onChange={(event) => setPurchase({ ...purchase, note: event.target.value })} /></Field>
              <PrimaryButton type="submit" disabled={busy || !plans.length}>{busy ? "Submitting…" : "Submit for approval"}</PrimaryButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
