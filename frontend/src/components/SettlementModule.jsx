import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderService } from '../services/orderService';

const SettlementModule = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Estados para los inputs (el usuario digita ej: 56 para representar 56.000)
    const [efectivoFisico, setEfectivoFisico] = useState(0);
    const [valorAlmuerzo, setValorAlmuerzo] = useState(0);
    const [valorGasolina, setValorGasolina] = useState(0);

    useEffect(() => {
        const fetchSettlementData = async () => {
            try {
                const response = await orderService.settleOrder(orderId);
                setData(response);

                if (response.status === 'CERRADO') {
                    // Si ya está cerrado, dividimos por 1000 para mostrar el número corto en el input
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

    const isClosed = data?.status === 'CERRADO';

    if (loading) return <div className="p-5 text-center">Calculando balance de ruta...</div>;

    // --- LÓGICA DE CÁLCULOS (REPLICANDO IMAGEN 1) ---
    const recaude_abono = parseFloat(data?.total_recaudado || 0); // Ej: 0
    const venta_hoy = parseFloat(data?.ventas_totales_hoy || 0);  // Ej: 0 (Surtido)
    const debe_ruta = parseFloat(data?.cartera_anterior || 0);    // Ej: 190000

    // Convertimos inputs a miles
    const gastoAlmuerzo = parseFloat(valorAlmuerzo || 0);
    const gastoGasolina = parseFloat(valorGasolina || 0);
    const efectivoEntregadoReal = parseFloat(efectivoFisico || 0);

    // GANANCIA NETA = Abonos - Surtido - Gastos
    const ganancia_vendedor = recaude_abono - venta_hoy - (gastoAlmuerzo + gastoGasolina);

    // FALTA = Ganancia Neta + Efectivo Entregado
    const falta = ganancia_vendedor + efectivoEntregadoReal;

    const totalSaldoFinal = debe_ruta + venta_hoy - recaude_abono;

    const handleFinalizar = async () => {
        if (isClosed) return;
        try {
            setIsSaving(true);
            const settlementData = {
                user_id: data?.user_id,
                total_recaudado: recaude_abono,
                ventas_totales: venta_hoy,
                cartera_anterior: debe_ruta,
                valor_almuerzo: gastoAlmuerzo * 1000, // Multiplicamos para guardar el valor real
                valor_gasolina: gastoGasolina * 1000,
                ganancia_vendedor: ganancia_vendedor,
                efectivo_fisico: efectivoEntregadoReal * 1000,
                diferencia: falta,
                status: 'CERRADO'
            };

            await orderService.settleOrder(orderId, settlementData);
            alert("Liquidación guardada con éxito.");

            // REDIRECCIÓN A LA TABLA DE LA IMAGEN 2
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
                                <small className="text-muted d-block small">TOTAL DEBE</small>
                                <span className="fw-bold">$ {debe_ruta.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="p-2 border rounded" style={{ backgroundColor: '#fef9c3' }}>
                                <small className="text-muted d-block small">TOTAL ABONO</small>
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

                    {/* INPUTS DE GASTOS */}
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

                    {/* SURTIDO Y GANANCIA NETA */}
                    <div className="row g-2 mb-4">
                        <div className="col-6">
                            <div className="p-3 border rounded bg-light">
                                <small className="text-muted d-block">SURTIDO</small>
                                <span className="fw-bold text-danger">$ {venta_hoy.toLocaleString()}</span>
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

                    {/* RESULTADO FINAL: FALTA */}
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