let lineaLectura = new SpeechSynthesisUtterance();

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
        // Llama a la API de nuestro servidor Python
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
        window.speechSynthesis.speak(lineaLectura);

        lineaLectura.onend = () => {
            status.innerText = "Lectura finalizada.";
        };

    } catch (error) {
        status.innerText = "Hubo un error al procesar el PDF.";
        console.error(error);
    }
}

function detenerLectura() {
    window.speechSynthesis.cancel();
    document.getElementById('status').innerText = "Lectura detenida.";
}
