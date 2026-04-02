"use client";

import { useAuth } from "@/context/auth-context";
import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";

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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
