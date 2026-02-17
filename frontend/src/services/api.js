import axios from 'axios';

// Configuramos la URL base de nuestro backend de Node
const api = axios.create({
  baseURL: 'http://localhost:3001/api' 
});

export default api;