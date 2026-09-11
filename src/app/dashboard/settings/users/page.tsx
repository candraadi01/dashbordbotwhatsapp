"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/types";
import { authService } from "@/services/authService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ShieldAlert, ShieldCheck, Users, Mail, Clock, ShieldBan } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const ownerStatus = await authService.isOwner();
      setIsOwner(ownerStatus);

      const me = await authService.getCurrentUser();
      if (me) setCurrentUserEmail(me.email);

      const { data, error: fetchError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setUsers(data as UserProfile[]);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data user");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId);
    try {
      // Validate not removing the last OWNER
      if (newRole !== 'OWNER') {
        const ownerCount = users.filter(u => u.role === 'OWNER').length;
        const targetUser = users.find(u => u.id === userId);
        if (targetUser?.role === 'OWNER' && ownerCount <= 1) {
          throw new Error("Tidak dapat mengubah role OWNER terakhir!");
        }
      }

      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui role");
    } finally {
      setUpdatingId(null);
    }
  };

  const RoleBadge = ({ role }: { role: string }) => {
    if (role === 'OWNER') return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold flex items-center gap-1 w-max"><ShieldAlert className="w-3 h-3"/> OWNER</span>;
    if (role === 'ADMIN') return <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold flex items-center gap-1 w-max"><ShieldCheck className="w-3 h-3"/> ADMIN</span>;
    return <span className="px-2 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded text-[10px] font-bold flex items-center gap-1 w-max"><Shield className="w-3 h-3"/> STAFF</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-400" /> User Management
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Kelola hak akses dan peran seluruh anggota tim admin.
        </p>
      </div>

      <Card className="border-slate-200 bg-white backdrop-blur-xl">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-slate-950">Daftar Admin</CardTitle>
          <CardDescription className="text-slate-400">Hanya OWNER yang dapat mengubah role pengguna lain.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full bg-slate-100/50" />
              <Skeleton className="h-12 w-full bg-slate-100/50" />
              <Skeleton className="h-12 w-full bg-slate-100/50" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-400">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role Saat Ini</th>
                    <th className="px-6 py-4">Bergabung</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold border border-slate-300">
                            {user.email.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-2">
                              {user.email}
                              {currentUserEmail === user.email && (
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">YOU</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isOwner ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs bg-white border-slate-300 hover:bg-slate-100 text-slate-700"
                              disabled={updatingId === user.id || user.role === 'ADMIN'}
                              onClick={() => handleRoleChange(user.id, 'ADMIN')}
                            >
                              Jadikan Admin
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs bg-white border-slate-300 hover:bg-slate-100 text-slate-700"
                              disabled={updatingId === user.id || user.role === 'STAFF'}
                              onClick={() => handleRoleChange(user.id, 'STAFF')}
                            >
                              Jadikan Staff
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 flex justify-end items-center gap-1">
                            <ShieldBan className="h-3 w-3" /> No Access
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        Tidak ada user ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
