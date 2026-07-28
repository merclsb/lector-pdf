let lineaLectura = new SpeechSynthesisUtterance();
let velocidadActual = 1.0;
let pdfActivo = ""; 

document.addEventListener("DOMContentLoaded", cargarListaPDFs);

async function cargarListaPDFs() {
    const listaUl = document.getElementById('listaPdfs');
    listaUl.innerHTML = "<li style='color:#666; padding: 10px;'>Cargando archivos...</li>";
    const leidosGuardados = JSON.parse(localStorage.getItem('pdfsLeidos')) || [];

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
            const esActivo = (filename === pdfActivo);
            const esLeido = leidosGuardados.includes(filename);

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
        listaUl.innerHTML = "<li style='color:red; padding: 10px;'>Error al cargar la lista.</li>";
        console.error(error);
    }
}

function alternarEstadoLeido(filename, event) {
    event.stopPropagation();
    let leidosGuardados = JSON.parse(localStorage.getItem('pdfsLeidos')) || [];
    if (event.target.checked) {
        if (!leidosGuardados.includes(filename)) leidosGuardados.push(filename);
    } else {
        leidosGuardados = leidosGuardados.filter(item => item !== filename);
    }
    localStorage.setItem('pdfsLeidos', JSON.stringify(leidosGuardados));
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
        const response = await fetch("/api/upload-pdfs", { method: "POST", body: formData });
        const data = await response.json();
        if (response.ok) {
            status.innerText = data.message;
            if (data.uploaded && data.uploaded.length > 0) {
                pdfActivo = data.uploaded[0]; // Corrección para tomar el primer elemento string de la lista subida
                await cargarListaPDFs();
                await seleccionarYLeerPDF(data.uploaded[0]);
            } else {
                await cargarListaPDFs();
            }
        } else {
            status.innerText = data.detail || "Error al subir los archivos.";
        }
    } catch (error) {
        status.innerText = "Hubo un error de conexión.";
        console.error(error);
    }
}

async function seleccionarYLeerPDF(filename) {
    const status = document.getElementById('status');
    const textArea = document.getElementById('textoExtraido');
    
    window.speechSynthesis.cancel();
    restablecerBotonPausa(); // Reinicia el botón de pausa al cambiar de PDF
    status.innerText = `Cargando: ${filename}...`;
    textArea.value = "";
    
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

    // Si el motor está pausado actualmente, al darle a "Leer" simplemente reanudamos
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
        marcarComoLeidoAutomatico(pdfActivo);
    };
}

// NUEVA FUNCIÓN: Controla la pausa intermedia de la voz
function alternarPausa() {
    const btnPausa = document.getElementById('btnPausa');
    const status = document.getElementById('status');

    if (!window.speechSynthesis.speaking) return; // Si no hay audio sonando, no hace nada

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

function marcarComoLeidoAutomatico(filename) {
    let leidosGuardados = JSON.parse(localStorage.getItem('pdfsLeidos')) || [];
    if (!leidosGuardados.includes(filename)) {
        leidosGuardados.push(filename);
        localStorage.setItem('pdfsLeidos', JSON.stringify(leidosGuardados));
        cargarListaPDFs();
    }
}

async function eliminarPDF(filename, event) {
    event.stopPropagation();
    if (!confirm(`¿Estás seguro de que quieres eliminar "${filename}"?`)) return;
    
    if (filename === pdfActivo) {
        window.speechSynthesis.cancel();
        restablecerBotonPausa();
        document.getElementById('status').innerText = "Archivo activo eliminado.";
        document.getElementById('textoExtraido').value = "";
        pdfActivo = "";
    }

    let leidosGuardados = JSON.parse(localStorage.getItem('pdfsLeidos')) || [];
    leidosGuardados = leidosGuardados.filter(item => item !== filename);
    localStorage.setItem('pdfsLeidos', JSON.stringify(leidosGuardados));

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
    actualizarVozEnTiempoReal();
}

function modificarVelocidadPaso(cambio) {
    const slider = document.getElementById('speedRange');
    let nuevoValor = parseFloat(slider.value) + cambio;
    if (nuevoValor < 0.5) nuevoValor = 0.5;
    if (nuevoValor > 2.0) nuevoValor = 2.0;
    
    slider.value = nuevoValor;
    velocidadActual = nuevoValor;
    document.getElementById('speedValue').innerText = `${velocidadActual.toFixed(1)}x`;
    actualizarVozEnTiempoReal();
}

function actualizarVozEnTiempoReal() {
    // Si está hablando o pausado, recalculamos para no perder la posición
    if (window.speechSynthesis.speaking) {
        const textoCompleto = document.getElementById('textoExtraido').value;
        window.speechSynthesis.cancel();
        restablecerBotonPausa();
        
        lineaLectura = new SpeechSynthesisUtterance(textoCompleto);
        lineaLectura.lang = 'es-ES';
        lineaLectura.rate = velocidadActual;
        window.speechSynthesis.speak(lineaLectura);
    }
}

function detenerLectura() {
    window.speechSynthesis.cancel();
    restablecerBotonPausa();
    document.getElementById('status').innerText = "Lectura detenida.";
}
