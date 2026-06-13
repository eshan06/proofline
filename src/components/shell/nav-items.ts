import {
  BarChart3,
  BookOpen,
  Home,
  Inbox,
  LayoutGrid,
  List,
  Settings,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Inbox shows the open-conversation count. */
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "6" },
  { href: "/tickets", label: "Tickets", icon: List },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/kb", label: "Knowledge Base", icon: BookOpen },
  { href: "/copilot", label: "AI Copilot", icon: Sparkles },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const PAGE_TITLES: Record<string, string> = {
  home: "Home",
  inbox: "Inbox",
  tickets: "Tickets",
  customers: "Customers",
  kb: "Knowledge Base",
  copilot: "AI Copilot",
  automations: "Automations",
  analytics: "Analytics",
  integrations: "Integrations",
  settings: "Settings",
};
