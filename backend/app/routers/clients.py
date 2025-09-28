from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_session
from app import models, schemas
router=APIRouter(prefix="/clients",tags=["clients"])
@router.get("")
def list_clients(q:str|None=None,page:int=1,size:int=20,db:Session=Depends(get_session)):
    qs=db.query(models.Client)
    if q: like=f"%{q}%"; qs=qs.filter((models.Client.full_name.ilike(like))|(models.Client.phone.ilike(like)))
    total=qs.count(); rows=qs.order_by(models.Client.id.desc()).offset((page-1)*size).limit(size).all()
    return {"total":total,"rows":rows}
@router.post("", status_code=201)
def create_client(payload: schemas.ClientIn, db:Session=Depends(get_session)):
    c=models.Client(**payload.model_dump()); db.add(c); db.commit(); db.refresh(c); return c
