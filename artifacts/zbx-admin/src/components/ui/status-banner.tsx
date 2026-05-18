import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type StatusType = "success" | "warning" | "error" | "info";

interface StatusBannerProps {
  type: StatusType;
  title: string;
  message?: string;
  dismissible?: boolean;
  className?: string;
}

const config: Record<StatusType, { icon: React.ComponentType<{className?: string}>; classes: string }> = {
  success: { icon: CheckCircle2, classes: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  warning: { icon: AlertTriangle, classes: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
  error:   { icon: XCircle,      classes: "bg-red-500/10 border-red-500/30 text-red-400" },
  info:    { icon: Info,         classes: "bg-primary/10 border-primary/30 text-primary" },
};

export function StatusBanner({ type, title, message, dismissible = true, className }: StatusBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const { icon: Icon, classes } = config[type];
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 rounded-lg border text-sm", classes, className)}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        {message && <p className="text-xs opacity-80 mt-0.5">{message}</p>}
      </div>
      {dismissible && (
        <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
