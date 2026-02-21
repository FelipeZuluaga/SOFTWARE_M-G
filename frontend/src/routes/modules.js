export const modulesByRole = {
    ADMINISTRADOR: [
        { title: "Creaciòn de Usuarios", path: "/AdminDashboard/users", iconName: "Users" },
        { title: "Ingreso de Productos / Inventario", path: "/Inventory", iconName: "Package" },
        { title: "Crear Ruta", path: "/despacho", iconName: "Truck" },
        { title: "Informe de rutas cargadas", path: "/pedidos", iconName: "ClipboardList" },

        // --- MEJORADO PARA ADMIN ---
        { title: "Rutas", path: "/ventas", iconName: "LayoutDashboard" },
        { title: "Informe de rutas", path: "/historial-ventas", iconName: "BarChart3" },

        { title: "Informe y proceso de Devolucion", path: "/liquidaciones", iconName: "RotateCcw" },


        { title: "Liquidación", path: "/liquidacion", iconName: "Calculator" },
        { title: "Pagos", path: "/pagos", iconName: "Wallet" },
    ],
    DESPACHADOR: [
        { title: "Crear pedido", path: "/despacho", iconName: "Truck" },
        { title: "Detalle mis pedidos", path: "/pedidos", iconName: "ClipboardList" },
        { title: "Informe y proceso de Devolucion", path: "/liquidaciones", iconName: "RotateCcw" },
    ],
    SOCIO: [
        { title: "Mis Rutas Cargadas", path: "/ventas", iconName: "Navigation" },
        { title: "Informe de mis rutas", path: "/historial-ventas", iconName: "TrendingUp" },
        { title: "Informe y proceso de Devolucion", path: "/liquidaciones", iconName: "RotateCcw" },
    ],
    NO_SOCIO: [
        { title: "Mis Rutas Cargadas", path: "/ventas", iconName: "Navigation" },
        { title: "Informe de mis rutas", path: "/historial-ventas", iconName: "TrendingUp" },
        { title: "Informe y proceso de Devolucion", path: "/liquidaciones", iconName: "RotateCcw" },
    ]
};