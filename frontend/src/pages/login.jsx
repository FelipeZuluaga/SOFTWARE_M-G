import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import logo from "../assets/logo.jpeg";
import { Truck } from 'lucide-react'; 
import Footer from "../components/footer";
import { loginUser } from "../services/authService";
import { alertSuccess, alertError, alertWarning } from "../services/alertService";

function Login() {
  const navigate = useNavigate();

  // Cambiado de email a userId para usar el código único
  const [userId, setUserId] = useState(""); 
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); 

    // Validación actualizada para usar userId
    if (!userId || !password || !roleId) {
      alertWarning("Campos incompletos", "Por favor ingresa tu código, contraseña y selecciona un rol.");
      return;
    }

    try {
      setLoading(true);

      // Enviamos el userId (ID único) al servicio de autenticación
      const data = await loginUser(userId, password, roleId);

      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));

        await alertSuccess(
          `¡Bienvenido, ${data.user.name}!`,
          `Has ingresado como ${data.user.role}`
        );

        redirectByRole(data.user.role);
      }
    } catch (error) {
      alertError("Error de acceso", error.message || "Código o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  const redirectByRole = (role) => {
    const userRole = role.toUpperCase();

    switch (userRole) {
      case "ADMINISTRADOR":
      case "SOCIO":
      case "NO_SOCIO":
      case "DESPACHADOR":
        navigate("/dashboard");
        break;
      default:
        navigate("/login");
        break;
    }
  };

  return (
    <div className="login-page">
      <div className="main-container">
        <div className="left-section">
          <div className="overlay"></div>
          <div className="left-content">
            <div className="floating-icon">
              <Truck size={80} strokeWidth={1.5} />
            </div>
            <h1>Mayorista <span>Gallego</span></h1>
            <div className="divider"></div>
            <p>
              Calidad y confianza en la distribución de alimentos al por mayor y detal.
              Impulsamos el crecimiento de tu negocio.
            </p>
          </div>
        </div>

        <div className="login-section">
          <div className="login-container">
            <div className="brand-header">
              <img src={logo} alt="Logo" className="login-logo" />
              <h2>Bienvenido de nuevo</h2>
              <p className="subtitle">Ingresa tu código único para continuar</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Rol de Usuario</label>
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  <option value="">Seleccionar Rol</option>
                  <option value="1">ADMINISTRADOR</option>
                  <option value="2">SOCIO</option>
                  <option value="3">NO SOCIO</option>
                  <option value="4">DESPACHADOR</option>
                </select>
              </div>

              <div className="form-group">
                {/* Cambiado de Correo Electrónico a Código de Usuario */}
                <label>Código de Usuario (ID)</label>
                <input
                  type="text" 
                  placeholder="Ej: 102030"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button class="btn btn-primary" disabled={loading}>
                {loading ? "Ingresando..." : "Iniciar Sesión"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default Login;