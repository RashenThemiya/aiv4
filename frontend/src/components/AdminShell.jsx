import {
  Activity,
  ArrowRight,
  Building2,
  ChevronLeft,
  Headphones,
  LogOut,
} from "lucide-react";
import { classNames } from "../utils/classNames";
import { ThemeSelector } from "./ThemeSelector";

const sectionDescriptions = {
  dashboard: "Your business activity and sales channels at a glance.",
  companies: "Manage seller workspaces and access.",
  orders: "Review incoming orders and move them through fulfilment.",
  products: "Manage products, pricing, stock and variants.",
  whatsapp: "Connect and manage the seller's WhatsApp Business account.",
  messenger: "Connect a Facebook Page for automated conversations and orders.",
  sms: "Manage Twilio messaging for customer support.",
  documents: "Maintain the trusted knowledge used for support answers.",
  chat: "Test knowledge answers before customers see them.",
  history: "Review conversations across every connected channel.",
  credits: "View the prepaid AI balance, purchases and usage deductions.",
  settings: "Configure the company profile and parcel sender details.",
  help: "Connect, customize, install and test the website chatbot.",
  admins: "Manage administrative access across seller workspaces.",
  backups: "Protect and restore business data.",
  billing: "Manage AI pricing plans, payment approvals and credit allocations.",
  analytics: "Monitor platform growth, commerce performance and global AI usage.",
  support: "Submit, assign and resolve company support requests.",
};

const groupForSection = {
  dashboard: "Overview",
  orders: "Commerce",
  products: "Workspace",
  whatsapp: "Channels",
  messenger: "Channels",
  sms: "Channels",
  documents: "Knowledge & tools",
  chat: "Knowledge & tools",
  history: "Knowledge & tools",
  credits: "Workspace",
  help: "Channels",
  settings: "Workspace",
  companies: "Management",
  admins: "Management",
  backups: "Management",
  billing: "Management",
  analytics: "Management",
  support: "Management",
};

function PentarixMark({ className = "" }) {
  return (
    <svg
      viewBox="79 40 129 112"
      className={`text-emerald-600 dark:text-emerald-400 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M144 40 172 89H160L144 134 127 89H115L144 40Z" fill="currentColor" />
      <path d="M111 96 136 152H79L111 96Z" fill="currentColor" />
      <path d="M176 96 208 152H151L176 96Z" fill="currentColor" />
    </svg>
  );
}

function NavButton({ item, active, onClick, compact = false }) {
  const Icon = item.icon;
  const label = item.id === "dashboard" ? "Overview" : item.label;
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        compact
          ? "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
          : "group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[15px] font-semibold transition",
        active
          ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-800/15"
          : "text-[#123b3d] hover:bg-emerald-100/70 hover:text-emerald-900 dark:text-emerald-100/75 dark:hover:bg-white/[0.07] dark:hover:text-white"
      )}
    >
      <Icon
        size={compact ? 16 : 20}
        strokeWidth={active ? 2.35 : 2}
        className={classNames(active ? "text-white" : "text-emerald-700/65 dark:text-emerald-300/65")}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function AdminShell({
  children,
  currentUser,
  activeNavItems,
  activeSection,
  setActiveSection,
  isSuperAdmin,
  selectedCompany,
  backToSuperAdmin,
  handleLogout,
  themeMode,
  setThemeMode,
}) {
  const initials = (currentUser?.name || currentUser?.email || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const pageTitle = activeNavItems.find((item) => item.id === activeSection)?.label
    || (selectedCompany ? "Overview" : "Dashboard");
  const groupedItems = activeNavItems.reduce((groups, item) => {
    const group = item.id === "support" && !isSuperAdmin
      ? "Workspace"
      : groupForSection[item.id] || "Workspace";
    const existing = groups.find((entry) => entry.label === group);
    if (existing) existing.items.push(item);
    else groups.push({ label: group, items: [item] });
    return groups;
  }, []);

  return (
    <div className="admin-shell min-h-screen bg-[#f4f7f6] text-slate-950">
      <div className="min-h-screen lg:grid lg:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="admin-sidebar relative min-h-0 overflow-hidden border-b border-slate-200/80 bg-[#fbfcfc] text-[#103b3d] lg:sticky lg:top-0 lg:h-screen lg:min-h-screen lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#071b19] dark:text-white">
          <div className="admin-sidebar-wave pointer-events-none absolute inset-x-0 bottom-0 hidden h-40 lg:block" aria-hidden="true" />
          <div className="relative z-10 flex flex-col lg:h-full lg:px-5 lg:py-5">
            <div className="flex items-center justify-between px-4 py-4 lg:px-2 lg:pb-4 lg:pt-1">
              <div className="flex items-center gap-3">
                <PentarixMark className="h-11 w-11 shrink-0 lg:h-14 lg:w-14" />
                <div className="min-w-0">
                  <div className="text-xl font-extrabold tracking-tight text-[#082f33] dark:text-white lg:text-2xl">Pentarix</div>
                  <div className="truncate text-sm font-medium text-emerald-800/70 dark:text-emerald-200/60 lg:text-base">AI Assistant</div>
                </div>
              </div>
              <button type="button" onClick={handleLogout} className="rounded-lg p-2 text-emerald-800/60 hover:bg-emerald-100 hover:text-emerald-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white lg:hidden" aria-label="Log out">
                <LogOut size={18} />
              </button>
            </div>

            <div className="border-t border-emerald-100 px-3 py-3 dark:border-white/[0.06] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:border-0 lg:px-0 lg:py-0 lg:pr-1 sidebar-scroll">
              <nav className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
                {activeNavItems.map((item) => (
                  <NavButton key={item.id} item={item} compact active={activeSection === item.id} onClick={() => setActiveSection(item.id)} />
                ))}
              </nav>

              <div className="hidden lg:block">
                {isSuperAdmin && selectedCompany && (
                  <button
                    type="button"
                    onClick={backToSuperAdmin}
                    className="mb-6 flex w-full items-center gap-3 rounded-xl border border-emerald-300 bg-white/40 px-4 py-3 text-left text-sm font-semibold text-[#123b3d] transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-600/40 dark:bg-white/[0.04] dark:text-emerald-50 dark:hover:bg-white/10"
                  >
                    <ChevronLeft size={18} />
                    Back to all businesses
                  </button>
                )}
                <div className="space-y-6">
                  {groupedItems.map((group) => (
                    <div key={group.label}>
                      <div className="mb-2 px-3.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-900/65 dark:text-emerald-200/45">{group.label}</div>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <NavButton key={item.id} item={item} active={activeSection === item.id} onClick={() => setActiveSection(item.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto hidden shrink-0 space-y-4 pb-1 pt-5 lg:block">
              <button
                type="button"
                onClick={() => {
                  if (activeNavItems.some((item) => item.id === "support")) {
                    setActiveSection("support");
                  } else {
                    window.location.href = "mailto:support@pentarixlabs.com";
                  }
                }}
                className="flex items-center gap-3 rounded-2xl border border-emerald-300/90 bg-white/45 px-3.5 py-3 text-[#103b3d] transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-600/40 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Headphones size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">Need help?</span>
                  <span className="block truncate text-xs text-emerald-800/65 dark:text-emerald-100/55">Contact Pentarix support</span>
                </span>
                <ArrowRight size={20} />
              </button>

              <div className="flex items-center gap-3 border-t border-emerald-900/10 px-1 pt-4 dark:border-white/[0.08]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100/90 text-sm font-bold text-emerald-950 shadow-sm dark:bg-emerald-400/15 dark:text-emerald-100">{initials}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-[#123b3d] dark:text-white">{currentUser.name}</div><div className="truncate text-xs capitalize text-emerald-800/60 dark:text-emerald-100/45">{currentUser.role.replaceAll("_", " ")}</div></div>
                <button type="button" onClick={handleLogout} className="rounded-xl border border-emerald-900/10 p-2.5 text-emerald-800/60 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 dark:border-white/10 dark:text-emerald-100/50 dark:hover:bg-white/10 dark:hover:text-white" title="Log out"><LogOut size={18} /></button>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="admin-header sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
            <div className="flex min-h-[82px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  {selectedCompany ? <Building2 size={13} /> : <Activity size={13} />}
                  <span className="truncate">{selectedCompany ? selectedCompany.name : "Platform administration"}</span>
                </div>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{pageTitle}</h1>
                <p className="mt-0.5 hidden truncate text-sm text-slate-500 sm:block">{sectionDescriptions[activeSection] || "Manage your Pentarix AI workspace."}</p>
              </div>
              <ThemeSelector value={themeMode} onChange={setThemeMode} compact />
            </div>
          </header>

          <main className="mx-auto max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
