import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ethers } from 'ethers'
import Header from './components/Header'
import Navbar from './components/Navbar'
import PrimaryStorePage from './pages/PrimaryStorePage'
import StudioChainPage from './pages/StudioChainPage'
import MarketplacePage from './pages/MarketplacePage'
import InventoryPage from './pages/InventoryPage'
import AdminPage from './pages/AdminPage'
import Toast from './components/Toast'
import TxModal from './components/TxModal'
import { NFT_ABI, MARKETPLACE_ABI, TRACKING_ABI, KARRAT_ABI, EIP712_DOMAIN, APPROVAL_TYPES, STUDIOCHAIN_NFT_ABI, STUDIOCHAIN_MARKETPLACE_ABI, STUDIOCHAIN_EIP712_DOMAIN } from './utils/constants'
import { getListings, addListing, updateListing, removeListing, getStudioChainListings, addStudioChainListing, updateStudioChainListing, removeStudioChainListing, saveSignature } from './utils/storage'
import './App.css'

const ADMIN_ADDRESS = import.meta.env.VITE_ADMIN_ADDRESS?.toLowerCase() || ''

function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [userAddress, setUserAddress] = useState(null)
  const [ethBalance, setEthBalance] = useState('0')
  const [karratBalance, setKarratBalance] = useState('0')
  
  // Main chain contracts (KARRAT)
  const [contracts, setContracts] = useState({ nft: null, marketplace: null, tracking: null, karrat: null })
  const [contractAddresses] = useState({
    nft: import.meta.env.VITE_NFT_CONTRACT || '',
    marketplace: import.meta.env.VITE_MARKETPLACE_CONTRACT || '',
    tracking: import.meta.env.VITE_TRACKING_CONTRACT || '',
    karrat: import.meta.env.VITE_KARRAT_CONTRACT || '',
    verifier: import.meta.env.VITE_VERIFIER_CONTRACT || ''
  })
  
  // StudioChain contracts (native ETH)
  const [studioChainContracts, setStudioChainContracts] = useState({ nft: null, marketplace: null })
  const [studioChainAddresses] = useState({
    nft: import.meta.env.VITE_STUDIOCHAIN_NFT_CONTRACT || '',
    marketplace: import.meta.env.VITE_STUDIOCHAIN_MARKETPLACE_CONTRACT || '',
    rpcUrl: import.meta.env.VITE_STUDIOCHAIN_RPC_URL || ''
  })
  
  const [tiers, setTiers] = useState([])
  const [studioChainTiers, setStudioChainTiers] = useState([])
  const [userBalances, setUserBalances] = useState({})
  const [studioChainBalances, setStudioChainBalances] = useState({})
  const [listings, setListings] = useState([])
  const [studioChainListings, setStudioChainListings] = useState([])
  const [trackedContracts, setTrackedContracts] = useState([])
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [txModal, setTxModal] = useState({ show: false, status: '', message: '' })
  
  const isAdmin = userAddress?.toLowerCase() === ADMIN_ADDRESS

  // Listen for network changes and reload
  useEffect(() => {
    if (!window.ethereum) return

    const handleChainChanged = (chainId) => {
      console.log('Network changed to:', chainId)
      window.location.reload()
    }

    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }, [])

  // Load listings from storage
  useEffect(() => {
    const loadListings = async () => {
      const karratListings = await getListings()
      const scListings = await getStudioChainListings()
      setListings(karratListings)
      setStudioChainListings(scListings)
    }
    loadListings()
  }, [])

  // Load tiers
  const loadTiers = async (nftContract) => {
    const tierNames = ['Weapons', 'Armor', 'Consumables', 'Rare', 'Legendary']
    const loadedTiers = []
    
    for (const name of tierNames) {
      try {
        const info = await nftContract.getTokenInfo(name)
        if (info.tokenIds.length > 0) {
          loadedTiers.push({
            name,
            tokenIds: info.tokenIds.map(id => Number(id)),
            maxSupplies: info.maxSupplies.map(s => Number(s)),
            currentSupplies: info.currentSupplies.map(s => Number(s)),
            prices: info.prices.map(p => p.toString()),
            maxAmountsPerUser: info.maxAmountsPerUser.map(m => Number(m)),
            tierURI: info.tierURI
          })
        }
      } catch (e) {
        // Tier doesn't exist
      }
    }
    return loadedTiers
  }

  // Load tiers on startup
  useEffect(() => {
    const init = async () => {
      try {
        const rpcUrl = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545'
        const rpcProvider = new ethers.JsonRpcProvider(rpcUrl)
        
        if (contractAddresses.nft) {
          const nft = new ethers.Contract(contractAddresses.nft, NFT_ABI, rpcProvider)
          const loadedTiers = await loadTiers(nft)
          setTiers(loadedTiers)
        }
        
        if (contractAddresses.tracking) {
          const tracking = new ethers.Contract(contractAddresses.tracking, TRACKING_ABI, rpcProvider)
          try {
            const tracked = await tracking.getAllDeployedContracts()
            setTrackedContracts(tracked)
          } catch (e) {
            console.log('Tracking error:', e.message)
          }
        }

        // Load StudioChain tiers
        if (studioChainAddresses.nft && studioChainAddresses.rpcUrl) {
          const scProvider = new ethers.JsonRpcProvider(studioChainAddresses.rpcUrl)
          const scNft = new ethers.Contract(studioChainAddresses.nft, STUDIOCHAIN_NFT_ABI, scProvider)
          const scTiers = await loadTiers(scNft)
          setStudioChainTiers(scTiers)
        }
      } catch (err) {
        console.error('Init error:', err)
      }
    }
    
    init()
  }, [contractAddresses, studioChainAddresses])

  // Switch to StudioChain network
  const switchToStudioChain = async () => {
    if (!window.ethereum) return false

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x268' }]
      })
      return true
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x268',
              chainName: 'StudioChain Testnet',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://studio-chain.rpc.caldera.xyz/http'],
              blockExplorerUrls: ['https://studio-chain.explorer.caldera.xyz']
            }]
          })
          return true
        } catch (addError) {
          console.error('Failed to add StudioChain:', addError)
          return false
        }
      }
      console.error('Failed to switch to StudioChain:', switchError)
      return false
    }
  }

  // Switch to Sepolia network
  const switchToSepolia = async () => {
    if (!window.ethereum) return false

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }]
      })
      return true
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://eth-sepolia.g.alchemy.com/v2/demo'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]
          })
          return true
        } catch (addError) {
          console.error('Failed to add Sepolia:', addError)
          return false
        }
      }
      console.error('Failed to switch to Sepolia:', switchError)
      return false
    }
  }

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      showToast('Please install MetaMask', 'error')
      return
    }
    
    try {
      await switchToSepolia()

      const web3Provider = new ethers.BrowserProvider(window.ethereum)
      await web3Provider.send("eth_requestAccounts", [])
      const web3Signer = await web3Provider.getSigner()
      const address = await web3Signer.getAddress()
      const bal = await web3Provider.getBalance(address)
      
      setProvider(web3Provider)
      setSigner(web3Signer)
      setUserAddress(address)
      setEthBalance(ethers.formatEther(bal))
      
      showToast('Wallet connected', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to connect', 'error')
    }
  }

  // Initialize contracts after wallet connects
  useEffect(() => {
    if (!signer || !contractAddresses.nft) return
    
    const initContracts = async () => {
      try {
        const nft = new ethers.Contract(contractAddresses.nft, NFT_ABI, signer)
        const marketplace = contractAddresses.marketplace 
          ? new ethers.Contract(contractAddresses.marketplace, MARKETPLACE_ABI, signer)
          : null
        const tracking = contractAddresses.tracking
          ? new ethers.Contract(contractAddresses.tracking, TRACKING_ABI, signer)
          : null
        const karrat = contractAddresses.karrat
          ? new ethers.Contract(contractAddresses.karrat, KARRAT_ABI, signer)
          : null
        
        setContracts({ nft, marketplace, tracking, karrat })
        
        const loadedTiers = await loadTiers(nft)
        setTiers(loadedTiers)
        
        if (karrat && userAddress) {
          const kb = await karrat.balanceOf(userAddress)
          setKarratBalance(kb.toString())
        }
        if (tracking) {
          try {
            const tracked = await tracking.getAllDeployedContracts()
            setTrackedContracts(tracked)
          } catch (e) {
            console.log('Tracking error:', e.message)
          }
        }

        // Init StudioChain contracts with dedicated provider
        if (studioChainAddresses.nft && studioChainAddresses.rpcUrl) {
          const scProvider = new ethers.JsonRpcProvider(studioChainAddresses.rpcUrl)
          const scNft = new ethers.Contract(studioChainAddresses.nft, STUDIOCHAIN_NFT_ABI, scProvider)
          const scMarketplace = studioChainAddresses.marketplace
            ? new ethers.Contract(studioChainAddresses.marketplace, STUDIOCHAIN_MARKETPLACE_ABI, scProvider)
            : null
          setStudioChainContracts({ nft: scNft, marketplace: scMarketplace })
          
          const scTiers = await loadTiers(scNft)
          setStudioChainTiers(scTiers)
        }
      } catch (err) {
        console.error('Init contracts error:', err)
      }
    }
    
    initContracts()
  }, [signer, contractAddresses, studioChainAddresses, userAddress])

  // Load user balances
  const loadUserBalances = useCallback(async () => {
    if (!contracts.nft || !userAddress || tiers.length === 0) return
    
    const balances = {}
    for (const tier of tiers) {
      for (const tokenId of tier.tokenIds) {
        try {
          const bal = await contracts.nft.balanceOf(userAddress, tokenId)
          balances[tokenId] = Number(bal)
        } catch {
          balances[tokenId] = 0
        }
      }
    }
    setUserBalances(balances)
  }, [contracts.nft, userAddress, tiers])

  const loadStudioChainBalances = useCallback(async () => {
    if (!studioChainContracts.nft || !userAddress || studioChainTiers.length === 0) return
    
    const balances = {}
    for (const tier of studioChainTiers) {
      for (const tokenId of tier.tokenIds) {
        try {
          const bal = await studioChainContracts.nft.balanceOf(userAddress, tokenId)
          balances[tokenId] = Number(bal)
        } catch {
          balances[tokenId] = 0
        }
      }
    }
    setStudioChainBalances(balances)
  }, [studioChainContracts.nft, userAddress, studioChainTiers])

  useEffect(() => {
    loadUserBalances()
    loadStudioChainBalances()
  }, [loadUserBalances, loadStudioChainBalances])

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  // Buy from primary sale (KARRAT)
  const buyPrimary = async (tierName, tokenIds, amounts) => {
    if (!contracts.nft || !contracts.karrat) return
    
    setTxModal({ show: true, status: 'pending', message: 'Approving KARRAT...' })
    
    try {
      const tier = tiers.find(t => t.name === tierName)
      let totalPrice = BigInt(0)
      for (let i = 0; i < tokenIds.length; i++) {
        const idx = tier.tokenIds.indexOf(tokenIds[i])
        totalPrice += BigInt(tier.prices[idx]) * BigInt(amounts[i])
      }
      
      const allowance = await contracts.karrat.allowance(userAddress, contractAddresses.nft)
      if (allowance < totalPrice) {
        const approveTx = await contracts.karrat.approve(contractAddresses.nft, ethers.MaxUint256)
        await approveTx.wait()
      }
      
      setTxModal({ show: true, status: 'pending', message: 'Purchasing...' })
      
      const tx = await contracts.nft.buyNFT(tierName, tokenIds, amounts)
      await tx.wait()
      
      setTxModal({ show: true, status: 'success', message: 'Purchase complete!' })
      
      const loadedTiers = await loadTiers(contracts.nft)
      setTiers(loadedTiers)
      await loadUserBalances()
      
      const kb = await contracts.karrat.balanceOf(userAddress)
      setKarratBalance(kb.toString())
      
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('Buy error:', err)
      setTxModal({ show: true, status: 'error', message: err.reason || err.message })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  // Buy from StudioChain primary (native ETH)
  const buyStudioChain = async (tierName, tokenIds, amounts) => {
    const switched = await switchToStudioChain()
    if (!switched) {
      showToast('Please switch to StudioChain network', 'error')
      return
    }

    // Reinitialize signer for StudioChain
    const web3Provider = new ethers.BrowserProvider(window.ethereum)
    const web3Signer = await web3Provider.getSigner()
    
    if (!studioChainAddresses.nft) return
    
    setTxModal({ show: true, status: 'pending', message: 'Purchasing with ETH...' })
    
    try {
      const scNft = new ethers.Contract(studioChainAddresses.nft, STUDIOCHAIN_NFT_ABI, web3Signer)
      
      const tier = studioChainTiers.find(t => t.name === tierName)
      let totalPrice = BigInt(0)
      for (let i = 0; i < tokenIds.length; i++) {
        const idx = tier.tokenIds.indexOf(tokenIds[i])
        totalPrice += BigInt(tier.prices[idx]) * BigInt(amounts[i])
      }
      
      const tx = await scNft.buyNFT(tierName, tokenIds, amounts, { value: totalPrice })
      await tx.wait()
      
      setTxModal({ show: true, status: 'success', message: 'Purchase complete!' })
      
      // Reload tiers with RPC provider
      const scProvider = new ethers.JsonRpcProvider(studioChainAddresses.rpcUrl)
      const scNftRead = new ethers.Contract(studioChainAddresses.nft, STUDIOCHAIN_NFT_ABI, scProvider)
      const scTiers = await loadTiers(scNftRead)
      setStudioChainTiers(scTiers)
      await loadStudioChainBalances()
      
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('StudioChain buy error:', err)
      setTxModal({ show: true, status: 'error', message: err.reason || err.message })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  // Create listing (KARRAT marketplace)
  const createListing = async (tokenId, amount, pricePerItem, deadline) => {
    if (!contracts.marketplace || !signer) return
    
    try {
      const nonce = await contracts.marketplace.nonces(contractAddresses.nft, tokenId, userAddress)
      const chainId = (await provider.getNetwork()).chainId
      
      const domain = {
        ...EIP712_DOMAIN,
        chainId: Number(chainId),
        verifyingContract: contractAddresses.marketplace
      }
      
      const priceWei = ethers.parseEther(pricePerItem.toString())
      
      const message = {
        seller: userAddress,
        nftContract: contractAddresses.nft,
        tokenId: BigInt(tokenId),
        amount: BigInt(amount),
        price: priceWei,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline)
      }
      
      setTxModal({ show: true, status: 'pending', message: 'Sign the listing...' })
      
      const signature = await signer.signTypedData(domain, APPROVAL_TYPES, message)
      
      const listing = {
        seller: userAddress,
        nftContract: contractAddresses.nft,
        tokenId,
        amount,
        price: pricePerItem.toString(),
        priceWei: priceWei.toString(),
        nonce: Number(nonce),
        deadline,
        signature
      }
      
      await addListing(listing)
      const updatedListings = await getListings()
      setListings(updatedListings)
      
      saveSignature({ type: 'listing_created', ...listing })
      
      setTxModal({ show: true, status: 'success', message: 'Listing created!' })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('Create listing error:', err)
      setTxModal({ show: true, status: 'error', message: 'Failed to sign' })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  // Create StudioChain listing (native ETH)
  const createStudioChainListing = async (tokenId, amount, pricePerItem, deadline) => {
    const switched = await switchToStudioChain()
    if (!switched) {
      showToast('Please switch to StudioChain network', 'error')
      return
    }

    // Reinitialize signer for StudioChain
    const web3Provider = new ethers.BrowserProvider(window.ethereum)
    const web3Signer = await web3Provider.getSigner()
    const address = await web3Signer.getAddress()
    
    if (!studioChainAddresses.marketplace) return
    
    try {
      const scMarketplace = new ethers.Contract(studioChainAddresses.marketplace, STUDIOCHAIN_MARKETPLACE_ABI, web3Signer)
      
      const nonce = await scMarketplace.nonces(studioChainAddresses.nft, tokenId, address)
      const chainId = (await web3Provider.getNetwork()).chainId
      
      const domain = {
        ...STUDIOCHAIN_EIP712_DOMAIN,
        chainId: Number(chainId),
        verifyingContract: studioChainAddresses.marketplace
      }
      
      const priceWei = ethers.parseEther(pricePerItem.toString())
      
      const message = {
        seller: address,
        nftContract: studioChainAddresses.nft,
        tokenId: BigInt(tokenId),
        amount: BigInt(amount),
        price: priceWei,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline)
      }
      
      setTxModal({ show: true, status: 'pending', message: 'Sign the listing...' })
      
      const signature = await web3Signer.signTypedData(domain, APPROVAL_TYPES, message)
      
      const listing = {
        seller: address,
        nftContract: studioChainAddresses.nft,
        tokenId,
        amount,
        price: pricePerItem.toString(),
        priceWei: priceWei.toString(),
        nonce: Number(nonce),
        deadline,
        signature
      }
      
      await addStudioChainListing(listing)
      const updatedListings = await getStudioChainListings()
      setStudioChainListings(updatedListings)
      
      setTxModal({ show: true, status: 'success', message: 'Listing created!' })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('Create StudioChain listing error:', err)
      setTxModal({ show: true, status: 'error', message: 'Failed to sign' })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  // Buy from marketplace (KARRAT)
  const buyFromListing = async (listing) => {
    if (!contracts.marketplace || !contracts.karrat) return
    
    setTxModal({ show: true, status: 'pending', message: 'Approving KARRAT...' })
    
    try {
      const totalPrice = BigInt(listing.priceWei) * BigInt(listing.amount)
      const fee = (totalPrice * 25n) / 1000n
      const totalNeeded = totalPrice + fee
      
      const allowance = await contracts.karrat.allowance(userAddress, contractAddresses.marketplace)
      if (allowance < totalNeeded) {
        const approveTx = await contracts.karrat.approve(contractAddresses.marketplace, ethers.MaxUint256)
        await approveTx.wait()
      }
      
      setTxModal({ show: true, status: 'pending', message: 'Purchasing...' })
      
      const tx = await contracts.marketplace.buyNFT(
        listing.nftContract,
        listing.tokenId,
        listing.amount,
        listing.priceWei,
        listing.deadline,
        listing.seller,
        listing.signature
      )
      await tx.wait()
      
      await removeListing(listing.id)
      const updatedListings = await getListings()
      setListings(updatedListings)
      
      setTxModal({ show: true, status: 'success', message: 'Purchase complete!' })
      
      await loadUserBalances()
      const kb = await contracts.karrat.balanceOf(userAddress)
      setKarratBalance(kb.toString())
      
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('Buy listing error:', err)
      setTxModal({ show: true, status: 'error', message: err.reason || err.message })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  // Buy from StudioChain marketplace (native ETH)
  const buyFromStudioChainListing = async (listing) => {
    const switched = await switchToStudioChain()
    if (!switched) {
      showToast('Please switch to StudioChain network', 'error')
      return
    }

    // Reinitialize signer for StudioChain
    const web3Provider = new ethers.BrowserProvider(window.ethereum)
    const web3Signer = await web3Provider.getSigner()
    
    if (!studioChainAddresses.marketplace) return
    
    setTxModal({ show: true, status: 'pending', message: 'Purchasing with ETH...' })
    
    try {
      const scMarketplace = new ethers.Contract(studioChainAddresses.marketplace, STUDIOCHAIN_MARKETPLACE_ABI, web3Signer)
      
      const totalPrice = BigInt(listing.priceWei) * BigInt(listing.amount)
      const fee = (totalPrice * 25n) / 1000n
      const totalNeeded = totalPrice + fee
      
      const tx = await scMarketplace.buyNFT(
        listing.nftContract,
        listing.tokenId,
        listing.amount,
        listing.priceWei,
        listing.deadline,
        listing.seller,
        listing.signature,
        { value: totalNeeded }
      )
      await tx.wait()
      
      await removeStudioChainListing(listing.id)
      const updatedListings = await getStudioChainListings()
      setStudioChainListings(updatedListings)
      
      setTxModal({ show: true, status: 'success', message: 'Purchase complete!' })
      
      await loadStudioChainBalances()
      
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('StudioChain buy listing error:', err)
      setTxModal({ show: true, status: 'error', message: err.reason || err.message })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  // Cancel listing (KARRAT marketplace)
  const cancelListing = async (listing) => {
    if (!contracts.marketplace) return
    
    setTxModal({ show: true, status: 'pending', message: 'Cancelling...' })
    
    try {
      const tx = await contracts.marketplace.delistToken(listing.nftContract, listing.tokenId)
      await tx.wait()
      
      await removeListing(listing.id)
      const updatedListings = await getListings()
      setListings(updatedListings)
      
      setTxModal({ show: true, status: 'success', message: 'Cancelled!' })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('Cancel error:', err)
      setTxModal({ show: true, status: 'error', message: err.reason || err.message })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  // Update listing (CRUD - UPDATE operation)
  const updateListingHandler = async (listingId, updates) => {
    await updateListing(listingId, updates)
    const updatedListings = await getListings()
    setListings(updatedListings)
    showToast('Listing updated!', 'success')
  }

  // Update StudioChain listing (CRUD - UPDATE operation)
  const updateStudioChainListingHandler = async (listingId, updates) => {
    await updateStudioChainListing(listingId, updates)
    const updatedListings = await getStudioChainListings()
    setStudioChainListings(updatedListings)
    showToast('Listing updated!', 'success')
  }

  // Cancel StudioChain listing
  const cancelStudioChainListing = async (listing) => {
    const switched = await switchToStudioChain()
    if (!switched) {
      showToast('Please switch to StudioChain network', 'error')
      return
    }

    // Reinitialize signer for StudioChain
    const web3Provider = new ethers.BrowserProvider(window.ethereum)
    const web3Signer = await web3Provider.getSigner()
    
    if (!studioChainAddresses.marketplace) return
    
    setTxModal({ show: true, status: 'pending', message: 'Cancelling...' })
    
    try {
      const scMarketplace = new ethers.Contract(studioChainAddresses.marketplace, STUDIOCHAIN_MARKETPLACE_ABI, web3Signer)
      
      const tx = await scMarketplace.delistToken(listing.nftContract, listing.tokenId)
      await tx.wait()
      
      await removeStudioChainListing(listing.id)
      const updatedListings = await getStudioChainListings()
      setStudioChainListings(updatedListings)
      
      setTxModal({ show: true, status: 'success', message: 'Cancelled!' })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('Cancel error:', err)
      setTxModal({ show: true, status: 'error', message: err.reason || err.message })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  // Add contract to tracking
  const addContractToTracking = async (contractAddress) => {
    if (!contracts.tracking) return
    
    setTxModal({ show: true, status: 'pending', message: 'Adding contract...' })
    
    try {
      const tx = await contracts.tracking.addNewContract(contractAddress)
      await tx.wait()
      
      const tracked = await contracts.tracking.getAllDeployedContracts()
      setTrackedContracts(tracked)
      
      setTxModal({ show: true, status: 'success', message: 'Contract added!' })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 2000)
      
    } catch (err) {
      console.error('Add contract error:', err)
      setTxModal({ show: true, status: 'error', message: err.reason || err.message })
      setTimeout(() => setTxModal({ show: false, status: '', message: '' }), 3000)
    }
  }

  const myListings = listings.filter(l => l.seller?.toLowerCase() === userAddress?.toLowerCase())

  return (
    <div className="app">
      <Header 
        userAddress={userAddress}
        ethBalance={ethBalance}
        karratBalance={karratBalance}
        onConnect={connectWallet}
        isAdmin={isAdmin}
      />
      
      <Navbar isAdmin={isAdmin} />
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={
            <PrimaryStorePage tiers={tiers} onBuy={buyPrimary} userAddress={userAddress} />
          } />
          
          <Route path="/studiochain" element={
            <StudioChainPage 
              tiers={studioChainTiers}
              listings={studioChainListings}
              balances={studioChainBalances}
              onBuyPrimary={buyStudioChain}
              onBuySecondary={buyFromStudioChainListing}
              onCreateListing={createStudioChainListing}
              onUpdateListing={updateStudioChainListingHandler}
              onCancelListing={cancelStudioChainListing}
              userAddress={userAddress}
            />
          } />
          
          <Route path="/marketplace" element={
            <MarketplacePage 
              listings={listings} 
              userAddress={userAddress} 
              onBuy={buyFromListing} 
              onCancel={cancelListing} 
            />
          } />
          
          <Route path="/inventory" element={
            <InventoryPage 
              tiers={tiers}
              balances={userBalances}
              userAddress={userAddress}
              onCreateListing={createListing}
              onUpdateListing={updateListingHandler}
              myListings={myListings}
              onCancelListing={cancelListing}
            />
          } />
          
          {isAdmin && (
            <Route path="/admin" element={
              <AdminPage 
                trackedContracts={trackedContracts}
                onAddContract={addContractToTracking}
                contractAddresses={contractAddresses}
                contracts={contracts}
              />
            } />
          )}
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {toast.show && <Toast message={toast.message} type={toast.type} />}
      {txModal.show && <TxModal status={txModal.status} message={txModal.message} />}
    </div>
  )
}

export default App