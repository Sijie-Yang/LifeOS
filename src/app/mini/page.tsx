import type { Metadata } from "next";
import { MiniPanel } from "@/components/focus/MiniPanel";

export const metadata: Metadata = {
  title: "LifeOS 迷你窗",
};

// Compact always-on-top view for the macOS shell; RootShell skips nav chrome here.
export default function MiniPage() {
  return <MiniPanel />;
}
