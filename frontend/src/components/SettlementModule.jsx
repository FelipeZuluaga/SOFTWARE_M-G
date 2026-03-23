import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { orderService } from '../services/orderService';

const SettlementModule = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const location = useLocation(); 
    
    // 1. Recuperamos el valor calculado en DevolucionesPage (Total Surtido)
    const totalSurtidoDesdePlanilla = location.state?.totalSurtido;

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [efectivoFisico, setEfectivoFisico] = useState(0);
    const [valorAlmuerzo, setValorAlmuerzo] = useState(0);
    const [valorGasolina, setValorGasolina] = useState(0);

    useEffect(() => {
        const fetchSettlementData = async () => {
            try {
                const response = await orderService.settleOrder(orderId);
                setData(response);

                if (response.status === 'LIQUIDADO') {
                    setEfectivoFisico((response.efectivo_fisico || 0) / 1000);
                    setValorAlmuerzo((response.valor_almuerzo || 0) / 1000);
                    setValorGasolina((response.valor_gasolina || 0) / 1000);
                }

                setLoading(false);
            } catch (error) {
                console.error("Error cargando liquidación:", error);
                setLoading(false);
            }
        };
        fetchSettlementData();
    }, [orderId]);

    const isClosed = data?.status === 'LIQUIDADO';

    if (loading) return <div className="p-5 text-center">Calculando balance de ruta...</div>;

    // --- LÓGICA DE CÁLCULOS ---
    const recaude_abono = parseFloat(data?.total_recaudado || 0);
    const debe_ruta = parseFloat(data?.cartera_anterior || 0);

    // 2. Prioridad: Si venimos de la planilla, usamos ese total. Si no, lo que diga la base de datos.
    const venta_hoy = totalSurtidoDesdePlanilla !== undefined 
        ? parseFloat(totalSurtidoDesdePlanilla) 
        : parseFloat(data?.ventas_totales_hoy || 0);

    const gastoAlmuerzo = parseFloat(valorAlmuerzo || 0);
    const gastoGasolina = parseFloat(valorGasolina || 0);
    const efectivoEntregadoReal = parseFloat(efectivoFisico || 0);

    // Los cálculos ahora usan el valor actualizado de venta_hoy
    const ganancia_vendedor = recaude_abono - venta_hoy - (gastoAlmuerzo + gastoGasolina);
    const falta = ganancia_vendedor + efectivoEntregadoReal;
    const totalSaldoFinal = debe_ruta + venta_hoy - recaude_abono;

    const handleFinalizar = async () => {
        if (isClosed) return;
        try {
            setIsSaving(true);
            const settlementData = {
                user_id: data?.user_id,
                total_recaudado: recaude_abono,
                ventas_totales: venta_hoy, // Se guarda el valor corregido
                cartera_anterior: debe_ruta,
                valor_almuerzo: gastoAlmuerzo * 1000,
                valor_gasolina: gastoGasolina * 1000,
                ganancia_vendedor: ganancia_vendedor,
                efectivo_fisico: efectivoEntregadoReal * 1000,
                diferencia: falta,
                status: 'LIQUIDADO'
            };

            await orderService.settleOrder(orderId, settlementData);
            alert("Liquidación guardada con éxito.");
            navigate(`/ventas-detalle/${orderId}`);
        } catch (error) {
            alert("Error al finalizar: " + error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="container mt-4" style={{ maxWidth: '700px' }}>
            <div className="card shadow border-0">
                <div className={`card-header ${isClosed ? 'bg-secondary' : 'bg-dark'} text-white text-center`}>
                    <h5 className="mb-0">
                        {isClosed ? `RUTA #${orderId} - LIQUIDACIÓN FINALIZADA` : `CIERRE DE CAJA - RUTA #${orderId}`}
                    </h5>
                </div>

                <div className="card-body">
                    {/* RESUMEN SUPERIOR */}
                    <div className="row g-2 mb-4">
                        <div className="col-6">
                            <div className="p-2 border rounded bg-light">
                                <small className="text-muted d-block small">TOTAL CARTERA FECHA: </small>
                                <span className="fw-bold">$ {debe_ruta.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="p-2 border rounded" style={{ backgroundColor: '#fef9c3' }}>
                                <small className="text-muted d-block small">COBRO: </small>
                                <span className="fw-bold text-primary">$ {recaude_abono.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="col-12">
                            <div className="p-2 border rounded bg-light text-center">
                                <small className="text-muted d-block small">TOTAL SALDO FINAL</small>
                                <span className="h5 fw-bold">$ {totalSaldoFinal.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* GASTOS */}
                    <div className="row g-3 mb-4">
                        <div className="col-6">
                            <label className="fw-bold small">ALMUERZO (Miles)</label>
                            <input
                                type="number"
                                className="form-control border-danger"
                                value={valorAlmuerzo}
                                onChange={(e) => setValorAlmuerzo(e.target.value)}
                                disabled={isClosed}
                            />
                        </div>
                        <div className="col-6">
                            <label className="fw-bold small">GASOLINA (Miles)</label>
                            <input
                                type="number"
                                className="form-control border-danger"
                                value={valorGasolina}
                                onChange={(e) => setValorGasolina(e.target.value)}
                                disabled={isClosed}
                            />
                        </div>
                    </div>

                    {/* SURTIDO Y GANANCIA */}
                    <div className="row g-2 mb-4">
                        <div className="col-6">
                            <div className="p-3 border rounded bg-light">
                                <small className="text-muted d-block">SURTIDO</small>
                                <span className="fw-bold text-danger">
                                    $ {venta_hoy.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="p-3 border rounded" style={{ backgroundColor: '#fef9c3' }}>
                                <small className="text-muted d-block">GANANCIA NETA</small>
                                <span className="fw-bold">$ {ganancia_vendedor.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* EFECTIVO FÍSICO */}
                    <div className="mb-4 text-center p-3 border rounded border-primary bg-aliceblue">
                        <label className="fw-bold mb-2">¿CUÁNTO EFECTIVO FÍSICO ENTREGÓ? (Miles)</label>
                        <div className="d-flex align-items-center justify-content-center">
                            <span className="h2 me-2">$</span>
                            <input
                                type="number"
                                className="form-control form-control-lg text-center border-primary fw-bold"
                                style={{ fontSize: '2.5rem', height: '80px', width: '180px' }}
                                value={efectivoFisico}
                                onChange={(e) => setEfectivoFisico(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                disabled={isClosed}
                            />
                            <span className="h2 ms-2">.000</span>
                        </div>
                    </div>

                    {/* RESULTADO FINAL */}
                    <div className={`p-3 border rounded mb-4 text-center ${falta < 0 ? 'bg-light-danger' : 'bg-light-success'}`}
                        style={{ backgroundColor: falta < 0 ? '#fee2e2' : '#dcfce7' }}>
                        <small className={`fw-bold d-block ${falta < 0 ? 'text-danger' : 'text-success'}`}>
                            {falta < 0 ? 'FALTA' : 'SOBRA'}
                        </small>
                        <span className={`h3 fw-bold ${falta < 0 ? 'text-danger' : 'text-success'}`}>
                            $ {falta.toLocaleString()}
                        </span>
                    </div>

                    <button
                        className={`btn ${isClosed ? 'btn-secondary' : 'btn-dark'} btn-lg w-100 py-3 fw-bold`}
                        onClick={handleFinalizar}
                        disabled={isClosed || isSaving}
                    >
                        {isClosed ? "ORDEN LIQUIDADA" : isSaving ? "GUARDANDO..." : "GUARDAR Y FINALIZAR"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettlementModule;