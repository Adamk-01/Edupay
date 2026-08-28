import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

def send_email(to: str, subject: str, html_body: str):
    if settings.ENVIRONMENT == "development":
        print(f"[DEV EMAIL] To: {to} | Subject: {subject}")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.FROM_EMAIL
    msg["To"]      = to
    msg.attach(MIMEText(html_body, "html"))
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to, msg.as_string())

def send_verification_email(email: str, name: str):
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#1A56DB">Welcome to EduPay.ng, {name}!</h2>
      <p>Your account has been created successfully.</p>
      <a href="{settings.FRONTEND_URL}/verify" style="background:#1A56DB;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Verify Email</a>
      <p style="color:#64748B;font-size:13px">If you didn't create this account, ignore this email.</p>
    </div>"""
    send_email(email, "Verify your EduPay.ng account", html)

def send_order_confirmation(email: str, name: str, order_ref: str, product: str):
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#1A56DB">Order Confirmed</h2>
      <p>Hi {name}, your order for <strong>{product}</strong> has been placed.</p>
      <p><strong>Reference:</strong> {order_ref}</p>
      <p>You will receive your PIN/details within 5 minutes.</p>
    </div>"""
    send_email(email, f"EduPay Order Confirmed – {order_ref}", html)
