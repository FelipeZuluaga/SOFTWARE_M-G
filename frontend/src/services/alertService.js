import Swal from 'sweetalert2';
const BRAND_COLOR = '#0d2a4d'; // El rojo borgoña de tu logo
export const alertSuccess = (title, text) => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonColor: BRAND_COLOR
  });
};

export const alertError = (title, text) => {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonColor: BRAND_COLOR
  });
};

export const alertWarning = (title, text) => {
  return Swal.fire({
    icon: 'warning',
    title,
    text,
    confirmButtonColor: BRAND_COLOR
  });
};
// alertService.js
export const alertConfirm = (title, text) => {
  return Swal.fire({
    title,
    text,
    icon: 'question', // Cambiado a 'question' para que se vea más amigable
    showCancelButton: true,
    confirmButtonColor: BRAND_COLOR,
    cancelButtonColor: '#636e72',
    confirmButtonText: 'Sí, finalizar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  });
};
export const alertConfirmUsers = async (title, text) => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: BRAND_COLOR,
    cancelButtonColor: '#636e72',
    confirmButtonText: 'Sí, finalizar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  });

  // Retornamos estrictamente el booleano isConfirmed
  return result.isConfirmed; 
};
