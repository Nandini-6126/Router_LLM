import React, { useState } from 'react';
import axios from 'axios';
import { Loader2, Upload, BrainCircuit, Eye, CircuitBoard, Settings, Code, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import PCBViewer from './PCBViewer'; 

// Function to safely get a value from the suggestions object
const getRuleValue = (suggestions, key) => suggestions && suggestions[key] !== undefined ? suggestions[key] : 'N/A';
const getNetclassValue = (suggestions, key) => suggestions && suggestions.netclasses && suggestions.netclasses.Default && suggestions.netclasses.Default[key] !== undefined ? suggestions.netclasses.Default[key] : 'N/A';

export default function App() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [vizData, setVizData] = useState(null);
    
    // --- ROUTING STATISTICS STATE ---
    const [routingStats, setRoutingStats] = useState({ total: 0, successful: 0, failed: 0 });

    // --- RULE OVERRIDE STATES ---
    const [userGridStep, setUserGridStep] = useState('');
    const [userClearance, setUserClearance] = useState('');
    const [userTraceWidth, setUserTraceWidth] = useState('');
    const [userViaSize, setUserViaSize] = useState('');
    const [userViaDrill, setUserViaDrill] = useState('');
    const [userViaCost, setUserViaCost] = useState('');
    const [userBoardClearance, setUserBoardClearance] = useState('');
    
    const [userJsonRules, setUserJsonRules] = useState(''); 

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            setStatus("");
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setStatus("Please select a file first.");
            return;
        }
        setLoading(true); 
        setStatus("Processing PCB Design..."); 
        
        let finalUserRules = "{}";

        // 1. Prioritize Expert Full JSON Input
        if (userJsonRules.trim() !== '') {
            finalUserRules = userJsonRules;
        } else {
            // 2. Fallback to Simple Input Overrides
            const userOverrides = {};
            if (userGridStep !== '') userOverrides.grid_step = parseFloat(userGridStep);
            if (userClearance !== '') userOverrides.clearance = parseFloat(userClearance);
            if (userTraceWidth !== '') userOverrides.trace_width = parseFloat(userTraceWidth);
            if (userViaSize !== '') userOverrides.via_size = parseFloat(userViaSize);
            if (userViaDrill !== '') userOverrides.via_drill = parseFloat(userViaDrill);
            if (userViaCost !== '') userOverrides.via_cost = parseInt(userViaCost, 10);
            if (userBoardClearance !== '') userOverrides.board_clearance = parseFloat(userBoardClearance);
            
            finalUserRules = JSON.stringify(userOverrides);
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_rules_json", finalUserRules); 

        try {
            const response = await axios.post("http://localhost:8000/process-pcb", formData);
            
            const { ai_suggestions, visualization, file_data, filename } = response.data;
            
            // Extract stats
            const total = visualization.total_connections || 0;
            const successful = visualization.routes ? visualization.routes.length : 0;
            const failed = visualization.failed_connections ? visualization.failed_connections.length : (total - successful);
            
            setRoutingStats({ total, successful, failed });
            setAiSuggestions(ai_suggestions); 
            setVizData(visualization); 

            // Handle Download
            const binaryString = window.atob(file_data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "application/zip" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setStatus("Success! Routing complete.");

        } catch (error) {
            console.error(error);
            setStatus(`Error: Check backend logs.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center">
            
            <div className="w-full max-w-6xl flex items-center gap-3 mb-8">
                <CircuitBoard className="text-blue-500 w-10 h-10" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    AI PCB Router
                </h1>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <div className="space-y-6 lg:col-span-1">
                    
                    {/* 1. Upload Card */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-blue-400"/> Step 1: Input Board
                        </h2>
                        
                        <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center relative mb-4 hover:border-blue-500 transition-colors">
                            <input type="file" accept=".kicad_pcb" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="text-slate-400"/>
                                <p className="text-slate-400 text-sm">{file ? file.name : "Select .kicad_pcb"}</p>
                            </div>
                        </div>

                        <button onClick={handleUpload} disabled={loading} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${loading ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                            {loading ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
                            {loading ? "Processing..." : "Run Auto-Router"}
                        </button>
                        {status && <p className="text-center text-xs mt-3 text-emerald-400 font-medium">{status}</p>}
                    </div>

                    {/* 2. Routing Statistics Card (Shows after run) */}
                    {routingStats.total > 0 && (
                        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-yellow-400"/> Routing Summary
                            </h2>
                            <div className="space-y-2">
                                <StatItem label="Total Connections" value={routingStats.total} color="text-blue-400" />
                                <StatItem label="Successful" value={routingStats.successful} icon={CheckCircle} color="text-emerald-400" />
                                <StatItem label="Failed" value={routingStats.failed} icon={XCircle} color="text-red-400" />
                                <div className="pt-2 mt-2 border-t border-slate-800">
                                    <StatItem label="Efficiency" value={`${(routingStats.successful / routingStats.total * 100).toFixed(2)}%`} color="text-yellow-400 font-bold" />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* 3. Simple Rule Override Card (ALWAY VISIBLE NOW) */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                        <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                            <Settings className="w-5 h-5"/> Step 2: Design Rules
                        </h2>
                        <p className="text-xs text-slate-500 mb-4">Provide manual overrides below, or leave empty for AI to decide.</p>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                            <RuleInput label="Grid Step" placeholder={aiSuggestions ? `AI: ${getRuleValue(aiSuggestions, 'grid_step')}` : "e.g. 0.2"} state={userGridStep} setState={setUserGridStep} />
                            <RuleInput label="Clearance" placeholder={aiSuggestions ? `AI: ${getRuleValue(aiSuggestions, 'clearance')}` : "e.g. 0.2"} state={userClearance} setState={setUserClearance} />
                            <RuleInput label="Trace Width" placeholder={aiSuggestions ? `AI: ${getNetclassValue(aiSuggestions, 'trace_width')}` : "e.g. 0.25"} state={userTraceWidth} setState={setUserTraceWidth} />
                            <RuleInput label="Via Size" placeholder={aiSuggestions ? `AI: ${getRuleValue(aiSuggestions, 'via_size')}` : "e.g. 0.6"} state={userViaSize} setState={setUserViaSize} />
                            <RuleInput label="Via Drill" placeholder={aiSuggestions ? `AI: ${getRuleValue(aiSuggestions, 'via_drill')}` : "e.g. 0.3"} state={userViaDrill} setState={setUserViaDrill} />
                            <RuleInput label="Via Cost" placeholder={aiSuggestions ? `AI: ${getRuleValue(aiSuggestions, 'via_cost')}` : "e.g. 10"} state={userViaCost} setState={setUserViaCost} type="number" />
                            <div className="col-span-2">
                                <RuleInput label="Board Edge Clearance (mm)" placeholder={aiSuggestions ? `AI: ${getRuleValue(aiSuggestions, 'board_clearance')}` : "e.g. 0.5"} state={userBoardClearance} setState={setUserBoardClearance} />
                            </div>
                        </div>
                    </div>
                    
                    {/* 4. Expert Card (ALWAYS VISIBLE NOW) */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                        <h2 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
                            <Code className="w-5 h-5"/> Expert JSON
                        </h2>
                        <textarea
                            value={userJsonRules}
                            onChange={(e) => setUserJsonRules(e.target.value)}
                            rows="4"
                            className="w-full bg-slate-950 text-blue-300 p-3 rounded-lg border border-slate-700 font-mono text-[10px] focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder='{"clearance": 0.2, ...}'
                        />
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-2 h-[750px] bg-slate-900 rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md z-10">
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Live Preview</span>
                        </div>
                    </div>
                    <div className="flex-grow relative flex items-center justify-center">
                        {vizData ? <PCBViewer data={vizData} /> : <div className="text-slate-700">Waiting for board data...</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

const RuleInput = ({ label, placeholder, state, setState, type = "number" }) => (
    <div className="flex flex-col gap-1">
        <label className="text-slate-400 text-[10px] uppercase font-bold tracking-tight">{label}</label>
        <input 
            type={type}
            step="0.01"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full bg-slate-950 text-white px-3 py-2 rounded-md border border-slate-700 focus:border-blue-500 text-xs outline-none"
            placeholder={placeholder}
        />
    </div>
);

const StatItem = ({ label, value, icon: Icon, color }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
        <div className="flex items-center gap-2 text-slate-400">
            {Icon && <Icon className={`w-4 h-4 ${color}`} />}
            <span className="text-xs">{label}</span>
        </div>
        <span className={`text-sm font-mono font-bold ${color}`}>{value}</span>
    </div>
);