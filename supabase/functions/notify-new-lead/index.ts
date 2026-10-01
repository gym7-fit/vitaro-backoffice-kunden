// Supabase Edge Function: notify-new-lead
//
// Wird von einem Supabase Database Webhook aufgerufen (INSERT auf "kunden" --
// also jede neue Planer-Registrierung oder jedes neue Kontaktformular).
// Macht zwei Dinge:
//   1. Verschickt eine kurze Benachrichtigungs-E-Mail an den Owner, damit
//      eine neue Anfrage nicht erst beim naechsten Blick ins Backoffice
//      auffaellt.
//   2. Verschickt eine kurze Eingangsbestaetigung an den Kunden selbst --
//      aber NUR, wenn die Anfrage wirklich von ihm selbst kam (quelle
//      "Kontaktformular" oder "Planer-Registrierung"). Von Hand im
//      Backoffice angelegte Kunden ("Direktakquise"/"Sonstige") bekommen
//      keine automatische Mail, die waere dort unpassend.
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

// ---------- VITARO-Markenlook fuer HTML-Mails (dieselben Farben/Schriften
// wie auf der oeffentlichen Website, assets/css/style.css: --bg, --card,
// --text, --text-dim, --accent, --accent-2, Playfair Display + Inter) ----------
function escapeHtml(s: unknown): string {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function emailShell(preheader: string, bodyHtml: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet"></head>' +
    '<body style="margin:0;padding:0;background-color:#f7f1e6;">' +
    '<div style="display:none;max-height:0;overflow:hidden;">' + escapeHtml(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f1e6;padding:32px 16px;"><tr><td align="center">' +
    '<table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0"><tr><td style="background-color:#fffdf8;border:1px solid rgba(27,21,14,0.12);border-radius:8px;overflow:hidden;font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="padding:26px 32px 16px;border-bottom:3px solid #a68a73;">' +
    '<a href="https://gym7-fit.github.io/vitaro-homegym-preview/" style="text-decoration:none;display:inline-block;">' +
    '<div style="font-family:\'Playfair Display\',Georgia,\'Times New Roman\',serif;font-size:22.4px;font-weight:500;letter-spacing:0.28em;color:#1b1712;">VITARO</div>' +
    '<div style="font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;font-size:8px;font-weight:700;text-transform:uppercase;color:#6e6357;margin-top:4px;">' +
    '<span style="letter-spacing:0.95em;margin-right:0.78em;">HOME</span><span style="letter-spacing:0.95em;">GYMS</span>' +
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
    const internBodyHtml =
      '<p style="margin:0 0 16px;font-weight:700;">Neue Anfrage:</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">' +
      '<tr><td style="padding:4px 0;color:#6e6357;width:90px;">Name</td><td style="padding:4px 0;">' + escapeHtml(kunde.name || "—") + '</td></tr>' +
      '<tr><td style="padding:4px 0;color:#6e6357;">E-Mail</td><td style="padding:4px 0;">' + escapeHtml(kunde.email || "—") + '</td></tr>' +
      '<tr><td style="padding:4px 0;color:#6e6357;">Telefon</td><td style="padding:4px 0;">' + escapeHtml(kunde.telefon || "—") + '</td></tr>' +
      '<tr><td style="padding:4px 0;color:#6e6357;">Quelle</td><td style="padding:4px 0;">' + escapeHtml(kunde.quelle || "—") + '</td></tr>' +
      '</table>' +
      brandButton("https://gym7-fit.github.io/vitaro-backoffice-kunden/", "Im Backoffice ansehen");

    await client.send({
      from: GMAIL_USER,
      to: NOTIFY_EMAIL,
      subject: "Neue VITARO-Anfrage: " + (kunde.name || kunde.email || "unbekannt"),
      content: zeilen.join("\n"),
      html: emailShell("Neue Anfrage: " + (kunde.name || kunde.email || "unbekannt"), internBodyHtml),
    });

    const CUSTOMER_QUELLEN = ["Kontaktformular", "Planer-Registrierung"];
    let customerMailSent = false;
    if (kunde.email && CUSTOMER_QUELLEN.includes(kunde.quelle)) {
      try {
        const gruss = kunde.name ? "Hallo " + kunde.name + "," : "Hallo,";
        const kundenZeilen = [
          gruss,
          "",
          "vielen Dank für Ihre Anfrage bei VITARO Home Gym. Wir haben sie erhalten und melden uns in Kürze bei Ihnen.",
          "",
          "Mit freundlichen Grüßen",
          "Ihr VITARO-Team",
        ];
        const kundenBodyHtml =
          '<p style="margin:0 0 16px;">' + escapeHtml(gruss) + '</p>' +
          '<p style="margin:0 0 16px;">Vielen Dank für Ihre Anfrage bei VITARO Home Gyms. Wir haben sie erhalten und melden uns in Kürze bei Ihnen.</p>' +
          '<p style="margin:0;">Mit freundlichen Grüßen<br>Ihr VITARO-Team</p>';
        await client.send({
          from: GMAIL_USER,
          to: kunde.email,
          subject: "Ihre Anfrage bei VITARO Home Gym",
          content: kundenZeilen.join("\n"),
          html: emailShell("Vielen Dank für Ihre Anfrage bei VITARO Home Gyms.", kundenBodyHtml),
        });
        customerMailSent = true;
      } catch (custErr) {
        // Eingangsbestaetigung ist ein Nice-to-have -- ein Fehler hier darf
        // die eigentliche (interne) Benachrichtigung nicht scheitern lassen.
      }
    }

    await client.close();

    return new Response(JSON.stringify({ ok: true, customerMailSent }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
