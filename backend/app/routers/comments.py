# app/routers/comments.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_session
from app import models, schemas

router = APIRouter(prefix="/orders/{order_id}/comments", tags=["comments"])

@router.get("", response_model=list[schemas.CommentOut])
def list_comments(order_id: int, db: Session = Depends(get_session)):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return db.query(models.Comment).filter(models.Comment.order_id == order_id)\
             .order_by(models.Comment.id.desc()).all()

@router.post("", response_model=schemas.CommentOut)
def add_comment(order_id: int, payload: schemas.CommentCreate, db: Session = Depends(get_session)):
    if not db.get(models.Order, order_id):
        raise HTTPException(404, "Order not found")
    c = models.Comment(order_id=order_id, text=payload.text.strip(), author=payload.author)
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.delete("/{comment_id}", status_code=204)
def delete_comment(order_id: int, comment_id: int, db: Session = Depends(get_session)):
    c = db.get(models.Comment, comment_id)
    if not c or c.order_id != order_id:
        raise HTTPException(404, "Comment not found")
    db.delete(c); db.commit()
