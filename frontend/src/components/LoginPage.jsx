import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { ThemeSelector } from "./ThemeSelector";
import { ToastBridge } from "./ToastProvider";

function PentarixMark({ className = "" }) {
  return (
    <svg viewBox="79 40 129 112" className={className} aria-hidden="true" focusable="false">
      <path d="M144 40 172 89H160L144 134 127 89H115L144 40Z" fill="currentColor" />
      <path d="M111 96 136 152H79L111 96Z" fill="currentColor" />
      <path d="M176 96 208 152H151L176 96Z" fill="currentColor" />
    </svg>
  );
}

function AssistantIllustration() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-[10%] rounded-[45%] bg-emerald-200/40 blur-xl" />
      <img src="/assets/pentarix-support-robot.png" alt="Pentarix AI assistant supporting WhatsApp and Messenger conversations" className="relative h-full w-full object-contain drop-shadow-[0_24px_25px_rgba(5,150,105,0.12)]" />
    </div>
  );
}

export function LoginPage({ loginForm, setLoginForm, loading, error, handleLogin, themeMode, setThemeMode }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-[#f7fbf9] text-slate-950 dark:bg-[#071512] lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <div className="pointer-events-none absolute -left-[18%] -top-[30%] h-[70%] w-[85%] rotate-[-8deg] rounded-[50%] bg-white/80 dark:bg-slate-900/55" />
      <div className="pointer-events-none absolute right-[-18%] top-[-18%] h-[70%] w-[70%] rounded-[50%] bg-emerald-100/55 blur-2xl dark:bg-emerald-950/40" />
      <div className="pointer-events-none absolute -bottom-[32%] -left-[12%] h-[58%] w-[78%] rotate-[7deg] rounded-[50%] bg-gradient-to-r from-emerald-800 via-emerald-500 to-emerald-200 opacity-95 dark:from-emerald-950 dark:via-emerald-800 dark:to-emerald-600" />
      <div className="pointer-events-none absolute -bottom-[37%] right-[-18%] h-[57%] w-[90%] rotate-[-7deg] rounded-[50%] bg-emerald-100/80 dark:bg-emerald-900/35" />
      <div className="pointer-events-none absolute left-[56%] top-[8%] hidden grid-cols-6 gap-3 opacity-60 xl:grid">
        {Array.from({ length: 24 }, (_, index) => <span key={index} className="h-2 w-2 rounded-full bg-emerald-300" />)}
      </div>

      <div className="absolute right-6 top-6 z-30 sm:right-10 sm:top-10 lg:right-14 lg:top-12">
        <ThemeSelector value={themeMode} onChange={setThemeMode} compact />
      </div>

      <div className="relative z-10 mx-auto min-h-screen max-w-[1720px] lg:h-full lg:min-h-0">
        <section className="relative px-6 pb-6 pt-28 sm:px-12 md:min-h-[760px] lg:absolute lg:inset-y-0 lg:left-0 lg:min-h-0 lg:w-[64%] lg:px-0 lg:py-0">
          <div className="max-w-3xl lg:absolute lg:left-[6.3%] lg:top-[22.5%] lg:w-[56%]">
            <h1 className="text-4xl font-black leading-[1.08] tracking-[-0.04em] text-slate-950 dark:text-white sm:text-5xl xl:text-[3.75rem]">
              Turn every customer<br className="hidden sm:block" /> conversation into an<br className="hidden sm:block" /> <span className="relative inline-block text-emerald-600 dark:text-emerald-400">opportunity.<span className="absolute -bottom-3 left-3 h-1 w-[94%] -rotate-2 rounded-full bg-gradient-to-r from-emerald-200 via-emerald-600 to-emerald-400" /></span>
            </h1>
            <p className="mt-14 max-w-[590px] text-base font-medium leading-8 text-slate-600 dark:text-slate-300 sm:text-lg xl:mt-16">
              Use your PDF knowledge, automate multilingual support, and fulfil orders from web, WhatsApp, and Messenger — all from one calm, focused workspace.
            </p>
          </div>
          <div className="mx-auto mt-8 hidden h-[390px] w-full max-w-[520px] md:block lg:absolute lg:left-[53%] lg:top-[24%] lg:mt-0 lg:h-[49%] lg:w-[48%] lg:max-w-none"><AssistantIllustration /></div>
        </section>

        <section className="flex items-center justify-center px-5 pb-16 pt-6 sm:px-10 lg:absolute lg:right-[2.3%] lg:top-1/2 lg:w-[35%] lg:-translate-y-1/2 lg:px-0 lg:py-0">
          <div className="flex w-full max-w-[585px] flex-col rounded-[2rem] border border-white/90 bg-white/90 p-6 shadow-2xl shadow-emerald-950/10 backdrop-blur-2xl dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-10 lg:max-h-[calc(100vh-96px)] lg:min-h-[min(690px,calc(100vh-96px))] lg:overflow-y-auto xl:px-11 xl:py-10">
            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-emerald-100 bg-emerald-50/90 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/50">
                <PentarixMark className="h-16 w-16 text-orange-500" />
              </div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300 sm:text-base">Sign in to manage your store conversations and orders.</p>
            </div>

            <ToastBridge error={error} />

            <form className="mt-9 space-y-5" onSubmit={handleLogin}>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100"><Mail size={17} /> Email address</span>
                <input className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-600 dark:bg-slate-950 dark:text-white" type="email" value={loginForm.email} onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))} placeholder="you@company.com" autoComplete="email" required />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100"><LockKeyhole size={17} /> Password</span>
                <span className="relative block">
                  <input className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-600 dark:bg-slate-950 dark:text-white" type={showPassword ? "text" : "password"} value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} placeholder="Enter your password" autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                </span>
              </label>

              <button type="submit" disabled={loading.auth} className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-5 text-sm font-black text-white shadow-lg shadow-emerald-700/15 transition hover:-translate-y-0.5 hover:from-emerald-800 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60">
                {loading.auth ? <><Loader2 className="animate-spin" size={18} /> Signing in…</> : <>Sign in to workspace <ArrowRight size={19} /></>}
              </button>
            </form>

            <div className="mt-8 flex items-center gap-4 pt-1 text-xs font-semibold text-slate-400 lg:mt-auto lg:pt-8"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /><span className="inline-flex items-center gap-2 whitespace-nowrap"><ShieldCheck size={17} /> Protected administrative access</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
          </div>
        </section>
      </div>
    </main>
  );
}
