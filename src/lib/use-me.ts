import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MANAGER_ROLES } from "@/lib/roles";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const id = u.user!.id;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id),
      ]);
      const list = roles?.map((r) => r.role) ?? [];
      const isAdmin = list.includes("admin");
      const isManager = list.some((r) => (MANAGER_ROLES as readonly string[]).includes(r));
      return { id, profile, roles: list, isAdmin, isManager };
    },
  });
}
