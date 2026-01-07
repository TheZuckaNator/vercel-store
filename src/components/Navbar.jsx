import { NavLink } from 'react-router-dom'
import './Navbar.css'

function Navbar({ isAdmin }) {
  return (
    <nav className="navbar">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
        Primary Store
      </NavLink>
      <NavLink to="/studiochain" className={({ isActive }) => isActive ? 'active' : ''}>
        StudioChain
      </NavLink>
      <NavLink to="/marketplace" className={({ isActive }) => isActive ? 'active' : ''}>
        Marketplace
      </NavLink>
      <NavLink to="/inventory" className={({ isActive }) => isActive ? 'active' : ''}>
        Inventory
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
          Admin
        </NavLink>
      )}
    </nav>
  )
}

export default Navbar
