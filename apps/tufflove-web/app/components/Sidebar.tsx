"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  Users,
  Video,
  BookOpen,
  LogOut,
  Target,
  Building2,
  ListChecks,
  Fingerprint,
  ClipboardCheck,
} from "lucide-react";

// This defines the menu items. 'TactiX' is here.
const navItems = [
  { name: "HQ", href: "/dashboard", icon: LayoutDashboard },
  { name: "Territories", href: "/dashboard/companies", icon: Building2 },
  { name: "The Code", href: "/dashboard/the-code", icon: Fingerprint },
  { name: "Intel", href: "/dashboard/intel", icon: ClipboardCheck },
  { name: "SitRep", href: "/dashboard/sitrep", icon: ListChecks },
  { name: "TactiX", href: "/dashboard/tactix", icon: Target },
  { name: "War Chest", href: "/dashboard/deals", icon: DollarSign },
  { name: "Briefings", href: "/dashboard/briefings", icon: Video },
  { name: "Armory", href: "/dashboard/war-chest", icon: BookOpen },
  { name: "The Unit", href: "/dashboard/the-unit", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="bg-command-sidebar text-white border-r border-slate-800" style={{ width: "260px", height: "100vh", display: "flex", flexDirection: "column", padding: "24px" }}>
      {/* 1. RESTORED LOGO (Top Left) */}
      <div className="mb-10 pl-2">
        <Image
          src="/logo.png"
          alt="Business Assistant"
          width={140}
          height={32}
          style={{ height: "32px", width: "auto", objectFit: "contain" }}
          priority
        />
      </div>

      {/* 2. NAVIGATION MENU */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          // Highlight the active tab
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold no-underline transition ${isActive ? "bg-command-active text-white" : "text-slate-300 hover:text-white"}`}
            >
              <item.icon size={18} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* 3. SIGN OUT (Bottom) */}
      <div className="mt-auto pt-5 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-400 cursor-pointer">
          <LogOut size={18} />
          Sign Out
        </div>
      </div>
    </div>
  );
}
