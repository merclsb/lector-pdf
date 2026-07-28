from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List
import pypdf
import os
import shutil

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Subir múltiples archivos directamente
@app.post("/api/upload-pdfs")
async def upload_pdfs(files: List[UploadFile] = File(...)):
    uploaded_files = []
    errors = []
    
    for file in files:
        try:
            if not file.filename or not file.filename.endswith('.pdf'):
                errors.append(f"'{file.filename}' no es un PDF válido")
                continue
                
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            uploaded_files.append(file.filename)
        except Exception as e:
            errors.append(f"Error con '{file.filename}': {str(e)}")
            
    return {
        "message": f"Se procesaron {len(uploaded_files)} archivos correctamente.",
        "uploaded": uploaded_files,
        "errors": errors
    }

# Listar todos los PDFs guardados
@app.get("/api/list-pdfs")
async def list_pdfs():
    try:
        files = os.listdir(UPLOAD_DIR)
        pdf_files = [f for f in files if f.endswith('.pdf')]
        return {"files": pdf_files}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": f"Error al listar: {str(e)}"})

# Leer un PDF específico de la lista
@app.get("/api/read-saved-pdf/{filename}")
async def read_saved_pdf(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
    try:
        pdf_reader = pypdf.PdfReader(file_path)
        text = ""
        for page in pdf_reader.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
                
        return {"text": text.strip() if text.strip() else "No se pudo extraer texto."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": f"Error al leer: {str(e)}"})

# Borrar un PDF específico
@app.delete("/api/delete-pdf/{filename}")
async def delete_pdf(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": f"Archivo {filename} eliminado"}
    raise HTTPException(status_code=404, detail="Archivo no encontrado")

@app.get("/")
async def get_index():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")
