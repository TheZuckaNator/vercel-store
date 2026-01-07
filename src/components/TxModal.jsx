import './TxModal.css'

function TxModal({ status, message }) {
  return (
    <div className="tx-modal-overlay">
      <div className={`tx-modal ${status}`}>
        <div className="tx-icon">
          {status === 'pending' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>
        <p>{message}</p>
      </div>
    </div>
  )
}

export default TxModal
