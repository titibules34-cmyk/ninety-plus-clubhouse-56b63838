import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";
import { homeFor } from "@/lib/home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoginApp" },
      { name: "description", content: "Welcome | Please login" },
      { property: "og:title", content: "LoginApp" },
      { property: "og:description", content: "Welcome | Please login" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<"" | "user" | "pass" | "login">("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function goHome(userId: string) {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const to = homeFor(roles?.map((r) => r.role) ?? []);
    if (to === "/sport") navigate({ to: "/sport" });
    else navigate({ to: "/dashboard", search: { u: undefined } });
  }
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => { if (data.user) await goHome(data.user.id); });
  }, [navigate]);
  const submit = async () => {
    if (!u) return setErr("user");
    if (!p) return setErr("pass");
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(u), password: p });
    if (error || !data.user) { setBusy(false); return setErr("login"); }
    setErr("");
    await goHome(data.user.id);
    setBusy(false);
  };
  return (
    <div className="login-screen">
      <div className="login-box">
        <span className="login-title">Welcome &nbsp;| &nbsp;Please login</span>
        <div className="login-input">
          <input className={u ? "has-val" : ""} placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <i className="material-icons">account_circle</i>
        </div>
        <div className="login-error">{err === "user" && <span>*Enter your username</span>}</div>
        <div className="login-input">
          <input type="password" className={p ? "has-val" : ""} placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <i className="material-icons">lock_outline</i>
        </div>
        <div className="login-error">
          {err === "pass" && <span>*Enter your password</span>}
          {err === "login" && <span>*Username or password incorrect</span>}
        </div>
        <button className="login-btn" disabled={busy} onClick={submit}>Login</button>
      </div>
    </div>
  );
}
