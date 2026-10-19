// listing_new_window.js
document.addEventListener("DOMContentLoaded", function() {
  // --- Abrir listing en nueva ventana ---
  const links = document.querySelectorAll('#listing-slides a, #listing-videos a');
  
  links.forEach(link => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  // --- Inicializar Panzoom en diagramas Mermaid ---
  initMermaidPanzoom();
});

// También reinicializar cuando se cambia de slide (Reveal.js)
if (typeof Reveal !== "undefined") {
  Reveal.on("slidechanged", function() {
    setTimeout(initMermaidPanzoom, 300);
  });
}

function initMermaidPanzoom() {
  document.querySelectorAll('.mermaid svg').forEach(svg => {
    // Evitar inicializar dos veces
    if (svg.dataset.panzoomInitialized) return;
    svg.dataset.panzoomInitialized = "true";

    // Mejorar el contenedor
    const parent = svg.parentElement;
    parent.style.overflow = "hidden";
    parent.style.cursor = "grab";
    parent.style.position = "relative";

    // Quitar restricciones de tamaño que a veces pone Mermaid
    svg.style.maxWidth = "none";
    svg.style.width = "100%";
    svg.style.height = "100%";

    // Inicializar Panzoom
    const panzoom = Panzoom(svg, {
      maxScale: 6,
      minScale: 0.35,
      step: 0.15,
      contain: "outside",
      cursor: "grab"
    });

    // Zoom con la rueda del ratón
    parent.addEventListener("wheel", panzoom.zoomWithWheel);

    // Cursor de agarre
    parent.addEventListener("pointerdown", () => {
      parent.style.cursor = "grabbing";
    });
    parent.addEventListener("pointerup", () => {
      parent.style.cursor = "grab";
    });
  });
}