import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, X, Phone, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
// Import services
import { djangoService as supabaseService } from '../services/djangoService';
import { searchService } from '../../services/api'; 

import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { CLIENT_CONDITIONS, SERVICE_TYPES } from '../constants';
import type { Ticket } from '../types';

// ==========================================
// STATIC DATA
// ==========================================

const STATES = ["Telangana", "Andhra Pradesh"];
const COUNTRIES = ["India", "USA", "UK", "Australia", "UAE", "Canada", "Singapore"];

// ==========================================
// 1. TEAMMATE'S MODAL COMPONENT (Preserved)
// ==========================================

interface NearbyHome {
  id: number;
  organisation_name: string;
  state: string;
  district: string;
  city_town_mandal: string;
  address: string;
  pincode: string;
  contact_number: string[];
  email: string[];
  website: string[];
  costing_type: string;
  gender?: string;
  care_type?: string;
  services_type: string;
  monthly_charges_minimum?: number;
  monthly_charges_maximum?: number;
  distance_km: number;
}

interface HomesSelectionModalProps {
  homes: NearbyHome[];
  onClose: () => void;
  onExport: (selectedHomes: NearbyHome[]) => Promise<void>;
}

const HomesSelectionModal: React.FC<HomesSelectionModalProps> = ({ homes, onClose, onExport }) => {
  const [selectedHomes, setSelectedHomes] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleHome = (homeId: number) => {
    setSelectedHomes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(homeId)) newSet.delete(homeId);
      else newSet.add(homeId);
      return newSet;
    });
  };

  const selectAll = () => setSelectedHomes(new Set(homes.map(h => h.id)));
  const deselectAll = () => setSelectedHomes(new Set());

  const handleExport = async () => {
    if (selectedHomes.size === 0) {
      setError('Please select at least one home to export.');
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const homesToExport = homes.filter(h => selectedHomes.has(h.id));
      await onExport(homesToExport);
    } catch (err: any) {
      setError(err.message || 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Select Old Age Homes</h2>
            <p className="text-sm text-slate-500 mt-1">Found {homes.length} homes. Select to export PDF.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        
        {/* Selection Controls */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">{selectedHomes.size} selected</span>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-sm px-3 py-1 text-satoru-green hover:bg-satoru-green/10 rounded-lg">Select All</button>
            <button onClick={deselectAll} className="text-sm px-3 py-1 text-slate-600 hover:bg-slate-200 rounded-lg">Deselect All</button>
          </div>
        </div>

        {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        {/* Homes List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {homes.map((home) => {
            const isSelected = selectedHomes.has(home.id);
            return (
              <div key={home.id} onClick={() => toggleHome(home.id)} className={`border rounded-xl p-4 cursor-pointer transition-all ${isSelected ? 'border-satoru-green bg-satoru-green/5 ring-2 ring-satoru-green/20' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-start gap-4">
                  <div className="mt-1">{isSelected ? <CheckCircle2 className="h-5 w-5 text-satoru-green" /> : <Circle className="h-5 w-5 text-slate-300" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-semibold text-slate-900 text-lg">{home.organisation_name}</h3>
                      <span className="text-xs font-medium text-satoru-green bg-satoru-green/10 px-2 py-1 rounded">{home.distance_km} km away</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">{[home.city_town_mandal, home.district].filter(Boolean).join(', ')}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {home.costing_type && <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-700">{home.costing_type.replace('_', ' ')}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={exporting}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting || selectedHomes.size === 0} isLoading={exporting} className="bg-satoru-green hover:bg-[#4a5838]">Export PDF & Create Ticket</Button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. MAIN CREATE TICKET COMPONENT
// ==========================================

export const CreateTicket: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [manualLoading, setManualLoading] = useState(false); 
  const [searchLoading, setSearchLoading] = useState(false); 
  
  const [showModal, setShowModal] = useState(false);
  const [foundHomes, setFoundHomes] = useState<NearbyHome[]>([]);
  const [countryCode, setCountryCode] = useState('+91');

  const [formData, setFormData] = useState<Partial<Ticket>>({
    clientName: '', phone: '', email: '', age: '' as any,
    country: 'India', state: '', district: '', city: '', pincode: '',
    budgetMin: '', budgetMax: '',
    preferredLocation1: '', preferredLocation2: '', preferredLocation3: '',
    clientCondition: '', clientConditionDetails: '',
    serviceTypes: [], notes: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 10) setFormData(prev => ({ ...prev, phone: value }));
  };

  const handleServiceTypeChange = (service: string) => {
    setFormData(prev => {
      const current = prev.serviceTypes || [];
      return current.includes(service) 
        ? { ...prev, serviceTypes: current.filter(s => s !== service) }
        : { ...prev, serviceTypes: [...current, service] };
    });
  };

  const validateForm = (): boolean => {
    if (!formData.clientName || !formData.phone) { alert("Name and Phone required."); return false; }
    if (formData.phone.length !== 10) { alert("Phone number must be exactly 10 digits."); return false; }
    if (!formData.clientCondition) { alert("Select a Client Condition."); return false; }
    
    // --- UPDATED: Country, State, District, City are MANDATORY ---
    if (!formData.country || !formData.state || !formData.district || !formData.city) { 
        alert("Country, State, District, and City are required."); 
        return false; 
    }
    
    if (!formData.preferredLocation1 || !formData.preferredLocation2 || !formData.preferredLocation3) {
        alert("All 3 Preferred Locations are required.");
        return false;
    }

    if (!formData.pincode || formData.pincode.length !== 6) {
  alert("Pincode is required and must be 6 digits.");
  return false;
}
   if (!formData.serviceTypes || formData.serviceTypes.length === 0) {
  alert("Please select at least one Service Type");
  setSearchLoading(false);
  return;
}


  return true;
  };

  const executeCreateTicket = async () => {
    if (!user) throw new Error("User not logged in");
    
    const newTicket = await supabaseService.createTicket(
      {
        ...formData,
        countryCode: countryCode, 
      },
      user
    );
    return newTicket;
  };

  const handleManualSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setManualLoading(true); 
    try {
      const ticket = await executeCreateTicket();
      navigate(`/tickets/${ticket.id}`);
    } catch (error: any) {
      alert("Error creating ticket: " + error.message);
    } finally {
      setManualLoading(false);
    }
  };

  const handleSearchSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    

    setSearchLoading(true); 
    try {
      const params: any = {
        pincode: formData.pincode,
        radius: 50,
        services_type: formData.serviceTypes?.join(',')
      };

      const response = await searchService.nearby(params);
      
      if (response.results && Array.isArray(response.results) && response.results.length > 0) {
        setFoundHomes(response.results);
        setShowModal(true); 
        setSearchLoading(false); 
      } else {
        if(confirm("No nearby homes found matching criteria. Create ticket without export?")) {
            const ticket = await executeCreateTicket();
            navigate(`/tickets/${ticket.id}`);
        } else {
            setSearchLoading(false);
        }
      }
    } catch (error: any) {
      console.error('Error searching homes:', error);
      alert("Search error: " + error.message);
      setSearchLoading(false);
    }
  };

  const handleExportAndCreate = async (selectedHomes: NearbyHome[]) => {
    try {
        setSearchLoading(true); // Show loading while creating ticket

        // 1. Create Ticket FIRST to get ID
        const ticket = await executeCreateTicket();

        const apiBaseUrl = (import.meta as any).env?.VITE_API_URL;
        const token = localStorage.getItem('access_token');
        
        // 2. Send ticketID to PDF Generator
        const response = await fetch(`${apiBaseUrl}/api/export/pdf/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            homes: selectedHomes,
            fields: { name: true, location: true, address: true, contact: true, email: true, website: true, services: true, pricing: true, notes: true },
            ticketId: ticket.id, 
          }),
        });
    
        if (!response.ok) throw new Error(`Export failed: ${response.status}`);
    
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Include ticket ID in filename
        a.download = `satoru-homes-ticket-${ticket.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setShowModal(false);
        
        // 3. Navigate after export
        navigate(`/tickets/${ticket.id}`);

    } catch (error: any) {
        setSearchLoading(false);
        alert("Error during processing: " + error.message);
        throw error;
    }
  };

  const inputClass = "w-full bg-white border border-slate-900 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-satoru-green/20 focus:border-satoru-green outline-none placeholder-slate-400";
  const labelClass = "block text-xs font-bold text-black uppercase tracking-wider mb-2 ml-1";
  const cardBorderClass = "border-2 border-slate-900 shadow-md";

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Create New Ticket</h1>
        <p className="text-slate-600">Manually log a new client inquiry.</p>
      </div>

      <form className="space-y-6" noValidate>

        <Card title="Client Information" className={cardBorderClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group w-full">
              <label className={labelClass}>Client Full Name *</label>
              <Input name="clientName" value={formData.clientName} onChange={handleInputChange}  className={inputClass} />
            </div>

            <div className="group w-full">
              <label className={labelClass}>Phone Number *</label>
              <div className="flex gap-2">
                <input 
                    list="country-codes" 
                    value={countryCode} 
                    onChange={(e) => setCountryCode(e.target.value)} 
                    className="bg-white border border-slate-900 rounded-xl px-3 py-3 text-slate-900 outline-none focus:border-satoru-green w-32 font-mono"
                    placeholder="+91"
                />
                <datalist id="country-codes">
                    <option value="+91">India</option>
                    <option value="+1">USA</option>
                    <option value="+44">UK</option>
                    <option value="+61">Australia</option>
                    <option value="+971">UAE</option>
                </datalist>
                
                <input type="tel" name="phone" value={formData.phone} onChange={handlePhoneChange} placeholder="10-digit number" className={inputClass} />
              </div>
            </div>

            <div className="group w-full">
    <label className={labelClass}>Age</label>
    <Input 
        type="number" 
        name="age" 
        // Ensure value is never undefined
        value={formData.age ?? ''} 
        onChange={(e) => Number(e.target.value) <= 100 && handleInputChange(e)} 
        max={100} 
        className={inputClass} 
    />
</div>
            <div className="group w-full"><label className={labelClass}>Email Address</label><Input type="email" name="email" value={formData.email} onChange={handleInputChange} className={inputClass} /></div>
            
            <div className="group w-full md:col-span-2">
              <label className={labelClass}>Client Health Condition *</label>
              <div className="relative">
                <select name="clientCondition" value={formData.clientCondition} onChange={handleInputChange} className={inputClass}>
                  <option value="" disabled>Select Condition</option>
                  {CLIENT_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500"><ChevronRight className="h-4 w-4 rotate-90" /></div>
              </div>
              {formData.clientCondition === 'Other' && (
                <input type="text" name="clientConditionDetails" placeholder="Please specify condition..." value={formData.clientConditionDetails} onChange={handleInputChange} className={`mt-3 ${inputClass}`} />
              )}
            </div>
          </div>
        </Card>

        {/* --- MODIFIED: LOCATION SECTION (Removed Pincode) --- */}
        <Card title="Location & Logistics" className={cardBorderClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Country Field */}
            <div className="group w-full">
                <label className={labelClass}>Country *</label>
                <input 
                    name="country" 
                    value={formData.country} 
                    onChange={handleInputChange} 
                    list="countries-list"
                    
                    className={inputClass}
                    placeholder="Select or type country"
                />
                <datalist id="countries-list">
                    {COUNTRIES.map(c => <option key={c} value={c} />)}
                </datalist>
            </div>

            {/* State Field */}
            <div className="group w-full">
                <label className={labelClass}>State *</label>
                <input 
                    name="state" 
                    value={formData.state} 
                    onChange={handleInputChange} 
                    list="states-list"
                    
                    className={inputClass}
                    placeholder="Select or type state"
                />
                {/* Only show state suggestions if Country is India */}
                {formData.country === 'India' && (
                    <datalist id="states-list">
                        {STATES.map(s => <option key={s} value={s} />)}
                    </datalist>
                )}
            </div>
            
            {/* District */}
            <div className="group w-full">
                <label className={labelClass}>District *</label>
                <Input
                  name="district" 
                  value={formData.district || ''} 
                  onChange={handleInputChange} 
                  
                  className={inputClass}
                />
            </div>

            {/* City */}
            <div className="group w-full">
                <label className={labelClass}>City / Town *</label>
                <Input
                  name="city" 
                  value={formData.city || ''} 
                  onChange={handleInputChange} 
                  
                  className={inputClass}
                />
            </div>
            {/* Pincode Removed from here */}
          </div>
        </Card>

        {/* --- MODIFIED: REQUIREMENTS (Added Pincode here) --- */}
        <Card title="Requirements" className={cardBorderClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* --- MOVED: Pincode is now here --- */}
            <div className="group w-full">
                <label className={labelClass}>Pincode *</label>
                <Input name="pincode"
                value={formData.pincode || ''}
                onChange={handleInputChange}
                
                className={inputClass}
                />
            </div>

            {/* Spacer for layout balance */}
            <div className="hidden md:block"></div>

            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div className="group w-full"><label className={labelClass}>Budget Min (₹)</label><Input name="budgetMin" value={formData.budgetMin} onChange={handleInputChange} placeholder="e.g. 10000" className={inputClass} /></div>
              <div className="group w-full"><label className={labelClass}>Budget Max (₹)</label><Input name="budgetMax" value={formData.budgetMax} onChange={handleInputChange} placeholder="e.g. 50000" className={inputClass} /></div>
            </div>
            
            <div className="md:col-span-2 space-y-4">
              <div className="group w-full">
                  <label className={labelClass}>Preferred Location 1 *</label>
                  <Input name="preferredLocation1" value={formData.preferredLocation1} onChange={handleInputChange} className={inputClass} />
              </div>
              <div className="group w-full">
                  <label className={labelClass}>Preferred Location 2 *</label>
                  <Input name="preferredLocation2" value={formData.preferredLocation2} onChange={handleInputChange}className={inputClass} />
              </div>
              <div className="group w-full">
                  <label className={labelClass}>Preferred Location 3 *</label>
                  <Input name="preferredLocation3" value={formData.preferredLocation3} onChange={handleInputChange} className={inputClass} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Service Providers Type" className={cardBorderClass}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SERVICE_TYPES.map(service => (
              <label key={service} className={`cursor-pointer border rounded-xl p-4 flex items-center justify-center text-center transition-all h-24 text-sm font-bold ${formData.serviceTypes?.includes(service) ? 'bg-satoru-green border-satoru-green text-white shadow-md ring-2 ring-offset-1 ring-satoru-green' : 'bg-white border-slate-900 text-black hover:bg-slate-50'}`}>
                <input type="checkbox" className="hidden" checked={formData.serviceTypes?.includes(service) || false} onChange={() => handleServiceTypeChange(service)} />
                {service}
              </label>
            ))}
          </div>
        </Card>

        <Card title="Additional Notes" className={cardBorderClass}>
          <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={4} className={inputClass} placeholder="Enter details..."></textarea>
        </Card>

        <div className="flex justify-end pt-4 gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="button" onClick={handleManualSubmit} size="lg" isLoading={manualLoading} className="bg-white border border-satoru-green text-satoru-green hover:bg-slate-50">Create Ticket</Button>
          <Button type="button" onClick={handleSearchSubmit} size="lg" isLoading={searchLoading} className="bg-satoru-green hover:bg-[#4a5838] shadow-lg shadow-satoru-green/20">{searchLoading ? 'Processing...' : 'Search & Create Ticket'}</Button>
        </div>
      
      </form>

      {showModal && <HomesSelectionModal homes={foundHomes} onClose={() => setShowModal(false)} onExport={handleExportAndCreate} />}
    </div>
  );
};