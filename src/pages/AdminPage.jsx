import AdminPanel from '../components/AdminPanel'

function AdminPage({ trackedContracts, onAddContract, contractAddresses, contracts }) {
  return (
    <AdminPanel 
      trackedContracts={trackedContracts}
      onAddContract={onAddContract}
      contractAddresses={contractAddresses}
      contracts={contracts}
    />
  )
}

export default AdminPage
