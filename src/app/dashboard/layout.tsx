import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, Search } from "lucide-react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#0A0A0A] overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <div className="hidden sm:flex items-center h-9 px-3 rounded-md bg-muted/50 border border-border/50 text-muted-foreground focus-within:ring-1 focus-within:ring-ring focus-within:border-border transition-all w-64 max-w-sm">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input 
                type="text" 
                placeholder="Search dashboard..." 
                className="flex w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative flex items-center justify-center h-9 w-9 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-500 border border-background"></span>
            </button>
            
            <div className="h-8 w-px bg-border/50 hidden md:block"></div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col text-right justify-center">
                <span className="text-sm font-medium leading-none mb-1">Admin User</span>
                <span className="text-xs text-muted-foreground leading-none">admin@clawpanel.com</span>
              </div>
              <Avatar className="h-8 w-8 ring-1 ring-border cursor-pointer hover:ring-indigo-500/50 transition-all">
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback className="bg-indigo-600 text-white text-xs">AD</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
