import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderService } from '../services/orderService';

const SettlementModule = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [isSaving, setIsSaving] = useState(false); // Estado para el proceso de guardado
    
    // Estados para los inputs
    const [efectivoFisico, setEfectivoFisico] = useState(0);
    const [valorAlmuerzo, setValorAlmuerzo] = useState(0);
    const [valorGasolina, setValorGasolina] = useState(0);

    useEffect(() => {
        const fetchSettlementData = async () => {
            try {
                const response = await orderService.settleOrder(orderId);
                setData(response);

                // Si la orden ya viene con status CERRADO, cargamos los valores guardados
                if (response.status === 'CERRADO') {
                    setEfectivoFisico(response.efectivo_fisico || 0);
                    setValorAlmuerzo(response.valor_almuerzo || 0);
                    setValorGasolina(response.valor_gasolina || 0);
                }
                
                setLoading(false);
            } catch (error) {
                console.error("Error cargando liquidación:", error);
                setLoading(false);
            }
        };
        fetchSettlementData();
    }, [orderId]);

    // DETERMINAMOS SI ESTÁ CERRADO PARA BLOQUEAR LA INTERFAZ
    const isClosed = data?.status === 'CERRADO';

    if (loading) return <div className="p-5 text-center">Calculando balance de ruta...</div>;

    // --- LÓGICA DE CÁLCULOS ---
    const recaude_abono = parseFloat(data?.total_recaudado || 0);
    const venta_hoy = parseFloat(data?.ventas_totales_hoy || 0);
    const debe_ruta = parseFloat(data?.cartera_anterior || 0);
    
    const ganancia_vendedor = recaude_abono - parseFloat(valorAlmuerzo || 0) - parseFloat(valorGasolina || 0);
    const diferencia = parseFloat(efectivoFisico || 0) - ganancia_vendedor;

    const handleFinalizar = async () => {
        if (isClosed) return; // Seguridad extra

        try {
            setIsSaving(true);
            const settlementData = {
                user_id: data?.user_id,
                total_recaudado: recaude_abono,
                ventas_totales: venta_hoy,
                cartera_anterior: debe_ruta,
                valor_almuerzo: parseFloat(valorAlmuerzo),
                valor_gasolina: parseFloat(valorGasolina),
                ganancia_vendedor: ganancia_vendedor,
                efectivo_fisico: parseFloat(efectivoFisico),
                diferencia: diferencia,
                status: 'CERRADO' // Enviamos el cambio de status
            };

            await orderService.settleOrder(orderId, settlementData);
            alert("Liquidación guardada y ruta cerrada con éxito.");
            navigate('/pedidos');
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
                    {/* SECCIÓN 1: RESUMEN DE VALORES */}
                    <div className="row g-3 mb-4">
                        <div className="col-md-6">
                            <div className="p-3 border rounded bg-light h-100">
                                <small className="text-muted d-block text-uppercase">Recaudo / Abonos:</small>
                                <span className="h5 text-primary">$ {recaude_abono.toLocaleString()}</span>
                                <hr />
                                <small className="text-muted d-block text-uppercase">Venta (Surtido):</small>
                                <span className="h5">$ {venta_hoy.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="p-3 border rounded bg-light h-100">
                                <small className="text-muted d-block text-uppercase">Deuda Actual Ruta:</small>
                                <span className="h5 text-danger">$ {debe_ruta.toLocaleString()}</span>
                                <hr />
                                <small className="text-muted d-block text-uppercase">Ganancia Esperada:</small>
                                <span className="h5 text-success">$ {ganancia_vendedor.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 2: GASTOS (INPUTS BLOQUEABLES) */}
                    <div className="row g-3 mb-4">
                        <div className="col-6">
                            <label className="fw-bold small text-uppercase">Valor Almuerzo</label>
                            <input
                                type="number"
                                className="form-control border-danger"
                                value={valorAlmuerzo}
                                onChange={(e) => setValorAlmuerzo(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                disabled={isClosed} // BLOQUEADO SI YA SE LIQUIDÓ
                            />
                        </div>
                        <div className="col-6">
                            <label className="fw-bold small text-uppercase">Valor Gasolina</label>
                            <input
                                type="number"
                                className="form-control border-danger"
                                value={valorGasolina}
                                onChange={(e) => setValorGasolina(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                disabled={isClosed} // BLOQUEADO SI YA SE LIQUIDÓ
                            />
                        </div>
                    </div>

                    {/* SECCIÓN 3: VERIFICACIÓN FÍSICA */}
                    <div className="mb-4 text-center p-3 border rounded border-primary bg-aliceblue">
                        <label className="fw-bold mb-2">¿CUÁNTO EFECTIVO FÍSICO ENTREGÓ?</label>
                        <input
                            type="number"
                            className="form-control form-control-lg text-center border-primary fw-bold"
                            style={{ fontSize: '2.2rem', height: '80px' }}
                            value={efectivoFisico}
                            onChange={(e) => setEfectivoFisico(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            disabled={isClosed} // BLOQUEADO SI YA SE LIQUIDÓ
                        />
                        <div className={`mt-2 fw-bold ${diferencia < 0 ? 'text-danger' : 'text-success'}`}>
                            {diferencia === 0 ? "Caja Cuadrada" : `Diferencia: $ ${diferencia.toLocaleString()}`}
                        </div>
                    </div>

                    {/* BOTÓN CON LÓGICA DE ESTADO */}
                    <button 
                        className={`btn ${isClosed ? 'btn-secondary' : 'btn-dark'} btn-lg w-100 py-3 shadow-sm fw-bold`}
                        onClick={handleFinalizar}
                        disabled={isClosed || isSaving}
                    >
                        {isClosed 
                            ? "ESTA ORDEN YA FUE LIQUIDADA" 
                            : isSaving ? "GUARDANDO..." : "GUARDAR Y FINALIZAR LIQUIDACIÓN"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettlementModule;