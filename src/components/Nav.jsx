import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useTheme } from '../context/theme'

export default function Nav() {
  const { isDark, toggle } = useTheme()
  const { profile, isApproved, isSuperUser, signOut } = useAuth()
  const links = isApproved ? [
    { to: '/avatars', label: 'Avatars' },
    { to: '/products', label: 'Products' },
    { to: '/prompt-builder', label: 'Prompt' },
    { to: '/library', label: 'Library' },
    ...(isSuperUser ? [{ to: '/users', label: 'Users' }] : []),
  ] : []

  return (
    <nav className="nav-root">
      <NavLink to="/" className="brand-mark">
        <span className="brand-icon">UGC</span>
        <span>Avatar Studio</span>
      </NavLink>
      <div className="nav-links">
        {links.map(link => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className="nav-actions">
        <button className="icon-btn" onClick={e => toggle(e.clientX, e.clientY)} title={isDark ? 'Light mode' : 'Dark mode'}>
          {isDark ? '☾' : '☼'}
        </button>
        <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Settings</NavLink>
        {profile ? <button className="text-btn" onClick={signOut}>Sign out</button> : <NavLink className="primary-btn compact" to="/login">Sign in</NavLink>}
      </div>
    </nav>
  )
}

