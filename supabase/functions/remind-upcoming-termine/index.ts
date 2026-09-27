// Supabase Edge Function: remind-upcoming-termine
//
// Taeglich per Cron Job aufgerufen (siehe unten). Schickt eine kurze
// Sammel-E-Mail mit allen Terminen, die in den naechsten 24 Stunden
// anstehen -- damit ein Vor-Ort- oder Aufbautermin nicht im Projekt
// untergeht, wenn gerade niemand aktiv ins Backoffice schaut.
//
// Nutzt DIESELBEN Secrets wie "notify-new-lead" (keine neuen noetig):
//   GMAIL_USER, GMAIL_APP_PASSWORD, WEBHOOK_SECRET, optional NOTIFY_EMAIL
//
// Deploy: Supabase Dashboard -> Edge Functions -> "Deploy a new function"
// -> Name exakt "remind-upcoming-termine" -> diesen Code einfuegen -> Deploy.
//
// Danach: Database -> Cron Jobs -> "Create a new cron job":
//   Type: Supabase Edge Function, Funktion: remind-upcoming-termine
//   Schedule (cron, UTC): 0 7 * * *  (taeglich um 7:00 UTC, je nach
//     Jahreszeit 8-9 Uhr deutsche Zeit -- Uhrzeit im Dashboard frei anpassbar)
//   HTTP Headers: x-webhook-secret = <derselbe Wert wie bei notify-new-lead>

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_USER = Deno.env.get("GMAIL_USER") || "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") || "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL") || GMAIL_USER;

Deno.serve(async (req: Request) => {
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const url =
      SUPABASE_URL +
      "/rest/v1/termine?select=*,projekte(kunden(name))" +
      "&datum=gte." + encodeURIComponent(now.toISOString()) +
      "&datum=lt." + encodeURIComponent(in24h.toISOString()) +
      "&order=datum.asc";

    const res = await fetch(url, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: "Bearer " + SERVICE_ROLE_KEY },
    });
    if (!res.ok) throw new Error("Termine laden fehlgeschlagen: HTTP " + res.status);
    const termine = await res.json();

    if (!termine.length) {
      return new Response(JSON.stringify({ ok: true, sent: false, reason: "keine Termine in den naechsten 24h" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const zeilen = [
      "Anstehende Termine in den naechsten 24 Stunden:",
      "",
      ...termine.map((t: any) => {
        const kundeName = t.projekte && t.projekte.kunden ? t.projekte.kunden.name : "—";
        const wann = new Date(t.datum).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
        return "- " + wann + " · " + t.titel + " · " + kundeName + (t.ort ? " · " + t.ort : "");
      }),
      "",
      "Im Backoffice ansehen: https://gym7-fit.github.io/vitaro-backoffice-kunden/",
    ];

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });
    await client.send({
      from: GMAIL_USER,
      to: NOTIFY_EMAIL,
      subject: "VITARO: " + termine.length + " Termin(e) in den naechsten 24 Stunden",
      content: zeilen.join("\n"),
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true, sent: true, count: termine.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
