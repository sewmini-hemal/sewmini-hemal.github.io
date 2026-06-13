import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Guest, Table } from '../types';
import { Search, Users, X, MapPin, Quote, Flower } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FloorPlan from './FloorPlan';
import { cn } from '../lib/utils';

export default function GuestSearch() {
  const [search, setSearch] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<Record<string, Table>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [highlightedGuest, setHighlightedGuest] = useState<Guest | null>(null);

  useEffect(() => {
    const unsubGuests = onSnapshot(collection(db, 'guests'), 
      (snapshot) => {
        setGuests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'guests')
    );

    const unsubTables = onSnapshot(collection(db, 'tables'), 
      (snapshot) => {
        const tableData: Record<string, Table> = {};
        snapshot.docs.forEach(doc => {
          tableData[doc.id] = { id: doc.id, ...doc.data() } as Table;
        });
        setTables(tableData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'tables')
    );

    return () => {
      unsubGuests();
      unsubTables();
    };
  }, []);

  const filteredGuests = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.toLowerCase();
    return guests.filter(g => g.name.toLowerCase().includes(term));
  }, [guests, search]);

  const guestsAtSelectedTable = useMemo(() => {
    if (!selectedTable) return [];
    return guests.filter(g => g.tableId === selectedTable.id).sort((a, b) => a.name.localeCompare(b.name));
  }, [guests, selectedTable]);

  const handleGuestSelect = (guest: Guest) => {
    setHighlightedGuest(guest);
    setSelectedTable(tables[guest.tableId] || null);
    setSearch('');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <>
    <div className="max-w-[1600px] mx-auto w-full space-y-6 md:space-y-8">
      <div className="relative max-w-xl mx-auto w-full px-1">
        <label className="block text-[10px] md:text-sm font-serif uppercase tracking-widest text-darkblue mb-2 md:mb-3 text-center">
          Find your name
        </label>
        <div className="relative z-20">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-darkblue/40" size={18} />
          <input
            type="text"
            placeholder="Search guest name..."
            className="w-full bg-white border border-beige rounded-2xl py-3 md:py-4 pl-11 md:pl-12 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-skyblue/50 font-serif text-base md:text-lg placeholder:text-slate-300 transition-all"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlightedGuest(null);
            }}
          />
        </div>

        <AnimatePresence>
          {search && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 bg-white border border-beige rounded-2xl shadow-2xl mt-2 overflow-hidden z-20 max-h-[300px] overflow-y-auto"
            >
              {filteredGuests.length > 0 ? (
                filteredGuests.map(guest => (
                  <button
                    key={guest.id}
                    onClick={() => handleGuestSelect(guest)}
                    className="w-full text-left px-6 py-4 hover:bg-cream flex justify-between items-center transition-colors border-b border-slate-50 last:border-0"
                  >
                    <span className="font-serif text-darkblue">{guest.name}</span>
                    <span className="text-xs text-skyblue font-bold uppercase tracking-wider">
                      {tables[guest.tableId]?.name || 'TBD'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-slate-400 italic font-serif">
                  No results found
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2 px-1 md:px-2">
        <div>
          <h2 className="font-display text-xl md:text-2xl text-darkblue">Wedding Floor Plan</h2>
          <p className="text-[10px] md:text-sm text-darkblue/60 font-serif italic">Tap a table to see who's sitting there</p>
        </div>
        <div className="flex gap-3 text-[8px] md:text-[10px] uppercase tracking-widest text-darkblue/40 font-bold overflow-x-auto pb-1 no-scrollbar">
          <span className="flex items-center gap-1 shrink-0"><div className="w-2 h-2 rounded-full bg-white border border-beige" /> Available</span>
          <span className="flex items-center gap-1 shrink-0"><div className="w-2 h-2 rounded-full bg-skyblue" /> Selected</span>
          <span className="flex items-center gap-1 shrink-0"><div className="w-2 h-2 rounded-full bg-red-50 border border-red-100" /> Full</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-8 xl:gap-12 items-start">
        <div 
          className={cn(
            "w-full transition-all duration-500 ease-in-out",
            (selectedTable || highlightedGuest) ? "lg:w-2/3" : "w-full"
          )}
        >
          <div className="relative">
            <FloorPlan 
              tables={Object.values(tables)} 
              guests={guests}
              onTableClick={setSelectedTable}
              selectedTableId={selectedTable?.id}
            />
          </div>
        </div>

        <AnimatePresence>
          {(selectedTable || highlightedGuest) && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full lg:w-1/3 shrink-0 lg:sticky lg:top-4"
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-beige/30 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Flower size={120} />
              </div>

              <div className="p-8 text-center relative border-b border-beige/20">
                <button 
                  onClick={() => { setSelectedTable(null); setHighlightedGuest(null); }}
                  className="absolute top-4 right-4 text-darkblue/40 hover:text-darkblue p-2"
                >
                  <X size={20} />
                </button>

                  <div className="flex justify-center mb-4 md:mb-6">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-darkblue shadow-xl flex items-center justify-center text-white font-display text-3xl md:text-4xl border-4 border-cream">
                      {highlightedGuest ? getInitials(highlightedGuest.name) : <Users size={32} className="md:w-10 md:h-10" />}
                    </div>
                  </div>

                <div className="space-y-2 mb-8">
                  <h3 className="font-display text-3xl text-darkblue italic">
                    {highlightedGuest ? highlightedGuest.name : selectedTable.name}
                  </h3>
                </div>

                <div className="bg-cream border border-beige rounded-xl p-3 md:p-4 mb-4 md:mb-6 flex justify-between items-center text-left">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-darkblue/50">Table</span>
                  <span className="font-display text-lg md:text-xl text-darkblue">{selectedTable.name}</span>
                </div>

                <div className="p-4 md:p-6 bg-cream/50 rounded-2xl border border-beige text-xs md:text-sm text-darkblue font-serif italic relative text-left overflow-hidden">
                   <div className="absolute -top-4 -right-4 opacity-10">
                     <Flower size={48} />
                   </div>
                   <p className="leading-relaxed relative z-10">
                    {highlightedGuest 
                      ? `"So glad you could join us, ${highlightedGuest.name.split(' ')[0]}! Here's to an unforgettable evening together."`
                      : `"Welcome to our celebration! We hope you enjoy the evening and create wonderful memories with us."`}
                  </p>
                  <p className="text-darkblue/60 text-[10px] mt-4 not-italic font-bold tracking-widest uppercase relative z-10">— Sewmini & Hemal</p>
                </div>
              </div>

              <div className="p-6 bg-white">
                <h4 className="text-[10px] font-bold text-darkblue/50 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  Guests at {selectedTable.name}
                </h4>
                <div className="space-y-1 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {guestsAtSelectedTable.map(guest => (
                    <motion.div 
                      key={guest.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "flex items-center gap-4 p-2.5 rounded-xl transition-all",
                        highlightedGuest?.id === guest.id ? "bg-cream shadow-sm" : "hover:bg-cream/30"
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-darkblue/10 flex items-center justify-center text-[10px] font-bold text-darkblue/60">
                        {getInitials(guest.name)}
                      </div>
                      <span className={cn("text-base font-serif", highlightedGuest?.id === guest.id ? "text-darkblue font-medium" : "text-darkblue/70")}>
                        {guest.name}
                      </span>
                    </motion.div>
                  ))}
                  {guestsAtSelectedTable.length === 0 && (
                    <p className="text-center text-slate-400 text-xs italic py-4">No guests assigned yet.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>

  <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e6d5b8; border-radius: 10px; }
      `}</style>
    </>
  );
}

