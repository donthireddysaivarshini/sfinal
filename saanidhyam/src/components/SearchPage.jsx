import React, { useState, useEffect } from 'react';
import { searchService } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { djangoService } from '../ticketing/services/djangoService';
import { CheckCircle, XCircle, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const navigate = useNavigate();
  const [selectedHomes, setSelectedHomes] = useState(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  
  // --- ADDED: State to manage the "Exported!" button UI ---
  const [isExported, setIsExported] = useState(false);

  // --- CHANGED: Increased homes per page from 12 to 25 ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25; 

  const [filters, setFilters] = useState({
    state: searchParams.get('state') || '',
    district: searchParams.get('district') || '',
    costing: searchParams.get('costing') || '',
    gender: searchParams.get('gender') || '',
    care_type: searchParams.get('care_type') || '',
    pincode: searchParams.get('pincode') || '',
    radius: searchParams.get('radius') || '10', 
    services_type: searchParams.get('services_type') || '', 
  });

  const debouncedSearchQuery = useDebounce(searchQuery, 150);

  useEffect(() => {
    if (searchParams.toString()) {
        handleSearch(true);
    }
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedSearchQuery.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const data = await searchService.autocomplete(debouncedSearchQuery);
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error('Autocomplete error:', error);
      }
    };
    fetchSuggestions();
  }, [debouncedSearchQuery]);

  const handleSearch = async (skipUrlUpdate = false, overrideQuery = null, overrideFilters = null) => {
    setLoading(true);
    setShowSuggestions(false);
    setSearchPerformed(true);
    setCurrentPage(1); 
    
    const activeQuery = overrideQuery !== null ? overrideQuery : searchQuery;
    const activeFilters = overrideFilters !== null ? overrideFilters : filters;
    const safeRadius = parseInt(activeFilters.radius) || 10;

    if (!skipUrlUpdate) {
        const params = { q: activeQuery, ...activeFilters, radius: safeRadius.toString() };
        Object.keys(params).forEach(key => !params[key] && delete params[key]);
        setSearchParams(params);
    }
    
    try {
      let data;
      
      if (activeFilters.pincode) {
        const nearbyParams = {
          q: activeQuery, 
          pincode: activeFilters.pincode,
          radius: safeRadius,
        };
        
        if (activeFilters.services_type) nearbyParams.services_type = activeFilters.services_type;
        if (activeFilters.costing) nearbyParams.costing = activeFilters.costing;
        if (activeFilters.gender) nearbyParams.gender = activeFilters.gender;
        if (activeFilters.care_type) nearbyParams.care_type = activeFilters.care_type;
        
        data = await searchService.nearby(nearbyParams);
        setResults(Array.isArray(data.results) ? data.results : []);
      } else {
        data = await searchService.search({
          q: activeQuery,
          ...activeFilters,
        });
        setResults(data.results ? data.results : (Array.isArray(data) ? data : []));
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    let newQuery = searchQuery;
    let newFilters = { ...filters };

    if (suggestion.type === 'facility') {
      newQuery = suggestion.name;
      setSearchQuery(suggestion.name);
    } else if (suggestion.type === 'pincode') {
      const cleanPincode = suggestion.name.replace('Pincode ', '');
      newFilters = { ...newFilters, pincode: cleanPincode };
      setFilters(newFilters);
    } else {
      newQuery = suggestion.name;
      setSearchQuery(suggestion.name);
    }
    setShowSuggestions(false);
    handleSearch(false, newQuery, newFilters);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      handleSearch();
    }
  };

  const toggleHomeSelection = (homeId) => {
    const newSelected = new Set(selectedHomes);
    if (newSelected.has(homeId)) {
      newSelected.delete(homeId);
    } else {
      newSelected.add(homeId);
    }
    setSelectedHomes(newSelected);
  };

  const hasActiveFilters = filters.pincode || filters.costing || filters.gender || filters.care_type || filters.services_type;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentResults = results.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(results.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white py-12" style={{ backgroundColor: '#5D6F47' }}>
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8 text-center text-white">Search Old Age Homes</h1>
          
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyPress={handleKeyPress}
                placeholder="Search by name, city, district, or pincode..."
                className="w-full px-4 py-3 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm"
              />
              
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{suggestion.name}</div>
                          <div className="text-sm mt-1 text-gray-600">{suggestion.location}</div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          suggestion.type === 'facility' ? 'bg-green-600 text-white' :
                          suggestion.type === 'location' ? 'bg-yellow-400 text-black' :
                          'bg-blue-500 text-white'
                        }`}>
                          {suggestion.type}
                          {suggestion.count && ` (${suggestion.count})`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="px-6 py-3 rounded-lg font-bold text-black transition-all shadow-sm hover:shadow-md disabled:opacity-50"
              style={{ backgroundColor: '#EDC750' }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 sticky top-16 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={() => {
                    const cleanFilters = { 
                      state: '', district: '', costing: '', gender: '', 
                      care_type: '', pincode: '', radius: '10', services_type: '' 
                    };
                    setFilters(cleanFilters);
                    setSearchParams({ q: searchQuery });
                    handleSearch(false, searchQuery, cleanFilters);
                }}
                className="text-sm font-medium"
                style={{ color: '#5D6F47' }}
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Pincode</label>
              <input
                type="text"
                value={filters.pincode}
                onChange={(e) => setFilters({...filters, pincode: e.target.value})}
                placeholder="500008"
                maxLength="6"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {filters.pincode && (
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Radius (km)</label>
                <input
                  type="number"
                  min="1"
                  value={filters.radius}
                  onChange={(e) => setFilters({...filters, radius: e.target.value})}
                  placeholder="10"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Costing</label>
              <select
                value={filters.costing}
                onChange={(e) => setFilters({...filters, costing: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="free">Free</option>
                <option value="pay">Pay</option>
                <option value="pay_stay">Pay & Stay</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Gender</label>
              <select
                value={filters.gender}
                onChange={(e) => setFilters({...filters, gender: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="both">Both</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Care Type</label>
              <select
                value={filters.care_type}
                onChange={(e) => setFilters({...filters, care_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="basic">Basic</option>
                <option value="nursing">Nursing</option>
                <option value="day">Day Care</option>
                <option value="residential">Residential</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Service Type</label>
              <select
                value={filters.services_type}
                onChange={(e) => setFilters({...filters, services_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="Aasara Day Care Centers">Aasara Day Care Centers</option>
                <option value="Day Care Centers">Day Care Centers</option>
                <option value="Palliative Care">Palliative Care</option>
                <option value="Elder Care / Home Care">Elder Care / Home Care</option>
                <option value="Old Age Home">Old Age Home</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {searchPerformed && results.length > 0 && (
          <div className="mb-6 flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-800">
              Found <span style={{ color: '#5D6F47' }}>{results.length}</span> homes
              {selectedHomes.size > 0 && (
                <span className="ml-4 text-sm font-normal text-gray-600">
                  Selected: {selectedHomes.size}
                </span>
              )}
            </span>
            
            {/* --- CHANGED: Updated buttons to show Exported UI state --- */}
            {selectedHomes.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedHomes(new Set())}
                  disabled={isExported}
                  className="px-4 py-2 rounded-lg font-semibold text-gray-600 border border-gray-300 hover:bg-gray-100 transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Clear Selection
                </button>

                <button
                  onClick={() => setShowExportModal(true)}
                  disabled={isExported}
                  className={`px-6 py-2 rounded-lg font-semibold text-white transition-all shadow-sm flex items-center justify-center disabled:opacity-90 ${
                    isExported ? 'bg-green-600' : 'hover:shadow-md'
                  }`}
                  style={isExported ? { backgroundColor: '#16a34a' } : { backgroundColor: '#5D6F47' }}
                >
                  {isExported ? (
                    <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Exported!</span>
                  ) : (
                    `Export (${selectedHomes.size})`
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {results.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentResults.map((home) => (
                <div key={home.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="absolute top-4 right-4">
                    <input
                      type="checkbox"
                      checked={selectedHomes.has(home.id)}
                      onChange={() => toggleHomeSelection(home.id)}
                      className="w-5 h-5 cursor-pointer rounded"
                    />
                  </div>

                  <h3 className="text-lg font-bold mb-3 text-gray-800 pr-8">
                    {home.organisation_name}
                  </h3>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <p className="text-gray-600">
                      <span className="font-semibold">Location:</span>{' '}
                      {home.city_town_mandal && `${home.city_town_mandal}, `}
                      {home.district}, {home.state}
                    </p>
                    
                    {home.distance_km && (
                      <div className="inline-block px-3 py-1 rounded font-semibold text-sm" style={{ backgroundColor: '#EDC750' }}>
                        {home.distance_km.toFixed(2)} km away
                      </div>
                    )}
                    
                    {home.costing_type && (
                      <p className="text-gray-600">
                        <span className="font-semibold">Cost:</span>{' '}
                        <span className="capitalize">{home.costing_type.replace('_', ' & ')}</span>
                      </p>
                    )}
                    
                    {home.contact_number && home.contact_number.length > 0 && (
                      <p className="text-gray-600">
                        <span className="font-semibold">Phone:</span>{' '}
                        {home.contact_number.slice(0, 2).join(', ')}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => navigate(`/home/${home.id}`)}
                    className="w-full py-2 rounded-lg font-semibold text-white transition-all text-sm"
                    style={{ backgroundColor: '#5D6F47' }}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center mt-10 gap-6">
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.max(prev - 1, 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                
                <span className="text-gray-600 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.min(prev + 1, totalPages));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : searchPerformed && !loading && (
          <div className="text-center py-20">
            <p className="text-xl mb-6 text-gray-600">No results found</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilters({ state: '', district: '', costing: '', gender: '', care_type: '', pincode: '', radius: '10', services_type: '' });
                setResults([]);
                setSearchPerformed(false);
                setSearchParams({});
              }}
              className="px-6 py-3 rounded-lg font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={{ backgroundColor: '#5D6F47' }}
            >
              Reset Search
            </button>
          </div>
        )}
      </div>

      {/* --- CHANGED: Updated onSuccess to manage Exported UI State --- */}
      {showExportModal && (
        <ExportModal
          homes={results.filter(h => selectedHomes.has(h.id))}
          onClose={() => setShowExportModal(false)}
          onSuccess={() => {
            setShowExportModal(false);
            setIsExported(true); // Changes the button to green "Exported!"
            
            // Wait 2.5 seconds, then clear selection to hide buttons
            setTimeout(() => {
              setIsExported(false);
              setSelectedHomes(new Set()); 
            }, 2500);
          }}
        />
      )}
    </div>
  );
};


const ExportModal = ({ homes, onClose, onSuccess }) => {
  const [selectedFields, setSelectedFields] = useState({
    name: true, location: true, address: true, contact: true, email: true, website: true, services: true, pricing: true, notes: true,
  });

  const [ticketId, setTicketId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [availableTickets, setAvailableTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
        try {
            const response = await djangoService.getTickets(1);
            let tickets = [];
            
            if (response && Array.isArray(response.results)) {
                tickets = response.results;
            } else if (Array.isArray(response)) {
                tickets = response;
            }

            const excludedStatuses = ['SENT_TO_CLIENT', 'FOLLOW_UP', 'CLOSED'];
            const filteredTickets = tickets.filter(ticket => !excludedStatuses.includes(ticket.status));

            setAvailableTickets(filteredTickets);
        } catch (e) {
            console.error("Error fetching tickets for dropdown", e);
        } finally {
            setLoadingTickets(false);
        }
    };
    fetchTickets();
  }, []);

  const toggleField = (field) => {
    setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleExport = async () => {
    if (!ticketId) {
        setError("Please select a Ticket ID.");
        return;
    }

    setExporting(true);
    setError(null);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL;
      const token = localStorage.getItem("access_token");

      if (!token) throw new Error("You are not logged in.");

      const cleanBaseUrl = apiBaseUrl.replace(/\/$/, "");

      const response = await fetch(`${cleanBaseUrl}/api/export/pdf/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          homes: homes,
          fields: selectedFields,
          ticketId: ticketId, 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Export failed" }));
        throw new Error(errorData.error || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `satoru-homes-ticket-${ticketId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      if (onSuccess) {
          onSuccess();
      } else {
          onClose();
      }

    } catch (err) {
      console.error("Export error:", err);
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Export Settings</h2>
        <p className="text-sm text-gray-600 mb-4">Select which information to include ({homes.length} homes)</p>

        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
                Select Ticket <span className="text-red-500">*</span>
            </label>
            <select 
                value={ticketId} 
                onChange={(e) => setTicketId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loadingTickets}
            >
                <option value="">-- Select a Ticket --</option>
                {availableTickets.map(ticket => (
                    <option key={ticket.id} value={ticket.id}>
                        {ticket.id} - {ticket.clientName} ({ticket.status.replace(/_/g, ' ')})
                    </option>
                ))}
            </select>
            {loadingTickets && <p className="text-xs text-gray-500 mt-1">Loading tickets...</p>}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
          {[
            { key: "name", label: "Organization Name" },
            { key: "location", label: "Location" },
            { key: "address", label: "Full Address" },
            { key: "contact", label: "Contact Numbers" },
            { key: "email", label: "Email" },
            { key: "website", label: "Website" },
            { key: "services", label: "Services" },
            { key: "pricing", label: "Pricing" },
            { key: "notes", label: "Notes" },
          ].map(field => (
            <label key={field.key} className="flex items-center gap-3">
              <input type="checkbox" checked={selectedFields[field.key]} onChange={() => toggleField(field.key)} />
              <span>{field.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border px-4 py-2 rounded-lg">Cancel</button>
          <button
            onClick={handleExport}
            disabled={exporting || !ticketId}
            className={`flex-1 px-4 py-2 rounded-lg text-white flex justify-center gap-2 ${
                ticketId ? 'bg-green-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {exporting && <Loader2 className="w-4 h-4 animate-spin" />}
            {exporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;