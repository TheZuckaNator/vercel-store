import { useState } from 'react'
import './AdminPanel.css'

function AdminPanel({ trackedContracts, onAddContract, contractAddresses }) {
  const [newContract, setNewContract] = useState('')
  
  const handleAdd = () => {
    if (!newContract || !newContract.startsWith('0x') || newContract.length !== 42) return
    onAddContract(newContract)
    setNewContract('')
  }
  
  return (
    <div className="admin-panel">
      <h1>🔧 Admin Panel</h1>
      
      <section className="admin-section">
        <h2>System Contracts</h2>
        <div className="contracts-list">
          <div className="contract-item"><span>NFT</span><span>{contractAddresses.nft}</span></div>
          <div className="contract-item"><span>Marketplace</span><span>{contractAddresses.marketplace}</span></div>
          <div className="contract-item"><span>Tracking</span><span>{contractAddresses.tracking}</span></div>
          <div className="contract-item"><span>KARRAT</span><span>{contractAddresses.karrat}</span></div>
        </div>
      </section>
      
      <section className="admin-section">
        <h2>Add Contract to Tracking</h2>
        <div className="add-contract">
          <input type="text" value={newContract} onChange={e => setNewContract(e.target.value)} placeholder="0x..." />
          <button onClick={handleAdd}>Add</button>
        </div>
        
        <h3>Tracked ({trackedContracts.length})</h3>
        {trackedContracts.length === 0 ? (
          <p className="no-data">No contracts tracked</p>
        ) : (
          <div className="tracked-list">
            {trackedContracts.map((addr, i) => (
              <div key={addr} className="tracked-item">
                <span>#{i + 1}</span>
                <span>{addr}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminPanel
