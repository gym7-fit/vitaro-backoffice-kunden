// Supabase Edge Function: notify-new-lead
//
// Wird von einem Supabase Database Webhook aufgerufen (INSERT auf "kunden" --
// also jede neue Planer-Registrierung oder jedes neue Kontaktformular).
// Verschickt eine kurze Benachrichtigungs-E-Mail, damit eine neue Anfrage
// nicht erst beim naechsten Blick ins Backoffice auffaellt.
//
// Braucht drei Secrets (Supabase Dashboard -> Edge Functions -> Secrets):
//   GMAIL_USER          -- dieselbe Gmail-Adresse, die schon fuer die
//                          Auth-SMTP-Einstellungen genutzt wird
//   GMAIL_APP_PASSWORD  -- deren App-Passwort (dasselbe wie bei SMTP Settings)
//   WEBHOOK_SECRET       -- ein selbst gewaehlter, zufaelliger String; muss
//                          exakt mit dem Custom-Header im Database-Webhook
//                          uebereinstimmen (schuetzt den Endpunkt, da er
//                          oeffentlich erreichbar ist)
// Optional: NOTIFY_EMAIL -- Empfaenger, falls abweichend von GMAIL_USER
//
// Deploy: Supabase Dashboard -> Edge Functions -> "Deploy a new function"
// -> Name exakt "notify-new-lead" -> diesen Code einfuegen -> Deploy.
//
// Danach: Database -> Webhooks -> "Create a new hook":
//   Table: kunden, Event: INSERT, Type: HTTP Request, Method: POST
//   URL: <SUPABASE_URL>/functions/v1/notify-new-lead
//   HTTP Headers: x-webhook-secret = <derselbe Wert wie WEBHOOK_SECRET oben>

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER = Deno.env.get("GMAIL_USER") || "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") || "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL") || GMAIL_USER;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Nur POST erlaubt.", { status: 405 });

  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const kunde = (payload && payload.record) || {};

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });

    const zeilen = [
      "Neue Anfrage im VITARO Backoffice:",
      "",
      "Name: " + (kunde.name || "—"),
      "E-Mail: " + (kunde.email || "—"),
      "Telefon: " + (kunde.telefon || "—"),
      "Quelle: " + (kunde.quelle || "—"),
      "",
      "Im Backoffice ansehen: https://gym7-fit.github.io/vitaro-backoffice-kunden/",
    ];

    await client.send({
      from: GMAIL_USER,
      to: NOTIFY_EMAIL,
      subject: "Neue VITARO-Anfrage: " + (kunde.name || kunde.email || "unbekannt"),
      content: zeilen.join("\n"),
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
