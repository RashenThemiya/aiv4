import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Headphones,
  Loader2,
  MessageCircleMore,
  Paperclip,
  RefreshCcw,
  Send,
  ShieldCheck,
  TicketCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { api, formatDate } from "../lib/api";
import { classNames } from "../utils/classNames";
import { Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "./ui";
import { ToastBridge } from "./ToastProvider";

const emptyTicket = { subject: "", description: "", category: "technical", priority: "normal", attachments: [] };
const emptyFilters = { search: "", companyId: "", priority: "", status: "", assignedTo: "", dateFrom: "", dateTo: "" };

function duration(milliseconds) {
  const value = Number(milliseconds || 0);
  if (!value) return "Not available";
  const minutes = Math.round(value / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.round(hours / 24)} days`;
}

function statusLabel(value) {
  return { open: "Open", in_progress: "In progress", waiting: "Waiting", resolved: "Resolved", closed: "Closed" }[value] || value;
}

function StatusBadge({ value }) {
  const styles = {
    open: "bg-blue-100 text-blue-700",
    in_progress: "bg-violet-100 text-violet-700",
    waiting: "bg-amber-100 text-amber-700",
    resolved: "bg-emerald-100 text-emerald-700",
    closed: "bg-slate-200 text-slate-700",
  };
  return <span className={classNames("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", styles[value] || styles.open)}>{statusLabel(value)}</span>;
}

function PriorityBadge({ value }) {
  const styles = { low: "bg-slate-100 text-slate-600", normal: "bg-cyan-100 text-cyan-700", high: "bg-orange-100 text-orange-700", urgent: "bg-rose-100 text-rose-700" };
  return <span className={classNames("inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize", styles[value] || styles.normal)}>{value}</span>;
}

function SummaryCard({ title, value, detail, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "border-emerald-100 from-white via-emerald-50 to-emerald-100/70 text-emerald-700",
    blue: "border-blue-100 from-white via-blue-50 to-blue-100/70 text-blue-700",
    violet: "border-violet-100 from-white via-violet-50 to-violet-100/70 text-violet-700",
    amber: "border-amber-100 from-white via-amber-50 to-orange-100/70 text-amber-700",
  };
  return <article className={classNames("relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm", tones[tone])}><div className="absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-white/45"/><div className="relative flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 shadow-sm"><Icon size={21}/></span><div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div><div className="mt-1 text-2xl font-black text-slate-950">{value}</div><div className="mt-2 text-xs text-slate-500">{detail}</div></div></div></article>;
}

function Pagination({ meta, page, setPage, pageSize, setPageSize, busy }) {
  const pages = Math.max(1, meta.pages || 1);
  const first = meta.total ? ((meta.page - 1) * meta.limit) + 1 : 0;
  const last = meta.total ? Math.min(meta.page * meta.limit, meta.total) : 0;
  return <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-3 text-slate-600"><span>Showing <strong className="text-slate-900">{first}-{last}</strong> of <strong className="text-slate-900">{meta.total || 0}</strong></span><label className="flex items-center gap-2"><span>Rows</span><select className="h-9 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="20">20</option><option value="50">50</option></select></label></div><div className="flex items-center gap-2"><button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40" disabled={page <= 1 || busy} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16}/> Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-emerald-600 px-3 font-bold text-white">{page}</span><span className="text-slate-400">of {pages}</span><button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40" disabled={page >= pages || busy} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next <ChevronRight size={16}/></button></div></div>;
}

export function SupportRequestsPanel({ company = null, isSuperAdmin = false }) {
  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [summary, setSummary] = useState({ byStatus: {} });
  const [companies, setCompanies] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [ticketForm, setTicketForm] = useState(emptyTicket);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState({ message: "", isInternal: false, attachments: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadReferenceData = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const [nextCompanies, nextAssignees] = await Promise.all([api.companies.list(), api.support.assignees()]);
      setCompanies(nextCompanies); setAssignees(nextAssignees);
    } catch (err) { setError(err.message); }
  }, [isSuperAdmin]);

  const loadTickets = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = { ...appliedFilters, page, limit: pageSize };
      const [list, nextSummary] = await Promise.all([api.support.tickets(query), api.support.summary(appliedFilters)]);
      setTickets(list.tickets || []);
      setMeta({ page: list.page || 1, limit: list.limit || pageSize, total: list.total || 0, pages: Math.max(1, list.pages || 1) });
      setSummary(nextSummary);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  async function openTicket(id) {
    setBusy(true); setError("");
    try { setSelected(await api.support.ticket(id)); setReply({ message: "", isInternal: false, attachments: [] }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function createTicket(event) {
    const form = event.currentTarget;
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const created = await api.support.createTicket({ ...ticketForm, companyId: company?._id || "" });
      setTicketForm(emptyTicket); form.reset(); setNotice(`Support request ${created.ticketNumber} submitted.`);
      setPage(1); await loadTickets(); setSelected(created);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function sendReply(event) {
    const form = event.currentTarget;
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await api.support.reply(selected._id, reply); setSelected(updated);
      setReply({ message: "", isInternal: false, attachments: [] }); form.reset();
      setNotice(reply.isInternal ? "Internal note added." : "Reply sent."); await loadTickets();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function updateTicket(payload) {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try { const updated = await api.support.update(selected._id, payload); setSelected(updated); setNotice("Support request updated."); await loadTickets(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function openAttachment(attachment) {
    try {
      const blob = await api.support.attachment(selected._id, attachment._id); const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer"); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { setError(err.message); }
  }

  const openCount = Number(summary.byStatus?.open || 0);
  const activeCount = openCount + Number(summary.byStatus?.in_progress || 0) + Number(summary.byStatus?.waiting || 0);
  const statusOptions = ["open", "in_progress", "waiting", "resolved", "closed"];
  const categoryOptions = ["technical", "billing", "integration", "account", "feature", "other"];
  const fileNames = useMemo(() => ticketForm.attachments.map((file) => file.name).join(", "), [ticketForm.attachments]);

  return <div className="support-requests-page space-y-6"><ToastBridge error={error} notice={notice}/>
    <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/60 p-6 shadow-sm"><div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-200/35"/><div className="relative flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-white/80 text-emerald-700 shadow-sm"><Headphones size={32}/></span><div><h2 className="text-2xl font-black tracking-tight text-slate-950">{isSuperAdmin ? "Support Requests" : "Pentarix Support"}</h2><p className="mt-1 text-sm text-slate-600">{isSuperAdmin ? "Manage company issues, assignments, responses and resolution performance." : "Send a request to the Pentarix team and follow every response here."}</p></div></div></section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard title="Active requests" value={activeCount} detail={`${openCount} newly opened`} icon={MessageCircleMore}/><SummaryCard title="Waiting" value={summary.byStatus?.waiting || 0} detail="Waiting for another response" icon={Clock3} tone="amber"/><SummaryCard title="Average response" value={duration(summary.averageFirstResponseMs)} detail="Time to first Pentarix reply" icon={UserRoundCheck} tone="blue"/><SummaryCard title="Average resolution" value={duration(summary.averageResolutionMs)} detail={`${summary.byStatus?.resolved || 0} resolved requests`} icon={TicketCheck} tone="violet"/></section>

    {!isSuperAdmin && <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><form onSubmit={createTicket} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MessageCircleMore size={20}/></span><div><h3 className="font-bold text-slate-950">Contact support</h3><p className="mt-1 text-xs text-slate-500">Describe the issue clearly and attach screenshots if helpful.</p></div></div><div className="mt-5 space-y-4"><Field label="Subject"><TextInput required maxLength="180" value={ticketForm.subject} onChange={(event) => setTicketForm({ ...ticketForm, subject: event.target.value })} placeholder="What do you need help with?"/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Category"><select className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm capitalize" value={ticketForm.category} onChange={(event) => setTicketForm({ ...ticketForm, category: event.target.value })}>{categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field><Field label="Priority"><select className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm capitalize" value={ticketForm.priority} onChange={(event) => setTicketForm({ ...ticketForm, priority: event.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field></div><Field label="Description"><TextArea required maxLength="5000" rows="6" value={ticketForm.description} onChange={(event) => setTicketForm({ ...ticketForm, description: event.target.value })} placeholder="Explain what happened, what you expected, and any error message you saw."/></Field><Field label="Attachments (up to 5 JPG, PNG, WebP, PDF or TXT files)"><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" className="block w-full text-sm text-slate-600" onChange={(event) => setTicketForm({ ...ticketForm, attachments: Array.from(event.target.files || []).slice(0, 5) })}/>{fileNames && <div className="mt-2 text-xs text-slate-500">{fileNames}</div>}</Field><PrimaryButton className="w-full" type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>} Submit support request</PrimaryButton></div></form><div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-6 shadow-sm"><ShieldCheck className="text-emerald-700" size={32}/><h3 className="mt-4 text-xl font-bold text-slate-950">Your requests stay organized</h3><div className="mt-5 space-y-4 text-sm leading-6 text-slate-600"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18}/><span>Replies and attachments remain connected to the original request.</span></div><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18}/><span>You can see assignment, status and resolution progress at any time.</span></div><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18}/><span>Only your company and authorized Pentarix administrators can access these requests.</span></div></div></div></section>}

    <section className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_.75fr_.75fr_.8fr_.8fr_auto_auto] xl:items-end"><Field label="Search"><TextInput value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Ticket number, subject or details"/></Field>{isSuperAdmin && <Field label="Company"><select className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm" value={filters.companyId} onChange={(event) => setFilters({ ...filters, companyId: event.target.value })}><option value="">All companies</option>{companies.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field>}<Field label="Priority"><select className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></Field><Field label="Status"><select className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statusOptions.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></Field>{isSuperAdmin && <Field label="Assigned to"><select className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm" value={filters.assignedTo} onChange={(event) => setFilters({ ...filters, assignedTo: event.target.value })}><option value="">Anyone</option><option value="unassigned">Unassigned</option>{assignees.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field>}<Field label="From"><TextInput type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}/></Field><Field label="To"><TextInput type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}/></Field><PrimaryButton className="h-10" onClick={() => { setPage(1); setAppliedFilters(filters); }}>Apply</PrimaryButton><SecondaryButton className="h-10" onClick={() => { setFilters(emptyFilters); setPage(1); setAppliedFilters(emptyFilters); }}>Reset</SecondaryButton></div>

      <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-950">{isSuperAdmin ? "All support requests" : "My support requests"}</h3><p className="mt-1 text-xs text-slate-500">Select a request to view its complete conversation.</p></div><SecondaryButton onClick={loadTickets}><RefreshCcw className={loading ? "animate-spin" : ""} size={15}/> Refresh</SecondaryButton></div><div className="max-h-[58vh] overflow-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="sticky top-0 z-10 bg-emerald-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Request</th>{isSuperAdmin && <th className="px-5 py-3">Company</th>}<th className="px-5 py-3">Priority</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Assigned</th><th className="px-5 py-3">Activity</th><th className="px-5 py-3">Messages</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{tickets.map((item) => <tr key={item._id} className="hover:bg-emerald-50/35"><td className="px-5 py-3"><div className="font-bold text-slate-900">{item.ticketNumber}</div><div className="mt-1 max-w-72 truncate text-slate-600">{item.subject}</div><div className="mt-1 text-xs capitalize text-slate-400">{item.category}</div></td>{isSuperAdmin && <td className="px-5 py-3"><div className="font-semibold text-slate-800">{item.companyId?.name || "Company"}</div><div className="text-xs text-slate-500">{item.companyId?.slug}</div></td>}<td className="px-5 py-3"><PriorityBadge value={item.priority}/></td><td className="px-5 py-3"><StatusBadge value={item.status}/></td><td className="px-5 py-3 text-slate-600">{item.assignedTo?.name || "Unassigned"}</td><td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(item.lastActivityAt)}</td><td className="px-5 py-3 text-slate-600">{item.messageCount}{item.attachmentCount ? <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-400"><Paperclip size={12}/>{item.attachmentCount}</span> : null}</td><td className="px-5 py-3 text-right"><SecondaryButton onClick={() => openTicket(item._id)}>Open</SecondaryButton></td></tr>)}{!tickets.length && !loading && <tr><td colSpan={isSuperAdmin ? 8 : 7} className="px-5 py-12 text-center text-slate-400">No support requests match these filters.</td></tr>}</tbody></table></div><Pagination meta={meta} page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} busy={loading}/></div>
    </section>

    {selected && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 sm:px-6"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-slate-950">{selected.ticketNumber}</h3><PriorityBadge value={selected.priority}/><StatusBadge value={selected.status}/></div><p className="mt-1 text-sm font-semibold text-slate-700">{selected.subject}</p><p className="mt-1 text-xs text-slate-500">{selected.companyId?.name} · Created {formatDate(selected.createdAt)}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900"><X size={19}/></button></header>
      {isSuperAdmin && <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:grid-cols-3 sm:px-6"><Field label="Status"><select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={selected.status} onChange={(event) => updateTicket({ status: event.target.value })}>{statusOptions.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></Field><Field label="Priority"><select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm capitalize" value={selected.priority} onChange={(event) => updateTicket({ priority: event.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field><Field label="Assigned to"><select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={selected.assignedTo?._id || ""} onChange={(event) => updateTicket({ assignedTo: event.target.value })}><option value="">Unassigned</option>{assignees.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field></div>}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_260px]"><div className="flex min-h-0 flex-col"><div className="support-thread min-h-[300px] flex-1 space-y-4 overflow-y-auto bg-[#f8fbfa] p-5 sm:p-6">{(selected.messages || []).map((message) => <article key={message._id} className={classNames("max-w-[86%] rounded-2xl border p-4 shadow-sm", message.isInternal ? "mx-auto border-amber-200 bg-amber-50" : message.authorRole === "superadmin" ? "border-emerald-200 bg-emerald-50" : "ml-auto border-slate-200 bg-white")}><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-bold text-slate-800">{message.authorName}</span><span className="capitalize text-slate-400">{message.authorRole.replaceAll("_", " ")}</span>{message.isInternal && <span className="rounded-full bg-amber-200 px-2 py-0.5 font-bold text-amber-800">Internal note</span>}<span className="ml-auto text-slate-400">{formatDate(message.createdAt)}</span></div>{message.message && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.message}</p>}{message.attachments?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.attachments.map((attachment) => <button type="button" key={attachment._id} onClick={() => openAttachment(attachment)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300"><FileText size={14}/>{attachment.originalName}</button>)}</div>}</article>)}</div><form onSubmit={sendReply} className="border-t border-slate-200 bg-white p-4"><TextArea rows="3" value={reply.message} onChange={(event) => setReply({ ...reply, message: event.target.value })} placeholder={reply.isInternal ? "Write a private note for the Pentarix team..." : "Write a reply..."}/><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600"><Paperclip size={15}/><span>Attach files</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" className="hidden" onChange={(event) => setReply({ ...reply, attachments: Array.from(event.target.files || []).slice(0, 5) })}/></label>{reply.attachments.length > 0 && <span className="text-xs text-slate-400">{reply.attachments.length} selected</span>}{isSuperAdmin && <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700"><input type="checkbox" checked={reply.isInternal} onChange={(event) => setReply({ ...reply, isInternal: event.target.checked })}/> Internal note</label>}</div><PrimaryButton type="submit" disabled={busy || (!reply.message.trim() && !reply.attachments.length)}>{busy ? <Loader2 className="animate-spin" size={15}/> : <Send size={15}/>} {reply.isInternal ? "Add note" : "Send reply"}</PrimaryButton></div></form></div>
        <aside className="border-l border-slate-100 bg-white p-5"><h4 className="font-bold text-slate-950">Request details</h4><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-xs font-bold uppercase text-slate-400">Category</dt><dd className="mt-1 capitalize text-slate-700">{selected.category}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">Assigned</dt><dd className="mt-1 text-slate-700">{selected.assignedTo?.name || "Unassigned"}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">First response</dt><dd className="mt-1 text-slate-700">{selected.firstResponseAt ? duration(new Date(selected.firstResponseAt) - new Date(selected.createdAt)) : "Waiting for response"}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">Resolution time</dt><dd className="mt-1 text-slate-700">{selected.resolvedAt ? duration(new Date(selected.resolvedAt) - new Date(selected.createdAt)) : "Not resolved"}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">Attachments</dt><dd className="mt-1 text-slate-700">{selected.attachmentCount || 0}</dd></div></dl>{selected.priority === "urgent" && <div className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700"><AlertTriangle className="shrink-0" size={17}/> This request is marked urgent.</div>}</aside></div>
    </section></div>}
  </div>;
}
