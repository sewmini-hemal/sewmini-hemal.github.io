import { Table, Guest } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Waves, TreePine, Plus, Minus, Maximize, RefreshCcw } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useRef, useEffect, useState } from 'react';

interface FloorPlanProps {
  tables: Table[];
  guests: Guest[];
  onTableClick: (table: Table) => void;
  onTableMove?: (tableId: string, x: number, y: number) => void;
  selectedTableId?: string;
  isEditable?: boolean;
}

export default function FloorPlan({ 
  tables, 
  guests, 
  onTableClick, 
  onTableMove,
  selectedTableId,
  isEditable = false 
}: FloorPlanProps) {
  const transformComponentRef = useRef<any>(null);
  const [initialScale, setInitialScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      // Don't force the whole 2400px canvas to fit on mobile. 
      // Mobile screens are too small; it will make tables tiny.
      // Just start at a reasonable read scale (e.g., 0.4 on mobile, 0.6 on small desktop, etc.)
      // and let the user pan.
      if (window.innerWidth < 640) return 0.35;
      if (window.innerWidth < 1024) return 0.5;
      return 0.7; // Desktop
    };
    
    setInitialScale(calculateScale());
  }, []);

  const tableStats = guests.reduce((acc, g) => {
    acc[g.tableId] = (acc[g.tableId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleDragEnd = (tableId: string, info: any, scale: number) => {
    if (!onTableMove) return;
    
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const currentX = table.x || 0;
    const currentY = table.y || 0;

    // Accounts for scale: if we moved 100px on screen at 2x zoom, 
    // it's only 50px movement in the 1000px coordinate system.
    const deltaXPercent = ((info.offset.x / scale) / 2400) * 100;
    const deltaYPercent = ((info.offset.y / scale) / 1600) * 100;

    // Allow full freedom within safety margins
    const newX = Math.max(1, Math.min(99, currentX + deltaXPercent));
    const newY = Math.max(1, Math.min(99, currentY + deltaYPercent));

    onTableMove(tableId, newX, newY);
  };

  useEffect(() => {
    if (!selectedTableId && transformComponentRef.current) {
      transformComponentRef.current.resetTransform();
    } else if (selectedTableId && transformComponentRef.current) {
      // Small delay to ensure table element is rendered and positioned
      setTimeout(() => {
        const element = document.querySelector(`[data-table-id="${selectedTableId}"]`);
        if (element) {
          transformComponentRef.current.zoomToElement(element, 2.5, 600, 'easeOut');
        }
      }, 100);
    }
  }, [selectedTableId]);

  return (
    <div className={cn(
      "relative w-full h-[60vh] md:h-[70vh] bg-cream rounded-3xl shadow-xl border-4 md:border-8 border-white overflow-hidden",
      isEditable && "ring-4 ring-skyblue/30"
    )}>
      <TransformWrapper
        key={initialScale} // Force remount when initial scale is calculated
        initialScale={initialScale}
        minScale={0.15}
        maxScale={4}
        centerOnInit={true}
        limitToBounds={false}
        wheel={{ step: 0.1 }}
        panning={{
          excluded: ["drag-table"]
        }}
        ref={transformComponentRef}
      >
        {({ zoomIn, zoomOut, resetTransform, state }) => (
          <>
            {/* Controls */}
            <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 flex flex-col gap-2 z-50">
              <button 
                onClick={() => zoomIn()}
                className="w-10 h-10 md:w-12 md:h-12 bg-white/90 backdrop-blur-sm shadow-xl border border-beige rounded-xl md:rounded-2xl flex items-center justify-center text-darkblue hover:bg-white hover:scale-105 transition-all active:scale-95"
                title="Zoom In"
              >
                <Plus size={20} />
              </button>
              <button 
                onClick={() => resetTransform()}
                className="w-10 h-10 md:w-12 md:h-12 bg-white/90 backdrop-blur-sm shadow-xl border border-beige rounded-xl md:rounded-2xl flex items-center justify-center text-darkblue hover:bg-white hover:scale-105 transition-all active:scale-95"
                title="Reset View"
              >
                <RefreshCcw size={18} />
              </button>
              <button 
                onClick={() => zoomOut()}
                className="w-10 h-10 md:w-12 md:h-12 bg-white/90 backdrop-blur-sm shadow-xl border border-beige rounded-xl md:rounded-2xl flex items-center justify-center text-darkblue hover:bg-white hover:scale-105 transition-all active:scale-95"
                title="Zoom Out"
              >
                <Minus size={20} />
              </button>
            </div>
            <TransformComponent
              wrapperClass="!w-full !h-full"
            >
              <div 
                className="relative floral-gradient select-none"
                style={{ 
                  width: 2400, 
                  height: 1600, 
                  minWidth: 2400, 
                  minHeight: 1600,
                  cursor: isEditable ? 'default' : 'move' 
                }}
              >
                {isEditable && (
                  <div className="absolute inset-0 bg-cream/30 pointer-events-none z-0 flex items-center justify-center">
                    <span className="text-darkblue/10 text-4xl font-serif uppercase tracking-[1em] -rotate-12 select-none">
                      Layout Editor
                    </span>
                  </div>
                )}
                {/* Indoor Boundary */}
                <div className="absolute left-0 top-0 bottom-0 w-[35%] bg-white/60 border-r-2 border-dashed border-beige flex flex-col items-center pt-8 pointer-events-none">
                  <span className="font-serif uppercase tracking-[0.4em] text-darkblue/20 text-xs font-bold transform -rotate-90 origin-center absolute left-2 top-1/2 -translate-y-1/2">Indoor Hall</span>
                </div>

                {/* Buffet Area */}
                <div className="absolute left-2 top-[20%] bottom-[40%] w-10 bg-beige/10 border border-beige/40 rounded-md flex items-center justify-center pointer-events-none shadow-inner">
                  <span className="font-serif text-[10px] uppercase tracking-[0.2em] text-darkblue/40 -rotate-90 whitespace-nowrap">Buffet Area</span>
                </div>

                {/* DJ Area */}
                <div className="absolute left-12 bottom-12 w-16 h-16 bg-slate-800/10 border-2 border-slate-800/20 rounded-2xl flex items-center justify-center pointer-events-none shadow-md">
                  <div className="flex flex-col items-center">
                    <span className="font-serif text-[10px] uppercase font-bold tracking-widest text-slate-500">DJ</span>
                  </div>
                </div>

                {/* Pool Area */}
                <div className="absolute right-4 top-28 bottom-12 w-[22%] bg-skyblue/20 border-2 border-skyblue/40 rounded-[2.5rem] flex items-center justify-center pointer-events-none shadow-inner overflow-hidden">
                  <div className="flex flex-col items-center gap-2 text-darkblue/30">
                    <Waves size={40} className="stroke-[1.5]" />
                    <span className="font-serif text-sm uppercase tracking-[0.4em] italic transform rotate-90">Pool Area</span>
                  </div>
                </div>

                {/* Entrance */}
                <div className="absolute bottom-0 left-[50%] -translate-x-1/2 h-14 w-40 bg-slate-200/30 rounded-t-3xl flex items-center justify-center border-2 border-b-0 border-slate-300/50 pointer-events-none">
                   <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] rounded-t-3xl" />
                  <span className="font-serif text-xs uppercase tracking-[0.5em] text-slate-400 font-bold z-10">Entrance</span>
                </div>

                {/* Tree Area */}
                <div className="absolute left-[50%] top-[20%] pointer-events-none flex flex-col items-center group">
                  <div className="p-4 bg-green-50/30 rounded-full border border-green-100 shadow-sm">
                    <TreePine size={56} className="text-green-300 fill-green-100/50" />
                  </div>
                  <span className="font-serif text-[10px] uppercase tracking-[0.3em] italic text-green-600/40 mt-1">Garden Tree</span>
                </div>

                {/* Bar Area */}
                <div className="absolute right-6 top-6 w-36 h-16 border-2 border-beige bg-beige/10 rounded-2xl flex items-center justify-center pointer-events-none shadow-sm">
                  <span className="font-serif text-[10px] uppercase tracking-[0.3em] font-bold text-darkblue/40">Bar Area</span>
                </div>

                {/* Stairs */}
                <div className="absolute left-[30%] top-0 h-10 w-28 flex flex-col pointer-events-none">
                   {[1,2,3,4,5].map(i => <div key={i} className="flex-1 border-b border-beige/30 w-full" />)}
                   <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-darkblue/10 mx-auto bg-white px-2 -mt-2.5">Stairs</span>
                </div>

                {/* Settee Area (SB) - Moved to top middle to avoid overlap */}
                <div className="absolute left-[44%] top-4 w-36 h-10 border-2 border-beige bg-beige/10 rounded-xl flex items-center justify-center pointer-events-none shadow-sm">
                  <span className="font-serif text-[10px] uppercase tracking-[0.2em] font-bold text-darkblue/40">Settee Back</span>
                </div>

                {/* Tables */}
                {tables.map((table) => {
                  const count = tableStats[table.id] || 0;
                  const isFull = count >= table.capacity;
                  const isSelected = selectedTableId === table.id;

                  return (
                    <motion.button
                      key={table.id}
                      data-table-id={table.id}
                      whileHover={isEditable ? { scale: 1.2 } : { scale: 1.15 }}
                      whileTap={isEditable ? { scale: 1.1 } : { scale: 0.95 }}
                      drag={isEditable}
                      dragMomentum={false}
                      dragElastic={0}
                      onDragEnd={(_, info) => handleDragEnd(table.id, info, state.scale)}
                      onClick={() => !isEditable && onTableClick(table)}
                      transition={isEditable ? { type: "just" } : { type: "spring", damping: 20, stiffness: 300 }}
                      style={{ 
                        left: `${table.x ?? 0}%`, 
                        top: `${table.y ?? 0}%` 
                      }}
                      className={cn(
                        "drag-table absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-[10px] md:text-sm font-bold transition-all shadow-sm z-10",
                        isEditable 
                          ? "bg-darkblue border-2 border-skyblue text-white cursor-grab active:cursor-grabbing shadow-lg"
                          : isSelected 
                            ? "bg-darkblue text-white ring-4 ring-skyblue/40 scale-110 shadow-lg" 
                            : isFull 
                              ? "bg-red-50 text-red-500 border border-red-100" 
                              : "bg-white text-darkblue border border-beige hover:border-skyblue hover:shadow-md"
                      )}
                    >
                      {table.name.replace('Table ', '')}
                    </motion.button>
                  );
                })}

                {/* Area Labels */}
                <div className="absolute right-[40%] bottom-8 pointer-events-none">
                   <span className="font-serif uppercase tracking-[0.2em] text-slate-300 text-xs italic">Outdoor Ceremony</span>
                </div>
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
