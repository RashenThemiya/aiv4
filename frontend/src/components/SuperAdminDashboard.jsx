import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Plus,
  Search,
  Store,
  Users,
} from "lucide-react";
import { PrimaryButton, SecondaryButton, StatusBadge } from "./ui";

const number = (value) => new Intl.NumberFormat().format(Number(value || 0));

function SummaryCard({ title, value, detail, icon: Icon, tone }) {
  const tones = {
    emerald: "border-emerald-200 from-white via-emerald-50 to-emerald-100/80 text-emerald-700",
    blue: "border-blue-200 from-white via-blue-50 to-blue-100/80 text-blue-700",
    violet: "border-violet-200 from-white via-violet-50 to-violet-100/80 text-violet-700",
    amber: "border-amber-200 from-white via-amber-50 to-orange-100/80 text-amber-700",
  };

  return (
    <article className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}>
      <div className="pointer-events-none absolute -bottom-12 -right-8 h-32 w-32 rounded-full bg-white/45" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-slate-600">{title}</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</div>
          <div className="mt-2 text-xs leading-5 text-slate-500">{detail}</div>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm"><Icon size={23} strokeWidth={2.1} /></span>
      </div>
    </article>
  );
}

export function SuperAdminDashboard({ companies, adminUsers, setActiveSection, openCompanyDashboard }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const activeCompanies = companies.filter((company) => company.isActive).length;
  const availableCredits = companies.reduce((sum, company) => sum + Number(company.tokenUsage?.wallet?.availableCredits || 0), 0);
  const totalTokens = companies.reduce((sum, company) => sum + Number(company.tokenUsage?.totalTokens || 0), 0);
  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return companies;
    return companies.filter((company) => String(company.name || "").toLocaleLowerCase().includes(query));
  }, [companies, search]);
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCompanies = filteredCompanies.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstShown = filteredCompanies.length ? ((currentPage - 1) * pageSize) + 1 : 0;
  const lastShown = Math.min(currentPage * pageSize, filteredCompanies.length);

  return (
    <div className="superadmin-dashboard space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Seller businesses" value={number(companies.length)} detail="All registered company workspaces" icon={Building2} tone="emerald" />
        <SummaryCard title="Active businesses" value={number(activeCompanies)} detail={`${companies.length - activeCompanies} currently inactive`} icon={CheckCircle2} tone="blue" />
        <SummaryCard title="Admin accounts" value={number(adminUsers.length)} detail="Superadmins and company administrators" icon={Users} tone="violet" />
        <SummaryCard title="Available AI credits" value={number(availableCredits)} detail={`${number(totalTokens)} tokens used this month`} icon={Coins} tone="amber" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Store size={20} /></span>
            <div><h3 className="font-bold text-slate-950">Seller businesses</h3><p className="mt-1 text-xs text-slate-500">Search and open a company workspace.</p></div>
          </div>
          <SecondaryButton onClick={() => setActiveSection("companies")}><Plus size={15} /> Manage businesses</SecondaryButton>
        </header>

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by company name..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
          </label>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span><strong className="text-slate-900">{number(filteredCompanies.length)}</strong> result{filteredCompanies.length === 1 ? "" : "s"}</span>
            <label className="flex items-center gap-2"><span className="hidden sm:inline">Per page</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700"><option value="12">12</option><option value="24">24</option><option value="48">48</option></select></label>
          </div>
        </div>

        {visibleCompanies.length ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleCompanies.map((company) => {
              const credits = Number(company.tokenUsage?.wallet?.availableCredits || 0);
              const share = availableCredits ? Math.min(100, (credits / availableCredits) * 100) : 0;
              return (
                <button type="button" key={company._id} onClick={() => openCompanyDashboard(company._id)} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
                  <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-emerald-50 transition group-hover:bg-emerald-100/80" />
                  <div className="relative flex items-start justify-between gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Store size={21} /></span><StatusBadge status={company.isActive ? "active" : "inactive"} /></div>
                  <div className="relative mt-4"><h4 className="truncate text-base font-black text-slate-950">{company.name}</h4><p className="mt-1 truncate text-xs font-semibold text-emerald-700">{company.slug}</p><p className="mt-3 min-h-10 text-sm leading-5 text-slate-500 line-clamp-2">{company.description || "No business description added."}</p></div>
                  <div className="relative mt-4 rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-500">Available credits</span><span className="font-black text-slate-900">{number(credits)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.max(credits ? 3 : 0, share)}%` }} /></div></div>
                  <div className="relative mt-4 flex items-center justify-between text-xs font-bold text-emerald-700"><span>Open workspace</span><ArrowRight size={16} className="transition group-hover:translate-x-1" /></div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-16 text-center"><Building2 className="mx-auto text-slate-300" size={38} /><h4 className="mt-4 font-bold text-slate-900">{companies.length ? "No businesses found" : "No businesses yet"}</h4><p className="mt-2 text-sm text-slate-500">{companies.length ? "Try a different company name." : "Create the first seller workspace to get started."}</p>{!companies.length && <PrimaryButton className="mt-5" onClick={() => setActiveSection("companies")}><Plus size={16} /> Add business</PrimaryButton>}</div>
        )}

        <footer className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-slate-500">Showing <strong className="text-slate-900">{firstShown}-{lastShown}</strong> of <strong className="text-slate-900">{filteredCompanies.length}</strong> businesses</span>
          <div className="flex items-center gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /> Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-emerald-600 px-3 font-bold text-white">{currentPage}</span><span className="text-slate-400">of {totalPages}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={16} /></button></div>
        </footer>
      </section>
    </div>
  );
}
