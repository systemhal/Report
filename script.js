/* ==========================================================================
   ImportCalc JavaScript Engine - script.js
   ========================================================================== */

// Global state variables
let indChartInstance = null;
let productItems = [];

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    // Check Dark Mode preference
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        const icon = document.querySelector("#btnToggleDark i");
        if (icon) icon.className = "fa-solid fa-sun";
    }

    // Restore admin login state
    checkAdminLogin();

    // Client view input IDs (Quantity and Margin reallocated to Admin)
    const clientInputIds = [
        "indCliente", "indProducto", "indValorMercancia", "indPeso", "indVolumen", "indIncoterm", "indTransporte", "indOrigen"
    ];
    
    // Admin tariff input IDs
    const adminInputIds = [
        "admFleteCbm", "admFleteFcl", "admFleteAereo", "admBlFee", "admPickUp", "admGastosOrigen",
        "admSeguroComercial", "admDocFee", "admDescargaTn", "admVistoBueno",
        "admTransporteInterno", "admAlmacenajeVerde", "admVistoBuenoLinea", 
        "admGateIn", "admDescargaPuerto", "admComisionAduana", "admGastosOperativos",
        "admArancel", "admPercepcion", "admTipoCambio", "indMargen",
        "admPdfEmpresa", "admPdfSub1", "admPdfSub2", "admPdfBancoSoles", "admPdfBancoSolesCci",
        "admPdfBancoDolares", "admPdfBancoDolaresCci", "admPdfBancoRuc", "admPdfBancoRazon",
        "admPdfAsesorNombre", "admPdfAsesorCargo", "admPdfTerminos", "admGoogleSheetUrl"
    ];

    // Load saved tariffs from localStorage
    loadTariffs();
    loadProducts();

    // Default URL fallback if empty
    const sheetUrlEl = document.getElementById("admGoogleSheetUrl");
    if (sheetUrlEl && sheetUrlEl.value.trim() === "") {
        sheetUrlEl.value = "https://script.google.com/macros/s/AKfycbwVrfInmX4xf_Ig-MlodgnUx8K9nbvS255bdL7_PlOduaLbdQW8Pl1dXNVfTOEO5Vow/exec";
    }

    // Bind event listeners to Client inputs
    clientInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", calculateIndividual);
            el.addEventListener("change", calculateIndividual);
        }
    });

    // Client names between Tab 1 (Individual) and Tab 2 (Products) are kept independent.

    // Bind event listeners to Admin inputs
    adminInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", calculateIndividual);
            el.addEventListener("change", calculateIndividual);
        }
    });

    // Click outside popover to close it
    document.addEventListener("click", (event) => {
        const popover = document.getElementById("adminLoginPopover");
        const btnLogin = document.getElementById("btnAdminLogin");
        if (popover && popover.style.display === "block") {
            if (!popover.contains(event.target) && !btnLogin.contains(event.target)) {
                popover.style.display = "none";
            }
        }
    });

    // Render the recent history table
    renderHistoryTable();

    // Calculate immediately with local values first (improves page load UX)
    calculateIndividual();

    // Auto-fetch from Google Sheet silently if URL exists
    if (sheetUrlEl && sheetUrlEl.value.trim() !== "") {
        fetchFromGoogleSheet(true); 
    }
});

// Tab Switcher
function switchTab(tabName) {
    // Toggle active buttons
    document.getElementById("tabIndividual").classList.toggle("active", tabName === "individual");
    document.getElementById("tabProductos").classList.toggle("active", tabName === "productos");
    document.getElementById("tabPersonal").classList.toggle("active", tabName === "personal");
    document.getElementById("tabGuia").classList.toggle("active", tabName === "guia");

    // Toggle active content divs
    document.getElementById("contentIndividual").classList.toggle("active", tabName === "individual");
    document.getElementById("contentProductos").classList.toggle("active", tabName === "productos");
    document.getElementById("contentPersonal").classList.toggle("active", tabName === "personal");
    document.getElementById("contentGuia").classList.toggle("active", tabName === "guia");
    
    // Recalculate on switch
    if (tabName === "individual") {
        calculateIndividual();
    } else if (tabName === "productos") {
        syncTotalsFromCalculator();
    }
}

// --------------------------------------------------------------------------
// INDIVIDUAL CALCULATOR LOGIC (LCL Quotation Engine)
// --------------------------------------------------------------------------
function calculateIndividual() {
    // 1. Capture Client Inputs
    const mercancia = parseFloat(document.getElementById("indValorMercancia").value) || 0;
    const peso_kg = parseFloat(document.getElementById("indPeso").value) || 0;
    const cbm = parseFloat(document.getElementById("indVolumen").value) || 0;
    const incoterm = document.getElementById("indIncoterm").value;
    const transporte = document.getElementById("indTransporte").value;
    const origen = document.getElementById("indOrigen").value;
    const cantidadEl = document.getElementById("indCantidad");
    const cantidad = cantidadEl ? Math.max(parseFloat(cantidadEl.value) || 1, 1) : 1;
    const margen_comercial = parseFloat(document.getElementById("indMargen").value) || 0;

    // 2. Capture Admin Inputs
    const flete_tarifa_cbm = parseFloat(document.getElementById("admFleteCbm").value) || 0;
    const flete_tarifa_fcl = parseFloat(document.getElementById("admFleteFcl").value) || 0;
    const flete_aereo_rate = parseFloat(document.getElementById("admFleteAereo").value) || 0;
    const bl_fee = parseFloat(document.getElementById("admBlFee").value) || 0;
    const pick_up = parseFloat(document.getElementById("admPickUp").value) || 0;
    const gastos_origen = parseFloat(document.getElementById("admGastosOrigen").value) || 0;
    const seguro_comercial = parseFloat(document.getElementById("admSeguroComercial").value) || 0;
    const doc_fee = parseFloat(document.getElementById("admDocFee").value) || 0;
    const descarga_tarifa_tn = parseFloat(document.getElementById("admDescargaTn").value) || 0;
    const visto_bueno = parseFloat(document.getElementById("admVistoBueno").value) || 0;
    const transporte_interno = parseFloat(document.getElementById("admTransporteInterno").value) || 0;
    const almacenaje_verde = parseFloat(document.getElementById("admAlmacenajeVerde").value) || 0;
    const visto_bueno_linea = parseFloat(document.getElementById("admVistoBuenoLinea").value) || 0;
    const gate_in = parseFloat(document.getElementById("admGateIn").value) || 0;
    const descarga_puerto = parseFloat(document.getElementById("admDescargaPuerto").value) || 0;
    const comision_aduana = parseFloat(document.getElementById("admComisionAduana").value) || 0;
    const gastos_operativos = parseFloat(document.getElementById("admGastosOperativos").value) || 0;
    
    const arancel_rate = parseFloat(document.getElementById("admArancel").value) || 0;
    const percepcion_rate = parseFloat(document.getElementById("admPercepcion").value) || 0;
    const tc = parseFloat(document.getElementById("admTipoCambio").value) || 3.78;

    // 3. Flete Internacional Base Calculation (with weight/volume minimums / flat rates)
    if (transporte === "maritimo") {
        document.getElementById("indTarifaInfo").textContent = `Tarifa LCL: $${flete_tarifa_cbm.toFixed(2)} / CBM o Ton`;
    } else if (transporte === "maritimo_fcl") {
        document.getElementById("indTarifaInfo").textContent = `Tarifa FCL Flat: $${flete_tarifa_fcl.toFixed(2)} / Contenedor`;
    } else {
        document.getElementById("indTarifaInfo").textContent = `Tarifa Aérea: $${flete_aereo_rate.toFixed(2)} / kg`;
    }

    // 4. Apply Origin Recargo
    let recargo_factor = 1.0;
    let recargo_text = "Recargo flete: Ninguno (+0%)";
    if (origen === "europa") {
        recargo_factor = 1.2;
        recargo_text = "Recargo flete: +20% (Europa)";
    } else if (origen === "eeuu") {
        recargo_factor = 1.1;
        recargo_text = "Recargo flete: +10% (EEUU)";
    }
    document.getElementById("indOrigenInfo").textContent = recargo_text;

    // Check if we have active cargo inputs to calculate costs
    const hasCargo = (mercancia > 0 || peso_kg > 0 || cbm > 0);

    let flete_base = 0;
    let flete_comercial = 0;
    let fob = 0;
    let flete_aduanero = 0;
    let seguro_aduanero = 0;
    let cif = 0;
    let arancel = 0;
    let igv = 0;
    let ipm = 0;
    let derechos_aduaneros = 0;
    let percepcion = 0;
    let impuestos_totales = 0;
    let bl_fee_comercial = 0;
    let pick_up_comercial = 0;
    let gastos_origen_comercial = 0;
    let doc_fee_comercial = 0;
    let descarga_comercial = 0;
    let visto_bueno_lcl_comercial = 0;
    let almacenaje_lcl_comercial = 0;
    let visto_bueno_fcl_comercial = 0;
    let gate_in_fcl_comercial = 0;
    let descarga_puerto_fcl_comercial = 0;
    let servicios_origen_total = 0;
    let servicios_destino_gravados = 0;
    let igv_servicios = 0;
    let servicios_logicos_totales = 0;
    let costo_total = 0;
    let unit_landed = 0;
    let price_net = 0;

    if (hasCargo) {
        // Calculate international freight based on transport type
        if (transporte === "maritimo") {
            // Minimums: 1 CBM and 1 Ton (1000 kg)
            const cbm_calculado = Math.max(cbm, 1.0);
            const peso_calculado_tn = Math.max(peso_kg, 1000.0) / 1000.0;
            flete_base = Math.max(cbm_calculado, peso_calculado_tn) * flete_tarifa_cbm;
        } else if (transporte === "maritimo_fcl") {
            flete_base = flete_tarifa_fcl;
        } else {
            flete_base = peso_kg * flete_aereo_rate;
        }

        flete_comercial = flete_base * recargo_factor;

        // 5. FOB Aduanero Calculation
        fob = mercancia;
        if (incoterm === "EXW") {
            fob = mercancia + bl_fee + pick_up + gastos_origen;
        }

        // 6. Flete Internacional Aduanero
        if (incoterm === "EXW" || incoterm === "FOB") {
            flete_aduanero = flete_comercial;
        } else {
            flete_comercial = 0; // Pre-paid in CIF
        }

        // 7. Seguro de Aduanas (1.5% of FOB)
        if (incoterm === "EXW" || incoterm === "FOB") {
            seguro_aduanero = fob * 0.015;
        }

        // 8. Valor CIF (Base Imponible)
        cif = fob + flete_aduanero + seguro_aduanero;

        // 9. Impuestos de Aduana (SUNAT)
        arancel = cif * arancel_rate;
        igv = (cif + arancel) * 0.16;
        ipm = (cif + arancel) * 0.02;
        derechos_aduaneros = arancel + igv + ipm;
        
        const base_percepcion = cif + derechos_aduaneros;
        percepcion = base_percepcion * percepcion_rate;
        impuestos_totales = derechos_aduaneros + percepcion;

        // 10. Servicios Logísticos MSI
        bl_fee_comercial = (incoterm === "EXW") ? bl_fee : 0;
        pick_up_comercial = (incoterm === "EXW") ? pick_up : 0;
        gastos_origen_comercial = (incoterm === "EXW") ? gastos_origen : 0;

        if (transporte === "maritimo") {
            doc_fee_comercial = doc_fee;
            const peso_tn = peso_kg / 1000.0;
            descarga_comercial = descarga_tarifa_tn * Math.max(peso_tn, 1.0);
            visto_bueno_lcl_comercial = visto_bueno;
            almacenaje_lcl_comercial = almacenaje_verde;
        } else if (transporte === "maritimo_fcl") {
            doc_fee_comercial = doc_fee;
            visto_bueno_fcl_comercial = visto_bueno_linea;
            gate_in_fcl_comercial = gate_in;
            descarga_puerto_fcl_comercial = descarga_puerto;
        }

        servicios_origen_total = bl_fee_comercial + pick_up_comercial + gastos_origen_comercial;
        
        servicios_destino_gravados = seguro_comercial + doc_fee_comercial + descarga_comercial + visto_bueno_lcl_comercial +
                                     transporte_interno + comision_aduana + gastos_operativos +
                                     almacenaje_lcl_comercial + visto_bueno_fcl_comercial + gate_in_fcl_comercial + descarga_puerto_fcl_comercial;
                                          
        igv_servicios = servicios_destino_gravados * 0.18;
        const total_servicios_sin_igv = flete_comercial + servicios_origen_total + servicios_destino_gravados;
        servicios_logicos_totales = total_servicios_sin_igv + igv_servicios;

        costo_total = mercancia + impuestos_totales + servicios_logicos_totales;

        // 11b. Costo Unitario & Precio Sugerido
        unit_landed = costo_total / cantidad;
        price_net = margen_comercial < 100 ? (unit_landed / (1 - (margen_comercial / 100))) : unit_landed;
    }

    // Update unit analysis elements
    const resUnitLandedUsdEl = document.getElementById("resUnitLandedUsd");
    if (resUnitLandedUsdEl) resUnitLandedUsdEl.textContent = formatCurrency(unit_landed, "USD");
    const resUnitLandedPenEl = document.getElementById("resUnitLandedPen");
    if (resUnitLandedPenEl) resUnitLandedPenEl.textContent = formatCurrency(unit_landed * tc, "PEN");
    
    const resUnitPriceUsdEl = document.getElementById("resUnitPriceUsd");
    if (resUnitPriceUsdEl) resUnitPriceUsdEl.textContent = formatCurrency(price_net, "USD");
    const resUnitPricePenEl = document.getElementById("resUnitPricePen");
    if (resUnitPricePenEl) resUnitPricePenEl.textContent = formatCurrency(price_net * tc, "PEN");

    // 12. Update UI Summary Card and Pills
    document.getElementById("resTotalImportacionUsd").textContent = formatCurrency(costo_total, "USD");
    document.getElementById("resTotalImportacionPen").textContent = formatCurrency(costo_total * tc, "PEN");

    document.getElementById("resPillMercancia").textContent = formatCurrency(mercancia, "USD");
    document.getElementById("resPillImpuestos").textContent = formatCurrency(impuestos_totales, "USD");
    document.getElementById("resPillServicios").textContent = formatCurrency(servicios_logicos_totales, "USD");

    // 13. Update Detailed Breakdown list
    document.getElementById("resIndFob").textContent = formatCurrency(fob, "USD");
    document.getElementById("resIndFlete").textContent = formatCurrency(flete_aduanero, "USD");
    document.getElementById("resIndSeguro").textContent = formatCurrency(seguro_aduanero, "USD");
    document.getElementById("resIndCif").textContent = formatCurrency(cif, "USD");
    document.getElementById("resIndAdvalorem").textContent = formatCurrency(arancel, "USD");
    document.getElementById("resIndIgvIpm").textContent = formatCurrency(igv + ipm, "USD");
    document.getElementById("resIndPercepcionVal").textContent = formatCurrency(percepcion, "USD");
    
    // Services details
    document.getElementById("resIndServiciosOrigen").textContent = formatCurrency(servicios_origen_total, "USD");
    document.getElementById("resIndServiciosFlete").textContent = formatCurrency(flete_comercial, "USD");
    document.getElementById("resIndServiciosDestino").textContent = formatCurrency(servicios_destino_gravados, "USD");
    document.getElementById("resIndServiciosIgv").textContent = formatCurrency(igv_servicios, "USD");
    document.getElementById("resIndServiciosTotal").textContent = formatCurrency(servicios_logicos_totales, "USD");

    // 14. Populate Printable PDF Proforma
    document.getElementById("pdfClienteNombre").textContent = document.getElementById("indCliente").value;
    document.getElementById("pdfProducto").textContent = document.getElementById("indProducto").value;

    // Read and update customizable PDF details from Admin Panel
    const pdfEmpresa = document.getElementById("admPdfEmpresa") ? document.getElementById("admPdfEmpresa").value : "MSI ADUANAS PERU CARGO S.A.C.";
    const pdfSub1 = document.getElementById("admPdfSub1") ? document.getElementById("admPdfSub1").value : "RUC: 20609799316 | Av. Elmer Faucett 150, Callao - Perú";
    const pdfSub2 = document.getElementById("admPdfSub2") ? document.getElementById("admPdfSub2").value : "Contacto: cotizaciones@msicargo.com | Tel: (01) 451-9988";
    const pdfBancoSoles = document.getElementById("admPdfBancoSoles") ? document.getElementById("admPdfBancoSoles").value : "191-9897990-0-94";
    const pdfBancoSolesCci = document.getElementById("admPdfBancoSolesCci") ? document.getElementById("admPdfBancoSolesCci").value : "002-19100989799009455";
    const pdfBancoDolares = document.getElementById("admPdfBancoDolares") ? document.getElementById("admPdfBancoDolares").value : "192-9950072-1-86";
    const pdfBancoDolaresCci = document.getElementById("admPdfBancoDolaresCci") ? document.getElementById("admPdfBancoDolaresCci").value : "002-19200995007218637";
    const pdfBancoRuc = document.getElementById("admPdfBancoRuc") ? document.getElementById("admPdfBancoRuc").value : "20609799316";
    const pdfBancoRazon = document.getElementById("admPdfBancoRazon") ? document.getElementById("admPdfBancoRazon").value : "MSI ADUANAS PERÚ CARGO S.A.C";
    const pdfAsesorNombre = document.getElementById("admPdfAsesorNombre") ? document.getElementById("admPdfAsesorNombre").value : "Jesus Riojas";
    const pdfAsesorCargo = document.getElementById("admPdfAsesorCargo") ? document.getElementById("admPdfAsesorCargo").value : "Asesor de Ventas - MSI Cargo";
    const pdfTerminos = document.getElementById("admPdfTerminos") ? document.getElementById("admPdfTerminos").value : "Impuestos SUNAT se cancelan en Soles al T.C. oficial del día.\nSujeto a variación por documentos de aduana definitivos.";

    if (document.getElementById("pdfEmpresaNombre")) document.getElementById("pdfEmpresaNombre").textContent = pdfEmpresa;
    if (document.getElementById("pdfEmpresaSub1")) document.getElementById("pdfEmpresaSub1").textContent = pdfSub1;
    if (document.getElementById("pdfEmpresaSub2")) document.getElementById("pdfEmpresaSub2").textContent = pdfSub2;
    if (document.getElementById("pdfBancoSoles")) document.getElementById("pdfBancoSoles").textContent = pdfBancoSoles;
    if (document.getElementById("pdfBancoSolesCci")) document.getElementById("pdfBancoSolesCci").textContent = pdfBancoSolesCci;
    if (document.getElementById("pdfBancoDolares")) document.getElementById("pdfBancoDolares").textContent = pdfBancoDolares;
    if (document.getElementById("pdfBancoDolaresCci")) document.getElementById("pdfBancoDolaresCci").textContent = pdfBancoDolaresCci;
    if (document.getElementById("pdfBancoRuc")) document.getElementById("pdfBancoRuc").textContent = pdfBancoRuc;
    if (document.getElementById("pdfBancoRazon")) document.getElementById("pdfBancoRazon").textContent = pdfBancoRazon;
    if (document.getElementById("pdfAsesorNombre")) document.getElementById("pdfAsesorNombre").textContent = pdfAsesorNombre;
    if (document.getElementById("pdfAsesorCargo")) document.getElementById("pdfAsesorCargo").textContent = pdfAsesorCargo;

    const terminosList = document.getElementById("pdfTerminosList");
    if (terminosList) {
        terminosList.innerHTML = "";
        const lines = pdfTerminos.split("\n");
        lines.forEach(line => {
            if (line.trim() !== "") {
                const li = document.createElement("li");
                li.textContent = line.trim();
                terminosList.appendChild(li);
            }
        });
    }
    
    // Format transport text
    let transportText = "Marítimo LCL";
    if (transporte === "maritimo_fcl") {
        transportText = "Marítimo FCL";
    } else if (transporte === "aereo") {
        transportText = "Aéreo (Carga)";
    }
    document.getElementById("pdfTransporte").textContent = transportText;
    document.getElementById("pdfIncoterm").textContent = incoterm;
    
    // Format origin text
    let originText = "China / Callao";
    if (origen === "eeuu") originText = "EEUU / Callao";
    else if (origen === "europa") originText = "Europa / Callao";
    else if (origen === "otros") originText = "Otros / Callao";
    document.getElementById("pdfOrigen").textContent = originText;
    
    document.getElementById("pdfPeso").textContent = `${peso_kg.toFixed(1)} kg`;
    document.getElementById("pdfVolumen").textContent = `${cbm.toFixed(2)} CBM`;
    
    // Tax details (SUNAT)
    document.getElementById("pdfValorFob").textContent = formatCurrency(fob, "USD");
    document.getElementById("pdfFleteAduanero").textContent = formatCurrency(flete_aduanero, "USD");
    document.getElementById("pdfSeguroAduanero").textContent = formatCurrency(seguro_aduanero, "USD");
    document.getElementById("pdfValorCif").textContent = formatCurrency(cif, "USD");
    document.getElementById("pdfAdvalorem").textContent = formatCurrency(arancel, "USD");
    document.getElementById("pdfIgv").textContent = formatCurrency(igv, "USD");
    document.getElementById("pdfIpm").textContent = formatCurrency(ipm, "USD");
    document.getElementById("pdfTotalDerechosAduana").textContent = formatCurrency(derechos_aduaneros, "USD");
    document.getElementById("pdfPercepcion").textContent = formatCurrency(percepcion, "USD");
    document.getElementById("pdfTotalAduana").textContent = formatCurrency(impuestos_totales, "USD");
    
    // Services details (MSI)
    document.getElementById("pdfServFlete").textContent = formatCurrency(flete_comercial, "USD");
    document.getElementById("pdfServBl").textContent = formatCurrency(bl_fee_comercial, "USD");
    document.getElementById("pdfServPickUp").textContent = formatCurrency(pick_up_comercial, "USD");
    document.getElementById("pdfServOrigen").textContent = formatCurrency(gastos_origen_comercial, "USD");
    document.getElementById("pdfServSeguro").textContent = formatCurrency(hasCargo ? seguro_comercial : 0, "USD");
    document.getElementById("pdfServDoc").textContent = formatCurrency(doc_fee_comercial, "USD");
    document.getElementById("pdfServDescargaLcl").textContent = formatCurrency(descarga_comercial, "USD");
    document.getElementById("pdfServVbLcl").textContent = formatCurrency(visto_bueno_lcl_comercial, "USD");
    document.getElementById("pdfServTranspInterno").textContent = formatCurrency(hasCargo ? transporte_interno : 0, "USD");
    document.getElementById("pdfServAlmacenaje").textContent = formatCurrency(almacenaje_lcl_comercial, "USD");
    document.getElementById("pdfServVbFcl").textContent = formatCurrency(visto_bueno_fcl_comercial, "USD");
    document.getElementById("pdfServGateIn").textContent = formatCurrency(gate_in_fcl_comercial, "USD");
    document.getElementById("pdfServDescargaPuerto").textContent = formatCurrency(descarga_puerto_fcl_comercial, "USD");
    document.getElementById("pdfServComision").textContent = formatCurrency(hasCargo ? comision_aduana : 0, "USD");
    document.getElementById("pdfServGastosOp").textContent = formatCurrency(hasCargo ? gastos_operativos : 0, "USD");
    document.getElementById("pdfServIgv").textContent = formatCurrency(igv_servicios, "USD");
    document.getElementById("pdfServTotal").textContent = formatCurrency(servicios_logicos_totales, "USD");
    
    // Grand summary
    document.getElementById("pdfResumenMercancia").textContent = formatCurrency(mercancia, "USD");
    document.getElementById("pdfResumenImpuestos").textContent = formatCurrency(impuestos_totales, "USD");
    document.getElementById("pdfResumenServicios").textContent = formatCurrency(servicios_logicos_totales, "USD");
    document.getElementById("pdfResumenTotalUsd").textContent = formatCurrency(costo_total, "USD");
    document.getElementById("pdfResumenTotalPen").textContent = formatCurrency(costo_total * tc, "PEN");

    // 15. Refresh visual Chart
    updateIndividualChart(mercancia, impuestos_totales, servicios_logicos_totales);

    // Save to localStorage
    saveTariffs();
}

// --------------------------------------------------------------------------
// PRINT PDF TRIGGER
// --------------------------------------------------------------------------
function printPdf() {
    // Generate dates dynamically
    const today = new Date();
    const expiry = new Date();
    expiry.setDate(today.getDate() + 15);
    
    const formatDate = (date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };
    
    document.getElementById("pdfFecha").textContent = formatDate(today);
    document.getElementById("pdfVence").textContent = formatDate(expiry);
    
    // Generate random quote number if not set or just a new one for unique printouts
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const quoteNum = `MSI-${today.getFullYear()}-J${randomNum}`;
    document.getElementById("pdfCotizacionNum").textContent = quoteNum;
    
    // Save simulation to history
    saveCurrentQuoteToHistory();

    // Suggest a professional filename by temporarily modifying document.title
    const clientVal = document.getElementById("indCliente").value.trim();
    const productVal = document.getElementById("indProducto").value.trim();
    
    const sanitizeFilename = (str) => {
        // Remove accents and special characters that are illegal in file names, replace spaces with underscores
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-zA-Z0-9\s-_]/g, "")
                  .trim()
                  .replace(/\s+/g, "_");
    };

    const clientClean = sanitizeFilename(clientVal);
    const productClean = sanitizeFilename(productVal);
    
    let docTitle = `Cotizacion_${quoteNum}`;
    if (clientClean) docTitle += `_${clientClean}`;
    if (productClean) docTitle += `_${productClean}`;
    
    const originalTitle = document.title;
    document.title = docTitle;

    // Inject dynamic print page style for proforma (A4 with 5mm 7mm margins)
    const styleEl = document.createElement("style");
    styleEl.id = "print-proforma-page-style";
    styleEl.innerHTML = `
        @page {
            size: A4 portrait;
            margin: 5mm 7mm !important;
        }
    `;
    document.head.appendChild(styleEl);

    // Add print class to body
    document.body.classList.add("print-proforma");

    // Trigger print dialog
    window.print();

    // Cleanup
    document.body.classList.remove("print-proforma");
    
    // Remove dynamic page style
    const styleElToRemove = document.getElementById("print-proforma-page-style");
    if (styleElToRemove) {
        styleElToRemove.remove();
    }
    
    document.title = originalTitle;
}

// --------------------------------------------------------------------------
// TOGGLE DARK MODE
// --------------------------------------------------------------------------
function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
    
    // Update toggle icon
    const icon = document.querySelector("#btnToggleDark i");
    if (icon) {
        if (isDark) {
            icon.className = "fa-solid fa-sun";
        } else {
            icon.className = "fa-solid fa-moon";
        }
    }
    
    // Recalculate to redraw chart with dynamic colors
    calculateIndividual();
}

// --------------------------------------------------------------------------
// CHART RENDERER
// --------------------------------------------------------------------------
function updateIndividualChart(mercancia, impuestos, servicios) {
    const canvas = document.getElementById("indChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    const chartData = [mercancia, impuestos, servicios];
    const chartLabels = ["Mercadería", "Impuestos SUNAT", "Servicios MSI"];
    
    const isDark = document.body.classList.contains("dark-mode");
    const mercaderiaColor = isDark ? "#3b82f6" : "#111827"; // Light Blue in dark mode, charcoal in light mode
    const chartBorderColor = isDark ? "#111827" : "#ffffff";
    const legendColor = isDark ? "#f3f4f6" : "#4b5563";
    
    if (indChartInstance) {
        indChartInstance.data.datasets[0].data = chartData;
        indChartInstance.data.datasets[0].backgroundColor[0] = mercaderiaColor;
        indChartInstance.data.datasets[0].borderColor = chartBorderColor;
        indChartInstance.options.plugins.legend.labels.color = legendColor;
        indChartInstance.update();
    } else {
        indChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: [
                        mercaderiaColor,
                        '#dc2626', // Impuestos SUNAT (MSI/SUNAT Crimson Red)
                        '#ecc94b'  // Servicios MSI (Gold/Yellow)
                    ],
                    borderWidth: 2,
                    borderColor: chartBorderColor
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: legendColor,
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 11,
                                weight: '600'
                            },
                            boxWidth: 12,
                            padding: 8
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += formatCurrency(context.raw, "USD");
                                return label;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

// --------------------------------------------------------------------------
// HELPER UTILITIES
// --------------------------------------------------------------------------
function formatCurrency(val, currency = "USD") {
    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val);
    
    if (currency === "USD") {
        return `$ ${formatted}`;
    } else {
        return `S/ ${formatted}`;
    }
}

// --------------------------------------------------------------------------
// ADMIN AND TARIFF PERSISTENCE UTILITIES
// --------------------------------------------------------------------------
function saveTariffs() {
    const adminInputIds = [
        "admFleteCbm", "admFleteFcl", "admFleteAereo", "admBlFee", "admPickUp", "admGastosOrigen",
        "admSeguroComercial", "admDocFee", "admDescargaTn", "admVistoBueno",
        "admTransporteInterno", "admAlmacenajeVerde", "admVistoBuenoLinea", 
        "admGateIn", "admDescargaPuerto", "admComisionAduana", "admGastosOperativos",
        "admArancel", "admPercepcion", "admTipoCambio", "indMargen",
        "admPdfEmpresa", "admPdfSub1", "admPdfSub2", "admPdfBancoSoles", "admPdfBancoSolesCci",
        "admPdfBancoDolares", "admPdfBancoDolaresCci", "admPdfBancoRuc", "admPdfBancoRazon",
        "admPdfAsesorNombre", "admPdfAsesorCargo", "admPdfTerminos", "admGoogleSheetUrl"
    ];
    const tariffs = {};
    adminInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            tariffs[id] = el.value;
        }
    });
    localStorage.setItem("msiTariffs", JSON.stringify(tariffs));
}

function loadTariffs() {
    const tariffsStr = localStorage.getItem("msiTariffs");
    if (tariffsStr) {
        try {
            const tariffs = JSON.parse(tariffsStr);
            Object.keys(tariffs).forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = tariffs[id];
                }
            });
        } catch (e) {
            console.error("Error loading tariffs", e);
        }
    }
}

function checkAdminLogin() {
    const isLoggedIn = localStorage.getItem("msiAdminLoggedIn") === "true";
    const tabPersonal = document.getElementById("tabPersonal");
    const tabGuia = document.getElementById("tabGuia");
    const btnLogin = document.getElementById("btnAdminLogin");
    
    if (tabPersonal && tabGuia) {
        if (isLoggedIn) {
            tabPersonal.style.display = "";
            tabGuia.style.display = "";
            if (btnLogin) {
                btnLogin.classList.add("active");
                btnLogin.innerHTML = '<i class="fa-solid fa-lock-open"></i>';
                btnLogin.title = "Cerrar Sesión Administrador";
            }
        } else {
            tabPersonal.style.display = "none";
            tabGuia.style.display = "none";
            if (btnLogin) {
                btnLogin.classList.remove("active");
                btnLogin.innerHTML = '<i class="fa-solid fa-lock"></i>';
                btnLogin.title = "Acceso Administrador";
            }
        }
    }
}

function toggleAdminLogin(event) {
    const isLoggedIn = localStorage.getItem("msiAdminLoggedIn") === "true";
    if (isLoggedIn) {
        // Log out
        localStorage.removeItem("msiAdminLoggedIn");
        checkAdminLogin();
        // If we are currently in an admin tab, go back to client tab
        const activeTab = document.querySelector(".tab-btn.active");
        if (activeTab && (activeTab.id === "tabPersonal" || activeTab.id === "tabGuia")) {
            switchTab("individual");
        }
        showToast("Sesión Cerrada", "La sesión de administrador ha sido cerrada.", "info");
    } else {
        // Toggle Popover
        const popover = document.getElementById("adminLoginPopover");
        if (popover) {
            const isHidden = popover.style.display === "none" || popover.style.display === "";
            if (isHidden) {
                popover.style.display = "block";
                const input = document.getElementById("adminPasswordInput");
                if (input) {
                    input.value = "";
                    setTimeout(() => input.focus(), 50); // Small timeout to ensure visibility
                }
                const errorMsg = document.getElementById("popoverErrorMsg");
                if (errorMsg) errorMsg.style.display = "none";
            } else {
                popover.style.display = "none";
            }
        }
    }
}

function submitAdminLogin() {
    const input = document.getElementById("adminPasswordInput");
    const errorMsg = document.getElementById("popoverErrorMsg");
    const popover = document.getElementById("adminLoginPopover");
    
    if (input) {
        const password = input.value;
        const correctPassword = localStorage.getItem("msiAdminPassword") || "msi2026";
        if (password === correctPassword) {
            localStorage.setItem("msiAdminLoggedIn", "true");
            checkAdminLogin();
            if (popover) popover.style.display = "none";
            input.value = "";
            showToast("Acceso Concedido", "El Panel MSI y la Guía han sido desbloqueados.", "success");
        } else {
            if (errorMsg) {
                errorMsg.style.display = "block";
            }
        }
    }
}

function handleAdminPasswordKey(event) {
    if (event.key === "Enter") {
        submitAdminLogin();
    } else if (event.key === "Escape") {
        const popover = document.getElementById("adminLoginPopover");
        if (popover) popover.style.display = "none";
    }
}

// --------------------------------------------------------------------------
// RECENT HISTORY FUNCTIONS
// --------------------------------------------------------------------------
function saveCurrentQuoteToHistory() {
    const cliente = document.getElementById("indCliente").value || "Sin Nombre";
    const producto = document.getElementById("indProducto").value || "Sin Producto";
    const valorMercancia = document.getElementById("indValorMercancia").value || "0";
    const peso = document.getElementById("indPeso").value || "0";
    const volumen = document.getElementById("indVolumen").value || "0";
    const incoterm = document.getElementById("indIncoterm").value;
    const transporte = document.getElementById("indTransporte").value;
    const origen = document.getElementById("indOrigen").value;
    const total = document.getElementById("resTotalImportacionUsd").textContent || "$ 0.00";

    // No guardar cotizaciones que estén vacías (sin valores de carga)
    const valNum = parseFloat(valorMercancia) || 0;
    const pesoNum = parseFloat(peso) || 0;
    const volNum = parseFloat(volumen) || 0;
    if (valNum === 0 && pesoNum === 0 && volNum === 0) {
        return;
    }

    const quote = {
        cliente,
        producto,
        valorMercancia,
        peso,
        volumen,
        incoterm,
        transporte,
        origen,
        total,
        timestamp: new Date().getTime()
    };

    let history = [];
    const historyStr = localStorage.getItem("msiQuoteHistory");
    if (historyStr) {
        try {
            history = JSON.parse(historyStr);
        } catch(e) {
            console.error(e);
        }
    }

    // Check if the exact quote is already the latest in history
    if (history.length > 0) {
        const latest = history[0];
        if (latest.cliente === quote.cliente && 
            latest.producto === quote.producto && 
            latest.valorMercancia === quote.valorMercancia && 
            latest.peso === quote.peso && 
            latest.volumen === quote.volumen && 
            latest.incoterm === quote.incoterm && 
            latest.transporte === quote.transporte && 
            latest.origen === quote.origen) {
            return;
        }
    }

    history.unshift(quote);
    if (history.length > 5) {
        history = history.slice(0, 5);
    }

    localStorage.setItem("msiQuoteHistory", JSON.stringify(history));
    renderHistoryTable();
}

function renderHistoryTable() {
    const tbody = document.getElementById("historyTableBody");
    if (!tbody) return;

    let history = [];
    const historyStr = localStorage.getItem("msiQuoteHistory");
    if (historyStr) {
        try {
            history = JSON.parse(historyStr);
        } catch(e) {
            console.error(e);
        }
    }

    // Filtrar cotizaciones vacías del historial guardado en localStorage
    history = history.filter(q => {
        const val = parseFloat(q.valorMercancia) || 0;
        const pesoVal = parseFloat(q.peso) || 0;
        const volVal = parseFloat(q.volumen) || 0;
        return (val > 0 || pesoVal > 0 || volVal > 0);
    });

    // Guardar historial limpio
    localStorage.setItem("msiQuoteHistory", JSON.stringify(history));

    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 16px; text-align: center; color: var(--text-muted);">No hay cotizaciones registradas en el historial.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    history.forEach((q, idx) => {
        let tText = "Marítimo LCL";
        if (q.transporte === "maritimo_fcl") tText = "Marítimo FCL";
        else if (q.transporte === "aereo") tText = "Aéreo";

        let oText = "China";
        if (q.origen === "eeuu") oText = "EEUU";
        else if (q.origen === "europa") oText = "Europa";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="padding: 10px;">${escapeHtml(q.cliente)}</td>
            <td style="padding: 10px;">${escapeHtml(q.producto)}</td>
            <td style="padding: 10px; font-weight: 600;">${escapeHtml(q.incoterm)}</td>
            <td style="padding: 10px;">${tText} (${oText})</td>
            <td style="padding: 10px;">$ ${parseFloat(q.valorMercancia).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            <td style="padding: 10px; font-weight: 700; color: var(--text-main);">${q.total}</td>
            <td style="padding: 10px; text-align: right;">
                <button class="btn-history-load" onclick="loadQuoteFromHistory(${idx})" style="background-color: var(--primary-light); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: var(--transition-fast);">
                    Cargar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function loadQuoteFromHistory(idx) {
    let history = [];
    const historyStr = localStorage.getItem("msiQuoteHistory");
    if (historyStr) {
        try {
            history = JSON.parse(historyStr);
        } catch(e) {
            console.error(e);
        }
    }

    const q = history[idx];
    if (q) {
        if (document.getElementById("indCliente")) document.getElementById("indCliente").value = q.cliente;
        if (document.getElementById("indProducto")) document.getElementById("indProducto").value = q.producto;
        if (document.getElementById("indValorMercancia")) document.getElementById("indValorMercancia").value = q.valorMercancia;
        if (document.getElementById("indPeso")) document.getElementById("indPeso").value = q.peso;
        if (document.getElementById("indVolumen")) document.getElementById("indVolumen").value = q.volumen;
        if (document.getElementById("indIncoterm")) document.getElementById("indIncoterm").value = q.incoterm;
        if (document.getElementById("indTransporte")) document.getElementById("indTransporte").value = q.transporte;
        if (document.getElementById("indOrigen")) document.getElementById("indOrigen").value = q.origen;

        calculateIndividual();
        showToast("Cotización Cargada", "Se restablecieron los datos de la cotización seleccionada.", "success");
        
        switchTab("individual");
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --------------------------------------------------------------------------
// SECURITY & TARIFF DATA MANAGEMENT
// --------------------------------------------------------------------------
function changeAdminPassword() {
    const newPass = document.getElementById("admNewPassword").value;
    const confirmPass = document.getElementById("admNewPasswordConfirm").value;
    
    if (!newPass) {
        showToast("Campo Requerido", "Por favor, ingrese la nueva contraseña.", "warning");
        return;
    }
    if (newPass !== confirmPass) {
        showToast("Error de Validación", "Las contraseñas no coinciden. Por favor, verifique.", "error");
        return;
    }
    
    localStorage.setItem("msiAdminPassword", newPass);
    document.getElementById("admNewPassword").value = "";
    document.getElementById("admNewPasswordConfirm").value = "";
    showToast("Contraseña Actualizada", "La contraseña de seguridad ha sido modificada.", "success");
}

function exportTariffs() {
    const tariffsStr = localStorage.getItem("msiTariffs") || "{}";
    const blob = new Blob([tariffsStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "msi_tarifas_export_" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importTariffs() {
    document.getElementById("importTariffsFile").click();
}

function handleImportTariffs(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const tariffs = JSON.parse(e.target.result);
            if (typeof tariffs === "object" && tariffs !== null) {
                localStorage.setItem("msiTariffs", JSON.stringify(tariffs));
                loadTariffs();
                calculateIndividual();
                showToast("Tarifas Importadas", "El tarifario local se actualizó correctamente.", "success");
            } else {
                showToast("Archivo Inválido", "El formato del archivo JSON no es compatible.", "error");
            }
        } catch (err) {
            showToast("Error de Importación", "No se pudo leer el archivo: " + err.message, "error");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

// --------------------------------------------------------------------------
// GOOGLE SHEETS SYNC FUNCTIONS
// --------------------------------------------------------------------------
function fetchFromGoogleSheet(silent = false) {
    const url = document.getElementById("admGoogleSheetUrl") ? document.getElementById("admGoogleSheetUrl").value.trim() : "";
    if (!url) {
        if (!silent) showToast("URL Faltante", "Por favor, ingrese la URL de su Google Apps Script en la sección 9.", "warning");
        return;
    }

    if (!silent) {
        console.log("Iniciando descarga de Google Sheets...");
    }

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("Error en la respuesta del servidor: Status " + res.status);
            return res.json();
        })
        .then(data => {
            // Apply loaded keys to DOM
            let count = 0;
            for (const key in data) {
                const el = document.getElementById(key);
                if (el) {
                    el.value = data[key];
                    count++;
                }
            }
            // Recalculate and save to localStorage
            calculateIndividual();
            
            if (!silent) {
                showToast("Sincronización Exitosa", "Se cargaron " + count + " variables desde el Google Sheet.", "success");
            }
        })
        .catch(err => {
            console.error("Error al sincronizar con Google Sheets:", err);
            if (!silent) {
                showToast("Error de Conexión", "No se pudo conectar con Google Sheets. Verifique la URL y permisos.", "error");
            }
        });
}

function postToGoogleSheet() {
    const url = document.getElementById("admGoogleSheetUrl") ? document.getElementById("admGoogleSheetUrl").value.trim() : "";
    if (!url) {
        showToast("URL Faltante", "Por favor, ingrese la URL de su Google Apps Script en la sección 9.", "warning");
        return;
    }

    // Double check password authorization
    const isLoggedIn = localStorage.getItem("msiAdminLoggedIn") === "true";
    if (!isLoggedIn) {
        showToast("Acceso Denegado", "Debe iniciar sesión como administrador para realizar esta acción.", "error");
        return;
    }

    // Collect all admin inputs to upload
    const adminInputIds = [
        "admFleteCbm", "admFleteFcl", "admFleteAereo", "admBlFee", "admPickUp", "admGastosOrigen",
        "admSeguroComercial", "admDocFee", "admDescargaTn", "admVistoBueno",
        "admTransporteInterno", "admAlmacenajeVerde", "admVistoBuenoLinea", 
        "admGateIn", "admDescargaPuerto", "admComisionAduana", "admGastosOperativos",
        "admArancel", "admPercepcion", "admTipoCambio", "indMargen",
        "admPdfEmpresa", "admPdfSub1", "admPdfSub2", "admPdfBancoSoles", "admPdfBancoSolesCci",
        "admPdfBancoDolares", "admPdfBancoDolaresCci", "admPdfBancoRuc", "admPdfBancoRazon",
        "admPdfAsesorNombre", "admPdfAsesorCargo", "admPdfTerminos"
    ];

    const payload = {};
    adminInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            payload[id] = el.value;
        }
    });

    showConfirm(
        "Subir Tarifas",
        "¿Está seguro de subir las tarifas actuales a Google Sheets? Esto sobrescribirá los valores existentes en el documento Excel.",
        () => {
            // Send POST request as text/plain to avoid CORS preflight options request blocker
            fetch(url, {
                method: "POST",
                mode: "no-cors", // Bypasses CORS redirect blockers on Apps Script
                headers: {
                    "Content-Type": "text/plain"
                },
                body: JSON.stringify(payload)
            })
            .then(() => {
                showToast("Subida Completada", "Las tarifas fueron enviadas al Google Sheet con éxito.", "success");
            })
            .catch(err => {
                console.error("Error al subir a Google Sheets:", err);
                showToast("Error al Guardar", "Ocurrió un error al guardar los datos: " + err.message, "error");
            });
        }
    );
}

// --------------------------------------------------------------------------
// PREMIUM NOTIFICATIONS & MODALS
// --------------------------------------------------------------------------
function showToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-card ${type}`;

    let iconClass = "fa-solid fa-info-circle";
    if (type === "success") iconClass = "fa-solid fa-circle-check";
    else if (type === "error") iconClass = "fa-solid fa-circle-xmark";
    else if (type === "warning") iconClass = "fa-solid fa-triangle-exclamation";

    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove from DOM after animations end (4000ms matches CSS animation)
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function showConfirm(title, message, onConfirm) {
    const overlay = document.getElementById("customConfirmModal");
    const titleEl = document.getElementById("confirmModalTitle");
    const msgEl = document.getElementById("confirmModalMessage");
    const btnAccept = document.getElementById("btnConfirmAccept");
    const btnCancel = document.getElementById("btnConfirmCancel");

    if (!overlay) {
        // Fallback to native confirm if element not found
        if (confirm(message)) onConfirm();
        return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    overlay.style.display = "flex";

    const closeConfirm = () => {
        overlay.style.display = "none";
        btnAccept.onclick = null;
        btnCancel.onclick = null;
    };

    btnAccept.onclick = () => {
        closeConfirm();
        onConfirm();
    };

    btnCancel.onclick = () => {
        closeConfirm();
    };

    // Close on clicking overlay
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeConfirm();
        }
    };
}

/**
 * Clears the client-facing inputs in the first tab (individual calculator)
 * after confirmation, then recalculates.
 */
function clearClientFields() {
    showConfirm(
        "Limpiar Campos",
        "¿Está seguro de que desea limpiar todos los campos de esta pestaña?",
        () => {
            const fields = {
                indCliente: "",
                indProducto: "",
                indValorMercancia: "",
                indPeso: "",
                indVolumen: "",
                indIncoterm: "EXW",
                indTransporte: "maritimo",
                indOrigen: "china"
            };

            for (const [id, val] of Object.entries(fields)) {
                const el = document.getElementById(id);
                if (el) el.value = val;
            }

            // Recalculate everything and update dashboard/charts
            calculateIndividual();

            // Display feedback
            showToast(
                "Campos Limpiados",
                "Se han restablecido los campos del cliente en esta pestaña.",
                "info"
            );
        }
    );
}

// --------------------------------------------------------------------------
// MULTIPLE PRODUCTS LANDED COST PRORATE ENGINE
// --------------------------------------------------------------------------
function loadProducts() {
    const saved = localStorage.getItem("msiProductItems");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                productItems = parsed;
            } else {
                productItems = [];
            }
        } catch(e) {
            console.error("Error parsing saved products", e);
            productItems = [];
        }
    } else {
        productItems = [];
    }
}

function syncTotalsFromCalculator() {
    const taxesText = document.getElementById("resPillImpuestos").textContent || "$ 0.00";
    const servicesText = document.getElementById("resPillServicios").textContent || "$ 0.00";
    
    // Client name in products tab is independent and not synchronized from the calculator
    
    const cleanNumber = (text) => {
        return parseFloat(text.replace(/[^0-9.-]/g, "")) || 0;
    };
    
    const taxesVal = cleanNumber(taxesText);
    const servicesVal = cleanNumber(servicesText);
    
    if (taxesVal === 0 && servicesVal === 0) {
        document.getElementById("prodTotalImpuestos").value = "";
        document.getElementById("prodTotalServicios").value = "";
    } else {
        document.getElementById("prodTotalImpuestos").value = taxesVal.toFixed(2);
        document.getElementById("prodTotalServicios").value = servicesVal.toFixed(2);
    }
    
    recalculateProducts();
}

function recalculateProducts() {
    const totalTaxes = parseFloat(document.getElementById("prodTotalImpuestos").value) || 0;
    const totalServices = parseFloat(document.getElementById("prodTotalServicios").value) || 0;
    
    let totalEXW = 0;
    productItems.forEach(item => {
        item.amount = (item.qty || 0) * (item.exw || 0);
        totalEXW += item.amount;
    });
    
    document.getElementById("prodTotalEXW").value = totalEXW.toFixed(2);
    
    let totalQty = 0;
    let totalLanded = 0;
    
    productItems.forEach(item => {
        const p = totalEXW > 0 ? (item.amount / totalEXW) : 0;
        item.proratedTaxes = totalTaxes * p;
        item.proratedServices = totalServices * p;
        item.landedTotal = item.amount + item.proratedTaxes + item.proratedServices;
        
        item.unitLandedCost = (item.qty > 0) ? (item.landedTotal / item.qty) : 0;
        
        totalQty += (item.qty || 0);
        totalLanded += item.landedTotal;
    });
    
    localStorage.setItem("msiProductItems", JSON.stringify(productItems));
    
    const tbody = document.getElementById("productsTableBody");
    if (tbody) {
        if (productItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding: 16px; text-align: center; color: var(--text-muted);">No hay productos registrados en la lista. Agregue manualmente o importe un archivo Excel.</td></tr>`;
        } else {
            tbody.innerHTML = "";
            productItems.forEach((item, idx) => {
                const tr = document.createElement("tr");
                tr.id = `prod-row-${idx}`;
                tr.innerHTML = `
                    <td style="padding: 8px 10px; text-align: center; font-weight: 600;">${idx + 1}</td>
                    <td style="padding: 8px 10px;">
                        <input type="text" class="table-input" value="${escapeHtml(item.description)}" oninput="updateProductValue(${idx}, 'description', this.value)">
                    </td>
                    <td style="padding: 8px 10px;">
                        <input type="number" class="table-input num-input" min="0" step="1" value="${item.qty}" oninput="updateProductValue(${idx}, 'qty', parseInt(this.value) || 0)">
                    </td>
                    <td style="padding: 8px 10px;">
                        <input type="number" class="table-input num-input" min="0" step="0.01" value="${item.exw}" oninput="updateProductValue(${idx}, 'exw', parseFloat(this.value) || 0)">
                    </td>
                    <td style="padding: 8px 10px; text-align: right; font-weight: 600; color: var(--text-main);">
                        $ ${item.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td style="padding: 8px 10px; text-align: right; font-weight: 700; background-color: rgba(16, 185, 129, 0.05); color: #1b5e20;">
                        $ ${item.unitLandedCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td style="padding: 8px 10px; text-align: right;">
                        <button class="btn-delete" onclick="deleteProductRow(${idx})" title="Eliminar fila">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
    
    document.getElementById("totalQtySum").textContent = totalQty;
    document.getElementById("totalAmountSum").textContent = `$ ${totalEXW.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById("totalLandedCostSum").textContent = "";
}

function addProductRow() {
    productItems.push({
        description: "NUEVO PRODUCTO",
        qty: 1,
        exw: 0.0,
        amount: 0.0,
        unitLandedCost: 0
    });
    recalculateProducts();
}

function deleteProductRow(index) {
    productItems.splice(index, 1);
    recalculateProducts();
}

function updateProductValue(index, field, value) {
    if (productItems[index]) {
        productItems[index][field] = value;
        if (field === 'qty' || field === 'exw') {
            productItems[index].amount = (productItems[index].qty || 0) * (productItems[index].exw || 0);
        }
        
        const totalTaxes = parseFloat(document.getElementById("prodTotalImpuestos").value) || 0;
        const totalServices = parseFloat(document.getElementById("prodTotalServicios").value) || 0;
        
        let totalEXW = 0;
        productItems.forEach(item => {
            item.amount = (item.qty || 0) * (item.exw || 0);
            totalEXW += item.amount;
        });
        
        document.getElementById("prodTotalEXW").value = totalEXW.toFixed(2);
        
        let totalQty = 0;
        let totalLanded = 0;
        
        productItems.forEach((item, idx) => {
            const p = totalEXW > 0 ? (item.amount / totalEXW) : 0;
            item.proratedTaxes = totalTaxes * p;
            item.proratedServices = totalServices * p;
            item.landedTotal = item.amount + item.proratedTaxes + item.proratedServices;
            item.unitLandedCost = (item.qty > 0) ? (item.landedTotal / item.qty) : 0;
            
            totalQty += (item.qty || 0);
            totalLanded += item.landedTotal;
            
            const tr = document.getElementById(`prod-row-${idx}`);
            if (tr) {
                const tds = tr.getElementsByTagName("td");
                if (tds.length >= 6) {
                    tds[4].textContent = `$ ${item.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    tds[5].textContent = `$ ${item.unitLandedCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                }
            }
        });
        
        document.getElementById("totalQtySum").textContent = totalQty;
        document.getElementById("totalAmountSum").textContent = `$ ${totalEXW.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById("totalLandedCostSum").textContent = `$ ${totalLanded.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        localStorage.setItem("msiProductItems", JSON.stringify(productItems));
    }
}

function clearProductsTable() {
    showConfirm(
        "Limpiar Tabla",
        "¿Está seguro de que desea eliminar todos los productos de la lista?",
        () => {
            productItems = [];
            localStorage.setItem("msiProductItems", JSON.stringify(productItems));
            
            // Also clear client name for products only
            const prodClienteEl = document.getElementById("prodCliente");
            if (prodClienteEl) prodClienteEl.value = "";
            
            recalculateProducts();
            showToast("Tabla Limpiada", "Se eliminaron todos los productos de la tabla.", "info");
        }
    );
}

function importExcelProducts(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            const cellO2 = worksheet['O2'];
            const cellO3 = worksheet['O3'];
            
            if (cellO2 && typeof cellO2.v === 'number') {
                document.getElementById("prodTotalImpuestos").value = cellO2.v.toFixed(2);
            }
            if (cellO3 && typeof cellO3.v === 'number') {
                document.getElementById("prodTotalServicios").value = cellO3.v.toFixed(2);
            }
            
            // Dynamic Header Scanning
            let headerRowIndex = -1;
            let colIndexDesc = -1;
            let colIndexQty = -1;
            let colIndexExw = -1;
            
            for (let r = 1; r <= 15; r++) {
                let cols = [];
                for (let c = 0; c < 16; c++) {
                    const colLetter = String.fromCharCode(65 + c);
                    const cell = worksheet[`${colLetter}${r}`];
                    const val = cell ? (cell.v || "").toString().toUpperCase().trim() : "";
                    cols.push({ val: val, idx: c });
                }
                
                let hasDesc = false;
                let hasQty = false;
                let hasExw = false;
                
                let foundDescIdx = -1;
                let foundQtyIdx = -1;
                let foundExwIdx = -1;
                
                // 1. Match Description
                cols.forEach(col => {
                    if (col.val.includes("DESCRIPTION") || col.val.includes("DESCRIPCIÓN") || col.val.includes("DESCRIPCION")) {
                        hasDesc = true;
                        foundDescIdx = col.idx;
                    }
                });
                
                // 2. Match Qty
                cols.forEach(col => {
                    if (col.val.includes("QTY") || col.val.includes("CANTIDAD") || col.val.includes("CANT")) {
                        hasQty = true;
                        foundQtyIdx = col.idx;
                    }
                });
                
                // 3. Match EXW / FOB / Unit Price (at origin)
                // First pass: try to find an EXW or FOB column that is not a total/amount
                cols.forEach(col => {
                    if ((col.val.includes("EXW") || col.val.includes("FOB")) && !col.val.includes("TOTAL") && !col.val.includes("AMOUNT")) {
                        hasExw = true;
                        foundExwIdx = col.idx;
                    }
                });
                
                // Second pass: if not found, look for "UNITARIO" (excluding local costs/totals)
                if (!hasExw) {
                    cols.forEach(col => {
                        if (col.val.includes("UNITARIO") && !col.val.includes("TOTAL") && !col.val.includes("AMOUNT") && !col.val.includes("ALMACEN") && !col.val.includes("PUESTO") && !col.val.includes("IMPORTADOR")) {
                            hasExw = true;
                            foundExwIdx = col.idx;
                        }
                    });
                }
                
                if (hasDesc && hasQty && hasExw) {
                    headerRowIndex = r;
                    colIndexDesc = foundDescIdx;
                    colIndexQty = foundQtyIdx;
                    colIndexExw = foundExwIdx;
                    break;
                }
            }
            
            const parsedItems = [];
            
            if (headerRowIndex !== -1) {
                let r = headerRowIndex + 1;
                let emptyCount = 0;
                const colLetterDesc = String.fromCharCode(65 + colIndexDesc);
                const colLetterQty = String.fromCharCode(65 + colIndexQty);
                const colLetterExw = String.fromCharCode(65 + colIndexExw);
                
                while (emptyCount < 5) {
                    const cellDesc = worksheet[`${colLetterDesc}${r}`];
                    const descVal = cellDesc ? (cellDesc.v || "").toString().trim() : "";
                    
                    if (!descVal) {
                        emptyCount++;
                        r++;
                        continue;
                    }
                    emptyCount = 0;
                    
                    const cellQty = worksheet[`${colLetterQty}${r}`];
                    const cellExw = worksheet[`${colLetterExw}${r}`];
                    
                    const qtyVal = cellQty ? parseInt(cellQty.v) || 0 : 0;
                    const exwVal = cellExw ? parseFloat(cellExw.v) || 0 : 0;
                    
                    parsedItems.push({
                        description: descVal,
                        qty: qtyVal,
                        exw: exwVal,
                        amount: qtyVal * exwVal,
                        unitLandedCost: 0
                    });
                    r++;
                }
            } else {
                // Fallback to old hardcoded format if no headers found
                let r = 6;
                let emptyCount = 0;
                while (emptyCount < 5) {
                    const cellB = worksheet[`B${r}`];
                    const descVal = cellB ? (cellB.v || "").toString().trim() : "";
                    
                    if (!descVal) {
                        emptyCount++;
                        r++;
                        continue;
                    }
                    emptyCount = 0;
                    
                    const cellD = worksheet[`D${r}`];
                    const cellE = worksheet[`E${r}`];
                    
                    const qtyVal = cellD ? parseInt(cellD.v) || 0 : 0;
                    const exwVal = cellE ? parseFloat(cellE.v) || 0 : 0;
                    
                    parsedItems.push({
                        description: descVal,
                        qty: qtyVal,
                        exw: exwVal,
                        amount: qtyVal * exwVal,
                        unitLandedCost: 0
                    });
                    r++;
                }
            }
            
            if (parsedItems.length > 0) {
                productItems = parsedItems;
                localStorage.setItem("msiProductItems", JSON.stringify(productItems));
                recalculateProducts();
                showToast("Importación Exitosa", `Se importaron ${parsedItems.length} productos del archivo Excel.`, "success");
            } else {
                showToast("Error de Lectura", "No se encontraron productos válidos en el archivo. Verifique el formato.", "error");
            }
            
        } catch(err) {
            console.error(err);
            showToast("Error de Importación", "No se pudo leer el archivo Excel: " + err.message, "error");
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = "";
}

function exportExcelProducts() {
    const ws_data = [];
    ws_data.push([]);
    
    const row2 = [];
    row2[11] = "IMPUESTOS DE ADUANA";
    row2[14] = parseFloat(document.getElementById("prodTotalImpuestos").value) || 0;
    ws_data.push(row2);
    
    const row3 = [];
    row3[11] = "SERVICIOS LOGISTICOS";
    row3[14] = parseFloat(document.getElementById("prodTotalServicios").value) || 0;
    ws_data.push(row3);
    
    const row4 = [];
    const prodClientEl = document.getElementById("prodCliente");
    const clientVal = prodClientEl ? prodClientEl.value.trim() : "";
    row4[0] = clientVal ? `Cliente: ${clientVal} | Reporte de Precios Unitarios de Importación` : `Reporte de Precios Unitarios de Importación`;
    ws_data.push(row4);
    
    const headers = [
        "No.", 
        "DESCRIPCIÓN", 
        "IMAGEN PRODUCTO", 
        "CANTIDAD", 
        "PRECIO FOB UNITARIO(USD)", 
        "TOTAL PRECIO FOB(USD)", 
        "PRECIO UNITARIO EN ALMACEN DEL IMPORTADOR", 
        "IMPUESTOS", 
        "SERVICIOS LOGISTICOS", 
        "PRECIO TOTAL", 
        "IMPUESTOS DE ADUANA", 
        "SERVICIOS LOGISTICOS", 
        "PRECIO TOTAL PUESTO EN EL ALMACEN DEL IMPORTADOR", 
        "PRECIO UNITARIO PUESTO EN EL ALMACEN",
        "", 
        ""  
    ];
    ws_data.push(headers);
    
    const startRow = 6;
    productItems.forEach((item, idx) => {
        const row = [
            idx + 1,
            item.description,
            "", 
            item.qty,
            item.exw,
            0, 
            0, 
            0, 
            0, 
            0, 
            0, 
            0, 
            0, 
            0, 
            "", 
            0  
        ];
        ws_data.push(row);
    });
    
    const totalRowIndex = startRow + productItems.length;
    const totalRow = [];
    totalRow[3] = 0;
    totalRow[5] = 0; 
    ws_data.push(totalRow);
    
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
    // Define styles for Excel columns and rows
    const headerStyle = {
        fill: { patternType: "solid", fgColor: { rgb: "111827" } },
        font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } }
        }
    };
    
    const dataStyleLeft = {
        font: { name: "Segoe UI", sz: 10 },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } }
        }
    };
    
    const dataStyleCenter = {
        font: { name: "Segoe UI", sz: 10 },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } }
        }
    };
    
    const dataStyleRight = {
        font: { name: "Segoe UI", sz: 10 },
        alignment: { horizontal: "right", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } }
        }
    };
    
    const totalStyle = {
        font: { name: "Segoe UI", sz: 10, bold: true },
        alignment: { vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "111827" } },
            bottom: { style: "double", color: { rgb: "111827" } }
        }
    };

    const totalStyleLeft = {
        ...totalStyle,
        alignment: { horizontal: "left", vertical: "center" }
    };

    const totalStyleRight = {
        ...totalStyle,
        alignment: { horizontal: "right", vertical: "center" }
    };
    
    // Title styling
    ws['A4'] = { 
        t: 's', 
        v: `Cliente: ${clientVal} | Reporte de Precios Unitarios de Importación`, 
        s: { font: { name: "Segoe UI", sz: 11, bold: true }, alignment: { horizontal: "left", vertical: "center" } } 
    };

    // Header styling
    const colLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
    colLetters.slice(0, 7).forEach(col => {
        if (ws[`${col}5`]) ws[`${col}5`].s = headerStyle;
    });
    
    productItems.forEach((item, idx) => {
        const rNum = startRow + idx;
        
        ws[`D${rNum}`] = { t: 'n', v: item.qty, z: '#,##0', s: dataStyleRight };
        ws[`E${rNum}`] = { t: 'n', v: item.exw, z: '"$"#,##0.00', s: dataStyleRight };
        ws[`F${rNum}`] = { t: 'n', f: `D${rNum}*E${rNum}`, v: item.qty * item.exw, z: '"$"#,##0.00', s: dataStyleRight };
        ws[`P${rNum}`] = { t: 'n', f: `F${rNum}/$F$${totalRowIndex}`, v: productItems.length > 0 ? (item.amount / (productItems.reduce((acc, curr) => acc + curr.amount, 0) || 1)) : 0, z: '0.00%' };
        ws[`K${rNum}`] = { t: 'n', f: `$O$2*P${rNum}`, v: item.proratedTaxes, z: '"$"#,##0.00' };
        ws[`L${rNum}`] = { t: 'n', f: `$O$3*P${rNum}`, v: item.proratedServices, z: '"$"#,##0.00' };
        ws[`M${rNum}`] = { t: 'n', f: `F${rNum}+K${rNum}+L${rNum}`, v: item.landedTotal, z: '"$"#,##0.00' };
        ws[`N${rNum}`] = { t: 'n', f: `M${rNum}/D${rNum}`, v: item.unitLandedCost, z: '"$"#,##0.00' };
        ws[`H${rNum}`] = { t: 'n', f: `K${rNum}`, v: item.proratedTaxes, z: '"$"#,##0.00' };
        ws[`I${rNum}`] = { t: 'n', f: `L${rNum}`, v: item.proratedServices, z: '"$"#,##0.00' };
        ws[`J${rNum}`] = { t: 'n', f: `M${rNum}`, v: item.landedTotal, z: '"$"#,##0.00' };
        ws[`G${rNum}`] = { t: 'n', f: `J${rNum}/D${rNum}`, v: item.unitLandedCost, z: '"$"#,##0.00', s: dataStyleRight };
        
        ws[`A${rNum}`] = { t: 'n', v: idx + 1, s: dataStyleCenter };
        ws[`B${rNum}`] = { t: 's', v: item.description, s: dataStyleLeft };
        ws[`C${rNum}`] = { t: 's', v: "", s: dataStyleCenter };
    });
    
    ws[`A${totalRowIndex}`] = { t: 's', v: 'TOTALES:', s: totalStyleLeft };
    ws[`B${totalRowIndex}`] = { t: 's', v: '', s: totalStyle };
    ws[`C${totalRowIndex}`] = { t: 's', v: '', s: totalStyle };
    ws[`D${totalRowIndex}`] = { t: 'n', f: `SUM(D6:D${totalRowIndex-1})`, v: productItems.reduce((acc, curr) => acc + curr.qty, 0), z: '#,##0', s: totalStyleRight };
    ws[`E${totalRowIndex}`] = { t: 's', v: '', s: totalStyle };
    ws[`F${totalRowIndex}`] = { t: 'n', f: `SUM(F6:F${totalRowIndex-1})`, v: productItems.reduce((acc, curr) => acc + curr.amount, 0), z: '"$"#,##0.00', s: totalStyleRight };
    ws[`G${totalRowIndex}`] = { t: 's', v: '', s: totalStyle };
    
    ws['O2'] = { t: 'n', v: parseFloat(document.getElementById("prodTotalImpuestos").value) || 0, z: '"$"#,##0.00' };
    ws['O3'] = { t: 'n', v: parseFloat(document.getElementById("prodTotalServicios").value) || 0, z: '"$"#,##0.00' };

    ws['!merges'] = [
        { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } }
    ];

    ws['!cols'] = [
        { wch: 6 },  // A: No.
        { wch: 35 }, // B: DESCRIPTION
        { wch: 20 }, // C: Product Image
        { wch: 13 }, // D: QTY
        { wch: 30 }, // E: EXW(USD)
        { wch: 30 }, // F: AMOUNT
        { wch: 50 }, // G: PRECIO UNITARIO (Visible)
        { wch: 15, hidden: true }, // H: IMPUESTOS (Hidden)
        { wch: 22, hidden: true }, // I: SERVICIOS LOGISTICOS (Hidden)
        { wch: 18, hidden: true }, // J: PRECIO TOTAL (Hidden)
        { wch: 15, hidden: true }, // K: IMPUESTOS DE ADUANA (Hidden)
        { wch: 15, hidden: true }, // L: SERVICIOS LOGISTICOS (Hidden)
        { wch: 15, hidden: true }, // M: PRECIO TOTAL ALMACEN (Hidden)
        { wch: 15, hidden: true }, // N: PRECIO UNITARIO ALMACEN (Hidden)
        { wch: 15, hidden: true }, // O: TOTALS PARAMS (Hidden)
        { wch: 10, hidden: true }  // P: PRORATE FACTOR (Hidden)
    ];

    const rowHeights = [];
    rowHeights.push({ hpt: 18 }); // Row 1
    rowHeights.push({ hpt: 20 }); // Row 2
    rowHeights.push({ hpt: 20 }); // Row 3
    rowHeights.push({ hpt: 24 }); // Row 4
    rowHeights.push({ hpt: 28 }); // Row 5 (headers)
    for (let i = 0; i < productItems.length; i++) {
        rowHeights.push({ hpt: 20 }); // Row 6+
    }
    rowHeights.push({ hpt: 24 }); // Totals Row
    ws['!rows'] = rowHeights;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Table 1");
    
    const filename = clientVal ? `Precio_Unitario_Productos_${clientVal.replace(/\s+/g, "_")}.xlsx` : `Precio_Unitario_Productos.xlsx`;
    XLSX.writeFile(wb, filename);
}

function printProductsPdf() {
    const today = new Date();
    const formatDate = (date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };
    
    document.getElementById("pdfFechaProd").textContent = formatDate(today);
    
    const prodClientEl = document.getElementById("prodCliente");
    const clientVal = prodClientEl ? prodClientEl.value.trim() : "";
    document.getElementById("pdfClienteNombreProd").textContent = clientVal;
    
    const totalTaxes = parseFloat(document.getElementById("prodTotalImpuestos").value) || 0;
    const totalServices = parseFloat(document.getElementById("prodTotalServicios").value) || 0;
    
    document.getElementById("pdfTotalImpuestosProd").textContent = `$ ${totalTaxes.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById("pdfTotalServiciosProd").textContent = `$ ${totalServices.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    const pdfTbody = document.getElementById("pdfProductsTableBody");
    if (pdfTbody) {
        pdfTbody.innerHTML = "";
        
        let totalQty = 0;
        let totalEXW = 0;
        let totalLanded = 0;
        
        productItems.forEach((item, idx) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="padding: 4px; text-align: center;">${idx + 1}</td>
                <td style="padding: 4px;">${escapeHtml(item.description)}</td>
                <td style="padding: 4px; text-align: right;">${item.qty}</td>
                <td style="padding: 4px; text-align: right;">$ ${item.exw.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="padding: 4px; text-align: right;">$ ${item.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="padding: 4px; text-align: right; font-weight: 700; background-color: #f0fdf4;">$ ${item.unitLandedCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            `;
            pdfTbody.appendChild(tr);
            
            totalQty += item.qty;
            totalEXW += item.amount;
            totalLanded += item.landedTotal;
        });
        
        document.getElementById("pdfTotalQtyProd").textContent = totalQty;
        document.getElementById("pdfTotalAmountProd").textContent = `$ ${totalEXW.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById("pdfTotalLandedCostProd").textContent = "";
    }
    
    const pdfEmpresa = document.getElementById("admPdfEmpresa") ? document.getElementById("admPdfEmpresa").value : "MSI ADUANAS PERU CARGO S.A.C.";
    const pdfSub1 = document.getElementById("admPdfSub1") ? document.getElementById("admPdfSub1").value : "RUC: 20609799316 | Av. Elmer Faucett 150, Callao - Perú";
    const pdfSub2 = document.getElementById("admPdfSub2") ? document.getElementById("admPdfSub2").value : "Contacto: cotizaciones@msicargo.com | Tel: (01) 451-9988";
    
    if (document.getElementById("pdfEmpresaNombreProd")) document.getElementById("pdfEmpresaNombreProd").textContent = pdfEmpresa;
    if (document.getElementById("pdfEmpresaSub1Prod")) document.getElementById("pdfEmpresaSub1Prod").textContent = pdfSub1;
    if (document.getElementById("pdfEmpresaSub2Prod")) document.getElementById("pdfEmpresaSub2Prod").textContent = pdfSub2;
    
    const sanitizeFilename = (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-zA-Z0-9\s-_]/g, "")
                  .trim()
                  .replace(/\s+/g, "_");
    };
    
    const clientClean = sanitizeFilename(clientVal);
    const originalTitle = document.title;
    
    let docTitle = `Precio_Unitario_Productos`;
    if (clientClean) {
        docTitle += `_${clientClean}`;
    }
    document.title = docTitle;
    
    // Inject dynamic print page style for products list (A4 with 22mm bottom margin)
    const styleEl = document.createElement("style");
    styleEl.id = "print-products-page-style";
    styleEl.innerHTML = `
        @page {
            size: A4 portrait;
            margin: 10mm 10mm 22mm 10mm !important;
        }
    `;
    document.head.appendChild(styleEl);
    
    document.body.classList.add("print-products");
    
    window.print();
    
    document.body.classList.remove("print-products");
    
    // Remove dynamic page style
    const styleElToRemove = document.getElementById("print-products-page-style");
    if (styleElToRemove) {
        styleElToRemove.remove();
    }
    
    document.title = originalTitle;
}

