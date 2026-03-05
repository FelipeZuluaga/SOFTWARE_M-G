import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Printer, MapPin, Phone } from "lucide-react";
import { saleService } from "../services/saleService";
import { alertError } from "../services/alertService";

export default function VentasDetalleReadOnly() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [rutaData, setRutaData] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    
    // 1. ESTADO PARA LA LIQUIDACIÓN CONSOLIDADA (Imagen 2)
    const [settlement, setSettlement] = useState(null);

    const [headerInfo, setHeaderInfo] = useState({ 
        seller_name: "", 
        date: ""
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                
                // Ejecutamos ambas consultas en paralelo para mayor velocidad
                const [dataPlanilla, dataSettlement] = await Promise.all([
                    saleService.getRutaCompleta(orderId),
                    saleService.getSettlementByOrder(orderId)
                ]);

                setRutaData(dataPlanilla);
                setSettlement(dataSettlement);

                if (dataPlanilla.length > 0) {
                    setHeaderInfo({
                        seller_name: dataPlanilla[0].vendedor_nombre || "N/A",
                        date: dataPlanilla[0].fecha_venta || new Date().toLocaleDateString()
                    });
                }
            } catch (err) {
                console.error(err);
                alertError("Error", "No se pudo cargar la información completa de la ruta.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [orderId]);

    const filteredData = rutaData.filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
            item.nombre_cliente?.toLowerCase().includes(term) ||
            item.direccion?.toLowerCase().includes(term)
        );
    });

    if (loading) return <div className="inv-page">Cargando Planilla...</div>;

    const fechaHoy = new Date().toLocaleDateString('es-ES', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    // Cálculos de respaldo por si el settlement no existe todavía
    const totalSaldoFinal = filteredData.reduce((acc, item) => {
        return acc + (Number(item.debe || 0) + Number(item.venta || 0) - Number(item.abono || 0));
    }, 0);

    return (
        <div className="inv-page full-layout">
            <div className="header-actions">
                <div className="header-left">
                    <button onClick={() => navigate(-1)} className="btn-back-list">
                        <ChevronLeft size={20} />
                        <span>Volver</span>
                    </button>
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
                    <h3 className="ruta-title">Hoja de Ruta: {headerInfo.seller_name}</h3>
                    <p className="ruta-subtitle">FECHA: {fechaHoy.toUpperCase()}</p>
                </div>

                <div className="header-right">
                    <button onClick={() => window.print()} className="btn-confirm-all" style={{ background: '#64748b' }}>
                        <Printer size={20} /> <span>Imprimir</span>
                    </button>
                </div>
            </div>

            <div className="planilla-wrapper">
                <table className="excel-table">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th>DIRECCIÓN</th>
                            <th>CLIENTE</th>
                            <th>ESTADO</th>
                            <th>VENTA</th>
                            <th>DEBE</th>
                            <th>ABONO</th>
                            <th>TOTAL</th>
                            <th>TELÉFONO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((item, idx) => {
                            const debePrevio = Number(item.debe || 0);
                            const ventaHoy = Number(item.venta || 0);
                            const abonoHoy = Number(item.abono || 0);
                            const saldoFinal = debePrevio + ventaHoy - abonoHoy;

                            return (
                                <tr key={idx} className={`fila-${item.estado?.toLowerCase()}`}>
                                    <td className="code-col">{item.posicion || idx + 1}</td>
                                    <td><MapPin size={12} /> {item.direccion}</td>
                                    <td className="name-col">{item.nombre_cliente}</td>
                                    <td><span className={`status-badge ${item.estado?.toLowerCase()}`}>{item.estado}</span></td>
                                    <td style={{ textAlign: 'right' }}>${ventaHoy.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right' }}>${debePrevio.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#3182ce' }}>${abonoHoy.toLocaleString()}</td>
                                    <td className={`total-cell ${saldoFinal > 0 ? 'deuda' : 'saldo-ok'}`} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                        ${saldoFinal.toLocaleString()}
                                    </td>
                                    <td className="name-col"><Phone size={12} /> {item.telefono}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* TABLA DE LIQUIDACIÓN VINCULADA A LA CONSULTA DE LA IMAGEN 2 */}
            <div className="resumen-liquidacion" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
                <table className="excel-table summary-table" style={{ width: '400px' }}>
                    <tbody>
                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                            <th>TOTAL DEBE</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                ${Number(settlement?.cartera_anterior || 0).toLocaleString()}
                            </td>
                        </tr>
                        <tr style={{ backgroundColor: '#fef08a' }}>
                            <th style={{ backgroundColor: '#fef9c3' }}>TOTAL ABONO</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                ${Number(settlement?.total_recaudado || 0).toLocaleString()}
                            </td>
                        </tr>
                        <tr>
                            <th>TOTAL</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                ${totalSaldoFinal.toLocaleString()}
                            </td>
                        </tr>
                        
                        <tr>
                            <th>ALMUERZO</th>
                            <td style={{ textAlign: 'right' }}>
                                ${Number(settlement?.valor_almuerzo || 0).toLocaleString()}
                            </td>
                        </tr>
                        <tr>
                            <th>GASOLINA</th>
                            <td style={{ textAlign: 'right' }}>
                                ${Number(settlement?.valor_gasolina || 0).toLocaleString()}
                            </td>
                        </tr>
                        <tr>
                            <th>SURTIDO</th>
                            <td style={{ textAlign: 'right' }}>
                                ${Number(settlement?.ventas_totales || 0).toLocaleString()}
                            </td>
                        </tr>

                        <tr style={{ backgroundColor: '#fef08a' }}>
                            <th style={{ fontWeight: 'bold' }}>GANANCIA NETA</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                ${Number(settlement?.ganancia_vendedor || 0).toLocaleString()}
                            </td>
                        </tr>

                        <tr style={{ borderTop: '2px solid #333' }}>
                            <th style={{ fontWeight: 'bold', fontSize: '1.1em' }}>EFECTIVO A ENTREGAR</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1em', color: '#2f855a' }}>
                                ${Number(settlement?.efectivo_fisico || 0).toLocaleString()}
                            </td>
                        </tr>

                        <tr style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                            <th style={{ fontWeight: 'bold' }}>FALTA</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                ${Number(settlement?.diferencia || 0).toLocaleString()}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}