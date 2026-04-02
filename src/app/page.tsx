"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Hexagon, LockKeyhole, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login
    setTimeout(() => {
      setIsLoading(false);
      router.push("/dashboard");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-[0%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md p-8 md:p-10 rounded-[2rem] bg-card/40 backdrop-blur-2xl border border-border/50 shadow-2xl relative z-10 transition-all hover:border-border/80">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-gradient-to-tr from-primary to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-6 border border-border/50">
            <Hexagon className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground text-center text-sm">
            Enter your credentials to access the ClawPanel dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email Address</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input 
                id="email"
                type="email" 
                placeholder="admin@clawpanel.com" 
                className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl transition-all"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <a href="#" className="text-xs text-primary hover:text-primary/80 transition-colors">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockKeyhole className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input 
                id="password"
                type="password" 
                placeholder="••••••••" 
                className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl transition-all"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="remember" className="rounded-md border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
            <label
              htmlFor="remember"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground cursor-pointer"
            >
              Keep me signed in
            </label>
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium text-base transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                <span>Authenticating...</span>
              </div>
            ) : (
              "Sign In to Dashboard"
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border/40 text-center">
          <p className="text-muted-foreground text-sm">
            Don&apos;t have an account?{" "}
            <a href="#" className="text-foreground hover:text-primary font-medium transition-colors">
              Contact Admin
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
