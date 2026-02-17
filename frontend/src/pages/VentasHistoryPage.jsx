import { useEffect, useState, useMemo } from "react";
import { saleService } from "../services/saleService";
import { alertError } from "../services/alertService";
import {
    ShoppingBag,
    Search,
    TrendingUp,
    AlertCircle,
    CheckCircle,
    ArrowUpRight,
    Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function VentasHistoryPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

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

    const stats = useMemo(() => {
        const totalSalesCount = sales.length;
        const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
        const totalPending = sales.reduce((acc, s) => acc + Number(s.credit_amount || 0), 0);
        return { totalSalesCount, totalRevenue, totalPending };
    }, [sales]);

    const filteredSales = sales.filter(s => {
        const seller = s.seller_name || "";
        const orderId = s.order_id ? s.order_id.toString() : "";
        return (
            seller.toLowerCase().includes(searchTerm.toLowerCase()) ||
            orderId.includes(searchTerm)
        );
    });

    if (loading) return <div className="inv-page">Cargando historial de ventas...</div>;

    return (
        <div className="inv-page full-layout">
            <div className="module-intro" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: '#10b981', color: 'white', padding: '12px', borderRadius: '12px' }}>
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Historial de Ventas</h1>
                        <p style={{ margin: 0, opacity: 0.8 }}>Registro por Orden, Vendedor y Crédito</p>
                    </div>
                </div>
            </div>

            <div className="inventory-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div className="stat-card" style={{ borderLeft: '5px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span className="stat-label">TOTAL VENDIDO</span>
                            <h2 className="stat-value">${stats.totalRevenue.toLocaleString()}</h2>
                        </div>
                        <div style={{ background: '#dcfce7', color: '#10b981', padding: '10px', borderRadius: '10px' }}>
                            <CheckCircle size={22} />
                        </div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '5px solid #ef4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span className="stat-label">CRÉDITOS (POR COBRAR)</span>
                            <h2 className="stat-value">${stats.totalPending.toLocaleString()}</h2>
                        </div>
                        <div style={{ background: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '10px' }}>
                            <AlertCircle size={22} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="inv-card">
                <div className="card-header">
                    <div className="search-box">
                        <Search size={18} color="#94a3b8" />
                        <input
                            type="text"
                            placeholder="Buscar por ID de orden o vendedor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
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
                            {filteredSales.map((s) => (
                                <tr key={s.order_id}>
                                    <td style={{ fontWeight: 'bold' }}>#{s.order_id || 'N/A'}</td>
                                    <td>{new Date(s.created_at).toLocaleDateString()}</td>
                                    <td>{s.seller_name}</td>
                                    <td style={{ textAlign: 'center' }}>
                                       
                                        <button
                                            onClick={() => navigate(`/ventas-detalle/${s.order_id}`)} // Ajustado para coincidir con App.js
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                background: '#6366f1',
                                                color: 'white',
                                                padding: '6px 12px',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                margin: '0 auto'
                                            }}
                                        >
                                            <Eye size={16} /> Ver Planilla
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}