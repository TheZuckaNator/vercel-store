/**
 * MPH NFT Marketplace - Storage Utility
 * Uses remote JSON server API with localStorage fallback
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ============================================
// KARRAT LISTINGS (Main Chain)
// ============================================

export const getListings = async () => {
  try {
    const res = await fetch(`${API_URL}/listings`)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return getListingsLocal()
  }
}

export const addListing = async (listing) => {
  const newListing = {
    ...listing,
    id: Date.now(),
    createdAt: Date.now()
  }
  
  try {
    const res = await fetch(`${API_URL}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newListing)
    })
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return addListingLocal(newListing)
  }
}

export const updateListing = async (listingId, updates) => {
  try {
    const res = await fetch(`${API_URL}/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return updateListingLocal(listingId, updates)
  }
}

export const removeListing = async (listingId) => {
  try {
    const res = await fetch(`${API_URL}/listings/${listingId}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('API error')
    return true
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return removeListingLocal(listingId)
  }
}

export const getListingById = async (listingId) => {
  try {
    const res = await fetch(`${API_URL}/listings/${listingId}`)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return getListingByIdLocal(listingId)
  }
}

export const getListingsBySeller = async (sellerAddress) => {
  try {
    const res = await fetch(`${API_URL}/listings?seller=${sellerAddress.toLowerCase()}`)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return getListingsBySellerLocal(sellerAddress)
  }
}

// ============================================
// STUDIOCHAIN LISTINGS (Native ETH)
// ============================================

export const getStudioChainListings = async () => {
  try {
    const res = await fetch(`${API_URL}/studiochain_listings`)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return getStudioChainListingsLocal()
  }
}

export const addStudioChainListing = async (listing) => {
  const newListing = {
    ...listing,
    id: Date.now(),
    createdAt: Date.now()
  }
  
  try {
    const res = await fetch(`${API_URL}/studiochain_listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newListing)
    })
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return addStudioChainListingLocal(newListing)
  }
}

export const updateStudioChainListing = async (listingId, updates) => {
  try {
    const res = await fetch(`${API_URL}/studiochain_listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return updateStudioChainListingLocal(listingId, updates)
  }
}

export const removeStudioChainListing = async (listingId) => {
  try {
    const res = await fetch(`${API_URL}/studiochain_listings/${listingId}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('API error')
    return true
  } catch (err) {
    console.warn('API unavailable, using localStorage:', err.message)
    return removeStudioChainListingLocal(listingId)
  }
}

// ============================================
// SIGNATURES & TRANSACTIONS LOGGING
// ============================================

export const saveSignature = async (sigData) => {
  try {
    const res = await fetch(`${API_URL}/signatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sigData, id: Date.now(), timestamp: Date.now() })
    })
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('Signature logging failed:', err.message)
    return null
  }
}

export const saveTransaction = async (tx) => {
  try {
    const res = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...tx, id: Date.now(), timestamp: Date.now() })
    })
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (err) {
    console.warn('Transaction logging failed:', err.message)
    return null
  }
}

// ============================================
// LOCAL STORAGE FALLBACK
// ============================================

const LISTINGS_KEY = 'mph_listings'
const STUDIOCHAIN_KEY = 'mph_studiochain_listings'

const getListingsLocal = () => {
  const data = localStorage.getItem(LISTINGS_KEY)
  return data ? JSON.parse(data) : []
}

const addListingLocal = (listing) => {
  const listings = getListingsLocal()
  listings.push(listing)
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings))
  return listing
}

const updateListingLocal = (listingId, updates) => {
  const listings = getListingsLocal()
  const index = listings.findIndex(l => l.id === listingId)
  if (index !== -1) {
    listings[index] = { ...listings[index], ...updates }
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings))
    return listings[index]
  }
  return null
}

const removeListingLocal = (listingId) => {
  const listings = getListingsLocal()
  const filtered = listings.filter(l => l.id !== listingId)
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(filtered))
  return true
}

const getListingByIdLocal = (listingId) => {
  const listings = getListingsLocal()
  return listings.find(l => l.id === listingId) || null
}

const getListingsBySellerLocal = (sellerAddress) => {
  const listings = getListingsLocal()
  return listings.filter(l => l.seller?.toLowerCase() === sellerAddress.toLowerCase())
}

const getStudioChainListingsLocal = () => {
  const data = localStorage.getItem(STUDIOCHAIN_KEY)
  return data ? JSON.parse(data) : []
}

const addStudioChainListingLocal = (listing) => {
  const listings = getStudioChainListingsLocal()
  listings.push(listing)
  localStorage.setItem(STUDIOCHAIN_KEY, JSON.stringify(listings))
  return listing
}

const updateStudioChainListingLocal = (listingId, updates) => {
  const listings = getStudioChainListingsLocal()
  const index = listings.findIndex(l => l.id === listingId)
  if (index !== -1) {
    listings[index] = { ...listings[index], ...updates }
    localStorage.setItem(STUDIOCHAIN_KEY, JSON.stringify(listings))
    return listings[index]
  }
  return null
}

const removeStudioChainListingLocal = (listingId) => {
  const listings = getStudioChainListingsLocal()
  const filtered = listings.filter(l => l.id !== listingId)
  localStorage.setItem(STUDIOCHAIN_KEY, JSON.stringify(filtered))
  return true
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const formatAddress = (addr) => {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export const formatKarrat = (wei) => {
  const karrat = parseFloat(wei) / 1e18
  return karrat.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export const formatETH = (wei) => {
  const eth = parseFloat(wei) / 1e18
  return eth.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

export const clearAllData = () => {
  localStorage.removeItem(LISTINGS_KEY)
  localStorage.removeItem(STUDIOCHAIN_KEY)
}