export default function EmailProcessingPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Email Processing</h2>
      </div>
      <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
        <p className="text-muted-foreground">Manage email routing and OpenClaw processing triggers.</p>
        {/* Placeholder for future OpenClaw email inbox parsing configuration */}
      </div>
    </div>
  );
}
