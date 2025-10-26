from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_session
from app.deps import ensure_branch_scope, get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _apply_scope(
    qs,
    user: models.User,
    *,
    branch_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    customer_type: Optional[str] = None,
    doc_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    role = user.role
    if role == models.Role.admin:
        pass
    elif role in {models.Role.manager, models.Role.accountant}:
        if user.branch_id:
            qs = qs.filter(models.Order.branch_id == user.branch_id)
    elif role == models.Role.staff:
        qs = qs.filter(models.Order.manager_id == user.id)
    elif role == models.Role.viewer:
        if user.branch_id:
            qs = qs.filter(models.Order.branch_id == user.branch_id)
    else:
        qs = qs.filter(False)

    if branch_id:
        branch_id = ensure_branch_scope(user, branch_id)
        qs = qs.filter(models.Order.branch_id == branch_id)

    if manager_id:
        if role == models.Role.staff and manager_id != user.id:
            raise HTTPException(status_code=403, detail="Manager filter is not allowed")
        qs = qs.filter(models.Order.manager_id == manager_id)

    if customer_type:
        qs = qs.filter(models.Order.customer_type == customer_type)

    if doc_type:
        qs = qs.filter(models.Order.doc_type == doc_type)

    if date_from:
        start_dt = datetime.combine(date_from, datetime.min.time())
        qs = qs.filter(models.Order.created_at >= start_dt)
    if date_to:
        end_dt = datetime.combine(date_to, datetime.min.time()) + timedelta(days=1)
        qs = qs.filter(models.Order.created_at < end_dt)

    return qs


def _fetch_orders(
    db: Session,
    user: models.User,
    filters: Dict[str, Optional[object]],
) -> List[models.Order]:
    base = db.query(models.Order).filter(models.Order.deleted_at.is_(None))
    base = _apply_scope(base, user, **filters)
    return base.all()


@router.get("/summary", response_model=schemas.DashboardSummaryOut)
def dashboard_summary(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    branch_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    customer_type: Optional[str] = None,
    doc_type: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    filters = {
        "branch_id": branch_id,
        "manager_id": manager_id,
        "customer_type": customer_type,
        "doc_type": doc_type,
        "date_from": date_from,
        "date_to": date_to,
    }
    orders = _fetch_orders(db, current_user, filters)

    completed_states = {models.OrderStatus.tayyor, models.OrderStatus.topshirildi}
    today = date.today()

    orders_total = len(orders)
    orders_completed = sum(1 for o in orders if o.status in completed_states)
    orders_in_progress = sum(1 for o in orders if o.status not in completed_states)
    orders_overdue = sum(
        1
        for o in orders
        if o.deadline and o.deadline < today and o.status not in completed_states
    )

    order_ids = [o.id for o in orders]

    payments_sum = 0.0
    if order_ids:
        pay_query = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(
            models.Payment.order_id.in_(order_ids)
        )
        if date_from:
            pay_query = pay_query.filter(models.Payment.paid_at >= date_from)
        if date_to:
            pay_query = pay_query.filter(models.Payment.paid_at <= date_to)
        payments_sum = float(pay_query.scalar() or 0)

    payments_debt = 0.0
    for o in orders:
        total_amount = float(o.total_amount or 0)
        paid_amount = float(o.paid_amount or 0)
        balance = total_amount - paid_amount
        if balance > 0:
            payments_debt += balance

    files_pending = 0
    files_rejected = 0
    if order_ids:
        files_pending = (
            db.query(func.count(models.Attachment.id))
            .filter(
                models.Attachment.order_id.in_(order_ids),
                models.Attachment.status == models.AttachmentStatus.pending_review,
            )
            .scalar()
            or 0
        )
        files_rejected = (
            db.query(func.count(models.Attachment.id))
            .filter(
                models.Attachment.order_id.in_(order_ids),
                models.Attachment.status == models.AttachmentStatus.rejected,
            )
            .scalar()
            or 0
        )

    return schemas.DashboardSummaryOut(
        orders_total=orders_total,
        orders_in_progress=orders_in_progress,
        orders_completed=orders_completed,
        orders_overdue=orders_overdue,
        payments_sum=round(payments_sum, 2),
        payments_debt=round(payments_debt, 2),
        files_pending=int(files_pending),
        files_rejected=int(files_rejected),
    )


def _bucket_for(dt: datetime | None, group_by: str) -> str:
    if not dt:
        return "Unknown"
    if group_by == "week":
        return f"{dt.isocalendar().year}-W{dt.isocalendar().week:02d}"
    if group_by == "month":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m-%d")


@router.get("/timeline", response_model=List[schemas.DashboardTimelinePoint])
def dashboard_timeline(
    group_by: str = "day",
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    branch_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    customer_type: Optional[str] = None,
    doc_type: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    if group_by not in {"day", "week", "month"}:
        group_by = "day"

    filters = {
        "branch_id": branch_id,
        "manager_id": manager_id,
        "customer_type": customer_type,
        "doc_type": doc_type,
        "date_from": date_from,
        "date_to": date_to,
    }

    orders = _fetch_orders(db, current_user, filters)
    buckets: Dict[str, Dict[str, float]] = defaultdict(lambda: {"orders": 0, "payments": 0.0})

    for o in orders:
        bucket = _bucket_for(o.created_at, group_by)
        buckets[bucket]["orders"] += 1

    order_ids = [o.id for o in orders]
    if order_ids:
        pay_query = db.query(models.Payment).filter(models.Payment.order_id.in_(order_ids))
        if date_from:
            pay_query = pay_query.filter(models.Payment.paid_at >= date_from)
        if date_to:
            pay_query = pay_query.filter(models.Payment.paid_at <= date_to)
        for payment in pay_query.all():
            bucket = _bucket_for(
                datetime.combine(payment.paid_at, datetime.min.time()) if payment.paid_at else None,
                group_by,
            )
            buckets[bucket]["payments"] += float(payment.amount or 0)

    timeline = [
        schemas.DashboardTimelinePoint(bucket=key, orders=int(val["orders"]), payments=round(val["payments"], 2))
        for key, val in buckets.items()
    ]
    timeline.sort(key=lambda item: item.bucket)
    return timeline


@router.get("/top")
def dashboard_top(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    branch_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    customer_type: Optional[str] = None,
    doc_type: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    filters = {
        "branch_id": branch_id,
        "manager_id": manager_id,
        "customer_type": customer_type,
        "doc_type": doc_type,
        "date_from": date_from,
        "date_to": date_to,
    }
    orders = _fetch_orders(db, current_user, filters)

    doc_counter: Counter[str] = Counter()
    type_counter: Counter[str] = Counter()

    for o in orders:
        label = (o.doc_type or "Unknown").strip() or "Unknown"
        doc_counter[label] += 1
        cust = getattr(o.customer_type, "value", None) or "Unknown"
        type_counter[cust] += 1

    top_doc_types = [
        {"label": label, "value": count}
        for label, count in doc_counter.most_common(5)
    ]
    top_customer_types = [
        {"label": label, "value": count}
        for label, count in type_counter.most_common(5)
    ]

    return {"doc_types": top_doc_types, "customer_types": top_customer_types}


@router.get("/activity", response_model=List[schemas.AuditLogOut])
def dashboard_activity(
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    logs_query = (
        db.query(models.AuditLog, models.User.full_name)
        .outerjoin(models.User, models.AuditLog.user_id == models.User.id)
        .order_by(models.AuditLog.created_at.desc())
    )

    if current_user.role != models.Role.admin:
        conditions = []
        if current_user.branch_id:
            conditions.append(models.AuditLog.branch_id == current_user.branch_id)
        conditions.append(models.AuditLog.user_id == current_user.id)
        logs_query = logs_query.filter(or_(*conditions))

    rows = logs_query.limit(10).all()
    result: List[schemas.AuditLogOut] = []
    for log, full_name in rows:
        result.append(
            schemas.AuditLogOut(
                id=log.id,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                details=log.details,
                created_at=log.created_at,
                user_name=full_name,
            )
        )
    return result


@router.get("/filters")
def dashboard_filters(
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == models.Role.admin:
        branches = db.query(models.Branch).order_by(models.Branch.name).all()
    else:
        branches = (
            db.query(models.Branch)
            .filter(models.Branch.id == current_user.branch_id)
            .all()
            if current_user.branch_id
            else []
        )

    managers_q = db.query(models.User).filter(models.User.is_active.is_(True))
    if current_user.role != models.Role.admin:
        if current_user.branch_id:
            managers_q = managers_q.filter(models.User.branch_id == current_user.branch_id)
    managers = managers_q.order_by(models.User.full_name).all()

    orders = _fetch_orders(db, current_user, {
        "branch_id": current_user.branch_id if current_user.role != models.Role.admin else None,
        "manager_id": None,
        "customer_type": None,
        "doc_type": None,
        "date_from": None,
        "date_to": None,
    })

    doc_types = sorted({(o.doc_type or "").strip() for o in orders if o.doc_type})
    customer_types = [ct.value for ct in models.CustomerType]

    return {
        "branches": [
            {"id": b.id, "name": b.name}
            for b in branches
        ],
        "managers": [
            {
                "id": u.id,
                "name": u.full_name,
                "role": u.role.value,
                "branch_id": u.branch_id,
            }
            for u in managers
        ],
        "doc_types": doc_types,
        "customer_types": customer_types,
    }
