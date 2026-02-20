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
    const [searchTerm, setSearchTerm] = useState("");
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
    const [showModal, setShowModal] = useState(false);
    const handleSaveNewCustomer = async () => {
        if (!newCustomer.name || !newCustomer.address) {
            return alertError("Error", "Nombre y dirección son obligatorios");
        }

        try {
            setLoading(true);

            const idReferencia = newCustomer.afterCustomerId;
            let posicionFinal = 1;

            if (idReferencia && idReferencia !== "") {
                const clientePrevio = planilla.find(c => String(c.id) === String(idReferencia));
                if (clientePrevio) {
                    posicionFinal = Number(clientePrevio.position) + 1;
                }
            }

            // Determinamos el día correcto para la consulta posterior
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
                alertSuccess("Éxito", `Cliente agregado en la posición ${posicionFinal}`);

                // 1. Limpiar el formulario y cerrar modal
                setShowModal(false);
                setNewCustomer({
                    name: "", address: "", phone: "",
                    afterCustomerId: "", visit_day: "Lunes", seller_id: user.id
                });

                // 2. RECARGAR LA PLANILLA CORRECTAMENTE
                // Pasamos el ID del usuario actual y el día que acabamos de usar
                const planillaActualizada = await fetchPlanilla(user.id, diaDeLaRuta);

                // 3. ACTUALIZAR EL ESTADO PARA QUE SE VEA EN PANTALLA
                setPlanilla(planillaActualizada);

                // 4. OPCIONAL: Limpiar el localStorage para que la siguiente carga 
                // no use la versión vieja sin el cliente nuevo
                if (selectedOrder) {
                    localStorage.removeItem(`planilla_${selectedOrder.id}`);
                }
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


    if (loading) return <div className="loading-screen">Cargando...</div>;
    return (
        <div className="ventas-container">

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

                        <form onSubmit={handleSaveNewCustomer} className="modal-form">
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
                                        <select
                                            className="form-select select-position"
                                            value={newCustomer.afterCustomerId}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, afterCustomerId: e.target.value })}
                                        >
                                            <option value="">-- Al principio de la ruta --</option>
                                            {planilla.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    Insertar después de: {c.name}
                                                </option>
                                            ))}
                                        </select>
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
                        <h1>{user.role === 'ADMINISTRADOR' ? '🚀 Control de Ventas' : '🚚 Mis Rutas'}</h1>
                        <p>Selecciona un día para ver los despachos asignados</p>
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
            ) : (
                <div className="planilla-excel-view">
                    {/* Detalles de la orden */}
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
                            <button onClick={() => setShowModal(true)} className="btn-add-customer">
                                <UserPlus size={20} />
                                <span>Nuevo Cliente</span>
                            </button>

                            {/* Botón guardar la ruta 
                            <button onClick={handleConfirmarTodo} className="btn-confirm-all">
                                <Save size={20} />
                                <span>Guardar Todo</span>
                            </button> */}
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
                                            </tr>
                                        );
                                    })
                                }
                            </tbody>
                        </table>
                    </div>

                </div>
            )}
        </div>
    );
}