"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hexagon, Settings, ShieldCheck, AlertCircle } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const config = {
      apiKey: formData.get("apiKey") as string,
      authDomain: formData.get("authDomain") as string,
      projectId: formData.get("projectId") as string,
      storageBucket: formData.get("storageBucket") as string,
      messagingSenderId: formData.get("messagingSenderId") as string,
      appId: formData.get("appId") as string,
    };

    if (!config.apiKey) {
      setError("API Key is required");
      setIsLoading(false);
      return;
    }

    try {
      localStorage.setItem("firebaseConfig", JSON.stringify(config));
      // Force a reload to re-initialize Firebase with new keys
      window.location.href = "/login";
    } catch (err: any) {
      setError("Failed to save configuration.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background overflow-hidden relative py-12">
      <div className="absolute top-[0%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-2xl p-8 md:p-10 rounded-[2rem] bg-card/40 backdrop-blur-2xl border border-border/50 shadow-2xl relative z-10 transition-all">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-gradient-to-tr from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-6 border border-border/50">
            <Settings className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">ClawPanel Setup</h1>
          <p className="text-muted-foreground text-center text-sm max-w-sm">
            Enter your Firebase project credentials to initialize the application. This is stored securely in your browser.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input id="apiKey" name="apiKey" placeholder="AIzaSy..." required className="h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authDomain">Auth Domain</Label>
            <Input id="authDomain" name="authDomain" placeholder="project-id.firebaseapp.com" required className="h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectId">Project ID</Label>
            <Input id="projectId" name="projectId" placeholder="project-id" required className="h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="storageBucket">Storage Bucket</Label>
            <Input id="storageBucket" name="storageBucket" placeholder="project-id.appspot.com" required className="h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="messagingSenderId">Messaging Sender ID</Label>
            <Input id="messagingSenderId" name="messagingSenderId" placeholder="123456789" required className="h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appId">App ID</Label>
            <Input id="appId" name="appId" placeholder="1:1234:web:abcd" required className="h-11" />
          </div>

          <div className="md:col-span-2 pt-4">
            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 border-none text-white shadow-lg" disabled={isLoading}>
              {isLoading ? "Saving..." : "Initialize ClawPanel"}
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" /> All data is stored locally in your browser.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
