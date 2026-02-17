import { useEffect, useState } from "react";
import { Trash2, UserPlus, ShieldCheck } from "lucide-react";
import { userService } from "../services/userService";
import { alertSuccess, alertError, alertConfirm } from "../services/alertService";
import "../styles/users.css"; // Nuevo archivo

const ROLES = ["ADMINISTRADOR", "DESPACHADOR", "SOCIO", "NO_SOCIO"];

function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", password: "", role: "" });

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        try {
            const data = await userService.getAll();
            setUsers(data);
        } catch (err) {
            alertError("Error", "No se pudo sincronizar la base de datos.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await userService.create(form);
            alertSuccess("¡Listo!", `${form.name} ahora tiene acceso.`);
            setForm({ name: "", email: "", password: "", role: "" });
            loadUsers();
        } catch (err) {
            alertError("Error", "No se pudo registrar.");
        } finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        const confirmed = await alertConfirm("¿Eliminar usuario?", "Esta acción no se puede deshacer.");
        if (confirmed) {
            try {
                await userService.delete(id);
                alertSuccess("Eliminado", "El usuario fue borrado.");
                loadUsers();
            } catch (err) { alertError("Error", "No se pudo eliminar."); }
        }
    };

    return (
        <div className="users-layout">
            {/* PANEL IZQUIERDO: Formulario */}
            <aside className="user-form-card">
                <h2><UserPlus size={20} /> Nuevo Acceso</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nombre Completo</label>
                        <input type="text" value={form.name} required
                            onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Código de Usuario (Email/ID)</label>
                        <input type="text" value={form.email} required
                            onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Contraseña Temporal</label>
                        <input type="password" value={form.password} required
                            onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Rol de Sistema</label>
                        <select value={form.role} required
                            onChange={(e) => setForm({ ...form, role: e.target.value })}>
                            <option value="">Seleccionar...</option>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '10px'}} disabled={loading}>
                        <ShieldCheck size={18} />
                        {loading ? "Registrando..." : "Crear Usuario"}
                    </button>
                </form>
            </aside>

            {/* PANEL DERECHO: Tabla */}
            <section className="users-table-container">
                <table className="mg-table">
                    <thead>
                        <tr>
                            <th>Usuario / Código</th>
                            <th>Rol Asignado</th>
                            <th style={{textAlign: 'center'}}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length > 0 ? users.map((u) => (
                            <tr key={u.id}>
                                <td>
                                    <strong>{u.name}</strong>
                                    <div style={{fontSize: '0.75rem', color: 'var(--text-light)'}}>{u.email}</div>
                                </td>
                                <td><span className="role-badge">{u.role}</span></td>
                                <td style={{textAlign: 'center'}}>
                                    <button className="btn-icon-delete" onClick={() => handleDelete(u.id)}>
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="3" className="text-center">No hay usuarios registrados.</td></tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

export default UsersPage;