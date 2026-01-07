// ============================================
// CRUD Operations for Listings (localStorage)
// ============================================

// Main chain listings (KARRAT)
export function getListings() {
  try {
    return JSON.parse(localStorage.getItem('mph_listings') || '[]')
  } catch {
    return []
  }
}

export function addListing(listing) {
  const listings = getListings()
  const newListing = { ...listing, id: Date.now(), createdAt: Date.now() }
  listings.push(newListing)
  localStorage.setItem('mph_listings', JSON.stringify(listings))
  return newListing
}

export function updateListing(listingId, updates) {
  const listings = getListings()
  const index = listings.findIndex(l => l.id === listingId)
  if (index !== -1) {
    listings[index] = { ...listings[index], ...updates, updatedAt: Date.now() }
    localStorage.setItem('mph_listings', JSON.stringify(listings))
    return listings[index]
  }
  return null
}

export function removeListing(listingId) {
  const listings = getListings().filter(l => l.id !== listingId)
  localStorage.setItem('mph_listings', JSON.stringify(listings))
}

export function getListingById(listingId) {
  const listings = getListings()
  return listings.find(l => l.id === listingId) || null
}

export function getListingsBySeller(sellerAddress) {
  const listings = getListings()
  return listings.filter(l => l.seller?.toLowerCase() === sellerAddress?.toLowerCase())
}

// StudioChain listings (native ETH)
export function getStudioChainListings() {
  try {
    return JSON.parse(localStorage.getItem('mph_studiochain_listings') || '[]')
  } catch {
    return []
  }
}

export function addStudioChainListing(listing) {
  const listings = getStudioChainListings()
  const newListing = { ...listing, id: Date.now(), createdAt: Date.now() }
  listings.push(newListing)
  localStorage.setItem('mph_studiochain_listings', JSON.stringify(listings))
  return newListing
}

export function updateStudioChainListing(listingId, updates) {
  const listings = getStudioChainListings()
  const index = listings.findIndex(l => l.id === listingId)
  if (index !== -1) {
    listings[index] = { ...listings[index], ...updates, updatedAt: Date.now() }
    localStorage.setItem('mph_studiochain_listings', JSON.stringify(listings))
    return listings[index]
  }
  return null
}

export function removeStudioChainListing(listingId) {
  const listings = getStudioChainListings().filter(l => l.id !== listingId)
  localStorage.setItem('mph_studiochain_listings', JSON.stringify(listings))
}

// Signatures log
export function saveSignature(sigData) {
  const sigs = JSON.parse(localStorage.getItem('mph_signatures') || '[]')
  sigs.unshift({ ...sigData, timestamp: Date.now() })
  localStorage.setItem('mph_signatures', JSON.stringify(sigs.slice(0, 100)))
}

export function getSignatures() {
  try {
    return JSON.parse(localStorage.getItem('mph_signatures') || '[]')
  } catch {
    return []
  }
}

// Transactions log
export function saveTransaction(tx) {
  const txs = JSON.parse(localStorage.getItem('mph_transactions') || '[]')
  txs.unshift({ ...tx, timestamp: Date.now() })
  localStorage.setItem('mph_transactions', JSON.stringify(txs.slice(0, 100)))
}

export function getTransactions() {
  try {
    return JSON.parse(localStorage.getItem('mph_transactions') || '[]')
  } catch {
    return []
  }
}

// Format helpers
export function formatAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatKarrat(wei) {
  const num = parseFloat(wei) / 1e18
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatETH(wei) {
  const num = parseFloat(wei) / 1e18
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

// Clear all data (for testing)
export function clearAllData() {
  localStorage.removeItem('mph_listings')
  localStorage.removeItem('mph_studiochain_listings')
  localStorage.removeItem('mph_signatures')
  localStorage.removeItem('mph_transactions')
}
