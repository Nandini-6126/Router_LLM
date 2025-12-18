import React, { useState } from 'react';

const DesignRules = ({ onRulesChange }) => {
  // Initialize state with your provided default rules
  const [rules, setRules] = useState({
    grid_step: 0.1,
    clearance: 0.2,
    trace_width: 0.2,
    via_size: 0.6,
    via_drill: 0.3,
    via_cost: 20,
    board_clearance: 0.4,
    via_clearance_extra: 0.1,
    pad_clearance_extra: 0.1,
    pad_opener_safety: 0.05,
    trace_clearance_extra: 0.1,
    default_netclass: "Default",
    netclasses: {
      Default: { trace_width: 0.2, clearance: 0.2, via_size: 0.6, via_drill: 0.3, via_cost: 10, min_via_from_pads: 0.2 },
      POWER: { trace_width: 0.2, clearance: 0.2, via_size: 0.6, via_drill: 0.3, via_cost: 10, min_via_from_pads: 0.2 },
      SWITCH: { trace_width: 0.2, clearance: 0.2, via_size: 0.6, via_drill: 0.3, via_cost: 10, min_via_from_pads: 0.2 },
      FEEDBACK: { trace_width: 0.2, clearance: 0.2, via_cost: 10, min_via_from_pads: 0.2 }
    }
  });

  // Handle updates for top-level global rules
  const handleGlobalChange = (e) => {
    const { name, value } = e.target;
    const updatedValue = name === "default_netclass" ? value : parseFloat(value) || 0;
    const newRules = { ...rules, [name]: updatedValue };
    setRules(newRules);
    onRulesChange(newRules);
  };

  // Handle updates for nested netclass properties
  const handleNetclassChange = (className, field, value) => {
    const newRules = {
      ...rules,
      netclasses: {
        ...rules.netclasses,
        [className]: {
          ...rules.netclasses[className],
          [field]: parseFloat(value) || 0
        }
      }
    };
    setRules(newRules);
    onRulesChange(newRules);
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Design Rule Configuration</h2>
      
      {/* Global Parameters Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(rules).map(([key, val]) => (
          key !== "netclasses" && (
            <div key={key} className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1">
                {key.replace(/_/g, ' ')}
              </label>
              <input
                type={key === "default_netclass" ? "text" : "number"}
                step="0.01"
                name={key}
                value={val}
                onChange={handleGlobalChange}
                className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          )
        ))}
      </div>

      <hr className="my-6 border-gray-200" />

      {/* Netclasses Grid Section */}
      <h3 className="text-xl font-bold text-gray-700 mb-4">🏷️ Net Class Overrides</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(rules.netclasses).map((className) => (
          <div key={className} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-bold text-blue-600 mb-3 border-b border-blue-100 pb-1">{className}</h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(rules.netclasses[className]).map(([field, fieldVal]) => (
                <div key={field} className="flex flex-col">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{field.replace(/_/g, ' ')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fieldVal}
                    onChange={(e) => handleNetclassChange(className, field, e.target.value)}
                    className="p-1 text-sm border border-gray-200 rounded focus:border-blue-400 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DesignRules;