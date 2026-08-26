import React from "react";
import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div className="text-left">
              <div className="font-heading font-bold leading-none text-foreground">RecoverAI</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Adaptive Revenue Recovery Intelligence</div>
            </div>
          </div>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary shadow-lg shadow-primary/20 mb-4">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-lg shadow-2xl shadow-black/20 border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
