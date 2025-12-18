import React, { useState, useEffect } from 'react'; // Added useEffect
import axios from 'axios';
import { 
  Loader2, Upload, BrainCircuit, Eye, CircuitBoard, Settings, 
  Code, CheckCircle, XCircle, BarChart3, Layers, History, Clock, FileDown 
} from 'lucide-react'; // Added History, Clock, FileDown
import PCBViewer from './PCBViewer'; 

const getRuleValue = (suggestions, key) => suggestions && suggestions[key] !== undefined ? suggestions[key] : 'N/A';

export default function App() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [vizData, setVizData] = useState(null);
    const [routingStats, setRoutingStats] = useState({ total: 0, successful: 0, failed: 0 });
    
    // --- DATABASE HISTORY STATE ---
    const [history, setHistory] = useState([]);

    // --- GLOBAL RULE STATES ---
    const [userGridStep, setUserGridStep] = useState('');
    const [userClearance, setUserClearance] = useState('');
    const [userTraceWidth, setUserTraceWidth] = useState('');
    const [userViaSize, setUserViaSize] = useState('');
    const [userViaDrill, setUserViaDrill] = useState('');
    const [userViaCost, setUserViaCost] = useState('');
    const [userBoardClearance, setUserBoardClearance] = useState('');
    const [userViaClearExtra, setUserViaClearExtra] = useState('');
    const [userPadClearExtra, setUserPadClearExtra] = useState('');
    const [userPadOpenerSafety, setUserPadOpenerSafety] = useState('');
    const [userTraceClearExtra, setUserTraceClearExtra] = useState('');
    
    // --- NETCLASS STATES ---
    const [netclasses, setNetclasses] = useState({
        Default: { trace_width: '', clearance: '', via_size: '', via_drill: '', via_cost: '', min_via_from_pads: '' },
        POWER: { trace_width: '', clearance: '', via_size: '', via_drill: '', via_cost: '', min_via_from_pads: '' },
        SWITCH: { trace_width: '', clearance: '', via_size: '', via_drill: '', via_cost: '', min_via_from_pads: '' },
        FEEDBACK: { trace_width: '', clearance: '', via_cost: '', min_via_from_pads: '' }
    });

    const [userJsonRules, setUserJsonRules] = useState(''); 

    // --- FETCH HISTORY ON LOAD ---
    const fetchHistory = async () => {
        try {
            const response = await axios.get("http://localhost:8000/history");
            setHistory(response.data);
        } catch (err) {
            console.error("Could not fetch history", err);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleNetclassUpdate = (className, field, value) => {
        setNetclasses(prev => ({
            ...prev,
            [className]: { ...prev[className], [field]: value }
        }));
    };

    const handleUpload = async () => {
        if (!file) { setStatus("Please select a file first."); return; }
        setLoading(true); setStatus("Processing PCB Design..."); 
        
        let finalUserRules = "{}";

        if (userJsonRules.trim() !== '') {
            finalUserRules = userJsonRules;
        } else {
            const userOverrides = { netclasses: {} };
            const globals = {
                grid_step: userGridStep, clearance: userClearance, trace_width: userTraceWidth,
                via_size: userViaSize, via_drill: userViaDrill, via_cost: userViaCost,
                board_clearance: userBoardClearance, via_clearance_extra: userViaClearExtra,
                pad_clearance_extra: userPadClearExtra, pad_opener_safety: userPadOpenerSafety,
                trace_clearance_extra: userTraceClearExtra
            };
            
            Object.entries(globals).forEach(([k, v]) => { if(v !== '') userOverrides[k] = parseFloat(v); });

            Object.entries(netclasses).forEach(([className, fields]) => {
                const classObj = {};
                Object.entries(fields).forEach(([f, v]) => { if(v !== '') classObj[f] = parseFloat(v); });
                if(Object.keys(classObj).length > 0) userOverrides.netclasses[className] = classObj;
            });
            
            finalUserRules = JSON.stringify(userOverrides);
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_rules_json", finalUserRules); 

        try {
            const response = await axios.post("http://localhost:8000/process-pcb", formData);
            const { ai_suggestions, visualization, file_data, filename } = response.data;
            
            setRoutingStats({
                total: visualization.total_connections || 0,
                successful: visualization.routes ? visualization.routes.length : 0,
                failed: visualization.failed_connections ? visualization.failed_connections.length : 0
            });
            setAiSuggestions(ai_suggestions); 
            setVizData(visualization); 
            
            // --- REFRESH HISTORY LIST ---
            await fetchHistory();

            setStatus("Success! Routing complete.");
            
            // Auto-Download logic
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

        } catch (error) { setStatus(`Error: Check backend logs.`); } 
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center">
            <div className="w-full max-w-6xl flex items-center gap-3 mb-8">
                <CircuitBoard className="text-blue-500 w-10 h-10" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">AI PCB Router</h1>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6 lg:col-span-1">
                    {/* Upload Card */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-400"/> Step 1: Input Board</h2>
                        <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center relative mb-4 hover:border-blue-500 transition-colors">
                            <input type="file" accept=".kicad_pcb" onChange={(e) => setFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="flex flex-col items-center gap-2"><Upload className="text-slate-400"/><p className="text-slate-400 text-sm">{file ? file.name : "Select .kicad_pcb"}</p></div>
                        </div>
                        <button onClick={handleUpload} disabled={loading} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${loading ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                            {loading ? <Loader2 className="animate-spin" /> : <BrainCircuit />} {loading ? "Processing..." : "Run Auto-Router"}
                        </button>
                    </div>

                    {/* Global Design Rules Card */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                        <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> Global Rules</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <RuleInput label="Grid Step" state={userGridStep} setState={setUserGridStep} />
                            <RuleInput label="Clearance" state={userClearance} setState={setUserClearance} />
                            <RuleInput label="Trace Width" state={userTraceWidth} setState={setUserTraceWidth} />
                            <RuleInput label="Via Size" state={userViaSize} setState={setUserViaSize} />
                            <RuleInput label="Via Drill" state={userViaDrill} setState={setUserViaDrill} />
                            <RuleInput label="Via Cost" state={userViaCost} setState={setUserViaCost} />
                            <RuleInput label="Board Edge" state={userBoardClearance} setState={setUserBoardClearance} />
                            <RuleInput label="Via Extra" state={userViaClearExtra} setState={setUserViaClearExtra} />
                            <RuleInput label="Pad Extra" state={userPadClearExtra} setState={setUserPadClearExtra} />
                            <RuleInput label="Opener Safety" state={userPadOpenerSafety} setState={setUserPadOpenerSafety} />
                            <RuleInput label="Trace Extra" state={userTraceClearExtra} setState={setUserTraceClearExtra} />
                        </div>
                    </div>

                    {/* Netclass Overrides Card */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                        <h2 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2"><Layers className="w-5 h-5"/> Netclass Overrides</h2>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.keys(netclasses).map(cls => (
                                <div key={cls} className="p-3 bg-slate-950 rounded border border-slate-800">
                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-2">{cls} Class</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.keys(netclasses[cls]).map(field => (
                                            <RuleInput 
                                                key={field} 
                                                label={field.replace(/_/g, ' ')} 
                                                state={netclasses[cls][field]} 
                                                setState={(val) => handleNetclassUpdate(cls, field, val)} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* NEW: Routing History Card */}
                    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
                        <h2 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
                            <History className="w-5 h-5"/> Routing History
                        </h2>
                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {history.length === 0 ? (
                                <p className="text-slate-500 text-[10px] text-center py-4 italic">No history records yet.</p>
                            ) : (
                                history.map((job) => (
                                    <div key={job.id} className="p-3 bg-slate-950 rounded border border-slate-800 flex justify-between items-center group">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-mono text-blue-300 truncate w-32">{job.filename}</span>
                                            <div className="flex items-center gap-1 text-slate-500 text-[8px]">
                                                <Clock className="w-2 h-2" />
                                                {new Date(job.timestamp).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-[10px] font-bold ${(job.success_rate * 100) > 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                                {(job.success_rate * 100).toFixed(1)}%
                                            </div>
                                            <FileDown className="w-3 h-3 text-slate-600 ml-auto mt-1 cursor-not-allowed opacity-50" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Live Preview Column */}
                <div className="lg:col-span-2 h-[1050px] bg-slate-900 rounded-xl border border-slate-800 shadow-2xl relative flex flex-col">
                    <div className="p-4 border-b border-slate-800 flex justify-between bg-slate-900/50 z-10">
                        <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-blue-400" /><span className="text-xs font-semibold text-slate-300 uppercase">Live Preview</span></div>
                        {status && <span className="text-[10px] text-emerald-400 animate-pulse font-bold">{status}</span>}
                    </div>
                    <div className="flex-grow relative flex items-center justify-center">
                        {vizData ? <PCBViewer data={vizData} /> : <div className="text-slate-700 font-mono text-sm">Upload a .kicad_pcb to begin...</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

const RuleInput = ({ label, state, setState, type = "number" }) => (
    <div className="flex flex-col gap-1">
        <label className="text-slate-500 text-[9px] uppercase font-bold">{label}</label>
        <input type={type} step="0.01" value={state} onChange={(e) => setState(e.target.value)}
               className="w-full bg-slate-950 text-white px-2 py-1.5 rounded border border-slate-800 focus:border-blue-500 text-[10px] outline-none transition-colors" />
    </div>
);