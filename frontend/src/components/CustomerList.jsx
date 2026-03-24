import { customerService } from '../services/customerService';
import { useEffect, useState, useMemo } from "react";
import { Search, Trash2, Edit } from "lucide-react";

const CustomerList = ({ sellerId }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [vendedorSeleccionado, setVendedorSeleccionado] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clienteEdicion, setClienteEdicion] = useState(null);
    const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDay());

    const user = JSON.parse(localStorage.getItem("user"));

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const nombreDia = DIAS_SEMANA[diaSeleccionado];
            const data = await customerService.getDetailedList(sellerId, nombreDia);
            setCustomers(data);
        } catch (error) {
            console.error("Error cargando clientes:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, [sellerId, diaSeleccionado]);

    const clientesFiltrados = useMemo(() => {
        return customers.filter(c => {
            const coincideBusqueda =
                c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.id.toString().includes(searchTerm);
            const coincideVendedor =
                vendedorSeleccionado === "" ||
                c.seller_name === vendedorSeleccionado;
            return coincideBusqueda && coincideVendedor;
        });
    }, [customers, searchTerm, vendedorSeleccionado]);

    const listaVendedores = useMemo(() => {
        const nombres = customers.map(c => c.seller_name).filter(Boolean);
        return [...new Set(nombres)];
    }, [customers]);

    const handleResetFilters = () => {
        setSearchTerm("");
        setVendedorSeleccionado("");
        setDiaSeleccionado(new Date().getDay());
    };

    const handleEdit = (cliente) => {
        setClienteEdicion(cliente);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Estás seguro de que deseas eliminar este cliente?")) {
            try {
                await customerService.deleteCustomer(id);
                loadCustomers();
            } catch (error) {
                alert("Error al eliminar el cliente");
            }
        }
    };

    const handleAddNew = () => {
        setClienteEdicion({
            customer_name: "",
            customer_address: "",
            phone: "",
            visit_day: DIAS_SEMANA[diaSeleccionado],
            total_debt: 0,
            position: 0,
            visit_status_c: "PENDIENTE",
            seller_id: sellerId || ""
        });
        setIsModalOpen(true);
    };

    return (
        <>
            {isModalOpen && (
                <div style={styles.overlay}>
                    <div style={styles.modal}>
                        <div style={styles.header}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Gestionar Cliente</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>
                                    ID: {clienteEdicion.id} • Deuda: ${parseFloat(clienteEdicion.total_debt).toLocaleString()}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>&times;</button>
                        </div>

                        <div style={styles.body}>
                            <div style={styles.grid}>
                                <div style={styles.column}>
                                    <h4 style={styles.sectionTitle}>Información General</h4>
                                    <div style={styles.inputGroup}>
                                        <label style={styles.label}>Nombre del Cliente</label>
                                        <input
                                            style={styles.input}
                                            value={clienteEdicion.customer_name}
                                            onChange={(e) => setClienteEdicion({ ...clienteEdicion, customer_name: e.target.value })}
                                        />
                                    </div>
                                    <div style={styles.inputGroup}>
                                        <label style={styles.label}>Dirección</label>
                                        <input
                                            style={styles.input}
                                            value={clienteEdicion.customer_address}
                                            onChange={(e) => setClienteEdicion({ ...clienteEdicion, customer_address: e.target.value })}
                                        />
                                    </div>
                                    <div style={styles.inputGroup}>
                                        <label style={styles.label}>Teléfono</label>
                                        <input
                                            style={styles.input}
                                            value={clienteEdicion.phone}
                                            onChange={(e) => setClienteEdicion({ ...clienteEdicion, phone: e.target.value })}
                                        />
                                    </div>
                                    <div style={styles.inputGroup}>
                                        <label style={styles.label}>Total deuda</label>
                                        <input
                                            style={styles.input}
                                            type="number"
                                            value={clienteEdicion.total_debt}
                                            onChange={(e) => setClienteEdicion({ ...clienteEdicion, total_debt: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div style={styles.column}>
                                    <h4 style={styles.sectionTitle}>Logística y Ruta</h4>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{ ...styles.inputGroup, flex: 1 }}>
                                            <label style={styles.label}>Día Visita</label>
                                            <select
                                                style={styles.input}
                                                value={clienteEdicion.visit_day}
                                                onChange={(e) => setClienteEdicion({ ...clienteEdicion, visit_day: e.target.value })}
                                            >
                                                {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div style={{ ...styles.inputGroup, flex: 1 }}>
                                            <label style={styles.label}>Posición</label>
                                            <input
                                                type="number"
                                                style={styles.input}
                                                value={clienteEdicion.position}
                                                onChange={(e) => setClienteEdicion({ ...clienteEdicion, position: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div style={styles.inputGroup}>
                                        <label style={styles.label}>Estado de Visita</label>
                                        <select
                                            style={styles.input}
                                            value={clienteEdicion.visit_status_c}
                                            onChange={(e) => setClienteEdicion({ ...clienteEdicion, visit_status_c: e.target.value })}
                                        >
                                            <option value="PENDIENTE">Pendiente</option>
                                            <option value="VISITADO">Visitado</option>
                                            <option value="NO_VISITADO">No Visitado</option>
                                        </select>
                                    </div>
                                    {user.role === "ADMINISTRADOR" && (
                                        <div style={styles.inputGroup}>
                                            <label style={styles.label}>Asignar Vendedor</label>
                                            <select
                                                style={styles.input}
                                                value={clienteEdicion.seller_id}
                                                onChange={(e) => setClienteEdicion({ ...clienteEdicion, seller_id: e.target.value })}
                                            >
                                                <option value="">Seleccione un vendedor</option>
                                                {customers.reduce((acc, curr) => {
                                                    if (!acc.find(v => v.id === curr.seller_id)) {
                                                        acc.push({ id: curr.seller_id, name: curr.seller_name });
                                                    }
                                                    return acc;
                                                }, []).map(v => (
                                                    <option key={v.id} value={v.id}>{v.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={styles.footer}>
                            <button onClick={() => setIsModalOpen(false)} style={styles.btnCancel}>Cancelar</button>
                            <button
                                style={styles.btnSave}
                                onClick={async () => {
                                    try {
                                        if (clienteEdicion.id) {
                                            await customerService.updateCustomer(clienteEdicion.id, clienteEdicion);
                                        } else {
                                            const newCustomerData = {
                                                name: clienteEdicion.customer_name,
                                                address: clienteEdicion.customer_address,
                                                phone: clienteEdicion.phone,
                                                visit_day: clienteEdicion.visit_day,
                                                seller_id: clienteEdicion.seller_id,
                                                position: clienteEdicion.position
                                            };
                                            await customerService.createCustomer(newCustomerData);
                                        }
                                        setIsModalOpen(false);
                                        loadCustomers();
                                    } catch (error) {
                                        alert("Error: " + error.message);
                                    }
                                }}
                            >
                                {clienteEdicion.id ? "Actualizar Datos" : "Guardar Nuevo Cliente"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="inv-page full-layout history-container">
                <header className="ruta-header-main">
                    <h1>{user.role === 'ADMINISTRADOR' ? '🚀 Informe de Clientes' : '🚚 Informe de mis rutas'}</h1>
                    <p>Viendo clientes del día: <strong>{DIAS_SEMANA[diaSeleccionado]}</strong></p>
                    {user.role === 'ADMINISTRADOR' && (
                        <button
                            onClick={handleAddNew}
                            style={{ ...styles.btnSave, backgroundColor: '#2563eb' }}
                        >
                            + Agregar Nuevo Cliente
                        </button>
                    )}
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

                <div className="inv-card">
                    <div className="card-header filters-bar">
                        <div className="filters-group-left">
                            <div className="search-box">
                                <Search size={18} color="#94a3b8" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {user.role === "ADMINISTRADOR" && (
                                <select
                                    className="admin-select-vendedor"
                                    value={vendedorSeleccionado}
                                    onChange={(e) => setVendedorSeleccionado(e.target.value)}
                                >
                                    <option value="">Todos los vendedores</option>
                                    {listaVendedores.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <button className="btn-clear-filters" onClick={handleResetFilters}>
                            <Trash2 size={16} /> Limpiar Filtros
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table className="inv-table" style={{ width: '100%', tableLayout: 'auto' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '12px 8px' }}>Dirección</th>
                                    <th style={{ padding: '12px 8px' }}>Nombre</th>
                                    <th style={{ padding: '12px 8px' }}>Teléfono</th>
                                    <th style={{ padding: '12px 8px' }}>Día Visita</th>
                                    {/* Ajuste de ancho y centrado real */}
                                    <th style={{ padding: '12px 8px', textAlign: 'center', width: '100px' }}>Deuda Total</th>
                                    <th style={{ padding: '12px 8px' }}>Nombre vendedor</th>
                                    {user.role === 'ADMINISTRADOR' && <th style={{ padding: '12px 8px', textAlign: 'center' }}>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="text-center p-4">Cargando clientes...</td></tr>
                                ) : clientesFiltrados.length > 0 ? (
                                    clientesFiltrados.map((c) => (
                                        <tr key={c.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3 text-sm">{c.customer_address}</td>
                                            <td className="p-3 font-medium">{c.customer_name}</td>
                                            <td className="p-3 text-sm">{c.phone || 'N/A'}</td>
                                            <td className="p-3 text-center">
                                                <span className="badge-dia">{c.visit_day}</span>
                                            </td>
                                            {/* Celda con ancho fijo y centrado forzado */}
                                            <td className="p-3 text-red-600 font-bold text-center" style={{ width: '100px', whiteSpace: 'nowrap' }}>
                                                ${parseFloat(c.total_debt).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-sm font-medium text-blue-700 italic">
                                                {c.seller_name || "Vendedor General"}
                                            </td>
                                            {user.role === 'ADMINISTRADOR' && (
                                                <td className="p-3">
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button onClick={() => handleEdit(c)} className="text-blue-600 hover:text-blue-800">
                                                            <Edit size={18} />
                                                        </button>
                                                        <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="7" className="text-center p-10 text-gray-500">No se encontraron clientes.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '700px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        animation: 'modalFadeIn 0.3s ease-out'
    },
    header: {
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '20px 25px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '2rem',
        cursor: 'pointer',
        lineHeight: 1
    },
    body: {
        padding: '25px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '30px'
    },
    sectionTitle: {
        fontSize: '0.85rem',
        textTransform: 'uppercase',
        color: '#64748b',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '8px',
        marginBottom: '15px',
        fontWeight: 'bold'
    },
    inputGroup: {
        marginBottom: '15px'
    },
    label: {
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#475569',
        marginBottom: '5px'
    },
    input: {
        width: '100%',
        padding: '10px',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontSize: '0.9rem',
        boxSizing: 'border-box'
    },
    footer: {
        backgroundColor: '#f8fafc',
        padding: '15px 25px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        borderTop: '1px solid #e2e8f0'
    },
    btnCancel: {
        padding: '10px 20px',
        backgroundColor: '#e2e8f0',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
        color: '#475569'
    },
    btnSave: {
        padding: '10px 30px',
        backgroundColor: '#16a34a',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '700',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }
};

export default CustomerList;