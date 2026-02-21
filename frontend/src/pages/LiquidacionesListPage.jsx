import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { orderService } from "../services/orderService";

export default function LiquidacionesListPage() {
    const [ordenes, setOrdenes] = useState([]);
    // --- NUEVOS ESTADOS PARA FILTROS ---
    const [filtroId, setFiltroId] = useState("");
    const [filtroVendedor, setFiltroVendedor] = useState("");

    const navigate = useNavigate();
    const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDay());
    const user = JSON.parse(localStorage.getItem("user"));

    useEffect(() => {
        cargarOrdenes();
    }, []);

    const cargarOrdenes = async () => {
        const data = await orderService.getOrdersHistory(JSON.parse(localStorage.getItem("user")));
        setOrdenes(data || []);
    };

    // --- LÓGICA DE FILTRADO COMBINADA ---
    const ordenesFiltradas = ordenes.filter((o) => {
        const coincideDia = new Date(o.created_at).getDay() === diaSeleccionado;
        const coincideId = o.id.toString().includes(filtroId);
        // Usamos seller_name o user_id dependiendo de lo que tengas disponible
        const nombreVendedor = o.seller_name;
        const coincideVendedor = nombreVendedor.toLowerCase().includes(filtroVendedor.toLowerCase());

        return coincideDia && coincideId && coincideVendedor;
    });

    return (
        <div className="p-6">
            <header className="ruta-header-main">
                <h1>{user.role === 'ADMINISTRADOR' ? '🚀 Informe y proceso de Devolucion' : '🚚 Informe y proceso de mis Devolucion'}</h1>
                <p>Viendo rutas del día: <strong>{DIAS_SEMANA[diaSeleccionado]}</strong></p>
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

            {/* --- CONTENEDOR DE BUSCADORES --- */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', marginTop: '10px' }}>
                <input
                    type="text"
                    placeholder="🔍 Buscar por ID Orden..."
                    className="input-search" // Puedes agregar estilos en tu CSS
                    value={filtroId}
                    onChange={(e) => setFiltroId(e.target.value)}
                    style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: 1 }}
                />
                <input
                    type="text"
                    placeholder="👤 Buscar por Vendedor..."
                    className="input-search"
                    value={filtroVendedor}
                    onChange={(e) => setFiltroVendedor(e.target.value)}
                    style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flex: 2 }}
                />
            </div>

            <table className="excel-table">
                <thead>
                    <tr>
                        <th>ID Orden</th>
                        <th>Vendedor</th>          
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {ordenesFiltradas.length > 0 ? (
                        ordenesFiltradas.map((orden) => (
                            <tr key={orden.id}>
                                <td>#{orden.id}</td>
                                <td>{orden.seller_name || `ID: ${orden.user_id}`}</td>
                                
                                
                                <td>
                                    <button
                                        onClick={() => navigate("/devoluciones", { state: { orderId: orden.id } })}
                                        /* Cambiamos la clase si está liquidado para que visualmente se vea distinto */
                                        className={orden.status === 'LIQUIDADO' ? "btn-view" : "btn-action"}
                                    >
                                        {/* Lógica para cambiar el nombre del botón */}
                                        {orden.status === 'LIQUIDADO' ? 'Ver Devolución' : 'Procesar Devolución'}
                                    </button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                                No se encontraron resultados para los filtros aplicados.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}