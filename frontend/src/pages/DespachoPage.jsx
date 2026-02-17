import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryService } from "../services/inventoryService";
import { orderService } from "../services/orderService";
import { alertSuccess, alertError, alertConfirm } from "../services/alertService";
import { User, Truck, ChevronLeft, Search } from "lucide-react";

export default function DespachoPage() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user"));

    // Datos del inventario
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);

    // Formulario de despacho simplificado
    const [customerTypeId, setCustomerTypeId] = useState("4"); // 4: Despacho Mayorista
    const [sellerName, setSellerName] = useState("");
    const [quantities, setQuantities] = useState({});

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const data = await inventoryService.getProducts();
            setProducts(data || []);
        } catch (err) {
            alertError("Error", "No se pudo cargar el inventario.");
        }
    };

    const getUnitPrice = (product) => {
        if (!product || !product.prices) return 0;

        // Buscamos el precio usando el ID que seleccionaste en el select
        const priceObj = product.prices.find(p =>
            Number(p.customer_type_id) === Number(customerTypeId)
        );

        // Retorna el precio encontrado o 0 si no existe (evita el NaN)
        return priceObj ? Math.trunc(priceObj.unit_price) : 0;
    };

    const handleQtyChange = (id, val, stock) => {
        const value = val === "" ? "" : Math.max(0, Math.min(Number(val), stock));
        setQuantities(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const totalDespacho = products.reduce((acc, p) => {
        const qty = Number(quantities[p.id]) || 0;
        return acc + (qty * getUnitPrice(p));
    }, 0);

    const handleConfirmar = async () => {
        // Validación: Ahora solo pedimos el nombre del receptor (vendedor o cliente)
        if (!sellerName.trim()) {
            return alertError("Campo vacío", "Ingresa el nombre de la persona o local que recibe.");
        }

        const items = Object.keys(quantities)
            .filter(id => Number(quantities[id]) > 0)
            .map(id => ({
                product_id: Number(id),
                quantity: Number(quantities[id])
            }));

        if (items.length === 0) return alertError("Pedido vacío", "No has seleccionado productos.");

        const confirm = await alertConfirm(
            "¿Confirmar Despacho?",
            `Se restará el stock y se registrará un total de $${totalDespacho.toLocaleString()} a nombre de ${sellerName}.`
        );

        if (confirm.isConfirmed) {
            try {
                setLoading(true);
                // Enviamos los datos según la nueva estructura del controlador
                await orderService.createOrder({
                    user_id: user?.id,
                    receptor_name: sellerName, // En el backend esto se guarda en seller_name
                    customer_type_id: Number(customerTypeId),
                    items
                });

                await alertSuccess("Despacho Exitoso", "El stock ha sido actualizado correctamente.");
                navigate("/pedidos"); // Cambia esto por tu ruta de historial si es diferente
            } catch (err) {
                alertError("Error de Proceso", err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="inv-page full-layout">
            <div className="module-intro">
                <button className="btn-primary-main" onClick={() => navigate(-1)} style={{ marginBottom: '15px' }}>
                    <ChevronLeft size={16} /> Volver al Panel
                </button>
                <h1>Salida de Mercancía (Despacho)</h1>
                <p>Configura el tipo de lista y el receptor para actualizar el inventario.</p>
            </div>

            <div className="inv-card full-width-card">
                <div className="form-grid">
                    <div className="input-group">
                        <label><Truck size={14} /> Tipo de Lista de Precios</label>
                        <select value={customerTypeId} onChange={(e) => setCustomerTypeId(e.target.value)}>
                            <option value="1">CLIENTE</option>        {/* ID 1 en BD es CLIENTE */}
                            <option value="2">SOCIO</option>          {/* ID 2 en BD es SOCIO */}
                            <option value="3">NO SOCIO</option>       {/* ID 3 en BD es NO_SOCIO */}
                            <option value="4">DESPACHO MAYOR</option> {/* ID 4 en BD es DESPACHO_MAYOR */}
                        </select>
                    </div>

                    <div className="input-group">
                        <label><User size={14} /> Vendedor / Receptor / Cliente</label>
                        <input
                            value={sellerName}
                            onChange={e => setSellerName(e.target.value)}
                            placeholder="Nombre de quien recibe la mercancía"
                        />
                    </div>
                </div>

                <div className="search-bar-container" style={{ margin: '25px 0', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '15px', top: '13px', color: '#dc193d' }} />
                    <input
                        className="input-group input"
                        style={{ width: '80%', paddingLeft: '45px', height: '45px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        placeholder="Filtrar productos por nombre..."
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="table-container-fixed">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Stock Actual</th>
                                <th>Precio Unit.</th>
                                <th width="120">Cant. a Despachar</th>
                                <th className="col-total">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products
                                .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(p => (
                                    <tr key={p.id}>
                                        <td className="font-bold">{p.name}</td>
                                        <td>
                                            <span className={`badge-stock ${p.stock < 10 ? 'stock-low' : ''}`}>
                                                {p.stock}
                                            </span>
                                        </td>
                                        <td>${getUnitPrice(p).toLocaleString()}</td>
                                        <td>
                                            <input
                                                type="number"
                                                className="qty-input"
                                                style={{ width: '100%', textAlign: 'center' }}
                                                value={quantities[p.id] ?? ""}
                                                onChange={e => handleQtyChange(p.id, e.target.value, p.stock)}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="col-total">
                                            ${((Number(quantities[p.id]) || 0) * getUnitPrice(p)).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                <div className="form-actions" style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: '800' }}>
                        TOTAL: <span style={{ color: 'var(--primary)' }}>${totalDespacho.toLocaleString()}</span>
                    </div>
                    <button className="btn-primary-main" onClick={handleConfirmar} disabled={loading || totalDespacho === 0}>
                        {loading ? "Registrando..." : "Confirmar y Descontar Stock"}
                    </button>
                </div>
            </div>
        </div>
    );
}