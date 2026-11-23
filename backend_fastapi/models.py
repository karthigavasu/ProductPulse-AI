from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class DailyMetric(Base):
    __tablename__ = "daily_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    total_users: Mapped[int] = mapped_column(Integer, nullable=False)
    active_users: Mapped[int] = mapped_column(Integer, nullable=False)
    new_users: Mapped[int] = mapped_column(Integer, nullable=False)
    retained_users: Mapped[int] = mapped_column(Integer, nullable=False)
    retention_rate: Mapped[float] = mapped_column(Float, nullable=False)
    feature_adoption_rate: Mapped[float] = mapped_column(Float, nullable=False)
    csat_score: Mapped[float] = mapped_column(Float, nullable=False)
    engagement_score: Mapped[float] = mapped_column(Float, nullable=False)
    conversion_rate: Mapped[float] = mapped_column(Float, nullable=False)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class FeedbackItem(Base):
    __tablename__ = "feedback_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    customer_segment: Mapped[str] = mapped_column(String(60), default="Mid-Market")
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="New")
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(20), nullable=False)
    sentiment_score: Mapped[float] = mapped_column(Float, nullable=False)
    analysis_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FeatureProposal(Base):
    __tablename__ = "features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reach: Mapped[int] = mapped_column(Integer, nullable=False)
    impact: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False)
    effort: Mapped[float] = mapped_column(Float, nullable=False)
    rice_score: Mapped[float] = mapped_column(Float, nullable=False)
    roadmap_status: Mapped[str] = mapped_column(String(40), default="Backlog")
