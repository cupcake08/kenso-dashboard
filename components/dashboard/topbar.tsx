"use client";
import { Bell, User, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface TopbarProps {
  collapsed: boolean;
}

export function Topbar({ collapsed }: TopbarProps) {
  const router = useRouter();
  const user = auth.currentUser;

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <header
      className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-6"
      style={{ marginLeft: collapsed ? "4rem" : "14rem", transition: "margin-left 0.3s" }}
    >
      <div className="text-sm text-slate-400">
        Enterprise Dashboard
      </div>

      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-50 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-medium">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-50">{user?.displayName ?? "User"}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-50 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
