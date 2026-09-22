import os
import sys
import smtplib

# Ensure project root is on sys.path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.core.config import settings

print('SMTP host:', settings.SMTP_HOST, 'port:', settings.SMTP_PORT)
print('SMTP user:', settings.SMTP_USER)
try:
    server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
    server.set_debuglevel(1)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
    print('Login succeeded')
    server.quit()
except Exception as e:
    import traceback
    print('SMTP test failed:')
    traceback.print_exc()
    if hasattr(e, 'smtp_code'):
        print('SMTP code:', e.smtp_code)
    if hasattr(e, 'smtp_error'):
        print('SMTP error:', e.smtp_error)
