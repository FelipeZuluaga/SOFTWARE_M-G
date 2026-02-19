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
    // ESTADOS PARA EL MODAL DE REGISTRO DE CLIENTES
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        name: "",
        address: "",
        phone: "",
        afterCustomerId: "", // Para saber detrás de quién va
        visit_day: "Lunes",
        seller_id: "" // Solo lo usará el Admin
    });
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
            // 1. Obtener productos del camión para esta orden
            const items = await orderService.getOrderDetail(order.id);
            setSelectedOrder(order);
            setOrderItems(items);

            // 2. Intentar cargar progreso guardado de LocalStorage
            const guardado = localStorage.getItem(`planilla_${order.id}`);

            if (guardado) {
                setPlanilla(JSON.parse(guardado));
            } else {
                // 3. Si no hay guardado, cargar clientes desde la API
                // Usamos el ID del usuario actual para filtrar por su ruta
                const clientesBase = await customerService.getBalances(user.id);

                const inicializarPlanilla = clientesBase.map(c => ({
                    id: c.id,
                    name: c.name || c.customer_name,
                    address: c.address || c.customer_address || "",
                    phone: c.phone || "",
                    visit_status: "",
                    deuda_previa: Number(c.total_debt || 0),
                    venta_hoy: 0,
                    productos: {},
                    preciosPersonalizados: {},
                    facturaBlob: null
                }));


                setPlanilla(inicializarPlanilla);
            }
        } catch (err) {
            console.error("Error al seleccionar orden:", err);
            alertError("Error", "No se pudo cargar la planilla de clientes.");
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
    //--------------------------------------------------------------------------------------------------------------------------------------------
    const updateCelda = (idx, campo, valor) => {
        const nuevaPlanilla = [...planilla];
        const cliente = nuevaPlanilla[idx];

        cliente[campo] = valor;

        // Lógica para estado LLESO
        if (campo === "visit_status" && valor === "LLESO") {
            const totalVentaHoy = calcularTotalFila(cliente);
            const nuevoSaldo = (cliente.deuda_previa + totalVentaHoy) -
                (Number(cliente.amount_paid) + Number(cliente.credit_amount));

            // REGLA: Si es LLESO y no debe nada, se elimina de la planilla
            if (nuevoSaldo <= 0) {
                if (window.confirm(`El cliente ${cliente.name} no tiene deuda. ¿Eliminar de esta ruta?`)) {
                    nuevaPlanilla.splice(idx, 1);
                    setPlanilla(nuevaPlanilla);
                    return;
                } else {
                    cliente.visit_status = "PENDIENTE"; // Revertir si cancela
                }
            }
            // Si DEBE, el cliente se queda en la lista con estado LLESO (bloqueado por CSS)
        }

        setPlanilla(nuevaPlanilla);
    };
    //--------------------------------------------------------------------------------------------------------------------------------------------
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
    //--------------------------------------------------------------------------------------------------------------------------------------------
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
                    customer_id: v.id,
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
    //--------------------------------------------------------------------------------------------------------------------------------------------
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
    //--------------------------------------------------------------------------------------------------------------------------------------------
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
    //--------------------------------------------------------------------------------------------------------------------------------------------
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
    //--------------------------------------------------------------------------------------------------------------------------------------------
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
    const fetchPlanilla = async () => {
        try {
            setLoading(true);
            // Usamos el ID del vendedor logueado para traer su ruta
            const data = await customerService.getBalances(user.id);
            // ORDENAMOS POR POSITION
            data.sort((a, b) => Number(a.position) - Number(b.position));
            // Mapeamos los datos para asegurar que tengan los campos de trabajo del frontend
            const planillaInicializada = data.map(c => ({
                ...c,
                position: c.position, // <--- ASEGÚRATE DE INCLUIR ESTO
                // Si el backend devuelve 'name' lo usamos, si no 'customer_name'
                name: c.name || c.customer_name,
                address: c.address || c.customer_address,
                // Campos necesarios para los cálculos de venta hoy
                productos: {},
                preciosPersonalizados: {},
                venta_hoy: 0,
                pago_hoy: 0,
                abono_deuda: 0,
                visit_status: c.visit_status || 'PENDIENTE'
            }));

            setPlanilla(planillaInicializada);
        } catch (err) {
            console.error("Error al cargar planilla:", err);
            alertError("Error", "No se pudo actualizar la lista de clientes.");
        } finally {
            setLoading(false);
        }
    };
    const handleSaveNewCustomer = async () => {
        if (!newCustomer.name || !newCustomer.address) {
            return alertError("Error", "Nombre y dirección son obligatorios");
        }

        try {
            setLoading(true);

            const idReferencia = newCustomer.afterCustomerId;
            let posicionFinal = 1; // Por defecto al principio

            if (idReferencia && idReferencia !== "") {
                // Buscamos el cliente de referencia en la planilla actual
                const clientePrevio = planilla.find(c => String(c.id) === String(idReferencia));
                if (clientePrevio) {
                    // La nueva posición es la del cliente seleccionado + 1
                    posicionFinal = Number(clientePrevio.position) + 1;
                }
            }

            const datosParaEnviar = {
                name: newCustomer.name.toUpperCase().trim(),
                address: newCustomer.address.toUpperCase().trim(),
                phone: newCustomer.phone || "",
                visit_day: selectedOrder?.visit_day || "Lunes", // Importante que coincida con la ruta actual
                seller_id: user.id,
                position: posicionFinal
            };

            const res = await customerService.createCustomer(datosParaEnviar);

            if (res) {
                alertSuccess("Éxito", `Cliente agregado en la posición ${posicionFinal}`);
                setShowAddCustomerModal(false);
                setNewCustomer({
                    name: "", address: "", phone: "",
                    afterCustomerId: "", visit_day: "Lunes", seller_id: user.id
                });
                // Recargar la planilla para ver el nuevo orden
                await fetchPlanilla();
            }
        } catch (err) {
            alertError("Error", err.message || "No se pudo crear el cliente");
        } finally {
            setLoading(false);
        }
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
                            <form onSubmit={handleSaveNewCustomer}>
                                <div className="modal-body">
                                    <div className="form-group">

                                        {/* SOLO ADMIN ve el ID del vendedor */}
                                        {user.role === 'ADMINISTRADOR' && (
                                            <input
                                                type="number"
                                                placeholder="ID del Vendedor asignado"
                                                onChange={e => setNewCustomer({ ...newCustomer, seller_id: e.target.value })}
                                            />
                                        )}
                                        <label>Nombre Completo</label>
                                        <input
                                            required
                                            type="text"
                                            className="form-control"
                                            value={newCustomer.name}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                        />
                                    </div>
                                    {/* Selector de Día */}
                                    <select value={newCustomer.visit_day} onChange={e => setNewCustomer({ ...newCustomer, visit_day: e.target.value })}>
                                        <option value="Lunes">Lunes</option>
                                        <option value="Martes">Martes</option>
                                        <option value="Miércoles">Miércoles</option>
                                        <option value="Jueves">Jueves</option>
                                        <option value="Viernes">Viernes</option>
                                        <option value="Sábado">Sábado</option>
                                        <option value="Domingo">Domingo</option>
                                        {/* ... demás días */}
                                    </select>
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
                                <select
                                    className="input-modern"
                                    // CAMBIO: Asegúrate de usar afterCustomerId
                                    value={newCustomer.afterCustomerId}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, afterCustomerId: e.target.value })}
                                >
                                    <option value="">-- Al principio de la ruta --</option>
                                    {planilla.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            Después de: {c.name}
                                        </option>
                                    ))}
                                </select>

                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setShowAddCustomerModal(false)}>Cancelar</button>
                                    <button
                                        type="submit"
                                        className="btn-save-customer"
                                        disabled={loading}
                                    >
                                        {loading ? "Registrando..." : "Registrar Cliente"}
                                    </button>

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
                                            const idx = cliente.originalIdx;

                                            // --- 1. CÁLCULOS NUMÉRICOS SEGUROS ---
                                            const totalVentaHoy = Number(calcularTotalFila(cliente) || 0);
                                            const deudaPrevia = Number(cliente.total_debt || cliente.deuda_previa || 0);
                                            const abonoDeuda = Number(cliente.abono_deuda || 0);
                                            const pagoHoy = Number(cliente.pago_hoy || 0);

                                            // --- 2. CÁLCULO DE NUEVO SALDO (Aquí se define la variable) ---
                                            const nuevoSaldo = deudaPrevia + totalVentaHoy - (pagoHoy + abonoDeuda);

                                            // --- 3. LÓGICA DE ESTADOS ---
                                            const visitStatus = cliente.visit_status || '';
                                            const estadoClase = `fila-${visitStatus.toLowerCase()}`;
                                            const esLleso = visitStatus === "LLESO";

                                            return (
                                                <tr key={idx} className={estadoClase}>
                                                    <td className="code-col">{cliente.position}</td>
                                                    <td className="address-col">{cliente.address}</td>
                                                    <td className="name-col">{cliente.name}</td>

                                                    <td>
                                                        <select
                                                            value={visitStatus}
                                                            onChange={(e) => updateCelda(idx, "visit_status", e.target.value)}
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

                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="input-celda"
                                                            value={cliente.abono_deuda || ""}
                                                            disabled={esLleso}
                                                            placeholder="0"
                                                            onChange={(e) => updateCelda(idx, "abono_deuda", e.target.value)}
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
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
        </div>
    );
}