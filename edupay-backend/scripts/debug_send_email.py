import logging
logging.basicConfig(level=logging.DEBUG)

from app.services.email_service import send_form_order_buyer_email

if __name__ == '__main__':
    print('Calling send_form_order_buyer_email...')
    ok = send_form_order_buyer_email(
        'devtest@example.com',
        'Dev Tester',
        'Test Form',
        'Test Institution',
        'TEST-REF-DEBUG-001',
        120.0,
        '08012345678'
    )
    print('send_form_order_buyer_email returned:', ok)
