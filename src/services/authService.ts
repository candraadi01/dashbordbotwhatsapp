import { supabase } from "@/lib/supabase";
import { User, UserRole } from "@/types";

export const authService = {
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return null;
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (roleError || !roleData) {
      return null;
    }

    return {
      id: roleData.id,
      email: roleData.email,
      role: roleData.role as UserRole,
      created_at: roleData.created_at,
      updated_at: roleData.updated_at,
    };
  },

  async getUserRole(): Promise<UserRole | null> {
    const user = await this.getCurrentUser();
    return user?.role || null;
  },

  async isOwner(): Promise<boolean> {
    const role = await this.getUserRole();
    return role === 'OWNER';
  },

  hasPermission(role: UserRole | null, allowedRoles: UserRole[]): boolean {
    if (!role) return false;
    return allowedRoles.includes(role);
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};
