import api from './api';

export const loginUser = async (id, password, role_id) => {
  try {
    // Enviamos los datos tal cual los espera tu backend
    const response = await api.post('/login', { id, password, role_id });
    return response.data; // Devuelve { success: true, user: {...} }
  } catch (error) {
    // Captura el error que configuramos en el backend (401 o 500)
    throw error.response?.data || { message: "Error de conexión" };
  }
};