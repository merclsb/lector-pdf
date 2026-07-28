from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict
import pypdf
import os
import shutil
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_UPLOAD_DIR = "sessions_data"
os.makedirs(BASE_UPLOAD_DIR, exist_ok=True)

# Base de datos virtual en memoria para guardar el progreso de lectura de cada sesión
# Estructura: {"id_sesion": {"pdf_activo": "doc.pdf", "leidos": ["1.pdf", "2.pdf"]}}
db_sesiones: Dict[str, Dict] = {}

class ProgresoUpdate(BaseModel):
    pdf_activo: str
    leidos: List[str]

# 1. Crear una nueva sesión única
@app.get("/api/session/new")
async def create_session():
    # Genera un ID corto de 6 caracteres fácil de copiar entre dispositivos (ej: A1B2C3)
    session_id = uuid.uuid4().hex[:6].upper()
    session_path = os.path.join(BASE_UPLOAD_DIR, session_id)
    os.makedirs(session_path, exist_ok=True)
    
    db_sesiones[session_id] = {"pdf_activo": "", "leidos": []}
    return {"session_id": session_id, "data": db_sesiones[session_id]}

# 2. Validar o recuperar una sesión existente
@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    session_id = session_id.upper().strip()
    session_path = os.path.join(BASE_UPLOAD_DIR, session_id)
    
    if not os.path.exists(session_path):
        raise HTTPException(status_code=404, detail="Código de sesión no válido o expirado")
    
    if session_id not in db_sesiones:
        db_sesiones[session_id] = {"pdf_activo": "", "leidos": []}
        
    return {"session_id": session_id, "data": db_sesiones[session_id]}

# 3. Guardar el progreso actual de la sesión
@app.post("/api/session/{session_id}/progress")
async def save_progress(session_id: str, data: ProgresoUpdate):
    session_id = session_id.upper().strip()
    if session_id not in db_sesiones:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
    db_sesiones[session_id] = {
        "pdf_activo": data.pdf_activo,
        "leidos": data.leidos
    }
    return {"message": "Progreso guardado"}

# 4. Subir múltiples archivos asociados a una sesión
@app.post("/api/session/{session_id}/upload")
async def upload_pdfs_session(session_id: str, files: List[UploadFile] = File(...)):
    session_id = session_id.upper().strip()
    session_path = os.path.join(BASE_UPLOAD_DIR, session_id)
    
    if not os.path.exists(session_path):
        raise HTTPException(status_code=404, detail="Sesión no válida o expirada")
        
    uploaded_files = []
    errors = []
    
    for file in files:
        try:
            if not file.filename or not file.filename.endswith('.pdf'):
                errors.append(f"'{file.filename}' no es un PDF válido")
                continue
                
            file_path = os.path.join(session_path, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            uploaded_files.append(file.filename)
        except Exception as e:
            errors.append(f"Error con '{file.filename}': {str(e)}")
            
    return {"uploaded": uploaded_files, "errors": errors}


# 5. Listar los PDFs de una sesión específica
@app.get("/api/session/{session_id}/list")
async def list_pdfs_session(session_id: str):
    session_id = session_id.upper().strip()
    session_path = os.path.join(BASE_UPLOAD_DIR, session_id)
    
    if not os.path.exists(session_path):
        return {"files": []}
        
    files = os.listdir(session_path)
    return {"files": [f for f in files if f.endswith('.pdf')]}

# 6. Leer un PDF específico de una sesión
@app.get("/api/session/{session_id}/read/{filename}")
async def read_pdf_session(session_id: str, filename: str):
    session_id = session_id.upper().strip()
    file_path = os.path.join(BASE_UPLOAD_DIR, session_id, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
    try:
        pdf_reader = pypdf.PdfReader(file_path)
        text = "".join([page.extract_text() + "\n" for page in pdf_reader.pages if page.extract_text()])
        return {"text": text.strip() if text.strip() else "No se pudo extraer texto."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

# 7. Eliminar un PDF de una sesión
@app.delete("/api/session/{session_id}/delete/{filename}")
async def delete_pdf_session(session_id: str, filename: str):
    session_id = session_id.upper().strip()
    file_path = os.path.join(BASE_UPLOAD_DIR, session_id, filename)
    
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": "Eliminado"}
    raise HTTPException(status_code=404, detail="No encontrado")

@app.get("/")
async def get_index():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")
