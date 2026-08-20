/** Mirrors supabase/migrations/0001_users_sessions.sql. Hand-maintained
    (no codegen pipeline in this project) -- keep in sync with the SQL. */

export type UserRole = 'user' | 'admin';

export interface UserRow {
  id: string;
  x_user_id: string;
  x_username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  user_agent: string | null;
  revoked_at: string | null;
}
