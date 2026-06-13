"use client";

import { useParams } from "next/navigation";
import { SettingsView } from "@/components/settings/settings-view";

const VALID = ["team", "workspace", "billing", "audit"] as const;
type Tab = (typeof VALID)[number];

export default function SettingsPage() {
  const params = useParams<{ tab?: string[] }>();
  const raw = params.tab?.[0];
  const tab: Tab = (VALID as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "team";
  return <SettingsView tab={tab} />;
}
