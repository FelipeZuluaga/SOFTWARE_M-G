import { useEffect, useState, useMemo } from "react";
import { orderService } from "../services/orderService";
import { saleService } from "../services/saleService";
import { alertSuccess, alertError } from "../services/alertService";
import { customerService } from "../services/customerService";
import {
    ArrowRight,
    ChevronLeft,
    Save,
    ShoppingCart,
    X,
    Info,
    FileText, // <--- Agrega esta línea aquí
    UserPlus,    // <--- Agregado
    ChevronUp,   // <--- Agregado
    ChevronDown  // <--- Agregado
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
                        <h3><ShoppingCart className="inline-icon" /> Registro de Venta</h3>
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
};
export default function VentasPage() {
    const [pendingOrders, setPendingOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [planilla, setPlanilla] = useState([]);

    // Estados para la Modal
    const [showModal, setShowModal] = useState(false);
    const [clienteActualIdx, setClienteActualIdx] = useState(null);

    const user = JSON.parse(localStorage.getItem("user"));
    const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDay());


    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: "", address: "", phone: "", afterCustomerId: "" });

    const [filterID, setFilterID] = useState("");
    const [filterVendedor, setFilterVendedor] = useState("");

    const [searchTerm, setSearchTerm] = useState("");

    const navigate = useNavigate(); // Inicializar el hook
    useEffect(() => { loadPendingOrders(); }, []);


    const loadPendingOrders = async () => {
        try {
            setLoading(true);
            const queryParams = { id: user.id, role: user.role, name: user.role === 'ADMINISTRADOR' ? "" : user.name };
            const data = await orderService.getOrdersHistory(queryParams);
            setPendingOrders(data.filter(o => o.status === "DESPACHADO"));
        } catch (err) { alertError("Error", "No se cargaron los despachos."); }
        finally { setLoading(false); }
    };
    // 1. Definimos la fecha actual formateada
    const fechaHoy = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const handleSelectOrder = async (order) => {
        try {
            setLoading(true);
            const items = await orderService.getOrderDetail(order.id);
            setSelectedOrder(order);
            setOrderItems(items);

            // INTENTAR CARGAR DESDE LOCALSTORAGE
            const guardado = localStorage.getItem(`planilla_${order.id}`);

            if (guardado) {
                setPlanilla(JSON.parse(guardado));
            } else {
                // Si no hay nada guardado, cargamos de la API como antes
                const clientesBase = await customerService.getBalances();
                const inicializarPlanilla = clientesBase.map(c => ({
                    id: c.id,
                    address: c.customer_address || "",
                    name: c.customer_name,
                    phone: c.phone || "",
                    status: "",
                    deuda_previa: Number(c.total_debt || 0),
                    pago_compra: "",
                    abono_deuda: "",
                    productos: {},
                    facturaBlob: null
                }));
                setPlanilla(inicializarPlanilla);
            }
        } catch (err) {
            alertError("Error", "No se pudo cargar la ruta.");
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA DE MODAL Y VENTAS ---
    const abrirModalVenta = (idx) => {
        setClienteActualIdx(idx);
        setShowModal(true);
    };

    const updateCantidadVenta = (prodId, nuevaCant) => {
        const itemStock = orderItems.find(i => i.product_id === prodId);
        const cantidadInput = parseInt(nuevaCant) || 0;

        if (cantidadInput > itemStock.quantity) {
            alertError("Sin Stock", `Solo tienes ${itemStock.quantity} en el camión.`);
            return;
        }

        const nuevaPlanilla = [...planilla];
        nuevaPlanilla[clienteActualIdx].productos[prodId] = cantidadInput;
        setPlanilla(nuevaPlanilla);
    };

    // --- LÓGICA DE CÁLCULO CORREGIDA (PUNTO CRÍTICO) ---
    const calcularTotalFila = (cliente) => {
        if (!cliente) return 0;
        return Object.entries(cliente.productos).reduce((sum, [prodId, cant]) => {
            const item = orderItems.find(i => i.product_id === parseInt(prodId));

            // CORRECCIÓN: Primero busca si hay un precio manual en 'preciosPersonalizados'
            // Si no existe o está vacío, usa el unit_price base del item.
            const precioManual = cliente.preciosPersonalizados?.[prodId];
            const precioEfectivo = (precioManual !== undefined && precioManual !== "")
                ? Number(precioManual)
                : (item?.unit_price || 0);

            return sum + (cant * precioEfectivo);
        }, 0);
    };

    const updateCelda = (idx, campo, valor) => {
        const nuevaPlanilla = [...planilla];
        const cliente = nuevaPlanilla[idx];

        cliente[campo] = valor;

        // Lógica para estado LLESO
        if (campo === "status" && valor === "LLESO") {
            const totalVentaHoy = calcularTotalFila(cliente);
            const nuevoSaldo = (cliente.deuda_previa + totalVentaHoy) -
                (Number(cliente.pago_compra) + Number(cliente.abono_deuda));

            // REGLA: Si es LLESO y no debe nada, se elimina de la planilla
            if (nuevoSaldo <= 0) {
                if (window.confirm(`El cliente ${cliente.name} no tiene deuda. ¿Eliminar de esta ruta?`)) {
                    nuevaPlanilla.splice(idx, 1);
                    setPlanilla(nuevaPlanilla);
                    return;
                } else {
                    cliente.status = "PENDIENTE"; // Revertir si cancela
                }
            }
            // Si DEBE, el cliente se queda en la lista con estado LLESO (bloqueado por CSS)
        }

        setPlanilla(nuevaPlanilla);
    };

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

    const handleConfirmarTodo = async () => {
        const ventasRealizadas = planilla.filter(c =>
            Object.keys(c.productos).length > 0 || c.abono_deuda > 0 || c.status !== "PENDIENTE"
        );

        if (ventasRealizadas.length === 0) return alertError("Aviso", "No hay movimientos.");

        try {
            setLoading(true);
            const payload = {
                order_id: selectedOrder.id,
                sales: ventasRealizadas.map(v => ({
                    customers_id: v.id,
                    customer_address: v.address,
                    customer_name: v.name,
                    customer_phone: v.phone,
                    visit_status: v.status || "PENDIENTE",
                    total_amount: calcularTotalFila(v),
                    amount_paid: Number(v.pago_compra) || 0,
                    credit_amount: Number(v.abono_deuda) || 0,
                    // Asegúrate de enviar solo los productos con cantidad > 0
                    items: Object.entries(v.productos)
                        .filter(([_, cant]) => cant > 0)
                        .map(([id, cant]) => {
                            const p = orderItems.find(i => i.product_id === parseInt(id));
                            return {
                                product_id: p.product_id,
                                quantity: cant,
                                unit_price: p.unit_price,
                                total_price: cant * p.unit_price // <--- ESTO SOLUCIONA EL ERROR 500
                            };
                        })
                }))
            };
            await saleService.createSale(payload);


            // 1. Calculamos qué quedó en el camión
            const productosSobrantes = orderItems.map(item => ({
                product_id: item.product_id,
                product_name: item.product_name,
                stock_en_camion: item.quantity // Lo que sobró después de vender
            }));

            alertSuccess("Éxito", "Ventas guardadas. Procediendo a devolución de sobrantes.");

            // 2. Calculamos el total de unidades que quedaron en el camión
            // productosSobrantes es el array que ya tienes calculado arriba en tu código
            const totalUnidadesSobrantes = productosSobrantes.reduce((acc, p) => acc + p.stock_en_camion, 0);

            if (totalUnidadesSobrantes === 0) {
                // --- CASO: VENDIÓ TODO ---
                // Llamamos a la función que ya tienes en el backend para cerrar la orden
                await orderService.markAsLiquidated(selectedOrder.id);

                alertSuccess("¡Excelente!", "Venta total completada. La orden se cerró automáticamente.");
                navigate("/liquidaciones"); // Ir al historial
            } else {
                // --- CASO: SOBRÓ MERCANCÍA ---
                alertSuccess("Éxito", "Ventas guardadas. Procede a devolver el sobrante.");
                navigate("/devoluciones", {
                    state: {
                        orderId: selectedOrder.id,
                        sobrantes: productosSobrantes
                    }
                });
            }
            alertSuccess("Éxito", "Planilla sincronizada.");
            setSelectedOrder(null);
            loadPendingOrders();
        } catch (err) {
            console.error(err); // Esto te dirá en la consola el error exacto del servidor
            alertError("Error", "Error al sincronizar con el servidor.");
        }
        finally { setLoading(false); }
    };
    const handleAddCustomer = async (e) => { // Agregamos async
        e.preventDefault();

        try {
            setLoading(true);
            // 1. Guardar en Base de Datos primero
            const savedCustomer = await customerService.createCustomer({
                name: newCustomer.name,
                address: newCustomer.address,
                phone: newCustomer.phone
            });

            // 2. Mapear la respuesta al formato que usa tu planilla
            const nuevoRegistro = {
                id: savedCustomer.id, // El ID real de la DB
                address: savedCustomer.address,
                name: savedCustomer.name,
                phone: savedCustomer.phone,
                status: "VISITADO",
                deuda_previa: 0,
                pago_compra: "",
                abono_deuda: "",
                productos: {},
                facturaBlob: null
            };

            // 3. Mantener tu lógica de posicionamiento intacta
            if (newCustomer.afterCustomerId === "") {
                setPlanilla([...planilla, nuevoRegistro]);
            } else {
                const index = planilla.findIndex(c => c.id == newCustomer.afterCustomerId);
                const nuevaLista = [...planilla];
                nuevaLista.splice(index + 1, 0, nuevoRegistro);
                setPlanilla(nuevaLista);
            }

            alertSuccess("Éxito", "Cliente guardado en base de datos y agregado a la ruta.");
            setShowAddCustomerModal(false);
            setNewCustomer({ name: "", address: "", phone: "", afterCustomerId: "" });

        } catch (err) {
            alertError("Error", "No se pudo guardar el cliente en la base de datos.");
        } finally {
            setLoading(false);
        }
    };

    // --- FUNCIONES DE CONTROL DE MODAL PRODUCTOS ---

    // 1. Manejar cantidad con bloqueo de Stock Máximo
    const handleCantidadChange = (productId, valor, stockDisponible) => {
        const numValue = parseInt(valor) || 0;

        if (numValue > stockDisponible) {
            alertError(`Stock insuficiente. Solo quedan ${stockDisponible} en el camión.`);
            return; // Bloquea la actualización si supera el stock
        }
        updateCantidadVenta(productId, numValue);
    };

    // --- ACTUALIZACIÓN DE PRECIO CORREGIDA ---
    const updatePrecioVenta = (productId, nuevoPrecio) => {
        const nuevaPlanilla = [...planilla];
        if (clienteActualIdx === null) return;

        if (!nuevaPlanilla[clienteActualIdx].preciosPersonalizados) {
            nuevaPlanilla[clienteActualIdx].preciosPersonalizados = {};
        }

        nuevaPlanilla[clienteActualIdx].preciosPersonalizados[productId] = nuevoPrecio;
        setPlanilla(nuevaPlanilla);
    };

    // --- FUNCIÓN PARA GENERAR EL PDF (ADAPTADA A PRECIOS EDITABLES) ---
    const generarPDFVenta = (cliente) => {
        const doc = new jsPDF();
        const totalVenta = calcularTotalFila(cliente);

        // Encabezado
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("COMPROBANTE DE VENTA", 105, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 30);
        doc.text(`Vendedor: ${selectedOrder.seller_name}`, 20, 35);
        doc.text(`Cliente: ${cliente.name}`, 20, 45);
        doc.text(`Dirección: ${cliente.address}`, 20, 50);

        // Tabla de productos
        const tableRows = [];

        Object.entries(cliente.productos).forEach(([id, cant]) => {
            if (cant > 0) {
                const p = orderItems.find(i => i.product_id === parseInt(id));

                // LOGICA CLAVE: Usar el precio personalizado si existe, de lo contrario el unit_price base
                const precioEfectivo = cliente.preciosPersonalizados?.[id] ?? p.unit_price;
                const subtotal = cant * precioEfectivo;

                tableRows.push([
                    p.product_name,
                    cant,
                    `$${Number(precioEfectivo).toLocaleString()}`,
                    `$${subtotal.toLocaleString()}`
                ]);
            }
        });

        autoTable(doc, {
            startY: 55,
            head: [['Producto', 'Cant', 'Precio Unit.', 'Subtotal']],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [190, 43, 72] } // Color guinda para el PDF también
        });

        const finalY = doc.lastAutoTable.finalY + 10;

        // Resumen de totales
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL VENTA: $${totalVenta.toLocaleString()}`, 140, finalY);

        if (Number(cliente.abono_deuda) > 0) {
            doc.text(`ABONO RECIBIDO: $${Number(cliente.abono_deuda).toLocaleString()}`, 140, finalY + 7);
        }

        return doc.output('blob');
    };
    const confirmarVentaModal = () => {
        // 1. Obtener los datos actuales del cliente y la venta
        const cliente = planilla[clienteActualIdx];
        const totalVenta = calcularTotalFila(cliente);

        // 2. ACTUALIZACIÓN DE STOCK DEL CAMIÓN (Punto 3 de tu solicitud)
        // Descontamos lo vendido de la carga actual del camión
        const stockActualizado = orderItems.map(item => {
            const cantidadVendida = cliente.productos[item.product_id] || 0;
            return {
                ...item,
                quantity: Math.max(0, item.quantity - cantidadVendida) // Evita números negativos por si acaso
            };
        });
        setOrderItems(stockActualizado);

        // 3. LÓGICA DEL PDF (Tu lógica original sin romperla)
        // Verificamos si hubo venta o abono para generar el comprobante
        if (totalVenta > 0 || Number(cliente.abono_deuda) > 0) {
            try {
                // Generamos el PDF con los datos actuales (precios y cantidades nuevas)
                const pdfBlob = generarPDFVenta(cliente);
                const pdfUrl = URL.createObjectURL(pdfBlob);

                // Actualizamos la planilla con el link al PDF y marcamos la compra
                const nuevaPlanilla = [...planilla];
                nuevaPlanilla[clienteActualIdx].facturaBlob = pdfUrl;

                // Opcional: Podrías marcar aquí que el estado de visita cambió a 'VENDIDO'
                if (totalVenta > 0) {
                    nuevaPlanilla[clienteActualIdx].visit_status = 'VENDIDO';
                }

                setPlanilla(nuevaPlanilla);
                alertSuccess(`Venta de ${cliente.name} procesada y stock descontado.`);
            } catch (error) {
                console.error("Error al generar PDF:", error);
                alertError("La venta se registró pero hubo un error con el PDF.");
            }
        } else {
            alertSuccess("Se cerró el modal sin generar venta.");
        }

        // 4. Cerrar el modal
        setShowModal(false);
    };
    if (loading) return <div className="loading-screen">Cargando...</div>;

    return (
        <div className="ventas-container">
            {/* MODAL DE PRODUCTOS */}
            <ModalProductos
                show={showModal}
                onClose={() => setShowModal(false)}
                cliente={planilla[clienteActualIdx]}
                orderItems={orderItems}
                updatePrecioVenta={updatePrecioVenta}
                handleCantidadChange={handleCantidadChange}
                confirmarVentaModal={confirmarVentaModal}
                calcularTotalFila={calcularTotalFila}
            />


            {/* MODAL DE REGISTRO DE CLIENTES */}
            {
                showAddCustomerModal && (
                    <div className="modal-overlay">
                        <div className="modal-content customer-modal">
                            <div className="modal-header">
                                <h3>Registrar Nuevo Cliente en Ruta</h3>
                                <button className="btn-close" onClick={() => setShowAddCustomerModal(false)}><X /></button>
                            </div>
                            <form onSubmit={handleAddCustomer}>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label>Nombre Completo</label>
                                        <input
                                            required
                                            type="text"
                                            className="form-control"
                                            value={newCustomer.name}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Dirección</label>
                                        <input
                                            required
                                            type="text"
                                            className="form-control"
                                            value={newCustomer.address}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Teléfono / Celular</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newCustomer.phone}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <label>Ubicación en la ruta (Insertar después de:)</label>
                                <select
                                    className="form-control"
                                    value={newCustomer.afterCustomerId}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, afterCustomerId: e.target.value })}
                                >
                                    <option value="">-- Al final de la lista --</option>
                                    {planilla.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            Después de: {c.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setShowAddCustomerModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn-confirm-modal">Agregar a la Tabla</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* PARTE DE Control de Ventas O  Mis Rutas*/}
            {!selectedOrder ? (
                <div className="ruta-selection">
                    <header className="ruta-header-main">
                        <h1>{user.role === 'ADMINISTRADOR' ? '🚀 Control de Ventas' : '🚚 Mis Rutas'}</h1>
                        <p>Selecciona un día para ver los despachos asignados</p>
                    </header>

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
                                            <td style={{ fontWeight: 'bold', color: '#be2b48' }}>#{o.id}</td>
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
            ) :

                (
                    <div className="planilla-excel-view">
                        <div className="header-actions">
                            <div className="header-left">
                                <button
                                    onClick={() => {
                                        if (window.confirm("¿Estás seguro de salir? Se perderán los cambios no guardados en esta planilla.")) {
                                            setSelectedOrder(null);
                                        }
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
                                {/* 2. Cambiamos el texto estático por la variable fechaHoy */}
                                <p className="ruta-subtitle">FECHA: {fechaHoy.toUpperCase()}</p>
                            </div>

                            <div className="header-right">

                                {/* Botón Nuevo Cliente */}
                                <button onClick={() => setShowAddCustomerModal(true)} className="btn-add-customer">
                                    <UserPlus size={20} />
                                    <span>Nuevo Cliente</span>
                                </button>
                                <button onClick={handleConfirmarTodo} className="btn-confirm-all">
                                    <Save size={20} />
                                    <span>Guardar Todo</span>
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
                                        {/*<th>PAGO VENTA</th>*/}
                                        <th>DEBE</th>
                                        <th>ABONO</th>
                                        <th>TOTAL</th>
                                        <th>FACTURA</th>
                                        <th>CELULAR</th>

                                    </tr>
                                </thead>
                                <tbody>
                                    {/* --- FILTRADO DINÁMICO --- */}
                                    {planilla
                                        .map((c, i) => ({ ...c, originalIdx: i })) // Guardamos el índice original para que updateCelda funcione
                                        .filter(cliente =>
                                            cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            cliente.address.toLowerCase().includes(searchTerm.toLowerCase())
                                        )
                                        .map((cliente) => {
                                            const idx = cliente.originalIdx; // Usamos el índice real del array original
                                            const totalVentaHoy = calcularTotalFila(cliente);
                                            const nuevoSaldo = (cliente.deuda_previa + totalVentaHoy) - (Number(cliente.pago_compra) + Number(cliente.abono_deuda));
                                            const estadoClase = `fila-${cliente.status.toLowerCase()}`;
                                            const esLleso = cliente.status === "LLESO";

                                            return (
                                                <tr key={idx} className={estadoClase}> {/* AGREGAMOS LA CLASE AQUÍ */}

                                                    <td className="code-col">{cliente.id}</td>
                                                    <td className="address-col">{cliente.address}</td>
                                                    <td className="name-col">{cliente.name}</td>
                                                    <td>
                                                        <select
                                                            value={cliente.status}
                                                            onChange={(e) => updateCelda(idx, "status", e.target.value)}
                                                            className="status-select-mini"
                                                        >
                                                            <option value=""></option>
                                                            <option value="PENDIENTE">PENDIENTE</option>
                                                            <option value="VISITADO">VISITADO</option>
                                                            <option value="LLESO">LLESO</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <button
                                                            disabled={esLleso} // BLOQUEO
                                                            className={`btn-vender ${totalVentaHoy > 0 ? 'con-venta' : ''}`}
                                                            onClick={() => abrirModalVenta(idx)}
                                                        >
                                                            <ShoppingCart size={14} />
                                                            {totalVentaHoy > 0 ? ` $${totalVentaHoy.toLocaleString()}` : ' Vender'}
                                                        </button>
                                                    </td>
                                                    {/*<td>
                                                        <input
                                                            type="number"
                                                            value={cliente.pago_compra}
                                                            disabled={esLleso} // BLOQUEO
                                                            onChange={(e) => updateCelda(idx, "pago_compra", e.target.value)}
                                                        />
                                                    </td>*/}
                                                    <td>${cliente.deuda_previa.toLocaleString()}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={cliente.abono_deuda}
                                                            disabled={esLleso} // BLOQUEO
                                                            onChange={(e) => updateCelda(idx, "abono_deuda", e.target.value)}
                                                        />
                                                    </td>
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
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
        </div>
    );
}