from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import pypdf
import io
import os

app = FastAPI()

# Permitir que el frontend se comunique con el backend sin bloqueos de seguridad
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/read-pdf")
async def read_pdf(file: UploadFile = File(...)):
    try:
        # Leer el archivo PDF en memoria
        content = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(content))
        
        # Extraer el texto de todas las páginas
        text = ""
        for page in pdf_reader.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
        
        # Si no se detecta texto, enviar un aviso
        if not text.strip():
            return {"text": "No se pudo extraer texto. Verifica si es un PDF escaneado."}
            
        return {"text": text.strip()}
    except Exception as e:
        return {"text": f"Error al procesar el archivo: {str(e)}"}

# Servir el archivo HTML principal
@app.get("/")
async def get_index():
    return FileResponse("index.html")

# Servir archivos estáticos (como el script.js)
app.mount("/", StaticFiles(directory="."), name="static")
