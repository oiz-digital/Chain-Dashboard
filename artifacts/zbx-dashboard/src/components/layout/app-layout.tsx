import React from "react";
import { Sidebar } from "./sidebar";
import { useHealthCheck } from "@workspace/api-client-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  // We can call health check to keep it alive or show a global error, but for now just layout.
  useHealthCheck({ query: { refetchInterval: 30000 } });

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans dark">
      <Sidebar />
      <main className="flex-1 overflow-y-auto w-full">
        <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-300">
          {children}
        </div>
      </main>
    </div>
  );
}
