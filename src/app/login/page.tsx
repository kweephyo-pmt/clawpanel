"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockKeyhole, Mail, AlertCircle, Loader2, PanelsTopLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || user) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      if (!auth) {
        throw new Error("Firebase is not initialized. Please ensure your environment variables are configured.");
      }
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid email or password. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-zinc-50 dark:bg-zinc-950">
      {/* Brand/Marketing Side */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-zinc-900 border-r border-border dark:bg-black/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/90">
            <PanelsTopLeft className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight">ClawPanel</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-4 leading-tight">
            Manage your AI agents <br /> <span className="text-primary">with precision and scale.</span>
          </h1>
          <p className="text-lg text-zinc-400">
            Secure, powerful, and intuitive control panel for monitoring, orchestrating, and analyzing your autonomous systems in real time.
          </p>
        </div>

        <div className="relative z-10 text-sm text-zinc-500">
          &copy; {new Date().getFullYear()} TBS Marketing. All rights reserved.
        </div>
      </div>

      {/* Login Side */}
      <div className="flex items-center justify-center p-8 sm:p-12 lg:p-16 relative">
        <div className="w-full max-w-[420px] space-y-10">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-2">
            <div className="lg:hidden flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
              <PanelsTopLeft className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Sign in to your account</h2>
            <p className="text-muted-foreground text-base">
              Enter your admin credentials to access the dashboard.
            </p>
          </div>
          
          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-tight">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  className="pl-11 h-12 bg-background transition-shadow focus-visible:ring-1 focus-visible:ring-primary shadow-sm" 
                  placeholder="name@company.com" 
                  required 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>
              </div>
              <div className="relative group">
                <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  className="pl-11 h-12 bg-background transition-shadow focus-visible:ring-1 focus-visible:ring-primary shadow-sm" 
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium shadow-sm transition-all hover:bg-primary/90" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground lg:hidden">
            &copy; {new Date().getFullYear()} TBS Marketing. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
