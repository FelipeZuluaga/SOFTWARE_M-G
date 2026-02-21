import React, { useState, useEffect } from 'react';
import { useParams} from 'react-router-dom';
import { orderService } from '../services/orderService';

const SettlementModule = () => {
    const { orderId } = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [efectivoFisico, setEfectivoFisico] = useState(0);

    useEffect(() => {
        const fetchSettlementData = async () => {
            try {
                // Esta función debe traer la suma de todos los 'amount_paid' de la orden
                const response = await orderService.settleOrder(orderId);
                setData(response);
                setLoading(false);
            } catch (error) {
                console.error("Error cargando liquidación:", error);
                setLoading(false);
            }
        };
        fetchSettlementData();
    }, [orderId]);

    if (loading) return <div className="p-5 text-center">Calculando balance de ruta...</div>;

    

    const venta_dia = parseFloat(data?.ventas_totales_hoy || 0)
    const debo_ruta = parseFloat(data?.cartera_anterior || 0)

    const total_deuda = parseFloat(data?.cartera_anterior || 0) + parseFloat(data?.ventas_totales_hoy || 0)

    return (
        <div className="container mt-4" style={{ maxWidth: '700px' }}>
            <div className="card shadow border-0">
                <div className="card-header bg-dark text-white text-center">
                    <h5 className="mb-0">CIERRE DE CAJA - RUTA #{orderId}</h5>
                </div>
                
                <div className="card-body">
                    {/* RESUMEN DE CARTERA Y VENTAS */}
                    <div className="row mb-4">
                        <div className="col-6">
                            <div className="p-3 border rounded bg-light">
                                <small className="text-muted d-block text-uppercase">VENTA DE HOY: </small>
                                <span className="h5">$ {venta_dia.toLocaleString()}</span>
                            </div>

                            <div className="p-3 border rounded bg-light">
                                <small className="text-muted d-block text-uppercase">DEBE RUTA ACTUALMENTE: </small>
                                <span className="h5">$ {debo_ruta.toLocaleString()}</span>
                            </div>

                            <div className="p-3 border rounded bg-light">
                                <small className="text-muted d-block text-uppercase">TOTAL RUTA: </small>
                                <span className="h5">$ {total_deuda.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* VALIDACIÓN DE EFECTIVO */}
                    

                    <div className="mb-4 text-center">
                        <label className="fw-bold mb-2">¿CUÁNTO EFECTIVO FÍSICO ENTREGÓ?</label>
                        <input
                            type="number"
                            className="form-control form-control-lg text-center border-primary fw-bold"
                            style={{ fontSize: '2rem', height: '70px' }}
                            value={efectivoFisico}
                            onChange={(e) => setEfectivoFisico(e.target.value)}
                            placeholder="$ 0"
                        />
                    </div>

                    {/* RESULTADO DEL CUADRE 
                    {efectivoFisico > 0 && (
                        <div className={`p-4 rounded text-center mb-4 ${diferencia === 0 ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                            {diferencia === 0 ? (
                                <h4 className="mb-0">✅ CAJA CUADRADA</h4>
                            ) : (
                                <>
                                    <h5 className="mb-1">⚠️ FALTANTE DETECTADO</h5>
                                    <h3 className="mb-0">${diferencia.toLocaleString()}</h3>
                                </>
                            )}
                        </div>
                    )}

                    <button 
                        className="btn btn-dark btn-lg w-100 py-3 shadow"
                        onClick={async () => {
                            await orderService.markAsLiquidated(orderId);
                            alert("Ruta cerrada correctamente");
                            navigate('/pedidos');
                        }}
                    >
                        FINALIZAR LIQUIDACIÓN
                    </button>*/}
                </div>
            </div>
        </div>
    );
};

export default SettlementModule;