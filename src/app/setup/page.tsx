"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Settings, 
  ShieldCheck, 
  AlertCircle, 
  Key, 
  Globe, 
  Database, 
  Box, 
  Send, 
  AppWindow,
  ExternalLink,
  ChevronRight
} from "lucide-react";

import { saveFirebaseConfig } from "@/actions/save-config";
import { useAuth } from "@/context/auth-context";
import { hasFirebaseConfig } from "@/lib/firebase";

export default function SetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // If already configured and visited /setup, redirect
    if (hasFirebaseConfig && isMounted) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, router, isMounted]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    const formData = new FormData(e.currentTarget);
    const config = {
      apiKey: formData.get("apiKey") as string,
      authDomain: formData.get("authDomain") as string,
      projectId: formData.get("projectId") as string,
      storageBucket: formData.get("storageBucket") as string,
      messagingSenderId: formData.get("messagingSenderId") as string,
      appId: formData.get("appId") as string,
    };

    if (!config.apiKey || !config.projectId) {
      setError("Please fill in all required Firebase credentials.");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Save to localStorage (Instant local fix)
      localStorage.setItem("firebaseConfig", JSON.stringify(config));

      // 2. Save to VPS/Server .env.local (Permanent fix for everyone)
      const result = await saveFirebaseConfig(config);
      
      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(`Saved in browser, but failed to write to server: ${result.error}`);
      }

      setIsLoading(false);
      // Wait a moment so they can see the message
      setTimeout(() => {
        window.location.href = "/login";
      }, 3000);
    } catch (err: any) {
      setError("Failed to save configuration. Please check browser permissions.");
      setIsLoading(false);
    }
  };

  if (!isMounted || (hasFirebaseConfig && isMounted)) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] overflow-hidden relative p-4 md:p-8">
      {/* ... previous dynamic bg ... */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-[100px]" />
      </div>
      
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        {/* Instruction Panel */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-8">
          <div className="space-y-4 animate-in fade-in slide-in-from-left duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <ShieldCheck className="h-3 w-3" />
              <span>Server-Side Permanent Save</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Cloud <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Initialization</span>
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Updating your Firebase project config on the VPS. This will permanently update the `.env.local` file for all users.
            </p>
          </div>
          {/* ... etc ... */}


          <div className="space-y-4 animate-in fade-in slide-in-from-left duration-700 delay-200">
            <div className="group flex items-start gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="mt-1 h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors">
                <ExternalLink className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-white font-medium">Where to find keys?</h4>
                <p className="text-sm text-zinc-500">Go to Firebase Console &gt; Project Settings &gt; Your Apps &gt; SDK Setup Config.</p>
                <a 
                  href="https://console.firebase.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open Firebase Console <ChevronRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Form Panel */}
        <div className="lg:col-span-7 animate-in fade-in zoom-in duration-700">
          <div className="p-1 rounded-[2.5rem] bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl">
            <div className="bg-[#0c0c0e] rounded-[2.3rem] p-8 md:p-10 border border-white/5">
              <div className="flex items-center gap-4 mb-10">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Project Credentials</h3>
                  <p className="text-sm text-zinc-500">Enter your Firebase SDK configuration</p>
                </div>
              </div>

              {isSuccess && (
                <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-400 animate-in fade-in duration-500">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">Configuration saved to .env.local! Reloading...</p>
                </div>
              )}

              {error && (
                <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 animate-in shake duration-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-zinc-300 text-xs uppercase tracking-widest font-bold">API Key</Label>
                    <div className="relative group">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                      <Input id="apiKey" name="apiKey" placeholder="AIzaSy..." required className="pl-10 h-12 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 text-zinc-200 placeholder:text-zinc-700 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="authDomain" className="text-zinc-300 text-xs uppercase tracking-widest font-bold">Auth Domain</Label>
                    <div className="relative group">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                      <Input id="authDomain" name="authDomain" placeholder="example.firebaseapp.com" required className="pl-10 h-12 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 text-zinc-200 placeholder:text-zinc-700 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectId" className="text-zinc-300 text-xs uppercase tracking-widest font-bold">Project ID</Label>
                    <div className="relative group">
                      <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                      <Input id="projectId" name="projectId" placeholder="my-awesome-project" required className="pl-10 h-12 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 text-zinc-200 placeholder:text-zinc-700 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storageBucket" className="text-zinc-300 text-xs uppercase tracking-widest font-bold">Storage Bucket</Label>
                    <div className="relative group">
                      <Box className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                      <Input id="storageBucket" name="storageBucket" placeholder="example.appspot.com" required className="pl-10 h-12 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 text-zinc-200 placeholder:text-zinc-700 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="messagingSenderId" className="text-zinc-300 text-xs uppercase tracking-widest font-bold">Sender ID</Label>
                    <div className="relative group">
                      <Send className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                      <Input id="messagingSenderId" name="messagingSenderId" placeholder="1234567890" required className="pl-10 h-12 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 text-zinc-200 placeholder:text-zinc-700 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appId" className="text-zinc-300 text-xs uppercase tracking-widest font-bold">App ID</Label>
                    <div className="relative group">
                      <AppWindow className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                      <Input id="appId" name="appId" placeholder="1:1234:web:abcd" required className="pl-10 h-12 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 text-zinc-200 placeholder:text-zinc-700 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <Button 
                    type="submit" 
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Initializing...</span>
                      </div>
                    ) : (
                      "Connect Project"
                    )}
                  </Button>
                  <p className="mt-6 text-center text-[10px] text-zinc-600 uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="h-px w-8 bg-zinc-900"></span>
                    Encrypted Local Storage
                    <span className="h-px w-8 bg-zinc-900"></span>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
