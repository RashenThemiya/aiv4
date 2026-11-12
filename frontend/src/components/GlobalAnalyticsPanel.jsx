import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Download,
  MessageCircleMore,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { api } from "../lib/api";
import { classNames } from "../utils/classNames";
import { Field, PrimaryButton, SecondaryButton, TextInput } from "./ui";
import { ToastBridge } from "./ToastProvider";

const number = (value) => new Intl.NumberFormat().format(Number(value || 0));
const usd = (value) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(Number(value || 0));
const money = (item = {}) => `${item.currency || "LKR"} ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2 }).format(Number(item.amount || 0))}`;
const monthName = (value) => new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00.000Z`));

function currentMonth() { return new Date().toISOString().slice(0, 7); }
function shiftMonth(value, change) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + change, 1)).toISOString().slice(0, 7);
}

function SummaryCard({ title, value, detail, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "border-emerald-100 from-white via-emerald-50 to-emerald-100/70 text-emerald-700",
    blue: "border-blue-100 from-white via-blue-50 to-blue-100/70 text-blue-700",
    violet: "border-violet-100 from-white via-violet-50 to-violet-100/70 text-violet-700",
    amber: "border-amber-100 from-white via-amber-50 to-orange-100/70 text-amber-700",
    cyan: "border-cyan-100 from-white via-cyan-50 to-cyan-100/70 text-cyan-700",
  };
  return <article className={classNames("relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm", tones[tone])}><div className="absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-white/45"/><div className="relative flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm"><Icon size={21}/></span><div className="min-w-0"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div><div className="mt-1 truncate text-2xl font-black text-slate-950">{value}</div><div className="mt-2 text-xs text-slate-500">{detail}</div></div></div></article>;
}

function BarChart({ title, detail, data, dataKey, color = "bg-emerald-500", formatter = number }) {
  const maximum = Math.max(1, ...data.map((item) => Number(item[dataKey] || 0)));
  return <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div><h3 className="font-bold text-slate-950">{title}</h3><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className="mt-6 flex h-48 items-end gap-2 border-b border-slate-200 px-1">{data.map((item) => { const value = Number(item[dataKey] || 0); return <div key={item.period} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="pointer-events-none opacity-0 transition group-hover:opacity-100 rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">{formatter(value)}</div><div className={classNames("w-full max-w-10 rounded-t-md transition-all group-hover:opacity-80", color)} style={{ height: `${Math.max(value ? 5 : 1, (value / maximum) * 130)}px` }}/><div className="w-full truncate text-center text-[9px] text-slate-400">{monthName(item.period)}</div></div>; })}</div></article>;
}

function SourceBar({ label, value, total, color }) {
  const percent = total > 0 ? (Number(value || 0) / total) * 100 : 0;
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{label}</span><span className="text-slate-500">{number(value)} tokens</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={classNames("h-full rounded-full", color)} style={{ width: `${Math.min(100, percent)}%` }}/></div></div>;
}

function Pagination({ meta, page, setPage, pageSize, setPageSize, busy }) {
  const pages = Math.max(1, meta.pages || 1);
  const first = meta.total ? ((meta.page - 1) * meta.limit) + 1 : 0;
  const last = meta.total ? Math.min(meta.page * meta.limit, meta.total) : 0;
  return <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-3 text-slate-600"><span>Showing <strong className="text-slate-900">{first}-{last}</strong> of <strong className="text-slate-900">{meta.total || 0}</strong></span><label className="flex items-center gap-2"><span>Rows</span><select className="h-9 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="20">20</option><option value="50">50</option></select></label></div><div className="flex items-center gap-2"><button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40" disabled={page <= 1 || busy} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16}/> Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-emerald-600 px-3 font-bold text-white">{page}</span><span className="text-slate-400">of {pages}</span><button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40" disabled={page >= pages || busy} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next <ChevronRight size={16}/></button></div></div>;
}

export function GlobalAnalyticsPanel() {
  const [tab, setTab] = useState("platform");
  const [platform, setPlatform] = useState(null);
  const [usage, setUsage] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({ companyId: "", dateFrom: shiftMonth(currentMonth(), -5), dateTo: currentMonth() });
  const [appliedFilters, setAppliedFilters] = useState({ companyId: "", dateFrom: shiftMonth(currentMonth(), -5), dateTo: currentMonth() });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPlatform = useCallback(async () => {
    setLoading(true); setError("");
    try { setPlatform(await api.analytics.platform()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  const loadUsage = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [report, nextCompanies] = await Promise.all([
        api.analytics.usage({ ...appliedFilters, page, limit: pageSize }),
        companies.length ? Promise.resolve(companies) : api.companies.list(),
      ]);
      setUsage(report); setCompanies(nextCompanies);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [appliedFilters, page, pageSize, companies]);

  useEffect(() => { loadPlatform(); }, [loadPlatform]);
  useEffect(() => { if (tab === "usage") loadUsage(); }, [tab, loadUsage]);

  const sourceTotal = useMemo(() => Object.values(usage?.summary?.sources || {}).reduce((sum, value) => sum + Number(value || 0), 0), [usage]);

  async function downloadUsage() {
    setBusy(true); setError(""); setNotice("");
    try {
      const blob = await api.analytics.usageReport(appliedFilters); const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `pentarix-ai-usage-${appliedFilters.dateFrom}-to-${appliedFilters.dateTo}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setNotice("AI usage report downloaded.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const summary = platform?.summary || {};
  const usageSummary = usage?.summary || {};
  const tabs = [{ id: "platform", label: "Platform analytics", icon: BarChart3 }, { id: "usage", label: "Global AI usage", icon: Bot }];

  return <div className="global-analytics-page space-y-6"><ToastBridge error={error} notice={notice}/>
    <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/60 p-6 shadow-sm"><div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-200/35"/><div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-white/80 text-emerald-700 shadow-sm"><BarChart3 size={32}/></span><div><h2 className="text-2xl font-black tracking-tight text-slate-950">Platform Analytics</h2><p className="mt-1 text-sm text-slate-600">Monitor business growth, commerce activity, channel adoption and AI consumption.</p></div></div><SecondaryButton onClick={tab === "platform" ? loadPlatform : loadUsage} disabled={loading}><RefreshCcw className={loading ? "animate-spin" : ""} size={16}/> Refresh data</SecondaryButton></div></section>

    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setTab(id)} className={classNames("flex min-w-fit flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold", tab === id ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800")}><Icon size={18}/>{label}</button>)}</div>

    {tab === "platform" && <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard title="Total companies" value={number(summary.totalCompanies)} detail={`${number(summary.activeCompanies)} currently active`} icon={Building2}/><SummaryCard title="Conversations" value={number(summary.conversations)} detail="Across every customer channel" icon={MessageCircleMore} tone="violet"/><SummaryCard title="Orders" value={number(summary.orders)} detail={`Order value ${money(summary.orderValue)}`} icon={ShoppingCart} tone="blue"/><SummaryCard title="Connected channels" value={number(summary.connectedChannels)} detail="Active company channel connections" icon={Activity} tone="cyan"/><SummaryCard title="Payment revenue" value={money(summary.paymentRevenue)} detail={`${number(summary.paymentRevenue?.count)} approved payments`} icon={CircleDollarSign} tone="amber"/><SummaryCard title="Active businesses" value={number(summary.activeCompanies)} detail="Available seller workspaces" icon={UsersRound} tone="emerald"/></section>
      <section className="grid gap-5 xl:grid-cols-2"><BarChart title="Conversation growth" detail="New customer conversations during the last 12 months." data={platform?.monthly || []} dataKey="conversations" color="bg-violet-500"/><BarChart title="Order growth" detail="Orders captured by every connected channel." data={platform?.monthly || []} dataKey="orders" color="bg-blue-500"/><BarChart title="New companies" detail="Seller workspaces created each month." data={platform?.monthly || []} dataKey="companies" color="bg-emerald-500"/><BarChart title="Approved payment revenue" detail={`Monthly revenue shown in ${summary.paymentRevenue?.currency || "LKR"}.`} data={platform?.monthly || []} dataKey="paymentRevenue" color="bg-amber-500" formatter={(value) => `${summary.paymentRevenue?.currency || "LKR"} ${number(value)}`}/></section>
      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-slate-950">Channel performance</h3><p className="mt-1 text-xs text-slate-500">Connected accounts and conversations by channel.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-emerald-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Channel</th><th className="px-5 py-3 text-right">Connections</th><th className="px-5 py-3 text-right">Conversations</th><th className="px-5 py-3 text-right">Share</th></tr></thead><tbody className="divide-y divide-slate-100">{(platform?.channels || []).map((item) => <tr key={item.channel}><td className="px-5 py-3 font-semibold capitalize text-slate-900">{item.channel === "web" ? "Website" : item.channel}</td><td className="px-5 py-3 text-right text-slate-600">{number(item.connections)}</td><td className="px-5 py-3 text-right font-semibold text-slate-800">{number(item.conversations)}</td><td className="px-5 py-3 text-right text-slate-500">{summary.conversations ? `${((item.conversations / summary.conversations) * 100).toFixed(1)}%` : "0%"}</td></tr>)}</tbody></table></div></div><div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-950">Revenue currencies</h3><p className="mt-1 text-xs text-slate-500">Approved payments are kept separate by currency.</p><div className="mt-5 space-y-3">{(platform?.paymentRevenueByCurrency || []).map((item) => <div key={item.currency} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div><div className="font-bold text-slate-900">{item.currency}</div><div className="text-xs text-slate-500">{number(item.count)} payments</div></div><div className="font-black text-emerald-700">{money(item)}</div></div>)}{!platform?.paymentRevenueByCurrency?.length && <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No approved payment revenue yet.</div>}</div></div></section>
    </div>}

    {tab === "usage" && <div className="space-y-6">
      <section className="grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[1.4fr_.8fr_.8fr_auto_auto]"><Field label="Company"><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500" value={filters.companyId} onChange={(event) => setFilters({ ...filters, companyId: event.target.value })}><option value="">All companies</option>{companies.map((company) => <option value={company._id} key={company._id}>{company.name}</option>)}</select></Field><Field label="From month"><TextInput type="month" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}/></Field><Field label="To month"><TextInput type="month" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}/></Field><PrimaryButton className="h-11 self-end" onClick={() => { setPage(1); setAppliedFilters(filters); }}>Apply filters</PrimaryButton><SecondaryButton className="h-11 self-end" onClick={() => { const next = { companyId: "", dateFrom: shiftMonth(currentMonth(), -5), dateTo: currentMonth() }; setFilters(next); setPage(1); setAppliedFilters(next); }}>Reset</SecondaryButton></section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><SummaryCard title="Input tokens" value={number(usageSummary.inputTokens)} detail="Tokens sent to AI models" icon={Bot}/><SummaryCard title="Output tokens" value={number(usageSummary.outputTokens)} detail="Tokens generated for replies" icon={Sparkles} tone="violet"/><SummaryCard title="Credits consumed" value={number(usageSummary.creditsConsumed)} detail="Prepaid credits deducted" icon={Coins} tone="amber"/><SummaryCard title="Estimated AI cost" value={usage?.costTrackingEnabled ? usd(usageSummary.estimatedCostUsd) : "Not configured"} detail={usage?.costTrackingEnabled ? "Based on configured model rates" : "Set OpenAI input/output cost rates"} icon={WalletCards} tone="blue"/><SummaryCard title="AI operations" value={number(usageSummary.requestCount)} detail={`${number(usageSummary.totalTokens)} total tokens`} icon={Activity} tone="cyan"/></section>
      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><BarChart title="Monthly AI token usage" detail="Input and output token volume for the selected period." data={usage?.monthly || []} dataKey="totalTokens" color="bg-emerald-500"/><div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-950">Usage by source</h3><p className="mt-1 text-xs text-slate-500">Where AI tokens were consumed.</p><div className="mt-5 space-y-4"><SourceBar label="RAG answers" value={usageSummary.sources?.rag} total={sourceTotal} color="bg-emerald-500"/><SourceBar label="Message preprocessing" value={usageSummary.sources?.preprocessing} total={sourceTotal} color="bg-blue-500"/><SourceBar label="Realtime voice" value={usageSummary.sources?.realtime} total={sourceTotal} color="bg-violet-500"/><SourceBar label="PDF ingestion" value={usageSummary.sources?.ingestion} total={sourceTotal} color="bg-amber-500"/><SourceBar label="Embeddings" value={usageSummary.sources?.embedding} total={sourceTotal} color="bg-cyan-500"/><SourceBar label="Vision" value={usageSummary.sources?.vision} total={sourceTotal} color="bg-rose-500"/></div></div></section>
      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-950">Usage by company</h3><p className="mt-1 text-xs text-slate-500">Provider-reported usage and prepaid credit deductions.</p></div><div className="flex gap-2"><SecondaryButton onClick={loadUsage}><RefreshCcw className={loading ? "animate-spin" : ""} size={15}/> Refresh</SecondaryButton><PrimaryButton onClick={downloadUsage} disabled={busy}><Download size={15}/> Export CSV</PrimaryButton></div></div><div className="max-h-[58vh] overflow-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="sticky top-0 z-10 bg-emerald-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Company</th><th className="px-5 py-3 text-right">Input</th><th className="px-5 py-3 text-right">Output</th><th className="px-5 py-3 text-right">Total tokens</th><th className="px-5 py-3 text-right">Credits</th><th className="px-5 py-3 text-right">Cost USD</th><th className="px-5 py-3 text-right">Operations</th></tr></thead><tbody className="divide-y divide-slate-100">{(usage?.companies || []).map((item) => <tr key={item.companyId}><td className="px-5 py-3"><div className="font-semibold text-slate-900">{item.companyName}</div><div className="text-xs text-slate-500">{item.companySlug}</div></td><td className="px-5 py-3 text-right text-slate-600">{number(item.inputTokens)}</td><td className="px-5 py-3 text-right text-slate-600">{number(item.outputTokens)}</td><td className="px-5 py-3 text-right font-bold text-slate-900">{number(item.totalTokens)}</td><td className="px-5 py-3 text-right font-bold text-amber-700">{number(item.creditsConsumed)}</td><td className="px-5 py-3 text-right text-slate-600">{usage.costTrackingEnabled ? usd(item.estimatedCostUsd) : "-"}</td><td className="px-5 py-3 text-right text-slate-600">{number(item.requestCount)}</td></tr>)}{!usage?.companies?.length && !loading && <tr><td colSpan="7" className="px-5 py-12 text-center text-slate-400">No AI usage matches these filters.</td></tr>}</tbody></table></div><Pagination meta={usage || {}} page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} busy={loading}/></section>
    </div>}
  </div>;
}
