import { Navigate, useLocation } from 'react-router-dom';

const RoleRoute = ({ children, allowedRoles }) => {
  const location = useLocation();
  
  // Intentamos obtener el usuario del almacenamiento local
  const user = JSON.parse(localStorage.getItem("user"));

  // Si no hay sesión, redirigimos al login guardando la ruta intentada
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificamos si el rol del usuario (en mayúsculas) tiene permiso
  const userRole = user.role?.toUpperCase();
  if (!allowedRoles.includes(userRole)) {
    // Si no tiene permiso, lo devolvemos al login (o podrías crear una página 403)
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default RoleRoute;