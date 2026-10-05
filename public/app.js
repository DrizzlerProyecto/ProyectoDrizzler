// ==========================================================================
// CLIENTE JAVASCRIPT - SISTEMA DE GESTIÓN DE CAJAS (SOLES S/.)
// RED NEON & BLACK LIGHTNING EDITION (SIN ÍCONOS)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Estado Global del Filtro y Carpetas
  let currentFiltro = 'todo';
  let fechaDesdeVal = null;
  let fechaHastaVal = null;
  let currentCarpetaId = null;
  let carpetasLista = [];

  // Elementos DOM - Tarjetas Resumen
  const totalBrutoEl = document.getElementById('totalBruto');
  const deduccion5El = document.getElementById('deduccion5');
  const totalNetoEl = document.getElementById('totalNeto');
  const filterIndicatorEl = document.getElementById('filterIndicator');
  const recordCountEl = document.getElementById('recordCount');

  // Elementos DOM - Estado Servidor / BD
  const dbStatusBadge = document.getElementById('dbStatusBadge');
  const dbStatusText = document.getElementById('dbStatusText');

  // Elementos DOM - Formulario e Ingresos
  const ingresoForm = document.getElementById('ingresoForm');
  const montoInput = document.getElementById('montoInput');
  const descripcionInput = document.getElementById('descripcionInput');
  const categoriaSelect = document.getElementById('categoriaSelect');
  const fechaInput = document.getElementById('fechaInput');
  const carpetaSelect = document.getElementById('carpetaSelect');

  // Elementos DOM - Filtros y Tabla
  const filterButtons = document.querySelectorAll('.btn-filter');
  const customRangeForm = document.getElementById('customRangeForm');
  const fechaDesdeInput = document.getElementById('fechaDesde');
  const fechaHastaInput = document.getElementById('fechaHasta');
  const ingresosTableBody = document.getElementById('ingresosTableBody');
  const emptyState = document.getElementById('emptyState');

  // Elementos DOM - Módulo de Carpetas
  const openCrearCarpetaBtn = document.getElementById('openCrearCarpetaBtn');
  const crearCarpetaModalOverlay = document.getElementById('crearCarpetaModalOverlay');
  const closeCrearCarpetaModalBtn = document.getElementById('closeCrearCarpetaModalBtn');
  const cancelCrearCarpetaBtn = document.getElementById('cancelCrearCarpetaBtn');
  const crearCarpetaForm = document.getElementById('crearCarpetaForm');
  const nombreCarpetaInput = document.getElementById('nombreCarpetaInput');
  const descripcionCarpetaInput = document.getElementById('descripcionCarpetaInput');

  const openTodasCarpetasBtn = document.getElementById('openTodasCarpetasBtn');
  const todasCarpetasModalOverlay = document.getElementById('todasCarpetasModalOverlay');
  const closeTodasCarpetasModalBtn = document.getElementById('closeTodasCarpetasModalBtn');
  const todasCarpetasGrid = document.getElementById('todasCarpetasGrid');
  const emptyCarpetasState = document.getElementById('emptyCarpetasState');
  const clearCarpetaFilterBtn = document.getElementById('clearCarpetaFilterBtn');

  // Inicializar fecha actual por defecto en el formulario
  setFormDefaultDate();

  // Cargar datos iniciales
  cargarIngresos();
  cargarPerfil();
  cargarCarpetas();

  // -------------------------------------------------------------
  // LÓGICA DE PERFIL DE USUARIO Y CAMBIO DE FOTO
  // -------------------------------------------------------------
  const headerAvatarBox = document.getElementById('headerAvatarBox');
  const headerUserInfo = document.getElementById('headerUserInfo');
  const profileModalOverlay = document.getElementById('profileModalOverlay');
  const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
  const cancelProfileBtn = document.getElementById('cancelProfileBtn');
  const profileForm = document.getElementById('profileForm');
  const profileNameInput = document.getElementById('profileNameInput');
  const avatarFileInput = document.getElementById('avatarFileInput');
  const btnSelectPhoto = document.getElementById('btnSelectPhoto');
  const triggerFileSelect = document.getElementById('triggerFileSelect');

  const headerAvatarImg = document.getElementById('headerAvatarImg');
  const headerAvatarFallback = document.getElementById('headerAvatarFallback');
  const headerUserName = document.getElementById('headerUserName');

  const modalAvatarPreview = document.getElementById('modalAvatarPreview');
  const modalAvatarFallback = document.getElementById('modalAvatarFallback');

  let currentAvatarBase64 = '';

  async function cargarPerfil() {
    try {
      const res = await fetch('/api/perfil');
      const data = await res.json();
      if (res.ok && data.perfil) {
        aplicarPerfilEnUI(data.perfil);
      }
    } catch (e) {
      console.error('Error cargando perfil:', e);
    }
  }

  function aplicarPerfilEnUI(perfil) {
    const nombre = perfil.nombre || 'Administrador de Caja';
    const initial = nombre.charAt(0).toUpperCase() || 'U';

    headerUserName.textContent = nombre;
    headerAvatarFallback.textContent = initial;

    profileNameInput.value = nombre;
    modalAvatarFallback.textContent = initial;

    if (perfil.avatar_url && perfil.avatar_url.trim() !== '') {
      currentAvatarBase64 = perfil.avatar_url;

      headerAvatarImg.src = perfil.avatar_url;
      headerAvatarImg.classList.remove('hidden');
      headerAvatarFallback.classList.add('hidden');

      modalAvatarPreview.src = perfil.avatar_url;
      modalAvatarPreview.classList.remove('hidden');
      modalAvatarFallback.classList.add('hidden');
    } else {
      currentAvatarBase64 = '';

      headerAvatarImg.classList.add('hidden');
      headerAvatarFallback.classList.remove('hidden');

      modalAvatarPreview.classList.add('hidden');
      modalAvatarFallback.classList.remove('hidden');
    }
  }

  if (headerAvatarBox) {
    headerAvatarBox.addEventListener('click', () => {
      profileModalOverlay.classList.add('active');
      avatarFileInput.click();
    });
  }

  if (headerUserInfo) {
    headerUserInfo.addEventListener('click', () => {
      profileModalOverlay.classList.add('active');
    });
  }

  function cerrarModalPerfil() {
    profileModalOverlay.classList.remove('active');
  }

  closeProfileModalBtn.addEventListener('click', cerrarModalPerfil);
  cancelProfileBtn.addEventListener('click', cerrarModalPerfil);
  profileModalOverlay.addEventListener('click', (e) => {
    if (e.target === profileModalOverlay) cerrarModalPerfil();
  });

  btnSelectPhoto.addEventListener('click', () => avatarFileInput.click());
  triggerFileSelect.addEventListener('click', () => avatarFileInput.click());

  avatarFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxDim) {
            h *= maxDim / w;
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w *= maxDim / h;
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        currentAvatarBase64 = resizedBase64;

        modalAvatarPreview.src = resizedBase64;
        modalAvatarPreview.classList.remove('hidden');
        modalAvatarFallback.classList.add('hidden');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = profileNameInput.value.trim();

    try {
      const response = await fetch('/api/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          cargo: 'Usuario Principal',
          avatar_url: currentAvatarBase64
        })
      });

      const data = await response.json();
      if (response.ok) {
        aplicarPerfilEnUI({ nombre, avatar_url: currentAvatarBase64 });
        cerrarModalPerfil();
      } else {
        alert('Ocurrió un error al actualizar el perfil.');
      }
    } catch (err) {
      console.error('Error al guardar perfil:', err);
      alert('No se pudo conectar con el servidor.');
    }
  });

  // -------------------------------------------------------------
  // MÓDULO DE CARPETAS - FUNCIONES Y EVENTOS
  // -------------------------------------------------------------
  async function cargarCarpetas() {
    try {
      const res = await fetch('/api/carpetas');
      const data = await res.json();
      if (res.ok && data.carpetas) {
        carpetasLista = data.carpetas;
        actualizarSelectCarpetas();
        renderizarGridCarpetas();
      }
    } catch (e) {
      console.error('Error cargando carpetas:', e);
    }
  }

  function actualizarSelectCarpetas() {
    const currentVal = carpetaSelect.value;
    carpetaSelect.innerHTML = '<option value="">-- Sin Carpeta (General) --</option>';

    carpetasLista.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.nombre} (S/. ${formatCurrency(c.total_bruto)})`;
      carpetaSelect.appendChild(opt);
    });

    if (currentVal) carpetaSelect.value = currentVal;
  }

  function renderizarGridCarpetas() {
    todasCarpetasGrid.innerHTML = '';

    if (carpetasLista.length === 0) {
      emptyCarpetasState.classList.remove('hidden');
      return;
    }

    emptyCarpetasState.classList.add('hidden');

    const globalAnimOffset = (performance.now() / 1000) % 32;

    carpetasLista.forEach(c => {
      const card = document.createElement('div');
      card.className = `folder-card ${currentCarpetaId === c.id ? 'active' : ''}`;
      card.style.animationDelay = `-${globalAnimOffset}s`;
      card.innerHTML = `
        <div class="folder-card-info">
          <h4 class="folder-card-title">📁 ${escapeHtml(c.nombre)}</h4>
          <p class="folder-card-desc">${escapeHtml(c.descripcion || 'Sin descripción')}</p>
        </div>
        <div class="folder-card-stats" style="animation-delay: -${globalAnimOffset}s;">
          <div class="folder-stat-item">
            <span class="folder-stat-label">Registros:</span>
            <span class="folder-stat-val">${c.cantidad_registros || 0}</span>
          </div>
          <div class="folder-stat-item">
            <span class="folder-stat-label">Bruto (100%):</span>
            <span class="folder-stat-val val-bruto">S/. ${formatCurrency(c.total_bruto)}</span>
          </div>
          <div class="folder-stat-item">
            <span class="folder-stat-label">-5% Deduc.:</span>
            <span class="folder-stat-val val-deduc">- S/. ${formatCurrency(c.deduccion_5)}</span>
          </div>
          <div class="folder-stat-item">
            <span class="folder-stat-label">Neto (95%):</span>
            <span class="folder-stat-val val-neto">S/. ${formatCurrency(c.total_neto)}</span>
          </div>
        </div>
        <div class="folder-card-actions">
          <button class="btn-open-folder" onclick="seleccionarCarpeta(${c.id})">
            ${currentCarpetaId === c.id ? 'Carpeta Activa' : 'Abrir / Filtrar'}
          </button>
          <button class="btn-delete-folder" onclick="eliminarCarpeta(${c.id})" title="Eliminar carpeta">
            Eliminar
          </button>
        </div>
      `;
      todasCarpetasGrid.appendChild(card);
    });
  }

  // Modales de Carpeta
  openCrearCarpetaBtn.addEventListener('click', () => {
    nombreCarpetaInput.value = '';
    descripcionCarpetaInput.value = '';
    crearCarpetaModalOverlay.classList.add('active');
  });

  function cerrarModalCrearCarpeta() {
    crearCarpetaModalOverlay.classList.remove('active');
  }

  closeCrearCarpetaModalBtn.addEventListener('click', cerrarModalCrearCarpeta);
  cancelCrearCarpetaBtn.addEventListener('click', cerrarModalCrearCarpeta);
  crearCarpetaModalOverlay.addEventListener('click', (e) => {
    if (e.target === crearCarpetaModalOverlay) cerrarModalCrearCarpeta();
  });

  // Guardar Carpeta
  crearCarpetaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = nombreCarpetaInput.value.trim();
    const descripcion = descripcionCarpetaInput.value.trim();

    if (!nombre) {
      alert('Ingresa un nombre para la carpeta.');
      return;
    }

    try {
      const res = await fetch('/api/carpetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion })
      });

      if (res.ok) {
        const createdData = await res.json();
        cerrarModalCrearCarpeta();
        await cargarCarpetas();
        if (createdData.carpeta && createdData.carpeta.id) {
          carpetaSelect.value = createdData.carpeta.id;
        }
        mostrarVistaCarpetas();
      } else {
        alert('No se pudo crear la carpeta.');
      }
    } catch (err) {
      console.error('Error creando carpeta:', err);
    }
  });

  // Alternador de Vistas Integradas en el Mismo Título (In-Place)
  const mainSectionTitle = document.getElementById('mainSectionTitle');
  const tableContainer = document.getElementById('tableContainer');
  const foldersContainer = document.getElementById('foldersContainer');
  const mainDisplayCard = document.getElementById('mainDisplayCard');

  function mostrarVistaCarpetas() {
    if (mainSectionTitle) mainSectionTitle.textContent = 'TODAS LAS CARPETAS';
    if (tableContainer) tableContainer.classList.add('hidden');
    if (foldersContainer) foldersContainer.classList.remove('hidden');
    if (recordCountEl) recordCountEl.textContent = `${carpetasLista.length} carpetas`;
    renderizarGridCarpetas();
    if (mainDisplayCard) mainDisplayCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function mostrarVistaHistorial() {
    if (foldersContainer) foldersContainer.classList.add('hidden');
    if (tableContainer) tableContainer.classList.remove('hidden');
    if (mainSectionTitle) {
      if (currentCarpetaId) {
        const activeFolder = carpetasLista.find(c => c.id === currentCarpetaId);
        mainSectionTitle.textContent = activeFolder ? `HISTORIAL DE INGRESOS (📁 ${activeFolder.nombre})` : 'HISTORIAL DE INGRESOS';
      } else {
        mainSectionTitle.textContent = 'HISTORIAL DE INGRESOS';
      }
    }
  }

  openTodasCarpetasBtn.addEventListener('click', () => {
    mostrarVistaCarpetas();
  });

  // Seleccionar / Filtrar por Carpeta
  window.seleccionarCarpeta = (id) => {
    currentCarpetaId = id;
    if (carpetaSelect) carpetaSelect.value = id;
    mostrarVistaHistorial();
    actualizarIndicadorFiltro();
    cargarIngresos();
  };

  // Quitar Filtro de Carpeta
  window.quitarFiltroCarpeta = () => {
    currentCarpetaId = null;
    if (carpetaSelect) carpetaSelect.value = '';
    mostrarVistaHistorial();
    actualizarIndicadorFiltro();
    cargarIngresos();
  };

  // Eliminar Carpeta
  window.eliminarCarpeta = async (id) => {
    if (!confirm('¿Confirmas que deseas eliminar esta carpeta? Los registros quedarán sin carpeta pero no se borrarán.')) return;

    try {
      const res = await fetch(`/api/carpetas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentCarpetaId === id) currentCarpetaId = null;
        await cargarCarpetas();
        cargarIngresos();
        if (!foldersContainer.classList.contains('hidden')) {
          renderizarGridCarpetas();
        } else {
          mostrarVistaHistorial();
        }
      }
    } catch (e) {
      console.error('Error eliminando carpeta:', e);
    }
  };

  // -------------------------------------------------------------
  // EVENT LISTENERS DE BOTONES DE FILTRO RÁPIDO
  // -------------------------------------------------------------
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFiltro = btn.getAttribute('data-filtro');
      fechaDesdeVal = null;
      fechaHastaVal = null;
      currentCarpetaId = null; // Quitar filtro de carpeta al cambiar filtro temporal

      fechaDesdeInput.value = '';
      fechaHastaInput.value = '';

      mostrarVistaHistorial();
      actualizarIndicadorFiltro();
      cargarIngresos();
    });
  });

  // -------------------------------------------------------------
  // EVENT LISTENER DE RANGO DE FECHAS PERSONALIZADO (DESDE / HASTA)
  // -------------------------------------------------------------
  customRangeForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const desde = fechaDesdeInput.value;
    const hasta = fechaHastaInput.value;

    if (!desde || !hasta) {
      alert('Por favor selecciona ambas fechas: Desde y Hasta.');
      return;
    }

    if (new Date(desde) > new Date(hasta)) {
      alert('La fecha "Desde" no puede ser mayor que la fecha "Hasta".');
      return;
    }

    filterButtons.forEach(b => b.classList.remove('active'));

    currentFiltro = 'rango';
    fechaDesdeVal = desde;
    fechaHastaVal = hasta;

    mostrarVistaHistorial();
    actualizarIndicadorFiltro();
    cargarIngresos();
  });

  // -------------------------------------------------------------
  // REGISTRAR UN NUEVO INGRESO
  // -------------------------------------------------------------
  ingresoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const monto = parseFloat(montoInput.value);
    const descripcion = descripcionInput.value.trim();
    const categoria = categoriaSelect.value;
    const fecha = fechaInput.value;
    const carpeta_id = carpetaSelect.value || null;

    if (isNaN(monto) || monto <= 0) {
      alert('Ingresa un monto válido en Soles mayor a 0.');
      return;
    }

    try {
      const response = await fetch('/api/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto, descripcion, categoria, fecha, carpeta_id })
      });

      const data = await response.json();

      if (response.ok) {
        montoInput.value = '';
        descripcionInput.value = '';
        setFormDefaultDate();

        await cargarCarpetas();
        cargarIngresos();
      } else {
        alert(data.error || 'Ocurrió un error al guardar el ingreso.');
      }
    } catch (err) {
      console.error('Error al conectar con la API:', err);
      alert('No se pudo conectar con el servidor.');
    }
  });

  // -------------------------------------------------------------
  // FUNCIÓN PARA ELIMINAR REGISTRO
  // -------------------------------------------------------------
  window.eliminarIngreso = async (id) => {
    if (!confirm('¿Confirmas que deseas eliminar este ingreso de caja?')) return;

    try {
      const response = await fetch(`/api/ingresos/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await cargarCarpetas();
        cargarIngresos();
      } else {
        alert('No se pudo eliminar el registro.');
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  };

  // -------------------------------------------------------------
  // OBTENER INGRESOS DE LA API REST
  // -------------------------------------------------------------
  async function cargarIngresos() {
    try {
      let url = `/api/ingresos?filtro=${currentFiltro}`;
      if (currentFiltro === 'rango' && fechaDesdeVal && fechaHastaVal) {
        url += `&desde=${fechaDesdeVal}&hasta=${fechaHastaVal}`;
      }
      if (currentCarpetaId) {
        url += `&carpeta_id=${currentCarpetaId}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        renderizarResumen(data);
        renderizarTabla(data.ingresos);
        actualizarEstadoServidor(data.usandoBaseDatos, data.motorBaseDatos ? `BD: ${data.motorBaseDatos}` : 'BD SQLite Conectada ⚡');
      }
    } catch (err) {
      console.error('Error cargando ingresos:', err);
      actualizarEstadoServidor(false, 'Servidor offline');
    }
  }

  // -------------------------------------------------------------
  // RENDERIZAR METRICAS Y RESUMEN (TOTAL BRUTO, -5%, NETO)
  // -------------------------------------------------------------
  function renderizarResumen(data) {
    totalBrutoEl.textContent = formatCurrency(data.totalBruto || 0);
    deduccion5El.textContent = formatCurrency(data.deduccion5 || 0);
    totalNetoEl.textContent = formatCurrency(data.totalNeto || 0);
    recordCountEl.textContent = `${data.cantidadRegistros || 0} registros`;
  }

  // -------------------------------------------------------------
  // RENDERIZAR TABLA DE REGISTROS (SIN ÍCONOS)
  // -------------------------------------------------------------
  function renderizarTabla(ingresos) {
    ingresosTableBody.innerHTML = '';

    if (!ingresos || ingresos.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    ingresos.forEach(item => {
      const montoBruto = parseFloat(item.monto);
      const deduc = montoBruto * 0.05;
      const neto = montoBruto * 0.95;

      const dateObj = new Date(item.fecha);
      const fechaFormatted = isNaN(dateObj) ? item.fecha : dateObj.toLocaleString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Obtener nombre de la carpeta si pertenece a alguna
      const carpMatch = carpetasLista.find(c => c.id === item.carpeta_id);
      const carpetaTag = carpMatch ? `<span class="tag-cat" style="border-color: #ffffff; color: #ffffff;">📁 ${escapeHtml(carpMatch.nombre)}</span> ` : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fechaFormatted}</td>
        <td><strong>${escapeHtml(item.descripcion || 'Ingreso de Caja')}</strong></td>
        <td>${carpetaTag}<span class="tag-cat">${escapeHtml(item.categoria || 'General')}</span></td>
        <td class="val-bruto">S/. ${formatCurrency(montoBruto)}</td>
        <td class="val-deduc">- S/. ${formatCurrency(deduc)}</td>
        <td class="val-neto">S/. ${formatCurrency(neto)}</td>
        <td>
          <button class="btn-delete" onclick="eliminarIngreso(${item.id})" title="Eliminar este ingreso">
            Eliminar
          </button>
        </td>
      `;
      ingresosTableBody.appendChild(tr);
    });
  }

  // -------------------------------------------------------------
  // UTILIDADES Y FORMATO
  // -------------------------------------------------------------
  function formatCurrency(val) {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  }

  function actualizarIndicadorFiltro() {
    let texto = 'Todo';
    if (currentFiltro === 'semana') texto = 'Semana actual (últimos 7 días)';
    else if (currentFiltro === 'mes') texto = 'Mes actual';
    else if (currentFiltro === 'anio') texto = 'Año actual';
    else if (currentFiltro === 'rango') texto = `Rango: ${fechaDesdeVal} al ${fechaHastaVal}`;

    if (currentCarpetaId) {
      const activeFolder = carpetasLista.find(c => c.id === currentCarpetaId);
      if (activeFolder) {
        texto += ` | 📁 Carpeta: <span style="color: #ffffff; font-weight: bold;">${escapeHtml(activeFolder.nombre)}</span> <button type="button" onclick="quitarFiltroCarpeta()" style="background: rgba(217,38,69,0.3); border: 1px solid #d92645; color: #ffffff; border-radius: 12px; padding: 2px 10px; font-size: 11px; margin-left: 6px; cursor: pointer; font-weight: 600;">[X] Quitar filtro</button>`;
      }
    }

    filterIndicatorEl.innerHTML = `Período: <strong>${texto}</strong>`;
  }

  function actualizarEstadoServidor(usandoDb, statusMsg = null) {
    if (!dbStatusBadge || !dbStatusText) return;
    const dot = dbStatusBadge.querySelector('.status-dot');
    if (!dot) return;

    if (usandoDb) {
      dot.className = 'status-dot active';
      dbStatusText.textContent = statusMsg || 'BD Conectada ⚡';
    } else {
      dot.className = 'status-dot offline';
      dbStatusText.textContent = statusMsg || 'Modo Local / Respaldo';
    }
  }

  function setFormDefaultDate() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    fechaInput.value = now.toISOString().slice(0, 16);
  }

  // -------------------------------------------------------------
  // ECOSISTEMA FLUIDO NEÓN BLANCO Y NEGRO PURO (SIN GRISES)
  // -------------------------------------------------------------
  function initFluidBackgroundCanvas() {
    const canvas = document.getElementById('fluidCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height, step = 0;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function drawFluidNeonWaves() {
      step += 0.005;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const waves = [
        { amplitude: 100, frequency: 0.002, speed: step * 0.8, opacity: 0.65, width: 3, offset: 0.25 },
        { amplitude: 130, frequency: 0.0016, speed: -step * 0.6, opacity: 0.45, width: 2, offset: 0.48 },
        { amplitude: 115, frequency: 0.0024, speed: step * 1.0, opacity: 0.75, width: 3.5, offset: 0.7 },
        { amplitude: 85, frequency: 0.0028, speed: -step * 0.9, opacity: 0.4, width: 2, offset: 0.88 }
      ];

      waves.forEach(w => {
        ctx.strokeStyle = `rgba(255, 255, 255, ${w.opacity})`;
        ctx.lineWidth = w.width;
        ctx.shadowBlur = 22 * w.opacity;
        ctx.shadowColor = '#ffffff';

        ctx.beginPath();
        for (let x = 0; x <= width + 10; x += 10) {
          const y = Math.sin(x * w.frequency + w.speed) * w.amplitude +
                    Math.cos(x * 0.0012 + w.speed * 0.5) * (w.amplitude * 0.45) +
                    height * w.offset;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      requestAnimationFrame(drawFluidNeonWaves);
    }

    drawFluidNeonWaves();
  }

  initFluidBackgroundCanvas();

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[m]);
  }
});
