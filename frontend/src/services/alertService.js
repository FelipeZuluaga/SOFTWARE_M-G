import Swal from 'sweetalert2';
const BRAND_COLOR = '#9b111e'; // El rojo borgoña de tu logo
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
// ESTA ES LA QUE TE FALTA Y CAUSA EL ERROR
export const alertConfirm = (title, text) => {
  return Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: BRAND_COLOR,
    cancelButtonColor: '#636e72',
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  });
};