"use client";

import { useAuth } from "@/context/auth-context";
import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";

import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <AdminPanelLayout>
        <div className="flex h-[calc(100vh-140px)] items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          </div>
        </div>
      </AdminPanelLayout>
    );
  }

  // If unauthenticated, hide the dashboard content to prevent flash.
  // The redirection itself is handled by the AuthProvider component.
  if (!user) {
    return null;
  }

  return <AdminPanelLayout>{children}</AdminPanelLayout>;
}
