import { useEffect, useState, useMemo } from "react";
import { orderService } from "../services/orderService";
import { saleService } from "../services/saleService";
import { alertSuccess, alertError, alertConfirm } from "../services/alertService";
import { customerService } from "../services/customerService";
import {
    ArrowRight,
    ChevronLeft,
    Save,
    ShoppingCart,
    X,
    FileText, // <--- Agrega esta línea aquí
    UserPlus,    // <--- Agregado
} from "lucide-react";
import "../styles/ventas.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";

// --- 1. MOVER EL MODAL FUERA DEL COMPONENTE PRINCIPAL ---
// Esto evita que el input pierda el foco al escribir.
const ModalProductos = ({
    show,
    onClose,
    cliente,
    orderItems,
    updatePrecioVenta,
    handleCantidadChange,
    confirmarVentaModal,
    calcularTotalFila
}) => {
    // ESTADO PARA EL BUSCADOR DE PRODUCTOS
    const [searchTerm, setSearchTerm] = useState("");
    if (!show || !cliente) return null;
    // FILTRADO DINÁMICO DE PRODUCTOS
    const productosFiltrados = orderItems.filter(item =>
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return (
        <div className="modal-overlay">
            <div className="modal-content modal-ventas-xl">
                <div className="modal-header">
                    <div className="header-info">
                        <div className="client-badge">
                            <span className="client-name">{cliente.name}</span>
                            <span className="client-address">{cliente.address}</span>
                        </div>
                    </div>
                    {/* --- BUSCADOR DE PRODUCTOS --- */}
                    <div className="modal-search-wrapper" style={{ margin: '0 20px', flex: 1 }}>
                        <input
                            type="text"
                            placeholder="Buscar producto por nombre..."
                            className="input-modern"
                            style={{ width: '100%', maxWidth: '300px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button className="btn-close-modal" onClick={onClose}><X /></button>
                </div>

                <div className="modal-body">
                    <table className="modal-table-modern">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Stock</th>
                                <th>Precio Unit.</th>
                                <th>Cantidad</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* USAMOS LA LISTA FILTRADA */}
                            {productosFiltrados.map((item) => {

                                const cant = cliente.productos[item.product_id] || 0;
                                const precioVenta = cliente.preciosPersonalizados?.[item.product_id] ?? "";
                                const stockDisponible = item.quantity;
                                const tieneVenta = cant > 0;

                                return (
                                    <tr key={item.product_id} className={tieneVenta ? "row-active" : ""}>
                                        <td className="prod-name-cell">
                                            <span className="p-name">{item.product_name}</span>
                                        </td>
                                        <td>
                                            <span className={`stock-pill ${stockDisponible <= 5 ? 'low' : ''}`}>
                                                {stockDisponible}
                                            </span>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="input-modern price"
                                                placeholder="0" // Esto muestra el 0 tenue cuando no hay nada escrito
                                                value={precioVenta}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "" || /^[0-9]+$/.test(val)) {
                                                        updatePrecioVenta(item.product_id, val);
                                                    }
                                                }}
                                                onFocus={(e) => e.target.select()} // OPCIONAL: Selecciona todo al hacer click para sobrescribir rápido
                                                autoComplete="off"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className={`input-modern qty ${cant > stockDisponible ? "error" : ""}`}
                                                placeholder="0"
                                                value={cant === 0 ? "" : cant}
                                                onChange={(e) => handleCantidadChange(item.product_id, e.target.value, stockDisponible)}
                                            />
                                        </td>
                                        <td className={`subtotal-cell ${tieneVenta ? "active-amount" : ""}`}>
                                            ${(cant * (Number(precioVenta) || 0)).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="modal-footer-modern">
                    <div className="total-container">
                        <span className="total-label">TOTAL A COBRAR:</span>
                        <span className="total-amount">${calcularTotalFila(cliente).toLocaleString()}</span>
                    </div>
                    <button
                        className="btn-confirm-final"
                        onClick={confirmarVentaModal}
                        disabled={calcularTotalFila(cliente) === 0 && Number(cliente.abono_deuda) === 0}
                    >
                        Confirmar Venta y Generar PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
export default function VentasPage() {
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [orderItems, setOrderItems] = useState([]);
    const [planilla, setPlanilla] = useState([]);
    const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDay());
    // ESTADOS PARA FILTRADO DINÁMICO
    const [filterID, setFilterID] = useState("");
    const [filterVendedor, setFilterVendedor] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [showModalProductos, setShowModalProductos] = useState(false); // Para el modal de ventas
    const navigate = useNavigate(); // Inicializar el hook
    const [clienteActualIdx, setClienteActualIdx] = useState(null);
    const fechaHoy = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const [newCustomer, setNewCustomer] = useState({
        name: "",
        address: "",
        phone: "",
        afterCustomerId: "", // Para saber detrás de quién va
        visit_day: "Lunes",
        seller_id: "" // Solo lo usará el Admin
    });

    // Cerca de donde tienes el estado newCustomer
    const [searchTermPosition, setSearchTermPosition] = useState("");
    // Dentro de VentasPage, junto a los otros estados:
    const [showModalGlobal, setShowModalGlobal] = useState(false);
    const [globalSearchTerm, setGlobalSearchTerm] = useState("");
    const [allCustomers, setAllCustomers] = useState([]);
    const [showModal, setShowModal] = useState(false);




    const loadPendingOrders = async () => {
        try {
            setLoading(true);
            const queryParams = { id: user.id, role: user.role, name: user.role === 'ADMINISTRADOR' ? "" : user.name };
            const data = await orderService.getOrdersHistory(queryParams);
            setPendingOrders(data.filter(o => o.status === "DESPACHADO"));
        } catch (err) { alertError("Error", "No se cargaron los despachos."); }
        finally { setLoading(false); }
    };
    // 1. Efecto para cargar las órdenes al inicio (Ya lo tienes)
    useEffect(() => {
        loadPendingOrders();
    }, []);

    // 2. NUEVO: Efecto para PERSISTIR cambios automáticamente
    useEffect(() => {
        // Solo guardamos si hay una orden seleccionada y la planilla tiene datos
        if (selectedOrder && planilla.length > 0) {
            localStorage.setItem(`planilla_${selectedOrder.id}`, JSON.stringify(planilla));
            console.log("Cambios guardados en local.");
        }
    }, [planilla, selectedOrder]); // Se ejecuta cada vez que 'planilla' o 'selectedOrder' cambien
    //PARA CONTROL PARA PERMISOS SEGUN EL TIPO DE ROL DE USUARIO
    // Por esto:
    const user = useMemo(() => {
        const savedUser = localStorage.getItem("user");
        return savedUser ? JSON.parse(savedUser) : { id: null, role: 'INVITADO', name: '' };
    }, []);

    const ordenesFiltradas = useMemo(() => {
        return pendingOrders.filter(order => {
            if (!order.created_at) return false;

            // 1. Filtro de Día (El que ya tenías)
            const coincideDia = new Date(order.created_at).getDay() === diaSeleccionado;

            // 2. Filtro de ID (Nuevo)
            // Si el buscador está vacío, pasan todas. Si tiene texto, busca coincidencias.
            const coincideID = filterID === "" ||
                order.id.toString().includes(filterID);

            // 3. Filtro de Vendedor (Nuevo - Solo para Admin)
            const nombreVendedor = order.seller_name ? order.seller_name.toLowerCase() : "";
            const coincideVendedor = filterVendedor === "" ||
                nombreVendedor.includes(filterVendedor.toLowerCase());

            // IMPORTANTE: Retorna la suma de los tres filtros
            // Para que un despacho aparezca, debe ser del día seleccionado Y coincidir con lo que escribas
            return coincideDia && coincideID && coincideVendedor;
        });
    }, [pendingOrders, diaSeleccionado, filterID, filterVendedor]); // Agregamos las dependencias aquí
    const fetchPlanilla = async (userId, dia) => {
        try {
            // Es vital que customerService.getBalances reciba el día para que el Backend filtre
            const clientesBase = await customerService.getBalances(userId, dia);

            if (!clientesBase || clientesBase.length === 0) {
                console.warn("No hay clientes para:", dia);
                return [];
            }

            return clientesBase.map(c => ({
                id: c.id,
                name: c.customer_name,
                address: c.customer_address,
                phone: c.phone || "",
                visit_status: c.visit_status_c || "PENDIENTE",
                total_debt: Number(c.total_debt || 0),
                venta_hoy: 0,
                productos: {},
                preciosPersonalizados: {},
                position: c.position,
                visit_day: c.visit_day
            }));
        } catch (err) {
            console.error("Error en fetchPlanilla:", err);
            return [];
        }
    };
    const handleSelectOrder = async (order) => {
        try {
            setLoading(true);
            const items = await orderService.getOrderDetail(order.id);
            setOrderItems(items);

            const guardado = localStorage.getItem(`planilla_${order.id}`);

            if (guardado && guardado !== "undefined") {
                setPlanilla(JSON.parse(guardado));
            } else {
                // --- SOLUCIÓN AL UNDEFINED ---
                // 1. Intentamos sacar el día de la orden. 
                // 2. Si no existe, usamos el día seleccionado en los botones de arriba (diaSeleccionado)
                let diaParaFiltrar = order.visit_day || DIAS_SEMANA[diaSeleccionado];

                if (typeof diaParaFiltrar === 'number') {
                    diaParaFiltrar = DIAS_SEMANA[diaParaFiltrar];
                }

                console.log("Día recuperado con éxito:", diaParaFiltrar);

                // Pasamos el ID del vendedor y el día garantizado
                const inicializarPlanilla = await fetchPlanilla(order.seller_id || user.id, diaParaFiltrar);
                setPlanilla(inicializarPlanilla);
            }

            setSelectedOrder(order);
        } catch (err) {
            console.error("Error al abrir ruta:", err);
            alertError("Error", "No se pudo cargar la planilla filtrada.");
        } finally {
            setLoading(false);
        }
    };
    // PARTE DE REGISTRO DE NUEVOS CLIENTES
    const handleSaveNewCustomer = async () => {
        if (!newCustomer.name || !newCustomer.address) {
            return alertError("Error", "Nombre y dirección son obligatorios");
        }

        try {
            setLoading(true);

            const idReferencia = newCustomer.afterCustomerId;
            let posicionFinal = 1;
            let indiceInsercion = 0;

            // Calculamos la posición lógica y el índice visual en el array
            if (idReferencia && idReferencia !== "") {
                const indexPrevio = planilla.findIndex(c => String(c.id) === String(idReferencia));
                if (indexPrevio !== -1) {
                    posicionFinal = Number(planilla[indexPrevio].position) + 1;
                    indiceInsercion = indexPrevio + 1;
                }
            }

            const diaDeLaRuta = newCustomer.visit_day || selectedOrder?.visit_day || "Lunes";

            const datosParaEnviar = {
                name: newCustomer.name.toUpperCase().trim(),
                address: newCustomer.address.toUpperCase().trim(),
                phone: newCustomer.phone || "",
                visit_day: diaDeLaRuta,
                seller_id: user.id,
                position: posicionFinal
            };

            const res = await customerService.createCustomer(datosParaEnviar);

            if (res) {
                alertSuccess("Éxito", `Cliente ${res.customer_name} agregado`);

                // --- ACTUALIZACIÓN LOCAL SIN RECARGAR DEL SERVIDOR ---
                const nuevoClienteFormateado = {
                    id: res.id, // ID real de la base de datos
                    name: datosParaEnviar.name,
                    address: datosParaEnviar.address,
                    phone: datosParaEnviar.phone,
                    visit_status: "PENDIENTE",
                    total_debt: 0,
                    venta_hoy: 0,
                    productos: {},
                    preciosPersonalizados: {},
                    position: posicionFinal,
                    visit_day: diaDeLaRuta
                };

                // Creamos una copia de la planilla actual (preservando ventas ya anotadas)
                const nuevaPlanilla = [...planilla];

                // Insertamos el cliente en el lugar exacto de la lista
                nuevaPlanilla.splice(indiceInsercion, 0, nuevoClienteFormateado);

                // Actualizamos el estado y el localStorage
                setPlanilla(nuevaPlanilla);
                if (selectedOrder) {
                    localStorage.setItem(`planilla_${selectedOrder.id}`, JSON.stringify(nuevaPlanilla));
                }

                // Limpiar y cerrar
                setShowModal(false);
                setNewCustomer({
                    name: "", address: "", phone: "",
                    afterCustomerId: "", visit_day: "Lunes", seller_id: user.id
                });
            }
        } catch (err) {
            alertError("Error", err.message || "No se pudo crear el cliente");
        } finally {
            setLoading(false);
        }
    };
    // Aquí irían las funciones para guardar la ruta, confirmar ventas, etc.
    const calcularTotalFila = (cliente) => {
        // 1. Verificación de seguridad
        if (!cliente || !cliente.productos) return 0;

        return Object.entries(cliente.productos).reduce((sum, [prodId, cant]) => {
            // 2. Convertir cant a número para evitar errores de string
            const cantidad = Number(cant) || 0;
            if (cantidad <= 0) return sum;

            // 3. Buscar el producto en la carga del camión (orderItems)
            const item = orderItems.find(i => String(i.product_id) === String(prodId));

            // 4. Lógica de Precio: Manual vs Base
            const precioManual = cliente.preciosPersonalizados?.[prodId];
            const precioEfectivo = (precioManual !== undefined && precioManual !== "" && precioManual !== null)
                ? Number(precioManual)
                : (Number(item?.unit_price) || 0);

            return sum + (cantidad * precioEfectivo);
        }, 0);
    };
    const updateCelda = (idx, campo, valor) => {
        const nuevaPlanilla = [...planilla];
        const cliente = nuevaPlanilla[idx];

        cliente[campo] = valor;

        if (campo === "visit_status_c" && valor === "LLESO") {

            const totalVentaHoy = calcularTotalFila(cliente);
            const deudaPrevia = Number(cliente.total_debt || 0);
            const amountPaid = Number(cliente.amount_paid || 0);
            const abonoDeuda = 0; // No se usa abono_deuda en este caso
            const pagoHoy = amountPaid;

            const nuevoSaldo = deudaPrevia + totalVentaHoy - (pagoHoy + abonoDeuda);

            if (nuevoSaldo <= 0) {
                // ❌ NO DEBE → eliminar de planilla
                nuevaPlanilla.splice(idx, 1);
                setPlanilla(nuevaPlanilla);
                return;
            }

            // ✅ SI DEBE → se queda LLESO
            cliente.visit_status_c = "LLESO";
        }
        setPlanilla(nuevaPlanilla);
        // ✅ PASO NUEVO: Persistir el cambio inmediatamente en el storage
        // Usamos el ID de la orden seleccionada para saber qué planilla guardar
        //if (selectedOrder) {
        //   localStorage.setItem(`planilla_${selectedOrder.id}`, JSON.stringify(nuevaPlanilla));
        //}
    };
    // --- LÓGICA DE MODAL Y VENTAS ---
    const abrirModalVenta = (idx) => {
        setClienteActualIdx(idx);
        setShowModalProductos(true);
    };

    const updatePrecioVenta = (prodId, nuevoPrecio) => {
        const nuevaPlanilla = [...planilla];
        if (clienteActualIdx !== null) {
            nuevaPlanilla[clienteActualIdx].preciosPersonalizados[prodId] = nuevoPrecio;
            setPlanilla(nuevaPlanilla);
        }
    };


    const handleCantidadChange = (prodId, valor, stockDisponible) => {
        const cant = parseInt(valor) || 0;

        if (cant > stockDisponible) {
            // Esta alerta se dispara, pero el modal la tapa por CSS
            alertError("Sin Stock", `Solo hay ${stockDisponible} unidades.`);
            return;
        }

        const nuevaPlanilla = [...planilla];
        nuevaPlanilla[clienteActualIdx].productos[prodId] = cant;
        setPlanilla(nuevaPlanilla);

        // BORRAMOS la función interna que tenías aquí para evitar conflictos
    };
    // --- FUNCIÓN PARA GENERAR EL PDF (ADAPTADA A PRECIOS EDITABLES) ---
    const generarPDFVenta = (cliente) => {
        // 1. CONFIGURACIÓN DE FORMATO TICKET (80mm de ancho)
        // El largo es estimado (200), jspdf-autotable lo manejará.
        const doc = new jsPDF({
            unit: "mm",
            format: [80, 200]
        });

        const totalVentaHoy = calcularTotalFila(cliente);
        const deudaAnterior = Number(cliente.total_debt || 0);
        const abonoEfectivo = Number(cliente.amount_paid || 0);
        const saldoFinal = deudaAnterior + totalVentaHoy - abonoEfectivo;
        const pageWidth = doc.internal.pageSize.getWidth();

        // 2. ENCABEZADO TIPO TICKET
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("MAYORISTA GALLEGO", pageWidth / 2, 10, { align: "center" });

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("------------------------------------------", pageWidth / 2, 14, { align: "center" });
        doc.text(`FECHA: ${new Date().toLocaleString()}`, 5, 18);
        doc.text(`VENDEDOR: ${selectedOrder.seller_name.toUpperCase()}`, 5, 22);
        doc.text(`CLIENTE: ${cliente.name.toUpperCase()}`, 5, 26);
        doc.text(`DIR: ${cliente.address.substring(0, 35)}`, 5, 30); // Truncar si es muy larga
        doc.text("------------------------------------------", pageWidth / 2, 34, { align: "center" });

        // 3. TABLA DE PRODUCTOS ESTILO MINIMALISTA
        const tableRows = [];
        Object.entries(cliente.productos).forEach(([id, cant]) => {
            if (cant > 0) {
                const p = orderItems.find(i => String(i.product_id) === String(id));
                const precioEfectivo = cliente.preciosPersonalizados?.[id] ?? p.unit_price;
                const subtotal = cant * precioEfectivo;

                tableRows.push([
                    p.product_name,
                    cant,
                    `$${subtotal.toLocaleString()}`
                ]);
            }
        });

        autoTable(doc, {
            startY: 36,
            theme: 'plain', // Sin colores de fondo para impresora térmica
            styles: { fontSize: 7, cellPadding: 1 },
            headStyles: { fontStyle: 'bold', textColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: 35 }, // Producto
                1: { cellWidth: 10, halign: 'center' }, // Cant
                2: { cellWidth: 20, halign: 'right' }   // Total
            },
            head: [['ARTICULO', 'CANT', 'TOTAL']],
            body: tableRows,
        });

        // 4. RESUMEN FINAL (Debajo de la tabla)
        let finalY = doc.lastAutoTable.finalY + 5;

        doc.setFontSize(8);
        doc.text("------------------------------------------", pageWidth / 2, finalY, { align: "center" });
        finalY += 4;

        // Alineación derecha para los totales
        const rightAlign = pageWidth - 5;

        doc.text("DEUDA ANTERIOR:", 5, finalY);
        doc.text(`$${deudaAnterior.toLocaleString()}`, rightAlign, finalY, { align: "right" });

        finalY += 4;
        doc.text("VENTA HOY (+):", 5, finalY);
        doc.text(`$${totalVentaHoy.toLocaleString()}`, rightAlign, finalY, { align: "right" });

        finalY += 4;
        doc.text("PAGO RECIBIDO (-):", 5, finalY);
        doc.text(`$${abonoEfectivo.toLocaleString()}`, rightAlign, finalY, { align: "right" });

        finalY += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("SALDO TOTAL:", 5, finalY);
        doc.text(`$${saldoFinal.toLocaleString()}`, rightAlign, finalY, { align: "right" });

        finalY += 10;
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.text("Gracias por su compra", pageWidth / 2, finalY, { align: "center" });

        // El corte de papel simulado
        finalY += 5;
        doc.text(". . . . . . . . . . . . . . . . . . . . .", pageWidth / 2, finalY, { align: "center" });

        return doc.output('blob');
    };
    const confirmarVentaModal = () => {
        // 1. Obtener los datos actuales del cliente y la venta
        const cliente = planilla[clienteActualIdx];
        const totalVenta = calcularTotalFila(cliente);

        // 2. ACTUALIZACIÓN DE STOCK DEL CAMIÓN
        const stockActualizado = orderItems.map(item => {
            const cantidadVendida = cliente.productos[item.product_id] || 0;
            return {
                ...item,
                quantity: Math.max(0, item.quantity - cantidadVendida)
            };
        });
        setOrderItems(stockActualizado);

        // 3. LÓGICA DEL PDF Y ACTUALIZACIÓN DE PLANILLA
        if (totalVenta > 0 || Number(cliente.amount_paid) > 0) {
            try {
                const pdfBlob = generarPDFVenta(cliente);
                const pdfUrl = URL.createObjectURL(pdfBlob);

                const nuevaPlanilla = [...planilla];
                nuevaPlanilla[clienteActualIdx].facturaBlob = pdfUrl;

                // Si hubo venta, marcamos automáticamente como VISITADO para que se vea el cambio
                if (totalVenta > 0) {
                    nuevaPlanilla[clienteActualIdx].visit_status = 'VISITADO';
                }

                setPlanilla(nuevaPlanilla);
                alertSuccess("Éxito", `Venta de ${cliente.name} procesada.`);
            } catch (error) {
                console.error("Error al generar PDF:", error);
                alertError("Error", "La venta se registró pero hubo un error con el PDF.");
            }
        }

        // --- EL CAMBIO CLAVE AQUÍ ---
        setShowModalProductos(false); // Cerramos el modal de productos
        setClienteActualIdx(null);    // Limpiamos el cliente seleccionado
    };
    const handleConfirmarTodo = async () => {
        // 1. Validación de seguridad
        if (!selectedOrder || planilla.length === 0) return;

        // 2. Confirmación visual
        const confirmar = await alertConfirm(
            "¿Finalizar Hoja de Ruta?",
            "Se cerrará la jornada de hoy para este despacho. ¿Deseas continuar?"
        );
        if (!confirmar) return;

        try {
            setLoading(true);

            // 3. Mapear los datos de la planilla al formato que espera el Controller
            const salesData = planilla.map(cliente => {
                // Calculamos el total de la venta de productos de hoy
                const totalVentaHoy = calcularTotalFila(cliente);

                // Según tu lógica: amount_paid es el efectivo total recibido hoy
                // (pago por mercancía de hoy + abono a deuda vieja)
                const efectivoRecibido = Number(cliente.amount_paid) || 0;

                // Para el backend, dividiremos el efectivo:
                // - Si el efectivo es mayor que la venta de hoy, el excedente es abono a deuda vieja (credit_amount)
                // - Si es menor, todo va a amount_paid de la venta de hoy.
                let pagoVentaHoy = 0;
                let abonoDeudaVieja = 0;

                if (efectivoRecibido > totalVentaHoy) {
                    pagoVentaHoy = totalVentaHoy;
                    abonoDeudaVieja = efectivoRecibido - totalVentaHoy;
                } else {
                    pagoVentaHoy = efectivoRecibido;
                    abonoDeudaVieja = 0;
                }

                return {
                    customer_id: cliente.id,
                    total_amount: totalVentaHoy,       // Mercancía nueva
                    amount_paid: pagoVentaHoy,         // Parte del efectivo para esa mercancía
                    credit_amount: abonoDeudaVieja,    // Parte del efectivo para deuda vieja
                    visit_status: cliente.visit_status,
                    items: Object.entries(cliente.productos)
                        .filter(([_, cant]) => cant > 0)
                        .map(([prodId, cant]) => {
                            const itemOriginal = orderItems.find(oi => String(oi.product_id) === String(prodId));
                            const precioUsado = cliente.preciosPersonalizados?.[prodId] ?? itemOriginal?.unit_price;
                            return {
                                product_id: prodId,
                                quantity: cant,
                                unit_price: precioUsado,
                                total_price: cant * precioUsado
                            };
                        })
                };
            });

            // 4. Llamada al servicio
            const payload = {
                order_id: selectedOrder.id,
                sales: salesData
            };

            const result = await saleService.createSale(payload);

            // FILTRAR PRODUCTOS QUE SOBRARON EN EL CAMIÓN
            const productosSobrantes = orderItems
                .filter(item => item.quantity > 0) // Solo lo que tiene stock > 0
                .map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    stock_en_camion: item.quantity // Este es el valor que espera DevolucionesPage
                }));

            // Limpieza post-guardado
            localStorage.removeItem(`planilla_${selectedOrder.id}`);

            // REDIRIGIR A DEVOLUCIONES PASANDO LOS SOBRANTES
            navigate("/historial-devoluciones", {
                state: {
                    orderId: selectedOrder.id,
                    sobrantes: productosSobrantes
                }
            });

            if (result.success) {
                alertSuccess("¡Éxito!", "La ruta ha sido liquidada correctamente.");

                // 5. Limpieza post-guardado
                localStorage.removeItem(`planilla_${selectedOrder.id}`);
                setSelectedOrder(null); // Volver a la lista de rutas
                loadPendingOrders();    // Refrescar la lista de despachos
            }
        } catch (err) {
            console.error("Error al liquidar ruta:", err);
            alertError("Error de Liquidación", err.message);
        } finally {
            setLoading(false);
        }
    };
    const clientesParaSecuencia = useMemo(() => {
        if (!searchTermPosition) return planilla;
        return planilla.filter(c =>
            c.name.toLowerCase().includes(searchTermPosition.toLowerCase()) ||
            c.address.toLowerCase().includes(searchTermPosition.toLowerCase())
        );
    }, [planilla, searchTermPosition]);


    const abrirBusquedaGlobal = async () => {
        try {
            setLoading(true);
            // Traemos todos los clientes del usuario actual
            const todos = await customerService.getBalances(user.id);
            setAllCustomers(todos || []);
            setShowModalGlobal(true);
        } catch (err) {
            alertError("Error", "No se pudo conectar con la base de datos de clientes.");
        } finally {
            setLoading(false);
        }
    };
    const agregarClienteExtra = (clienteGlobal) => {
        // Evitar duplicados en la planilla actual
        if (planilla.find(c => c.id === clienteGlobal.id)) {
            return alertError("Aviso", "Este cliente ya está en tu lista de hoy.");
        }

        const nuevoCliente = {
            id: clienteGlobal.id,
            name: clienteGlobal.customer_name,
            address: clienteGlobal.customer_address,
            phone: clienteGlobal.phone || "",
            visit_status: "PENDIENTE",
            total_debt: Number(clienteGlobal.total_debt || 0),
            venta_hoy: 0,
            productos: {},
            preciosPersonalizados: {},
            position: "EXTRA", // Marca visual para diferenciarlo
            visit_day: clienteGlobal.visit_day
        };

        setPlanilla([nuevoCliente, ...planilla]);
        setShowModalGlobal(false);
        setGlobalSearchTerm(""); // Limpiar búsqueda
        alertSuccess("Agregado", `${clienteGlobal.customer_name} listo para vender.`);
    };
    if (loading) return <div className="loading-screen">Cargando...</div>;
    return (
        <div className="ventas-container">
            {/* MODAL DE PRODUCTOS - Solo se muestra si hay un cliente seleccionado */}
            {showModalProductos && clienteActualIdx !== null && (
                <ModalProductos
                    show={showModalProductos}
                    onClose={() => {
                        setShowModalProductos(false);
                        setClienteActualIdx(null);
                    }}
                    cliente={planilla[clienteActualIdx]}
                    orderItems={orderItems}
                    updatePrecioVenta={updatePrecioVenta}
                    handleCantidadChange={handleCantidadChange}
                    confirmarVentaModal={confirmarVentaModal}
                    calcularTotalFila={calcularTotalFila}
                />
            )}
            {/* MODAL DE REGISTRO DE CLIENTES */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content customer-modal-modern">
                        <div className="modal-header">
                            <div className="header-title">
                                <UserPlus size={24} className="icon-header" />
                                <h2>Registrar Nuevo Cliente</h2>
                            </div>
                            <button className="btn-close-modal" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSaveNewCustomer} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div className="modal-body">

                                {/* Sección: Información de Ruta */}
                                <div className="form-section">
                                    <p className="section-title">Asignación de Ruta</p>
                                    <div className="form-grid">
                                        {user.role === 'ADMINISTRADOR' && (
                                            <div className="form-group">
                                                <label>ID Vendedor</label>
                                                <input
                                                    type="number"
                                                    placeholder="000"
                                                    className="form-control"
                                                    onChange={e => setNewCustomer({ ...newCustomer, seller_id: e.target.value })}
                                                />
                                            </div>
                                        )}
                                        <div className="form-group">
                                            <label>Día de Visita</label>
                                            <select
                                                className="form-select"
                                                value={newCustomer.visit_day} // Vinculación bidireccional
                                                onChange={e => setNewCustomer({ ...newCustomer, visit_day: e.target.value })}
                                            >
                                                <option value="Lunes">Lunes</option>
                                                <option value="Martes">Martes</option>
                                                <option value="Miércoles">Miércoles</option> {/* Verifica la tilde aquí */}
                                                <option value="Jueves">Jueves</option>
                                                <option value="Viernes">Viernes</option>
                                                <option value="Sábado">Sábado</option>   {/* Verifica la tilde aquí */}
                                                <option value="Domingo">Domingo</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group mt-3">
                                        <label>Ubicación en la secuencia</label>
                                        {/* Nuevo input para filtrar la lista de posiciones */}
                                        <input
                                            type="text"
                                            placeholder="🔍 Buscar cliente de referencia..."
                                            className="form-control mb-2"
                                            style={{ fontSize: '0.85rem', marginBottom: '8px' }}
                                            value={searchTermPosition}
                                            onChange={(e) => setSearchTermPosition(e.target.value)}
                                        />
                                        <select
                                            className="form-select select-position"
                                            value={newCustomer.afterCustomerId}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, afterCustomerId: e.target.value })}
                                        >
                                            <option value="">-- Al principio de la ruta --</option>
                                            {clientesParaSecuencia.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    Insertar después de: {c.name} ({c.address})
                                                </option>
                                            ))}
                                        </select>
                                        {searchTermPosition && clientesParaSecuencia.length === 0 && (
                                            <small style={{ color: 'red' }}>No se encontró el cliente de referencia</small>
                                        )}
                                    </div>
                                </div>

                                <hr className="form-divider" />

                                {/* Sección: Datos Personales */}
                                <div className="form-section">
                                    <p className="section-title">Datos del Cliente</p>
                                    <div className="form-group">
                                        <label>Nombre Completo</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ej: Juan Pérez"
                                            className="form-control"
                                            value={newCustomer.name}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Dirección Exacta</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Calle, Barrio, Referencias..."
                                            className="form-control"
                                            value={newCustomer.address}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Teléfono / Celular</label>
                                        <input
                                            type="text"
                                            placeholder="09xxxxxxx"
                                            className="form-control"
                                            value={newCustomer.phone}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary-action"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <><span className="spinner"></span> Registrando...</>
                                    ) : (
                                        "Registrar Cliente"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* PARTE DE Control de Ventas O  Mis Rutas*/}
            {!selectedOrder ? (
                <div className="ruta-selection">
                    <header className="ruta-header-main">
                        <h1>{user.role === 'ADMINISTRADOR' ? '🚀 Control de Rutas' : '🚚 Mis Rutas'}</h1>
                        <p>Selecciona un día para ver la ruta asignada</p>
                    </header>

                    {/* MOSTRAR PANEL DE DIAS*/}
                    <div className="dias-selector-container">
                        {DIAS_SEMANA.map((dia, index) => (
                            <button
                                key={dia}
                                onClick={() => setDiaSeleccionado(index)}
                                className={`btn-dia ${diaSeleccionado === index ? 'selected' : ''}`}
                            >
                                {dia}
                            </button>
                        ))}
                    </div>

                    {/* --- SECCIÓN DE FILTROS DINÁMICOS --- */}
                    <div className="filters-card">
                        <div className="filters-grid">

                            {/* BUSCADOR 1 - ID */}
                            <div className="filter-group">
                                <label className="filter-label">🔍 ID DESPACHO</label>
                                <input
                                    type="text"
                                    className="filter-input"
                                    placeholder="Ej: 4501..."
                                    value={filterID}
                                    onChange={(e) => setFilterID(e.target.value)} // LLAMA AL SETTER, NO AL ARRAY
                                />
                            </div>

                            {/* BUSCADOR 2 - VENDEDOR */}
                            {user.role === 'ADMINISTRADOR' && (
                                <div className="filter-group">
                                    <label className="filter-label">👤 VENDEDOR</label>
                                    <input
                                        type="text"
                                        className="filter-input"
                                        placeholder="Nombre del vendedor..."
                                        value={filterVendedor}
                                        onChange={(e) => setFilterVendedor(e.target.value)} // LLAMA AL SETTER, NO AL ARRAY
                                    />
                                </div>
                            )}

                            {/* BOTÓN LIMPIAR */}
                            {(filterID || filterVendedor) && (
                                <button
                                    className="btn-clear-filters"
                                    onClick={() => { setFilterID(""); setFilterVendedor(""); }}
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    </div>

                    {/* TABLA PARA VER MIS RUTAS */}
                    <div className="table-wrapper">
                        <table className="ventas-table">
                            <thead>
                                <tr>
                                    <th>ID Despacho</th>
                                    <th>Fecha</th>
                                    <th>Vendedor</th>
                                    <th>Carga Total</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'center' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordenesFiltradas.length > 0 ? (
                                    ordenesFiltradas.map(o => (
                                        <tr key={o.id}>
                                            <td style={{ fontWeight: 'bold', color: '#0d2a4d' }}>#{o.id}</td>
                                            <td>{new Date(o.created_at).toLocaleDateString()}</td>
                                            <td>{o.seller_name}</td>
                                            <td>
                                                <span style={{ fontWeight: '600' }}>
                                                    ${Number(o.total_amount).toLocaleString()}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge-status ${o.status === 'PENDIENTE' ? 'status-pendiente' : ''}`}>
                                                    {o.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn-del-prod" onClick={() => handleSelectOrder(o)}>
                                                    ABRIR RUTA <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                            No hay despachos programados para el día {DIAS_SEMANA[diaSeleccionado]}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            ) : (
                <div className="planilla-excel-view">
                    {/* Detalles de la orden */}
                    <div className="header-actions">
                        <div className="header-left">
                            <button
                                onClick={() => {
                                    setSelectedOrder(null);
                                }}
                                className="btn-back-list"
                            >
                                <ChevronLeft size={20} />
                                <span>Volver</span>
                            </button>


                            {/* --- BUSCADOR AÑADIDO --- */}
                            <div className="search-container-mini">
                                <input
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input-search-planilla"
                                />
                            </div>
                        </div>

                        <div className="header-center">
                            <h3 className="ruta-title">Hoja de Ruta: {selectedOrder.seller_name}</h3>
                        </div>

                        <div className="header-right">

                            {/* Botón Nuevo Cliente */}
                            <button onClick={() => setShowModal(true)} className="btn-add-customer">
                                <UserPlus size={20} />
                                <span>Nuevo Cliente</span>
                            </button>

                            {/* Botón guardar la ruta */}
                            <button onClick={handleConfirmarTodo} className="btn-confirm-all">
                                <Save size={20} />
                                <span>Guardar Todo</span>
                            </button>

                            <button onClick={abrirBusquedaGlobal} className="btn-add-customer" style={{ backgroundColor: '#2bbe74' }}>
                                <ShoppingCart size={20} />
                                <span>Venta Extra-Ruta</span>
                            </button>
                        </div>
                    </div>
                    <div className="planilla-wrapper">
                        <table className="excel-table">
                            <thead>
                                <tr>
                                    <th>COD</th>
                                    <th>DIRECCIÓN</th>
                                    <th>NOMBRE</th>
                                    <th>ESTADO</th>
                                    <th>PRODUCTOS</th>
                                    <th>DEBE</th>
                                    <th>ABONO</th>
                                    <th>TOTAL</th>
                                    <th>FACTURA</th>
                                    <th>CELULAR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {planilla
                                    .map((c, i) => ({ ...c, originalIdx: i })) // Guardamos el índice original para que updateCelda funcione

                                    // FILTRADO DINÁMICO: Solo mostramos los clientes que coinciden con el término de búsqueda en nombre o dirección
                                    .filter(cliente =>
                                        cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        cliente.address.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .map((cliente) => {
                                        const idx = cliente.originalIdx;

                                        // --- 1. CÁLCULOS ---
                                        const totalVentaHoy = Number(calcularTotalFila(cliente) || 0);
                                        const deudaPrevia = Number(cliente.total_debt || 0);
                                        const amountPaid = Number(cliente.amount_paid) || 0;

                                        const nuevoSaldo = deudaPrevia + totalVentaHoy - amountPaid;


                                        // --- 3. LÓGICA DE ESTADOS ---
                                        const visitStatus = cliente.visit_status || '';
                                        const estadoClase = `fila-${visitStatus.toLowerCase()}`;

                                        const esLleso = visitStatus === "LLESO";

                                        return (
                                            <tr key={idx} className={estadoClase}>
                                                {/* POCICIÒN DEL CLIENTE*/}
                                                <td className="code-col">{cliente.position}</td>

                                                {/* DIRRECIÒN DE LA PERSONA*/}
                                                <td>{cliente.address}</td>
                                                {/* NOMBRE DE LA PERSONA*/}
                                                <td>{cliente.name}</td>
                                                {/* ESTADO DE LA VISITA*/}
                                                <td>
                                                    <select
                                                        value={visitStatus}
                                                        onChange={(e) => updateCelda(idx, "visit_status", e.target.value)}
                                                        className={`status-select-badge status-${visitStatus.toLowerCase()}`}
                                                    >
                                                        <option value="PENDIENTE">PEND</option>
                                                        <option value="VISITADO">VISIT</option>
                                                        <option value="LLESO">LLESO</option>
                                                    </select>
                                                </td>
                                                {/* PRODUCTOS COMPRADOS HOY*/}
                                                <td>
                                                    <button
                                                        disabled={esLleso}
                                                        className={`btn-vender ${totalVentaHoy > 0 ? 'con-venta' : ''}`}
                                                        onClick={() => abrirModalVenta(idx)}
                                                    >
                                                        <ShoppingCart size={14} />
                                                        {totalVentaHoy > 0 ? ` $${totalVentaHoy.toLocaleString()}` : ' Vender'}
                                                    </button>
                                                </td>
                                                {/* Mostramos Deuda Previa */}
                                                <td>${deudaPrevia.toLocaleString()}</td>
                                                {/* ABONO RECIBIDO*/}
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="input-celda"
                                                        value={cliente.amount_paid || ""}
                                                        disabled={esLleso}
                                                        placeholder="0"
                                                        onChange={(e) =>
                                                            updateCelda(idx, "amount_paid", Number(e.target.value) || 0)
                                                        }
                                                    />
                                                </td>
                                                {/* CELDA DE NUEVO SALDO (Ahora sí existe la variable) */}
                                                <td className={`total-cell ${nuevoSaldo > 0 ? 'deuda' : 'saldo-ok'}`}>
                                                    ${nuevoSaldo.toLocaleString()}
                                                </td>

                                                <td>
                                                    {cliente.facturaBlob && (
                                                        <a href={cliente.facturaBlob} download={`Factura_${cliente.name}.pdf`} className="btn-download-pdf">
                                                            <FileText size={16} /> PDF
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="name-col">{cliente.phone}</td>
                                            </tr>
                                        );
                                    })
                                }
                            </tbody>
                        </table>
                    </div>

                </div>
            )}
            {showModalGlobal && (
                <div className="modal-overlay">
                    <div className="modal-content modal-ventas-xl" style={{ maxWidth: '600px', height: '80vh' }}>
                        <div className="modal-header">
                            <div className="header-title">
                                <ShoppingCart size={24} className="icon-header" />
                                <h2>Venta Extra-Ruta (Todos los Clientes)</h2>
                            </div>
                            <button className="btn-close-modal" onClick={() => setShowModalGlobal(false)}>✕</button>
                        </div>

                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column' }}>
                            {/* --- BUSCADOR PRINCIPAL --- */}
                            <div className="search-box-global" style={{ padding: '10px 0', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Escribe nombre o dirección para buscar..."
                                    className="input-modern"
                                    style={{ width: '100%', fontSize: '1.1rem', padding: '12px' }}
                                    value={globalSearchTerm}
                                    autoFocus
                                    onChange={(e) => setGlobalSearchTerm(e.target.value)}
                                />
                                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
                                    Mostrando clientes que coinciden con tu búsqueda
                                </p>
                            </div>

                            {/* --- LISTA DE RESULTADOS --- */}
                            <div className="global-results-list" style={{ flex: 1, overflowY: 'auto', marginTop: '10px' }}>
                                {allCustomers
                                    .filter(c =>
                                        c.customer_name.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                                        c.customer_address.toLowerCase().includes(globalSearchTerm.toLowerCase())
                                    )
                                    .slice(0, 20) // Limitamos a 20 para que sea ultra rápido
                                    .map(c => (
                                        <div key={c.id} className="item-cliente-global" onClick={() => agregarClienteExtra(c)}>
                                            <div className="info">
                                                <span className="name">{c.customer_name}</span>
                                                <span className="addr">{c.customer_address}</span>
                                            </div>
                                            <div className="meta">
                                                <span className="day-badge">{c.visit_day}</span>
                                                <ArrowRight size={18} />
                                            </div>
                                        </div>
                                    ))
                                }
                                {globalSearchTerm && allCustomers.filter(c => c.customer_name.toLowerCase().includes(globalSearchTerm.toLowerCase())).length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                        No se encontraron clientes con ese nombre.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}