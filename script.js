let lineaLectura = new SpeechSynthesisUtterance();
let velocidadActual = 1.0; // Velocidad inicial por defecto

function actualizarNombre() {
    const fileInput = document.getElementById('pdfFile');
    const status = document.getElementById('status');
    if (fileInput.files.length > 0) {
        status.innerText = `Archivo listo: ${fileInput.files[0].name}`;
    }
}

async function procesarYLeer() {
    const fileInput = document.getElementById('pdfFile');
    const status = document.getElementById('status');
    const textArea = document.getElementById('textoExtraido');

    if (fileInput.files.length === 0) {
        alert("Por favor, selecciona un archivo PDF primero.");
        return;
    }

    // Detener cualquier lectura previa antes de empezar
    window.speechSynthesis.cancel();

    status.innerText = "Procesando PDF y extrayendo texto...";
    
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        const response = await fetch("/api/read-pdf", {
            method: "POST",
            body: formData
        });
        
        const data = await response.json();
        textArea.value = data.text;
        status.innerText = "¡Texto extraído con éxito! Iniciando lectura...";

        // Configurar y activar la voz del navegador
        lineaLectura.text = data.text;
        lineaLectura.lang = 'es-ES'; // Idioma español
        lineaLectura.rate = velocidadActual; // Aplicamos la velocidad actual guardada
        
        window.speechSynthesis.speak(lineaLectura);

        lineaLectura.onend = () => {
            status.innerText = "Lectura finalizada.";
        };

    } catch (error) {
        status.innerText = "Hubo un error al procesar el PDF.";
        console.error(error);
    }
}

function cambiarVelocidad() {
    // Ciclo de velocidades: 1x -> 1.25x -> 1.5x -> 1.75x -> 2x -> 1x
    if (velocidadActual >= 2.0) {
        velocidadActual = 1.0;
    } else {
        velocidadActual += 0.25;
    }

    // Actualizar el texto del botón en la pantalla
    document.getElementById('btnVelocidad').innerText = `⚡ Velocidad: ${velocidadActual}x`;

    // Si ya está leyendo en este momento, aplicamos el cambio sobre la marcha
    if (window.speechSynthesis.speaking) {
        const textoRestante = document.getElementById('textoExtraido').value;
        
        // Cancelamos la lectura actual
        window.speechSynthesis.cancel();
        
        // Creamos una nueva instancia con la nueva velocidad para continuar
        lineaLectura = new SpeechSynthesisUtterance(textoRestante);
        lineaLectura.lang = 'es-ES';
        lineaLectura.rate = velocidadActual;
        window.speechSynthesis.speak(lineaLectura);
    }
}

function detenerLectura() {
    window.speechSynthesis.cancel();
    document.getElementById('status').innerText = "Lectura detenida.";
}
