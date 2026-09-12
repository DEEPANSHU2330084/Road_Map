import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import {
  Plus, Search, Settings, X, Check, Trash2, ExternalLink,
  ChevronLeft, Link2, Unlink2, Folder, FileText, Move, Palette, LayoutDashboard,
  Maximize2, Minimize2, LogOut, ChevronDown, Home, Map as MapIcon, CalendarDays, Code2, NotebookPen, BarChart3, Sun
} from "lucide-react";
import { starterTree, aptitudeTree } from "./data";
import {
  makeId, findNode, updateNode, addChild, deleteNode,
  countProblems, progressOf, collectNodes, walk
} from "./utils";

const STORAGE = "dsa-roadmap-graph-v3";
const ROADMAPS_STORAGE = "roadmap-app-roadmaps-v1";

function normalizeTree(t, fallbackName) {
  const tree = t && typeof t === "object" ? t : structuredClone(starterTree);
  if (tree.id === "root" && tree.name === "DSA Roadmap") tree.name = "DSA";
  tree.name = tree.name || fallbackName;
  if (!Array.isArray(tree.links)) tree.links = [];
  if (!tree.settings) tree.settings = {};
  tree.settings.layout = tree.settings.layout || "balanced";
  tree.settings.nodeStyle = tree.settings.nodeStyle || (tree.name.toLowerCase().includes("aptitude") ? "aptitude" : "coding");
  tree.settings.accent = tree.settings.accent || (tree.name.toLowerCase().includes("aptitude") ? "amber" : "violet");
  tree.settings.problemSet = tree.settings.problemSet || (tree.name.toLowerCase().includes("aptitude") ? "My Custom Set" : "NeetCode 150");
  tree.settings.showDescriptions = tree.settings.showDescriptions ?? true;
  return tree;
}

function loadRoadmaps() {
  try {
    const saved = localStorage.getItem(ROADMAPS_STORAGE);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.dsa && parsed.aptitude) return parsed;
    }
  } catch {}

  // Migrate the existing DSA roadmap so no current work is lost.
  let dsa = null;
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) dsa = normalizeTree(JSON.parse(saved), "DSA");
  } catch {}
  return {
    dsa: dsa || normalizeTree(structuredClone(starterTree), "DSA"),
    aptitude: normalizeTree(structuredClone(aptitudeTree), "Aptitude")
  };
}

function NodeCard({ node, x, y, settings, onOpen, onAdd, onLinkStart, onMoveStart, onDelete, linkingFrom, movingId }) {
  const progress = node.type === "page" ? progressOf(node) : 0;
  const style = node.nodeStyle || settings?.nodeStyle || "coding";
  const isRoot = node.id === "root";
  const subtitle = settings?.showDescriptions ? (node.description || (node.type === "page" ? "Practice & problems" : isRoot ? "Master roadmap" : "Topic")) : "";
  return (
    <g className={`road-node node-style-${style} ${isRoot ? "root-node" : ""} ${movingId === node.id ? "moving-node" : ""}`}
       transform={`translate(${x}, ${y})`} onClick={() => onOpen(node)}
       onPointerDown={(e) => { if (movingId === node.id) { e.stopPropagation(); onMoveStart(node, e); } }}>
      <rect className="node-box" x="-104" y="-34" width="208" height="68" rx="12" />
      <text className="node-title" x="0" y={settings?.showDescriptions ? "-7" : "2"} textAnchor="middle">{node.name}</text>
      {settings?.showDescriptions && <text className="node-subtitle" x="0" y="12" textAnchor="middle">{subtitle}</text>}
      <rect className="progress-bg" x="-88" y="23" width="176" height="4" rx="2" />
      {progress > 0 && <rect className="progress-fill" x="-88" y="23" width={176 * progress / 100} height="4" rx="2" />}
      {node.type === "page" && <circle className="page-dot" cx="84" cy="-19" r="4" />}
      <g className={`node-add ${linkingFrom === node.id ? "selected-link" : ""}`} onClick={(e) => { e.stopPropagation(); onAdd(node); }}>
        <circle cx="100" cy="-34" r="12" /><text x="100" y="-29" textAnchor="middle">+</text>
      </g>
      <g className={`node-link ${linkingFrom === node.id ? "selected-link" : ""}`} onClick={(e) => { e.stopPropagation(); onLinkStart(node); }}>
        <circle cx="80" cy="-34" r="12" /><text x="80" y="-29" textAnchor="middle">↗</text>
      </g>
      <g className={`node-move ${movingId === node.id ? "selected-move" : ""}`} onClick={(e) => { e.stopPropagation(); onMoveStart(node); }}>
        <circle cx="60" cy="-34" r="12" /><text x="60" y="-29" textAnchor="middle">✥</text>
      </g>
      <g className="node-delete" onClick={(e) => { e.stopPropagation(); onDelete(node); }}>
        <circle cx="40" cy="-34" r="12" /><Trash2 x="33" y="-41" width="14" height="14" />
      </g>
    </g>
  );
}

function layoutGraph(root) {
  const settings = root.settings || {};
  const gap = settings.layout === "compact" ? 190 : settings.layout === "wide" ? 300 : 240;
  const levelGap = settings.layout === "compact" ? 105 : settings.layout === "wide" ? 145 : 125;
  let cursor = 0;

  function assign(node, depth) {
    const children = node.children || [];
    if (!children.length) {
      node.__x = cursor;
      cursor += gap;
    } else {
      children.forEach(c => assign(c, depth + 1));
      node.__x = (children[0].__x + children[children.length - 1].__x) / 2;
    }
    node.__y = 105 + Math.max(0, depth) * levelGap;
  }

  // Keep the main DSA root visible at the top of the roadmap.
  assign(root, 0);

  const nodes = [];
  const treeEdges = [];

  function collect(node, parent = null, depth = 0) {
    const current = { node, x: node.__x, y: node.__y, depth };
    nodes.push(current);
    if (parent) treeEdges.push({ parent, child: current });
    (node.children || []).forEach(c => collect(c, current, depth + 1));
  }
  collect(root, null, 0);

  // The root is a real roadmap node, not an invisible layout anchor.
  const visible = nodes;
  const visibleEdges = treeEdges;

  const minX = Math.min(...visible.map(n => n.x), 0);
  const maxX = Math.max(...visible.map(n => n.x), 0);
  const shift = (minX + maxX) / 2;
  visible.forEach(n => n.x -= shift);
  visibleEdges.forEach(e => {
    e.parent.x -= shift;
    e.child.x -= shift;
  });

  // Reuse manually saved positions when a user moves a node.
  visible.forEach(n => {
    if (n.node.position) {
      n.x = Number(n.node.position.x);
      n.y = Number(n.node.position.y);
    }
  });

  // Keep edge endpoints in sync with overridden node positions.
  visibleEdges.forEach(e => {
    e.parent.x = e.parent.node.position ? Number(e.parent.node.position.x) : e.parent.x;
    e.parent.y = e.parent.node.position ? Number(e.parent.node.position.y) : e.parent.y;
    e.child.x = e.child.node.position ? Number(e.child.node.position.x) : e.child.x;
    e.child.y = e.child.node.position ? Number(e.child.node.position.y) : e.child.y;
  });

  const pos = new Map(visible.map(n => [n.node.id, n]));
  const links = (root.links || [])
    .map(l => ({ ...l, from: pos.get(l.from), to: pos.get(l.to) }))
    .filter(l => l.from && l.to);

  return {
    nodes: visible,
    treeEdges: visibleEdges,
    links,
    width: Math.max(1350, maxX - minX + 560),
    height: Math.max(760, visible.reduce((m, n) => Math.max(m, n.y), 0) + 190)
  };
}

function RoadmapApp({ initialRoadmaps, initialActiveId, onRoadmapsChange, onActiveRoadmapChange }) {
  const [roadmaps, setRoadmaps] = useState(() => {
    const raw = initialRoadmaps || loadRoadmaps();
    return Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, normalizeTree(value, value?.name || id)]));
  });
  const [roadmapId, setRoadmapId] = useState(() => initialActiveId || localStorage.getItem("roadmap-active-id") || "dsa");
  const tree = roadmaps[roadmapId] || roadmaps.dsa;
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [linkingFrom, setLinkingFrom] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    localStorage.setItem(ROADMAPS_STORAGE, JSON.stringify(roadmaps));
    onRoadmapsChange?.(roadmaps);
  }, [roadmaps, onRoadmapsChange]);
  useEffect(() => {
    localStorage.setItem("roadmap-active-id", roadmapId);
    onActiveRoadmapChange?.(roadmapId);
  }, [roadmapId, onActiveRoadmapChange]);

  const setTree = updater => {
    setRoadmaps(prev => ({
      ...prev,
      [roadmapId]: typeof updater === "function" ? updater(prev[roadmapId]) : updater
    }));
  };

  const changeRoadmap = id => {
    if (!roadmaps[id]) return;
    setSelected(null);
    setLinkingFrom(null);
    setMovingId(null);
    setModal(null);
    setRoadmapId(id);
  };

  const addRoadmap = name => {
    const id = makeId();
    const lower = name.toLowerCase();
    const newTree = { id: "root", name, type: "folder", children: [], links: [], settings: {
      layout: "balanced",
      nodeStyle: lower.includes("aptitude") ? "aptitude" : lower.includes("coding") || lower.includes("dsa") ? "coding" : "classic",
      accent: lower.includes("aptitude") ? "amber" : "violet",
      problemSet: lower.includes("aptitude") ? "My Custom Set" : "NeetCode 150",
      showDescriptions: true
    }};
    setRoadmaps(prev => ({ ...prev, [id]: newTree }));
    setRoadmapId(id);
    setSelected(null);
    setModal(null);
  };

  const saveRoadmapSettings = settings => {
    setTree(t => ({ ...t, settings: { ...(t.settings || {}), ...settings } }));
    setModal(null);
  };

  const stats = countProblems(tree);
  const graph = useMemo(() => layoutGraph(structuredClone(tree)), [tree]);

  const openNode = node => {
    if (movingId) return;
    if (linkingFrom) {
      if (linkingFrom !== node.id) createLink(linkingFrom, node.id);
      return;
    }
    if (node.type === "page") setSelected(node.id);
  };

  const startLink = node => {
    setModal(null);
    setLinkingFrom(node.id);
  };

  const addNode = (parent, type, name) => {
    const child = {
      id: makeId(),
      name,
      type,
      children: [],
      ...(type === "page" ? { page: { prerequisites: [], problems: [] } } : {})
    };
    setTree(t => addChild(t, parent.id, child));
    setModal(null);
  };

  const editNode = (id, patch) => {
    setTree(t => updateNode(t, id, n => ({ ...n, ...patch })));
    setModal(null);
  };

  const removeNode = id => {
    setTree(t => {
      const next = deleteNode(t, id);
      next.links = (next.links || []).filter(l => l.from !== id && l.to !== id);
      return next;
    });
    setModal(null);
    if (selected === id) setSelected(null);
  };

  const createLink = (from, to) => {
    if (!from || !to || from === to) return;
    setTree(t => {
      const exists = (t.links || []).some(l =>
        (l.from === from && l.to === to) || (l.from === to && l.to === from)
      );
      if (exists) return t;
      return { ...t, links: [...(t.links || []), { id: makeId(), from, to }] };
    });
    setModal(null);
    setLinkingFrom(null);
  };

  const startMove = (node, event = null) => {
    setLinkingFrom(null);
    setMovingId(node.id);
    if (event) {
      const current = graph.nodes.find(n => n.node.id === node.id);
      setDrag({ id: node.id, startX: event.clientX, startY: event.clientY, baseX: current?.x ?? 0, baseY: current?.y ?? 90 });
    } else {
      setDrag(null);
    }
  };

  useEffect(() => {
    if (!drag) return;
    const move = e => {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      setTree(t => updateNode(t, drag.id, n => ({ ...n, position: { x: drag.baseX + dx, y: drag.baseY + dy } })));
    };
    const up = () => { setDrag(null); setMovingId(null); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag, zoom]);

  const resetPosition = id => {
    setTree(t => updateNode(t, id, n => { const copy = { ...n }; delete copy.position; return copy; }));
    setMovingId(null);
  };

  const removeCrossLink = id => setTree(t => ({ ...t, links: (t.links || []).filter(l => l.id !== id) }));

  const currentPage = selected ? findNode(tree, selected) : null;

  if (currentPage) {
    return (
      <PageView
        node={currentPage}
        roadmapSettings={tree.settings || {}}
        allNodes={collectNodes(tree)}
        onBack={() => setSelected(null)}
        onUpdate={(id, updater) => setTree(t => updateNode(t, id, updater))}
      />
    );
  }

  const filteredNodes = search.trim()
    ? graph.nodes.filter(({ node }) => node.name.toLowerCase().includes(search.toLowerCase()))
    : graph.nodes;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className={`brand-mark accent-${tree.settings?.accent || "violet"}`}>{tree.name.slice(0,3).toUpperCase()}</div>
          <div className="brand-copy"><strong>My Study Roadmap</strong><span>Personal learning workspace</span></div>
        </div>
        <div className="roadmap-tabs">
          {Object.entries(roadmaps).slice(0,4).map(([id, r]) => <button key={id} className={roadmapId===id?"active":""} onClick={()=>changeRoadmap(id)}>{r.name}</button>)}
          {Object.keys(roadmaps).length>4 ? <select value={roadmapId} onChange={e=>changeRoadmap(e.target.value)}><option value="">Custom</option>{Object.entries(roadmaps).slice(4).map(([id,r])=><option key={id} value={id}>{r.name}</option>)}</select> : <button className="custom-tab" onClick={()=>setModal({kind:"roadmap-add"})}>Custom <ChevronDown size={13}/></button>}
        </div>
        <div className="top-actions">
          <div className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes..."/></div>
          <button className="top-control" onClick={()=>setZoom(1)}><Maximize2 size={16}/> Fit view</button>
          <button className="icon-theme" title="Theme"><Sun size={17}/></button>
          <div className="profile-pill"><span>T</span><b>Tenchi Wilferd</b><ChevronDown size={13}/></div>
        </div>
      </header>

      <main className={`canvas layout-${tree.settings?.layout || "balanced"}`}>
        <aside className="left-sidebar">
          <div className="sidebar-nav">
            {[
              [Home,"Home",true], [MapIcon,"Roadmap"], [CalendarDays,"Daily Plan"], [Code2,"Problems"], [NotebookPen,"Notes"], [BarChart3,"Analytics"]
            ].map(([Icon,label,active]) => <button key={label} className={active?"active":""} onClick={()=>{ if(label==="Daily Plan") document.querySelector('.daily-planner')?.scrollIntoView({behavior:'smooth',block:'center'}); }}><Icon size={17}/><span>{label}</span></button>)}
          </div>
          <button className="sidebar-settings" onClick={()=>setModal({kind:"settings"})}><Settings size={17}/><span>Settings</span></button>
        </aside>

        <section className="graph-stage">
          <div className="stage-head">
            <div><span>ROADMAP</span><h2>{tree.name}</h2><p>Build your path step by step. Hover a node for actions.</p></div>
            <div className="stage-actions"><button onClick={()=>setModal({kind:"settings"})}><Palette size={16}/> Layout</button><button onClick={()=>setModal({kind:"add",parent:tree})}><Plus size={16}/> Add node</button><button onClick={()=>setZoom(1)}><Maximize2 size={16}/> Fit</button></div>
          </div>
          <div className="hint">
            {linkingFrom ? <><span className="linking-message">Link mode: <b>{findNode(tree, linkingFrom)?.name}</b> selected — click another topic</span><button className="cancel-link" onClick={() => setLinkingFrom(null)}><X size={14}/> Cancel</button></> : <><span><b>PAGE</b> opens dashboard</span><span>•</span><span><b>+</b> adds child</span><span>•</span><span><b>↗</b> cross-links topics</span><span>•</span><span><b>✥</b> moves node</span></>}
          </div>
          <div className="graph-viewport">
            <svg className="graph" width={graph.width} height={graph.height} viewBox={`${-graph.width/2} 0 ${graph.width} ${graph.height}`} style={{transform:`scale(${zoom})`}}>
              <defs><filter id="glow"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
              {graph.treeEdges.map((edge, i) => { const x1=edge.parent.x,y1=edge.parent.y+34,x2=edge.child.x,y2=edge.child.y-34,mid=(y1+y2)/2; return <path key={"t"+i} className="edge" d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}/>; })}
              {graph.links.map((link,i)=>{const x1=link.from.x,y1=link.from.y,x2=link.to.x,y2=link.to.y,dx=(x2-x1)*.35;return <path key={"l"+i} className="cross-edge" d={`M ${x1} ${y1} C ${x1+dx} ${y1-35}, ${x2-dx} ${y2+35}, ${x2} ${y2}`}/>;})}
              {filteredNodes.map(({node,x,y}) => <NodeCard key={node.id} node={node} x={x} y={y} settings={tree.settings} onOpen={openNode} onAdd={parent=>setModal({kind:"add",parent})} onLinkStart={startLink} onMoveStart={startMove} onDelete={node=>setModal({kind:"delete",node})} linkingFrom={linkingFrom} movingId={movingId}/>)}
            </svg>
          </div>
        </section>

        <aside className="dashboard-rail">
          <DashboardProgress tree={tree} stats={stats}/>
          <DailyPlanner tree={tree} topics={collectNodes(tree)} onUpdate={updater=>setTree(updater)}/>
          <div className="quick-card"><div className="rail-title"><span>QUICK ACTIONS</span><b>Tools</b></div><div className="quick-grid"><button onClick={()=>setModal({kind:"add",parent:tree})}><Plus/> Add node</button><button onClick={()=>setModal({kind:"settings"})}><Palette/> Change layout</button><button onClick={()=>setModal({kind:"link"})}><Link2/> Link topics</button><button onClick={()=>setModal({kind:"links"})}><Unlink2/> Remove link</button></div></div>
        </aside>
        <div className="zoom-controls">
          <button onClick={()=>setZoom(z=>Math.min(1.4,+(z+.1).toFixed(2)))}>+</button>
          <span>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.max(.65,+(z-.1).toFixed(2)))}>−</button>
        </div>

        <div className="bottom-toolbar">
          <button onClick={()=>setModal({kind:"add",parent:tree})}><Plus size={15}/> Add root child</button>
          <button onClick={()=>setModal({kind:"link"})}><Link2 size={15}/> Link topics</button>
          <button onClick={()=>setModal({kind:"links"})}><Unlink2 size={15}/> Remove link</button>
          <button onClick={()=>setModal({kind:"edit",node:tree})}>Rename root</button>
        </div>
      </main>

      {modal?.kind==="add" && <AddModal parent={modal.parent} onClose={()=>setModal(null)} onAdd={addNode}/>}
      {modal?.kind==="edit" && <EditModal node={modal.node} onClose={()=>setModal(null)} onSave={editNode}/>}
      {modal?.kind==="link" && <LinkModal nodes={collectNodes(tree)} links={tree.links||[]} onClose={()=>setModal(null)} onCreate={createLink}/>} 
      {modal?.kind==="links" && <LinksManager nodes={collectNodes(tree)} links={tree.links||[]} onClose={()=>setModal(null)} onRemove={removeCrossLink}/>}
      {modal?.kind==="delete" && <DeleteModal node={modal.node} onClose={()=>setModal(null)} onDelete={() => removeNode(modal.node.id)}/>}
      {modal?.kind==="roadmap-add" && <RoadmapAddModal onClose={()=>setModal(null)} onAdd={addRoadmap}/>}
      {modal?.kind==="settings" && <RoadmapSettingsModal settings={tree.settings||{}} roadmapName={tree.name} onClose={()=>setModal(null)} onSave={saveRoadmapSettings}/>}
    </div>
  );
}

function DashboardProgress({tree, stats}) {
  const pct = stats.total ? Math.round(stats.solved / stats.total * 100) : 0;
  const pages = collectNodes(tree).filter(n=>n.type === "page").length;
  const allProblems = [];
  walk(tree, n => (n.page?.problems || []).forEach(p => allProblems.push(p)));
  const byDifficulty = ["Easy","Medium","Hard"].map(d => {
    const ps = allProblems.filter(p => p.difficulty === d);
    return { d, total: ps.length, solved: ps.filter(p => p.solved).length };
  });
  return <section className="dashboard-progress">
    <div className="rail-title"><span>PROGRESS</span><select value={tree.name} readOnly><option>{tree.name}</option></select></div>
    <div className="progress-summary"><div><strong>{pct}%</strong><small>{stats.solved}/{stats.total} problems</small></div><div className="progress-ring" style={{"--p":`${pct}%`}}><b>{pct}%</b></div></div>
    <div className="difficulty-list">{byDifficulty.map((item,i) => { const label=["Basic","Intermediate","Advanced"][i]; const w=item.total ? Math.round(item.solved/item.total*100) : 0; return <div className={`difficulty-row difficulty-${i}`} key={item.d}><div><span>{label}</span><b>{item.solved}/{item.total}</b></div><div className="difficulty-track"><i style={{width:`${w}%`}}/></div></div>; })}</div>
    <div className="progress-meta"><span>{pages} learning pages</span><span>{collectNodes(tree).length} nodes</span></div>
    <button className="detail-progress" onClick={()=>document.querySelector('.problem-section')?.scrollIntoView({behavior:'smooth'})}>View detailed progress <span>→</span></button>
  </section>;
}

function RoadmapSettingsModal({settings, roadmapName, onClose, onSave}) {
  const [layout,setLayout]=useState(settings.layout||"balanced");
  const [nodeStyle,setNodeStyle]=useState(settings.nodeStyle||"coding");
  const [accent,setAccent]=useState(settings.accent||"violet");
  const [problemSet,setProblemSet]=useState(settings.problemSet||"NeetCode 150");
  const [showDescriptions,setShowDescriptions]=useState(settings.showDescriptions ?? true);
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal settings-modal" onSubmit={e=>{e.preventDefault();onSave({layout,nodeStyle,accent,problemSet,showDescriptions})}} onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Customize {roadmapName}</h2><p>Each roadmap can have its own layout, colors and node style.</p></div><button type="button" className="close" onClick={onClose}><X/></button></div>
    <div className="setting-section"><h4><LayoutDashboard size={16}/> Graph layout</h4><div className="choice-grid">{[["compact","Compact","More topics on screen"],["balanced","Balanced","Default study view"],["wide","Wide","More space between branches"]].map(([v,t,d])=><button type="button" className={layout===v?"choice active":"choice"} onClick={()=>setLayout(v)} key={v}><b>{t}</b><small>{d}</small></button>)}</div></div>
    <div className="setting-section"><h4><Palette size={16}/> Node style</h4><div className="choice-grid">{[["coding","Coding","IDE / DSA style"],["aptitude","Aptitude","Warm exam-prep style"],["classic","Classic","Simple roadmap cards"]].map(([v,t,d])=><button type="button" className={nodeStyle===v?"choice active":"choice"} onClick={()=>setNodeStyle(v)} key={v}><span className={`style-preview ${v}`}/><b>{t}</b><small>{d}</small></button>)}</div></div>
    <div className="setting-section"><h4>Accent</h4><div className="accent-picker">{["violet","blue","amber","green","cyan","rose"].map(v=><button type="button" key={v} className={`accent-dot ${v} ${accent===v?"selected":""}`} onClick={()=>setAccent(v)} aria-label={v}/>)}</div></div>
    <div className="setting-section"><h4>Problem set / source</h4><select className="setting-select" value={problemSet} onChange={e=>setProblemSet(e.target.value)}><option>NeetCode 150</option><option>Blind 75</option><option>My Custom Set</option></select></div>
    <label className="toggle-row"><span><b>Show node descriptions</b><small>Display a small context line inside each node.</small></span><input type="checkbox" checked={showDescriptions} onChange={e=>setShowDescriptions(e.target.checked)}/></label>
    <button className="primary" type="submit"><Check size={17}/> Save roadmap style</button>
  </form></div>;
}

function DailyPlanner({tree, topics, onUpdate}) {
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editing, setEditing] = useState(false);

  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const todayKey = fmt(new Date());
  const selectedKey = fmt(selectedDate);
  const plan = tree.dailyPlan || {};
  const selectedPlan = plan[selectedKey] || { topicId: "", done: false };
  const daysInMonth = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const monthName = month.toLocaleString("en-US", { month:"long", year:"numeric" });
  const topic = topics.find(n => n.id === selectedPlan.topicId);

  const savePlan = patch => {
    onUpdate(t => ({ ...t, dailyPlan: { ...(t.dailyPlan || {}), [selectedKey]: { ...selectedPlan, ...patch } } }));
  };

  const selectDay = d => {
    const next = new Date(month.getFullYear(), month.getMonth(), d);
    setSelectedDate(next);
    setEditing(false);
  };

  return <aside className="daily-planner">
    <div className="planner-head">
      <div><span>MAIN DASHBOARD</span><h3>Daily plan</h3></div>
      <div className="planner-month-actions">
        <button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button>
        <b>{monthName}</b>
        <button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button>
      </div>
    </div>

    <div className="planner-weekdays">{["S","M","T","W","T","F","S"].map((x,i)=><span key={i}>{x}</span>)}</div>
    <div className="planner-grid">
      {Array.from({length:firstDay}).map((_,i)=><span className="planner-blank" key={'b'+i}/>) }
      {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
        const key = `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const item = plan[key];
        const isSelected = key === selectedKey;
        const isToday = key === todayKey;
        return <button key={d} onClick={()=>selectDay(d)} className={`${isSelected?'planner-selected ':''}${isToday?'planner-today ':''}${item?.done?'planner-done':''}`} title={item?.topicId ? (topics.find(n=>n.id===item.topicId)?.name || 'Topic') : 'No topic'}>
          {d}{item?.topicId && <i/>}
        </button>;
      })}
    </div>

    <div className="planner-task">
      <div className="planner-task-date">{selectedDate.toLocaleDateString("en-US", {weekday:"long", month:"short", day:"numeric"})}</div>
      {topic ? <>
        <div className="planner-topic-label">TODAY'S TOPIC</div>
        <div className={`planner-topic ${selectedPlan.done?'is-done':''}`}>
          <div className="planner-topic-dot" />
          <div><strong>{topic.name}</strong><small>{topic.type === "page" ? "Practice problems" : "Study topic"}</small></div>
        </div>
        <div className="planner-actions">
          <button className={selectedPlan.done ? "planner-complete completed" : "planner-complete"} onClick={()=>savePlan({done:!selectedPlan.done})}>
            <Check size={14}/>{selectedPlan.done ? "Completed" : "Mark complete"}
          </button>
          <button className="planner-edit" onClick={()=>setEditing(true)}>Change topic</button>
        </div>
      </> : <>
        <div className="planner-empty">No topic planned for this day.</div>
        <button className="planner-assign" onClick={()=>setEditing(true)}><Plus size={14}/> Assign daily topic</button>
      </>}

      {editing && <div className="planner-editor">
        <label>Topic for this day
          <select value={selectedPlan.topicId || ""} onChange={e=>savePlan({topicId:e.target.value, done:false})}>
            <option value="">Choose a topic...</option>
            {topics.filter(n=>n.id!==tree.id).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </label>
        <div><button onClick={()=>{savePlan({topicId:"",done:false});setEditing(false)}}>Clear</button><button onClick={()=>setEditing(false)}>Done</button></div>
      </div>}
    </div>

    <div className="planner-footer"><span><i className="legend-dot"/> planned</span><span><i className="legend-done"/> completed</span></div>
  </aside>;
}

function RoadmapAddModal({onClose,onAdd}) {
  const [name,setName]=useState("");
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="modal" onSubmit={e=>{e.preventDefault(); if(name.trim()) onAdd(name.trim())}} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><div><h2>New roadmap</h2><p>Create a separate roadmap such as Aptitude, Web Development, DBMS, OS, or anything else.</p></div><button type="button" className="close" onClick={onClose}><X/></button></div>
      <label>Roadmap name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Aptitude, Core CS, Web Development..."/></label>
      <button className="primary" type="submit"><Plus size={17}/> Create roadmap</button>
    </form>
  </div>;
}

function DeleteModal({node,onClose,onDelete}) {
  const childCount = (node.children || []).length;
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal delete-modal" onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><div><h2>Delete node?</h2><p>Delete <b>{node.name}</b>{childCount ? ` and its ${childCount} direct child${childCount===1?"":"ren"}?` : "?"}</p></div><button type="button" className="close" onClick={onClose}><X/></button></div>
      <div className="delete-warning">This removes the node, all nested children, and any cross-links connected to them. This cannot be undone.</div>
      <div className="confirm-actions">
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="danger" onClick={onDelete}><Trash2 size={16}/> Delete</button>
      </div>
    </div>
  </div>;
}

function AddModal({parent,onClose,onAdd}) {
  const [type,setType]=useState("folder"), [name,setName]=useState("");
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="modal" onSubmit={e=>{e.preventDefault();if(name.trim())onAdd(parent,type,name.trim())}} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><div><h2>Add child</h2><p>Inside <b>{parent.name}</b></p></div><button type="button" className="close" onClick={onClose}><X/></button></div>
      <div className="type-switch">
        <button type="button" className={type==="folder"?"active":""} onClick={()=>setType("folder")}><Folder/> Folder / Topic</button>
        <button type="button" className={type==="page"?"active":""} onClick={()=>setType("page")}><FileText/> Page</button>
      </div>
      <label>Node name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Other, Graphs, Linked List..."/></label>
      <button className="primary" type="submit"><Plus size={17}/> Create child</button>
    </form>
  </div>;
}

function EditModal({node,onClose,onSave}) {
  const [name,setName]=useState(node.name);
  const [description,setDescription]=useState(node.description || "");
  const [nodeStyle,setNodeStyle]=useState(node.nodeStyle || "inherit");
  const submit=e=>{e.preventDefault();if(name.trim())onSave(node.id,{name:name.trim(),description:description.trim(),nodeStyle:nodeStyle==="inherit"?undefined:nodeStyle})};
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal node-edit-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Customize node</h2><p>Override the roadmap style for this node, or keep the roadmap default.</p></div><button type="button" className="close" onClick={onClose}><X/></button></div>
    <label>Node name<input autoFocus value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Description / subtitle<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Traversal, patterns & practice"/></label>
    <label>Node style<select value={nodeStyle} onChange={e=>setNodeStyle(e.target.value)}><option value="inherit">Use roadmap style</option><option value="coding">Coding</option><option value="aptitude">Aptitude</option><option value="classic">Classic</option></select></label>
    <button className="primary" type="submit"><Check size={17}/> Save node</button>
  </form></div>;
}

function LinkModal({nodes,links,onClose,onCreate}) {
  const [from,setFrom]=useState(""), [to,setTo]=useState("");
  const submit=e=>{e.preventDefault(); if(from&&to&&from!==to)onCreate(from,to)};
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Link topics</h2><p>Create a visual connection between any two nodes, even in different branches.</p></div><button type="button" className="close" onClick={onClose}><X/></button></div>
    <label>From<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">Select topic...</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
    <label>To<select value={to} onChange={e=>setTo(e.target.value)}><option value="">Select topic...</option>{nodes.filter(n=>n.id!==from).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
    <button className="primary" type="submit" disabled={!from||!to}><Link2 size={17}/> Create link</button>
    {links.length>0 && <div className="link-info">{links.length} cross-link{links.length>1?"s":""} currently on the roadmap.</div>}
  </form></div>;
}

function LinksManager({nodes, links, onClose, onRemove}) {
  const name = id => nodes.find(n => n.id === id)?.name || "Unknown";
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Remove link</h2><p>Delete a cross-link without deleting either topic.</p></div><button className="close" onClick={onClose}><X/></button></div>
    {!links.length ? <div className="empty">No cross-links have been created.</div> : <div className="link-list">{links.map(l=><div className="link-row" key={l.id}><span>{name(l.from)} <b>↔</b> {name(l.to)}</span><button onClick={()=>onRemove(l.id)}><Trash2 size={14}/> Remove</button></div>)}</div>}
  </div></div>;
}

function PageView({node,roadmapSettings = {},allNodes,onBack,onUpdate}) {
  const [problemModal,setProblemModal]=useState(false), [menu,setMenu]=useState(null), [editing,setEditing]=useState(null);
  const problems=node.page?.problems||[];
  const solved=problems.filter(p=>p.solved).length;
  const pct=problems.length?Math.round(solved/problems.length*100):0;

  const update=updater=>onUpdate(node.id,n=>({...n,page:{...n.page,...updater(n.page)}}));
  const toggleSolved = id => {
    const today = new Date().toISOString().slice(0,10);
    update(page=>({problems:page.problems.map(x=>x.id===id?{...x,solved:!x.solved}:x)}));
    const raw=localStorage.getItem("dsa-activity")||"[]";
    let days=[]; try{days=JSON.parse(raw)}catch{}
    if(!days.includes(today)) { localStorage.setItem("dsa-activity",JSON.stringify([...days,today])); window.dispatchEvent(new Event("dsa-activity-change")); }
  };
  const saveProblem = p => {
    update(page=>({problems:page.problems.map(x=>x.id===p.id?p:x)}));
    setEditing(null);
  };

  return <div className="page-shell">
    <header className="page-topbar">
      <button className="back-btn" onClick={onBack}><ChevronLeft/> Roadmap</button>
      <div className="page-title"><FileText size={18}/><b>{node.name}</b><span>PAGE</span></div>
      <div className="page-progress"><div><b>{pct}%</b><small>complete</small></div><div className="big-progress"><i style={{width:`${pct}%`}}/></div></div>
    </header>

    <div className="page-layout">
      <main className="page-content">
        <section className="page-intro"><p>Problem dashboard</p><h1>{node.name}</h1><div className="page-line"><span>{solved} solved</span><span>{problems.length} total</span></div></section>

        <section className="prereq">
          <div className="section-title"><h3>Prerequisites</h3><button onClick={()=>setMenu(menu==="pre"?null:"pre")}><Plus size={15}/> Add</button></div>
          <div className="chips">
            {(node.page?.prerequisites||[]).map((p,i)=><span className="chip" key={i}>{p}<button onClick={()=>update(page=>({prerequisites:page.prerequisites.filter((_,j)=>j!==i)}))}>×</button></span>)}
            {!node.page?.prerequisites?.length&&<span className="muted">No prerequisites yet.</span>}
          </div>
          {menu==="pre"&&<div className="dropdown">{allNodes.filter(n=>n.id!==node.id).map(n=><button key={n.id} onClick={()=>{update(page=>({prerequisites:[...(page.prerequisites||[]),n.name]}));setMenu(null)}}>{n.name}</button>)}</div>}
        </section>

        <section className="problem-section">
          <div className="section-title"><div><h3>Problems</h3><small>Track your practice and open the coding website</small></div><button onClick={()=>setProblemModal(true)}><Plus size={15}/> Add problem</button></div>
          <div className="problem-table">
            <div className="tr th"><span>Done</span><span>Problem</span><span>Difficulty</span><span>Coding Link</span><span/></div>
            {problems.map(p=><div className={`tr ${p.solved?"done":""}`} key={p.id}>
              <button className={`check ${p.solved?"checked":""}`} onClick={()=>toggleSolved(p.id)}>{p.solved&&<Check size={14}/>}</button>
              <span className="problem-name">{p.title}</span>
              <span className={`difficulty ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
              {p.url && p.url !== "#" ? <a className="problem-link" href={p.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}><ExternalLink size={14}/> Open</a> : <button className="problem-link add-link" onClick={()=>setEditing(p)}><Link2 size={14}/> Add link</button>}
              <button className="delete" onClick={()=>update(page=>({problems:page.problems.filter(x=>x.id!==p.id)}))}><Trash2 size={14}/></button>
            </div>)}
            {!problems.length&&<div className="empty">No problems yet. Add your first problem.</div>}
          </div>
        </section>
      </main>
      <ProgressSidebar problems={problems} settings={roadmapSettings}/>
    </div>

    {problemModal&&<ProblemModal onClose={()=>setProblemModal(false)} onAdd={p=>{update(page=>({problems:[...page.problems,p]}));setProblemModal(false)}}/>}
    {editing&&<ProblemEditModal problem={editing} onClose={()=>setEditing(null)} onSave={saveProblem}/>} 
  </div>;
}

function ProgressSidebar({problems, settings = {}}) {
  const [month,setMonth]=useState(new Date());
  const [source,setSource]=useState(settings.problemSet || "NeetCode 150");
  const [activity,setActivity]=useState(()=>{try{return JSON.parse(localStorage.getItem("dsa-activity")||"[]")}catch{return[]}});
  useEffect(()=>{
    const fn=()=>{try{setActivity(JSON.parse(localStorage.getItem("dsa-activity")||"[]"))}catch{}};
    window.addEventListener("storage",fn); window.addEventListener("dsa-activity-change",fn); return ()=>{window.removeEventListener("storage",fn);window.removeEventListener("dsa-activity-change",fn)};
  },[]);
  const solved=problems.filter(p=>p.solved).length;
  const by=(d)=>problems.filter(p=>p.difficulty===d).filter(p=>p.solved).length;
  const totalTarget=150;
  const daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const firstDay=new Date(month.getFullYear(),month.getMonth(),1).getDay();
  const monthName=month.toLocaleString("en-US",{month:"long",year:"numeric"});
  const fmt=(y,m,d)=>`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const today=new Date();
  const currentMonth=today.getMonth()===month.getMonth()&&today.getFullYear()===month.getFullYear();
  const activeSet=new Set(activity);
  const calcStreak=()=>{
    let d=new Date(); let count=0;
    while(activeSet.has(d.toISOString().slice(0,10))){count++;d.setDate(d.getDate()-1)}
    return count;
  };
  const bestStreak=()=>{
    const arr=[...activeSet].sort(); let best=0,cur=0,prev=null;
    for(const s of arr){const d=new Date(s); if(prev && (d-prev)===86400000) cur++; else cur=1; best=Math.max(best,cur); prev=d;} return best;
  };
  return <aside className="progress-sidebar">
    <section className="stats-card">
      <div className="difficulty-stats">
        <div><b>Easy</b><span>{by("Easy")} / 28</span></div>
        <div><b>Medium</b><span>{by("Medium")} / 101</span></div>
        <div><b>Hard</b><span>{by("Hard")} / 21</span></div>
      </div>
      <div className="donut" style={{"--p":`${Math.min(100,Math.round(solved/totalTarget*100))}%`}}><strong>{solved}</strong><span>/150</span><small>Solved</small></div>
      <select className="source-select" value={source} onChange={e=>setSource(e.target.value)}><option>NeetCode 150</option><option>Blind 75</option><option>My Custom Set</option></select>
      <div className="mini-actions"><button title="Shuffle">⤨</button><button title="Refresh">↻</button><button title="Reset">▣</button><button title="Help">?</button><button title="Settings">⚙</button></div>
    </section>

    <section className="calendar-card">
      <div className="calendar-head"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button><b>{monthName}</b><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button></div>
      <div className="day-label">Day {currentMonth?today.getDate():"—"}<span>{currentMonth?"Daily activity":"Activity calendar"}</span></div>
      <div className="weekdays">{["S","M","T","W","T","F","S"].map((x,i)=><span key={i}>{x}</span>)}</div>
      <div className="calendar-grid">
        {Array.from({length:firstDay}).map((_,i)=><span className="blank" key={"b"+i}/>) }
        {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
          const key=fmt(month.getFullYear(),month.getMonth(),d); const active=activeSet.has(key); const isToday=currentMonth&&d===today.getDate();
          return <span key={d} className={`${active?"active-day":""} ${isToday?"today":""}`}>{d}</span>
        })}
      </div>
      <div className="streak-row"><div><small>Current Streak</small><b>🔥 {calcStreak()} days</b></div><div><small>Best Streak</small><b>🏆 {bestStreak()} day{bestStreak()===1?"":"s"}</b></div></div>
      <div className="heart-row"><span>♥</span><b>{solved}</b><small>{Math.min(solved,5)}/5 to next</small></div>
      <div className="streak-note">ⓘ Solve one problem a day to keep your streak</div>
    </section>
  </aside>;
}

function ProblemEditModal({problem,onClose,onSave}) {
  const [title,setTitle]=useState(problem.title), [difficulty,setDifficulty]=useState(problem.difficulty), [url,setUrl]=useState(problem.url==="#"?"":problem.url);
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={e=>{e.preventDefault();if(title.trim())onSave({...problem,title:title.trim(),difficulty,url:url.trim()})}} onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>{problem.url==="#"?"Add coding link":"Edit problem"}</h2><p>Save the exact LeetCode, CodeChef, HackerRank, GFG or other coding URL.</p></div><button type="button" className="close" onClick={onClose}><X/></button></div>
    <label>Problem title<input autoFocus value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
    <label>Coding problem website URL<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://leetcode.com/problems/..."/></label>
    <button className="primary" type="submit"><Link2 size={17}/> Save problem link</button>
  </form></div>;
}

function ProblemModal({onClose,onAdd}) {
  const [title,setTitle]=useState(""), [difficulty,setDifficulty]=useState("Easy"), [url,setUrl]=useState("");
  const submit=e=>{e.preventDefault();if(title.trim())onAdd({id:makeId(),title:title.trim(),difficulty,url:url.trim(),solved:false});};
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Add problem</h2><p>Add the coding problem and its website link.</p></div><button type="button" className="close" onClick={onClose}><X/></button></div>
    <label>Problem title<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Reverse Linked List"/></label>
    <label>Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
    <label>Coding problem website URL<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://leetcode.com/problems/reverse-linked-list/"/></label>
    <button className="primary" type="submit"><Plus size={17}/> Add problem</button>
  </form></div>;
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async e => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
    setBusy(false);
  };

  return <div className="auth-shell">
    <div className="auth-card">
      <div className="auth-mark">DSA</div>
      <h1>My Study Roadmap</h1>
      <p>Sign in to access your private roadmaps.</p>
      <form onSubmit={login}>
        <label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required /></label>
        {error && <div className="auth-error">{error}</div>}
        <button className="primary auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  </div>;
}

function SyncShell({ session }) {
  const [cloud, setCloud] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activityVersion, setActivityVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("roadmap_data").select("data").eq("user_id", session.user.id).maybeSingle();
      if (cancelled) return;
      if (error) { setSaveError(error.message); return; }

      if (data?.data?.roadmaps) {
        const saved = data.data;
        localStorage.setItem(ROADMAPS_STORAGE, JSON.stringify(saved.roadmaps));
        if (saved.activeRoadmapId) localStorage.setItem("roadmap-active-id", saved.activeRoadmapId);
        localStorage.setItem("dsa-activity", JSON.stringify(saved.activity || []));
        setCloud({ roadmaps: saved.roadmaps, activeRoadmapId: saved.activeRoadmapId || "dsa" });
      } else {
        let roadmaps = loadRoadmaps();
        let activeRoadmapId = localStorage.getItem("roadmap-active-id") || "dsa";
        let activity = [];
        try { activity = JSON.parse(localStorage.getItem("dsa-activity") || "[]"); } catch {}
        const payload = { roadmaps, activeRoadmapId, activity };
        const { error: upsertError } = await supabase.from("roadmap_data").upsert({ user_id: session.user.id, data: payload, updated_at: new Date().toISOString() });
        if (cancelled) return;
        if (upsertError) { setSaveError(upsertError.message); return; }
        setCloud({ roadmaps, activeRoadmapId });
      }
    })();
    return () => { cancelled = true; };
  }, [session.user.id]);

  useEffect(() => {
    const onActivity = () => setActivityVersion(v => v + 1);
    window.addEventListener("dsa-activity-change", onActivity);
    window.addEventListener("storage", onActivity);
    return () => { window.removeEventListener("dsa-activity-change", onActivity); window.removeEventListener("storage", onActivity); };
  }, []);

  const handleRoadmapsChange = useCallback(roadmaps => setCloud(c => c ? ({ ...c, roadmaps }) : c), []);
  const handleActiveRoadmapChange = useCallback(activeRoadmapId => setCloud(c => c ? ({ ...c, activeRoadmapId }) : c), []);

  useEffect(() => {
    if (!cloud) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      setSaveError("");
      let activity = [];
      try { activity = JSON.parse(localStorage.getItem("dsa-activity") || "[]"); } catch {}
      const payload = { roadmaps: cloud.roadmaps, activeRoadmapId: cloud.activeRoadmapId, activity };
      const { error } = await supabase.from("roadmap_data").upsert({ user_id: session.user.id, data: payload, updated_at: new Date().toISOString() });
      if (error) setSaveError(error.message);
      setSaving(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [cloud, activityVersion, session.user.id]);

  if (!cloud) return <div className="auth-shell"><div className="auth-card sync-card"><div className="auth-mark">☁</div><h1>Loading your roadmap</h1><p>Syncing your data from Supabase…</p></div></div>;

  return <>
    <div className="sync-status">{saveError ? <span className="sync-error">Sync error: {saveError}</span> : saving ? <span>Saving…</span> : <span>☁ Synced</span>}<button onClick={() => supabase.auth.signOut()}>Sign out</button></div>
    <RoadmapApp
      initialRoadmaps={cloud.roadmaps}
      initialActiveId={cloud.activeRoadmapId}
      onRoadmapsChange={handleRoadmapsChange}
      onActiveRoadmapChange={handleActiveRoadmapChange}
    />
  </>;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setStartupError(error.message || "Could not connect to Supabase.");
        setLoading(false);
        return;
      }
      setSession(data.session || null);
      setLoading(false);
    }).catch(error => {
      if (!mounted) return;
      setStartupError(error?.message || "Could not connect to Supabase. Check your .env values.");
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  if (loading) return <div className="auth-shell"><div className="auth-card sync-card"><div className="auth-mark">DSA</div><h1>Starting…</h1><p>Checking your private session.</p></div></div>;
  if (startupError) return <div className="auth-shell"><div className="auth-card sync-card"><div className="auth-mark">!</div><h1>Supabase connection error</h1><p>{startupError}</p><p style={{marginTop:12}}>Check that <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_PUBLISHABLE_KEY</b> are present in <b>.env</b>, then restart <b>npm run dev</b>.</p></div></div>;
  return session ? <SyncShell session={session} /> : <AuthScreen />;
}

export default App;
