import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type StatusType = "success" | "failed" | "pending" | "active" | "inactive" | "jailed";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusStyles = (status: StatusType) => {
    switch (status) {
      case "success":
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "failed":
      case "jailed":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "inactive":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={cn("capitalize font-medium tracking-wide", getStatusStyles(status), className)}
    >
      {status}
    </Badge>
  );
}
