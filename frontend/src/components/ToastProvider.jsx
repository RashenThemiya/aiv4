import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { classNames } from "../utils/classNames";

const ToastContext = createContext(null);

const toastStyles = {
  error: {
    icon: AlertCircle,
    title: "Action needed",
    shell: "border-rose-200 bg-white text-slate-900 dark:border-rose-800 dark:bg-slate-900 dark:text-slate-100",
    iconBox: "bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-300",
    progress: "bg-rose-500",
  },
  success: {
    icon: CheckCircle2,
    title: "Success",
    shell: "border-emerald-200 bg-white text-slate-900 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-100",
    iconBox: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
    progress: "bg-emerald-500",
  },
  info: {
    icon: Info,
    title: "Information",
    shell: "border-sky-200 bg-white text-slate-900 dark:border-sky-800 dark:bg-slate-900 dark:text-slate-100",
    iconBox: "bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
    progress: "bg-sky-500",
  },
};

function ToastItem({ toast, dismiss }) {
  const style = toastStyles[toast.type] || toastStyles.info;
  const Icon = style.icon;

  useEffect(() => {
    const timeout = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timeout);
  }, [dismiss, toast.duration, toast.id]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className={classNames(
        "relative w-full overflow-hidden rounded-2xl border p-4 pr-12 shadow-xl shadow-slate-950/10 backdrop-blur-sm",
        "animate-[toast-in_180ms_ease-out]",
        style.shell
      )}
    >
      <div className="flex items-start gap-3">
        <span className={classNames("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.iconBox)}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-bold">{style.title}</div>
          <div className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{toast.message}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label="Close notification"
      >
        <X size={17} />
      </button>
      <span className={classNames("absolute inset-x-0 bottom-0 h-0.5 opacity-80", style.progress)} />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({ message, type = "info", duration } = {}) => {
    const normalizedMessage = String(message || "").trim();
    if (!normalizedMessage) return;

    setToasts((current) => {
      if (current.some((toast) => toast.type === type && toast.message === normalizedMessage)) {
        return current;
      }

      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const next = {
        id,
        type,
        message: normalizedMessage,
        duration: duration || (type === "error" ? 12000 : 7000),
      };
      return [...current.slice(-3), next];
    });
  }, []);

  const value = useMemo(() => ({ showToast, dismiss }), [dismiss, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" && createPortal(
        <div className="pointer-events-none fixed right-4 top-20 z-[120] flex w-[calc(100vw-2rem)] max-w-md flex-col gap-3 sm:right-6 sm:w-full">
          {toasts.map((toast) => (
            <div className="pointer-events-auto" key={toast.id}>
              <ToastItem toast={toast} dismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function ToastBridge({ error, notice, info }) {
  const { showToast } = useToast();

  useEffect(() => {
    if (error) showToast({ type: "error", message: error });
  }, [error, showToast]);

  useEffect(() => {
    if (notice) showToast({ type: "success", message: notice });
  }, [notice, showToast]);

  useEffect(() => {
    if (info) showToast({ type: "info", message: info });
  }, [info, showToast]);

  return null;
}
