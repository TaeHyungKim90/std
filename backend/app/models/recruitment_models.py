from __future__ import annotations

from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base
from utils.seoul_time import now_seoul_naive


class ResumeTemplate(Base):
	__tablename__ = "resume_templates"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	name: Mapped[str] = mapped_column(String(200), nullable=False)
	saved_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
	file_path: Mapped[str] = mapped_column(String(500), nullable=False)
	is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
	is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)

	job_postings: Mapped[list[JobPosting]] = relationship("JobPosting", back_populates="resume_template")


class Applicant(Base):
	__tablename__ = "applicants"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	email_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
	password: Mapped[str] = mapped_column(String(255), nullable=False)
	name: Mapped[str] = mapped_column(String(50), nullable=False)
	phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)

	applications: Mapped[list[Application]] = relationship(
		"Application", back_populates="applicant", cascade="all, delete"
	)


class JobPosting(Base):
	__tablename__ = "job_postings"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	title: Mapped[str] = mapped_column(String(100), nullable=False)
	description: Mapped[str] = mapped_column(Text, nullable=False)
	status: Mapped[str | None] = mapped_column(String(20), default="open")
	deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
	author_id: Mapped[str | None] = mapped_column(
		String(50), ForeignKey("users.user_login_id", ondelete="SET NULL")
	)
	resume_template_id: Mapped[int | None] = mapped_column(
		Integer, ForeignKey("resume_templates.id", ondelete="SET NULL"), nullable=True, index=True
	)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)

	applications: Mapped[list[Application]] = relationship(
		"Application", back_populates="job_posting", cascade="all, delete"
	)
	resume_template: Mapped[ResumeTemplate | None] = relationship(
		"ResumeTemplate", back_populates="job_postings"
	)


class Application(Base):
	__tablename__ = "applications"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	job_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("job_postings.id", ondelete="CASCADE"))
	applicant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("applicants.id", ondelete="CASCADE"))
	resume_file_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
	portfolio_file_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
	reference_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
	status: Mapped[str | None] = mapped_column(String(30), default="applied")
	applied_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)

	job_posting: Mapped[JobPosting | None] = relationship("JobPosting", back_populates="applications")
	applicant: Mapped[Applicant | None] = relationship("Applicant", back_populates="applications")
	interviews: Mapped[list[Interview]] = relationship(
		"Interview", back_populates="application", cascade="all, delete"
	)


class Interview(Base):
	__tablename__ = "interviews"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	application_id: Mapped[int | None] = mapped_column(
		Integer, ForeignKey("applications.id", ondelete="CASCADE")
	)
	interviewer_id: Mapped[str | None] = mapped_column(
		String(50), ForeignKey("users.user_login_id", ondelete="SET NULL")
	)
	interview_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
	score: Mapped[int | None] = mapped_column(Integer, nullable=True)
	feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

	application: Mapped[Application | None] = relationship("Application", back_populates="interviews")
