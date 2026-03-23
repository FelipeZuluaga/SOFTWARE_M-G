import { customerService } from '../services/customerService';
import { useEffect, useState, useMemo } from "react";
import { Search, Trash2, Edit } from "lucide-react";

const CustomerList = ({ sellerId }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [vendedorSeleccionado, setVendedorSeleccionado] = useState("");
    // Estados necesarios
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clienteEdicion, setClienteEdicion] = useState(null);
    const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    // Inicializamos con el día actual
    const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDay());

    const user = JSON.parse(localStorage.getItem("user"));

    const loadCustomers = async () => {
        setLoading(true);
        try {
            // El filtro de día que enviamos al backend debe ser el nombre del día
            const nombreDia = DIAS_SEMANA[diaSeleccionado];
            // Si el usuario es administrador y no hay un sellerId específico, 
            // podrías querer traer todos o filtrar por el vendedor seleccionado.
            const data = await customerService.getDetailedList(sellerId, nombreDia);
            setCustomers(data);
        } catch (error) {
            console.error("Error cargando clientes:", error);
        } finally {
            setLoading(false);
        }
    };

    // Recargar cuando cambie el vendedor base o el día seleccionado en los botones
    useEffect(() => {
        loadCustomers();
    }, [sellerId, diaSeleccionado]);

    // Lógica de filtrado combinado (Búsqueda por texto + Vendedor)
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

    // Extraer lista única de vendedores de los clientes actuales para el select
    const listaVendedores = useMemo(() => {
        const nombres = customers.map(c => c.seller_name).filter(Boolean);
        return [...new Set(nombres)];
    }, [customers]);

    const handleResetFilters = () => {
        setSearchTerm("");
        setVendedorSeleccionado("");
        setDiaSeleccionado(new Date().getDay());
    };
    // Lógica para abrir el modal
    const handleEdit = (cliente) => {
        setClienteEdicion(cliente);
        setIsModalOpen(true);
    };
    // Lógica para eliminar con confirmación
    const handleDelete = async (id) => {
        if (window.confirm("¿Estás seguro de que deseas eliminar este cliente?")) {
            try {
                await customerService.deleteCustomer(id); // Debes crear esta función en tu servicio
                loadCustomers(); // Refresca la tabla
            } catch (error) {
                alert("Error al eliminar el cliente");
            }
        }
    };

    return (
        <>
        { isModalOpen && (
            <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div className="modal-content" style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '400px' }}>
                    <h3 className="mb-4">Editar Cliente</h3>

                    <div className="flex flex-col gap-3">
                        <input
                            className="border p-2"
                            placeholder="Nombre"
                            value={clienteEdicion.customer_name}
                            onChange={(e) => setClienteEdicion({ ...clienteEdicion, customer_name: e.target.value })}
                        />
                        <input
                            className="border p-2"
                            placeholder="Dirección"
                            value={clienteEdicion.customer_address}
                            onChange={(e) => setClienteEdicion({ ...clienteEdicion, customer_address: e.target.value })}
                        />
                        <input
                            className="border p-2"
                            placeholder="Teléfono"
                            value={clienteEdicion.phone}
                            onChange={(e) => setClienteEdicion({ ...clienteEdicion, phone: e.target.value })}
                        />
                    </div>

                    <div className="mt-4 flex gap-2">
                        <button
                            className="bg-blue-600 text-white px-4 py-2 rounded"
                            onClick={async () => {
                                await customerService.updateCustomer(clienteEdicion.id, clienteEdicion);
                                setIsModalOpen(false);
                                loadCustomers(); // Refresca la tabla
                            }}
                        >
                            Guardar Cambios
                        </button>
                        <button
                            className="bg-gray-300 px-4 py-2 rounded"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        )}
<div className="inv-page full-layout history-container">
    <header className="ruta-header-main">
        <h1>{user.role === 'ADMINISTRADOR' ? '🚀 Informe de Clientes' : '🚚 Informe de mis rutas'}</h1>
        <p>Viendo clientes del día: <strong>{DIAS_SEMANA[diaSeleccionado]}</strong></p>
    </header>

    {/* Selector de Días */}
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
            <table className="inv-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Dirección</th>
                        <th>Teléfono</th>
                        <th>Día Visita</th>
                        <th>Deuda Total</th>
                        <th>Nombre vendedor</th>
                        {user.role === 'ADMINISTRADOR' && <th>Acciones</th>}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan="6" className="text-center p-4">Cargando clientes...</td></tr>
                    ) : clientesFiltrados.length > 0 ? (
                        clientesFiltrados.map((c) => (
                            <tr key={c.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{c.customer_name}</td>
                                <td className="p-3 text-sm">{c.customer_address}</td>
                                <td className="p-3 text-sm">{c.phone || 'N/A'}</td>
                                <td className="p-3">
                                    <span className="badge-dia">{c.visit_day}</span>
                                </td>
                                <td className="p-3 text-red-600 font-bold">
                                    ${parseFloat(c.total_debt).toLocaleString()}
                                </td>
                                <td className="p-3 text-sm font-medium text-blue-700 italic">
                                    {c.seller_name || "Vendedor General"}
                                </td>
                                {user.role === 'ADMINISTRADOR' && (
                                    <td className="p-3 flex gap-2">
                                        <button
                                            onClick={() => handleEdit(c)}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan="6" className="text-center p-10 text-gray-500">No se encontraron clientes con los filtros aplicados.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
</div>
        </>
    );
};
export default CustomerList;