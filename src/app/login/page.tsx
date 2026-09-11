"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Bot, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Gagal masuk. Periksa kembali email dan password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/20 mb-4">
          <Bot className="h-10 w-10 text-slate-950" />
        </div>
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-950">
          CANDRA ADMIN
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Masuk ke sistem dashboard admin Anda
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-200 sm:rounded-2xl sm:px-10 backdrop-blur-xl">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="mt-1">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-50 border-slate-200 text-slate-950 w-full"
                  placeholder="admin@candra.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1">
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-50 border-slate-200 text-slate-950 w-full"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 shadow-md shadow-indigo-600/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Masuk Sekarang"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
