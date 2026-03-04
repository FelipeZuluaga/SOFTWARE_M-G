import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Printer, MapPin, Phone, Search } from "lucide-react";
import { saleService } from "../services/saleService";
import { alertError } from "../services/alertService";

export default function VentasDetalleReadOnly() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [rutaData, setRutaData] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    
    // Estado para información general (vendedor, fecha y GASTOS)
    const [headerInfo, setHeaderInfo] = useState({ 
        seller_name: "", 
        date: "",
        gasto_almuerzo: 0,
        gasto_gasolina: 0
    });

    useEffect(() => {
        const fetchPlanilla = async () => {
            try {
                setLoading(true);
                const data = await saleService.getRutaCompleta(orderId);
                setRutaData(data);

                if (data.length > 0) {
                    // Tomamos los gastos que vienen en el primer registro o en el objeto de la planilla
                    setHeaderInfo({
                        seller_name: data[0].vendedor_nombre || "N/A",
                        date: data[0].fecha_venta || new Date().toLocaleDateString(),
                        // Si la API no trae gastos aún, dejamos los valores por defecto que mencionaste
                        gasto_almuerzo: Number(data[0].gasto_almuerzo || 56000),
                        gasto_gasolina: Number(data[0].gasto_gasolina || 28000)
                    });
                }
            } catch (err) {
                alertError("Error", "No se pudo cargar la planilla de la ruta.");
            } finally {
                setLoading(false);
            }
        };
        fetchPlanilla();
    }, [orderId]);

    const filteredData = rutaData.filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
            item.nombre_cliente?.toLowerCase().includes(term) ||
            item.direccion?.toLowerCase().includes(term)
        );
    });

    if (loading) return <div className="inv-page">Cargando Planilla...</div>;

    // --- CÁLCULOS DE TOTALES ---
    const totalVenta = filteredData.reduce((acc, item) => acc + Number(item.venta || 0), 0);
    const totalAbono = filteredData.reduce((acc, item) => acc + Number(item.abono || 0), 0);
    const totalDebe = filteredData.reduce((acc, item) => acc + Number(item.debe || 0), 0);
    
    const totalSaldoFinal = filteredData.reduce((acc, item) => {
        const debePrevio = Number(item.debe || 0);
        const ventaHoy = Number(item.venta || 0);
        const abonoHoy = Number(item.abono || 0);
        return acc + (debePrevio + ventaHoy - abonoHoy);
    }, 0);

    // Cálculos de liquidación basados en los gastos del headerInfo
    const totalGastos = headerInfo.gasto_almuerzo + headerInfo.gasto_gasolina;

    const efectivoReal = 10000;
    
    // Si la ganancia se calcula descontando también el costo del surtido (totalVenta):
    const gananciaNeta = totalAbono - totalVenta - totalGastos;

    const falta = totalAbono - totalVenta - totalGastos + efectivoReal;

    const fechaHoy = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

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

            {/* TABLA DE LIQUIDACIÓN ACTUALIZADA */}
            <div className="resumen-liquidacion" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
                <table className="excel-table summary-table" style={{ width: '400px' }}>
                    <tbody>
                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                            <th>TOTAL DEBE</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${totalDebe.toLocaleString()}</td>
                        </tr>
                        <tr style={{ backgroundColor: '#fef08a' }}>
                            <th style={{ backgroundColor: '#fef9c3' }}>TOTAL ABONO</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${totalAbono.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <th>TOTAL</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${totalSaldoFinal.toLocaleString()}</td>
                        </tr>
                        
                        {/* GASTOS DINÁMICOS */}
                        <tr>
                            <th>ALMUERZO</th>
                            <td style={{ textAlign: 'right' }}>${headerInfo.gasto_almuerzo.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <th>GASOLINA</th>
                            <td style={{ textAlign: 'right' }}>${headerInfo.gasto_gasolina.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <th>SURTIDO</th>
                            <td style={{ textAlign: 'right' }}>${totalVenta.toLocaleString()}</td>
                        </tr>

                        <tr style={{ backgroundColor: '#fef08a' }}>
                            <th style={{ fontWeight: 'bold' }}>GANANCIA NETA</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${gananciaNeta.toLocaleString()}</td>
                        </tr>

                        {/* EL VALOR REAL QUE DEBE ENTREGAR EL VENDEDOR */}
                        <tr style={{ borderTop: '2px solid #333' }}>
                            <th style={{ fontWeight: 'bold', fontSize: '1.1em' }}>EFECTIVO A ENTREGAR</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1em', color: '#2f855a' }}>
                                ${efectivoReal.toLocaleString()}
                            </td>
                        </tr>

                        <tr style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                            <th style={{ fontWeight: 'bold' }}>FALTA</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${falta.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}