import { useEffect, useState, useMemo } from "react";
import { orderService } from "../services/orderService";
import { inventoryService } from "../services/inventoryService";
import { alertError, alertSuccess, alertConfirm } from "../services/alertService";
import {
    ClipboardList, ShoppingBag,
    X, Eye, Edit3, Save, Trash2, Plus, Minus,
} from "lucide-react";

export default function PedidosPage() {
    const [orders, setOrders] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderItems, setOrderItems] = useState([]);

    // ESTADOS DE EDICIÓN
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [editForm, setEditForm] = useState({
        seller_name: "",
        items: []
    });

    const user = JSON.parse(localStorage.getItem("user"));
    const canManage = ["ADMINISTRADOR", "DESPACHADOR"].includes(user?.role?.toUpperCase());

    useEffect(() => {
        loadOrders();
        loadProducts();
    }, []);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const data = await orderService.getOrdersHistory(user);
            setOrders(data || []);
        } catch (err) { alertError("Error", "No se cargaron los pedidos."); }
        finally { setLoading(false); }
    };

    const loadProducts = async () => {
        try {
            const data = await inventoryService.getProducts();
            setAllProducts(data || []);
        } catch (err) {
            console.error("Error cargando productos", err);
        }
    };

    const handleViewDetail = async (order) => {
        setSelectedOrder(order);
        try {
            const res = await orderService.getOrderDetail(order.id);
            setOrderItems(res || []);
        } catch (err) { alertError("Error", "No se pudo cargar el detalle."); }
    };

    // --- Función para abrir el modal de edición ---
    const handleOpenEdit = async (order) => {
        try {
            const detail = await orderService.getOrderDetail(order.id);

            setEditingOrder(order);
            setEditForm({
                seller_name: order.seller_name || "",
                customer_type_id: order.customer_type_id,
                items: detail.map(i => ({
                    product_id: i.product_id,
                    // BUSCAMOS EL NOMBRE: Intentamos varias opciones según lo que envíe el SQL
                    product_name: i.product_name || i.name || "Producto desconocido",
                    quantity: Number(i.quantity),
                    unit_price: Number(i.unit_price)
                }))
            });
            setIsEditModalOpen(true);
        } catch (err) {
            alertError("Error", "No se pudo cargar el detalle.");
        }
    };

    const handleUpdateQty = (index, delta) => {
        const newItems = [...editForm.items];
        const newQty = newItems[index].quantity + delta;
        if (newQty > 0) {
            newItems[index].quantity = newQty;
            setEditForm({ ...editForm, items: newItems });
        }
    };

    const handleRemoveItem = (index) => {
        const newItems = editForm.items.filter((_, i) => i !== index);
        setEditForm({ ...editForm, items: newItems });
    };

    const handleAddItem = (productId) => {
        const prod = allProducts.find(p => p.id === parseInt(productId));
        if (!prod) return;

        if (editForm.items.find(i => i.product_id === prod.id)) {
            return alertError("Aviso", "El producto ya está en el pedido.");
        }

        setEditForm({
            ...editForm,
            items: [...editForm.items, {
                product_id: prod.id,
                product_name: prod.name,
                quantity: 1,
                unit_price: 0
            }]
        });
    };

    // --- Función para guardar los cambios ---
    const handleSaveEdit = async () => {
        const itemsValidos = editForm.items
            .filter(it => it.product_id && !isNaN(it.product_id))
            .map(it => ({
                product_id: Number(it.product_id),
                quantity: Number(it.quantity)
            }));

        if (itemsValidos.length === 0) {
            return alertError("Error", "El pedido no tiene productos válidos.");
        }
        const confirm = await alertConfirm("¿Actualizar pedido?", "Se ajustará el stock automáticamente.");
        if (confirm.isConfirmed) {
            try {
                const payload = {
                    seller_name: editForm.seller_name,
                    customer_type_id: editingOrder.customer_type_id,
                    items: itemsValidos
                };

                await orderService.updateOrderFull(editingOrder.id, payload);

                alertSuccess("Éxito", "Pedido actualizado correctamente.");
                setIsEditModalOpen(false);
                loadOrders();
            } catch (err) {
                alertError("Error al guardar", err);
            }
        }
    };

    const handleDeleteOrder = async (order) => {
        const confirm = await alertConfirm("¿Eliminar pedido?", "Esta acción devolverá todos los productos al inventario.");
        if (confirm.isConfirmed) {
            try {
                await orderService.deleteOrder(order.id);
                alertSuccess("Eliminado", "El pedido fue borrado y el stock restaurado.");
                loadOrders();
            } catch (err) { alertError("Error", err); }
        }
    };

    const [filters, setFilters] = useState({
        fecha: "",
        tipoCliente: "",
        vendedor: "",
        despachador: ""
    });
    const filteredOrders = useMemo(() => {
        let baseOrders = orders;

        // Solo restringimos si NO es Admin Y NO es Despachador
        if (user?.role?.toUpperCase() !== 'ADMINISTRADOR' && user?.role?.toUpperCase() !== 'DESPACHADOR') {
            baseOrders = orders.filter(o => Number(o.seller_name) === Number(user.id));
        }

        return baseOrders.filter(o => {
            const matchesSearch = o.seller_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.id.toString().includes(searchTerm);

            const d = new Date(o.created_at);
            const orderDateFormatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            const matchesFecha = !filters.fecha || orderDateFormatted === filters.fecha;
            const matchesTipo = !filters.tipoCliente || o.customer_type_name?.toLowerCase() === filters.tipoCliente.toLowerCase();

            // Cambiamos la lógica aquí para que sea más robusta
            const matchesVendedor = !filters.vendedor || o.seller_name?.toString().toLowerCase().includes(filters.vendedor.toLowerCase());

            // Si es Admin o Despachador, permitimos ver según los filtros de búsqueda
            if (user?.role?.toUpperCase() === 'ADMINISTRADOR' || user?.role?.toUpperCase() === 'DESPACHADOR') {
                return matchesSearch && matchesFecha && matchesTipo && matchesVendedor;
            } else {
                return matchesSearch && matchesFecha;
            }
        });
    }, [orders, searchTerm, user, filters]);

    // 2. SEGUNDO: Definir las estadísticas (Dependen de filteredOrders)
    const stats = useMemo(() => {
        const role = user?.role?.toUpperCase();
        const totalPedidos = filteredOrders.length;
        const totalDinero = filteredOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
        const pedidosSocio = filteredOrders.filter(o => o.customer_type_name?.toUpperCase() === 'SOCIO').length;
        const pedidosNoSocio = filteredOrders.filter(o => o.customer_type_name?.toUpperCase() === 'NO_SOCIO').length;

        const config = {
            ADMINISTRADOR: [
                { label: "TOTAL PEDIDOS", value: totalPedidos, color: "#6366f1", icon: <ClipboardList size={20} />, sub: "Operaciones totales" },
                { label: "TOTAL DESPACHADO", value: `$${totalDinero.toLocaleString()}`, color: "#10b981", icon: <ShoppingBag size={20} />, sub: "Dinero ingresado" },
                { label: "TOTAL SOCIO", value: pedidosSocio, color: "#f59e0b", icon: <Plus size={20} />, sub: "Pedidos generales" },
                { label: "TOTAL NO SOCIO", value: pedidosNoSocio, color: "#ef4444", icon: <Minus size={20} />, sub: "Pedidos generales" }
            ],
            DESPACHADOR: [
                { label: "PEDIDOS DESPACHADOS", value: totalPedidos, color: "#6366f1", icon: <ClipboardList size={20} />, sub: "Listos para entrega" },
                { label: "VOLUMEN DESPACHO", value: `$${totalDinero.toLocaleString()}`, color: "#10b981", icon: <ShoppingBag size={20} />, sub: "Valor mercancía" }
            ],
            DEFAULT: [
                { label: "MIS PEDIDOS", value: totalPedidos, color: "#6366f1", icon: <ClipboardList size={20} />, sub: "Historial personal" }
            ]
        };

        return config[role] || config.DEFAULT;
    }, [filteredOrders, user]);
    // LÓGICA DE TÍTULOS DINÁMICOS
    const pageHeader = useMemo(() => {
        switch (user?.role?.toUpperCase()) {
            case 'ADMINISTRADOR':
                return {
                    title: "Panel de Control Global",
                    subtitle: "Supervisión total de ventas, despachos y stock"
                };
            case 'DESPACHADOR':
                return {
                    title: "Gestión de Despachos",
                    subtitle: "Control de salida de mercancía y pedidos activos"
                };
            default:
                return {
                    title: "Mis Pedidos Realizados",
                    subtitle: "Historial personal de ventas y seguimiento"
                };
        }
    }, [user]);
    if (loading) return <div className="inv-page">Cargando panel de control...</div>;

    const formatFechaConDia = (fechaStr) => {
        const fecha = new Date(fechaStr);
        const opcionesFecha = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const opcionesDia = { weekday: 'long' };

        const fechaNum = fecha.toLocaleDateString('es-ES', opcionesFecha);
        const nombreDia = fecha.toLocaleDateString('es-ES', opcionesDia);

        return `${fechaNum} - ${nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)}`;
    };
    return (
        <div className="inv-page full-layout">
            <div className="module-intro" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: 'var(--primary)', color: 'white', padding: '12px', borderRadius: '12px' }}>
                        <ClipboardList size={28} />
                    </div>
                    <div>
                        {/* APLICACIÓN DE TÍTULOS DINÁMICOS */}
                        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{pageHeader.title}</h1>
                        <p style={{ margin: 0, opacity: 0.8 }}>{pageHeader.subtitle}</p>
                    </div>
                </div>
            </div>

            <div className="inventory-stats" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
            }}>
                {stats.map((stat, index) => (
                    <div key={index} style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '16px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        borderLeft: `5px solid ${stat.color}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        position: 'relative'
                    }}>
                        <div>
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: '#64748b',
                                display: 'block',
                                marginBottom: '8px',
                                letterSpacing: '0.05em'
                            }}>
                                {stat.label}
                            </span>
                            <h2 style={{
                                margin: 0,
                                fontSize: '1.6rem',
                                fontWeight: '800',
                                color: '#1e293b'
                            }}>
                                {stat.value}
                            </h2>
                            <p style={{
                                margin: '5px 0 0 0',
                                fontSize: '0.7rem',
                                color: stat.color,
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                {stat.sub}
                            </p>
                        </div>

                        {/* Círculo del Icono */}
                        <div style={{
                            background: `${stat.color}15`, // Color con 15% opacidad
                            color: stat.color,
                            padding: '10px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {stat.icon}
                        </div>
                    </div>
                ))}
            </div>
            {/* SECCIÓN DE FILTROS DINÁMICOS */}
            <div className="inv-card" style={{ marginBottom: '20px', padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '80px' }}>

                    {/* FECHA */}
                    <div className="filter-group">
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>FECHA</label>
                        <input
                            type="date"
                            className="input"
                            style={{ width: '100%', marginTop: '5px' }}
                            value={filters.fecha} // IMPORTANTE
                            onChange={(e) => setFilters({ ...filters, fecha: e.target.value })}
                        />
                    </div>

                    {(user?.role === 'ADMINISTRADOR' || user?.role === 'DESPACHADOR') && (
                        <>
                            {/* TIPO CLIENTE */}
                            <div className="filter-group">
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>TIPO CLIENTE</label>
                                <select
                                    className="input"
                                    style={{ width: '100%', marginTop: '5px' }}
                                    value={filters.tipoCliente} // IMPORTANTE
                                    onChange={(e) => setFilters({ ...filters, tipoCliente: e.target.value })}
                                >
                                    <option value="">Todos</option>
                                    <option value="SOCIO">Socio</option>
                                    <option value="NO_SOCIO">No Socio</option>
                                    <option value="CLIENTE">Cliente</option>
                                    <option value="DESPACHO_MAYOR">Despacho Mayor</option>
                                </select>
                            </div>
                            {/* VENDEDOR */}
                            {(user?.role === 'ADMINISTRADOR' || user?.role === 'DESPACHADOR') && (
                                <div className="filter-group">
                                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>NOMBRE A QUIEN SE LE ENTREGA</label>
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre..."
                                        className="input"
                                        style={{ width: '100%', marginTop: '5px' }}
                                        value={filters.vendedor}
                                        onChange={(e) => setFilters({ ...filters, vendedor: e.target.value })}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                            className="btn-edit"
                            style={{ width: '100%', height: '40px', background: '#f1f5f9', color: '#475569' }}
                            onClick={() => setFilters({ fecha: "", tipoCliente: "", vendedor: "", despachador: "" })}
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
            </div>
            <div className="inv-card">

                <div style={{ overflowX: 'auto' }}>
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>ID Pedido</th>
                                <th>Fecha</th>
                                {/* ID PEDIDO */}
                                {(user?.role === 'ADMINISTRADOR' || user?.role === 'DESPACHADOR') && (
                                    <th>nombre a quien se le entrega</th>
                                )}
                                {user?.role === 'ADMINISTRADOR' && (
                                    <th>Tipo Cliente</th>
                                )}
                            
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th style={{ textAlign: 'center' }}>Estado</th>
                                <th style={{ textAlign: 'center' }}>Gestión</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(o => (
                                <tr key={o.id}>
                                    {/* ID PEDIDO */}
                                    <td className="font-bold" style={{ color: '#6366f1' }}>#{o.id}</td>
                                    {/* FECHA */}
                                    <td>{formatFechaConDia(o.created_at)}</td>
                                    {/* NOMBRE A QUIEN SE LE ENTREGA */}
                                    <td style={{ fontWeight: '500' }}>{o.seller_name}</td>
                                    {/* TYPO DE */}
                                    {user?.role === 'ADMINISTRADOR' && (
                                        <td style={{ fontWeight: '500' }}>{o.customer_type_name}</td>
                                    )}

                                    <td style={{ textAlign: 'right', fontWeight: '700' }}>
                                        ${Number(o.total_amount).toLocaleString()}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className="badge-stock" style={{ background: '#dcfce7', color: '#15803d' }}>
                                            {o.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        <button className="btn-edit" onClick={() => handleViewDetail(o)} title="Ver Detalle">
                                            <Eye size={14} />
                                        </button>
                                        {canManage && (
                                            <>
                                                <button className="btn-edit" style={{ background: '#f59e0b', color: 'white' }} onClick={() => handleOpenEdit(o)} title="Editar Pedido">
                                                    <Edit3 size={14} />
                                                </button>
                                                {user?.role === 'ADMINISTRADOR' && (
                                                    <button className="btn-edit" style={{ background: '#ef4444', color: 'white' }} onClick={() => handleDeleteOrder(o)} title="Eliminar">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL EDITAR */}
            {isEditModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '700px', borderRadius: '16px' }}>
                        <div className="modal-header">
                            <h2>Editar Pedido #{editingOrder.id}</h2>
                            <button onClick={() => setIsEditModalOpen(false)}><X /></button>
                        </div>
                        <div className="modal-body">
                            <div className="input-group" style={{ marginBottom: '20px' }}>
                                <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Nombre del Receptor</label>
                                <input
                                    className="input"
                                    value={editForm.seller_name}
                                    onChange={(e) => setEditForm({ ...editForm, seller_name: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                            </div>

                            <h4 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ShoppingBag size={18} /> Productos en el Pedido
                            </h4>

                            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '5px' }}>
                                {editForm.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                                        <div style={{ flex: 2 }}>
                                            <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem' }}>{item.product_name}</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'center' }}>
                                            <button onClick={() => handleUpdateQty(idx, -1)} style={{ padding: '4px', background: '#f1f5f9', borderRadius: '6px' }}><Minus size={14} /></button>
                                            <span style={{ fontWeight: 'bold', minWidth: '25px', textAlign: 'center' }}>{item.quantity}</span>
                                            <button onClick={() => handleUpdateQty(idx, 1)} style={{ padding: '4px', background: '#f1f5f9', borderRadius: '6px' }}><Plus size={14} /></button>
                                        </div>
                                        <button onClick={() => handleRemoveItem(idx)} style={{ color: '#ef4444', padding: '8px' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                                <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Agregar Nuevo Producto</label>
                                <select
                                    className="input"
                                    onChange={(e) => handleAddItem(e.target.value)}
                                    defaultValue=""
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
                                >
                                    <option value="" disabled>Seleccione para añadir...</option>
                                    {allProducts.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn-primary-main" onClick={handleSaveEdit} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
                                    <Save size={18} /> Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DETALLE */}
            {selectedOrder && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ borderRadius: '16px', maxWidth: '650px', width: '90%' }}>
                        <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '20px' }}>
                            <h2 style={{ margin: 0, color: '#1e293b' }}>Orden #{selectedOrder.id}</h2>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: '25px' }}>
                            {/* Info del Cliente y Fecha */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '25px',
                                padding: '18px',
                                background: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0'
                            }}>
                                <div>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em' }}>NOMBRE A QUIEN SE LE ENTREGA</p>
                                    <p style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem', color: '#1e293b' }}>
                                        {selectedOrder.seller_name || 'Sin nombre'}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em' }}>FECHA DEL PEDIDO</p>
                                    <p style={{ margin: 0, fontWeight: '600', color: '#334155' }}>
                                        {selectedOrder.created_at
                                            ? formatFechaConDia(selectedOrder.created_at)
                                            : '10/02/2026' /* Fecha de ejemplo si no viene de la DB */}
                                    </p>
                                </div>
                            </div>

                            {/* Tabla de Productos */}
                            <div style={{ overflowX: 'auto' }}>
                                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                            <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: '0.85rem' }}>Producto</th>
                                            <th style={{ textAlign: 'center', padding: '12px 8px', color: '#64748b', fontSize: '0.85rem' }}>Cant.</th>
                                            <th style={{ textAlign: 'right', padding: '12px 8px', color: '#64748b', fontSize: '0.85rem' }}>Precio Unit.</th>
                                            <th style={{ textAlign: 'right', padding: '12px 8px', color: '#64748b', fontSize: '0.85rem' }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orderItems.map((item, idx) => {
                                            // Forzamos conversión a número para evitar el $NaN
                                            const price = Number(item.unit_price || 0);
                                            const qty = Number(item.quantity || 0);
                                            const subtotal = price * qty;

                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '14px 8px', fontSize: '0.95rem', color: '#334155' }}>{item.product_name}</td>
                                                    <td style={{ textAlign: 'center', padding: '14px 8px', fontWeight: '500' }}>{qty}</td>
                                                    <td style={{ textAlign: 'right', padding: '14px 8px', color: '#64748b' }}>
                                                        ${price.toLocaleString('es-CO')}
                                                    </td>
                                                    <td style={{ textAlign: 'right', padding: '14px 8px', fontWeight: '700', color: '#1e293b' }}>
                                                        ${subtotal.toLocaleString('es-CO')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Total Final */}
                            <div style={{
                                marginTop: '25px',
                                textAlign: 'right',
                                borderTop: '3px solid #f1f5f9',
                                paddingTop: '20px'
                            }}>
                                <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>TOTAL A PAGAR</p>
                                <span style={{
                                    fontSize: '1.8rem',
                                    fontWeight: '900',
                                    color: '#b91c1c', // Rojo elegante para el total
                                    display: 'block'
                                }}>
                                    ${Number(selectedOrder.total_amount || 0).toLocaleString('es-CO')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}