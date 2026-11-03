import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Coins, RefreshCcw, WalletCards } from "lucide-react";
import { api, formatDate } from "../lib/api";
import { classNames } from "../utils/classNames";
import { Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "./ui";

const emptyTopUp = { credits: "", type: "purchase", reference: "", paymentAmount: "", paymentCurrency: "LKR", note: "" };
const number = (value) => new Intl.NumberFormat().format(Number(value || 0));

function SummaryCard({ label, value, detail, tone = "slate" }) {
  const colors = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    violet: "border-violet-200 bg-violet-50 text-violet-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    slate: "border-slate-200 bg-white text-slate-950",
  };
  return <div className={classNames("rounded-xl border p-5 shadow-sm", colors[tone])}><div className="text-xs font-semibold uppercase tracking-wide opacity-60">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div><div className="mt-2 text-xs opacity-60">{detail}</div></div>;
}

export function CreditWalletPanel({ company, isSuperAdmin, onCreditsChanged }) {
  const [usage, setUsage] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topUp, setTopUp] = useState(emptyTopUp);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, history] = await Promise.all([
        api.companies.tokenUsage(company._id),
        api.companies.creditTransactions(company._id),
      ]);
      setUsage(summary);
      setTransactions(history.transactions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [company._id]);

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
      await load();
      await onCreditsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const wallet = usage?.wallet || {};
  return (
    <div className="space-y-6">
      {(error || notice) && <div className={classNames("rounded-xl border px-4 py-3 text-sm", error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>{error || notice}</div>}

      <section className="overflow-hidden rounded-2xl bg-[#0b1728] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4"><span className="rounded-2xl bg-emerald-300/15 p-3 text-emerald-300"><WalletCards size={26} /></span><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Prepaid AI wallet</div><div className="mt-1 text-3xl font-bold">{loading ? "—" : number(wallet.availableCredits)} credits</div><div className="mt-1 text-sm text-slate-400">Available for future customer conversations</div></div></div>
          <div className={classNames("rounded-full px-3 py-1.5 text-xs font-bold uppercase", wallet.status === "active" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300")}>{wallet.status || "Loading"}</div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Purchased" value={number(wallet.lifetimePurchased)} detail="Credits recorded against payments" tone="emerald" />
        <SummaryCard label="Bonus & migrated" value={number(Number(wallet.lifetimeBonus || 0) + Number(wallet.lifetimeAdjusted || 0))} detail="Promotions and administrator credits" tone="violet" />
        <SummaryCard label="Lifetime used" value={number(wallet.lifetimeUsed)} detail="Credits deducted by AI operations" tone="amber" />
        <SummaryCard label="Tokens this month" value={number(usage?.totalTokens)} detail={`${number(usage?.inputTokens)} input · ${number(usage?.outputTokens)} output`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Credit transaction history</h3><p className="mt-1 text-xs text-slate-500">Every purchase, bonus, migration and AI usage deduction.</p></div><SecondaryButton onClick={load} disabled={loading}><RefreshCcw size={15} /> Refresh</SecondaryButton></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3 text-right">Credits</th><th className="px-5 py-3 text-right">Balance</th></tr></thead><tbody className="divide-y divide-slate-100">
            {transactions.map((item) => <tr key={item._id}><td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(item.createdAt)}</td><td className="px-5 py-3"><div className="flex items-center gap-2 font-semibold capitalize text-slate-800">{item.direction === "credit" ? <ArrowUpRight className="text-emerald-600" size={15} /> : <ArrowDownRight className="text-rose-600" size={15} />}{item.type}</div><div className="mt-1 text-xs text-slate-400">{item.source || item.note}</div></td><td className="px-5 py-3 text-slate-500"><div>{item.reference || "—"}</div>{Number(item.paymentAmount) > 0 && <div className="mt-1 text-xs text-slate-400">{item.paymentCurrency} {Number(item.paymentAmount).toFixed(2)}</div>}</td><td className={classNames("px-5 py-3 text-right font-bold", item.direction === "credit" ? "text-emerald-700" : "text-rose-700")}>{item.direction === "credit" ? "+" : "−"}{number(item.credits)}</td><td className="px-5 py-3 text-right font-semibold text-slate-800">{number(item.balanceAfter)}</td></tr>)}
            {!transactions.length && !loading && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400">No credit transactions yet.</td></tr>}
          </tbody></table></div>
        </div>

        <div className="space-y-5">
          {isSuperAdmin ? <form onSubmit={submitCredits} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Coins className="text-emerald-600" size={19} /><h3 className="font-bold text-slate-900">Add prepaid credits</h3></div><p className="mt-1 text-xs leading-5 text-slate-500">Record payment or promotional credits. This creates a permanent ledger entry.</p><div className="mt-4 space-y-4">
            <Field label="Credits"><TextInput type="number" min="1" step="1" required value={topUp.credits} onChange={(event) => setTopUp((current) => ({ ...current, credits: event.target.value }))} placeholder="1000000" /></Field>
            <Field label="Transaction type"><select className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm" value={topUp.type} onChange={(event) => setTopUp((current) => ({ ...current, type: event.target.value }))}><option value="purchase">Paid purchase</option><option value="bonus">Promotional bonus</option><option value="refund">Refund credit</option><option value="adjustment">Administrator adjustment</option></select></Field>
            <Field label="Payment / invoice reference"><TextInput required={topUp.type === "purchase"} value={topUp.reference} onChange={(event) => setTopUp((current) => ({ ...current, reference: event.target.value }))} placeholder="INV-2026-001" /></Field>
            {topUp.type === "purchase" && <div className="grid grid-cols-[1fr_100px] gap-3"><Field label="Paid amount"><TextInput type="number" min="0.01" step="0.01" required value={topUp.paymentAmount} onChange={(event) => setTopUp((current) => ({ ...current, paymentAmount: event.target.value }))} placeholder="5000.00" /></Field><Field label="Currency"><TextInput required value={topUp.paymentCurrency} onChange={(event) => setTopUp((current) => ({ ...current, paymentCurrency: event.target.value.toUpperCase() }))} /></Field></div>}
            <Field label="Note"><TextArea value={topUp.note} onChange={(event) => setTopUp((current) => ({ ...current, note: event.target.value }))} placeholder="Package or payment details" /></Field>
            <PrimaryButton type="submit" disabled={saving}>{saving ? "Adding…" : "Add credits"}</PrimaryButton>
          </div></form> : <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Need more credits?</h3><p className="mt-2 text-sm leading-6 text-slate-500">Contact Pentarix to purchase another AI credit package. Your existing balance does not reset at the end of the month.</p></div>}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-xs leading-6 text-slate-600">
            <div className="font-bold text-slate-800">This month's usage sources</div>
            <div className="mt-2 grid grid-cols-2 gap-x-4"><span>RAG answers</span><strong className="text-right">{number(usage?.sources?.rag)}</strong><span>Message processing</span><strong className="text-right">{number(usage?.sources?.preprocessing)}</strong><span>Realtime voice</span><strong className="text-right">{number(usage?.sources?.realtime)}</strong><span>PDF ingestion</span><strong className="text-right">{number(usage?.sources?.ingestion)}</strong></div>
            <div className="mt-4 border-t border-slate-200 pt-3 font-bold text-slate-800">Charging rates</div><div className="mt-2">1M input tokens: {number(wallet.inputCreditsPerMillion)} credits</div><div>1M output tokens: {number(wallet.outputCreditsPerMillion)} credits</div><div className="mt-2 text-slate-400">Charges use provider-reported usage. Output is weighted separately from input.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
