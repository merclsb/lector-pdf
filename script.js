let lineaLectura = new SpeechSynthesisUtterance();
let velocidadActual = 1.0;
let sessionId = ""; 
let pdfActivo = "";
let pdfsLeidos = []; // Array en memoria sincronizado con el backend

document.addEventListener("DOMContentLoaded", inicializarSesion);

// Inicializa la sesión: busca una guardada en este navegador o pide una nueva al servidor
async function inicializarSesion() {
    const savedSession = localStorage.getItem("pdf_session_id");
    
    if (savedSession) {
        try {
            const response = await fetch(`/api/session/${savedSession}`);
            if (response.ok) {
                const data = await response.json();
                establecerSesionLocal(data.session_id, data.data);
                return;
            }
        } catch (e) { console.error("Error validando sesión previa", e); }
    }
    
    // Si no hay o falló, crear una nueva sesión limpia
    await solicitarNuevaSesion();
}

async function solicitarNuevaSesion() {
    try {
        const response = await fetch("/api/session/new");
        const data = await response.json();
        establecerSesionLocal(data.session_id, data.data);
    } catch (e) {
        document.getElementById('status').innerText = "Error crítico al inicializar la sesión en el servidor.";
    }
}

function establecerSesionLocal(id, data) {
    sessionId = id;
    localStorage.setItem("pdf_session_id", id);
    document.getElementById("lblSessionCode").innerText = id;
    
    pdfActivo = data.pdf_activo || "";
    pdfsLeidos = data.leidos || [];
    
    cargarListaPDFs();
    
    // Si la sesión ya venía con un PDF seleccionado, cargar su texto silenciosamente
    if (pdfActivo) {
        recuperarTextoDePdfActivoSinAutoPlay();
    }
}

// Permite conectar otro dispositivo escribiendo el código de 6 letras
async function conectarSesionExistente() {
    const inputCode = document.getElementById("txtSessionInput").value.trim().toUpperCase();
    if (inputCode.length !== 6) {
        alert("El código debe tener exactamente 6 caracteres.");
        return;
    }
    
    try {
        const response = await fetch(`/api/session/${inputCode}`);
        if (response.ok) {
            const data = await response.json();
            window.speechSynthesis.cancel();
            restablecerBotonPausa();
            document.getElementById('textoExtraido').value = "";
            
            establecerSesionLocal(data.session_id, data.data);
            alert("¡Dispositivo sincronizado con éxito!");
        } else {
            alert("Código de sesión no encontrado en el servidor.");
        }
    } catch (e) {
        alert("Error de conexión al intentar sincronizar.");
    }
}

async function enviarProgresoAlServidor() {
    if (!sessionId) return;
    try {
        await fetch(`/api/session/${sessionId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdf_activo: pdfActivo, leidos: pdfsLeidos })
        });
    } catch (e) { console.error("Error guardando progreso remoto", e); }
}

async function cargarListaPDFs() {
    const listaUl = document.getElementById('listaPdfs');
    listaUl.innerHTML = "<li style='color:#666; padding: 10px;'>Cargando archivos...</li>";

    try {
        const response = await fetch(`/api/session/${sessionId}/list`);
        const data = await response.json();
        listaUl.innerHTML = "";

        if (!data.files || data.files.length === 0) {
            listaUl.innerHTML = "<li style='color:#999; font-style:italic; padding: 10px;'>No hay archivos guardados.</li>";
            return;
        }

        data.files.forEach(filename => {
            const li = document.createElement('li');
            const esActivo = (filename === pdfActivo);
            const esLeido = pdfsLeidos.includes(filename);

            let clases = 'pdf-item';
            if (esActivo) clases += ' active-pdf';
            if (esLeido) clases += ' read-pdf-done';
            li.className = clases;
            
            li.innerHTML = `
                <input type="checkbox" class="read-checkbox" ${esLeido ? 'checked' : ''} onclick="alternarEstadoLeido('${filename}', event)">
                <span class="pdf-name" onclick="seleccionarYLeerPDF('${filename}')">
                    ${esActivo ? '📢 ' : ''}${filename}
                </span>
                <button type="button" class="btn-delete" onclick="eliminarPDF('${filename}', event)">🗑️</button>
            `;
            listaUl.appendChild(li);
        });
    } catch (error) {
        listaUl.innerHTML = "<li style='color:red; padding: 10px;'>Error al cargar los archivos remotos.</li>";
    }
}

async function alternarEstadoLeido(filename, event) {
    event.stopPropagation();
    if (event.target.checked) {
        if (!pdfsLeidos.includes(filename)) pdfsLeidos.push(filename);
    } else {
        pdfsLeidos = pdfsLeidos.filter(item => item !== filename);
    }
    await enviarProgresoAlServidor();
    cargarListaPDFs();
}

async function subirYActualizar() {
    const fileInput = document.getElementById('pdfFile');
    const status = document.getElementById('status');
    if (fileInput.files.length === 0) return;

    status.innerText = `Subiendo ${fileInput.files.length} archivo(s)...`;
    const formData = new FormData();
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append("files", fileInput.files[i]);
    }

    try {
        const response = await fetch(`/api/session/${sessionId}/upload`, { method: "POST", body: formData });
        const data = await response.json();
        
        status.innerText = `Subida completada. Procesando archivos...`;
        await cargarListaPDFs();
        
        if (data.uploaded && data.uploaded.length > 0) {
            await seleccionarYLeerPDF(data.uploaded[0]);
        }
    } catch (error) {
        status.innerText = "Error al subir los archivos.";
    }
}

async function seleccionarYLeerPDF(filename) {
    const status = document.getElementById('status');
    const textArea = document.getElementById('textoExtraido');
    
    window.speechSynthesis.cancel();
    restablecerBotonPausa();
    status.innerText = `Cargando: ${filename}...`;
    textArea.value = "";
    
    pdfActivo = filename;
    await enviarProgresoAlServidor();
    await cargarListaPDFs();

    try {
        const response = await fetch(`/api/session/${sessionId}/read/${filename}`);
        const data = await response.json();
        textArea.value = data.text;
        status.innerText = `Listo para escuchar: ${filename}`;
        reproducirTextoActual();
    } catch (error) {
        status.innerText = "Error al recuperar el contenido del PDF.";
    }
}

async function recuperarTextoDePdfActivoSinAutoPlay() {
    const textArea = document.getElementById('textoExtraido');
    try {
        const response = await fetch(`/api/session/${sessionId}/read/${pdfActivo}`);
        const data = await response.json();
        textArea.value = data.text;
        document.getElementById('status').innerText = `Sesión restaurada. Archivo cargado: ${pdfActivo}`;
    } catch (e) { console.error(e); }
}

function reproducirTextoActual() {
    const texto = document.getElementById('textoExtraido').value;
    const status = document.getElementById('status');

    if (!texto || texto.startsWith("El texto del PDF")) {
        alert("Primero selecciona o sube un PDF.");
        return;
    }

    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        document.getElementById('btnPausa').innerText = "⏸️ Pausar";
        status.innerText = `Escuchando: ${pdfActivo}`;
        return;
    }

    window.speechSynthesis.cancel();
    restablecerBotonPausa();

    lineaLectura = new SpeechSynthesisUtterance(texto);
    lineaLectura.lang = 'es-ES';
    lineaLectura.rate = velocidadActual;
    
    window.speechSynthesis.speak(lineaLectura);
    status.innerText = `Escuchando: ${pdfActivo}`;

    lineaLectura.onend = () => {
        status.innerText = `Lectura finalizada de: ${pdfActivo}`;
        restablecerBotonPausa();
        if (!pdfsLeidos.includes(pdfActivo)) {
            pdfsLeidos.push(pdfActivo);
            enviarProgresoAlServidor().then(() => cargarListaPDFs());
        }
    };
}

function alternarPausa() {
    const btnPausa = document.getElementById('btnPausa');
    const status = document.getElementById('status');

    if (!window.speechSynthesis.speaking) return;

    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        btnPausa.innerText = "⏸️ Pausar";
        status.innerText = `Escuchando: ${pdfActivo}`;
    } else {
        window.speechSynthesis.pause();
        btnPausa.innerText = "▶️ Reanudar";
        status.innerText = `Lectura pausada: ${pdfActivo}`;
    }
}

function restablecerBotonPausa() {
    document.getElementById('btnPausa').innerText = "⏸️ Pausar";
}

async function eliminarPDF(filename, event) {
    event.stopPropagation();
    if (!confirm(`¿Estás seguro de que quieres eliminar "${filename}"?`)) return;
    
    if (filename === pdfActivo) {
        window.speechSynthesis.cancel();
        restablecerBotonPausa();
        document.getElementById('textoExtraido').value = "";
        pdfActivo = "";
    }

    pdfsLeidos = pdfsLeidos.filter(item => item !== filename);
    await enviarProgresoAlServidor();

    try {
        await fetch(`/api/session/${sessionId}/delete/${filename}`, { method: 'DELETE' });
        await cargarListaPDFs();
    } catch (error) { console.error(error); }
}

function ajustarVelocidad(valor) {
    velocidadActual = parseFloat(valor);
    document.getElementById('speedValue').innerText = `${velocidadActual.toFixed(1)}x`;
    actualizarVozEnTiempoReal();
}

function modificarVelocidadPaso(cambio) {
    const slider = document.getElementById('speedRange');
    let nuevoValor = parseFloat(slider.value) + cambio;
