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

// ---------- VITARO-Markenlook fuer HTML-Mails (dieselben Farben/Schriften
// wie auf der oeffentlichen Website, assets/css/style.css) ----------
function escapeHtml(s: unknown): string {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function emailShell(preheader: string, bodyHtml: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&display=swap"></head>' +
    '<body style="margin:0;padding:0;background-color:#f7f1e6;">' +
    '<div style="display:none;max-height:0;overflow:hidden;">' + escapeHtml(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f1e6;padding:32px 16px;"><tr><td align="center">' +
    '<table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0"><tr><td style="background-color:#fffdf8;border:1px solid rgba(27,21,14,0.12);border-radius:8px;overflow:hidden;font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="padding:26px 32px 16px;border-bottom:3px solid #a68a73;">' +
    '<a href="https://gym7-fit.github.io/vitaro-homegym-preview/" style="text-decoration:none;display:inline-block;">' +
    '<div style="font-family:\'Playfair Display\',Georgia,\'Times New Roman\',serif;font-size:22px;font-weight:500;letter-spacing:0.28em;color:#1b1712;">VITARO</div>' +
    '<div style="font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;color:#6e6357;margin-top:4px;">' +
    '<span style="letter-spacing:1.015em;margin-right:0.85em;">HOME</span><span style="letter-spacing:1.015em;">GYMS</span>' +
    '</div>' +
    '</a>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 32px 30px;font-size:14px;line-height:1.6;color:#1b1712;">' + bodyHtml + '</td></tr>' +
    '</table></td></tr>' +
    '<tr><td style="padding:16px 8px 0;text-align:center;font-size:11px;color:#6e6357;font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;">VITARO Home Gyms</td></tr>' +
    '</table></td></tr></table></body></html>'
  );
}
function brandButton(href: string, label: string): string {
  return '<p style="margin:22px 0 0;"><a href="' + href + '" style="display:inline-block;background:#1b1712;color:#fffdf8;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:700;">' + escapeHtml(label) + '</a></p>';
}

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
    const bodyHtml =
      '<p style="margin:0 0 16px;font-weight:700;">Anstehende Termine in den nächsten 24 Stunden:</p>' +
      '<ul style="margin:0 0 6px;padding-left:18px;">' +
      termine.map((t: any) => {
        const kundeName = t.projekte && t.projekte.kunden ? t.projekte.kunden.name : "—";
        const wann = new Date(t.datum).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
        return '<li style="margin-bottom:8px;">' + escapeHtml(wann) + ' &middot; ' + escapeHtml(t.titel) + ' &middot; ' + escapeHtml(kundeName) + (t.ort ? ' &middot; ' + escapeHtml(t.ort) : '') + '</li>';
      }).join("") +
      '</ul>' +
      brandButton("https://gym7-fit.github.io/vitaro-backoffice-kunden/", "Im Backoffice ansehen");

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
      html: emailShell(termine.length + " Termin(e) in den naechsten 24 Stunden", bodyHtml),
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
