import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { KnowledgeGraph, GraphNode, GraphEdge } from '../types';
import { 
  X, Maximize, ZoomIn, ZoomOut, Search, Activity, Share2, Info, 
  Download, Settings2, Sliders, Layers, Network, Focus, Users, 
  Zap, Magnet, GitBranch, Minimize 
} from 'lucide-react';

interface Props {
  data: KnowledgeGraph;
  onClose: () => void;
}

// Extend types for internal graph logic
interface ExtendedNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  val?: number; // visual size
  neighbors?: ExtendedNode[];
  links?: ExtendedLink[];
}

interface ExtendedLink extends Omit<GraphEdge, 'source' | 'target'> {
  source: ExtendedNode;
  target: ExtendedNode;
}

const KnowledgeGraphViewer: React.FC<Props> = ({ data, onClose }) => {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Layout State
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [selectedNode, setSelectedNode] = useState<ExtendedNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<ExtendedLink>>(new Set());
  const [hoverNode, setHoverNode] = useState<ExtendedNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customization State
  const [showSettings, setShowSettings] = useState(false);
  const [groupByType, setGroupByType] = useState(false);
  const [pruneLeafNodes, setPruneLeafNodes] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [physics, setPhysics] = useState({
    charge: -100,
    linkDistance: 50,
    particleSpeed: 0.0
  });

  // Resize handler
  useEffect(() => {
    const updateDimensions = () => {
        if (containerRef.current) {
            setDimensions({
                w: containerRef.current.clientWidth,
                h: containerRef.current.clientHeight
            });
        }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Process Graph Data
  const { graphData, metrics, topNodes } = useMemo(() => {
    // 1. Deep clone to prevent mutation issues
    let nodes: ExtendedNode[] = data.nodes.map(n => ({ ...n, neighbors: [], links: [], val: 1 }));
    let links = data.edges.map(e => ({ ...e }));

    // 2. Build map & calculate neighbors (Perform this BEFORE filtering to know degree)
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const linkObjs: ExtendedLink[] = [];

    links.forEach(link => {
        const source = nodeMap.get(link.source as any);
        const target = nodeMap.get(link.target as any);
        if (source && target) {
            source.neighbors?.push(target);
            target.neighbors?.push(source);
            source.val = (source.val || 1) + 0.5;
            target.val = (target.val || 1) + 0.5;
            
            // @ts-ignore - temporary link object construction
            linkObjs.push({ ...link, source, target });
        }
    });

    // 3. Filtering Logic
    let activeNodes = nodes;
    let activeLinks = linkObjs;

    // A. Focus Mode (Isolate Subgraph)
    if (focusNodeId) {
        const focusNode = nodeMap.get(focusNodeId);
        if (focusNode) {
            const allowedIds = new Set([focusNodeId, ...(focusNode.neighbors?.map(n => n.id) || [])]);
            activeNodes = activeNodes.filter(n => allowedIds.has(n.id));
            activeLinks = activeLinks.filter(l => allowedIds.has(l.source.id) && allowedIds.has(l.target.id));
        }
    } 
    // B. Leaf Pruning (Only if not focused)
    else if (pruneLeafNodes) {
        activeNodes = activeNodes.filter(n => (n.neighbors?.length || 0) > 1);
        const activeIds = new Set(activeNodes.map(n => n.id));
        activeLinks = activeLinks.filter(l => activeIds.has(l.source.id) && activeIds.has(l.target.id));
    }

    // 4. Recalculate metrics for the visible graph
    const density = activeNodes.length > 1 ? (2 * activeLinks.length) / (activeNodes.length * (activeNodes.length - 1)) : 0;
    const sortedNodes = [...activeNodes].sort((a, b) => (b.val || 0) - (a.val || 0));

    return {
        graphData: { nodes: activeNodes, links: activeLinks },
        metrics: {
            nodeCount: activeNodes.length,
            edgeCount: activeLinks.length,
            density: density.toFixed(3),
            avgDegree: activeNodes.length ? (activeLinks.length / activeNodes.length * 2).toFixed(1) : '0'
        },
        topNodes: sortedNodes.slice(0, 5)
    };
  }, [data, pruneLeafNodes, focusNodeId]);

  // Apply Physics Updates
  useEffect(() => {
    if (!fgRef.current) return;
    
    // Charge (Repulsion)
    fgRef.current.d3Force('charge')?.strength(physics.charge);
    
    // Link Distance
    fgRef.current.d3Force('link')?.distance(physics.linkDistance);

    // Clustering Force
    if (groupByType) {
        const typeFoci: Record<string, {x: number, y: number}> = {
            'Person': { x: -150, y: -100 },
            'Organization': { x: 150, y: -100 },
            'Location': { x: 0, y: 150 },
            'default': { x: 0, y: 0 }
        };

        fgRef.current.d3Force('cluster', (alpha: any) => {
            for (const node of graphData.nodes) {
                const type = node.type || 'default';
                let focus = typeFoci['default'];
                for (const key in typeFoci) {
                    if (type.includes(key)) {
                        focus = typeFoci[key];
                        break;
                    }
                }
                
                if (node.vx !== undefined && node.vy !== undefined && node.x !== undefined && node.y !== undefined) {
                    node.vx += (focus.x - node.x) * alpha * 0.1;
                    node.vy += (focus.y - node.y) * alpha * 0.1;
                }
            }
        });
    } else {
        fgRef.current.d3Force('cluster', null);
    }

    fgRef.current.d3ReheatSimulation();
  }, [physics, groupByType, graphData]);

  // Handlers
  const handleNodeClick = useCallback((node: ExtendedNode) => {
    setSelectedNode(node);
    
    // Highlight logic
    const newHighlightNodes = new Set<string>([node.id]);
    const newHighlightLinks = new Set<ExtendedLink>();
    
    graphData.links.forEach((link: any) => {
        if (link.source.id === node.id || link.target.id === node.id) {
            newHighlightLinks.add(link);
            newHighlightNodes.add(link.source.id);
            newHighlightNodes.add(link.target.id);
        }
    });

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);

    fgRef.current?.centerAt(node.x, node.y, 1000);
    fgRef.current?.zoom(4, 2000);
  }, [graphData]);

  const handleBackgroundClick = () => {
    setSelectedNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.toLowerCase();
    if (!query) return;

    const match = graphData.nodes.find(n => n.label.toLowerCase().includes(query));
    if (match) {
        handleNodeClick(match);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Rendering
  const NODE_R = 6;
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = selectedNode?.id === node.id;
    const isHighlighted = highlightNodes.has(node.id);
    const isHovered = hoverNode?.id === node.id;
    const isDimmed = (selectedNode || hoverNode || highlightNodes.size > 0) && !isHighlighted && !isSelected && !isHovered;

    let fill = '#64748b';
    const type = node.type?.toLowerCase() || '';
    if (type.includes('person')) fill = '#3b82f6';
    else if (type.includes('org')) fill = '#a855f7';
    else if (type.includes('loc')) fill = '#10b981';
    
    ctx.globalAlpha = isDimmed ? 0.2 : 1;

    if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, NODE_R * 1.5, 0, 2 * Math.PI, false);
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_R, 0, 2 * Math.PI, false);
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.strokeStyle = isSelected ? '#fff' : '#1e293b';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    const shouldShowLabel = globalScale > 2.5 || isSelected || isHovered || topNodes.includes(node);
    if (shouldShowLabel) {
        const fontSize = 12 / globalScale;
        ctx.font = `${isSelected ? 'bold' : ''} ${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isSelected ? '#fff' : 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(node.label, node.x, node.y + NODE_R + fontSize);
    }
    
    ctx.globalAlpha = 1;
  }, [selectedNode, highlightNodes, hoverNode, topNodes]);

  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
     const isSelected = highlightLinks.has(link);
     const isDimmed = (selectedNode || hoverNode || highlightNodes.size > 0) && !isSelected;
     ctx.globalAlpha = isDimmed ? 0.1 : 1;

     ctx.beginPath();
     ctx.moveTo(link.source.x, link.source.y);
     ctx.lineTo(link.target.x, link.target.y);
     ctx.strokeStyle = isSelected ? '#94a3b8' : '#334155';
     ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale;
     ctx.stroke();
     
     // Particles for traffic/activity effect
     if (physics.particleSpeed > 0 && !isDimmed) {
         // ForceGraph2D handles particles via linkDirectionalParticles prop, 
         // but calculating here for custom rendering is hard. 
         // We'll rely on props passed to component.
     }

     ctx.globalAlpha = 1;
  }, [selectedNode, highlightLinks, hoverNode, physics.particleSpeed]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-brand-dark border border-slate-700 rounded-xl w-full h-full flex shadow-2xl overflow-hidden relative">
         
         <div ref={containerRef} className="flex-1 relative bg-slate-950 overflow-hidden cursor-move">
            
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
                <div className="bg-brand-panel/90 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-lg pointer-events-auto flex items-center gap-3">
                    <div className="p-2 bg-brand-accent/20 rounded text-brand-accent">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-sm">Knowledge Graph</h2>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span><span className="text-white font-mono">{metrics.nodeCount}</span> Nodes</span>
                            <span className="w-px h-3 bg-slate-700"></span>
                            <span><span className="text-white font-mono">{metrics.edgeCount}</span> Edges</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                     <form onSubmit={handleSearch} className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Find entity..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            dir="auto"
                            className="bg-slate-900 border border-slate-700 text-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm w-48 focus:w-64 transition-all focus:outline-none focus:border-brand-accent"
                        />
                     </form>
                     
                     <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 border rounded-lg transition-colors ${showSettings ? 'bg-brand-accent text-white border-brand-accent' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                        title="Graph Settings"
                     >
                        <Settings2 size={20} />
                     </button>
                     
                     <button onClick={handleExport} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">
                        <Download size={20} />
                     </button>

                     <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 rounded-lg text-slate-400 transition-colors">
                        <X size={20} />
                     </button>
                </div>
            </div>

            {/* Settings Overlay */}
            {showSettings && (
                <div className="absolute top-20 right-4 z-20 w-64 bg-brand-panel/95 backdrop-blur border border-slate-700 rounded-lg shadow-2xl p-4 animate-in slide-in-from-right-4 pointer-events-auto">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Sliders size={14} /> View Controls</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 font-semibold mb-2 block flex items-center gap-1"><Layers size={12}/> Layout</label>
                            <div className="space-y-2">
                                <button 
                                    onClick={() => setGroupByType(!groupByType)}
                                    className={`w-full text-xs flex items-center justify-between px-3 py-2 rounded border ${groupByType ? 'bg-brand-accent/20 border-brand-accent text-brand-accent' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                                >
                                    <span>Cluster by Type</span>
                                    {groupByType && <Users size={12} />}
                                </button>
                                <button 
                                    onClick={() => setPruneLeafNodes(!pruneLeafNodes)}
                                    disabled={!!focusNodeId}
                                    className={`w-full text-xs flex items-center justify-between px-3 py-2 rounded border ${pruneLeafNodes ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-900 border-slate-700 text-slate-400'} ${focusNodeId ? 'opacity-50' : ''}`}
                                >
                                    <span>Hide Leaf Nodes</span>
                                    {pruneLeafNodes && <GitBranch size={12} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 font-semibold mb-2 block flex items-center gap-1"><Zap size={12}/> Physics</label>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                        <span>Repulsion</span>
                                        <span>{Math.abs(physics.charge)}</span>
                                    </div>
                                    <input 
                                        type="range" min="10" max="500" 
                                        value={Math.abs(physics.charge)}
                                        onChange={(e) => setPhysics(p => ({...p, charge: -Number(e.target.value)}))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                        <span>Link Distance</span>
                                        <span>{physics.linkDistance}</span>
                                    </div>
                                    <input 
                                        type="range" min="10" max="200" 
                                        value={physics.linkDistance}
                                        onChange={(e) => setPhysics(p => ({...p, linkDistance: Number(e.target.value)}))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Render Graph */}
            {dimensions.w > 0 && (
                <ForceGraph2D
                    ref={fgRef}
                    width={dimensions.w}
                    height={dimensions.h}
                    graphData={graphData}
                    
                    nodeLabel="label"
                    nodeRelSize={NODE_R}
                    
                    nodeCanvasObject={paintNode}
                    linkCanvasObject={paintLink}
                    
                    onNodeClick={handleNodeClick}
                    onNodeHover={setHoverNode}
                    onBackgroundClick={handleBackgroundClick}
                    
                    cooldownTicks={100}
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.3}
                    
                    backgroundColor="#020617"
                    enableNodeDrag={true}
                    enableZoomInteraction={true}
                    
                    linkDirectionalParticles={physics.particleSpeed > 0 ? 2 : 0}
                    linkDirectionalParticleSpeed={physics.particleSpeed}
                />
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-6 left-6 flex flex-col gap-2 pointer-events-none">
                <div className="pointer-events-auto flex flex-col bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg overflow-hidden shadow-lg">
                    <button onClick={() => fgRef.current?.zoomIn()} className="p-2 hover:bg-slate-700 text-slate-400 border-b border-slate-700"><ZoomIn size={18}/></button>
                    <button onClick={() => fgRef.current?.zoomOut()} className="p-2 hover:bg-slate-700 text-slate-400 border-b border-slate-700"><ZoomOut size={18}/></button>
                    <button onClick={() => fgRef.current?.zoomToFit(1000)} className="p-2 hover:bg-slate-700 text-slate-400"><Maximize size={18}/></button>
                </div>
            </div>
            
            {focusNodeId && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-in slide-in-from-bottom">
                    <div className="bg-brand-accent text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3">
                        <span className="text-xs font-bold">Subgraph Mode</span>
                        <button 
                            onClick={() => setFocusNodeId(null)}
                            className="bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
         </div>

         {/* Sidebar */}
         <div className={`w-80 bg-brand-panel border-l border-slate-700 flex flex-col transition-all duration-300 ${selectedNode || topNodes.length > 0 ? 'translate-x-0' : 'translate-x-full'}`}>
            
            {selectedNode ? (
                <div className="flex flex-col h-full animate-in slide-in-from-right">
                    <div className="p-5 border-b border-slate-700 bg-slate-800/50">
                        <div className="flex items-center justify-between mb-2">
                             <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 border border-slate-700 px-2 py-0.5 rounded-full">
                                {selectedNode.type}
                             </span>
                             <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                        </div>
                        <h2 dir="auto" className="text-xl font-bold text-white leading-tight">{selectedNode.label}</h2>
                        
                        <div className="mt-4 flex gap-2">
                            {focusNodeId === selectedNode.id ? (
                                <button 
                                    onClick={() => setFocusNodeId(null)}
                                    className="flex-1 bg-slate-700 text-slate-300 text-xs py-1.5 rounded hover:bg-slate-600 transition-colors flex items-center justify-center gap-1"
                                >
                                    <Minimize size={12} /> Reset View
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setFocusNodeId(selectedNode.id)}
                                    className="flex-1 bg-blue-600/20 text-blue-400 border border-blue-500/50 text-xs py-1.5 rounded hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-1"
                                >
                                    <Focus size={12} /> Isolate Subgraph
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Share2 size={12} /> Connections ({highlightLinks.size})
                        </h3>
                        
                        <div className="space-y-3">
                            {Array.from(highlightLinks).map((link: ExtendedLink, i) => {
                                const isSource = link.source.id === selectedNode.id;
                                const otherNode = isSource ? link.target : link.source;
                                return (
                                    <div key={i} className="group p-3 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer" onClick={() => handleNodeClick(otherNode)}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] px-1.5 rounded ${isSource ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                {isSource ? 'OUT' : 'IN'}
                                            </span>
                                            <span dir="auto" className="text-xs text-slate-500 italic">{link.relation}</span>
                                        </div>
                                        <div dir="auto" className="font-medium text-slate-200 text-sm group-hover:text-brand-accent transition-colors">
                                            {otherNode.label}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    <div className="p-5 border-b border-slate-700">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Network size={16} className="text-brand-accent" /> Graph Explorer
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Select a node or use settings to customize layout.</p>
                    </div>
                    <div className="p-5 flex-1 overflow-y-auto">
                        <div className="mb-6">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Top Influential Nodes</h4>
                            <div className="space-y-2">
                                {topNodes.map((node, i) => (
                                    <div 
                                        key={node.id} 
                                        onClick={() => handleNodeClick(node)}
                                        className="flex items-center justify-between p-2 rounded hover:bg-slate-700/50 cursor-pointer group transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-xs text-slate-500 w-4">{i+1}</span>
                                            <div dir="auto" className="text-sm text-slate-300 group-hover:text-white">{node.label}</div>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 w-12 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-accent" style={{ width: `${(node.val || 1) * 10}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Legend */}
                        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Legend</h4>
                             <div className="space-y-2 text-xs">
                                <div className="flex items-center gap-2 text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Person</div>
                                <div className="flex items-center gap-2 text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Organization</div>
                                <div className="flex items-center gap-2 text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Location</div>
                                <div className="flex items-center gap-2 text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Other</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
         </div>

      </div>
    </div>
  );
};

export default KnowledgeGraphViewer;