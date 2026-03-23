import { useEffect, useState, useMemo } from "react";
import { saleService } from "../services/saleService";
import { alertError } from "../services/alertService";
import { Search, Eye, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/ventasHistory.css"; // <--- Importante importar el CSS

export default function VentasHistoryPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [vendedorSeleccionado, setVendedorSeleccionado] = useState("");
    
    const navigate = useNavigate();
    const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDay());
    const user = JSON.parse(localStorage.getItem("user"));

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        try {
            setLoading(true);
            const allSales = await saleService.getSalesHistory();
            if (user.role === "ADMINISTRADOR") {
                setSales(allSales);
            } else {
                const filtered = allSales.filter(s =>
                    s.seller_name?.trim().toLowerCase() === user.name?.trim().toLowerCase()
                );
                setSales(filtered);
            }
        } catch (err) {
            alertError("Error", "No se pudo cargar el historial de ventas.");
        } finally {
            setLoading(false);
        }
    };

    const listaVendedores = useMemo(() => {
        const nombres = sales.map(s => s.seller_name).filter(Boolean);
        return [...new Set(nombres)];
    }, [sales]);

    const filteredSales = useMemo(() => {
        return sales.filter(s => {
            const fechaVenta = new Date(s.created_at);
            const diaVenta = fechaVenta.getDay();
            const seller = s.seller_name || "";
            const orderId = s.order_id ? s.order_id.toString() : "";

            return (
                diaVenta === diaSeleccionado &&
                (seller.toLowerCase().includes(searchTerm.toLowerCase()) || orderId.includes(searchTerm)) &&
                (vendedorSeleccionado === "" || seller === vendedorSeleccionado)
            );
        });
    }, [sales, searchTerm, diaSeleccionado, vendedorSeleccionado]);

    const handleResetFilters = () => {
        setSearchTerm("");
        setVendedorSeleccionado("");
        setDiaSeleccionado(new Date().getDay());
    };


    const stats = useMemo(() => {
        const totalSalesCount = sales.length;
        const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
        const totalPending = sales.reduce((acc, s) => acc + Number(s.abono || 0), 0);
        return { totalSalesCount, totalRevenue, totalPending };
    }, [sales]);

    if (loading) return <div className="inv-page">Cargando historial de ventas...</div>;

    return (
        <div className="inv-page full-layout history-container">
            <header className="ruta-header-main">
                <h1>{user.role === 'ADMINISTRADOR' ? '🚀 Informe de rutas' : '🚚 Informe de mis rutas'}</h1>
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

            <div className="inv-card">
                <div className="card-header filters-bar">
                    <div className="filters-group-left">
                        <div className="search-box">
                            <Search size={18} color="#94a3b8" />
                            <input
                                type="text"
                                placeholder="Buscar por ID..."
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
                                <th>N° ORDEN</th>
                                <th>FECHA</th>
                                <th>VENDEDOR</th>
                                <th style={{ textAlign: 'center' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.length > 0 ? (
                                filteredSales.map((s) => (
                                    <tr key={s.order_id}>
                                        <td style={{ fontWeight: 'bold' }}>#{s.order_id || 'N/A'}</td>
                                        <td>{new Date(s.created_at).toLocaleDateString()}</td>
                                        <td>{s.seller_name}</td>
                                        <td>
                                            <button
                                                onClick={() => navigate(`/ventas-detalle/${s.order_id}`)}
                                                className="btn-ver-detalle"
                                            >
                                                <Eye size={16} /> Ver Planilla
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="no-results-row">
                                        No se encontraron resultados con los filtros aplicados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}