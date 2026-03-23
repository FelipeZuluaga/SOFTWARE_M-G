import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/login.jsx";
import Dashboard from "./pages/Dashboard.jsx"; // Nombre genérico
import RoleRoute from "./routes/RoleRoute";
import MainLayout from "./layouts/MainLayout";
import UsersPage from "./pages/UsersPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import DespachoPage from "./pages/DespachoPage.jsx";
import PedidosPage from "./pages/PedidosPage.jsx";
import VentasPage from "./pages/VentasPage.jsx";
import VentasHistoryPage from "./pages/VentasHistoryPage.jsx";
import DevolucionesPage from "./pages/DevolucionesPage.jsx";
import LiquidacionesListPage from "./pages/LiquidacionesListPage.jsx";
import VentasDetalleReadOnly from "./components/VentasDetalleReadOnly.jsx";
import SettlementModule from "./components/SettlementModule.jsx";
import CustomerList from "./components/CustomerList.jsx";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* El Dashboard ahora es para TODOS los roles autorizados */}
        <Route
          path="/dashboard"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "DESPACHADOR", "SOCIO", "NO_SOCIO"]}>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/AdminDashboard/users"
          element={
            <MainLayout>
              <UsersPage />
            </MainLayout>
          }
        />
        {/* --- MÓDULO DE INVENTARIO (ADMINISTRADOR y DESPACHADOR) --- */}
        <Route
          path="/Inventory"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
              <MainLayout>
                <InventoryPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        {/* --- MÓDULO DE DESPACHOS (Donde se crea el pedido y resta stock) --- */}
        <Route
          path="/despacho"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "DESPACHADOR"]}>
              <MainLayout>
                <DespachoPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        {/* Módulo de Pedidos/Historial: 
            Aquí aplicamos la lógica de visibilidad filtrada para todos los roles */}
        <Route
          path="/pedidos"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "DESPACHADOR", "SOCIO", "NO_SOCIO"]}>
              <MainLayout>
                <PedidosPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        {/* 2. NUEVA RUTA: MÓDULO DE VENTAS (Liquidación y Abonos) */}
        <Route
          path="/ventas"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "SOCIO", "NO_SOCIO"]}>
              <MainLayout>
                <VentasPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/devoluciones"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "SOCIO", "NO_SOCIO"]}>
              <MainLayout>
                <DevolucionesPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/liquidaciones"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "SOCIO"]}>
              <MainLayout>
                <LiquidacionesListPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        
        {/* 2. NUEVA RUTA: HISTORIAL DE VENTAS REALIZADAS */}
        <Route
          path="/historial-ventas"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "SOCIO", "NO_SOCIO"]}>
              <MainLayout>
                <VentasHistoryPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/ventas-detalle/:orderId"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "SOCIO", "NO_SOCIO"]}>
              <MainLayout>
                <VentasDetalleReadOnly />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/liquidacion-ruta/:orderId"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "SOCIO", "NO_SOCIO"]}>
              <MainLayout>
                <SettlementModule />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <RoleRoute allowedRoles={["ADMINISTRADOR", "SOCIO", "NO_SOCIO"]}>
              <MainLayout>
                <CustomerList />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}