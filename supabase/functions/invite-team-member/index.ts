// Supabase Edge Function: invite-team-member
//
// Laedt bei Supabase selbst (kein eigenes Hosting noetig). Bekommt
// automatisch SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// als Umgebungsvariablen -- niemand muss den Service-Role-Key irgendwo
// eintragen, er landet nie im Browser-Code.
//
// Ablauf: Owner gibt im Backoffice-Team-Tab E-Mail + Rolle ein -> diese
// Funktion prueft zuerst, ob der Aufrufer wirklich Owner ist, laedt dann
// per Supabase-Admin-API einen echten Auth-Account ein (E-Mail mit
// "Passwort setzen"-Link) und traegt die Rolle in team_mitglieder ein.
//
// Deploy: Supabase Dashboard -> Edge Functions -> "Deploy a new function"
// -> Name exakt "invite-team-member" -> diesen Code einfuegen -> Deploy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Nur POST erlaubt." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nicht angemeldet.");

    // Client mit dem Token des Aufrufers -- prueft dessen Identitaet.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user?.email) throw new Error("Sitzung ungültig, bitte neu anmelden.");
    const callerEmail = userData.user.email;

    // Admin-Client mit Service-Role -- NUR hier, nie im Frontend.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerRow } = await adminClient
      .from("team_mitglieder")
      .select("rolle")
      .eq("email", callerEmail)
      .maybeSingle();
    if (!callerRow || callerRow.rolle !== "owner") {
      throw new Error("Nur Owner dürfen Team-Mitglieder einladen.");
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const rolle = body.rolle === "owner" ? "owner" : "mitarbeiter";
    if (!email || !email.includes("@")) throw new Error("Bitte eine gültige E-Mail angeben.");

    // Muss die VOLLE URL sein (inkl. Pfad), exakt wie in den Supabase-Auth-
    // "Redirect URLs" eingetragen -- nur die nackte Origin (ohne Pfad)
    // matcht dort nicht, Supabase faellt dann still auf die Site-URL
    // zurueck (z.B. localhost:3000). Kommt vom Frontend mit, mit fester
    // Absicherung als Fallback.
    const redirectTo = String(body.redirectTo || "") || "https://gym7-fit.github.io/vitaro-backoffice-kunden/";
    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
    // "already been registered" ist kein Fehler -- Rolle trotzdem setzen/aendern.
    if (inviteErr && !/already.*registered/i.test(inviteErr.message || "")) {
      throw new Error(inviteErr.message);
    }

    const { error: upsertErr } = await adminClient
      .from("team_mitglieder")
      .upsert({ email, rolle }, { onConflict: "email" });
    if (upsertErr) throw new Error(upsertErr.message);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: String((err as Error).message || err) }, 400);
  }
});
