import React, { useState } from 'react';
import axios from 'axios';
import { Loader2, Upload, BrainCircuit, Eye, CircuitBoard, Settings } from 'lucide-react';
import PCBViewer from './PCBViewer'; 

export default function App() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [vizData, setVizData] = useState(null);
    
    // --- NEW STATE FOR USER OVERRIDES ---
    const [userClearance, setUserClearance] = useState('');
    const [userTraceWidth, setUserTraceWidth] = useState('');


    const handleFileChange = (e) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            setAiSuggestions(null);
            setVizData(null);
            setStatus("");
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true); setStatus("Analyzing with AI..."); setVizData(null);

        // 1. Construct User Overrides
        const userOverrides = {};
        if (userClearance !== '') userOverrides.clearance = parseFloat(userClearance);
        if (userTraceWidth !== '') userOverrides.trace_width = parseFloat(userTraceWidth);

        const formData = new FormData();
        formData.append("file", file);
        // 2. Append the overrides as a JSON string
        formData.append("user_rules_json", JSON.stringify(userOverrides)); 

        try {
            const response = await axios.post("http://localhost:8000/process-pcb", formData);
            
            const { ai_suggestions, visualization, file_data, filename } = response.data;
            
            setAiSuggestions(ai_suggestions);
            setVizData(visualization); 

            // Decode & Download
            const binaryString = window.atob(file_data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "application/zip" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            
            setStatus("Success! Routing complete and files downloaded.");

        } catch (error) {
            console.error(error);
            setStatus(`Error: Failed to process PCB.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center">
            
            <div className="w-full max-w-6xl flex items-center gap-3 mb-8">
                <CircuitBoard className="text-blue-500 w-10 h-10" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">AI PCB Router</h1>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN: Controls & AI/Manual Input */}
                <div className="space-y-6 lg:col-span-1">
                    
                    {/* Upload/Run Card */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-blue-400"/> Input Board
                        </h2>
                        
                        <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center relative mb-4 hover:border-blue-500 transition-colors">
                            <input type="file" accept=".kicad_pcb" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="text-slate-400"/>
                                <p className="text-slate-400 text-sm">{file ? file.name : "Click to Upload .kicad_pcb"}</p>
                            </div>
                        </div>

                        <button onClick={handleUpload} disabled={!file || loading} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${loading ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                            {loading ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
                            {loading ? "AI Processing..." : "Run Auto-Router"}
                        </button>
                        {status && <p className="text-center text-xs mt-3 text-emerald-400">{status}</p>}
                    </div>

                    {/* AI Suggestions Card */}
                    {aiSuggestions && (
                        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                            <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5"/> Design Rule Override
                            </h2>
                            <p className="text-xs text-slate-500 mb-4">AI Suggested Global Rules are displayed. Enter a new value below to override.</p>

                            <div className="space-y-3">
                                {/* Global Clearance Override */}
                                <label className="block">
                                    <span className="text-slate-300 text-sm font-medium">Global Clearance (mm)</span>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={userClearance}
                                        onChange={(e) => setUserClearance(e.target.value)}
                                        className="w-full mt-1 bg-slate-800 text-white p-2 rounded border border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder={`AI Default: ${aiSuggestions.clearance || 0.2} mm`}
                                    />
                                </label>
                                
                                {/* Default Trace Width Override */}
                                <label className="block">
                                    <span className="text-slate-300 text-sm font-medium">Default Trace Width (mm)</span>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={userTraceWidth}
                                        onChange={(e) => setUserTraceWidth(e.target.value)}
                                        className="w-full mt-1 bg-slate-800 text-white p-2 rounded border border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder={`AI Default: ${aiSuggestions.trace_width || 0.2} mm`}
                                    />
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: The Visualizer */}
                <div className="lg:col-span-2 h-[600px] bg-slate-900 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden">
                    <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-slate-700 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-400" /><span className="text-xs font-semibold text-slate-300">Live Preview</span>
                    </div>
                    {vizData ? <PCBViewer data={vizData} /> : <div className="w-full h-full flex items-center justify-center text-slate-600"><CircuitBoard className="w-16 h-16 opacity-20"/></div>}
                </div>
            </div>
        </div>
    );
}

// Simple helper component for consistent layout (If you kept this, great!)
// If not, ensure PCBViewer.js is present.
function RuleCard({ label, value }) {
    return (
      <div className="bg-slate-700/50 p-2 rounded flex justify-between items-center">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-sm font-mono text-white">{value}</span>
      </div>
    );
}