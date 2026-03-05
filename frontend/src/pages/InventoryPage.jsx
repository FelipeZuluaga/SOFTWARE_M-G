import { useEffect, useState } from "react";
import { inventoryService } from "../services/inventoryService";
import { alertSuccess, alertError, alertConfirm } from "../services/alertService";
import { Trash2, Edit3, Barcode, Boxes, Tag, DollarSign, AlertTriangle, Search } from "lucide-react";
import "../styles/inventory.css";

const CUSTOMER_TYPES = [
    { id: 2, label: "Socio" },
    { id: 3, label: "No socio" },
    { id: 1, label: "Cliente" },
    { id: 4, label: "Despacho mayorista" },
];

export default function InventoryPage() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentTypeIndex, setCurrentTypeIndex] = useState(0);

    const [form, setForm] = useState({
        barcode: "",
        name: "",
        stock: "",
        category_id: "",
        prices: { 1: "", 2: "", 3: "", 4: "" },
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (products.length >= 0) {
            setForm(prev => ({ ...prev, barcode: generateNextBarcode() }));
        }
    }, [products]);

    const loadData = async () => {
        try {
            const [prodData, catData] = await Promise.all([
                inventoryService.getProducts(),
                inventoryService.getCategories()
            ]);
            setProducts(prodData || []);
            setCategories(catData || []);
        } catch (err) {
            alertError("Error de Conexión", "No se pudo sincronizar con la base de datos.");
        }
    };

    // --- NUEVA FUNCIÓN PARA ESCANEO RÁPIDO ---
    const handleQuickScan = async (scannedBarcode) => {
        if (!scannedBarcode) return;

        const existingProduct = products.find(p => String(p.barcode) === String(scannedBarcode));

        if (existingProduct) {
            // Si el producto existe, preparamos el payload para SUMAR 1 al stock
            const pricesObj = { 1: "", 2: "", 3: "", 4: "" };
            existingProduct.prices?.forEach(pr => {
                pricesObj[pr.customer_type_id] = Math.trunc(pr.unit_price);
            });

            const catId = categories.find(c => c.name === existingProduct.category)?.id || "";

            const payload = {
                name: existingProduct.name,
                stock: 1, // El backend hará stock = stock + 1
                category_id: Number(catId),
                prices: CUSTOMER_TYPES.map((c) => ({
                    customer_type_id: c.id,
                    unit_price: pricesObj[c.id],
                })),
            };

            try {
                setLoading(true);
                await inventoryService.updateProduct(existingProduct.id, payload);
                alertSuccess("Stock Actualizado", `+1 unidad a: ${existingProduct.name}`);
                resetForm();
                loadData();
            } catch (err) {
                alertError("Error", "No se pudo actualizar el stock por escaneo.");
            } finally {
                setLoading(false);
            }
        } else {
            // Si no existe, movemos el foco al nombre para que el usuario lo cree
            document.getElementById("product-name-input")?.focus();
        }
    };

    const filteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getPrice = (prices, id) => prices?.find(p => p.customer_type_id === id)?.unit_price || 0;

    const calculateGrandTotal = (typeId) => {
        return products.reduce((acc, p) => {
            const price = getPrice(p.prices, typeId);
            return acc + (Number(p.stock) * Number(price));
        }, 0);
    };

    const currentType = CUSTOMER_TYPES[currentTypeIndex];
    const currentTotalValue = calculateGrandTotal(currentType.id);
    const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
    const productsInCriticalStock = products.filter(p => Number(p.stock) < 10).length;

    const handleDelete = async (id) => {
        const result = await alertConfirm("¿Eliminar producto?", "Esta acción no se puede deshacer.");
        if (result.isConfirmed) {
            try {
                await inventoryService.deleteProduct(id);
                alertSuccess("Eliminado", "Producto quitado del inventario.");
                loadData();
            } catch (err) {
                alertError("Error", "No se pudo eliminar.");
            }
        }
    };

    const generateNextBarcode = () => {
        if (products.length === 0) return "1000";
        const codes = products.map(p => parseInt(p.barcode)).filter(n => !isNaN(n));
        const maxCode = codes.length > 0 ? Math.max(...codes) : 999;
        return String(maxCode + 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.category_id) return alertError("Faltan datos", "Selecciona una categoría.");

        try {
            setLoading(true);
            const payload = {
                ...form,
                stock: Math.floor(Number(form.stock)),
                category_id: Number(form.category_id),
                prices: CUSTOMER_TYPES.map(c => ({
                    customer_type_id: c.id,
                    unit_price: Math.trunc(Number(form.prices[c.id]) || 0)
                }))
            };
            await inventoryService.createProduct(payload);
            alertSuccess("¡Éxito!", "Producto registrado.");
            resetForm();
            loadData();
        } catch (err) {
            alertError("Error", "No se pudo crear el producto.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        try {
            const payload = {
                name: form.name.trim(),
                stock: Math.floor(Number(form.stock)) || 0,
                category_id: Number(form.category_id),
                prices: CUSTOMER_TYPES.map((c) => ({
                    customer_type_id: c.id,
                    unit_price: Math.trunc(Number(form.prices[c.id]) || 0),
                })),
            };
            await inventoryService.updateProduct(editingProduct.id, payload);
            alertSuccess("¡Actualizado!", "Cambios guardados.");
            setShowModal(false);
            resetForm();
            loadData();
        } catch (err) {
            alertError("Error", "No se pudo actualizar.");
        }
    };

    const openEditModal = (p) => {
        const pricesObj = { 1: "", 2: "", 3: "", 4: "" };
        p.prices?.forEach(pr => { pricesObj[pr.customer_type_id] = Math.trunc(pr.unit_price); });

        setEditingProduct(p);
        setForm({
            barcode: p.barcode,
            name: p.name,
            stock: 0,
            category_id: categories.find(c => c.name === p.category)?.id || "",
            prices: pricesObj,
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setForm({
            barcode: generateNextBarcode(),
            name: "",
            stock: "",
            category_id: "",
            prices: { 1: "", 2: "", 3: "", 4: "" },
        });
        setEditingProduct(null);
        // Devolvemos el foco al código para el siguiente escaneo
        document.getElementById("barcode-input")?.focus();
    };

    return (
        <div className="inv-page full-layout">
            <div className="module-intro">
                <h1>Inventario General</h1>
                <p>Gestión de stock y valorización en tiempo real.</p>
            </div>

            <div className="summary-cards">
                <div className="s-card socio carousel-card">
                    <div className="s-icon"><DollarSign size={22} /></div>
                    <div className="s-info carousel-info">
                        <label>Inversión Total ({currentType.label})</label>
                        <span className="price-display">${currentTotalValue.toLocaleString()}</span>
                    </div>
                </div>
                <div className="s-card total-items">
                    <div className="s-icon"><Boxes size={22} /></div>
                    <div className="s-info">
                        <label>Total Existencias</label>
                        <span>{totalStockUnits.toLocaleString()}</span>
                    </div>
                </div>
                <div className="s-card alerts">
                    <div className="s-icon"><AlertTriangle size={22} /></div>
                    <div className="s-info">
                        <label>Stock Crítico</label>
                        <span>{productsInCriticalStock}</span>
                    </div>
                </div>
            </div>

            <div className="inv-card full-width-card">
                <form className="inv-form" onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="input-group barcode-group">
                            <label><Barcode size={14} /> Código de barras</label>
                            <input
                                id="barcode-input"
                                type="text"
                                value={form.barcode}
                                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleQuickScan(form.barcode);
                                    }
                                }}
                                placeholder="Escanee aquí..."
                                className="input-barcode-editable"
                                autoFocus
                            />
                        </div>
                        <div className="input-group">
                            <label>Nombre del Producto</label>
                            <input
                                id="product-name-input"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label><Boxes size={14} /> Existencias</label>
                            <input
                                type="number"
                                value={form.stock}
                                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label><Tag size={14} /> Categoría</label>
                            <select
                                value={form.category_id}
                                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                                required
                            >
                                <option value="">Seleccione...</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <h3 className="section-title">Precios de Venta</h3>
                    <div className="prices-grid">
                        {CUSTOMER_TYPES.map((c) => (
                            <div key={c.id} className="price-card">
                                <label>{c.label}</label>
                                <div className="input-with-icon">
                                    <span>$</span>
                                    <input
                                        type="number"
                                        value={form.prices[c.id]}
                                        onChange={(e) => setForm({
                                            ...form,
                                            prices: { ...form.prices, [c.id]: e.target.value },
                                        })}
                                        required
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="search-bar-container">
                        <div className="input-group" style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <label><Search size={18} /> Buscar en el inventario</label>
                            <input
                                type="text"
                                placeholder="Nombre o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary-main" disabled={loading}>
                            {loading ? "Registrando..." : "Añadir al Inventario"}
                        </button>
                    </div>
                </form>

                <div className="table-container-fixed">
                    <table className="inv-table no-scroll">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th>Stock</th>
                                <th>Categoría</th>
                                <th>Socio</th>
                                <th>No Socio</th>
                                <th>Cliente</th>
                                <th>May.</th>
                                <th className="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((p) => (
                                <tr key={p.id}>
                                    <td className="font-mono">{p.barcode}</td>
                                    <td className="font-bold">{p.name}</td>
                                    <td>
                                        <span className={`badge-stock ${Number(p.stock) < 10 ? 'stock-low' : ''}`}>
                                            {p.stock}
                                        </span>
                                    </td>
                                    <td>{p.category}</td>
                                    {CUSTOMER_TYPES.map(c => (
                                        <td key={`price-${p.id}-${c.id}`}>
                                            ${Math.trunc(getPrice(p.prices, c.id)).toLocaleString()}
                                        </td>
                                    ))}
                                    <td className="text-center">
                                        <div className="action-group">
                                            <button className="btn-edit" onClick={() => openEditModal(p)}>
                                                <Edit3 size={16} />
                                            </button>
                                            <button className="btn-delete" onClick={() => handleDelete(p.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content fade-in">
                        <div className="modal-header">
                            <h2>Actualizar {editingProduct?.name}</h2>
                            <button className="close-x" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-form-grid">
                                <div className="input-group">
                                    <label>Añadir al Stock</label>
                                    <input
                                        type="number"
                                        value={form.stock}
                                        onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                    />
                                    <small>Se sumará al actual: {editingProduct?.stock}</small>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-modal-save" onClick={handleUpdate}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}