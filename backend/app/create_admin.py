"""Legt den ersten Admin an: python -m app.create_admin EMAIL PASSWORT [ANZEIGENAME]"""

import sys

from sqlmodel import Session, select

from app.models import User
from app.services.auth import hash_password


def create_admin(db: Session, email: str, password: str, display_name: str = "Admin") -> User:
    if len(password) < 10:
        raise ValueError("Passwort muss mindestens 10 Zeichen lang sein")
    email = email.lower()
    existing = db.exec(select(User).where(User.email == email)).first()
    if existing:
        raise ValueError("E-Mail existiert bereits")
    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def main() -> None:
    from app.config import get_settings
    from app.db import make_engine

    if len(sys.argv) < 3:
        sys.exit("Aufruf: python -m app.create_admin EMAIL PASSWORT [ANZEIGENAME]")
    engine = make_engine(get_settings().database_url)
    with Session(engine) as db:
        user = create_admin(db, sys.argv[1], sys.argv[2], *(sys.argv[3:4]))
    print(f"Admin angelegt: {user.email}")


if __name__ == "__main__":
    main()
