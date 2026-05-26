import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../context/theme'

const links = [
  { to: '/influencers', label: 'Influencers' },
  { to: '/inspiration', label: 'Inspiration' },
  { to: '/brand-deals', label: 'Brand Deals' },
]

export default function Nav() {
  const { pathname } = useLocation()
  const { isDark } = useTheme()
  const landing = pathname === '/'
  const dark = landing || isDark

  const navBg = landing
    ? 'transparent'
    : isDark
    ? 'rgba(7,7,14,0.88)'
    : 'rgba(255,255,255,0.80)'

  const navBorder = landing
    ? 'none'
    : isDark
    ? '1px solid rgba(255,255,255,0.07)'
    : '1px solid rgba(0,0,0,0.06)'

  return (
    <nav className="nav-root" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 'var(--nav-h)',
      background: navBg,
      backdropFilter: landing ? 'none' : 'blur(24px) saturate(1.8)',
      WebkitBackdropFilter: landing ? 'none' : 'blur(24px) saturate(1.8)',
      borderBottom: navBorder,
      display: 'flex',
      alignItems: 'center',
      padding: '0 28px',
      zIndex: 100,
      gap: 2,
      transition: 'background 0.4s, border-color 0.4s',
    }}>

      {/* Logo */}
      <NavLink to="/" style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: dark ? 'rgba(255,255,255,0.10)' : 'linear-gradient(135deg,#EC4899,#8B5CF6)',
          border: dark ? '1px solid rgba(255,255,255,0.12)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: dark ? 'none' : '0 2px 8px rgba(139,92,246,0.35)',
          transition: 'background 0.5s',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="5" r="3" fill="white" opacity="0.95"/>
            <path d="M1 13c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.95"/>
          </svg>
        </span>
        <span className="nav-brand-label" style={{
          fontWeight: 700, fontSize: 15, letterSpacing: '-0.4px',
          color: dark ? 'rgba(255,255,255,0.90)' : 'var(--text-primary)',
          transition: 'color 0.5s',
        }}>Influencer Studio</span>
      </NavLink>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} className="nav-link" style={({ isActive }) => ({
            padding: '6px 14px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: isActive ? 600 : 500,
            color: dark
              ? (isActive ? 'rgba(255,255,255,0.93)' : 'rgba(255,255,255,0.45)')
              : (isActive ? '#EC4899' : 'var(--text-secondary)'),
            background: dark
              ? (isActive ? 'rgba(255,255,255,0.08)' : 'transparent')
              : (isActive ? 'rgba(236,72,153,0.08)' : 'transparent'),
            transition: 'all 0.15s',
          })}>
            {l.label}
          </NavLink>
        ))}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
        <NavLink to="/create" style={({ isActive }) => ({
          padding: '7px 16px', borderRadius: 980,
          background: isActive ? (dark ? 'rgba(255,255,255,0.14)' : '#1D1D1F') : dark ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg,#EC4899,#8B5CF6)',
          color: '#fff', fontSize: 13, fontWeight: 700,
          textDecoration: 'none', letterSpacing: '-0.1px',
          boxShadow: dark ? 'none' : '0 2px 8px rgba(139,92,246,0.3)',
          transition: 'all 0.15s',
        })}>+ Create</NavLink>

        <NavLink to="/settings" title="Settings" style={({ isActive }) => ({
          width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isActive
            ? (dark ? 'rgba(255,255,255,0.12)' : 'var(--bg-tertiary)')
            : 'transparent',
          color: dark ? 'rgba(255,255,255,0.65)' : 'var(--text-secondary)',
          textDecoration: 'none', transition: 'all 0.15s',
        })}
          onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.10)' : 'var(--bg-tertiary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = pathname === '/settings' ? (dark ? 'rgba(255,255,255,0.12)' : 'var(--bg-tertiary)') : 'transparent' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </NavLink>
      </div>
    </nav>
  )
}
