import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { orderService } from "../services/orderService";

export default function LiquidacionesListPage() {
    const [ordenes, setOrdenes] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        cargarOrdenes();
    }, []);

    const cargarOrdenes = async () => {
        // Puedes usar el servicio de historial que ya tienes
        const data = await orderService.getOrdersHistory(JSON.parse(localStorage.getItem("user")));
        setOrdenes(data);
    };

    return (
        <div className="p-6">
            <h2>Gestión de Liquidaciones</h2>
            <table className="excel-table">
                <thead>
                    <tr>
                        <th>ID Orden</th>
                        <th>Vendedor</th>
                        <th>Estado</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {ordenes
                        .filter(orden => orden.status !== 'LIQUIDADO') // Ocultamos las que ya se cerraron
                        .map((orden) => (
                            <tr key={orden.id}>
                                <td>#{orden.id}</td>
                                <td>{orden.receptor_name}</td>
                                <td>
                                    <span className="badge-warning">{orden.status}</span>
                                </td>
                                <td>
                                    <button
                                        onClick={() => navigate("/devoluciones", { state: { orderId: orden.id } })}
                                        className="btn-action"
                                    >
                                        Procesar Devolución
                                    </button>
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}