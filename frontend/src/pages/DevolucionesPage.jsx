import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { orderService } from "../services/orderService";
import { alertError } from "../services/alertService";
import "../styles/devoluciones.css";

export default function DevolucionesPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { orderId, sobrantes } = location.state || {};

    const [itemsDevolver, setItemsDevolver] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [procesando, setProcesando] = useState(false);
    
    // NUEVO: Estado para saber si la liquidación ya está cerrada
    const [esLiquidado, setEsLiquidado] = useState(false);
    
    const barcodeBuffer = useRef("");

    useEffect(() => {
        if (!orderId) { navigate("/liquidaciones"); return; }
        const inicializarPagina = async () => {
            setLoading(true);
            try {
                // Consultamos el estado actual de la orden al servicio
                const infoOrden = await orderService.settleOrder(orderId);
                setEsLiquidado(infoOrden.status === 'LIQUIDADO');

                const data = sobrantes || await orderService.getTruckInventory(orderId);
                setItemsDevolver(data.map(item => ({
                    codg_barras: String(item.codg_barras || '').trim(),
                    product_id: item.product_id || 'N/A',
                    product_name: item.product_name || 'Producto',
                    despachado: Number(item.despachado) || 0,
                    precio_base: Number(item.precio_base) || 0,
                    cantidad_a_devolver: Number(item.cantidad_a_devolver) || 0
                })));
            } catch (err) { alertError("Error", "No se pudo cargar la planilla."); }
            finally { setLoading(false); }
        };
        inicializarPagina();
    }, [orderId, sobrantes, navigate]);

    // LÓGICA DE ESCANEO (Bloqueada si esLiquidado es true)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (esLiquidado) return; // NO permitir escaneo si ya se liquidó
            
            if (document.activeElement.tagName === "INPUT" && document.activeElement.type === "text") return;

            if (e.key === "Enter") {
                const code = barcodeBuffer.current;
                if (code) {
                    setItemsDevolver(prev => prev.map(item => 
                        item.codg_barras === code 
                        ? { ...item, cantidad_a_devolver: item.cantidad_a_devolver + 1 }
                        : item
                    ));
                }
                barcodeBuffer.current = "";
            } else {
                if (e.key.length === 1) {
                    barcodeBuffer.current += e.key;
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [esLiquidado]); // Escuchar cambios en esLiquidado

    const handleCantidadChange = (id, valor) => {
        if (esLiquidado) return; // Bloqueo de seguridad adicional
        setItemsDevolver(prev => prev.map(item =>
            item.product_id === id ? { ...item, cantidad_a_devolver: Number(valor) || 0 } : item
        ));
    };

    const handleLiquidacion = async () => {
        if (esLiquidado) return;
        setProcesando(true);
        try {
            navigate(`/liquidacion-ruta/${orderId}`, { state: { totalSurtido: totalSuma } });
        } catch (error) {
            alertError("Error", "No se pudo procesar la liquidación");
        } finally {
            setProcesando(false);
        }
    };

    const itemsFiltrados = itemsDevolver.filter(item => 
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.codg_barras.includes(searchTerm)
    );

    const totalSuma = itemsDevolver.reduce((acc, item) => {
        const venta = item.despachado - item.cantidad_a_devolver;
        return acc + (venta * item.precio_base);
    }, 0);

    if (loading) return <div className="loading-state">Cargando...</div>;

    return (
        <div className="devoluciones-container">
            <div className="header-actions">
                <button className="btn-back" onClick={() => navigate(-1)}>← Volver</button>
                <h2>Planilla de Devoluciones {esLiquidado && "(CERRADA)"}</h2>
            </div>

            <div className="search-container" style={{ marginBottom: '20px' }}>
                <input 
                    type="text" 
                    placeholder={esLiquidado ? "Lectura bloqueada: Orden Liquidada" : "Buscar por nombre o código de barras..."}
                    className="input-search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={esLiquidado} // Bloqueo de buscador
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: esLiquidado ? '#f0f0f0' : '#fff' }}
                />
            </div>

            <div className="planilla-wrapper">
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th>CODIGO</th>
                            <th>PRODUCTOS</th>
                            <th>LLEVA</th>
                            <th>TRAE</th>
                            <th>VENTA</th>
                            <th>PRECIO</th>
                            <th>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsFiltrados.map((item) => {
                            const venta = item.despachado - item.cantidad_a_devolver;
                            const total = venta * item.precio_base;
                            return (
                                <tr key={item.product_id}>
                                    <td className="text-center">{item.codg_barras}</td>
                                    <td>{item.product_name}</td>
                                    <td className="text-center">{item.despachado}</td>
                                    <td>
                                        <input 
                                            type="number" 
                                            className="input-minimal" 
                                            value={item.cantidad_a_devolver}
                                            onChange={(e) => handleCantidadChange(item.product_id, e.target.value)} 
                                            disabled={esLiquidado} // Bloqueo de inputs de tabla
                                            style={{ backgroundColor: esLiquidado ? 'transparent' : '#fff', border: esLiquidado ? 'none' : '1px solid #ccc' }}
                                        />
                                    </td>
                                    <td className="text-center">{venta}</td>
                                    <td className="text-right">{item.precio_base.toLocaleString()}</td>
                                    <td className="text-right">{total.toLocaleString()}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan="6" className="text-right"><strong>TOTAL SURTIDO</strong></td>
                            <td className="text-right"><strong>$ {totalSuma.toLocaleString()}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <div className="footer-actions">
                    <button 
                        className="btn-liquidar" 
                        onClick={handleLiquidacion} 
                        disabled={procesando || esLiquidado} // Bloqueo de botón final
                        style={{ backgroundColor: esLiquidado ? '#6c757d' : '' }}
                    >
                        {esLiquidado ? "ORDEN YA LIQUIDADA" : procesando ? "Procesando..." : "Finalizar Liquidación"}
                    </button>
                </div>
            </div>
        </div>
    );
}