import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom"; // <--- IMPORTACIÓN FALTANTE
import { orderService } from "../services/orderService";
import { saleService } from "../services/saleService";
import { alertSuccess, alertError } from "../services/alertService";
import { ChevronLeft, Save } from "lucide-react";

export default function DevolucionesPage() {
    const location = useLocation();
    const navigate = useNavigate();

    // Extraemos los datos enviados desde VentasPage vía navigate
    const { orderId, sobrantes } = location.state || {};

    // ESTADOS NECESARIOS
    const [itemsDevolver, setItemsDevolver] = useState([]);
    const [loading, setLoading] = useState(true); // <--- SOLUCIONA EL ERROR DE LA IMAGEN
    const [itemsCargados, setItemsCargados] = useState([]); // <--- PARA LA CARGA MANUAL
    const [esHistorial, setEsHistorial] = useState(false);

    useEffect(() => {
        if (!orderId) {
            alertError("Error", "No hay una orden seleccionada.");
            navigate("/ventas");
            return;
        }

        // PRIORIDAD: Siempre intentar cargar desde la DB primero para ver si hay historial
        const inicializarPagina = async () => {
            setLoading(true);

            // 1. Intentamos traer historial de la DB
            const historial = await orderService.getReturnHistory(orderId);

            if (historial && historial.length > 0) {
                // SI HAY HISTORIAL: Lo mostramos y bloqueamos edición
                setItemsDevolver(historial.map(h => ({
                    product_id: h.product_id,
                    product_name: h.product_name,
                    stock_en_sistema: h.cantidad_devuelta,
                    cantidad_a_devolver: h.cantidad_devuelta,
                    ya_procesado: true
                })));
                setEsHistorial(true);
                setLoading(false);
            }
            // 2. SI NO HAY HISTORIAL pero tenemos datos frescos de VentasPage
            else if (sobrantes && sobrantes.length > 0) {
                setItemsDevolver(sobrantes.map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    cantidad_a_devolver: item.stock_en_camion,
                    stock_en_sistema: item.stock_en_camion
                })));
                setEsHistorial(false);
                setLoading(false);
            }
            // 3. SI NO HAY NADA: Cargamos el detalle original (por si acaso)
            else {
                await cargarDatosLiquidacion();
            }
        };

        inicializarPagina();
    }, [orderId, sobrantes]);

    const cargarDatosLiquidacion = async () => {
        try {
            setLoading(true);

            // 1. Verificamos si YA se hizo la devolución antes (historial)
            const historial = await orderService.getReturnHistory(orderId);

            if (historial && historial.length > 0) {
                // ... (tu lógica de historial que ya funciona)
            } else {
                // 2. SI ES NUEVA: Llamamos a la nueva función que calcula la resta
                // Debes crear este método en orderService.js que llame a /orders/truck-inventory/:id
                const stockCalculado = await orderService.getTruckInventory(orderId);

                setItemsDevolver(stockCalculado.map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    stock_en_sistema: item.cantidad_sobrante, // La resta de despacho - ventas
                    cantidad_a_devolver: item.cantidad_sobrante
                })));
            }
        } catch (err) {
            alertError("Error", "No se pudo calcular el sobrante del camión.");
        } finally {
            setLoading(false);
        }
    };
    const handleCantidadChange = (id, valor) => {
        const nuevaLista = itemsDevolver.map(item => {
            if (item.product_id === id) {
                return { ...item, cantidad_a_devolver: parseInt(valor) || 0 };
            }
            return item;
        });
        setItemsDevolver(nuevaLista);
    };

    const confirmarDevolucion = async () => {
        try {
            const payload = {
                order_id: orderId,
                items: itemsDevolver.filter(i => i.cantidad_a_devolver > 0)
            };

            // Asegúrate de que saleService o orderService tengan processReturn definido
            await orderService.processReturn(payload);
            alertSuccess("Éxito", "El stock ha sido reintegrado al almacén.");
            navigate("/ventas");
        } catch (err) {
            alertError("Error", "No se pudo procesar la devolución.");
        }
    };

    if (loading) return <div className="loading-screen">Cargando sobrantes...</div>;

    return (
        <div className="devoluciones-container">
            <header className="header-actions">
                <button onClick={() => navigate("/liquidaciones")} className="btn-back-list">
                    <ChevronLeft size={20} /> Volver
                </button>
                <h2 className="ruta-title">Liquidación de Inventario - Despacho #{orderId}</h2>
                <button
                    onClick={confirmarDevolucion}
                    className="btn-confirm-all"
                    disabled={esHistorial} // Se deshabilita si ya estamos viendo un historial
                >
                    {esHistorial ? "Ya Procesado" : "Procesar Reingreso"}
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
                                    />
                                </td>
                                <td>
                                    {item.cantidad_a_devolver === item.stock_en_sistema ?
                                        <span className="badge-ok">Cuadrado</span> :
                                        <span className="badge-warning">Diferencia</span>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}