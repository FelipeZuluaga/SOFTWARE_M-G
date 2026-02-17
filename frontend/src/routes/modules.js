export const modulesByRole = {
    ADMINISTRADOR: [
        { title: "Creaciòn de Usuarios", path: "/AdminDashboard/users", iconName: "Users" },
        { title: "Ingreso de Productos / Inventario", path: "/Inventory", iconName: "Package" },
        { title: "Crear Ruta", path: "/despacho", iconName: "Truck" },
        { title: "Informe de rutas cargadas", path: "/pedidos", iconName: "ClipboardList" },

        // --- MEJORADO PARA ADMIN ---
        { title: "Generar una venta", path: "/ventas", iconName: "LayoutDashboard" },
        { title: "Informe de ventas", path: "/historial-ventas", iconName: "BarChart3" },
        { title: "Devoluciones", path: "/liquidaciones", iconName: "RefreshCcw" },

        { title: "Liquidación", path: "/liquidacion", iconName: "Calculator" },
        { title: "Pagos", path: "/pagos", iconName: "Wallet" },
    ],
    DESPACHADOR: [
        { title: "Crear pedido", path: "/despacho", iconName: "Truck" },
        { title: "Detalle mis pedidos", path: "/pedidos", iconName: "ClipboardList" },
        { title: "Devoluciones", path: "/devoluciones", iconName: "RefreshCcw" },
    ],
    SOCIO: [
        { title: "Mis Rutas Cargadas", path: "/ventas", iconName: "Navigation" },
        { title: "Mis Clientes", path: "/historial-ventas", iconName: "TrendingUp" },
        { title: "Hacer Devoluciones", path: "/devoluciones", iconName: "RotateCcw" },
    ],
    NO_SOCIO: [
        { title: "Mis Rutas Cargadas", path: "/ventas", iconName: "Navigation" },
        { title: "Mis Clientes", path: "/historial-ventas", iconName: "TrendingUp" },
        { title: "Hacer Devoluciones", path: "/devoluciones", iconName: "RotateCcw" },
    ]
};