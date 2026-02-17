import { Link } from "react-router-dom";
import { modulesByRole } from "../routes/modules";
import * as LucideIcons from "lucide-react";
import "../styles/dashboard.css";

function Dashboard() {
    const user = JSON.parse(localStorage.getItem("user"));
    const userRole = user?.role?.toUpperCase();
    const menuItems = modulesByRole[userRole] || [];

    return (
        <div className="admin-cards">
            {menuItems.map((item, index) => {
                const IconComponent = LucideIcons[item.iconName];

                return (
                    <Link to={item.path} key={index} className="admin-card-link">
                        <div className="admin-card">
                            <div className="card-icon-wrapper">
                                {IconComponent && (
                                    <IconComponent 
                                        size={40} 
                                        strokeWidth={1.5} 
                                    />
                                )}
                            </div>
                            <h3>{item.title}</h3>
                            <p>Gestionar sección</p>
                            
                            {/* Eliminamos el style inline y usamos la clase que ya definimos en el CSS */}
                            <div className="card-badge">
                                ACCEDER
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}

export default Dashboard;