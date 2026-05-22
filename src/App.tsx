import React, { useState, useRef } from "react";
import { Upload, FileDown, CheckCircle2, XCircle, Clock, FileDigit, IndianRupee, Info, FileText, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ExtractionResult {
  success: boolean;
  data?: {
    payeeName: string;
    amountNumber: string;
    amountWords: string;
    date: string;
    accountNumber: string;
    chequeNumber: string;
    confidenceScore?: number;
  };
  error?: string;
  latency: number;
  model: string;
}

const CopyableField = ({ label, value, valueClass }: { label: string, value?: string, valueClass?: string }) => {
  const [copied, setCopied] = useState(false);

  if (!value || value.toLowerCase() === "null" || value.toLowerCase() === "not found") return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="p-3 border border-neutral-200 rounded bg-neutral-50 group cursor-pointer hover:border-[#FF4E00] transition-colors relative"
      onClick={handleCopy}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-[10px] text-neutral-500 uppercase font-mono">{label}</span>
        <button 
          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-[#FF4E00] focus:outline-none"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className={`mt-1 ${valueClass || "text-neutral-900 font-serif text-lg"}`}>
        {value}
      </p>
    </div>
  );
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ lite: ExtractionResult | null; flash: ExtractionResult | null }>({
    lite: null,
    flash: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Result is like 'data:image/jpeg;base64,....'
        setImage(result);
        setMimeType(file.type);
        setResults({ lite: null, flash: null });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExtract = async () => {
    if (!image) return;
    setLoading(true);
    setResults({ lite: null, flash: null });
    
    // strip out data schema for backend
    const base64Data = image.split(",")[1];
    
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Data, mimeType }),
      });
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      setResults({
        lite: data.liteResult,
        flash: data.flashResult
      });
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const ResultCard = ({ title, modelName, result, highlight = false }: { title: string, modelName: string, result: ExtractionResult | null, highlight?: boolean }) => {
    if (!result) return null;
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-col bg-white rounded-lg border overflow-hidden ${highlight ? 'border-[#FF4E00] border-dashed shadow-[0_0_15px_rgba(255,78,0,0.1)]' : 'border-neutral-200 shadow-sm'}`}
      >
        <div className={`px-4 py-3 border-b border-neutral-200 flex justify-between items-center ${highlight ? 'bg-orange-50/50' : 'bg-neutral-50'}`}>
          <div className="flex flex-col">
            <span className="font-serif text-lg text-neutral-900 mb-0.5">{title}</span>
            <span className="text-[10px] text-neutral-500 uppercase font-mono">{modelName}</span>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center text-sm font-mono text-neutral-700 px-2 py-1 bg-white rounded border border-neutral-200 shadow-sm gap-3">
              <span className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-neutral-400" />
                {result.latency.toLocaleString()} ms
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-5 flex-1 bg-white">
          {result.success && result.data ? (
            <div className="space-y-4">
               <CopyableField 
                 label="Payee Name"
                 value={result.data.payeeName}
               />
               <div className="grid grid-cols-2 gap-4">
                 <CopyableField 
                   label="Amount"
                   value={result.data.amountNumber}
                   valueClass="font-mono text-[#FF4E00] text-xl"
                 />
                 <CopyableField 
                   label="Date"
                   value={result.data.date}
                 />
               </div>
               <CopyableField 
                 label="Amount (Words)"
                 value={result.data.amountWords}
                 valueClass="text-xs text-neutral-600 italic font-serif"
               />
               <div className="grid grid-cols-2 gap-4">
                 <CopyableField 
                   label="Account Number"
                   value={result.data.accountNumber}
                   valueClass="text-neutral-900 font-mono tracking-widest text-lg"
                 />
                 <CopyableField 
                   label="Cheque Number"
                   value={result.data.chequeNumber}
                   valueClass="text-neutral-900 font-mono tracking-widest text-lg"
                 />
               </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[#FF4E00] text-sm border border-[#FF4E00] p-4 rounded bg-orange-50">
              <XCircle className="w-4 h-4 mr-2" />
              Unable to read cheque details: {result.error}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800 font-sans p-6 md:p-12 overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FF4E00] text-white rounded-sm shadow-sm flex items-center justify-center font-bold text-xl">
              C
            </div>
            <h1 className="text-3xl font-serif italic tracking-tight text-neutral-900 flex items-center gap-3">
              ChequeMind 
              <span className="text-neutral-500 font-sans not-italic text-[10px] px-2 py-1 border border-neutral-300 rounded uppercase tracking-[0.2em] transform translate-y-[2px] bg-white">Scanner</span>
            </h1>
          </div>
          <p className="text-neutral-500 text-sm max-w-xl leading-relaxed">
            Upload a cheque image to automatically extract the payee name, date, and transaction amounts.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8">
          
          {/* Left Column: Upload */}
          <section className="space-y-6 flex flex-col">
            <div className="bg-white p-6 lg:p-8 rounded-xl border border-neutral-200 shadow-sm">
              <h2 className="text-xs uppercase tracking-[0.3em] text-[#FF4E00] mb-6 font-semibold flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-[#FF4E00]"/> Image Upload
              </h2>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-neutral-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#FF4E00] hover:bg-orange-50/50 transition-colors group h-64 relative overflow-hidden bg-neutral-50/50"
              >
                {image ? (
                   <img src={image} alt="Cheque" className="absolute inset-0 w-full h-full object-contain p-2 bg-white" />
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center group-hover:bg-[#FF4E00] transition-colors mb-4 border border-neutral-200 shadow-sm group-hover:border-[#FF4E00]">
                       <FileDown className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
                    </div>
                    <p className="font-mono text-neutral-700">Click to upload a cheque image</p>
                    <p className="text-xs text-neutral-400 mt-2 uppercase tracking-widest">PNG, JPG, or WebP</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>

              {image && (
                 <div className="mt-8 flex justify-between items-center gap-4">
                   <button
                     onClick={(e) => {
                       setImage(null);
                       setMimeType(null);
                       setResults({ lite: null, flash: null });
                       if (fileInputRef.current) fileInputRef.current.value = "";
                     }}
                     className="text-[10px] font-mono text-neutral-500 hover:text-neutral-900 px-3 py-2 uppercase tracking-[0.2em] transition-colors"
                   >
                     Clear
                   </button>
                   <button
                     onClick={handleExtract}
                     disabled={loading}
                     className="flex-1 bg-neutral-900 hover:bg-[#FF4E00] text-white px-6 py-3 rounded text-xs font-bold uppercase tracking-widest transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                   >
                     {loading ? (
                       <>
                         <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                         Extracting Data
                       </>
                     ) : (
                       "Analyze Cheque"
                     )}
                   </button>
                 </div>
              )}
            </div>
          </section>
          
          {/* Right Column: Results */}
          <section className="bg-white rounded-xl p-6 lg:p-8 border border-neutral-200 shadow-sm min-h-[400px] flex flex-col">
            <h2 className="text-xs uppercase tracking-[0.3em] text-[#FF4E00] mb-8 font-semibold flex justify-between items-center">
               <span>Cheque Information</span>
            </h2>

            <div className="flex-1 flex flex-col gap-6 relative">
              {!loading && !results.lite && !results.flash && (
                 <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 space-y-4">
                   <div className="w-16 h-16 border border-dashed border-neutral-300 rounded-full flex items-center justify-center bg-neutral-50">
                      <FileText className="w-6 h-6 text-neutral-300" />
                   </div>
                   <p className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">Upload a cheque to view details</p>
                 </div>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

