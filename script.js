let lineaLectura = new SpeechSynthesisUtterance();
let velocidadActual = 1.0;

document.addEventListener("DOMContentLoaded", cargarListaPDFs);

async function cargarListaPDFs() {
    const listaUl = document.getElementById('listaPdfs');
    listaUl.innerHTML = "<li style='color:#666; padding: 10px;'>Cargando archivos...</li>";

    try {
        const response = await fetch("/api/list-pdfs");
        const data = await response.json();
        listaUl.innerHTML = "";

        if (data.files.length === 0) {
            listaUl.innerHTML = "<li style='color:#999; font-style:italic; padding: 10px;'>No hay archivos guardados.</li>";
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
        listaUl.innerHTML = "<li style='color:red; padding: 10px;'>Error al cargar la lista.</li>";
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
            status.innerText = `¡Subido correctamente!`;
            await cargarListaPDFs();
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
    status.innerText = `Cargando: ${filename}...`;
    textArea.value = "";

    try {
        const response = await fetch(`/api/read-saved-pdf/${filename}`);
        const data = await response.json();
        
        textArea.value = data.text;
        status.innerText = `Listo para escuchar: ${filename}`;
        
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
        alert("Primero selecciona o sube un PDF de la lista.");
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

// Responde a cambios de la barra deslizante (slider)
function ajustarVelocidad(valor) {
    velocidadActual = parseFloat(valor);
    document.getElementById('speedValue').innerText = `${velocidadActual.toFixed(1)}x`;
    actualizarVozEnTiempoReal();
}

// Responde a los clics de los botones + y -
function modificarVelocidadPaso(cambio) {
    const slider = document.getElementById('speedRange');
    let nuevoValor = parseFloat(slider.value) + cambio;
    
    // Restringir que se mantenga entre el mínimo (0.5) y máximo (2.0)
    if (nuevoValor < 0.5) nuevoValor = 0.5;
    if (nuevoValor > 2.0) nuevoValor = 2.0;
    
    slider.value = nuevoValor.toFixed(1);
    velocidadActual = nuevoValor;
    document.getElementById('speedValue').innerText = `${velocidadActual.toFixed(1)}x`;
    actualizarVozEnTiempoReal();
}

// Aplica el cambio de velocidad instantáneamente al motor de audio
function actualizarVozEnTiempoReal() {
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
