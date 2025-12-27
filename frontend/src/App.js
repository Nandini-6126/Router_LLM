import React, { useEffect, useMemo, useRef, useState } from 'react'; // Added useEffect
import axios from 'axios';
import { 
  Loader2, Upload, BrainCircuit, Eye, CircuitBoard, Settings,
  Layers, History, Clock, FileDown, ZoomIn, ZoomOut, Download
} from 'lucide-react'; // Added History, Clock, FileDown
import PCBViewer from './PCBViewer'; 

export default function App() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [vizData, setVizData] = useState(null);
    const [routingStats, setRoutingStats] = useState({ total: 0, successful: 0, failed: 0 });
    const pcbViewerRef = useRef(null);
    
    // --- DATABASE HISTORY STATE ---
    const [history, setHistory] = useState([]);
    const [sidebarTab, setSidebarTab] = useState('Rules'); // Rules | Netclasses | History
    const [zipDownload, setZipDownload] = useState(null); // { url, filename }

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

    useEffect(() => {
        return () => {
            if (zipDownload?.url) window.URL.revokeObjectURL(zipDownload.url);
        };
    }, [zipDownload]);

    const handleNetclassUpdate = (className, field, value) => {
        setNetclasses(prev => ({
            ...prev,
            [className]: { ...prev[className], [field]: value }
        }));
    };

    const canDownloadZip = !!zipDownload?.url;
    const downloadZip = () => {
        if (!zipDownload?.url) return;
        const link = document.createElement('a');
        link.href = zipDownload.url;
        link.setAttribute('download', zipDownload.filename || 'pcb_router_output.zip');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
        // Prefer server-side download URL (faster than base64-in-JSON).
        formData.append("include_file_data", "false");

        try {
            const response = await axios.post("http://localhost:8000/process-pcb", formData);
            const { visualization, file_data, filename, file_url } = response.data;
            
            setRoutingStats({
                total: visualization.total_connections || 0,
                successful: visualization.routes ? visualization.routes.length : 0,
                failed: visualization.failed_connections ? visualization.failed_connections.length : 0
            });
            setVizData(visualization); 
            
            // --- REFRESH HISTORY LIST ---
            await fetchHistory();

            setStatus("Success! Routing complete.");
            
            // Auto-Download logic (also saved for the bottom toolbar)
            let url = null;
            if (file_url) {
                // Fetch as blob so the toolbar can re-download without reprocessing.
                const fullUrl = file_url.startsWith("http")
                    ? file_url
                    : `http://localhost:8000${file_url}`;
                const zipRes = await axios.get(fullUrl, { responseType: "blob" });
                url = window.URL.createObjectURL(zipRes.data);
            } else if (file_data) {
                // Backward-compatible fallback (older backend)
                const binaryString = window.atob(file_data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: "application/zip" });
                url = window.URL.createObjectURL(blob);
            }

            setZipDownload(prev => {
                if (prev?.url) window.URL.revokeObjectURL(prev.url);
                return { url, filename };
            });

            if (url) {
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

        } catch (error) { setStatus(`Error: Check backend logs.`); } 
        finally { setLoading(false); }
    };

    const sidebarTabs = useMemo(() => ([
        { key: 'Rules', icon: Settings, label: 'Rules' },
        { key: 'Netclasses', icon: Layers, label: 'Netclasses' },
        { key: 'History', icon: History, label: 'History' },
    ]), []);

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-950 text-white">
            {/* Fixed Glass Sidebar */}
            <aside className="fixed inset-y-0 left-0 w-[380px] bg-slate-900/80 backdrop-blur-xl border-r border-slate-800/60 shadow-2xl">
                <div className="h-full flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-3">
                        <CircuitBoard className="text-blue-400 w-7 h-7" />
                        <div className="flex flex-col leading-tight">
                            <div className="text-sm font-semibold text-slate-100">AI PCB Router</div>
                            <div className="text-[10px] text-slate-400">Desktop routing workspace</div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 custom-scrollbar">
                        {/* Upload */}
                        <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/70 shadow-xl transition-all duration-200 hover:border-slate-700/80">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                                    <Upload className="w-4 h-4 text-blue-400" /> Upload
                                </h2>
                                {status && (
                                    <span className="text-[10px] text-emerald-400 font-bold truncate max-w-[200px]">{status}</span>
                                )}
                            </div>
                            <div className="border border-dashed border-slate-700/80 rounded-lg p-4 text-center relative mb-3 hover:border-blue-500/80 transition-colors">
                                <input
                                    type="file"
                                    accept=".kicad_pcb"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="text-slate-400 w-5 h-5" />
                                    <p className="text-slate-400 text-xs">{file ? file.name : "Select .kicad_pcb"}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleUpload}
                                disabled={loading}
                                className={[
                                    "w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2",
                                    "transition-all duration-200",
                                    loading
                                        ? "bg-slate-800/70 text-slate-500 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5 active:translate-y-0",
                                ].join(" ")}
                            >
                                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />}
                                {loading ? "Processing..." : "Run Auto-Router"}
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="bg-slate-950/40 rounded-xl border border-slate-800/70 shadow-xl overflow-hidden">
                            <div className="p-3 border-b border-slate-800/60">
                                <div className="grid grid-cols-3 gap-2 bg-slate-900/40 p-1 rounded-lg border border-slate-800/60">
                                    {sidebarTabs.map((t) => {
                                        const Icon = t.icon;
                                        const active = sidebarTab === t.key;
                                        return (
                                            <button
                                                key={t.key}
                                                onClick={() => setSidebarTab(t.key)}
                                                className={[
                                                    "flex items-center justify-center gap-2 py-2 rounded-md text-[11px] font-semibold",
                                                    "transition-all duration-200",
                                                    active
                                                        ? "bg-slate-900/80 text-slate-100 shadow"
                                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40",
                                                ].join(" ")}
                                            >
                                                <Icon className="w-4 h-4" />
                                                {t.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-3">
                                {sidebarTab === 'Rules' && (
                                    <div className="space-y-3">
                                        <CollapsibleCard
                                            title="Global Rules"
                                            icon={Settings}
                                            defaultOpen
                                        >
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
                                        </CollapsibleCard>

                                        <CollapsibleCard
                                            title="Advanced Overrides (JSON)"
                                            subtitle="If provided, JSON overrides will be used instead of the form."
                                            icon={Settings}
                                        >
                                            <textarea
                                                value={userJsonRules}
                                                onChange={(e) => setUserJsonRules(e.target.value)}
                                                placeholder='{"clearance":0.2,"trace_width":0.25,"netclasses":{"POWER":{"trace_width":0.6}}}'
                                                className="w-full min-h-[120px] bg-slate-950/70 text-slate-100 px-3 py-2 rounded-lg border border-slate-800 focus:border-blue-500 outline-none text-[11px] font-mono transition-colors"
                                            />
                                        </CollapsibleCard>
                                    </div>
                                )}

                                {sidebarTab === 'Netclasses' && (
                                    <div className="space-y-3">
                                        <CollapsibleCard title="Netclass Overrides" icon={Layers} defaultOpen>
                                            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                                                {Object.keys(netclasses).map(cls => (
                                                    <div key={cls} className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/70 transition-colors hover:border-slate-700/80">
                                                        <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2">{cls} Class</h3>
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
                                        </CollapsibleCard>
                                    </div>
                                )}

                                {sidebarTab === 'History' && (
                                    <div className="space-y-3">
                                        <CollapsibleCard title="Routing History" icon={History} defaultOpen>
                                            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-2 custom-scrollbar">
                                                {history.length === 0 ? (
                                                    <p className="text-slate-500 text-[11px] text-center py-6 italic">No history records yet.</p>
                                                ) : (
                                                    history.map((job) => (
                                                        <div
                                                            key={job.id}
                                                            className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/70 flex justify-between items-center group transition-all duration-200 hover:border-slate-700/80 hover:-translate-y-0.5"
                                                        >
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[11px] font-mono text-blue-300 truncate w-44">{job.filename}</span>
                                                                <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(job.timestamp).toLocaleString()}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={[
                                                                    "text-[11px] font-bold",
                                                                    (job.success_rate * 100) > 80 ? 'text-emerald-400' : 'text-yellow-400',
                                                                ].join(' ')}>
                                                                    {(job.success_rate * 100).toFixed(1)}%
                                                                </div>
                                                                <FileDown className="w-4 h-4 text-slate-600 ml-auto mt-1 cursor-not-allowed opacity-50" />
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </CollapsibleCard>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Viewer */}
            <main className="ml-[380px] h-screen">
                <div className="h-full relative">
                    <div className="absolute inset-0 p-4">
                        <div className="h-full w-full bg-slate-900/30 border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden relative">
                            <div className="absolute inset-0">
                                {vizData ? (
                                    <PCBViewer ref={pcbViewerRef} data={vizData} />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                        <div className="text-slate-500 font-mono text-sm flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-slate-600" />
                                            Upload a <span className="text-slate-300">.kicad_pcb</span> to begin…
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Top HUD */}
                            <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
                                <div className="pointer-events-auto inline-flex items-center gap-3 bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-xl px-3 py-2 shadow-lg">
                                    <div className="flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Viewer</span>
                                    </div>
                                    <div className="h-4 w-px bg-slate-700/60" />
                                    <div className="text-[11px] text-slate-300">
                                        Routes: <span className="text-slate-100 font-semibold">{routingStats.successful}</span>
                                        <span className="text-slate-500"> / </span>
                                        <span className="text-slate-400">{routingStats.total}</span>
                                        <span className="text-slate-500"> • </span>
                                        Failed: <span className="text-rose-300 font-semibold">{routingStats.failed}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Floating bottom toolbar */}
                            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                                <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/70 backdrop-blur-xl border border-slate-800/60 rounded-2xl px-2 py-2 shadow-2xl">
                                    <ToolbarButton
                                        label="Zoom Out"
                                        icon={ZoomOut}
                                        onClick={() => pcbViewerRef.current?.zoomOut?.()}
                                        disabled={!vizData}
                                    />
                                    <ToolbarButton
                                        label="Zoom In"
                                        icon={ZoomIn}
                                        onClick={() => pcbViewerRef.current?.zoomIn?.()}
                                        disabled={!vizData}
                                    />
                                    <div className="h-7 w-px bg-slate-700/60 mx-1" />
                                    <ToolbarButton
                                        label="Download ZIP"
                                        icon={Download}
                                        onClick={downloadZip}
                                        disabled={!canDownloadZip}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

const RuleInput = ({ label, state, setState, type = "number" }) => (
    <div className="flex flex-col gap-1">
        <label className="text-slate-500 text-[9px] uppercase font-bold">{label}</label>
        <input type={type} step="0.01" value={state} onChange={(e) => setState(e.target.value)}
               className="w-full bg-slate-950/70 text-white px-2 py-1.5 rounded border border-slate-800 focus:border-blue-500 text-[10px] outline-none transition-colors" />
    </div>
);

const ToolbarButton = ({ label, icon: Icon, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={[
            "group flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold",
            "transition-all duration-200",
            disabled
                ? "text-slate-500 bg-slate-800/40 cursor-not-allowed"
                : "text-slate-100 bg-slate-950/40 hover:bg-slate-800/50 hover:-translate-y-0.5 active:translate-y-0",
            "border border-slate-800/60",
        ].join(" ")}
        aria-label={label}
        title={label}
    >
        <Icon className={["w-4 h-4", disabled ? "text-slate-600" : "text-blue-300 group-hover:text-blue-200"].join(" ")} />
        <span className="hidden sm:inline">{label}</span>
    </button>
);

const CollapsibleCard = ({ title, subtitle, icon: Icon, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-900/30"
            >
                <div className="flex items-center gap-2 min-w-0">
                    {Icon ? <Icon className="w-4 h-4 text-emerald-300/90" /> : null}
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">{title}</div>
                        {subtitle ? <div className="text-[10px] text-slate-500 mt-0.5 truncate">{subtitle}</div> : null}
                    </div>
                </div>
                <div className={["text-[10px] font-bold", open ? "text-slate-300" : "text-slate-500"].join(" ")}>
                    {open ? "Hide" : "Show"}
                </div>
            </button>
            <div
                className={[
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                ].join(" ")}
            >
                <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};