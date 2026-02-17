import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Printer, MapPin, Phone } from "lucide-react";
import { saleService } from "../services/saleService";
import { alertError } from "../services/alertService";

export default function VentasDetalleReadOnly() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [rutaData, setRutaData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlanilla = async () => {
            try {
                setLoading(true);
                // Llamamos al nuevo endpoint que creamos en el backend
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

    if (loading) return <div className="inv-page">Cargando Planilla...</div>;

    return (
        <div className="inv-page full-layout">
            <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <button onClick={() => navigate(-1)} className="btn-back-list" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ChevronLeft size={20} /> Volver al Historial
                </button>
                <h2 style={{ margin: 0 }}>Planilla de Ruta: #{orderId}</h2>
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
                            <th>PAGO</th>
                            <th>ABONO</th>
                            <th>TELÉFONO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rutaData.map((item, idx) => (
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
                                <td style={{ textAlign: 'right' }}>${Number(item.venta).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>${Number(item.pago).toLocaleString()}</td>
                                <td style={{ textAlign: 'right', color: '#3182ce' }}>${Number(item.abono).toLocaleString()}</td>
                                <td className="name-col">
                                    <Phone size={12} /> {item.telefono}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}