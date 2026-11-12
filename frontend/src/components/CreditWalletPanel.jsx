import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Cpu,
  History,
  RefreshCcw,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { api, formatDate } from "../lib/api";
import { classNames } from "../utils/classNames";
import { Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "./ui";
import { BillingPanel } from "./BillingPanel";
import { ToastBridge } from "./ToastProvider";

const emptyTopUp = { credits: "", type: "purchase", reference: "", paymentAmount: "", paymentCurrency: "LKR", note: "" };
const number = (value) => new Intl.NumberFormat().format(Number(value || 0));

function SummaryCard({ label, value, detail, tone = "slate", icon: Icon }) {
  const colors = {
    emerald: "border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-emerald-100/70 text-emerald-950",
    blue: "border-blue-100 bg-gradient-to-br from-white via-blue-50 to-blue-100/70 text-blue-950",
    amber: "border-orange-100 bg-gradient-to-br from-white via-orange-50 to-orange-100/70 text-orange-950",
    slate: "border-teal-100 bg-gradient-to-br from-white via-teal-50 to-teal-100/70 text-slate-950",
  };
  return <div className={classNames("relative overflow-hidden rounded-2xl border p-5 shadow-sm", colors[tone])}><div className="absolute -bottom-10 -right-7 h-28 w-28 rounded-full bg-white/40"/><div className="relative flex items-start gap-3">{Icon && <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/75 text-emerald-700 shadow-sm"><Icon size={21}/></span>}<div className="min-w-0"><div className="text-xs font-bold uppercase tracking-wide opacity-60">{label}</div><div className="mt-1 truncate text-2xl font-black">{value}</div><div className="mt-2 text-xs opacity-60">{detail}</div></div></div></div>;
}

export function CreditWalletPanel({ company, isSuperAdmin, onCreditsChanged }) {
  const [usage, setUsage] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topUp, setTopUp] = useState(emptyTopUp);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPageSize, setTransactionPageSize] = useState(20);
  const [transactionPagination, setTransactionPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, history] = await Promise.all([
        api.companies.tokenUsage(company._id),
        api.companies.creditTransactions(company._id, { page: transactionPage, limit: transactionPageSize }),
      ]);
      setUsage(summary);
      setTransactions(history.transactions || []);
      setTransactionPagination({
        page: history.page || transactionPage,
        limit: history.limit || transactionPageSize,
        total: history.total || 0,
        pages: Math.max(1, history.pages || 1),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [company._id, transactionPage, transactionPageSize]);

  useEffect(() => { load(); }, [load]);

  async function submitCredits(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.companies.addCredits(company._id, { ...topUp, credits: Number(topUp.credits) });
      setTopUp(emptyTopUp);
      setNotice("Credits added and recorded in the transaction ledger.");
      if (transactionPage === 1) await load();
      else setTransactionPage(1);
      await onCreditsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const wallet = usage?.wallet || {};
  const lifetimeGranted = Number(wallet.lifetimeGranted || 0);
  const lifetimeUsed = Number(wallet.lifetimeUsed || 0);
  const usagePercent = lifetimeGranted > 0 ? Math.min(100, (lifetimeUsed / lifetimeGranted) * 100) : 0;
  const totalTransactionPages = Math.max(1, transactionPagination.pages || 1);
  const firstTransactionShown = transactionPagination.total
    ? ((transactionPagination.page - 1) * transactionPagination.limit) + 1
    : 0;
  const lastTransactionShown = transactionPagination.total
    ? Math.min(transactionPagination.page * transactionPagination.limit, transactionPagination.total)
    : 0;
  const transactionPageButtons = Array.from(new Set([
    1,
    transactionPagination.page - 1,
    transactionPagination.page,
    transactionPagination.page + 1,
    totalTransactionPages,
  ])).filter((item) => item >= 1 && item <= totalTransactionPages).sort((a, b) => a - b);
  return (
    <div className="ai-credit-page space-y-6">
      <ToastBridge error={error} notice={notice} />

      <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/70 p-6 shadow-sm">
        <div className="pointer-events-none absolute -bottom-24 right-[-5%] h-52 w-[60%] rounded-[50%] bg-emerald-200/30 blur-2xl"/><div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-teal-100/70"/><div className="pointer-events-none absolute -bottom-16 right-12 h-32 w-[48%] rotate-[-5deg] rounded-[50%] border-t border-emerald-300/30 bg-emerald-200/10"/>
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5"><span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white/80 text-emerald-800 shadow-sm backdrop-blur"><Cpu size={43} /></span><div><div className="text-sm font-bold text-emerald-800">Available Credits</div><div className="mt-1 flex items-center gap-3 text-4xl font-black tracking-tight text-slate-950">{loading ? "—" : number(wallet.availableCredits)} <Coins className="text-amber-500" size={25}/></div><div className="mt-2 text-xs font-medium text-slate-500">Ready for future AI customer conversations</div></div></div>
          <div className="flex flex-col items-start gap-3 md:items-end"><div className={classNames("rounded-full border px-3 py-1.5 text-xs font-bold uppercase", wallet.status === "active" ? "border-emerald-200 bg-white/75 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700")}>{wallet.status || "Loading"}</div><button type="button" onClick={() => document.getElementById("credit-usage-details")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800">View usage <ArrowRight size={16}/></button></div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Purchased" value={number(wallet.lifetimePurchased)} detail="Credits recorded against payments" tone="emerald" icon={BarChart3} />
        <SummaryCard label="Bonus & migrated" value={number(Number(wallet.lifetimeBonus || 0) + Number(wallet.lifetimeAdjusted || 0))} detail="Promotions and administrator credits" tone="blue" icon={WalletCards} />
        <SummaryCard label="Lifetime used" value={number(wallet.lifetimeUsed)} detail="Credits deducted by AI operations" tone="slate" icon={Clock3} />
        <SummaryCard label="Tokens this month" value={number(usage?.totalTokens)} detail={`${number(usage?.inputTokens)} input · ${number(usage?.outputTokens)} output`} tone="amber" icon={Sparkles} />
      </section>

      <BillingPanel company={company} isSuperAdmin={isSuperAdmin} onApproved={async () => { if (transactionPage === 1) await load(); else setTransactionPage(1); await onCreditsChanged?.(); }} />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,.55fr)]">
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><History size={20}/></span><div><h3 className="font-bold text-slate-900">Credit transaction history</h3><p className="mt-1 text-xs text-slate-500">Every purchase, bonus, migration and AI usage deduction.</p></div></div><SecondaryButton className="rounded-xl" onClick={() => load()} disabled={loading}><RefreshCcw className={loading ? "animate-spin" : ""} size={15} /> Refresh</SecondaryButton></div>
          <div className="max-h-[58vh] overflow-auto overscroll-contain"><table className="min-w-[760px] w-full text-sm"><thead className="sticky top-0 z-10 bg-emerald-50 text-left text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.25)]"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3 text-right">Credits</th><th className="px-5 py-3 text-right">Balance</th></tr></thead><tbody className="divide-y divide-slate-100">
            {transactions.map((item) => <tr key={item._id}><td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(item.createdAt)}</td><td className="px-5 py-3"><div className="flex items-center gap-2 font-semibold capitalize text-slate-800">{item.direction === "credit" ? <ArrowUpRight className="text-emerald-600" size={15} /> : <ArrowDownRight className="text-rose-600" size={15} />}{item.type}</div><div className="mt-1 text-xs text-slate-400">{item.source || item.note}</div></td><td className="px-5 py-3 text-slate-500"><div>{item.reference || "—"}</div>{Number(item.paymentAmount) > 0 && <div className="mt-1 text-xs text-slate-400">{item.paymentCurrency} {Number(item.paymentAmount).toFixed(2)}</div>}</td><td className={classNames("px-5 py-3 text-right font-bold", item.direction === "credit" ? "text-emerald-700" : "text-rose-700")}>{item.direction === "credit" ? "+" : "−"}{number(item.credits)}</td><td className="px-5 py-3 text-right font-semibold text-slate-800">{number(item.balanceAfter)}</td></tr>)}
            {!transactions.length && !loading && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400">No credit transactions yet.</td></tr>}
          </tbody></table></div>
          <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-slate-600"><span>Showing <strong className="text-slate-900">{firstTransactionShown}–{lastTransactionShown}</strong> of <strong className="text-slate-900">{transactionPagination.total}</strong></span><label className="flex items-center gap-2"><span>Rows per page</span><select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={transactionPageSize} onChange={(event) => { setTransactionPageSize(Number(event.target.value)); setTransactionPage(1); }}><option value={20}>20</option><option value={50}>50</option></select></label></div>
            <nav className="flex flex-wrap items-center gap-1.5" aria-label="Credit transaction pagination">
              <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={transactionPagination.page <= 1 || loading} onClick={() => setTransactionPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16}/> Previous</button>
              {transactionPageButtons.map((pageNumber, index) => <span key={pageNumber} className="contents">{index > 0 && pageNumber - transactionPageButtons[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}<button type="button" aria-current={pageNumber === transactionPagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-lg border px-3 font-bold transition ${pageNumber === transactionPagination.page ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`} disabled={loading} onClick={() => setTransactionPage(pageNumber)}>{pageNumber}</button></span>)}
              <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={transactionPagination.page >= totalTransactionPages || loading} onClick={() => setTransactionPage((current) => Math.min(totalTransactionPages, current + 1))}>Next <ChevronRight size={16}/></button>
            </nav>
          </div>
        </div>

        <div className="space-y-5">
          {isSuperAdmin ? <form onSubmit={submitCredits} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Coins size={20}/></span><div><h3 className="font-bold text-slate-900">Add prepaid credits</h3><p className="mt-1 text-xs leading-5 text-slate-500">Record payment or promotional credits.</p></div></div><div className="mt-4 space-y-4">
            <Field label="Credits"><TextInput type="number" min="1" step="1" required value={topUp.credits} onChange={(event) => setTopUp((current) => ({ ...current, credits: event.target.value }))} placeholder="1000000" /></Field>
            <Field label="Transaction type"><select className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm" value={topUp.type} onChange={(event) => setTopUp((current) => ({ ...current, type: event.target.value }))}><option value="purchase">Paid purchase</option><option value="bonus">Promotional bonus</option><option value="refund">Refund credit</option><option value="adjustment">Administrator adjustment</option></select></Field>
            <Field label="Payment / invoice reference"><TextInput required={topUp.type === "purchase"} value={topUp.reference} onChange={(event) => setTopUp((current) => ({ ...current, reference: event.target.value }))} placeholder="INV-2026-001" /></Field>
            {topUp.type === "purchase" && <div className="grid grid-cols-[1fr_100px] gap-3"><Field label="Paid amount"><TextInput type="number" min="0.01" step="0.01" required value={topUp.paymentAmount} onChange={(event) => setTopUp((current) => ({ ...current, paymentAmount: event.target.value }))} placeholder="5000.00" /></Field><Field label="Currency"><TextInput required value={topUp.paymentCurrency} onChange={(event) => setTopUp((current) => ({ ...current, paymentCurrency: event.target.value.toUpperCase() }))} /></Field></div>}
            <Field label="Note"><TextArea value={topUp.note} onChange={(event) => setTopUp((current) => ({ ...current, note: event.target.value }))} placeholder="Package or payment details" /></Field>
            <PrimaryButton className="w-full rounded-xl" type="submit" disabled={saving}>{saving ? "Adding…" : "Add credits"}</PrimaryButton>
          </div></form> : <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Need more credits?</h3><p className="mt-2 text-sm leading-6 text-slate-500">Contact Pentarix to purchase another AI credit package. Your existing balance does not reset at the end of the month.</p></div>}
          <div id="credit-usage-details" className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-teal-50 p-5 text-xs leading-6 text-slate-600 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-bold text-slate-800"><Activity className="text-emerald-700" size={18}/> This month's usage sources</div><span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700">{usagePercent.toFixed(2)}% lifetime used</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500" style={{ width: `${usagePercent}%` }}/></div>
            <div className="mt-2 grid grid-cols-2 gap-x-4"><span>RAG answers</span><strong className="text-right">{number(usage?.sources?.rag)}</strong><span>Message processing</span><strong className="text-right">{number(usage?.sources?.preprocessing)}</strong><span>Realtime voice</span><strong className="text-right">{number(usage?.sources?.realtime)}</strong><span>PDF ingestion</span><strong className="text-right">{number(usage?.sources?.ingestion)}</strong></div>
            <div className="mt-4 border-t border-slate-200 pt-3 font-bold text-slate-800">Charging rates</div><div className="mt-2">1M input tokens: {number(wallet.inputCreditsPerMillion)} credits</div><div>1M output tokens: {number(wallet.outputCreditsPerMillion)} credits</div><div className="mt-2 text-slate-400">Charges use provider-reported usage. Output is weighted separately from input.</div>
          </div>
        </div>
      </section>

    </div>
  );
}
