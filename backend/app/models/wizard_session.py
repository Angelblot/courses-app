"""Modèle persistant pour les sessions du wizard de génération de courses."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WizardSession(Base):
    """Session du wizard, conserve le payload utilisateur et les résultats drives.

    ``payload`` et ``drive_results`` sont stockés sous forme de JSON sérialisé
    en TEXT (compatibilité SQLite). Les routes encodent/décodent via
    ``json.dumps``/``json.loads``.
    """

    __tablename__ = "wizard_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    drive_results: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
