import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Printer, MapPin, Phone, FileText } from "lucide-react";
import { saleService } from "../services/saleService";
import { alertError } from "../services/alertService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function VentasDetalleReadOnly() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [rutaData, setRutaData] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [settlement, setSettlement] = useState(null);
    const [headerInfo, setHeaderInfo] = useState({ seller_name: "", date: "" });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
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

    // --- FUNCIÓN PARA GENERAR EL TICKET (FORMATO 80MM) ---
    const generarFacturaTicket = (item) => {
        const doc = new jsPDF({ unit: "mm", format: [80, 200] });
        const pageWidth = 80;

        // Encabezado
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("MAYORISTA GALLEGO", pageWidth / 2, 10, { align: "center" });
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("------------------------------------------", pageWidth / 2, 14, { align: "center" });
        doc.text(`FECHA: ${headerInfo.date}`, 5, 18);
        doc.text(`VENDEDOR: ${headerInfo.seller_name.toUpperCase()}`, 5, 22);
        doc.text(`CLIENTE: ${item.nombre_cliente.toUpperCase()}`, 5, 26);
        doc.text(`DIR: ${item.direccion || "N/A"}`, 5, 30);
        doc.text("------------------------------------------", pageWidth / 2, 34, { align: "center" });

        // Tabla de concepto
        autoTable(doc, {
            startY: 36,
            theme: 'plain',
            styles: { fontSize: 8 },
            head: [['ARTICULO', 'CANT', 'TOTAL']],
            body: [['Venta del día', '1', `$${Number(item.venta || 0).toLocaleString()}`]],
            columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 20, halign: 'right' } }
        });

        let finalY = doc.lastAutoTable.finalY + 5;
        doc.text("------------------------------------------", pageWidth / 2, finalY, { align: "center" });
        finalY += 5;
        
        const right = 75;
        doc.text("DEUDA ANTERIOR:", 5, finalY);
        doc.text(`$${Number(item.debe || 0).toLocaleString()}`, right, finalY, { align: "right" });
        finalY += 4;
        doc.text("VENTA HOY (+):", 5, finalY);
        doc.text(`$${Number(item.venta || 0).toLocaleString()}`, right, finalY, { align: "right" });
        finalY += 4;
        doc.text("PAGO RECIBIDO (-):", 5, finalY);
        doc.text(`$${Number(item.abono || 0).toLocaleString()}`, right, finalY, { align: "right" });
        
        finalY += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("SALDO TOTAL:", 5, finalY);
        const saldoFinal = Number(item.debe || 0) + Number(item.venta || 0) - Number(item.abono || 0);
        doc.text(`$${saldoFinal.toLocaleString()}`, right, finalY, { align: "right" });

        doc.save(`Factura_${item.nombre_cliente}.pdf`);
    };

    const filteredData = rutaData.filter((item) => {
        const term = searchTerm.toLowerCase();
        return item.nombre_cliente?.toLowerCase().includes(term) || item.direccion?.toLowerCase().includes(term);
    });

    if (loading) return <div className="inv-page">Cargando Planilla...</div>;

    const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const totalSaldoFinal = filteredData.reduce((acc, item) => acc + (Number(item.debe || 0) + Number(item.venta || 0) - Number(item.abono || 0)), 0);

    return (
        <div className="inv-page full-layout">
            <div className="header-actions">
                <div className="header-left">
                    <button onClick={() => navigate(-1)} className="btn-back-list"><ChevronLeft size={20} /> <span>Volver</span></button>
                    <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-search-planilla" />
                </div>
                <div className="header-center">
                    <h3 className="ruta-title">Hoja de Ruta: {headerInfo.seller_name}</h3>
                    <p className="ruta-subtitle">FECHA: {fechaHoy.toUpperCase()}</p>
                </div>
                <div className="header-right">
                    <button onClick={() => window.print()} className="btn-confirm-all" style={{ background: '#64748b' }}><Printer size={20} /> <span>Imprimir</span></button>
                </div>
            </div>

            <div className="planilla-wrapper">
                <table className="excel-table">
                    <thead>
                        <tr><th>POS</th><th>DIRECCIÓN</th><th>CLIENTE</th><th>ESTADO</th><th>VENTA</th><th>DEBE</th><th>ABONO</th><th>TOTAL</th><th>FACTURA</th><th>TELÉFONO</th></tr>
                    </thead>
                    <tbody>
                        {filteredData.map((item, idx) => {
                            const saldoFinal = Number(item.debe || 0) + Number(item.venta || 0) - Number(item.abono || 0);
                            return (
                                <tr key={idx} className={`fila-${item.estado?.toLowerCase()}`}>
                                    <td>{item.posicion || idx + 1}</td>
                                    <td><MapPin size={12} /> {item.direccion}</td>
                                    <td>{item.nombre_cliente}</td>
                                    <td><span className={`status-badge ${item.estado?.toLowerCase()}`}>{item.estado}</span></td>
                                    <td style={{ textAlign: 'right' }}>${Number(item.venta || 0).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right' }}>${Number(item.debe || 0).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: '#3182ce' }}>${Number(item.abono || 0).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${saldoFinal.toLocaleString()}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button onClick={() => generarFacturaTicket(item)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                                            <FileText size={18} color="#2563eb" />
                                        </button>
                                    </td>
                                    <td><Phone size={12} /> {item.telefono}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* TABLA DE LIQUIDACIÓN */}
            <div className="resumen-liquidacion" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
                <table className="excel-table summary-table" style={{ width: '400px' }}>
                    <tbody>
                        <tr><th>TOTAL CARTERA FECHA</th><td style={{ textAlign: 'right' }}>${Number(settlement?.cartera_anterior || 0).toLocaleString()}</td></tr>
                        <tr><th>TOTAL CARTERA SIGUIENTE SEMANA</th><td style={{ textAlign: 'right' }}>${totalSaldoFinal.toLocaleString()}</td></tr>
                        <tr><th>COBRO</th><td style={{ textAlign: 'right' }}>${Number(settlement?.total_recaudado || 0).toLocaleString()}</td></tr>
                        <tr><th>ALMUERZO</th><td style={{ textAlign: 'right' }}>${Number(settlement?.valor_almuerzo || 0).toLocaleString()}</td></tr>
                        <tr><th>GASOLINA</th><td style={{ textAlign: 'right' }}>${Number(settlement?.valor_gasolina || 0).toLocaleString()}</td></tr>
                        <tr><th>SURTIDO</th><td style={{ textAlign: 'right' }}>${Number(settlement?.ventas_totales || 0).toLocaleString()}</td></tr>
                        <tr style={{ backgroundColor: '#fef08a' }}><th>GANANCIA NETA</th><td style={{ textAlign: 'right' }}>${Number(settlement?.ganancia_vendedor || 0).toLocaleString()}</td></tr>
                        <tr style={{ borderTop: '2px solid #333' }}><th>EFECTIVO A ENTREGAR</th><td style={{ textAlign: 'right', color: '#2f855a' }}>${Number(settlement?.efectivo_fisico || 0).toLocaleString()}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}