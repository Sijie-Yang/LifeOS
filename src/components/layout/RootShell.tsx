"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { NotificationManager } from "@/components/layout/NotificationManager";
import { UrgeCapture } from "@/components/urge/UrgeCapture";
import { WellnessCheckIn } from "@/components/wellness/WellnessCheckIn";
import { ContactQuickViewProvider } from "@/components/contacts/ContactQuickView";
import { EntityQuickViewProvider } from "@/components/layout/EntityQuickView";

export function RootShell({ children }: { children: React.ReactNode }) {
  // The macOS mini window renders bare; the main window owns the pomodoro timer.
  if (usePathname() === "/mini") return children;

  return (
    <ContactQuickViewProvider>
      <EntityQuickViewProvider>
        <AppShell>
          {children}
          <NotificationManager />
          <UrgeCapture />
          <WellnessCheckIn />
        </AppShell>
      </EntityQuickViewProvider>
    </ContactQuickViewProvider>
  );
}
