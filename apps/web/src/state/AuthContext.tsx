import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { MemberRole, MembershipStatus } from "@/types";

export type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  role?: MemberRole;
  roles?: MemberRole[];
  membershipStatus?: MembershipStatus;
  isGuest?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  profileRegistered: boolean;
  memberStatus: MembershipStatus;
  isApprovedMember: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileRegistered, setProfileRegistered] = useState(true);
  const [memberStatus, setMemberStatus] = useState<MembershipStatus>("approved");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { headers: { "content-type": "application/json" } });
      const json = (await res.json()) as { user: AuthUser | null };
      const authUser = json.user ?? null;
      setUser(authUser);
      setMemberStatus(authUser?.membershipStatus || "approved");

      if (authUser) {
        try {
          const profileRes = await fetch("/api/profile/me", { headers: { "content-type": "application/json" } });
          const profileJson = (await profileRes.json()) as { registered?: boolean };
          setProfileRegistered(Boolean(profileJson.registered));
        } catch {
          setProfileRegistered(true);
        }
      } else {
        setProfileRegistered(true);
        setMemberStatus("approved");
      }
    } catch {
      setUser(null);
      setProfileRegistered(true);
      setMemberStatus("approved");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, profileRegistered, memberStatus, isApprovedMember: memberStatus === "approved", loading, refresh }),
    [user, profileRegistered, memberStatus, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function hasRole(user: AuthUser | null, role: MemberRole) {
  if (!user) return false;
  const roles = (user.roles?.length ? user.roles : user.role ? [user.role] : []) as MemberRole[];
  return roles.includes(role);
}
