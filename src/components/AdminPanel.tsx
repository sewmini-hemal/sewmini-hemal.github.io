import { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType, logout } from '../lib/firebase';
import { Guest, Table } from '../types';
import { Users, Plus, Trash2, Edit2, LayoutGrid, List, Check, X, RefreshCcw, MapPin, LogOut, FileUp, Download, Move, Flower } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import FloorPlan from './FloorPlan';

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [view, setView] = useState<'guests' | 'tables' | 'layout'>('guests');
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestTableId, setNewGuestTableId] = useState('');
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setLoading(false);
      if (!u || (u.email !== 'h.githmin@gmail.com' && u.email !== 'h.githmin@gmail')) {
        if (u) logout();
        navigate('/admin/login');
      } else {
        setUser(u);
      }
    });
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    toast.success("Signed out");
  };

  useEffect(() => {
    // Auto-migrate tables from I1...I5 and O1...O13 to 1...18 if needed.
    // AND ensure we have at least 19 tables.
    const migrateTables = async () => {
      if (tables.length === 0) return;
      
      try {
        const batch = writeBatch(db);
        let commitNeeded = false;
        
        const needsMigration = tables.some(t => t.name.includes('I') || t.name.includes('O'));
        if (needsMigration) {
          let currentId = 1;
          // Sort carefully so I comes first, then O, ordered by number
          const sorted = [...tables].sort((a, b) => {
            const aIsI = a.name.includes('I');
            const bIsI = b.name.includes('I');
            if (aIsI && !bIsI) return -1;
            if (!aIsI && bIsI) return 1;
            const aNum = parseInt(a.name.replace(/\D/g, '') || '0');
            const bNum = parseInt(b.name.replace(/\D/g, '') || '0');
            return aNum - bNum;
          });

          sorted.forEach(t => {
            batch.update(doc(db, 'tables', t.id), {
              name: `Table ${currentId}`
            });
            currentId++;
          });
          commitNeeded = true;
        }

        // Check if we need to add Table 19
        const has19 = tables.some(t => t.id === 'table-19' || t.name === 'Table 19');
        if (!has19 && tables.length > 0) {
          batch.set(doc(db, 'tables', 'table-19'), {
            name: 'Table 19',
            capacity: 10,
            shape: 'Circle',
            x: 80,
            y: 80
          });
          commitNeeded = true;
        }

        if (commitNeeded) {
          await batch.commit();
          if (needsMigration) toast.success("Migrated table names format!");
          if (!has19) toast.success("Added Table 19 automatically!");
        }
      } catch(e) {
        console.error("Migration/Add failed:", e);
      }
    };
    migrateTables();
  }, [tables]);

  useEffect(() => {
    if (!user) return;

    const unsubGuests = onSnapshot(collection(db, 'guests'), (snapshot) => {
      setGuests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'guests'));

    const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const fetchedTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setTables(fetchedTables);
      // Initialize layout tables only if not currently editing (to avoid overwriting unsaved changes)
      // Actually, it's safer to just let the user 'refresh' or initialize once when entering the view
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tables'));

    return () => {
      unsubGuests();
      unsubTables();
    };
  }, [user]);

  const stats = useMemo(() => {
    const tableStats: Record<string, number> = {};
    guests.forEach(g => {
      tableStats[g.tableId] = (tableStats[g.tableId] || 0) + 1;
    });
    return tableStats;
  }, [guests]);

  const handleAddGuest = async () => {
    if (!newGuestName.trim() || !newGuestTableId) {
      toast.error("Please provide both name and table.");
      return;
    }

    try {
      if (editingGuest) {
        await updateDoc(doc(db, 'guests', editingGuest.id), {
          name: newGuestName,
          tableId: newGuestTableId,
          updatedAt: serverTimestamp()
        });
        toast.success("Guest updated");
      } else {
        await addDoc(collection(db, 'guests'), {
          name: newGuestName,
          tableId: newGuestTableId,
          addedBy: user?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Guest added");
      }
      resetForm();
    } catch (e) {
      toast.error("Failed to save guest.");
    }
  };

  const processImportData = async (data: any[]) => {
    const batch = writeBatch(db);
    let count = 0;
    let skipped = 0;

    // Helper to find a value by loosely matching keys
    const getValueLoosely = (row: any, searchKeys: string[]) => {
      const rowKeys = Object.keys(row);
      for (const searchKey of searchKeys) {
        // Exact match first
        if (row[searchKey] !== undefined && row[searchKey] !== null) return row[searchKey];
        
        // Loose match
        const foundKey = rowKeys.find(k => {
          const normK = k.toLowerCase().trim();
          const normS = searchKey.toLowerCase().trim();
          return normK === normS || normK.includes(normS) || normS.includes(normK);
        });
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) return row[foundKey];
      }
      return null;
    };

    for (const row of data) {
      const nameValue = getValueLoosely(row, ['Guest Name', 'Name', 'FullName']);
      const tableValue = getValueLoosely(row, ['Table Number', 'Table Num', 'Table']);

      // If both are empty, it's an empty row, skip entirely
      if ((nameValue === null || nameValue === undefined || nameValue.toString().trim() === '') && 
          (tableValue === null || tableValue === undefined || tableValue.toString().trim() === '')) {
        continue;
      }

      const name = nameValue?.toString().trim();
      const tableValRaw = tableValue?.toString().trim();

      if (!name || !tableValRaw) {
        if (name || tableValRaw) skipped++;
        continue;
      }

      // Normalize search value: remove non-alphanumeric, uppercase it
      const searchVal = tableValRaw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      
      // Try to find matching table
      const targetTable = tables.find(t => {
        const tId = t.id.toLowerCase();
        const tName = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normSearch = searchVal.toLowerCase();
        
        // Match table-1 or table-01 id
        const idMatch = tId === `table-${normSearch}` || tId === `table-${normSearch.padStart(2, '0')}`;
        
        // Match "Table 1" or "Table 01" name
        const nameMatch = tName === normSearch || 
                         tName === `table${normSearch}` || 
                         tName === `table${normSearch.padStart(2, '0')}`;

        // Match just numeric part if searchVal is numeric
        const numericMatch = normSearch.match(/^\d+$/) && 
                            (tName === normSearch || tName === `table${normSearch}` || tName.endsWith(normSearch));

        return idMatch || nameMatch || numericMatch;
      });

      if (targetTable) {
        const guestRef = doc(collection(db, 'guests'));
        batch.set(guestRef, {
          name,
          tableId: targetTable.id,
          addedBy: user?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        count++;
      } else {
        skipped++;
      }
    }

    if (count > 0) {
      await batch.commit();
      toast.success(`Successfully imported ${count} guests!`);
    }
    if (skipped > 0) {
      toast.error(`Skipped ${skipped} rows (name missing or table not found).`, { duration: 5000 });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processImportData(results.data);
        }
      });
    } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processImportData(data);
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Unsupported file format. Please use CSV or Excel.");
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteGuest = async (id: string) => {
    setConfirmState({
      title: "Remove Guest",
      message: "Are you sure you want to remove this guest? This action cannot be undone.",
      isDanger: true,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          await deleteDoc(doc(db, 'guests', id));
          toast.success("Guest removed successfully");
        } catch (err: any) {
          console.error("Delete error:", err);
          toast.error(`Delete failed: ${err.message || "Insufficient permissions"}`);
          handleFirestoreError(err, OperationType.DELETE, `guests/${id}`);
        } finally {
          setIsProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const deleteAllGuests = async () => {
    if (guests.length === 0) return;
    
    setConfirmState({
      title: "Delete All Guests",
      message: `Are you sure you want to delete ALL ${guests.length} guests? This action cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          // Handle batches of 500 (Firestore limit)
          const chunks = [];
          for (let i = 0; i < guests.length; i += 500) {
            chunks.push(guests.slice(i, i + 500));
          }

          for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(guest => {
              batch.delete(doc(db, 'guests', guest.id));
            });
            await batch.commit();
          }
          
          toast.success("All guests removed successfully");
        } catch (err: any) {
          console.error("Delete all error:", err);
          toast.error(`Batch delete failed: ${err.message || "Insufficient permissions"}`);
          handleFirestoreError(err, OperationType.DELETE, 'guests');
        } finally {
          setIsProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const resetForm = () => {
    setNewGuestName('');
    setNewGuestTableId('');
    setEditingGuest(null);
    setIsAddingGuest(false);
  };

  const handleTableMove = async (tableId: string, x: number, y: number) => {
    try {
      await updateDoc(doc(db, 'tables', tableId), {
        x,
        y,
        updatedAt: serverTimestamp()
      });
      // No need for toast on every drag, it's too noisy
    } catch (e) {
      console.error("Move error:", e);
      toast.error("Failed to auto-save position");
    }
  };

  const manualSync = () => {
    toast.success("Changes synced with home page", { icon: '🔄' });
  };

  const initializeTables = async () => {
    const performReset = async () => {
      setIsProcessing(true);
      try {
        const batch = writeBatch(db);
        
        // 1. Delete all existing tables
        tables.forEach(t => {
          batch.delete(doc(db, 'tables', t.id));
        });

        // Create Tables 1 to 19 in a grid
        for (let i = 0; i < 19; i++) {
          const num = i + 1;
          const tableNum = num.toString();
          const id = `table-${num}`;
          
          // Simple grid layout to start
          const row = Math.floor(i / 5);
          const col = i % 5;
          const x = 20 + (col * 15);
          const y = 30 + (row * 15);
          
          batch.set(doc(db, 'tables', id), {
            name: `Table ${tableNum}`,
            capacity: 10,
            shape: 'Circle',
            x,
            y
          });
        }

        await batch.commit();
        toast.success("Tables reset to default positions!");
      } catch (e: any) {
        console.error("Sync error:", e);
        toast.error(`Sync failed: ${e.message}`);
      } finally {
        setIsProcessing(false);
        setConfirmState(null);
      }
    };

    if (tables.length > 0) {
      setConfirmState({
        title: "Reset Tables",
        message: "This will DELETE ALL existing tables and reset to default positions. Guests will be unassigned. Continue?",
        isDanger: true,
        onConfirm: performReset
      });
    } else {
      performReset();
    }
  };

  if (loading) return null;

  return (
    <div className={cn("space-y-6", isProcessing && "opacity-50 pointer-events-none cursor-wait transition-opacity")}>
      {confirmState && (
        <div className="fixed inset-0 bg-darkblue/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl border border-beige max-w-md w-full overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className={cn(
                "w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center",
                confirmState.isDanger ? "bg-red-50 text-red-500" : "bg-skyblue/20 text-darkblue"
              )}>
                {confirmState.isDanger ? <Trash2 size={32} /> : <Check size={32} />}
              </div>
              <h3 className="font-display text-2xl text-darkblue mb-2">{confirmState.title}</h3>
              <p className="text-darkblue/60 font-serif italic mb-8">{confirmState.message}</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmState(null)}
                  className="flex-1 px-6 py-3 rounded-xl border border-beige text-darkblue/60 hover:bg-cream transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmState.onConfirm}
                  className={cn(
                    "flex-1 px-6 py-3 rounded-xl text-white font-medium shadow-lg transition-all active:scale-95",
                    confirmState.isDanger ? "bg-red-500 hover:bg-red-600 shadow-red-200" : "bg-darkblue hover:bg-darkblue/90 shadow-darkblue/20"
                  )}
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-[1px] z-[100] flex items-center justify-center">
          <div className="bg-white p-4 rounded-2xl shadow-2xl border border-beige flex items-center gap-3">
            <RefreshCcw size={20} className="animate-spin text-darkblue" />
            <span className="text-sm font-medium text-darkblue">Processing request...</span>
          </div>
        </div>
      )}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".csv, .xlsx, .xls" 
        className="hidden" 
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-beige/30 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-10 opacity-5 pointer-events-none">
          <Flower size={80} />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-skyblue/20 flex items-center justify-center text-darkblue">
            <Users size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg text-darkblue">Wedding Dashboard</h2>
            <p className="text-[10px] text-darkblue/60">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-darkblue/40 hover:text-red-500 transition-colors text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4 bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-beige/30">
        <div className="flex bg-cream p-1 rounded-xl overflow-x-auto no-scrollbar shrink-0">
          <button 
            onClick={() => setView('guests')}
            className={cn("flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap", 
              view === 'guests' ? "bg-white shadow text-darkblue" : "text-darkblue/40 hover:text-darkblue")}
          >
            <List size={16} />
            Guests
          </button>
          <button 
            onClick={() => setView('tables')}
            className={cn("flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap", 
              view === 'tables' ? "bg-white shadow text-darkblue" : "text-darkblue/40 hover:text-darkblue")}
          >
            <LayoutGrid size={16} />
            Tables
          </button>
          <button 
            onClick={() => setView('layout')}
            className={cn("flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap", 
              view === 'layout' ? "bg-white shadow text-darkblue" : "text-darkblue/40 hover:text-darkblue")}
          >
            <Move size={16} />
            Floor Plan
          </button>
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2 w-full md:w-auto text-darkblue">
          <div className="relative group flex-1 md:flex-none">
            <button 
              onClick={initializeTables}
              className="w-full flex items-center justify-center gap-1.5 md:gap-2 border border-beige text-darkblue px-3 md:px-4 py-2 rounded-xl hover:bg-beige/10 transition-all text-xs md:text-sm font-bold bg-cream"
            >
              <RefreshCcw size={16} />
              <span className="hidden sm:inline">{tables.length === 0 ? "Setup" : "Sync"} Layout</span>
              <span className="sm:hidden">{tables.length === 0 ? "Setup" : "Sync"}</span>
            </button>
          </div>
          {view === 'guests' && guests.length > 0 && (
            <button 
              onClick={deleteAllGuests}
              disabled={isProcessing}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 border border-red-100 text-red-500 px-3 md:px-4 py-2 rounded-xl hover:bg-red-50 transition-all text-[11px] md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove all guests"
            >
              <Trash2 size={16} />
              <span className="hidden xs:inline">Delete All</span>
            </button>
          )}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 border border-beige/40 text-darkblue/60 px-3 md:px-4 py-2 rounded-xl hover:bg-cream transition-all text-[11px] md:text-sm"
          >
            <FileUp size={16} />
            Import
          </button>
          <button 
            onClick={() => setIsAddingGuest(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 bg-darkblue text-white px-3 md:px-4 py-2 rounded-xl hover:bg-darkblue/90 transition-all shadow-lg shadow-darkblue/20 text-[11px] md:text-sm font-medium"
          >
            <Plus size={16} />
            Guest
          </button>
        </div>
      </div>

      {isAddingGuest && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-2xl shadow-xl border-2 border-beige/30 space-y-4"
        >
          <div className="flex justify-between items-center text-darkblue">
            <h3 className="font-display text-xl">{editingGuest ? 'Edit Guest' : 'New Guest'}</h3>
            <button onClick={resetForm} className="text-darkblue/30 hover:text-darkblue transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-darkblue/40 uppercase mb-1 block">Full Name</label>
              <input 
                type="text" 
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                placeholder="Guest Name"
                className="w-full border border-beige rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-skyblue/50 bg-cream/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-darkblue/40 uppercase mb-1 block">Assign Table</label>
              <select 
                value={newGuestTableId}
                onChange={(e) => setNewGuestTableId(e.target.value)}
                className="w-full border border-beige rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-skyblue/50 bg-white"
              >
                <option value="">Select a table...</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({stats[t.id] || 0}/10)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={resetForm} className="px-6 py-2 text-darkblue/40 hover:text-darkblue font-medium">Cancel</button>
            <button 
              onClick={handleAddGuest}
              className="px-8 py-2 bg-darkblue text-white rounded-xl font-medium shadow-md hover:bg-darkblue/90 transition-colors"
            >
              {editingGuest ? 'Save Changes' : 'Add Guest'}
            </button>
          </div>
        </motion.div>
      )}

      {view === 'guests' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
          {/* ... table content remains same ... */}
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Guest Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Table</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center gap-2">
                      <List size={32} className="text-slate-200" />
                      <p>No guests added yet. Try importing a CSV!</p>
                    </div>
                  </td>
                </tr>
              ) : guests.map(guest => (
                <tr key={guest.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-800">{guest.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-darkblue">
                      <span className="bg-skyblue/20 text-darkblue px-2 py-0.5 rounded font-bold">
                        {tables.find(t => t.id === guest.tableId)?.name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    <button 
                      onClick={() => {
                        setEditingGuest(guest);
                        setNewGuestName(guest.name);
                        setNewGuestTableId(guest.tableId);
                        setIsAddingGuest(true);
                      }}
                      className="p-2 text-darkblue/30 hover:text-skyblue transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteGuest(guest.id)}
                      disabled={isProcessing}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === 'tables' ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map(table => {
            const count = stats[table.id] || 0;
            const progress = (count / table.capacity) * 100;
            return (
              <div key={table.id} className="bg-white p-5 rounded-2xl shadow-sm border border-beige hover:border-skyblue transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                  <Flower size={60} />
                </div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <h4 className="font-bold text-darkblue text-lg group-hover:text-darkblue transition-colors">{table.name}</h4>
                    <span className="text-[10px] uppercase tracking-wider text-darkblue/40 flex items-center gap-1">
                      <MapPin size={10} /> {table.name}
                    </span>
                  </div>
                  <div className={cn("px-2 py-1 rounded text-xs font-bold", 
                    count >= 10 ? "bg-red-50 text-red-500" : "bg-cream text-darkblue/60")}>
                    {count}/{table.capacity}
                  </div>
                </div>
                
                <div className="space-y-4 relative z-10">
                  <div className="h-2 w-full bg-cream rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      className={cn("h-full transition-colors", 
                        count >= 10 ? "bg-red-400" : "bg-skyblue")} 
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: table.capacity }).map((_, idx) => (
                      <div 
                        key={idx} 
                        className={cn("w-3 h-3 rounded-full border border-beige", 
                          idx < count ? "bg-darkblue/80 border-darkblue/80" : "bg-transparent")} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white p-4 rounded-2xl shadow-md border border-beige/30">
          <div className="mb-4 p-4 bg-cream rounded-xl border border-beige flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Move size={20} className="text-darkblue shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-darkblue text-sm">Layout Designer</h4>
                <p className="text-[10px] text-darkblue/40">Drag tables to position. Changes are saved automatically as you work.</p>
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={initializeTables}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-beige text-darkblue rounded-xl text-xs font-bold hover:bg-beige/10 transition-all shadow-sm"
                title="Reset to default spacing"
              >
                <RefreshCcw size={14} />
                Default Spacing
              </button>
              <button 
                onClick={manualSync}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-darkblue text-white rounded-xl text-xs font-bold hover:bg-darkblue/90 transition-all shadow-lg active:scale-95"
              >
                <RefreshCcw size={14} className="hover:rotate-180 transition-transform duration-500" />
                Sync with Home
              </button>
            </div>
          </div>
          
          <div className="max-w-4xl mx-auto border-4 border-cream rounded-3xl overflow-hidden shadow-inner bg-cream/20 relative">
            <FloorPlan 
              tables={tables}
              guests={guests}
              onTableClick={() => {}}
              onTableMove={handleTableMove}
              isEditable={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
