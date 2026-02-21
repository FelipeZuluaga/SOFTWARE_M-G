import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Printer, MapPin, Phone, Search } from "lucide-react"; // Importamos Search
import { saleService } from "../services/saleService";
import { alertError } from "../services/alertService";

export default function VentasDetalleReadOnly() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [rutaData, setRutaData] = useState([]);
    const [searchTerm, setSearchTerm] = useState(""); // Estado para el buscador
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlanilla = async () => {
            try {
                setLoading(true);
                const data = await saleService.getRutaCompleta(orderId);
                setRutaData(data);
            } catch (err) {
                alertError("Error", "No se pudo cargar la planilla de la ruta.");
            } finally {
                setLoading(false);
            }
        };
        fetchPlanilla();
    }, [orderId]);

    // Lógica de filtrado: busca por nombre de cliente o dirección
    const filteredData = rutaData.filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
            item.nombre_cliente?.toLowerCase().includes(term) ||
            item.direccion?.toLowerCase().includes(term)
        );
    });
    
    if (loading) return <div className="inv-page">Cargando Planilla...</div>;

    return (
        <div className="inv-page full-layout">
            <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => navigate(-1)} className="btn-back-list" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ChevronLeft size={20} /> Volver
                </button>
                
                <h2 style={{ margin: 0, flex: 1 }}>Planilla: #{orderId}</h2>

                {/* --- BUSCADOR --- */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={18} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Buscar cliente o dirección..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            padding: '8px 12px 8px 35px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            width: '250px',
                            fontSize: '14px'
                        }}
                    />
                </div>

                <button onClick={() => window.print()} className="btn-confirm-all" style={{ background: '#64748b' }}>
                    <Printer size={20} /> Imprimir
                </button>
            </div>

            <div className="planilla-wrapper">
                <table className="excel-table">
                    <thead>
                        <tr>
                            <th>CLIENTE</th>
                            <th>DIRECCIÓN</th>
                            <th>ESTADO</th>
                            <th>VENTA</th>
                            <th>ABONO</th>
                            <th>TELÉFONO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length > 0 ? (
                            filteredData.map((item, idx) => (
                                <tr key={idx} className={`fila-${item.estado?.toLowerCase()}`}>
                                    <td className="name-col">{item.nombre_cliente}</td>
                                    <td className="address-col">
                                        <MapPin size={12} /> {item.direccion}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${item.estado?.toLowerCase()}`}>
                                            {item.estado}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>${Number(item.venta || 0).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#3182ce' }}>${Number(item.abono || 0).toLocaleString()}</td>
                                    <td className="name-col">
                                        <Phone size={12} /> {item.telefono}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                                    No se encontraron resultados para "{searchTerm}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}