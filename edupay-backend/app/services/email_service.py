import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_smtp(to: str, subject: str, html_body: str):
  """Send email via SMTP. Works in all environments.

  Returns True on success, False on failure (or if SMTP not configured).
  """
  if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
    logger.warning("[EMAIL SKIPPED] SMTP not configured — would send to %s: %s", to, subject)
    return False
  try:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))
    # Try plain SMTP with STARTTLS first; if the server doesn't support STARTTLS,
    # fall back to SMTP_SSL (SMTPS) on port 465.
    server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
    server.ehlo()
    try:
      server.starttls()
      server.ehlo()
    except smtplib.SMTPNotSupportedError:
      logger.warning("SMTP server does not support STARTTLS; falling back to SMTPS")
      try:
        server.close()
      except Exception:
        pass
      server = smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=15)

    try:
      server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
    except Exception:
      logger.exception("SMTP login failed for user %s", settings.SMTP_USER)
      try:
        server.quit()
      except Exception:
        pass
      return False

    try:
      server.sendmail(settings.SMTP_USER, to, msg.as_string())
    except Exception:
      logger.exception("SMTP sendmail failed to %s", to)
      try:
        server.quit()
      except Exception:
        pass
      return False
    try:
      server.quit()
    except Exception:
      pass
    logger.info("Email sent to %s — %s", to, subject)
    return True
  except Exception:
    logger.exception("Failed to send email to %s", to)
    return False


# Alias: always-send
send_email = _send_smtp


def _brand_wrap(content: str) -> str:
    """Wraps content in a branded EduPay email shell."""
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <!-- Header -->
        <tr>
          <td style="background:#1A56DB;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
            <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">EduPay<span style="color:#93C5FD;">.ng</span></span>
            <p style="margin:4px 0 0;color:#BFDBFE;font-size:13px;">Nigeria's #1 Educational Services Platform</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
            {content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#94A3B8;font-size:12px;">
              &copy; 2026 EduPay.ng · All rights reserved<br>
              <a href="mailto:{settings.SMTP_USER}" style="color:#1A56DB;text-decoration:none;">{settings.SMTP_USER}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_verification_email(email: str, name: str):
    content = f"""
      <h2 style="margin:0 0 8px;color:#1A56DB;font-size:22px;">Welcome to EduPay.ng, {name}! 🎓</h2>
      <p style="color:#475569;margin:0 0 20px;">Your account has been created. Please verify your email to unlock full access.</p>
      <a href="{settings.FRONTEND_URL}" style="background:#1A56DB;color:#fff;padding:12px 28px;border-radius:8px;
        text-decoration:none;display:inline-block;font-weight:700;font-size:15px;">Open EduPay.ng</a>
      <p style="color:#94A3B8;font-size:12px;margin:20px 0 0;">If you didn't create this account, you can safely ignore this email.</p>"""
    _send_smtp(email, "Welcome to EduPay.ng — Verify your account", _brand_wrap(content))


def send_wallet_funded_email(email: str, name: str, amount: float, reference: str, new_balance: float):
    content = f"""
      <h2 style="margin:0 0 6px;color:#059669;font-size:22px;">&#127881; Wallet Funded!</h2>
      <p style="color:#475569;margin:0 0 20px;">Hi <strong>{name}</strong>, your EduPay wallet has been credited successfully.</p>
      <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border-radius:10px;overflow:hidden;margin-bottom:20px;">
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">Amount Credited</td>
          <td style="padding:12px 16px;font-weight:700;color:#059669;font-size:18px;">+&#8358;{amount:,.2f}</td>
        </tr>
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">New Balance</td>
          <td style="padding:12px 16px;font-weight:700;font-size:16px;">&#8358;{new_balance:,.2f}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">Reference</td>
          <td style="padding:12px 16px;font-family:monospace;font-size:13px;color:#475569;">{reference}</td>
        </tr>
      </table>
      <p style="color:#475569;font-size:14px;">You can now use your wallet to pay for exams, school forms, bills and consultations.</p>
      <a href="{settings.FRONTEND_URL}/wallet" style="background:#1A56DB;color:#fff;padding:12px 28px;border-radius:8px;
        text-decoration:none;display:inline-block;font-weight:700;margin-top:8px;">View Wallet</a>"""
    _send_smtp(email, f"EduPay — Wallet Funded &#8358;{amount:,.2f}", _brand_wrap(content))


def send_order_confirmation(email: str, name: str, order_ref: str, product: str, extra_note: str = ""):
    content = f"""
      <h2 style="margin:0 0 6px;color:#1A56DB;font-size:22px;">&#10003; Order Confirmed</h2>
      <p style="color:#475569;margin:0 0 20px;">Hi <strong>{name}</strong>, your order has been placed successfully.</p>
      <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border-radius:10px;overflow:hidden;margin-bottom:20px;">
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">Product</td>
          <td style="padding:12px 16px;font-weight:600;font-size:14px;">{product}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">Order Reference</td>
          <td style="padding:12px 16px;font-family:monospace;font-size:13px;color:#475569;">{order_ref}</td>
        </tr>
      </table>
      {'<div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;border-radius:6px;margin-bottom:16px;color:#92400E;font-size:14px;">' + extra_note + '</div>' if extra_note else ''}
      <p style="color:#475569;font-size:14px;">Save your order reference for tracking purposes. If you have any questions, reply to this email.</p>
      <a href="{settings.FRONTEND_URL}/history" style="background:#1A56DB;color:#fff;padding:12px 28px;border-radius:8px;
        text-decoration:none;display:inline-block;font-weight:700;margin-top:8px;">View Order History</a>"""
    _send_smtp(email, f"EduPay — Order Confirmed: {order_ref}", _brand_wrap(content))


def send_form_order_buyer_email(email: str, name: str, form_name: str, institution: str,
                                 order_ref: str, amount: float, whatsapp_number: str):
    """Buyer confirmation email for school form purchase with WhatsApp contact info."""
    admin_wa = settings.ADMIN_WHATSAPP or "2348023836040"
    wa_link = (
        f"https://wa.me/{admin_wa}?text="
        f"Hello%2C+I+just+purchased+{institution.replace(' ', '+')}+{form_name.replace(' ', '+')}+"
        f"on+EduPay.ng.+Order+Ref%3A+{order_ref}"
    )
    content = f"""
      <h2 style="margin:0 0 6px;color:#1A56DB;font-size:22px;">&#127979; School Form Order Confirmed!</h2>
      <p style="color:#475569;margin:0 0 20px;">Hi <strong>{name}</strong>, your school form purchase was successful. Our team will contact you shortly.</p>
      <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border-radius:10px;overflow:hidden;margin-bottom:20px;">
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">Institution</td>
          <td style="padding:12px 16px;font-weight:600;font-size:14px;">{institution}</td>
        </tr>
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">Form Type</td>
          <td style="padding:12px 16px;font-weight:600;font-size:14px;">{form_name}</td>
        </tr>
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">Amount Paid</td>
          <td style="padding:12px 16px;font-weight:700;color:#1A56DB;font-size:16px;">&#8358;{amount:,.2f}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#64748B;font-size:14px;">Order Reference</td>
          <td style="padding:12px 16px;font-family:monospace;font-size:13px;color:#475569;">{order_ref}</td>
        </tr>
      </table>
      <div style="background:#ECFDF5;border-left:4px solid #10B981;padding:16px;border-radius:6px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-weight:700;color:#065F46;font-size:15px;">&#128241; What happens next?</p>
        <p style="margin:0;color:#047857;font-size:14px;">
          Our admin team will contact you on WhatsApp (<strong>{whatsapp_number}</strong>) within 2–4 hours to complete your form purchase and provide further instructions.
        </p>
      </div>
      <p style="color:#475569;font-size:14px;margin-bottom:16px;">You can also reach out to us directly on WhatsApp if you have questions:</p>
      <a href="{wa_link}" style="background:#25D366;color:#fff;padding:12px 28px;border-radius:8px;
        text-decoration:none;display:inline-block;font-weight:700;font-size:15px;">&#128172; Chat on WhatsApp</a>"""
    return _send_smtp(email, f"EduPay — School Form Order Confirmed: {order_ref}", _brand_wrap(content))


def send_admin_form_notification(buyer_name: str, buyer_email: str, buyer_phone: str,
                                  form_name: str, order_ref: str, amount: float,
                                  buyer_whatsapp: str = ""):
    """Admin notification with all buyer info and a direct WhatsApp link to the buyer."""
    admin_email = settings.ADMIN_EMAIL or settings.SMTP_USER
    # Link opens WhatsApp to buyer's number
    wa_number = (buyer_whatsapp or buyer_phone or "").replace("+", "").replace(" ", "").replace("-", "")
    if wa_number.startswith("0"):
        wa_number = "234" + wa_number[1:]
    wa_msg = (
        f"Hello+{buyer_name.replace(' ', '+')}%2C+I%27m+the+EduPay.ng+admin+following+up+on+your+"
        f"school+form+order+(Ref%3A+{order_ref}).+Please+share+your+details+so+we+can+process+your+form."
    )
    wa_link = f"https://wa.me/{wa_number}?text={wa_msg}" if wa_number else "#"

    content = f"""
      <h2 style="margin:0 0 6px;color:#DC2626;font-size:22px;">&#128276; New Form Order — Action Required</h2>
      <p style="color:#475569;margin:0 0 20px;">A customer just purchased a school form. Please contact them on WhatsApp to complete the order.</p>
      <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border-radius:10px;overflow:hidden;margin-bottom:20px;">
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:10px 16px;color:#64748B;font-size:13px;width:130px;">Buyer Name</td>
          <td style="padding:10px 16px;font-weight:700;font-size:14px;">{buyer_name}</td>
        </tr>
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:10px 16px;color:#64748B;font-size:13px;">Email</td>
          <td style="padding:10px 16px;font-size:14px;"><a href="mailto:{buyer_email}" style="color:#1A56DB;">{buyer_email}</a></td>
        </tr>
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:10px 16px;color:#64748B;font-size:13px;">Phone</td>
          <td style="padding:10px 16px;font-size:14px;">{buyer_phone}</td>
        </tr>
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:10px 16px;color:#64748B;font-size:13px;">WhatsApp</td>
          <td style="padding:10px 16px;font-weight:700;font-size:14px;color:#25D366;">{buyer_whatsapp or buyer_phone}</td>
        </tr>
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:10px 16px;color:#64748B;font-size:13px;">Form</td>
          <td style="padding:10px 16px;font-weight:600;font-size:14px;">{form_name}</td>
        </tr>
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:10px 16px;color:#64748B;font-size:13px;">Amount Paid</td>
          <td style="padding:10px 16px;font-weight:700;color:#059669;font-size:16px;">&#8358;{amount:,.2f}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;color:#64748B;font-size:13px;">Order Ref</td>
          <td style="padding:10px 16px;font-family:monospace;font-size:13px;">{order_ref}</td>
        </tr>
      </table>
      <a href="{wa_link}" style="background:#25D366;color:#fff;padding:14px 32px;border-radius:8px;
        text-decoration:none;display:inline-block;font-weight:700;font-size:15px;margin-right:10px;">
        &#128172; Contact Buyer on WhatsApp
      </a>"""
    return _send_smtp(admin_email, f"[EduPay] New Form Order — {order_ref} — Action Required", _brand_wrap(content))


def send_form_completed_email(email: str, name: str, form_name: str, order_ref: str):
    content = f"""
      <h2 style="margin:0 0 6px;color:#059669;font-size:22px;">&#9989; Your Form Order is Ready!</h2>
      <p style="color:#475569;margin:0 0 20px;">Hi <strong>{name}</strong>, your order for <strong>{form_name}</strong> has been fulfilled.</p>
      <p style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px;color:#166534;font-size:14px;">
        <strong>Reference:</strong> {order_ref}<br>
        Please check your WhatsApp for further instructions from our admin team.
      </p>
      <a href="{settings.FRONTEND_URL}/history" style="background:#1A56DB;color:#fff;padding:12px 28px;border-radius:8px;
        text-decoration:none;display:inline-block;font-weight:700;margin-top:16px;">View Order</a>"""
    _send_smtp(email, f"EduPay — Form Order Fulfilled: {order_ref}", _brand_wrap(content))
