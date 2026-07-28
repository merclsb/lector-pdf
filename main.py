from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import pypdf
import os
import shutil

app = FastAPI()

# Permitir CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear la carpeta temporal si no existe
UPLOAD_DIR = "temp_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 1. Subir y guardar el PDF temporalmente
@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")
            
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        
        # Guardar el archivo en el disco del servidor
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"message": "Archivo subido correctamente", "filename": file.filename}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": f"Error al subir: {str(e)}"})

# 2. Listar todos los PDFs guardados
@app.get("/api/list-pdfs")
async def list_pdfs():
    try:
        files = os.listdir(UPLOAD_DIR)
        pdf_files = [f for f in files if f.endswith('.pdf')]
        return {"files": pdf_files}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": f"Error al listar: {str(e)}"})

# 3. Leer un PDF específico de la lista
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

# 4. Borrar un PDF específico
@app.delete("/api/delete-pdf/{filename}")
async def delete_pdf(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": f"Archivo {filename} eliminado"}
    raise HTTPException(status_code=404, detail="Archivo no encontrado")

# Servir el HTML principal
@app.get("/")
async def get_index():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")
