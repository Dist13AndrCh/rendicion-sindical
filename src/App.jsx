import React, { useState, useEffect, useRef } from 'react';
import { auth, db, APP_ID as appId } from './config/firebase';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInAnonymously
} from 'firebase/auth';
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  query
} from 'firebase/firestore';
import {
  Lock, LogOut, Plus, Trash2, Download, FileText,
  Megaphone, History, Sun, Moon, Eye, AlertCircle,
  TrendingUp, TrendingDown, Wallet, Loader2
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('batman'); // 'light' | 'batman'
  const [view, setView] = useState('public');
  const [reports, setReports] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pdfReady, setPdfReady] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null });

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  const confirmAction = (message, onConfirm) => {
    setConfirmDialog({ show: true, message, onConfirm });
  };

  // Formulario Admin
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [reportPeriod, setReportPeriod] = useState('');
  const [prevBalance, setPrevBalance] = useState(0);
  const [incomes, setIncomes] = useState([{ detail: '', amount: 0 }]);
  const [expenses, setExpenses] = useState([{ detail: '', amount: 0 }]);
  const [extraDetail, setExtraDetail] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [error, setError] = useState('');

  // 1. Carga de Scripts de PDF (CDN para evitar errores de compilación) y Favicons
  useEffect(() => {
    const head = document.head;

    // Favicons
    const favicons = `
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
      <link rel="manifest" href="/site.webmanifest">
    `;
    head.insertAdjacentHTML('beforeend', favicons);

    // Carga dinámica de jsPDF
    const script1 = document.createElement('script');
    script1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script1.async = true;

    const script2 = document.createElement('script');
    script2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js";
    script2.async = true;

    script1.onload = () => {
      script2.onload = () => setPdfReady(true);
      document.body.appendChild(script2);
    };
    document.body.appendChild(script1);
  }, []);

  // 2. Autenticación y Datos
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) await signInAnonymously(auth);
        setUser(u || auth.currentUser);
      } catch (err) {
        console.error("Auth error:", err);
        showToast("Error de conexión: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    });

    const qReports = collection(db, 'artifacts', appId, 'public', 'data', 'reports');
    const unsubReports = onSnapshot(qReports, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    const qAnnouncements = collection(db, 'artifacts', appId, 'public', 'data', 'announcements');
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAuth(); unsubReports(); unsubAnnouncements(); };
  }, []);

  // Cálculos financieros
  const totalIncomes = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, i) => s + Number(i.amount || 0), 0);
  const subtotal = Number(prevBalance) + totalIncomes;
  const currentBalance = subtotal - totalExpenses;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      setView('admin');
      setError('');
    } catch (err) {
      setError('Acceso denegado. Verifique sus credenciales.');
    }
  };

  const publishReport = async () => {
    if (user.isAnonymous) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'reports'), {
        reportPeriod,
        prevBalance: Number(prevBalance),
        incomes,
        expenses,
        extraDetail,
        totalIncomes,
        totalExpenses,
        currentBalance,
        createdAt: serverTimestamp()
      });
      showToast("Informe publicado correctamente", "success");
      setIncomes([{ detail: '', amount: 0 }]);
      setExpenses([{ detail: '', amount: 0 }]);
      setPrevBalance(0);
      setReportPeriod('');
      setExtraDetail('');
    } catch (e) {
      showToast("Error al publicar.", "error");
    }
  };

  const generatePDF = (data) => {
    if (!pdfReady) return showToast("Cargando motor de PDF...", "error");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Encabezado Formal
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("RENDICIÓN DE CUENTAS", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text("ESTADO FINANCIERO - ANDRADA", 105, 30, { align: 'center' });

    if (data.reportPeriod) {
      doc.setFontSize(14);
      doc.text(`Período de Rendición: ${data.reportPeriod}`, 105, 40, { align: 'center' });
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 20, 55);
    doc.setFont(undefined, 'bold');
    doc.text(`SALDO ANTERIOR: Bs. ${data.prevBalance.toLocaleString()}`, 20, 65);

    // Tabla de Ingresos
    doc.autoTable({
      startY: 75,
      head: [['Descripción de Ingresos', 'Monto']],
      body: data.incomes.map(i => [i.detail, `Bs. ${Number(i.amount).toLocaleString()}`]),
      headStyles: { fillColor: [46, 125, 50] },
      theme: 'grid'
    });

    // Subtotal de Ingresos
    let currentY = doc.lastAutoTable.finalY + 10;
    doc.text(`SUBTOTAL: Bs. ${(data.prevBalance + data.totalIncomes).toLocaleString()}`, 20, currentY);

    // Tabla de Egresos
    doc.autoTable({
      startY: currentY + 5,
      head: [['Descripción de Egresos', 'Monto']],
      body: data.expenses.map(e => [e.detail, `Bs. ${Number(e.amount).toLocaleString()}`]),
      headStyles: { fillColor: [183, 28, 28] },
      theme: 'grid'
    });

    let currentYEgreso = doc.lastAutoTable.finalY + 5;
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL EGRESOS: Bs. ${data.totalExpenses.toLocaleString()}`, 20, currentYEgreso);

    // Balance Final
    currentY = currentYEgreso + 15;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, currentY - 5, 180, 15, 'F');
    doc.setFontSize(14);
    doc.text(`SALDO ACTUAL EN CAJA: Bs. ${data.currentBalance.toLocaleString()}`, 105, currentY + 5, { align: 'center' });

    if (data.extraDetail) {
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text("Observaciones:", 20, currentY + 25);
      doc.text(data.extraDetail, 20, currentY + 32, { maxWidth: 170 });
    }

    doc.save(`Rendicion_${new Date().toLocaleDateString()}.pdf`);
  };

  // Definición de Estilos por Tema
  const styles = {
    batman: {
      bg: "bg-[#050505] text-[#dcdcdc]",
      card: "bg-[#0a0a0a] border-[#e61919]/30 shadow-[0_0_30px_rgba(230,25,25,0.15)]",
      nav: "bg-[#020202]/95 border-b border-[#e61919]/40 backdrop-blur-md shadow-[0_4px_25px_rgba(230,25,25,0.25)]",
      accent: "text-[#ff3333] drop-shadow-[0_0_12px_rgba(255,51,51,0.8)]",
      btn: "bg-[#e61919] hover:bg-[#ff3333] text-white shadow-[0_0_20px_rgba(230,25,25,0.6)] hover:shadow-[0_0_40px_rgba(255,51,51,1)] hover:scale-105 transition-all duration-300",
      input: "bg-[#111] border-[#400] text-white focus:border-[#ff3333] focus:shadow-[0_0_18px_rgba(255,51,51,0.6)] transition-all duration-300",
      badge: "bg-[#e61919]/10 text-[#ff3333] border border-[#ff3333]/50 shadow-[0_0_15px_rgba(230,25,25,0.4)]"
    },
    light: {
      bg: "bg-slate-50 text-slate-900",
      card: "bg-white border-slate-200 shadow-xl",
      nav: "bg-white/90 border-b border-slate-200 backdrop-blur-md",
      accent: "text-blue-600",
      btn: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg",
      input: "bg-white border-slate-300 text-slate-900 focus:border-blue-500",
      badge: "bg-blue-50 text-blue-600 border border-blue-100"
    }
  }[theme];

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-black">
      <Loader2 className="animate-spin text-red-600 mb-4" size={48} />
      <span className="text-red-900 font-black uppercase tracking-[0.3em]">Cargando Sistema</span>
    </div>
  );

  return (
    <div className={`min-h-screen transition-all duration-700 font-sans ${styles.bg}`}>
      {/* BARRA DE NAVEGACIÓN */}
      <nav className={`fixed top-0 w-full z-50 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center ${styles.nav}`}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`${styles.badge} p-2 rounded-xl`}>
            <FileText size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="font-black text-lg md:text-xl tracking-tighter uppercase italic leading-none">
              Sindicato <span className={styles.accent}>Digital</span>
            </h1>
            <p className="text-[8px] md:text-[10px] uppercase font-bold tracking-[0.2em] opacity-40">Portal de Transparencia</p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <button onClick={() => setTheme(theme === 'batman' ? 'light' : 'batman')} className="hover:scale-110 transition-transform">
            {theme === 'batman' ? <Sun className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" /> : <Moon className="text-slate-600 w-5 h-5 md:w-6 md:h-6" />}
          </button>

          {user && !user.isAnonymous ? (
            <div className="flex items-center gap-4">
              <button onClick={() => setView(view === 'admin' ? 'public' : 'admin')} className="text-xs font-black uppercase tracking-widest hover:underline">
                {view === 'admin' ? 'Ver Inicio' : 'Admin'}
              </button>
              <button onClick={() => signOut(auth)} className="text-red-600"><LogOut size={20} /></button>
            </div>
          ) : (
            <button onClick={() => setView('login')} className="flex items-center gap-2 group ml-2 md:ml-4">
              <span className="text-xl md:text-2xl group-hover:rotate-12 transition-transform">🐧</span>
              <span className="hidden md:block text-[10px] font-black uppercase tracking-tighter opacity-50">Admin</span>
            </button>
          )}
        </div>
      </nav>

      <main className="pt-28 pb-20 px-4 max-w-7xl mx-auto">

        {/* LOGIN */}
        {view === 'login' && (
          <div className="max-w-md mx-auto mt-8 md:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className={`p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] border ${styles.card}`}>
              <div className="text-center mb-10">
                <div className="inline-block p-5 bg-red-950/20 rounded-3xl text-red-600 mb-4 shadow-inner">
                  <Lock size={32} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic">Acceso Restringido</h2>
              </div>
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Email</label>
                  <input
                    type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                    className={`w-full p-4 rounded-2xl border outline-none font-bold ${styles.input}`}
                    placeholder="Ingrese Correo" required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Contraseña</label>
                  <input
                    type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                    className={`w-full p-4 rounded-2xl border outline-none font-bold ${styles.input}`}
                    placeholder="••••••••" required
                  />
                </div>
                {error && <p className="text-red-600 text-xs font-black uppercase text-center">{error}</p>}
                <button className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 ${styles.btn}`}>
                  Ingresar
                </button>
                <button type="button" onClick={() => setView('public')} className="w-full text-center text-xs font-bold opacity-30 uppercase mt-2">Volver</button>
              </form>
            </div>
          </div>
        )}

        {/* INICIO PÚBLICO */}
        {view === 'public' && (
          <div className="space-y-16 animate-in fade-in duration-700">
            {/* ANUNCIOS */}
            {announcements.length > 0 && (
              <div className={`relative overflow-hidden p-6 md:p-8 rounded-3xl md:rounded-[3rem] border ${theme === 'batman' ? 'bg-red-950/10 border-red-900/20' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <Megaphone className={styles.accent} />
                  <h2 className="font-black uppercase italic tracking-widest text-sm">Comunicados Oficiales</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {announcements.map(a => (
                    <div key={a.id} className={`p-5 rounded-2xl ${theme === 'batman' ? 'bg-black/60' : 'bg-white'} border border-transparent shadow-lg`}>
                      <p className="text-sm font-medium leading-relaxed">{a.text}</p>
                      <span className="text-[10px] font-black opacity-30 uppercase mt-4 block">
                        {new Date(a.createdAt?.seconds * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LISTADO DE RENDICIONES */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                  <History className={styles.accent} /> Historial de Cuentas
                </h2>
              </div>

              {reports.length === 0 ? (
                <div className="text-center py-20 opacity-20 font-black uppercase tracking-widest">Sin registros publicados</div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {reports.map(rep => (
                    <div key={rep.id} className={`p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border group transition-all hover:-translate-y-2 ${styles.card}`}>
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Periodo de Rendición</span>
                          <h3 className="text-xl font-black">{rep.reportPeriod || new Date(rep.createdAt?.seconds * 1000).toLocaleDateString()}</h3>
                        </div>
                        <div className={`${styles.badge} p-3 rounded-2xl`}>
                          <Wallet size={20} />
                        </div>
                      </div>

                      <div className="mb-10 space-y-4">
                        <div className="flex justify-between items-center text-sm font-bold opacity-60">
                          <span>Saldo en Caja</span>
                          <TrendingUp size={16} className="text-green-500" />
                        </div>
                        <p className="text-4xl font-black italic tracking-tighter">Bs. {rep.currentBalance?.toLocaleString()}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => generatePDF(rep)}
                          className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${styles.btn}`}
                        >
                          <Download size={14} /> PDF
                        </button>
                        <button className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-zinc-800 text-white hover:bg-zinc-700`}>
                          <Eye size={14} /> Vista
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADMINISTRACIÓN */}
        {view === 'admin' && (
          <div className="grid lg:grid-cols-3 gap-12 animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="lg:col-span-2 space-y-10">
              <div className={`p-6 md:p-10 rounded-3xl md:rounded-[3.5rem] border ${styles.card}`}>
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter mb-6 md:mb-8 flex items-center gap-3 md:gap-4">
                  <div className={`${styles.badge} p-2 md:p-3 rounded-xl md:rounded-2xl`}><Plus className="w-5 h-5 md:w-6 md:h-6" /></div>
                  Nueva Rendición
                </h2>

                <div className="space-y-10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Período de Rendición (Mes, Año)</label>
                    <div className="relative">
                      <input
                        type="text" value={reportPeriod} onChange={e => setReportPeriod(e.target.value)}
                        className={`w-full px-8 py-5 rounded-[2rem] border outline-none font-bold placeholder-opacity-50 ${styles.input}`}
                        placeholder="Ej: Enero 2026"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Saldo Inicial (Mes Anterior)</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-2xl opacity-20 mt-1">Bs.</span>
                      <input
                        type="number" value={prevBalance} onChange={e => setPrevBalance(e.target.value)}
                        className={`w-full pl-20 pr-8 py-7 rounded-[2rem] border outline-none text-3xl font-black ${styles.input}`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* INGRESOS */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-4">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-green-500">Ingresos del Periodo</h4>
                      <button onClick={() => setIncomes([...incomes, { detail: '', amount: 0 }])} className="p-2 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500 hover:text-white transition-all"><Plus size={18} /></button>
                    </div>
                    {incomes.map((inc, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-left-4 items-stretch sm:items-center">
                        <input placeholder="Motivo de ingreso" className={`w-full sm:flex-1 p-4 md:p-5 rounded-xl md:rounded-2xl border outline-none font-bold ${styles.input}`} value={inc.detail} onChange={e => { const n = [...incomes]; n[i].detail = e.target.value; setIncomes(n); }} />
                        <div className="flex w-full sm:w-auto gap-3">
                          <input type="number" placeholder="Monto" className={`flex-1 sm:w-36 p-4 md:p-5 rounded-xl md:rounded-2xl border outline-none font-black ${styles.input}`} value={inc.amount} onChange={e => { const n = [...incomes]; n[i].amount = e.target.value; setIncomes(n); }} />
                          {incomes.length > 1 && (
                            <button onClick={() => setIncomes(incomes.filter((_, idx) => idx !== i))} className="p-4 md:p-3 text-red-900 hover:text-red-500 transition-colors bg-red-950/20 sm:bg-transparent rounded-xl md:rounded-2xl flex items-center justify-center" title="Eliminar ingreso">
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* EGRESOS */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-4">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Egresos del Periodo</h4>
                      <button onClick={() => setExpenses([...expenses, { detail: '', amount: 0 }])} className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Plus size={18} /></button>
                    </div>
                    {expenses.map((exp, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-left-4 items-stretch sm:items-center">
                        <input placeholder="Concepto de gasto" className={`w-full sm:flex-1 p-4 md:p-5 rounded-xl md:rounded-2xl border outline-none font-bold ${styles.input}`} value={exp.detail} onChange={e => { const n = [...expenses]; n[i].detail = e.target.value; setExpenses(n); }} />
                        <div className="flex w-full sm:w-auto gap-3">
                          <input type="number" placeholder="Monto" className={`flex-1 sm:w-36 p-4 md:p-5 rounded-xl md:rounded-2xl border outline-none font-black ${styles.input}`} value={exp.amount} onChange={e => { const n = [...expenses]; n[i].amount = e.target.value; setExpenses(n); }} />
                          {expenses.length > 1 && (
                            <button onClick={() => setExpenses(expenses.filter((_, idx) => idx !== i))} className="p-4 md:p-3 text-red-900 hover:text-red-500 transition-colors bg-red-950/20 sm:bg-transparent rounded-xl md:rounded-2xl flex items-center justify-center" title="Eliminar gasto">
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Detalles / Notas Internas</label>
                    <textarea
                      className={`w-full p-6 rounded-[2rem] border outline-none font-bold min-h-[120px] ${styles.input}`}
                      placeholder="Información adicional relevante..."
                      value={extraDetail} onChange={e => setExtraDetail(e.target.value)}
                    />
                  </div>

                  {/* RESUMEN FINAL */}
                  <div className={`p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] border-4 border-dashed ${theme === 'batman' ? 'border-[#222]' : 'border-slate-100'} flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8`}>
                    <div className="text-center md:text-left w-full">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">Total Disponible (Neto)</p>
                      <p className={`text-4xl md:text-5xl font-black italic tracking-tighter truncate ${styles.accent}`}>Bs. {currentBalance.toLocaleString()}</p>
                    </div>
                    <button onClick={publishReport} className={`w-full md:w-auto px-8 md:px-12 py-5 md:py-6 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-xs md:text-sm shadow-2xl transition-all active:scale-95 whitespace-nowrap ${styles.btn}`}>
                      Publicar Rendición
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              {/* GESTIÓN DE ANUNCIOS */}
              <div className={`p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border ${styles.card}`}>
                <h3 className="font-black uppercase tracking-widest text-xs mb-6 flex items-center gap-3">
                  <Megaphone size={18} className={styles.accent} />
                  Publicar Anuncio
                </h3>
                <textarea
                  className={`w-full p-5 rounded-2xl border outline-none text-sm font-bold mb-4 h-32 ${styles.input}`}
                  placeholder="Escriba el comunicado para los socios..."
                  value={announcementText} onChange={e => setAnnouncementText(e.target.value)}
                />
                <button
                  onClick={async () => {
                    if (!announcementText) return;
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'announcements'), { text: announcementText, createdAt: serverTimestamp() });
                    setAnnouncementText('');
                  }}
                  className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${styles.btn}`}
                >
                  Confirmar Envío
                </button>

                <div className="mt-8 space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {announcements.map(a => (
                    <div key={a.id} className="flex justify-between items-start p-4 bg-black/20 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold opacity-60 leading-tight">{a.text}</span>
                      <button onClick={async () => {
                        confirmAction("¿Eliminar este comunicado?", async () => {
                          try {
                            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'announcements', a.id));
                            showToast("Comunicado eliminado", "success");
                          } catch (err) {
                            showToast("Error al eliminar anuncio: " + err.message, "error");
                          }
                        });
                      }} className="text-red-900 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* CONTROL DE HISTORIAL */}
              <div className={`p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border ${styles.card}`}>
                <h3 className="font-black uppercase tracking-widest text-xs mb-6 flex items-center gap-3">
                  <History size={18} className={styles.accent} />
                  Gestión de Registros
                </h3>
                <div className="space-y-3">
                  {reports.map(r => (
                    <div key={r.id} className={`flex items-center justify-between p-4 rounded-2xl border ${theme === 'batman' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div>
                        <p className="text-[10px] font-black opacity-40 uppercase">{new Date(r.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                        <p className="text-lg font-black text-red-600 tracking-tighter">Bs. {r.currentBalance?.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => generatePDF(r)} className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-all"><Eye size={16} /></button>
                        <button onClick={() => {
                          confirmAction("¿Eliminar registro permanentemente?", async () => {
                            try {
                              await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reports', r.id));
                              showToast("Registro borrado con éxito", "success");
                            } catch (err) {
                              showToast("Error al eliminar registro: " + err.message, "error");
                            }
                          });
                        }} className="p-2 rounded-lg bg-red-950/20 text-red-600 hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TOAST CUSTOM */}
      {toast.show && (
        <div className={`fixed bottom-10 right-10 p-5 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] z-50 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 ${toast.type === 'error' ? 'bg-[#111] text-[#ff3333] border border-[#ff3333]/30' : 'bg-[#111] text-green-500 border border-green-500/30'} backdrop-blur-md`}>
          {toast.type === 'error' ? <AlertCircle size={24} className="drop-shadow-[0_0_10px_rgba(255,51,51,0.8)]" /> : <FileText size={24} className="drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]" />}
          <p className="font-bold text-sm tracking-wide">{toast.message}</p>
        </div>
      )}

      {/* MODAL CONFIRMACION */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in px-4">
          <div className={`p-10 rounded-[2.5rem] border-2 max-w-sm w-full text-center ${styles.card}`}>
            <AlertCircle size={56} className="mx-auto text-[#ff3333] mb-6 drop-shadow-[0_0_20px_rgba(255,51,51,0.8)]" />
            <h3 className="text-2xl font-black uppercase italic mb-3 tracking-tighter">¿Estás Seguro?</h3>
            <p className="text-sm font-bold opacity-60 mb-10">{confirmDialog.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })} className="flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 transition-all">Cancelar</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog({ show: false, message: '', onConfirm: null }); }} className={`flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest ${styles.btn}`}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-12 text-center opacity-20 text-[8px] font-black uppercase tracking-[0.8em]">
        Sistema Financiero Sindical &copy; {new Date().getFullYear()} - Rendición de Cuentas
      </footer>

      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; overflow-x: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .animate-in { animation: animateIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes animateIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}