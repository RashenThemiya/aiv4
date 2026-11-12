import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  RefreshCcw,
  Search,
  UsersRound,
} from "lucide-react";
import { formatDate } from "../lib/api";
import { PrimaryButton, SecondaryButton, StatusBadge } from "./ui";

const number = (value) => new Intl.NumberFormat().format(Number(value || 0));

export function BusinessesPanel({ companies, loading, onRefresh, onAdd, onOpen }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return companies.filter((company) => {
      const matchesStatus = status === "all" || (status === "active" ? company.isActive : !company.isActive);
      const haystack = `${company.name || ""} ${company.slug || ""} ${company.description || ""}`.toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [companies, search, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleCompanies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  function applySearch(event) {
    event.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setPage(1);
  }

  const first = filtered.length ? ((page - 1) * pageSize) + 1 : 0;
  const last = filtered.length ? Math.min(page * pageSize, filtered.length) : 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/60 p-6 shadow-sm lg:p-7">
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-200/35" />
        <span className="pointer-events-none absolute -bottom-20 right-24 h-36 w-1/2 rounded-[50%] bg-emerald-100/70 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white/85 text-emerald-700 shadow-sm">
              <Building2 size={31} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Platform administration</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Seller Businesses</h2>
              <p className="mt-1 text-sm text-slate-600">Create, find and open every seller workspace from one place.</p>
            </div>
          </div>
          <PrimaryButton className="h-11 rounded-xl px-5" onClick={onAdd}>
            <Plus size={17} /> Add business
          </PrimaryButton>
        </div>
      </section>

      <form className="grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm lg:grid-cols-[minmax(260px,1fr)_220px_auto_auto] lg:items-end" onSubmit={applySearch}>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Search businesses</span>
          <span className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Company name, slug or description"
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Status</span>
          <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">All businesses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <PrimaryButton type="submit" className="h-11 rounded-xl px-6"><Search size={17} /> Search</PrimaryButton>
        <SecondaryButton type="button" className="h-11 rounded-xl px-5" onClick={resetFilters}>Reset</SecondaryButton>
      </form>

      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><UsersRound size={20} /></span>
            <div>
              <h3 className="font-bold text-slate-950">Seller businesses</h3>
              <p className="mt-0.5 text-xs text-slate-500">{number(filtered.length)} workspaces match the current view</p>
            </div>
          </div>
          <SecondaryButton onClick={onRefresh} disabled={loading}>
            <RefreshCcw className={loading ? "animate-spin" : ""} size={16} /> Refresh
          </SecondaryButton>
        </div>

        <div className="max-h-[56vh] overflow-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 z-10 bg-emerald-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Workspace slug</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">AI wallet & usage</th>
                <th className="px-5 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleCompanies.map((company) => (
                <tr key={company._id} className="transition hover:bg-emerald-50/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-black text-emerald-700 ring-1 ring-emerald-100">
                        {String(company.name || "B").trim().slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900">{company.name}</div>
                        <div className="max-w-[310px] truncate text-xs text-slate-500">{company.description || "No description"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">{company.slug}</span></td>
                  <td className="px-5 py-4"><StatusBadge status={company.isActive ? "active" : "inactive"} /></td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-800">{number(company.tokenUsage?.wallet?.availableCredits)} credits</div>
                    <div className="mt-1 text-xs text-slate-500">{number(company.tokenUsage?.totalTokens)} tokens used this month</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(company.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <SecondaryButton className="ml-auto" onClick={() => onOpen(company._id)}>Open workspace <ExternalLink size={15} /></SecondaryButton>
                  </td>
                </tr>
              ))}
              {!visibleCompanies.length && !loading && (
                <tr><td colSpan="6" className="px-5 py-16 text-center"><Building2 className="mx-auto text-slate-300" size={38} /><p className="mt-3 font-bold text-slate-800">No businesses found</p><p className="mt-1 text-sm text-slate-500">Try a different search term or status.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span>Showing <strong className="text-slate-900">{first}-{last}</strong> of <strong className="text-slate-900">{filtered.length}</strong></span>
            <label className="flex items-center gap-2"><span>Rows per page</span><select className="h-9 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="20">20</option><option value="50">50</option></select></label>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /> Previous</button>
            <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-emerald-600 px-3 font-bold text-white">{page}</span>
            <span className="text-slate-400">of {pages}</span>
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next <ChevronRight size={16} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
