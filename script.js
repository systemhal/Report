/* ==========================================================================
   ImportCalc JavaScript Engine - script.js
   ========================================================================== */

// Global state variables
let indChartInstance = null;
let multiChartInstance = null;

// Default products array for multi-product prorating
let products = [
    {
        id: 1,
        sku: "SKU-9081",
        description: "Smartphones Android 12",
        qty: 200,
        fobUnit: 150.00,
        pesoUnit: 0.25,
        volUnit: 0.002,
        arancel: 0.00,
        margen: 35
    },
    {
        id: 2,
        sku: "SKU-4402",
        description: "Fundas de Silicona TPU",
        qty: 1500,
        fobUnit: 1.20,
        pesoUnit: 0.04,
        volUnit: 0.0005,
        arancel: 0.06,
        margen: 40
    },
    {
        id: 3,
        sku: "SKU-5211",
        description: "Cargadores Inalámbricos 15W",
        qty: 800,
        fobUnit: 8.50,
        pesoUnit: 0.12,
        volUnit: 0.001,
        arancel: 0.06,
        margen: 35
    }
];

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    // Set up event listeners for Individual Calculator
    const indInputs = [
        "indFob", "indCantidad", "indPeso", "indVolumen", 
        "indTransporte", "indOrigen", "indArancel", "indPercepcion", 
        "indMargen", "indTipoCambio", "indProducto"
    ];
    
    indInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", calculateIndividual);
            el.addEventListener("change", calculateIndividual);
        }
    });

    // Set up event listeners for Prorrateo Calculator
    const proGlobalInputs = [
        "proFleteFactura", "proSeguroFactura", "proGastosLocales", 
        "proMetodoFlete", "proPercepcionTasa", "proTipoCambio"
    ];
    
    proGlobalInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", calculateProrrateo);
            el.addEventListener("change", calculateProrrateo);
        }
    });

    // Initialize UI
    renderProductRows();
    calculateIndividual();
    calculateProrrateo();
});

// Tab Switcher
function switchTab(tabName) {
    // Toggle active buttons
    document.getElementById("tabIndividual").classList.toggle("active", tabName === "individual");
    document.getElementById("tabProrrateo").classList.toggle("active", tabName === "prorrateo");
    document.getElementById("tabGuia").classList.toggle("active", tabName === "guia");

    // Toggle active content divs
    document.getElementById("contentIndividual").classList.toggle("active", tabName === "individual");
    document.getElementById("contentProrrateo").classList.toggle("active", tabName === "prorrateo");
    document.getElementById("contentGuia").classList.toggle("active", tabName === "guia");
    
    // Recalculate and refresh charts
    if (tabName === "individual") {
        calculateIndividual();
    } else if (tabName === "prorrateo") {
        calculateProrrateo();
    }
}

// --------------------------------------------------------------------------
// INDIVIDUAL CALCULATOR LOGIC
// --------------------------------------------------------------------------
function calculateIndividual() {
    const fob = parseFloat(document.getElementById("indFob").value) || 0;
    const qty = parseInt(document.getElementById("indCantidad").value) || 1;
    const peso = parseFloat(document.getElementById("indPeso").value) || 0;
    const volumen = parseFloat(document.getElementById("indVolumen").value) || 0;
    const transporte = document.getElementById("indTransporte").value;
    const origen = document.getElementById("indOrigen").value;
    const arancelRate = parseFloat(document.getElementById("indArancel").value) || 0;
    const percepcionRate = parseFloat(document.getElementById("indPercepcion").value) || 0;
    const margen = parseFloat(document.getElementById("indMargen").value) || 0;
    const tc = parseFloat(document.getElementById("indTipoCambio").value) || 3.78;

    // 1. Flete Internacional
    let flete = 0;
    const tarifaInfoEl = document.getElementById("indTarifaInfo");
    if (transporte === "maritimo") {
        if (tarifaInfoEl) {
            tarifaInfoEl.innerText = "Tarifa: $110.00 / CBM o $130.00 / Ton";
        }
        // LCL Maritime: max of (Volumen * 110 USD, Peso/1000 * 130 USD)
        const fleteVol = volumen * 110;
        const fletePeso = (peso / 1000) * 130;
        flete = Math.max(fleteVol, fletePeso);
    } else {
        if (tarifaInfoEl) {
            tarifaInfoEl.innerText = "Tarifa: $4.80 / kg";
        }
        // Aéreo: Peso * 4.80 USD
        flete = peso * 4.80;
    }

    // Origen Adjustment
    const origenInfoEl = document.getElementById("indOrigenInfo");
    if (origen === "europa") {
        flete *= 1.2;
        if (origenInfoEl) origenInfoEl.innerText = "Recargo flete: +20% (Tránsito Europa)";
    } else if (origen === "eeuu") {
        flete *= 1.1;
        if (origenInfoEl) origenInfoEl.innerText = "Recargo flete: +10% (Tránsito América)";
    } else {
        if (origenInfoEl) origenInfoEl.innerText = "Recargo flete: Ninguno (+0%)";
    }

    // 2. Seguro (1.5% of FOB + Flete)
    const seguro = (fob + flete) * 0.015;

    // 3. Valor CIF
    const cif = fob + flete + seguro;

    // 4. Arancel Ad-Valorem
    const advalorem = cif * arancelRate;

    // 5. Impuestos (IGV 16% + IPM 2% = 18%)
    const baseImpuestos = cif + advalorem;
    const igvIpm = baseImpuestos * 0.18;

    // 6. Gastos Operativos Locales (Brokerage + Fixed Logistical expenses)
    // Brokerage: 0.5% of CIF, min 200 USD.
    const comisionAgente = Math.max(200, cif * 0.005);
    // Sum of fixed expenses: APM/DPW (180) + Almacenaje (150) + Flete Interno (220) + Banco (45) + Admin (80) = 675 USD
    const gastosFijos = 675;
    const gastosLocales = comisionAgente + gastosFijos;

    // 7. Percepción del IGV SUNAT (paid on CIF + Arancel + IGV/IPM)
    const percepcion = (baseImpuestos + igvIpm) * percepcionRate;

    // 8. Costo Total en Almacén (FOB + Flete + Seguro + Arancel + Gastos Locales)
    // Note: IGV, IPM, and Percepcion are excluded from landed product cost since they are tax credits.
    const costoAlmacenTotal = cif + advalorem + gastosLocales;
    const costoUnitarioUsd = costoAlmacenTotal / qty;
    const costoUnitarioPen = costoUnitarioUsd * tc;

    // 9. Desembolso total de caja (includes tax credits paid at customs)
    const cajaTotal = costoAlmacenTotal + igvIpm + percepcion;

    // 10. Precio de Venta Sugerido (USD)
    // Price = Cost / (1 - Margin%)
    const precioVentaUsd = margen < 100 ? (costoUnitarioUsd / (1 - (margen / 100))) : costoUnitarioUsd;
    const precioVentaPen = precioVentaUsd * tc;

    // Suggested Consumer Price (includes local IGV 18%)
    const precioPublicoPen = precioVentaPen * 1.18;

    // 11. Utilidad comercial estimada
    const utilidadTotal = (precioVentaUsd - costoUnitarioUsd) * qty;

    // Update UI elements
    document.getElementById("resIndCostoUnitUsd").textContent = formatCurrency(costoUnitarioUsd, "USD");
    document.getElementById("resIndCostoUnitPen").textContent = formatCurrency(costoUnitarioPen, "PEN");
    document.getElementById("resIndPrecioVentaUsd").textContent = formatCurrency(precioVentaUsd, "USD");
    document.getElementById("resIndPrecioVentaPen").textContent = formatCurrency(precioVentaPen, "PEN");
    
    document.getElementById("resIndFlete").textContent = formatCurrency(flete, "USD");
    document.getElementById("resIndSeguro").textContent = formatCurrency(seguro, "USD");
    document.getElementById("resIndCif").textContent = formatCurrency(cif, "USD");
    document.getElementById("resIndAdvalorem").textContent = formatCurrency(advalorem, "USD");
    document.getElementById("resIndIgvIpm").textContent = formatCurrency(igvIpm, "USD");
    document.getElementById("resIndGastosLocales").textContent = formatCurrency(gastosLocales, "USD");
    document.getElementById("resIndPercepcionVal").textContent = formatCurrency(percepcion, "USD");
    document.getElementById("resIndCajaTotal").textContent = formatCurrency(cajaTotal, "USD");

    // Update chart
    updateIndividualChart(fob, flete, seguro, advalorem, gastosLocales);
}

function updateIndividualChart(fob, flete, seguro, advalorem, gastosLocales) {
    const ctx = document.getElementById("indChart").getContext("2d");
    
    const chartData = [fob, flete, seguro, advalorem, gastosLocales];
    const chartLabels = ["Valor FOB", "Flete Internacional", "Seguro de Aduana", "Derechos Arancelarios", "Gastos Locales Despacho"];
    
    if (indChartInstance) {
        indChartInstance.data.datasets[0].data = chartData;
        indChartInstance.update();
    } else {
        indChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: [
                        '#111827', // FOB (Charcoal Black)
                        '#dc2626', // Flete (MSI Red)
                        '#f87171', // Seguro (Light Coral Red)
                        '#4b5563', // Arancel (Medium Gray)
                        '#9ca3af'  // Gastos Locales (Light Gray)
                    ],
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
// MULTI-PRODUCT PRORATING LOGIC
// --------------------------------------------------------------------------
function renderProductRows() {
    const tbody = document.getElementById("tableBodyProducts");
    tbody.innerHTML = "";

    products.forEach((product, index) => {
        const tr = document.createElement("tr");
        tr.id = `row-${product.id}`;
        
        tr.innerHTML = `
            <td class="col-actions">
                <button type="button" class="btn-delete" onclick="removeProductRow(${product.id})" title="Eliminar Producto">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
            <td class="col-sku">
                <input type="text" class="table-input" value="${product.sku}" oninput="updateProductField(${product.id}, 'sku', this.value)">
            </td>
            <td class="col-desc">
                <input type="text" class="table-input" value="${product.description}" oninput="updateProductField(${product.id}, 'description', this.value)">
            </td>
            <td class="col-qty">
                <input type="number" class="table-input num-input" value="${product.qty}" min="1" step="1" oninput="updateProductField(${product.id}, 'qty', parseInt(this.value) || 0)">
            </td>
            <td class="col-fob">
                <input type="number" class="table-input num-input" value="${product.fobUnit}" min="0" step="0.01" oninput="updateProductField(${product.id}, 'fobUnit', parseFloat(this.value) || 0)">
            </td>
            <td class="col-peso">
                <input type="number" class="table-input num-input" value="${product.pesoUnit}" min="0" step="0.01" oninput="updateProductField(${product.id}, 'pesoUnit', parseFloat(this.value) || 0)">
            </td>
            <td class="col-vol">
                <input type="number" class="table-input num-input" value="${product.volUnit}" min="0" step="0.0001" oninput="updateProductField(${product.id}, 'volUnit', parseFloat(this.value) || 0)">
            </td>
            <td class="col-arancel">
                <select class="table-input" onchange="updateProductField(${product.id}, 'arancel', parseFloat(this.value) || 0)">
                    <option value="0.00" ${product.arancel === 0.00 ? 'selected' : ''}>0%</option>
                    <option value="0.04" ${product.arancel === 0.04 ? 'selected' : ''}>4%</option>
                    <option value="0.06" ${product.arancel === 0.06 ? 'selected' : ''}>6%</option>
                    <option value="0.11" ${product.arancel === 0.11 ? 'selected' : ''}>11%</option>
                </select>
            </td>
            <td class="col-margen">
                <input type="number" class="table-input num-input" value="${product.margen}" min="0" max="99" step="1" oninput="updateProductField(${product.id}, 'margen', parseInt(this.value) || 0)">
            </td>
            <td class="col-fob-tot text-right" id="rowFobTotal-${product.id}">$0.00</td>
            <td class="col-cost-unit text-right highlighted-col" id="rowCostoUnitUsd-${product.id}">$0.00</td>
            <td class="col-venta text-right highlighted-col" id="rowPrecioVentaPen-${product.id}">S/. 0.00</td>
            <td class="col-util text-right" id="rowUtilidadUsd-${product.id}">$0.00</td>
        `;
        tbody.appendChild(tr);
    });
}

function addProductRow() {
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({
        id: newId,
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        description: "Nuevo Producto Importado",
        qty: 100,
        fobUnit: 10.00,
        pesoUnit: 0.5,
        volUnit: 0.005,
        arancel: 0.06,
        margen: 30
    });
    renderProductRows();
    calculateProrrateo();
}

function removeProductRow(id) {
    if (products.length <= 1) {
        alert("Debe mantener al menos un producto en el cuadro de costeo.");
        return;
    }
    products = products.filter(p => p.id !== id);
    renderProductRows();
    calculateProrrateo();
}

function updateProductField(id, field, value) {
    const product = products.find(p => p.id === id);
    if (product) {
        product[field] = value;
        // Silent recalculation to keep the UI snappy
        calculateProrrateo();
    }
}

function calculateProrrateo() {
    // Get general global invoices and settings
    const fleteTotalFactura = parseFloat(document.getElementById("proFleteFactura").value) || 0;
    const seguroTotalFactura = parseFloat(document.getElementById("proSeguroFactura").value) || 0;
    const gastosLocalesFactura = parseFloat(document.getElementById("proGastosLocales").value) || 0;
    const metodoProrrateoFlete = document.getElementById("proMetodoFlete").value;
    const percepcionTasa = parseFloat(document.getElementById("proPercepcionTasa").value) || 0;
    const tc = parseFloat(document.getElementById("proTipoCambio").value) || 3.78;

    // Totals counters
    let sumQty = 0;
    let sumPesoTotal = 0;
    let sumVolumenTotal = 0;
    let sumFobTotal = 0;

    // Step 1: Pre-calculate sums of inputs for allocation denominators
    products.forEach(p => {
        const pFobTotal = p.qty * p.fobUnit;
        const pPesoTotal = p.qty * p.pesoUnit;
        const pVolumenTotal = p.qty * p.volUnit;

        sumQty += p.qty;
        sumPesoTotal += pPesoTotal;
        sumVolumenTotal += pVolumenTotal;
        sumFobTotal += pFobTotal;

        // Display subtotal FOB inside row
        const fobTotalEl = document.getElementById(`rowFobTotal-${p.id}`);
        if (fobTotalEl) fobTotalEl.textContent = formatCurrency(pFobTotal, "USD");
    });

    // Handle case when sum is 0 to prevent division by zero
    const denominatorFob = sumFobTotal || 1;
    const denominatorPeso = sumPesoTotal || 1;
    const denominatorVol = sumVolumenTotal || 1;

    // Totals counters for outputs
    let sumFleteAsig = 0;
    let sumSeguroAsig = 0;
    let sumCifTotal = 0;
    let sumAdvaloremTotal = 0;
    let sumGastosLocalesTotal = 0;
    let sumCostoAlmacenTotal = 0;
    let sumUtilidadTotal = 0;
    let sumIgvIpmTotal = 0;
    let sumPercepcionTotal = 0;

    // Step 2: Loop and calculate allocation per product row
    products.forEach(p => {
        const pFobTotal = p.qty * p.fobUnit;
        const pPesoTotal = p.qty * p.pesoUnit;
        const pVolumenTotal = p.qty * p.volUnit;

        // 1. Flete allocation
        let pFlete = 0;
        if (metodoProrrateoFlete === "peso") {
            pFlete = (pPesoTotal / denominatorPeso) * fleteTotalFactura;
        } else if (metodoProrrateoFlete === "volumen") {
            pFlete = (pVolumenTotal / denominatorVol) * fleteTotalFactura;
        } else {
            pFlete = (pFobTotal / denominatorFob) * fleteTotalFactura;
        }

        // 2. Seguro allocation (prorated by FOB value ratio)
        const pSeguro = (pFobTotal / denominatorFob) * seguroTotalFactura;

        // 3. CIF Total
        const pCif = pFobTotal + pFlete + pSeguro;

        // 4. Ad-Valorem
        const pAdvalorem = pCif * p.arancel;

        // 5. Local Brokerage/despacho expenses allocation (prorated by FOB ratio)
        const pGastosLocales = (pFobTotal / denominatorFob) * gastosLocalesFactura;

        // 6. Costo Almacén Total & Unit
        const pCostoAlmacen = pCif + pAdvalorem + pGastosLocales;
        const pCostoUnitUsd = p.qty > 0 ? (pCostoAlmacen / p.qty) : 0;

        // 7. IGV + IPM (18% of CIF + AdValorem)
        const pBaseImpuestos = pCif + pAdvalorem;
        const pIgvIpm = pBaseImpuestos * 0.18;

        // 8. Percepción IGV SUNAT
        const pPercepcion = (pBaseImpuestos + pIgvIpm) * percepcionTasa;

        // 9. Pricing Suggestion
        const pPrecioVentaUsd = p.margen < 100 ? (pCostoUnitUsd / (1 - (p.margen / 100))) : pCostoUnitUsd;
        const pPrecioVentaPen = pPrecioVentaUsd * tc;

        // 10. Estimated Profit
        const pUtilidad = (pPrecioVentaUsd - pCostoUnitUsd) * p.qty;

        // Accumulate totals
        sumFleteAsig += pFlete;
        sumSeguroAsig += pSeguro;
        sumCifTotal += pCif;
        sumAdvaloremTotal += pAdvalorem;
        sumGastosLocalesTotal += pGastosLocales;
        sumCostoAlmacenTotal += pCostoAlmacen;
        sumUtilidadTotal += pUtilidad;
        sumIgvIpmTotal += pIgvIpm;
        sumPercepcionTotal += pPercepcion;

        // Render calculated row values in the table cells
        const costUnitEl = document.getElementById(`rowCostoUnitUsd-${p.id}`);
        if (costUnitEl) costUnitEl.textContent = formatCurrency(pCostoUnitUsd, "USD");

        const salePenEl = document.getElementById(`rowPrecioVentaPen-${p.id}`);
        if (salePenEl) salePenEl.textContent = formatCurrency(pPrecioVentaPen, "PEN");

        const utilUsdEl = document.getElementById(`rowUtilidadUsd-${p.id}`);
        if (utilUsdEl) utilUsdEl.textContent = formatCurrency(pUtilidad, "USD");
    });

    // Step 3: Update Table Footer Totals
    document.getElementById("totQty").textContent = formatQty(sumQty);
    document.getElementById("totPeso").textContent = sumPesoTotal.toFixed(2) + " kg";
    document.getElementById("totVol").textContent = sumVolumenTotal.toFixed(3) + " CBM";
    document.getElementById("totFob").textContent = formatCurrency(sumFobTotal, "USD");
    document.getElementById("totUtil").textContent = formatCurrency(sumUtilidadTotal, "USD");

    // Step 4: Update Global Summary Panels
    document.getElementById("sumFob").textContent = formatCurrency(sumFobTotal, "USD");
    document.getElementById("sumFlete").textContent = formatCurrency(sumFleteAsig, "USD");
    document.getElementById("sumSeguro").textContent = formatCurrency(sumSeguroAsig, "USD");
    document.getElementById("sumCif").textContent = formatCurrency(sumCifTotal, "USD");
    document.getElementById("sumAdvalorem").textContent = formatCurrency(sumAdvaloremTotal, "USD");
    document.getElementById("sumGastosLocales").textContent = formatCurrency(sumGastosLocalesTotal, "USD");
    document.getElementById("sumCostoAlmacen").textContent = formatCurrency(sumCostoAlmacenTotal, "USD");

    document.getElementById("sumIgvIpm").textContent = formatCurrency(sumIgvIpmTotal, "USD");
    document.getElementById("sumPercepcion").textContent = formatCurrency(sumPercepcionTotal, "USD");
    
    // Total cash outlay (Costo Almacen + taxes)
    const totalCajaGlobal = sumCostoAlmacenTotal + sumIgvIpmTotal + sumPercepcionTotal;
    document.getElementById("sumCajaTotal").textContent = formatCurrency(totalCajaGlobal, "USD");
    document.getElementById("sumUtilidad").textContent = formatCurrency(sumUtilidadTotal, "USD");

    // Update global doughnut chart
    updateMultiChart(sumFobTotal, sumFleteAsig, sumSeguroAsig, sumAdvaloremTotal, sumGastosLocalesTotal);
}

function updateMultiChart(fob, flete, seguro, advalorem, gastosLocales) {
    const ctx = document.getElementById("multiChart").getContext("2d");
    
    const chartData = [fob, flete, seguro, advalorem, gastosLocales];
    const chartLabels = ["FOB", "Flete", "Seguro", "Aranceles", "Gastos Locales"];
    
    if (multiChartInstance) {
        multiChartInstance.data.datasets[0].data = chartData;
        multiChartInstance.update();
    } else {
        multiChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: [
                        '#111827', // FOB (Charcoal Black)
                        '#dc2626', // Flete (MSI Red)
                        '#f87171', // Seguro (Light Coral Red)
                        '#4b5563', // Arancel (Medium Gray)
                        '#9ca3af'  // Gastos Locales (Light Gray)
                    ],
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
                cutout: '60%'
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

function formatQty(val) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0
    }).format(val);
}
