import { formatKarrat, formatAddress } from '../utils/storage'
import './Header.css'

function Header({ userAddress, ethBalance, karratBalance, onConnect, isAdmin }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="10" fill="url(#lg)"/>
              <path d="M12 36V12h6l6 12 6-12h6v24h-5V20l-5 10h-4l-5-10v16h-5z" fill="white"/>
              <defs><linearGradient id="lg" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#bf00ff"/><stop offset="1" stopColor="#00ffff"/></linearGradient></defs>
            </svg>
          </div>
          <div>
            <div className="logo-text">MY PET HOOLIGAN</div>
            <div className="logo-sub">GAME STORE</div>
          </div>
        </div>
        
        {userAddress ? (
          <div className="wallet-info">
            {isAdmin && <span className="admin-badge">ADMIN</span>}
            <div className="balance-group">
              <span className="balance karrat">{formatKarrat(karratBalance)} KARRAT</span>
              <span className="balance eth">{parseFloat(ethBalance).toFixed(4)} ETH</span>
            </div>
            <span className="address">{formatAddress(userAddress)}</span>
          </div>
        ) : (
          <button className="connect-btn" onClick={onConnect}>Connect Wallet</button>
        )}
      </div>
    </header>
  )
}

export default Header
