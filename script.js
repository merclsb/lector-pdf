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
        lineaLectura.rate = velocidadActual; // Aplicamos la velocidad del slider
        
        window.speechSynthesis.speak(lineaLectura);

        lineaLectura.onend = () => {
            status.innerText = "Lectura finalizada.";
        };

    } catch (error) {
        status.innerText = "Hubo un error al procesar el PDF.";
        console.error(error);
    }
}

function ajustarVelocidad(valor) {
    // Convertimos el valor de la barra a número flotante
    velocidadActual = parseFloat(valor);
    
    // Actualizamos el número visual al lado de la barra (ej: 1.5x)
    document.getElementById('speedValue').innerText = `${velocidadActual.toFixed(1)}x`;

    // Si la app está leyendo en este preciso instante, aplicamos el cambio dinámicamente
    if (window.speechSynthesis.speaking) {
        const textoCompleto = document.getElementById('textoExtraido').value;
        
        // Detener la reproducción actual
        window.speechSynthesis.cancel();
        
        // Crear una nueva instancia para continuar con el mismo texto pero nueva velocidad
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
