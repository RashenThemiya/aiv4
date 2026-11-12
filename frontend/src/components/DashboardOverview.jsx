import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Bot,
  ChevronRight,
  CircleGauge,
  Clock3,
  Globe2,
  Layers3,
  MessageCircleMore,
  MessagesSquare,
  Package,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Workflow,
} from "lucide-react";
import { api, formatDate } from "../lib/api";
import { classNames } from "../utils/classNames";

const metricStyles = {
  emerald: { card: "border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/80", icon: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  cyan: { card: "border-cyan-200/80 bg-gradient-to-br from-white to-cyan-50/80", icon: "bg-cyan-100 text-cyan-700 ring-cyan-200" },
  violet: { card: "border-violet-200/80 bg-gradient-to-br from-white to-violet-50/80", icon: "bg-violet-100 text-violet-700 ring-violet-200" },
  amber: { card: "border-amber-200/80 bg-gradient-to-br from-white to-amber-50/80", icon: "bg-amber-100 text-amber-700 ring-amber-200" },
};

const statusStyles = {
  new: "bg-amber-100 text-amber-800",
  confirmed: "bg-cyan-100 text-cyan-800",
  processing: "bg-violet-100 text-violet-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

const channelLabels = { web: "Website", whatsapp: "WhatsApp", messenger: "Messenger", sms: "SMS" };

function formatTokens(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatMoney(order) {
  if (order.priceStatus === "pending") return "Price pending";
  return `${order.currency || "LKR"} ${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(order.total || 0))}`;
}

function itemSummary(order) {
  const items = order.items || [];
  if (!items.length) return "No items";
  const first = `${items[0].quantity} × ${items[0].name}${items[0].option ? ` (${items[0].option})` : ""}`;
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

function MetricCard({ icon: Icon, label, value, detail, accent, onClick }) {
  const style = metricStyles[accent];
  return (
    <button type="button" onClick={onClick} className={classNames("group flex min-h-[98px] w-full items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", style.card)}>
      <span className={classNames("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1", style.icon)}><Icon size={23} strokeWidth={2.2} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-700">{label}</span>
        <span className="block text-2xl font-bold tracking-tight text-slate-950">{value}</span>
        <span className="mt-1 block truncate text-xs text-slate-500">{detail}</span>
      </span>
      <ChevronRight className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" size={18} />
    </button>
  );
}

function ChannelRow({ icon: Icon, name, detail, connected, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-emerald-100 hover:bg-emerald-50/70">
      <span className={classNames("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700")}><Icon size={19} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{name}</span><span className="block truncate text-xs text-slate-500">{detail}</span></span>
      <span className={classNames("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{connected ? "Connected" : "Set up"}</span>
    </button>
  );
}

function GlanceItem({ icon: Icon, value, label }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Icon size={19} /></span>
      <div><div className="text-xl font-bold text-slate-950">{value}</div><div className="text-xs leading-4 text-slate-500">{label}</div></div>
    </div>
  );
}

export function DashboardOverview({ company, documents, conversations, setActiveSection }) {
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState({ whatsapp: false, messenger: false, sms: false });
  const [tokenUsage, setTokenUsage] = useState(company.tokenUsage || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const safe = (promise) => promise.catch(() => null);
      const [orderSummary, orderList, productList, whatsapp, messenger, sms, usage] = await Promise.all([
        safe(api.orders.summary(company._id)),
        safe(api.orders.list(company._id, { limit: 4 })),
        safe(api.products.list(company._id)),
        safe(api.whatsappIntegration.get(company._id)),
        safe(api.messengerIntegration.get(company._id)),
        safe(api.smsIntegration.get(company._id)),
        safe(api.companies.tokenUsage(company._id)),
      ]);
      if (!cancelled) {
        setSummary(orderSummary);
        setOrders(orderList?.orders || []);
        setProducts(productList || []);
        setChannels({ whatsapp: Boolean(whatsapp?.isActive), messenger: Boolean(messenger?.isActive), sms: Boolean(sms?.isActive) });
        setTokenUsage(usage || company.tokenUsage || null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [company._id]);

  const activeProducts = products.filter((product) => product.isActive !== false).length;
  const indexedDocuments = documents.filter((item) => item.status === "indexed").length;
  const websiteConnected = Boolean(company.widgetApiKeyPreview);
  const connectedChannels = [channels.whatsapp, channels.messenger, channels.sms, websiteConnected].filter(Boolean).length;
  const availableCredits = Number(tokenUsage?.wallet?.availableCredits || 0);
  const lifetimeUsed = Number(tokenUsage?.wallet?.lifetimeUsed || 0);
  const creditTotal = availableCredits + lifetimeUsed;
  const usagePercent = creditTotal > 0 ? Math.min(100, Math.round((lifetimeUsed / creditTotal) * 100)) : 0;
  const metricValue = loading ? "—" : null;

  const channelRows = useMemo(() => [
    { icon: MessageCircleMore, name: "WhatsApp Business", detail: "Automated support and ordering", connected: channels.whatsapp, section: "whatsapp" },
    { icon: MessagesSquare, name: "Facebook Messenger", detail: "Connected Facebook Page", connected: channels.messenger, section: "messenger" },
    { icon: Globe2, name: "Website", detail: "Embedded customer support", connected: websiteConnected, section: "help" },
    { icon: Smartphone, name: "SMS", detail: "Text-based customer support", connected: channels.sms, section: "sms" },
  ], [channels, websiteConnected]);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/70 px-6 py-7 shadow-sm sm:px-8 lg:py-8">
        <div className="pointer-events-none absolute -bottom-24 right-[-5%] h-52 w-[60%] rounded-[50%] bg-emerald-200/30 blur-2xl" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-teal-100/70" />
        <div className="pointer-events-none absolute -bottom-16 right-12 h-32 w-[48%] rotate-[-5deg] rounded-[50%] border-t border-emerald-300/30 bg-emerald-200/10" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/75 px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm backdrop-blur"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" /> Operational</div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Welcome back, {company.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Your AI assistant is ready to answer customer questions, capture order details, and handle product inquiries with automated ordering across your sales channels.</p>
          </div>
          <button type="button" onClick={() => setActiveSection("orders")} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-xl">View incoming orders <ArrowRight size={16} /></button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ShoppingCart} label="New Orders" value={metricValue ?? summary?.counts?.new ?? 0} detail="Waiting for your team to review" accent="emerald" onClick={() => setActiveSection("orders")} />
        <MetricCard icon={Package} label="Active Products" value={metricValue ?? activeProducts} detail="Products available to the assistant" accent="cyan" onClick={() => setActiveSection("products")} />
        <MetricCard icon={MessageCircleMore} label="Conversations" value={conversations.length} detail="Customer conversations across channels" accent="violet" onClick={() => setActiveSection("history")} />
        <MetricCard icon={BookOpenText} label="Knowledge Files" value={documents.length} detail={`${indexedDocuments} ready for customer answers`} accent="amber" onClick={() => setActiveSection("documents")} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,.9fr)]">
        <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70 p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CircleGauge size={22} /></span><div><h3 className="font-bold text-slate-950">AI Credit Health</h3><p className="mt-0.5 text-xs text-slate-500">Balance carries forward until used.</p></div></div>
            <button type="button" onClick={() => setActiveSection("credits")} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-900">View wallet <ArrowRight size={15} /></button>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end">
            <div><div className="text-3xl font-bold tracking-tight text-emerald-800">{formatTokens(availableCredits)}</div><div className="mt-1 text-sm font-semibold text-emerald-700">Available Credits</div></div>
            <div className="border-slate-200 sm:border-l sm:pl-6"><div className="text-xs font-medium text-slate-500">Lifetime used</div><div className="mt-1 text-xl font-bold text-slate-950">{formatTokens(lifetimeUsed)}</div></div>
            <div className="border-slate-200 sm:border-l sm:pl-6"><div className="text-xs font-medium text-slate-500">Tokens this month</div><div className="mt-1 text-xl font-bold text-slate-950">{formatTokens(tokenUsage?.totalTokens)}</div></div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500 transition-all" style={{ width: `${Math.max(usagePercent, usagePercent > 0 ? 3 : 1)}%` }} /></div>
          <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>{formatTokens(tokenUsage?.inputTokens)} input tokens · {formatTokens(tokenUsage?.outputTokens)} output tokens this month</span><span>{usagePercent}% lifetime wallet usage</span></div>
          {tokenUsage?.wallet?.lowBalance && <p className={classNames("mt-3 rounded-lg px-3 py-2 text-xs font-semibold", availableCredits > 0 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800")}>{availableCredits > 0 ? "Credit balance is low. Purchase another package to prevent interruption." : "Credit balance is empty. AI knowledge answers are paused."}</p>}
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/80 p-5 shadow-sm lg:p-6">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Sparkles size={21} /></span><div><h3 className="font-bold text-slate-950">Today at a glance</h3><p className="mt-0.5 text-xs text-slate-500">Key items to keep your business moving.</p></div></div>
          <div className="mt-5 grid divide-y divide-slate-100 rounded-xl border border-emerald-100 bg-white/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <GlanceItem icon={ShoppingCart} value={summary?.counts?.new || 0} label="Orders awaiting review" />
            <GlanceItem icon={Layers3} value={summary?.counts?.processing || 0} label="Processing orders" />
            <GlanceItem icon={Workflow} value={connectedChannels} label="Connected channels" />
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,.65fr)]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ShoppingCart size={20} /></span><div><h3 className="font-bold text-slate-950">Recent Orders</h3><p className="text-xs text-slate-500">Latest orders captured by your assistants.</p></div></div>
            <button type="button" onClick={() => setActiveSection("orders")} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900">View all <ChevronRight size={15} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead className="bg-emerald-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order._id} onClick={() => setActiveSection("orders")} className="cursor-pointer transition hover:bg-emerald-50/40">
                    <td className="px-5 py-3"><div className="text-xs font-bold text-slate-900">{order.orderNumber}</div><div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><Clock3 size={11} />{formatDate(order.createdAt)}</div></td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{order.customer?.name || "Guest customer"}</td>
                    <td className="max-w-[230px] truncate px-4 py-3 text-xs text-slate-600">{itemSummary(order)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-900">{formatMoney(order)}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700"><Bot size={14} className="text-emerald-600" />{channelLabels[order.channel] || order.channel || "Web"}</span></td>
                    <td className="px-4 py-3"><span className={classNames("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", statusStyles[order.status] || "bg-slate-100 text-slate-700")}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders.length && !loading && <div className="px-5 py-12 text-center"><ShoppingCart className="mx-auto text-slate-300" size={30} /><div className="mt-3 text-sm font-bold text-slate-700">No orders yet</div><p className="mt-1 text-xs text-slate-500">New Website, WhatsApp, Messenger, and SMS orders will appear here.</p></div>}
            {loading && <div className="px-5 py-12 text-center text-sm text-slate-400">Loading business activity…</div>}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Workflow size={20} /></span><div><h3 className="font-bold text-slate-950">Sales Channels</h3><p className="mt-0.5 text-xs text-slate-500">Connection readiness and automated ordering.</p></div></div>
          <div className="mt-4 space-y-1">{channelRows.map((channel) => <ChannelRow key={channel.name} {...channel} onClick={() => setActiveSection(channel.section)} />)}</div>
        </article>
      </section>
    </div>
  );
}
