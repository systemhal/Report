import os
from fpdf import FPDF

class MSICargoPDF(FPDF):
    def header(self):
        # Insertar logotipo de la empresa en la cabecera
        logo_path = 'icono.jpeg'
        if os.path.exists(logo_path):
            self.image(logo_path, 10, 8, 16)
        
        # Título de la cabecera
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(17, 24, 39) # Negro Pizarra #111827
        self.cell(20) # Espacio para el logo
        self.cell(100, 6, 'MSI ADUANAS PERU CARGO SAC', ln=0, align='L')
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(107, 114, 128) # Gris
        self.cell(0, 6, 'Manual de Costeo e Importaciones - Guia de Campos', ln=1, align='R')
        
        # Linea divisoria roja (MSI)
        self.set_draw_color(220, 38, 38) # Rojo #dc2626
        self.set_line_width(0.5)
        self.line(10, 26, 200, 26)
        self.ln(8)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(229, 231, 235) # Gris claro
        self.line(10, self.get_y(), 200, self.get_y())
        
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(156, 163, 175) # Gris claro
        self.cell(100, 10, 'Guia Explicativa de Costeo Aduanero SUNAT - MSI Cargo', 0, 0, 'L')
        self.cell(0, 10, f'Pagina {self.page_no()}', 0, 0, 'R')

def generate_report():
    pdf = MSICargoPDF(orientation='P', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    
    # -------------------------------------------------------------
    # Titulo Principal del Reporte
    # -------------------------------------------------------------
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 8, 'GUIA EXPLICATIVA DE COSTEO DE IMPORTACION', ln=1, align='C')
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(220, 38, 38) # Rojo
    pdf.cell(0, 5, 'Descripcion de Campos, Formulas de Calculo y Caso Practico Resuelto', ln=1, align='C')
    pdf.ln(5)
    
    # -------------------------------------------------------------
    # 1. Introduccion
    # -------------------------------------------------------------
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(17, 24, 39)
    pdf.set_fill_color(249, 235, 234) # Rojo claro #F9EBEA
    pdf.cell(0, 7, ' 1. Introduccion al Sistema de Costeo', ln=1, fill=True)
    pdf.ln(2)
    
    pdf.set_font('Helvetica', '', 9.5)
    pdf.set_text_color(55, 65, 81) # Carbón
    intro_text = (
        "El sistema de costeo de MSI ADUANAS PERU CARGO SAC es una herramienta diseñada para evaluar "
        "la viabilidad financiera de una importacion en Peru. Permite calcular con precision aduanera "
        "el costo real de internamiento de mercancías (Landed Cost) y proyectar precios de venta sugeridos "
        "de acuerdo a los margenes netos deseados.\n\n"
        "Esta guia explica de manera sencilla cada campo de entrada del cotizador, la forma en que "
        "interactuan los valores y la formula matematica exacta detras de cada resultado, siguiendo "
        "la legislacion tributaria de la SUNAT en el Peru."
    )
    pdf.multi_cell(0, 4.5, intro_text)
    pdf.ln(4)

    # -------------------------------------------------------------
    # 2. Diccionario de Campos de Entrada (Inputs)
    # -------------------------------------------------------------
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 7, ' 2. Diccionario de Campos de Entrada (Datos de Importacion)', ln=1, fill=True)
    pdf.ln(2)
    
    inputs_desc = [
        ("Nombre del Producto", "Identifica comercialmente el articulo a importar. No afecta los calculos matematicos, sirve de referencia en cotizaciones y listados."),
        ("Valor FOB Total (USD)", "El valor neto del producto en el puerto de embarque extranjero, segun factura comercial. No incluye flete, seguro, ni gastos en Peru."),
        ("Cantidad (Uds)", "El numero total de unidades que componen el embarque de este producto. Se utiliza para prorratear costos logisticos y obtener el costo unitario final."),
        ("Peso Neto Total (kg)", "La masa total fisica de los productos en kilogramos. Es una variable critica para calcular el flete internacional y los gastos locales de manipuleo."),
        ("Volumen Total (CBM / m3)", "El espacio cubico que ocupa la carga. En el transporte maritimo consolidado (LCL), es la medida principal de cobro de flete."),
        ("Tipo de Transporte", "Permite elegir entre 'Maritimo (LCL)' o 'Aereo'. Modifica las tarifas base del flete internacional y los parametros de cobro de gastos locales."),
        ("Origen", "La region de procedencia del embarque (China, EEUU, Europa, Otros). Aplica recargos logisticos en el flete segun la distancia del trayecto."),
        ("Arancel Ad-Valorem (%)", "El impuesto a la importacion cobrado en la aduana peruana (tasas oficiales de SUNAT: 0%, 4%, 6%, 11%), aplicado sobre el Valor CIF."),
        ("Percepcion IGV SUNAT", "Mecanismo de cobro anticipado del IGV local en aduanas. Tasas aplicables: 10% (primera importacion), 3.5% (importador frecuente) o 5% (bienes usados)."),
        ("Margen Deseado (%)", "El porcentaje de ganancia neto proyectado que la empresa desea obtener sobre el precio de venta final de cada producto (Margen sobre Ventas)."),
        ("Tipo de Cambio (S/.)", "Tasa oficial del dolar respecto al sol peruano para la conversion monetaria simultanea en la visualizacion de resultados.")
    ]
    
    for title, desc in inputs_desc:
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(220, 38, 38) # Rojo
        pdf.cell(45, 4.5, f"  {title}:", ln=0)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(55, 65, 81)
        pdf.multi_cell(0, 4.5, desc)
        pdf.ln(1)
        
    pdf.ln(3)

    # -------------------------------------------------------------
    # 3. Diccionario de Resultados (Outputs)
    # -------------------------------------------------------------
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 7, ' 3. Diccionario de Campos de Salida (Resultados)', ln=1, fill=True)
    pdf.ln(2)
    
    outputs_desc = [
        ("Flete Internacional", "El costo de transportar la carga desde el puerto de origen al puerto de destino (Callao). Se calcula comparando el peso y volumen logistico."),
        ("Seguro de Aduanas (1.5%)", "El costo estimado de la prima del seguro. SUNAT exige declarar seguro; si no se tiene poliza individual, se calcula una tasa estimada sobre (FOB + Flete)."),
        ("Valor CIF (Aduanas)", "La suma de FOB + Flete + Seguro. Es la base imponible legal que la aduana utiliza para liquidar los impuestos y derechos de importacion."),
        ("Arancel Ad-Valorem (USD)", "Monto en dolares de los derechos arancelarios cobrados en aduana. Se calcula multiplicando el Valor CIF por la tasa del arancel seleccionada."),
        ("IGV (16%) + IPM (2%)", "Los impuestos locales peruanos unificados en aduanas (18% total). Se aplican sobre la base gravable compuesta por la suma de (Valor CIF + Arancel)."),
        ("Gastos Operativos Locales", "Suma de los costos logisticos locales en el Peru: honorarios del agente de aduanas (minimo preestablecido o comision sobre CIF), almacenamiento y transporte local."),
        ("Percepcion IGV (SUNAT)", "Monto cobrado por aduana como adelanto del IGV local. Se aplica sobre la suma total de (CIF + Arancel + IGV/IPM) multiplicada por la tasa de percepcion."),
        ("Desembolso de Caja Total", "La cantidad total de efectivo que la empresa debe desembolsar para cubrir todo el proceso (FOB + flete + seguro + arancel + IGV + gastos locales + percepcion)."),
        ("Costo Unitario en Almacen", "Costo neto de internamiento por unidad. Se calcula sumando CIF + Arancel + Gastos Locales y dividiendo entre la cantidad. Excluye impuestos recuperables."),
        ("Precio Venta Sugerido", "El precio unitario de venta (sin IGV local) sugerido para el mercado. Garantiza que la empresa recupere el costo y obtenga exactamente el % de margen neto deseado.")
    ]
    
    for title, desc in outputs_desc:
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(17, 24, 39) # Negro
        pdf.cell(45, 4.5, f"  {title}:", ln=0)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(55, 65, 81)
        pdf.multi_cell(0, 4.5, desc)
        pdf.ln(1)

    pdf.ln(3)

    # -------------------------------------------------------------
    # 4. Formulas de Calculo e Interaccion
    # -------------------------------------------------------------
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 7, ' 4. Formulas de Calculo e Interaccion entre Campos', ln=1, fill=True)
    pdf.ln(2)
    
    pdf.set_font('Helvetica', '', 9.5)
    pdf.set_text_color(55, 65, 81)
    pdf.multi_cell(0, 4.5, 
        "Las formulas se ejecutan en cascada (cada calculo hereda el resultado del anterior). "
        "A continuacion se detallan las formulas matematicas empleadas en el sistema:"
    )
    pdf.ln(2)
    
    formulas = [
        ("Flete Internacional", "Si el Transporte es Maritimo, se toma: MAX(Volumen * Tarifa CBM, (Peso/1000) * Tarifa Tonelada) * Recargo Origen. Si es Aereo: Peso * Tarifa Aerea * Recargo Origen."),
        ("Seguro de Aduanas", "Seguro = (Valor FOB + Flete Internacional) * Tasa de Seguro (1.5% o Seg. Tabla)."),
        ("Valor CIF (Base de Impuestos)", "CIF = Valor FOB + Flete Internacional + Seguro de Aduanas."),
        ("Derechos Arancelarios", "Arancel = Valor CIF * Tasa Ad-Valorem % (0%, 4%, 6% u 11%)."),
        ("IGV (16%) + IPM (2%) (18% Total)", "IGV_IPM = (Valor CIF + Arancel) * 18%."),
        ("Gastos Operativos Locales", "Gastos = MAX(CIF * Tarifa Agente %, Minimo Agente) + Gastos Fijos Locales (Almacen, Flete Local, Gastos Bancarios/Admin)."),
        ("Percepcion IGV (Crédito Fiscal)", "Percepcion = (Valor CIF + Arancel + IGV_IPM) * Tasa Percepcion % (10%, 3.5% o 5%)."),
        ("Costo Total en Almacen (Neto)", "Costo Almacen = Valor CIF + Arancel + Gastos Operativos Locales.\n(IMPORTANTE: Se excluyen IGV, IPM y Percepcion porque se recuperan como credito fiscal neto en las ventas)."),
        ("Costo Unitario en Almacen", "Costo Unitario = Costo Total en Almacen / Cantidad."),
        ("Precio de Venta Sugerido (Sin IGV)", "Precio Venta (USD) = Costo Unitario / (1 - Margen Deseado %).\nPrecio Venta (PEN) = Precio Venta (USD) * Tipo de Cambio."),
        ("Desembolso de Caja Total (Efectivo)", "Desembolso = Costo Total en Almacen + IGV_IPM + Percepcion.\nIndica el dinero necesario para pagar al proveedor, aduanas y logistica local.")
    ]
    
    for title, formula in formulas:
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(220, 38, 38)
        pdf.cell(55, 4.5, f"  {title}:", ln=0)
        pdf.set_font('Helvetica', 'I', 9)
        pdf.set_text_color(31, 41, 55)
        pdf.multi_cell(0, 4.5, formula)
        pdf.ln(1)

    # -------------------------------------------------------------
    # 5. Caso Practico Resuelto
    # -------------------------------------------------------------
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 7, ' 5. Caso Practico Resuelto (Simulacion de Audifonos Bluetooth)', ln=1, fill=True)
    pdf.ln(2)
    
    pdf.set_font('Helvetica', '', 9.5)
    pdf.set_text_color(55, 65, 81)
    pdf.multi_cell(0, 4.5, 
        "Tomando como base los datos de la simulacion interactiva presentados en la pantalla, "
        "se detalla el desarrollo numerico completo paso a paso:"
    )
    pdf.ln(2.5)
    
    # Tabla de Datos de Entrada en el caso practico
    pdf.set_font('Helvetica', 'B', 9.5)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(95, 5, 'DATOS DE ENTRADA INGRESADOS', ln=0, align='L')
    pdf.cell(95, 5, 'VALORES BASE LOGISTICA', ln=1, align='L')
    pdf.ln(1)
    
    pdf.set_font('Helvetica', '', 9)
    inputs_vals = [
        ("Producto: Audifonos Bluetooth Premium", "Tarifa Flete Maritimo: $110 USD / CBM"),
        ("Valor FOB Total: $3,500.00 USD", "Minimo Flete Maritimo: $80 USD / Ton"),
        ("Cantidad: 100 unidades", "Seguro Estimado SUNAT: 1.5%"),
        ("Peso Total: 85.00 kg (0.085 Ton)", "Comision Agente Aduanas: 0.5% (Minimo $200)"),
        ("Volumen Total: 0.65 CBM (m3)", "Gastos Locales Fijos: $675.00 USD"),
        ("Transporte: Maritimo (LCL) / Origen: China", "Tipo de Cambio: S/ 3.45"),
        ("Arancel: 6% / Percepcion: Frecuente (3.5%) / Margen: 35%", "Impuesto Local Fijo: IGV + IPM = 18%")
    ]
    
    for left, right in inputs_vals:
        pdf.cell(95, 4, f" - {left}", ln=0)
        pdf.cell(95, 4, f" - {right}", ln=1)
    pdf.ln(4)
    
    # Desarrollo Matemático
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 5, 'DESARROLLO PASO A PASO:', ln=1)
    pdf.ln(1)
    
    pdf.set_font('Helvetica', '', 9.5)
    pdf.set_text_color(55, 65, 81)
    
    steps = [
        ("1. Flete Internacional", "Se compara cobro por peso y volumen. Volumen (0.65 CBM * $110 = $71.50 USD) vs Peso (0.085 Ton * $80 = $6.80 USD). Se toma el mayor. Flete = $71.50 USD."),
        ("2. Seguro de Aduanas", "Seguro = (FOB + Flete) * 1.5% = ($3,500.00 + $71.50) * 0.015 = $53.57 USD."),
        ("3. Valor CIF", "CIF = FOB + Flete + Seguro = $3,500.00 + $71.50 + $53.57 = $3,625.07 USD."),
        ("4. Derechos Arancelarios", "Ad-Valorem = Valor CIF * 6% = $3,625.07 * 0.06 = $217.50 USD."),
        ("5. Impuestos (IGV + IPM)", "IGV (16%) + IPM (2%) = (CIF + Arancel) * 18% = ($3,625.07 + $217.50) * 0.18 = $691.66 USD."),
        ("6. Gastos Operativos Locales", "Comision Agente = CIF * 0.5% = $18.13 USD. Al ser menor al minimo ($200), se cobra el minimo de $200. Se suman los gastos fijos ($675). Gastos Locales = $200.00 + $675.00 = $875.00 USD."),
        ("7. Percepcion del IGV", "Percepcion = (CIF + Arancel + IGV_IPM) * 3.5% = ($3,625.07 + $217.50 + $691.66) * 0.035 = $158.70 USD."),
        ("8. Costo Real en Almacen", "Costo Total = CIF + Arancel + Gastos Locales = $3,625.07 + $217.50 + $875.00 = $4,717.57 USD. (No incluye IGV ni Percepcion por ser creditos).\nCosto Unitario = $4,717.57 / 100 uds = $47.18 USD (En Soles: $47.18 * 3.45 = S/ 162.76)."),
        ("9. Precio Sugerido de Venta", "Precio Venta (USD) = Costo Unitario / (1 - 0.35) = $47.18 / 0.65 = $72.58 USD (En Soles: $72.58 * 3.45 = S/ 250.39)."),
        ("10. Desembolso Caja de Caja", "Desembolso = Costo Total ($4,717.57) + IGV_IPM ($691.66) + Percepcion ($158.70) = $5,567.94 USD.")
    ]
    
    for num, txt in steps:
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(17, 24, 39)
        pdf.cell(50, 4.5, f"  {num}:", ln=0)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(55, 65, 81)
        pdf.multi_cell(0, 4.5, txt)
        pdf.ln(1)
        
    pdf.ln(4)
    
    # Mensaje Final de Certificación de la Guía
    pdf.set_draw_color(220, 38, 38)
    pdf.set_fill_color(249, 235, 234)
    pdf.rect(10, pdf.get_y(), 190, 15, style='FD')
    pdf.set_y(pdf.get_y() + 2)
    pdf.set_font('Helvetica', 'B', 8.5)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 4, 'NOTA DE MSI ADUANAS PERU CARGO SAC:', ln=1, align='C')
    pdf.set_font('Helvetica', 'I', 8.5)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(0, 4, 'Los calculos anteriores siguen estrictamente el marco normativo aduanero peruano vigente ante la SUNAT.', ln=1, align='C')

    # Guardar archivo
    output_filename = "Especificacion_Sistema_MSI.pdf"
    pdf.output(output_filename)
    print(f"Archivo PDF creado exitosamente en: '{output_filename}'")

if __name__ == "__main__":
    generate_report()
