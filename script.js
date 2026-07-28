let lineaLectura = new SpeechSynthesisUtterance();
let velocidadActual = 1.0;

// Cargar la lista de PDFs guardados en cuanto se abra la página
document.addEventListener("DOMContentLoaded", cargarListaPDFs);

async function cargarListaPDFs() {
    const listaUl = document.getElementById('listaPdfs');
    listaUl.innerHTML = "<li style='color:#666;'>Cargando archivos...</li>";

    try {
        const response = await fetch("/api/list-pdfs");
        const data = await response.json();
        listaUl.innerHTML = "";

        if (data.files.length === 0) {
            listaUl.innerHTML = "<li style='color:#999; font-style:italic;'>No hay archivos guardados.</li>";
            return;
        }

        data.files.forEach(filename => {
            const li = document.createElement('li');
            li.className = 'pdf-item';
            
            li.innerHTML = `
                <span class="pdf-name" onclick="seleccionarYLeerPDF('${filename}')" title="Haga clic para cargar y leer">${filename}</span>
                <button class="btn-delete" onclick="eliminarPDF('${filename}')" title="Eliminar archivo">🗑️</button>
            `;
            listaUl.appendChild(li);
        });
    } catch (error) {
        listaUl.innerHTML = "<li style='color:red;'>Error al cargar la lista.</li>";
        console.error(error);
    }
}

async function subirYActualizar() {
    const fileInput = document.getElementById('pdfFile');
    const status = document.getElementById('status');

    if (fileInput.files.length === 0) return;

    status.innerText = "Subiendo archivo al servidor...";
    
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        const response = await fetch("/api/upload-pdf", {
            method: "POST",
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            status.innerText = `¡"${data.filename}" subido correctamente!`;
            // Recargar la lista lateral para ver el nuevo archivo
            await cargarListaPDFs();
            // Cargar automáticamente su texto en pantalla
            await seleccionarYLeerPDF(data.filename);
        } else {
            status.innerText = data.detail || "Error al subir el archivo.";
        }
    } catch (error) {
        status.innerText = "Hubo un error de conexión con el servidor.";
        console.error(error);
    }
}

async function seleccionarYLeerPDF(filename) {
    const status = document.getElementById('status');
    const textArea = document.getElementById('textoExtraido');
    
    window.speechSynthesis.cancel();
    status.innerText = `Cargando texto de: ${filename}...`;
    textArea.value = "";

    try {
        const response = await fetch(`/api/read-saved-pdf/${filename}`);
        const data = await response.json();
        
        textArea.value = data.text;
        status.innerText = `Visualizando: ${filename}. Listo para escuchar.`;
        
        // Auto-reproducir tras seleccionarlo
        reproducirTextoActual();
    } catch (error) {
        status.innerText = "Error al recuperar el contenido del PDF.";
        console.error(error);
    }
}

function reproducirTextoActual() {
    const texto = document.getElementById('textoExtraido').value;
    const status = document.getElementById('status');

    if (!texto || texto.startsWith("El texto del PDF")) {
        alert("Primero selecciona o sube un PDF de la lista lateral.");
        return;
    }

    window.speechSynthesis.cancel();

    lineaLectura = new SpeechSynthesisUtterance(texto);
    lineaLectura.lang = 'es-ES';
    lineaLectura.rate = velocidadActual;
    
    window.speechSynthesis.speak(lineaLectura);
    status.innerText = "Reproduciendo audio...";

    lineaLectura.onend = () => {
        status.innerText = "Lectura finalizada.";
    };
}

async function eliminarPDF(filename) {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${filename}"?`)) return;
    
    // Si borramos el archivo que se está leyendo actualmente, paramos la voz
    window.speechSynthesis.cancel();
    document.getElementById('status').innerText = "Archivo eliminado.";
    document.getElementById('textoExtraido').value = "";

    try {
        await fetch(`/api/delete-pdf/${filename}`, { method: 'DELETE' });
        await cargarListaPDFs();
    } catch (error) {
        console.error("Error al eliminar:", error);
    }
}

function ajustarVelocidad(valor) {
    velocidadActual = parseFloat(valor);
    document.getElementById('speedValue').innerText = `${velocidadActual.toFixed(1)}x`;

    if (window.speechSynthesis.speaking) {
        const textoCompleto = document.getElementById('textoExtraido').value;
        window.speechSynthesis.cancel();
        
        lineaLectura = new SpeechSynthesisUtterance(textoCompleto);
        lineaLectura.lang = 'es-ES';
        lineaLectura.rate = velocidadActual;
        
        window.speechSynthesis.speak(lineaLectura);
    }
}

function detenerLectura() {
    window.speechSynthesis.cancel();
    document.getElementById('status').innerText = "Lectura detenida.";
}
