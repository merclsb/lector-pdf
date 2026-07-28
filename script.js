let lineaLectura = new SpeechSynthesisUtterance();
let velocidadActual = 1.0;
let pdfActivo = ""; // Guarda el nombre del PDF que se está leyendo actualmente

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
            // Si este archivo es el que está activo, le añadimos la clase CSS especial
            if (filename === pdfActivo) {
                li.className = 'pdf-item active-pdf';
            } else {
                li.className = 'pdf-item';
            }
            
            li.innerHTML = `
                <span class="pdf-name" onclick="seleccionarYLeerPDF('${filename}')" title="Haga clic para cargar y leer">
                    ${filename === pdfActivo ? '📖 ' : ''}${filename}
                </span>
                <button type="button" class="btn-delete" onclick="eliminarPDF('${filename}', event)" title="Eliminar archivo">🗑️</button>
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

    status.innerText = `Subiendo ${fileInput.files.length} archivo(s) al servidor...`;
    
    const formData = new FormData();
    
    // Recorrer todos los archivos seleccionados y agregarlos con la clave "files"
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append("files", fileInput.files[i]);
    }

    try {
        // Apuntamos a la nueva ruta en plural del backend
        const response = await fetch("/api/upload-pdfs", {
            method: "POST",
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            status.innerText = data.message;
            await cargarListaPDFs();
            
            // Si se subieron archivos con éxito, carga el primero de la lista para empezar a leerlo
            if (data.uploaded && data.uploaded.length > 0) {
                await seleccionarYLeerPDF(data.uploaded[0]);
            }
        } else {
            status.innerText = data.detail || "Error al subir los archivos.";
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
    
    // Actualizar el estado global del PDF seleccionado y redibujar la lista lateral
    pdfActivo = filename;
    await cargarListaPDFs();

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
    status.innerText = `Reproduciendo audio de: ${pdfActivo}`;

    lineaLectura.onend = () => {
        status.innerText = "Lectura finalizada.";
    };
}

async function eliminarPDF(filename, event) {
    // Evita que al pulsar la papelera se intente también seleccionar el PDF
    event.stopPropagation();

    if (!confirm(`¿Estás seguro de que quieres eliminar "${filename}"?`)) return;
    
    if (filename === pdfActivo) {
        window.speechSynthesis.cancel();
        document.getElementById('status').innerText = "Archivo activo eliminado.";
        document.getElementById('textoExtraido').value = "";
        pdfActivo = "";
    }

    try {
        await fetch(`/api/delete-pdf/${filename}`, { method: 'DELETE' });
        await cargarListaPDFs();
    } catch (error) {
        console.error("Error al eliminar:", error);
    }
}

// Controla los cambios directos arrastrando la barra
function ajustarVelocidad(valor) {
    velocidadActual = parseFloat(valor);
    document.getElementById('speedValue').innerText = `${velocidadActual.toFixed(1)}x`;
    actualizarVozEnTiempoReal();
}

// Controla de forma robusta los clics en + y -
function modificarVelocidadPaso(cambio) {
    const slider = document.getElementById('speedRange');
    let nuevoValor = parseFloat(slider.value) + cambio;
    
    if (nuevoValor < 0.5) nuevoValor = 0.5;
    if (nuevoValor > 2.0) nuevoValor = 2.0;
    
    // Actualizamos tanto el valor interno del slider como la interfaz
    slider.value = nuevoValor;
    velocidadActual = nuevoValor;
    document.getElementById('speedValue').innerText = `${velocidadActual.toFixed(1)}x`;
    
    actualizarVozEnTiempoReal();
}

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
