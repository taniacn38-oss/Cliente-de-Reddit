// Clave para guardar los carriles en localStorage
const CLAVE_ALMACENAMIENTO = "cliente_reddit_carriles_v1";

// Seleccionamos los elementos principales del DOM
const formulario = document.getElementById("formulario-agregar");
const entradaSubreddit = document.getElementById("entrada-subreddit");
const contenedorCarriles = document.getElementById("contenedor-carriles");
const mensajeEstado = document.getElementById("mensaje-estado");

// Lista en memoria con los nombres de los subreddits activos
let listaSubreddits = [];

// Muestra mensajes claros al usuario (errores o avisos)
function mostrarMensaje(texto, tipo = "info") {
  mensajeEstado.textContent = texto;
  mensajeEstado.className = `mensaje-estado ${tipo}`;
}

// Limpia el nombre escrito para quitar espacios o el prefijo "r/"
function limpiarNombreSubreddit(nombreCrudo) {
  return nombreCrudo
    .trim()
    .replace(/^\/?r\//i, "")
    .replace(/\s+/g, "");
}

// Guarda la lista actual de subreddits en localStorage
function guardarCarriles() {
  localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(listaSubreddits));
}

// Recupera los subreddits guardados en localStorage al recargar
function cargarCarrilesGuardados() {
  const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
  if (!guardado) return [];

  try {
    const datos = JSON.parse(guardado);
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    console.error("Error al leer localStorage:", error);
    return [];
  }
}

// Consulta el feed JSON de Reddit y valida que el subreddit exista
async function obtenerPublicaciones(subreddit) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}.json?limit=15`;
  const respuesta = await fetch(url);

  // Si Reddit responde 404 u otro fallo HTTP, lanzamos un error claro
  if (!respuesta.ok) {
    if (respuesta.status === 404) {
      throw new Error(`El subreddit "r/${subreddit}" no existe.`);
    }
    throw new Error(
      `No se pudo cargar "r/${subreddit}" (error ${respuesta.status}).`,
    );
  }

  const datosJson = await respuesta.json();

  // Validamos que la respuesta tenga la estructura real de publicaciones
  if (
    !datosJson ||
    !datosJson.data ||
    !Array.isArray(datosJson.data.children)
  ) {
    throw new Error(`El subreddit "r/${subreddit}" no existe o no es público.`);
  }

  // Extraemos título, autor, votos y enlace de cada publicación
  const publicaciones = datosJson.data.children
    .map((hijo) => hijo.data)
    .filter((pub) => pub && pub.title)
    .map((pub) => ({
      id: pub.id,
      titulo: pub.title,
      autor: pub.author || "desconocido",
      votos: typeof pub.ups === "number" ? pub.ups : 0,
      enlace: pub.permalink ? `https://www.reddit.com${pub.permalink}` : "#",
    }));

  if (publicaciones.length === 0) {
    throw new Error(
      `El subreddit "r/${subreddit}" no existe o no tiene publicaciones disponibles.`,
    );
  }

  return publicaciones;
}

// Dibuja la lista de publicaciones dentro de un carril
function mostrarPublicacionesEnCarril(elementoCarril, publicaciones) {
  const cuerpoCarril = elementoCarril.querySelector(".cuerpo-carril");
  const listaUl = document.createElement("ul");
  listaUl.className = "lista-publicaciones";

  publicaciones.forEach((pub) => {
    const itemLi = document.createElement("li");
    itemLi.className = "item-publicacion";

    const cajaVotos = document.createElement("div");
    cajaVotos.className = "votos-publicacion";
    cajaVotos.textContent = `▲ ${pub.votos}`;

    const cajaContenido = document.createElement("div");
    cajaContenido.className = "contenido-publicacion";

    const enlaceTitulo = document.createElement("a");
    enlaceTitulo.className = "titulo-publicacion";
    enlaceTitulo.href = pub.enlace;
    enlaceTitulo.target = "_blank";
    enlaceTitulo.rel = "noopener noreferrer";
    enlaceTitulo.textContent = pub.titulo;

    const textoAutor = document.createElement("p");
    textoAutor.className = "autor-publicacion";
    textoAutor.textContent = `Publicado por u/${pub.autor}`;

    cajaContenido.appendChild(enlaceTitulo);
    cajaContenido.appendChild(textoAutor);

    itemLi.appendChild(cajaVotos);
    itemLi.appendChild(cajaContenido);
    listaUl.appendChild(itemLi);
  });

  cuerpoCarril.innerHTML = "";
  cuerpoCarril.appendChild(listaUl);
}

// Muestra estado de carga dentro del carril
function ponerCarrilCargando(elementoCarril, subreddit) {
  const cuerpoCarril = elementoCarril.querySelector(".cuerpo-carril");
  cuerpoCarril.innerHTML = `<div class="estado-carril cargando">Cargando publicaciones de r/${subreddit}...</div>`;
}

// Muestra estado de error claro dentro del carril
function ponerCarrilError(elementoCarril, mensajeError) {
  const cuerpoCarril = elementoCarril.querySelector(".cuerpo-carril");
  cuerpoCarril.innerHTML = `<div class="estado-carril error">⚠️ ${mensajeError}</div>`;
}

// Carga o actualiza las publicaciones de un carril
async function cargarDatosCarril(elementoCarril, subreddit) {
  ponerCarrilCargando(elementoCarril, subreddit);
  try {
    const publicaciones = await obtenerPublicaciones(subreddit);
    mostrarPublicacionesEnCarril(elementoCarril, publicaciones);
  } catch (error) {
    ponerCarrilError(elementoCarril, error.message);
  }
}

// Elimina un carril de la pantalla y de localStorage
function eliminarCarril(subreddit, elementoCarril) {
  listaSubreddits = listaSubreddits.filter(
    (item) => item.toLowerCase() !== subreddit.toLowerCase(),
  );
  guardarCarriles();
  elementoCarril.remove();
  actualizarEstadoVacio();
  mostrarMensaje(`Se eliminó el carril r/${subreddit}.`, "info");
}

// Muestra u oculta el mensaje cuando no hay carriles abiertos
function actualizarEstadoVacio() {
  const mensajeVacioExistente =
    contenedorCarriles.querySelector(".estado-vacio");
  if (listaSubreddits.length === 0 && !mensajeVacioExistente) {
    const divVacio = document.createElement("div");
    divVacio.className = "estado-vacio";
    divVacio.textContent =
      "No hay carriles activos. Escribe un subreddit arriba para comenzar.";
    contenedorCarriles.appendChild(divVacio);
  } else if (listaSubreddits.length > 0 && mensajeVacioExistente) {
    mensajeVacioExistente.remove();
  }
}

// Crea la tarjeta HTML de un nuevo carril
function crearElementoCarril(subreddit) {
  const articulo = document.createElement("article");
  articulo.className = "carril";
  articulo.dataset.subreddit = subreddit;

  articulo.innerHTML = `
        <div class="cabecera-carril">
            <h2 class="titulo-carril">r/${subreddit}</h2>
            <div class="acciones-carril">
                <button type="button" class="boton-carril boton-actualizar" title="Actualizar">↻</button>
                <button type="button" class="boton-carril boton-eliminar" title="Eliminar carril">✕</button>
            </div>
        </div>
        <div class="cuerpo-carril"></div>
    `;

  const botonActualizar = articulo.querySelector(".boton-actualizar");
  const botonEliminar = articulo.querySelector(".boton-eliminar");

  botonActualizar.addEventListener("click", () => {
    cargarDatosCarril(articulo, subreddit);
  });

  botonEliminar.addEventListener("click", () => {
    eliminarCarril(subreddit, articulo);
  });

  return articulo;
}

// Evento al enviar el formulario para agregar un subreddit
formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const subreddit = limpiarNombreSubreddit(entradaSubreddit.value);
  if (!subreddit) {
    mostrarMensaje("Por favor escribe un nombre de subreddit válido.", "error");
    return;
  }

  const yaExiste = listaSubreddits.some(
    (item) => item.toLowerCase() === subreddit.toLowerCase(),
  );
  if (yaExiste) {
    mostrarMensaje(`El carril "r/${subreddit}" ya está agregado.`, "error");
    return;
  }

  mostrarMensaje(`Validando y cargando r/${subreddit}...`, "info");

  const elementoCarril = crearElementoCarril(subreddit);
  actualizarEstadoVacio();
  contenedorCarriles.appendChild(elementoCarril);
  ponerCarrilCargando(elementoCarril, subreddit);

  try {
    const publicaciones = await obtenerPublicaciones(subreddit);
    mostrarPublicacionesEnCarril(elementoCarril, publicaciones);

    // Solo se guarda en localStorage si el subreddit sí existe
    listaSubreddits.push(subreddit);
    guardarCarriles();
    entradaSubreddit.value = "";
    mostrarMensaje(`Carril r/${subreddit} agregado correctamente.`, "info");
  } catch (error) {
    // Muestra error claro y retira el carril inválido
    ponerCarrilError(elementoCarril, error.message);
    mostrarMensaje(error.message, "error");
    setTimeout(() => {
      elementoCarril.remove();
      actualizarEstadoVacio();
    }, 1800);
  }
});

// Función inicial al abrir o recargar la página
function iniciarAplicacion() {
  listaSubreddits = cargarCarrilesGuardados();
  actualizarEstadoVacio();

  listaSubreddits.forEach((subreddit) => {
    const elementoCarril = crearElementoCarril(subreddit);
    contenedorCarriles.appendChild(elementoCarril);
    cargarDatosCarril(elementoCarril, subreddit);
  });
}

iniciarAplicacion();
