// ---------------------------------------------------------------------------
//  email-template.ts — Branded HTML email template with social buttons
//  Used by: email-send (admin replies), inquiry auto-reply, notifications
// ---------------------------------------------------------------------------

const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=61592517126738",
  messenger: "https://m.me/1299111856611532",
  instagram: "https://instagram.com/aromiso979",
};

const COMPANY_INFO = {
  name: "Aromiso",
  tagline: "Premium Home Fragrance OEM/ODM Manufacturer",
  website: "https://aromiso.com",
  email: "sales@aromiso.com",
};

/**
 * Wraps a message body in the branded Aromiso email template.
 * Includes header, social buttons, and footer.
 */
export function wrapEmailTemplate(bodyHtml: string, opts?: { previewText?: string }): string {
  const preview = opts?.previewText || "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${COMPANY_INFO.name}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
${preview ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f7f4;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);padding:24px 32px;text-align:center;">
  <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">${COMPANY_INFO.name}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#a0a0a0;">${COMPANY_INFO.tagline}</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:32px;">
${bodyHtml}
</td>
</tr>

<!-- Social Buttons -->
<tr>
<td style="padding:0 32px 24px;text-align:center;">
  <p style="margin:0 0 12px;font-size:12px;color:#888;">Connect with us</p>
  <table role="presentation" cellpadding="0" cellspacing="0" align="center">
  <tr>
    <td style="padding:0 8px;">
      <a href="${SOCIAL_LINKS.facebook}" style="display:inline-block;padding:8px 16px;background-color:#1877F2;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Facebook</a>
    </td>
    <td style="padding:0 8px;">
      <a href="${SOCIAL_LINKS.messenger}" style="display:inline-block;padding:8px 16px;background-color:#0084FF;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Messenger</a>
    </td>
    <td style="padding:0 8px;">
      <a href="${SOCIAL_LINKS.instagram}" style="display:inline-block;padding:8px 16px;background-color:#E4405F;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Instagram</a>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background-color:#f8f7f4;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
  <p style="margin:0;font-size:12px;color:#999;">&copy; 2026 ${COMPANY_INFO.name} &middot; <a href="${COMPANY_INFO.website}" style="color:#666;">${COMPANY_INFO.website}</a></p>
  <p style="margin:4px 0 0;font-size:11px;color:#bbb;">You received this email because you contacted us about our fragrance products.</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Builds a simple notification email (for 163 alerts).
 */
export function notificationTemplate(title: string, lines: string[]): string {
  const bodyHtml = `
<h2 style="margin:0 0 16px;font-size:18px;color:#1a1a1a;">${title}</h2>
${lines.map((l) => `<p style="margin:0 0 8px;font-size:14px;color:#333;line-height:1.6;">${l}</p>`).join("\n")}
<p style="margin:16px 0 0;font-size:13px;color:#666;">
  <a href="https://aromiso.com/admin" style="color:#7c3aed;">→ 登录后台查看详情</a>
</p>`;
  return wrapEmailTemplate(bodyHtml, { previewText: title });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export { SOCIAL_LINKS, COMPANY_INFO };
