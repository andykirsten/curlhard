from sqlmodel import Session

from app.models import AppConfig

CONFIG_ID = 1


def get_app_config(db: Session) -> AppConfig:
    """Liefert die Singleton-Zeile (id=1) und legt sie bei Bedarf an."""
    config = db.get(AppConfig, CONFIG_ID)
    if config is None:
        config = AppConfig(id=CONFIG_ID)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config
