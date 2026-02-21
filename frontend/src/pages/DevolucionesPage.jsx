import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { orderService } from "../services/orderService";
import { alertSuccess, alertError } from "../services/alertService";
import { ChevronLeft } from "lucide-react";

export default function DevolucionesPage() {
    const location = useLocation();
    const navigate = useNavigate();

    const { orderId, sobrantes } = location.state || {};

    const [itemsDevolver, setItemsDevolver] = useState([]);
    const [loading, setLoading] = useState(true);
    const [esHistorial, setEsHistorial] = useState(false);

    useEffect(() => {
        if (!orderId) {
            alertError("Error", "No hay una orden seleccionada.");
            navigate("/liquidaciones");
            return;
        }

        const inicializarPagina = async () => {
            setLoading(true);
            try {
                // 1. Intentamos traer historial de la DB
                const historial = await orderService.getReturnHistory(orderId);
                
                if (historial && historial.length > 0) {
                    setItemsDevolver(historial.map(h => ({
                        product_id: h.product_id,
                        product_name: h.product_name,
                        stock_en_sistema: h.cantidad_devuelta,
                        cantidad_a_devolver: h.cantidad_devuelta,
                    })));
                    setEsHistorial(true);
                } 
                // 2. Si no hay historial, cargamos lo que viene de Ventas o calculamos del camión
                else {
                    const stockCalculado = sobrantes || await orderService.getTruckInventory(orderId);
                    
                    setItemsDevolver(stockCalculado.map(item => ({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        stock_en_sistema: item.cantidad_sobrante || item.stock_en_camion,
                        cantidad_a_devolver: item.cantidad_sobrante || item.stock_en_camion
                    })));
                    setEsHistorial(false);
                }
            } catch (err) {
                alertError("Error", "No se pudieron cargar los datos de inventario.");
            } finally {
                setLoading(false);
            }
        };

        inicializarPagina();
    }, [orderId, sobrantes, navigate]);

    const handleCantidadChange = (id, valor) => {
        const nuevaLista = itemsDevolver.map(item => {
            if (item.product_id === id) {
                return { ...item, cantidad_a_devolver: parseInt(valor) || 0 };
            }
            return item;
        });
        setItemsDevolver(nuevaLista);
    };

    // FUNCIÓN UNIFICADA: Procesa devolución O salta a liquidación
    const handleAccionPrincipal = async () => {
        if (esHistorial) {
            // Si ya se hizo, solo navegamos a la liquidación financiera
            navigate(`/liquidacion-ruta/${orderId}`);
            return;
        }

        try {
            const payload = {
                order_id: orderId,
                items: itemsDevolver.filter(i => i.cantidad_a_devolver > 0)
            };

            await orderService.processReturn(payload);
            alertSuccess("Éxito", "El stock ha sido reintegrado al almacén.");
            
            // Una vez procesada la devolución física, vamos a la liquidación de dinero
            navigate(`/liquidacion-ruta/${orderId}`);
        } catch (err) {
            alertError("Error", "No se pudo procesar la devolución.");
        }
    };

    if (loading) return <div className="loading-screen">Cargando inventario...</div>;

    return (
        <div className="devoluciones-container">
            <header className="header-actions">
                <button onClick={() => navigate("/liquidaciones")} className="btn-back-list">
                    <ChevronLeft size={20} /> Volver
                </button>
                <h2 className="ruta-title">Liquidación de Inventario - Despacho #{orderId}</h2>
                
                <button
                    onClick={handleAccionPrincipal}
                    className={`btn-confirm-all ${esHistorial ? 'btn-history' : ''}`}
                >
                    {esHistorial ? "Siguiente: Liquidar Dinero" : "Confirmar Devolución"}
                </button>
            </header>

            <div className="planilla-wrapper">
                <table className="excel-table">
                    <thead>
                        <tr>
                            <th>PRODUCTO</th>
                            <th>STOCK EN CAMIÓN</th>
                            <th>CANT. A DEVOLVER</th>
                            <th>ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsDevolver.map((item) => (
                            <tr key={item.product_id}>
                                <td>{item.product_name}</td>
                                <td>{item.stock_en_sistema}</td>
                                <td>
                                    <input
                                        type="number"
                                        className="input-modern"
                                        value={item.cantidad_a_devolver}
                                        onChange={(e) => handleCantidadChange(item.product_id, e.target.value)}
                                        disabled={esHistorial}
                                        style={esHistorial ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed', border: 'none' } : {}}
                                    />
                                </td>
                                <td>
                                    {item.cantidad_a_devolver === item.stock_en_sistema ?
                                        <span className="badge-ok">CORRECTO</span> :
                                        <span className="badge-warning">DESCUADRE</span>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {esHistorial && (
                <div className="alert-info-history">
                    * Esta devolución ya fue procesada. Haga clic en el botón superior para realizar el cierre económico.
                </div>
            )}
        </div>
    );
}