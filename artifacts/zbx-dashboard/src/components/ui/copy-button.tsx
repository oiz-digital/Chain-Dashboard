import React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  value: string;
  className?: string;
  iconOnly?: boolean;
}

export function CopyButton({ value, className, iconOnly = false }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (iconOnly) {
    return (
      <button
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-muted text-muted-foreground hover:text-foreground",
          className
        )}
        title="Copy to clipboard"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-8 px-2 text-xs font-mono", className)}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5 mr-1 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
