import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, DollarSign, Activity, TrendingUp, ArrowUpRight, ArrowDownRight, Server, Database } from "lucide-react"

import { ContentLayout } from "@/components/admin-panel/content-layout"

export default function DashboardPage() {
  const stats = [
    {
      title: "Total Revenue",
      value: "$45,231.89",
      change: "+20.1%",
      trend: "up",
      icon: DollarSign,
      description: "Compared to last month"
    },
    {
      title: "Active Users",
      value: "2,350",
      change: "+180.1%",
      trend: "up",
      icon: Users,
      description: "Compared to last month"
    },
    {
      title: "System Load",
      value: "14.5%",
      change: "-5.2%",
      trend: "down",
      icon: Activity,
      description: "Average CPU usage"
    },
    {
      title: "Database IOPS",
      value: "8,531",
      change: "+12.4%",
      trend: "up",
      icon: Database,
      description: "Read/Write operations per sec"
    }
  ]

  const recentActivity = [
    { user: "Sarah Jenkins", action: "deployed new version", target: "claw-panel-api", time: "2 hours ago" },
    { user: "Michael Chen", action: "restarted service", target: "database-cluster-1", time: "5 hours ago" },
    { user: "System Auto", action: "scaled up", target: "worker-pool-alpha", time: "12 hours ago" },
    { user: "Emma Watson", action: "updated configuration", target: "load-balancer", time: "Yesterday" }
  ]

  return (
    <ContentLayout title="Dashboard">
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          Overview
          <div className="flex h-3 w-3 relative ml-1">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
          </div>
        </h1>
        <p className="text-muted-foreground max-w-[600px] text-sm">
          Real-time metrics and status of your infrastructure and applications.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="group relative overflow-hidden bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40 border-border/50 hover:border-border transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity duration-500 group-hover:opacity-30 ${stat.trend === 'up' ? 'bg-emerald-500' : 'bg-destructive'}`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="p-2 bg-muted/30 rounded-lg border border-border/40 group-hover:bg-primary/5 transition-colors">
                <stat.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1 tracking-tight">{stat.value}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <span className={`mr-1 flex items-center font-semibold ${stat.trend === 'up' ? 'text-emerald-500' : 'text-destructive'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                  {stat.change}
                </span>
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Main Chart Card (Placeholder) */}
        <Card className="col-span-1 lg:col-span-4 bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">System Performance</CardTitle>
            <CardDescription>Overall resource utilization across all regions</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-6">
            <div className="h-[300px] w-full flex items-end justify-between px-4 pb-4 gap-2 relative">
              {/* Decorative grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-4">
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <div key={i} className="w-full h-px bg-border/40"></div>
                ))}
              </div>
              
              {/* Mock Bar Chart */}
              {[40, 25, 60, 45, 80, 55, 90, 65, 50, 75, 45, 85].map((height, i) => (
                <div key={i} className="w-full relative group">
                  <div 
                    className="absolute bottom-0 w-full bg-primary/20 backdrop-blur-sm border border-primary/20 border-b-0 rounded-t-sm transition-all duration-300 group-hover:bg-primary/40 group-hover:border-primary/50"
                    style={{ height: `${height}%` }}
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/70 rounded-t-sm"></div>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs py-1.5 px-2.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-border shadow-md font-medium">
                      {height}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-6 text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
              <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Card */}
        <Card className="col-span-1 lg:col-span-3 bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Operations</CardTitle>
            <CardDescription>Latest actions performed on the infrastructure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 mt-2 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-border/0 before:via-border/80 before:to-border/0">
              {recentActivity.map((activity, i) => (
                <div key={i} className="relative flex items-center justify-between group">
                  <div className="flex items-center gap-4 w-full">
                    <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background border-2 border-primary/20 shadow-sm transition-all duration-300 group-hover:border-primary group-hover:scale-110">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60 group-hover:bg-primary transition-colors"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {activity.user}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.action} <span className="text-primary font-medium">{activity.target}</span>
                      </p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-[10px] uppercase font-medium text-muted-foreground/80 tracking-wider bg-muted px-2 py-1 rounded-full">{activity.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Infrastructure Status */}
      <h2 className="text-lg font-semibold mt-10 mb-[-10px]">Infrastructure Health</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {['US East (N. Virginia)', 'EU West (Ireland)', 'Asia Pacific (Tokyo)'].map((region, i) => (
          <Card key={i} className="bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40 border-border/50 hover:border-border/80 transition-colors">
            <CardHeader className="py-4 border-b border-border/30">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-primary/10 text-primary">
                  <Server className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm font-medium">{region}</CardTitle>
                <div className="ml-auto flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Healthy</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-5">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground font-medium">Compute Capacity</span>
                    <span className="font-semibold">{(60 + i * 15).toString()}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${60 + i * 15}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground font-medium">Storage Allocation</span>
                    <span className="font-semibold">{(40 - i * 5).toString()}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all duration-1000 delay-150" style={{ width: `${40 - i * 5}%` }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </ContentLayout>
)
}
