from decimal import Decimal
from app.core.database import SessionLocal
from app.models.user import User
from app.models.wallet import Wallet

session = SessionLocal()
try:
    user = session.query(User).filter(User.email == 'buyer@example.com').first()
    if not user:
        print('USER_NOT_FOUND')
    else:
        wallet = session.query(Wallet).filter(Wallet.user_id == user.id).first()
        if not wallet:
            wallet = Wallet(user_id=user.id, balance=Decimal('10000.00'))
            session.add(wallet)
            session.commit()
            print('WALLET_CREATED', str(wallet.balance))
        else:
            wallet.balance = (wallet.balance or Decimal('0')) + Decimal('10000.00')
            session.commit()
            print('WALLET_CREDITED', str(wallet.balance))
finally:
    session.close()
