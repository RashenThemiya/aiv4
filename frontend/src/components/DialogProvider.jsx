import { AlertTriangle, HelpCircle, MessageSquareText, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { classNames } from "../utils/classNames";

const DialogContext = createContext(null);

function DialogSurface({ dialog, close }) {
  const [value, setValue] = useState(dialog.defaultValue || "");
  const inputRef = useRef(null);
  const isPrompt = dialog.kind === "prompt";
  const isDanger = dialog.tone === "danger";
  const Icon = isDanger ? AlertTriangle : isPrompt ? MessageSquareText : HelpCircle;
  const invalid = isPrompt && dialog.required && !value.trim();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") close(isPrompt ? null : false);
    };
    document.addEventListener("keydown", onKeyDown);
    inputRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, isPrompt]);

  function submit(event) {
    event.preventDefault();
    if (invalid) return;
    close(isPrompt ? value.trim() : true);
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) close(isPrompt ? null : false); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pentarix-dialog-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/90 to-white px-6 py-5 dark:border-slate-700 dark:from-emerald-950/50 dark:to-slate-900">
          <span className={classNames("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", isDanger ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700")}><Icon size={22}/></span>
          <div className="min-w-0 flex-1"><h2 id="pentarix-dialog-title" className="text-lg font-black text-slate-950">{dialog.title}</h2>{dialog.message && <p className="mt-1.5 text-sm leading-6 text-slate-600">{dialog.message}</p>}</div>
          <button type="button" onClick={() => close(isPrompt ? null : false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Close dialog"><X size={18}/></button>
        </div>
        <div className="px-6 py-5">
          {isPrompt && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">{dialog.inputLabel || "Details"}{dialog.required ? " *" : ""}</span><textarea ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} rows="4" maxLength={dialog.maxLength || 1000} placeholder={dialog.placeholder || "Enter details"} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"/>{invalid && <span className="mt-2 block text-xs font-semibold text-rose-600">This field is required.</span>}</label>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => close(isPrompt ? null : false)} className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">{dialog.cancelLabel || "Cancel"}</button><button type="submit" disabled={invalid} className={classNames("h-10 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45", isDanger ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-700 hover:bg-emerald-800")}>{dialog.confirmLabel || (isPrompt ? "Continue" : "Confirm")}</button></div>
        </div>
      </form>
    </div>
  );
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const pendingRef = useRef(null);

  const open = useCallback((options) => new Promise((resolve) => {
    if (pendingRef.current) pendingRef.current.resolve(pendingRef.current.cancelValue);
    pendingRef.current = { resolve, cancelValue: options.kind === "prompt" ? null : false };
    setDialog({ ...options, resolve });
  }), []);

  const close = useCallback((result) => {
    pendingRef.current?.resolve(result);
    pendingRef.current = null;
    setDialog(null);
  }, []);

  const value = useMemo(() => ({
    confirm: (options = {}) => open({ kind: "confirm", title: "Confirm action", ...options }),
    prompt: (options = {}) => open({ kind: "prompt", title: "Add details", ...options }),
  }), [open]);

  return <DialogContext.Provider value={value}>{children}{dialog && typeof document !== "undefined" && createPortal(<DialogSurface dialog={dialog} close={close}/>, document.body)}</DialogContext.Provider>;
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialog must be used inside DialogProvider");
  return context;
}
