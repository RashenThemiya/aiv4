import {
  CalendarDays,
  CheckCheck,
  ChevronDown,
  CircleUserRound,
  Globe2,
  History,
  Info,
  Languages,
  Layers3,
  MessageCircle,
  MessagesSquare,
  MoreVertical,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, formatDate } from "../lib/api";
import { classNames } from "../utils/classNames";

const CHANNELS = {
  web: { label: "Website", icon: Globe2, color: "text-emerald-700" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "text-green-600" },
  messenger: { label: "Messenger", icon: MessagesSquare, color: "text-blue-600" },
  sms: { label: "SMS", icon: MessageCircle, color: "text-violet-600" },
  voice: { label: "Voice", icon: MessageCircle, color: "text-amber-600" },
};

const LANGUAGES = { en: "English", si: "Sinhala", ta: "Tamil" };

function dateInputValue(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function daysAgo(days) {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - days);
  return dateInputValue(value);
}

function conversationName(conversation) {
  return conversation.customerName || conversation.customerEmail || conversation.customerPhone ||
    conversation.customerExternalId || conversation.sessionId || "Customer";
}

function shortSession(sessionId, max = 32) {
  const value = String(sessionId || "");
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function messageTime(conversation) {
  const date = new Date(conversation?.updatedAt || conversation?.createdAt || Date.now());
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function dayLabel(value) {
  if (!value) return "Conversation";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function MetricCard({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: "border-emerald-200 bg-gradient-to-br from-white via-emerald-50/80 to-emerald-100/70 text-emerald-700",
    blue: "border-blue-200 bg-gradient-to-br from-white via-blue-50/80 to-blue-100/70 text-blue-700",
    violet: "border-violet-200 bg-gradient-to-br from-white via-violet-50/80 to-violet-100/70 text-violet-700",
    amber: "border-amber-200 bg-gradient-to-br from-white via-amber-50/80 to-amber-100/70 text-amber-700",
  };
  return (
    <div className={classNames("relative overflow-hidden rounded-2xl border p-4 shadow-sm", tones[tone])}>
      <div className="pointer-events-none absolute -bottom-10 right-[-8%] h-20 w-3/4 rounded-[50%] bg-current opacity-[0.05]" />
      <div className="relative flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/65 shadow-sm"><Icon size={24} /></span>
        <div><p className="text-sm font-semibold text-slate-700">{label}</p><p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{new Intl.NumberFormat().format(value || 0)}</p></div>
      </div>
    </div>
  );
}

function ChannelMark({ channel, compact = false }) {
  const meta = CHANNELS[channel] || CHANNELS.web;
  const Icon = meta.icon;
  return <span className={classNames("inline-flex items-center gap-1.5 font-medium", meta.color)}><Icon size={compact ? 13 : 15} /><span>{meta.label}</span></span>;
}

export function ConversationsPanel({
  companyId, conversations, selectedConversation, conversationSearch, setConversationSearch,
  loading, onSearch, onClearSearch, onRefresh, onOpenConversation,
}) {
  const [channel, setChannel] = useState("");
  const [language, setLanguage] = useState("");
  const [datePreset, setDatePreset] = useState("30");
  const [dateFrom, setDateFrom] = useState(() => daysAgo(29));
  const [dateTo, setDateTo] = useState(() => daysAgo(0));
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    let active = true;
    if (!companyId) return undefined;
    api.orders.summary(companyId)
      .then((result) => { if (active) setOrderCount(Number(result?.total || 0)); })
      .catch(() => { if (active) setOrderCount(0); });
    return () => { active = false; };
  }, [companyId]);

  const filteredConversations = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    return conversations.filter((item) => {
      const updatedAt = new Date(item.updatedAt || item.createdAt);
      return !(channel && item.channel !== channel) && !(language && item.preferredLanguage !== language) &&
        !(from && updatedAt < from) && !(to && updatedAt > to);
    });
  }, [channel, conversations, dateFrom, dateTo, language]);

  const todayCount = useMemo(() => {
    const today = dateInputValue(new Date());
    return conversations.filter((item) => dateInputValue(new Date(item.updatedAt || item.createdAt)) === today).length;
  }, [conversations]);
  const activeChannels = useMemo(() => new Set(conversations.map((item) => item.channel).filter(Boolean)).size, [conversations]);

  function chooseDatePreset(value) {
    setDatePreset(value);
    if (value === "today") { setDateFrom(daysAgo(0)); setDateTo(daysAgo(0)); }
    if (value === "7") { setDateFrom(daysAgo(6)); setDateTo(daysAgo(0)); }
    if (value === "30") { setDateFrom(daysAgo(29)); setDateTo(daysAgo(0)); }
  }

  async function resetFilters() {
    setChannel(""); setLanguage(""); setDatePreset(""); setDateFrom(""); setDateTo("");
    await onClearSearch();
  }

  const selectedMeta = selectedConversation ? (CHANNELS[selectedConversation.channel] || CHANNELS.web) : CHANNELS.web;
  const SelectedChannelIcon = selectedMeta.icon;
  const selectedLanguage = LANGUAGES[selectedConversation?.preferredLanguage] || "Not selected";

  return (
    <section className="conversation-page space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={MessageCircle} label="Total Conversations" value={conversations.length} tone="emerald" />
        <MetricCard icon={CalendarDays} label="Today" value={todayCount} tone="blue" />
        <MetricCard icon={Layers3} label="Active Channels" value={activeChannels} tone="violet" />
        <MetricCard icon={ShoppingCart} label="Orders Captured" value={orderCount} tone="amber" />
      </div>

      <form onSubmit={onSearch} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.35fr)_minmax(180px,.7fr)_minmax(180px,.7fr)_minmax(300px,1fr)]">
          <label className="relative block"><span className="sr-only">Search conversations</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search customer, phone or session" /></label>
          <label className="relative block"><Layers3 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} /><select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"><option value="">All Channels</option>{Object.entries(CHANNELS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /></label>
          <label className="relative block"><Languages className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} /><select value={language} onChange={(event) => setLanguage(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"><option value="">All Languages</option>{Object.entries(LANGUAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /></label>
          <div className="flex h-11 items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50/40 px-2 focus-within:ring-4 focus-within:ring-emerald-100"><CalendarDays className="shrink-0 text-emerald-700" size={17} /><input aria-label="Start date" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setDatePreset("custom"); }} className="min-w-0 flex-1 border-0 bg-transparent px-1 text-xs font-semibold text-slate-700 outline-none" /><span className="text-xs text-slate-400">to</span><input aria-label="End date" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setDatePreset("custom"); }} className="min-w-0 flex-1 border-0 bg-transparent px-1 text-xs font-semibold text-slate-700 outline-none" /></div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[{ id: "today", label: "Today" }, { id: "7", label: "7 Days" }, { id: "30", label: "30 Days" }, { id: "custom", label: "Custom" }].map((item) => <button key={item.id} type="button" onClick={() => chooseDatePreset(item.id)} className={classNames("rounded-full border px-4 py-1.5 text-sm font-semibold transition", datePreset === item.id ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700")}>{item.label}</button>)}
            <span className="ml-1 text-xs font-medium text-slate-400">{filteredConversations.length} matching</span>
          </div>
          <div className="flex items-center gap-2"><button type="button" onClick={resetFilters} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"><RotateCcw size={15} /> Reset</button><button type="submit" disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50">{loading ? <RefreshCcw className="animate-spin" size={16} /> : <Search size={16} />} Search</button></div>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="grid min-h-[560px] lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4"><div className="flex items-center gap-2"><History size={20} className="text-emerald-700" /><h2 className="font-bold text-slate-950">Conversations</h2><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{filteredConversations.length}</span></div><button type="button" onClick={onRefresh} className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700" title="Refresh conversations"><RefreshCcw className={loading ? "animate-spin" : ""} size={17} /></button></div>
            <div className="max-h-[560px] flex-1 overflow-y-auto p-2">
              {!filteredConversations.length ? <div className="flex h-48 flex-col items-center justify-center px-6 text-center"><MessageCircle className="text-slate-300" size={34} /><p className="mt-3 text-sm font-semibold text-slate-700">No matching conversations</p><p className="mt-1 text-xs text-slate-500">Try changing the search or date filters.</p></div> : filteredConversations.map((conversation) => {
                const isSelected = selectedConversation?.sessionId === conversation.sessionId;
                return <button type="button" key={conversation._id} onClick={() => onOpenConversation(conversation.sessionId)} className={classNames("mb-1 w-full rounded-xl border-l-4 px-3 py-3 text-left transition", isSelected ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-transparent hover:bg-slate-50")}><div className="flex gap-3"><span className={classNames("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", isSelected ? "bg-white text-emerald-700" : "bg-slate-100 text-slate-500")}><CircleUserRound size={20} /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="truncate text-sm font-bold text-slate-900">{conversationName(conversation)}</span><span className="shrink-0 text-[11px] font-medium text-slate-500">{formatDate(conversation.updatedAt).split(",").slice(0, 2).join(",")}</span></span><span className="mt-0.5 block text-xs"><ChannelMark channel={conversation.channel} compact /></span><span className="mt-1 block truncate text-xs text-slate-500">{conversation.lastMessage || shortSession(conversation.sessionId, 42)}</span></span></div></button>;
              })}
            </div>
          </aside>

          <div className="flex min-w-0 flex-col bg-gradient-to-br from-white via-white to-emerald-50/40">
            {!selectedConversation ? <div className="flex min-h-[560px] flex-1 flex-col items-center justify-center p-8 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><MessagesSquare size={30} /></span><h3 className="mt-4 text-lg font-bold text-slate-900">Select a conversation</h3><p className="mt-1 max-w-sm text-sm text-slate-500">Choose a customer conversation to review its complete message history and channel details.</p></div> : <>
              <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CircleUserRound size={23} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-slate-950">{conversationName(selectedConversation)}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs"><ChannelMark channel={selectedConversation.channel} compact /></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{selectedLanguage}</span></div><p className="mt-1 truncate text-xs text-slate-500">Session: {shortSession(selectedConversation.sessionId, 55)}</p></div></div><div className="flex items-center gap-1 text-slate-500"><button type="button" className="rounded-lg p-2 hover:bg-slate-100" title="Conversation information"><Info size={18} /></button><button type="button" className="rounded-lg p-2 hover:bg-slate-100" title="More options"><MoreVertical size={18} /></button></div></div>
                <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4"><span className="flex items-center gap-2"><SelectedChannelIcon size={14} /> Channel: <strong className="text-slate-800">{selectedMeta.label}</strong></span><span className="flex items-center gap-2"><Languages size={14} /> Language: <strong className="text-slate-800">{selectedLanguage}</strong></span><span className="flex items-center gap-2"><CalendarDays size={14} /> Started: <strong className="text-slate-800">{dayLabel(selectedConversation.createdAt)}</strong></span><span className="flex items-center gap-2"><MessageCircle size={14} /> Messages: <strong className="text-slate-800">{selectedConversation.messages?.length || 0}</strong></span></div>
              </header>
              <div className="max-h-[465px] flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="mb-5 flex items-center gap-3 text-xs font-semibold text-slate-500"><span className="h-px flex-1 bg-slate-200" /><span className="rounded-full bg-slate-100 px-3 py-1">{dayLabel(selectedConversation.createdAt)}</span><span className="h-px flex-1 bg-slate-200" /></div>
                <div className="space-y-4">{selectedConversation.messages?.map((message, index) => {
                  const isUser = message.role === "user";
                  return <div key={`${message.role}-${index}`} className={classNames("flex gap-2", isUser ? "justify-end" : "justify-start")}>{!isUser && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Sparkles size={15} /></span>}<div className={classNames("max-w-[82%]", isUser && "text-right")}><div className={classNames("inline-block rounded-2xl px-4 py-3 text-left text-sm leading-6 shadow-sm", isUser ? "rounded-br-md bg-emerald-700 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800")}><p className="whitespace-pre-wrap">{message.content}</p>{message.media?.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{message.media.map((media, mediaIndex) => <img key={`${media.url}-${mediaIndex}`} src={media.url} alt={media.altText || "Conversation attachment"} className="max-h-48 w-full rounded-xl object-cover" />)}</div>}{message.sources?.length > 0 && <div className={classNames("mt-3 space-y-2 border-t pt-3", isUser ? "border-white/20" : "border-slate-200")}>{message.sources.map((source, sourceIndex) => <div key={sourceIndex} className={classNames("rounded-lg p-2 text-xs", isUser ? "bg-white/10" : "bg-slate-50")}><p className="font-semibold">{source.documentName}{source.pageNumber ? ` (page ${source.pageNumber})` : ""}</p>{source.content && <p className="mt-1 line-clamp-3 opacity-80">{source.content}</p>}</div>)}</div>}</div><div className={classNames("mt-1 flex items-center gap-1 text-[11px] text-slate-400", isUser && "justify-end")}>{messageTime(selectedConversation)}{isUser && <CheckCheck className="text-sky-500" size={14} />}</div></div></div>;
                })}</div>
              </div>
              <footer className="border-t border-slate-200 bg-white p-3"><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400"><input disabled value="" placeholder="Conversation history is read-only" className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm outline-none disabled:cursor-not-allowed" /><button type="button" disabled className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white opacity-45"><Send size={16} /></button></div></footer>
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}
